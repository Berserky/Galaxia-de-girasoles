import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';

const edge=readFileSync(new URL('../supabase/functions/android-companion/index.ts',import.meta.url),'utf8');
const bondEngine=readFileSync(new URL('../supabase/functions/android-companion/bond-engine.ts',import.meta.url),'utf8');
const pushEngine=readFileSync(new URL('../supabase/functions/android-companion/push-engine.ts',import.meta.url),'utf8');

function endpoint(rows={}){
 let handler;
 const calls=[];
 const makeQuery=table=>{
  let result=rows[table]??[];
  let single=false;
  const query={
   select(...args){calls.push({table,key:'select',args});return query;},
   eq(...args){calls.push({table,key:'eq',args});return query;},
   neq(...args){calls.push({table,key:'neq',args});return query;},
   gte(...args){calls.push({table,key:'gte',args});return query;},
   gt(...args){calls.push({table,key:'gt',args});return query;},
   is(...args){calls.push({table,key:'is',args});return query;},
   in(...args){calls.push({table,key:'in',args});return query;},
   filter(...args){calls.push({table,key:'filter',args});return query;},
   limit(...args){calls.push({table,key:'limit',args});return query;},
   order(...args){calls.push({table,key:'order',args});return query;},
   update(payload){calls.push({table,key:'update',args:[payload]});return query;},
   delete(){calls.push({table,key:'delete',args:[]});return query;},
   insert(payload){
    calls.push({table,key:'insert',args:[payload]});
    const value=Array.isArray(payload)?payload[0]:payload;
    result={id:'created',version:1,created:'2026-10-02T12:00:00Z',...value};
    return query;
   },
   upsert(payload,...args){calls.push({table,key:'upsert',args:[payload,...args]});result=payload;return query;},
   single(){calls.push({table,key:'single',args:[]});single=true;return query;},
   maybeSingle(){calls.push({table,key:'maybeSingle',args:[]});single=true;return query;},
   then(resolve){
    const data=single?(Array.isArray(result)?result[0]??null:result):result;
    return Promise.resolve({data,error:null}).then(resolve);
   }
  };
  return query;
 };
 const db={
  from(table){calls.push({table});return makeQuery(table);},
  rpc(name,args){calls.push({rpc:name,args});return Promise.resolve({data:null,error:null});},
  storage:{from(bucket){calls.push({bucket});return{
   createSignedUrl:async path=>({data:{signedUrl:'https://private.test/'+encodeURIComponent(path)},error:null}),
   list:async()=>({data:[],error:null}),
   remove:async()=>({data:null,error:null}),
   upload:async()=>({data:null,error:null})
  };}}
 };
 const loadModule=(source,names)=>{
  const moduleContext={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON,TextEncoder,URL,URLSearchParams,fetch,crypto:webcrypto,btoa,atob};
  const stripped=stripTypeScriptTypes(source.replace(/\bexport\s+/g,''));
  vm.runInNewContext(stripped+'\n;module.exports={'+names.join(',')+'};',moduleContext);
  return moduleContext.module.exports;
 };
 const bondApi=loadModule(bondEngine,['BUILTIN_GESTURES','computeBondProgress','gestureSnapshot','normalizeCustomGesture','resolveGesture']);
 const pushApi=loadModule(pushEngine,['PUSH_EVENT_TYPES','sanitizePushPayload','sendFcmData']);
 const code=stripTypeScriptTypes(edge.replace(/^import .*;\r?\n/gm,''));
 const context={
  createClient:()=>db,
  ...bondApi,...pushApi,
  Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://test.supabase.co':key==='SUPABASE_SERVICE_ROLE_KEY'?'test-service-role':''},serve:fn=>{handler=fn;}},
  Response,TextEncoder,crypto:webcrypto,URL,console
 };
 vm.runInNewContext(code+'\n;globalThis.__calendar=nextCalendarEvent;',context);
 return{
  calls,
  calendar:context.__calendar,
  async request(body,token){
   return handler(new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json',...(token?{'x-device-token':token}:{})},body:JSON.stringify(body)}));
  }
 };
}

test('calendar excludes past dates and projects only title/date',()=>{
 const next=endpoint().calendar([
  {id:'past',data:{title:'Pasado',date:'2020-01-01'}},
  {id:'annual',data:{title:'Aniversario',date:'2020-01-01',annual:true,body:'privado'}},
  {id:'soon',data:{title:'Pronto',date:'2026-10-03',body:'privado'}}
 ],'2026-10-02');
 assert.equal(JSON.stringify(next),JSON.stringify({title:'Pronto',date:'2026-10-03'}));
 assert.equal(JSON.stringify(next).includes('privado'),false);
 assert.equal(Object.hasOwn(next,'id'),false);
});

test('calendar keeps leap anniversaries and rejects impossible dates',()=>{
 const calendar=endpoint().calendar;
 assert.equal(calendar([{data:{title:'Bisiesto',date:'2024-02-29',annual:true}}],'2026-10-02').date,'2028-02-29');
 assert.equal(calendar([{data:{title:'Futuro',date:'2030-01-01',annual:true}}],'2026-10-02').date,'2030-01-01');
 assert.equal(calendar([{data:{title:'Malo',date:'2026-02-30'}}],'2026-01-01'),null);
 assert.equal(calendar([{data:{title:'Malo',date:'2026-99-99'}}],'2026-01-01'),null);
});

test('public key alone cannot read moments or send a gesture',async()=>{
 const server=endpoint();
 for(const action of ['moments','gesture']){
  const response=await server.request({action,gesture:'hug'});
  assert.equal(response.status,401);
 }
 assert.equal(server.calls.length,0);
});

test('gesture uses authorized device identity and rejects unknown gesture before insert',async()=>{
 const server=endpoint({galaxy_devices:[{id:'device',person:'1',name:'Android'}],galaxy_bond:[]});
 const token='a'.repeat(64);
 assert.equal((await server.request({action:'gesture',gesture:'teleport',person:'0'},token)).status,400);
 assert.equal(server.calls.some(x=>x.table==='galaxy_bond'&&x.key==='insert'),false);
 const response=await server.request({action:'gesture',gesture:'hug',person:'0'},token);
 assert.equal(response.status,201);
 const insert=server.calls.find(x=>x.table==='galaxy_bond'&&x.key==='insert');
 assert.ok(insert);
 assert.equal(insert.args[0].author,'1');
 assert.equal(insert.args[0].data.gesture,'hug');
});

test('moments projects widget-safe partner state and respects presence privacy',async()=>{
 const server=endpoint({
  galaxy_devices:[{id:'device',person:'0',name:'Android'}],
  galaxy_settings:{data:{names:['Uno','Dos'],albumUrl:'secret',presence:{'1':{shareBattery:false,battery:88,shareListening:false,listening:'secret song'}}}},
  galaxy_items:[{id:'event',kind:'event',data:{title:'Fecha',date:'2090-01-01',body:'secret'}}],
  galaxy_bond_config:{photo_path:'album/photo.jpg'},
  galaxy_bond:[
   {id:'gesture',author:'1',created:'2026-10-02',data:{gesture:'hug',answer:'secret'}},
   {id:'game',author:'1',created:'2026-10-02',data:{answer:'hidden'}}
  ],
  galaxy_daily:[{day:'2026-10-02',person:'1',mood:'feliz'}],
  galaxy_locations:[{person:'1',sharing:true,motion:'walking',speed:1,status:'Voy bien',updated_at:'2026-10-02T20:00:00Z'}]
 });
 const response=await server.request({action:'moments'},'b'.repeat(64));
 assert.equal(response.status,200);
 const output=await response.json();
 assert.deepEqual(Object.keys(output).sort(),['distanceM','etaMinutes','garden','gestures','names','nextEvent','nextPlan','now','photoUrl']);
 assert.equal(output.distanceM,null);
 assert.equal(output.etaMinutes,null);
 assert.ok(output.garden&&Number.isFinite(output.garden.totalDays));
 assert.equal(output.gestures.length,1);
 assert.equal(output.now.mood,'feliz');
 assert.equal(output.now.sharing,true);
 assert.equal(output.now.motion,'walking');
 assert.equal(output.now.battery,null);
 assert.equal(output.now.listening,'');
 assert.equal(JSON.stringify(output).includes('secret song'),false);
 assert.ok(server.calls.some(x=>x.table==='galaxy_bond'&&x.key==='neq'&&x.args[0]==='author'&&x.args[1]==='0'));
 assert.ok(server.calls.some(x=>x.table==='galaxy_bond'&&x.key==='limit'&&x.args[0]===30));
 assert.ok(server.calls.some(x=>x.table==='galaxy_locations'));
 assert.ok(server.calls.some(x=>x.table==='galaxy_daily'));
});

test('light map refresh avoids historical tables',async()=>{
 const server=endpoint({
  galaxy_devices:[{id:'device',person:'0',name:'Android'}],
  galaxy_locations:[],galaxy_places:[],galaxy_trip_points:[],galaxy_destinations:[]
 });
 const response=await server.request({action:'map-state',detail:false},'c'.repeat(64));
 assert.equal(response.status,200);
 const output=await response.json();
 assert.deepEqual(Object.keys(output).sort(),['destinations','locations','places','tripPoints']);
 for(const table of ['galaxy_location_history','galaxy_trip_history','galaxy_place_events','galaxy_encounters'])
  assert.equal(server.calls.some(x=>x.table===table),false);
});

test('transport preference is restricted and bound to device identity',async()=>{
 const server=endpoint({galaxy_devices:[{id:'device',person:'1',name:'Android'}],galaxy_locations:[]});
 const token='d'.repeat(64);
 assert.equal((await server.request({action:'transport-set',preference:'plane',person:'0'},token)).status,400);
 const response=await server.request({action:'transport-set',preference:'transit',person:'0'},token);
 assert.equal(response.status,200);
 const upsert=server.calls.findLast(x=>x.table==='galaxy_locations'&&x.key==='upsert');
 assert.ok(upsert);
 assert.equal(upsert.args[0].person,'1');
 assert.equal(upsert.args[0].transport_preference,'transit');
});
