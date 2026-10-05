import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';

const edgeSource=readFileSync(new URL('../supabase/functions/android-companion/index.ts',import.meta.url),'utf8');
const bondEngine=readFileSync(new URL('../supabase/functions/android-companion/bond-engine.ts',import.meta.url),'utf8');
const pushEngine=readFileSync(new URL('../supabase/functions/android-companion/push-engine.ts',import.meta.url),'utf8');

function loadModule(source,names){
 const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON,TextEncoder,URL,URLSearchParams,fetch,crypto:webcrypto,btoa,atob};
 vm.runInNewContext(stripTypeScriptTypes(source.replace(/\bexport\s+/g,''))+'\n;module.exports={'+names.join(',')+'};',context);
 return context.module.exports;
}

function harness(rows={}){
 const calls=[];
 let storageSingle=0,storageBatch=0;
 const makeQuery=table=>{
  const predicates=[];
  let limitValue=null,orderSpec=null,single=false,resultOverride;
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
   filter(){return query;},
   or(){return query;},
   not(){return query;},
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
    return Promise.resolve({data,error:null}).then(resolve);
   }
  };
  return query;
 };
 const db={
  from(table){return makeQuery(table);},
  rpc(name,args){calls.push({kind:'rpc',name,args});return Promise.resolve({data:rows['rpc:'+name]??[],error:null});},
  storage:{from(bucket){return{
   createSignedUrl:async path=>{storageSingle++;calls.push({kind:'storage-single',bucket,path});return {data:{signedUrl:'https://private.test/'+encodeURIComponent(path)},error:null};},
   createSignedUrls:async paths=>{storageBatch++;calls.push({kind:'storage-batch',bucket,count:paths.length});return {data:paths.map(path=>({path,signedUrl:'https://private.test/'+encodeURIComponent(path),error:null})),error:null};},
   list:async()=>({data:[],error:null}),
   remove:async()=>({data:null,error:null}),
   upload:async()=>({data:null,error:null})
  };}}
 };
 const bondApi=loadModule(bondEngine,['BUILTIN_GESTURES','computeBondProgress','gestureSnapshot','normalizeCustomGesture','resolveGesture']);
 const pushApi=loadModule(pushEngine,['PUSH_EVENT_TYPES','sanitizePushPayload','sendFcmData']);
 let handler;
 const context={
  createClient:()=>db,
  ...bondApi,...pushApi,
  Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://test.supabase.co':key==='SUPABASE_SERVICE_ROLE_KEY'?'test-service-role':''},serve:fn=>{handler=fn;}},
  Response,Request,TextEncoder,crypto:webcrypto,URL,URLSearchParams,console,fetch,Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON
 };
 const code=stripTypeScriptTypes(edgeSource.replace(/^import .*;\r?\n/gm,''));
 vm.runInNewContext(code+'\n;globalThis.__phase4={chatHydrate,chatHydrateEntityRef,chatHydrateEntityRefs};',context);
 return {
  api:context.__phase4,
  calls,
  handler,
  stats:()=>({db:calls.filter(x=>x.kind==='db').length,rpc:calls.filter(x=>x.kind==='rpc').length,storageSingle,storageBatch})
 };
}

function message(id,type='card'){
 return {id,sender_person:'0',body:'',message_type:type,attachment:{},server_seq:Number(id.replace(/\D/g,''))||1,deleted_at:null,view_once:false};
}

test('NG-QA-017 routes message hydration through one batch planner',()=>{
 const start=edgeSource.indexOf('async function chatHydrate(rows:any[],person:string)');
 const end=edgeSource.indexOf('\nasync function chatVisibleRows',start);
 const block=edgeSource.slice(start,end);
 assert.ok(block.includes('chatHydrateEntityRefs([...refMap.entries()],person)'));
 assert.equal(block.includes('map(async([messageId,ref]:any)=>[messageId,await chatHydrateEntityRef'),false);
 assert.ok(edgeSource.includes('.in("id",itemIds)'));
 assert.ok(edgeSource.includes('.in("poll_id",pollIds)'));
 assert.ok(edgeSource.includes('.in("checklist_id",checklistIds)'));
});

test('100 Galaxy Cards hydrate with one galaxy_items query instead of N queries',async()=>{
 const messages=Array.from({length:100},(_,i)=>message('m'+(i+1)));
 const refs=messages.map((m,i)=>({message_id:m.id,card_type:'MEMORY',entity_kind:'memory',entity_id:'item-'+(i+1)}));
 const items=refs.map((r,i)=>({id:r.entity_id,kind:'memory',data:{title:'Memory '+(i+1),body:'Body'},author:String(i%2),created:'2026-10-04T20:00:00Z'}));
 const h=harness({galaxy_chat_reactions:[],galaxy_chat_pins:[],galaxy_chat_favorites:[],galaxy_chat_attachments:[],galaxy_chat_entity_refs:refs,galaxy_items:items});
 const out=await h.api.chatHydrate(messages,'0');
 assert.equal(out.length,100);
 assert.equal(out.filter(x=>x.card?.available===true).length,100);
 assert.equal(h.calls.filter(x=>x.kind==='db'&&x.table==='galaxy_items').length,1);
 assert.ok(h.stats().db<=7,'expected constant database round trips, got '+h.stats().db);
});

