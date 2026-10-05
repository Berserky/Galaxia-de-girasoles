import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto,createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';

const sourcePath=process.argv[2]||'supabase/functions/android-companion/index.ts';
const edgeSource=readFileSync(sourcePath,'utf8');
const bondEngine=readFileSync('supabase/functions/android-companion/bond-engine.ts','utf8');
const pushEngine=readFileSync('supabase/functions/android-companion/push-engine.ts','utf8');

function loadModule(source,names){
 const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON,TextEncoder,URL,URLSearchParams,fetch,crypto:webcrypto,btoa,atob};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/\bexport\s+/g,''))+'\n;module.exports={'+names.join(',')+'};',context);
 return context.module.exports;
}

function makeHarness(){
 let rows={};
 const calls=[];
 let storageSingle=0,storageBatch=0;
 const makeQuery=table=>{
  const predicates=[];let limitValue=null,orderSpec=null,single=false,resultOverride;
  const query={
   select(){return query;},
   eq(key,value){predicates.push(row=>String(row?.[key])===String(value));return query;},
   neq(key,value){predicates.push(row=>String(row?.[key])!==String(value));return query;},
   is(key,value){predicates.push(row=>value===null?row?.[key]==null:row?.[key]===value);return query;},
   in(key,values){const set=new Set((values||[]).map(String));predicates.push(row=>set.has(String(row?.[key])));return query;},
   gt(key,value){predicates.push(row=>row?.[key]>value);return query;},
   gte(key,value){predicates.push(row=>row?.[key]>=value);return query;},
   lt(key,value){predicates.push(row=>row?.[key]<value);return query;},
   lte(key,value){predicates.push(row=>row?.[key]<=value);return query;},
   filter(){return query;},or(){return query;},not(){return query;},contains(){return query;},match(){return query;},
   order(key,options={}){orderSpec=[key,options?.ascending!==false];return query;},
   limit(value){limitValue=Number(value);return query;},
   update(payload){resultOverride=payload;return query;},
   delete(){resultOverride=[];return query;},
   insert(payload){resultOverride=payload;return query;},
   upsert(payload){resultOverride=payload;return query;},
   single(){single=true;return query;},
   maybeSingle(){single=true;return query;},
   then(resolve){
    calls.push({kind:'db',table});
    let data=resultOverride!==undefined?resultOverride:(rows[table]??[]);
    if(Array.isArray(data)){
     data=data.filter(row=>predicates.every(fn=>fn(row)));
     if(orderSpec){
      const [key,ascending]=orderSpec;
      data=[...data].sort((a,b)=>String(a?.[key]??'').localeCompare(String(b?.[key]??''))*(ascending?1:-1));
     }
     if(Number.isFinite(limitValue))data=data.slice(0,limitValue);
     if(single)data=data[0]??null;
    }
    return Promise.resolve({data,error:null,count:Array.isArray(data)?data.length:undefined}).then(resolve);
   }
  };
  return query;
 };
 const db={
  from(table){return makeQuery(table);},
  rpc(name,args){calls.push({kind:'rpc',name,args});return Promise.resolve({data:rows['rpc:'+name]??[],error:null});},
  storage:{from(bucket){return{
   createSignedUrl:async path=>{storageSingle++;calls.push({kind:'storage-single',bucket});return {data:{signedUrl:'https://private.test/'+encodeURIComponent(path)},error:null};},
   createSignedUrls:async paths=>{storageBatch++;calls.push({kind:'storage-batch',bucket,count:paths.length});return {data:paths.map(path=>({path,signedUrl:'https://private.test/'+encodeURIComponent(path),error:null})),error:null};},
   list:async()=>({data:[],error:null}),
   remove:async()=>({data:null,error:null}),
   upload:async()=>({data:null,error:null}),
   download:async()=>({data:new Blob(),error:null})
  };}}
 };
 const bondApi=loadModule(bondEngine,['BUILTIN_GESTURES','computeBondProgress','gestureSnapshot','normalizeCustomGesture','resolveGesture']);
 const pushApi=loadModule(pushEngine,['PUSH_EVENT_TYPES','sanitizePushPayload','sendFcmData']);
 let handler;
 const context={
  createClient:()=>db,...bondApi,...pushApi,
  Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://test.supabase.co':key==='SUPABASE_SERVICE_ROLE_KEY'?'test-service-role':''},serve:fn=>{handler=fn;}},
  Response,Request,Blob,TextEncoder,TextDecoder,crypto:webcrypto,URL,URLSearchParams,console,fetch,Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON,AbortController
 };
 const code=stripTypeScriptTypes(edgeSource.replace(/^import .*;\r?\n/gm,''));
 vm.runInNewContext(code+'\n;globalThis.__phase4={chatHydrate};',context);
 return {
  api:context.__phase4,
  handler,
  setRows(value){rows=value||{};},
  reset(){calls.length=0;storageSingle=0;storageBatch=0;},
  stats(){return {db:calls.filter(x=>x.kind==='db').length,rpc:calls.filter(x=>x.kind==='rpc').length,storageSingle,storageBatch,total:calls.length};}
 };
}
const h=makeHarness();