test('50 image attachments use one Storage signing batch per bucket',async()=>{
 const messages=Array.from({length:50},(_,i)=>message('m'+(i+1),'image'));
 const attachments=messages.map((m,i)=>({id:'a'+i,message_id:m.id,bucket:'galaxy-chat-media',path:'0/photo-'+i+'.jpg',thumbnail_path:null,kind:'image',mime:'image/jpeg',name:'photo.jpg',size_bytes:1024,width:100,height:100,created_at:'2026-10-04T20:00:00Z'}));
 const h=harness({galaxy_chat_reactions:[],galaxy_chat_pins:[],galaxy_chat_favorites:[],galaxy_chat_attachments:attachments,galaxy_chat_entity_refs:[]});
 const out=await h.api.chatHydrate(messages,'0');
 assert.equal(out.reduce((n,x)=>n+x.attachments.length,0),50);
 assert.equal(h.stats().storageBatch,1);
 assert.equal(h.stats().storageSingle,0);
});

test('batch keeps ETA and CHECK_IN distinct for the same context session',async()=>{
 const h=harness({
  galaxy_context_sessions:[{id:'ctx',person:'0',label:'Camino',status:'active',destination_kind:'person',target_person:'1',place_id:null,last_distance_m:500,last_eta_s:300,progress_pct:50,started_at:'2026-10-04T20:00:00Z',arrived_at:null,ended_at:null,updated_at:'2026-10-04T20:01:00Z'}],
  galaxy_context_eta_history:[{session_id:'ctx',captured_at:'2026-10-04T20:02:00Z',distance_m:400,eta_s:240,progress_pct:60}],
  galaxy_locations:[{person:'0',status:'Bien',sharing:true,latitude:4.6,longitude:-74.1,transport_preference:'motorcycle',updated_at:'2026-10-04T20:00:00Z'}]
 });
 const batch=await h.api.chatHydrateEntityRefs([
  ['eta',{card_type:'ETA',entity_kind:'context_session',entity_id:'ctx'}],
  ['check',{card_type:'CHECK_IN',entity_kind:'context_session',entity_id:'ctx'}]
 ],'0');
 assert.equal(batch.get('eta').type,'ETA');
 assert.equal(batch.get('check').type,'CHECK_IN');
});

test('batch card payload matches direct hydration for representative domains',async()=>{
 const fixtures={
  galaxy_items:[
   {id:'mem',kind:'memory',data:{title:'Recuerdo',body:'Hola'},author:'0',created:'2026-10-04T20:00:00Z'},
   {id:'cap',kind:'capsule',data:{title:'Cápsula',unlockType:'date',unlockDate:'2020-01-01',photoPath:'0/cap.jpg',audioPath:'0/cap.m4a',songId:'song'},author:'0',created:'2026-10-04T20:00:00Z'},
   {id:'song',kind:'song',data:{title:'Tema',artist:'Artista',source:'spotify',url:'https://example.test/song'},author:'0',created:'2026-10-04T20:00:00Z'}
  ],
  galaxy_goals:[{id:'goal',kind:'shared',title:'Meta',description:'Desc',category:'life',target_date:'2026-12-01',status:'active',target_amount:null,created_by:'0',version:2,updated_at:'2026-10-04T20:00:00Z'}],
  galaxy_places:[{id:7,owner:'0',name:'Lugar',kind:'memory',latitude:4.6,longitude:-74.1,note:'Nota',created_at:'2026-10-04T20:00:00Z'}],
  galaxy_chat_polls:[{id:'poll',question:'¿Plan?',allow_multiple:false,closes_at:null,closed_at:null,created_by:'0'}],
  galaxy_chat_poll_options:[{id:'o1',poll_id:'poll',label:'Sí',position:0},{id:'o2',poll_id:'poll',label:'No',position:1}],
  galaxy_chat_poll_votes:[{poll_id:'poll',option_id:'o1',person:'0',voted_at:'2026-10-04T20:00:00Z'}],
  galaxy_chat_checklists:[{id:'list',title:'Lista',created_by:'0',version:1}],
  galaxy_chat_checklist_items:[{id:'li1',checklist_id:'list',label:'Uno',position:0,checked:true,updated_by:'0',updated_at:'2026-10-04T20:00:00Z',version:1}],
  galaxy_locations:[{person:'0',status:'Bien',sharing:true,latitude:4.6,longitude:-74.1,transport_preference:'motorcycle',updated_at:'2026-10-04T20:00:00Z'}]
 };
 const refs=[
  {card_type:'MEMORY',entity_kind:'memory',entity_id:'mem'},
  {card_type:'CAPSULE',entity_kind:'capsule',entity_id:'cap'},
  {card_type:'GOAL',entity_kind:'goal',entity_id:'goal'},
  {card_type:'PLACE',entity_kind:'place',entity_id:'7'},
  {card_type:'POLL',entity_kind:'poll',entity_id:'poll'},
  {card_type:'CHECKLIST',entity_kind:'checklist',entity_id:'list'},
  {card_type:'STATUS',entity_kind:'status',entity_id:'0'}
 ];
 for(const ref of refs){
  const h=harness(fixtures);
  const direct=await h.api.chatHydrateEntityRef(ref,'0');
  const batch=await h.api.chatHydrateEntityRefs([['m',ref]],'0');
  assert.deepEqual(JSON.parse(JSON.stringify(batch.get('m'))),JSON.parse(JSON.stringify(direct)),ref.entity_kind);
 }
});