function message(i,type='text'){return {id:'m'+i,sender_person:String(i%2),body:'message '+i,message_type:type,attachment:{},server_seq:i,deleted_at:null,view_once:false,reply_to:null};}
function baseRows(extra={}){return {galaxy_chat_reactions:[],galaxy_chat_pins:[],galaxy_chat_favorites:[],galaxy_chat_attachments:[],galaxy_chat_entity_refs:[],...extra};}
function median(values){const a=[...values].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];}

async function timed(fn,repeats=3){
 const times=[];let stats=null,result=null;
 for(let i=0;i<repeats;i++){
  h.reset();const start=performance.now();result=await fn();times.push(performance.now()-start);stats=h.stats();
 }
 return {ms:Number(median(times).toFixed(3)),...stats,result};
}

const metrics={source:sourcePath,generatedAt:new Date().toISOString(),chat:{},cards:{},images:{},search:{},map:{},intelligence:{}};

for(const count of [100,500,5000]){
 const messages=Array.from({length:count},(_,i)=>message(i+1));
 h.setRows(baseRows());
 const m=await timed(()=>h.api.chatHydrate(messages,'0'));
 metrics.chat[count]={ms:m.ms,dbRoundTrips:m.db,storageRoundTrips:m.storageSingle+m.storageBatch};
}

{
 const count=100,messages=Array.from({length:count},(_,i)=>message(i+1,'card'));
 const refs=messages.map((m,i)=>({message_id:m.id,card_type:'MEMORY',entity_kind:'memory',entity_id:'item-'+(i+1)}));
 const items=refs.map((r,i)=>({id:r.entity_id,kind:'memory',data:{title:'Memory '+(i+1),body:'Body'},author:String(i%2),created:'2026-10-04T20:00:00Z'}));
 h.setRows(baseRows({galaxy_chat_entity_refs:refs,galaxy_items:items}));
 const m=await timed(()=>h.api.chatHydrate(messages,'0'));
 metrics.cards[100]={ms:m.ms,dbRoundTrips:m.db,itemQueries:m.result?undefined:undefined};
}

{
 const count=50,messages=Array.from({length:count},(_,i)=>message(i+1,'image'));
 const attachments=messages.map((m,i)=>({id:'a'+i,message_id:m.id,bucket:'galaxy-chat-media',path:'0/photo-'+i+'.jpg',thumbnail_path:null,kind:'image',mime:'image/jpeg',name:'photo.jpg',size_bytes:1024,width:100,height:100,created_at:'2026-10-04T20:00:00Z'}));
 h.setRows(baseRows({galaxy_chat_attachments:attachments}));
 const m=await timed(()=>h.api.chatHydrate(messages,'0'));
 metrics.images[50]={ms:m.ms,dbRoundTrips:m.db,storageSingle:m.storageSingle,storageBatch:m.storageBatch};
}

const token='p'.repeat(64),tokenHash=createHash('sha256').update(token).digest('hex');
const device={id:'device',person:'0',name:'Android',token_hash:tokenHash,revoked_at:null,last_seen_at:new Date().toISOString()};
async function actionMetric(action,body,scenarioRows){
 h.setRows({galaxy_devices:[device],...scenarioRows});
 const m=await timed(async()=>{
  const response=await h.handler(new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json','x-device-token':token},body:JSON.stringify({action,...body})}));
  const payload=await response.json();
  return {status:response.status,payload};
 },1);
 return {status:m.result.status,ms:m.ms,dbRoundTrips:m.db,rpcRoundTrips:m.rpc,storageRoundTrips:m.storageSingle+m.storageBatch};
}

metrics.search=await actionMetric('chat-search',{query:'memory',limit:40},baseRows({'rpc:galaxy_chat_search_page':[]}));
metrics.map.light=await actionMetric('map-state',{detail:false},{galaxy_locations:[],galaxy_places:[],galaxy_trip_points:[],galaxy_destinations:[],galaxy_context_settings:[],galaxy_context_sessions:[]});
metrics.map.detail=await actionMetric('map-state',{detail:true},{galaxy_locations:[],galaxy_places:[],galaxy_trip_points:[],galaxy_destinations:[],galaxy_context_settings:[],galaxy_context_sessions:[],galaxy_trip_history:[],galaxy_place_events:[],galaxy_encounters:[],galaxy_context_suggestions:[],galaxy_context_events:[]});
metrics.intelligence=await actionMetric('intelligence-search',{query:'galaxia',limit:20},{
 galaxy_intelligence_cleanup_queue:[],galaxy_items:[],galaxy_locations:[],galaxy_intelligence_documents:[],
 'rpc:galaxy_intelligence_hybrid_search':[]
});

process.stdout.write(JSON.stringify(metrics,null,2)+'\n');
