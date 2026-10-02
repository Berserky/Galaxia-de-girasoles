import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {webcrypto} from 'node:crypto';
const edge=readFileSync(new URL('../supabase/functions/android-companion/index.ts',import.meta.url),'utf8');
function helper(){const match=edge.match(/function nextCalendarEvent\(items: any\[\], today: string\) \{[\s\S]*?\n\}/);assert.ok(match,'calendar helper exists');return vm.runInNewContext(match[0].replace('items: any[], today: string','items, today').replace('value: unknown','value')+'; nextCalendarEvent');}
test('calendar excludes past dates and rolls annual dates without exposing event bodies',()=>{
 const next=helper()([{data:{title:'Pasado',date:'2020-01-01'}},{data:{title:'Aniversario',date:'2020-01-01',annual:true,body:'privado'}},{data:{title:'Pronto',date:'2026-10-03',body:'privado'}}],'2026-10-02');
 assert.equal(JSON.stringify(next),JSON.stringify({title:'Pronto',date:'2026-10-03'}));
});
function endpoint(rows={}){
 let handler;const calls=[];
 const db={from(table){calls.push({table});const query={};for(const key of ['select','eq','neq','gte','is','limit','order','update','single','maybeSingle'])query[key]=(...args)=>{calls.push({table,key,args});return query;};query.then=(resolve)=>Promise.resolve({data:rows[table]??[],error:null}).then(resolve);return query;},
  rpc(name,args){calls.push({rpc:name,args});return Promise.resolve({data:null,error:null});},storage:{from(){return{createSignedUrl:async()=>({data:{signedUrl:'https://private.test/photo'},error:null})};}}};
 const code=stripTypeScriptTypes(edge.replace(/^import .*;\r?\n/gm,''));
 vm.runInNewContext(code,{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>{handler=fn;}},Response,TextEncoder,crypto:webcrypto,URL,console});
 return{calls,async request(body,token){return handler(new Request('https://edge.test',{method:'POST',headers:{'content-type':'application/json',...(token?{'x-device-token':token}:{})},body:JSON.stringify(body)}));}};
}
test('public key alone cannot read moments or send a gesture',async()=>{
 const server=endpoint();for(const action of ['moments','gesture']){const response=await server.request({action,gesture:'hug'});assert.equal(response.status,401);}assert.equal(server.calls.length,0);
});
test('gesture uses authorized device identity and rejects unknown gesture before the service RPC',async()=>{
 const server=endpoint({galaxy_devices:[{id:'device',person:'1'}]});const token='a'.repeat(64);
 assert.equal((await server.request({action:'gesture',gesture:'teleport',person:'0'},token)).status,400);
 assert.equal(server.calls.filter(x=>x.rpc).length,0);
 assert.equal((await server.request({action:'gesture',gesture:'hug',person:'0'},token)).status,200);
 assert.equal(JSON.stringify(server.calls.find(x=>x.rpc).args),JSON.stringify({person_value:'1',gesture_value:'hug'}));
});
test('moments projects only names, event, private signed photo and partner gestures',async()=>{
 const server=endpoint({galaxy_devices:[{id:'device',person:'0'}],galaxy_settings:{data:{names:['Uno','Dos'],albumUrl:'secret'}},galaxy_items:[{data:{title:'Fecha',date:'2090-01-01',body:'secret'}}],galaxy_bond_config:{photo_path:'album/photo.jpg'},galaxy_bond:[{id:'gesture',author:'1',created:'2026-10-02',data:{gesture:'hug',answer:'secret'}},{id:'game',author:'1',data:{answer:'hidden'}}]});
 const response=await server.request({action:'moments'},'b'.repeat(64));assert.equal(response.status,200);const output=await response.json();
 assert.deepEqual(Object.keys(output).sort(),['gestures','names','nextEvent','photoUrl']);assert.equal(output.gestures.length,1);assert.equal(JSON.stringify(output).includes('secret'),false);
 assert.ok(server.calls.some(x=>x.table==='galaxy_bond'&&x.key==='neq'&&x.args[0]==='author'&&x.args[1]==='0'));
 assert.ok(server.calls.some(x=>x.table==='galaxy_bond'&&x.key==='limit'&&x.args[0]===30));
 assert.equal(server.calls.some(x=>x.table?.includes('location')||x.table?.includes('daily')),false);
});
test('calendar keeps leap anniversaries on February 29 and never before their original date',()=>{
 assert.equal(helper()([{data:{title:'Bisiesto',date:'2024-02-29',annual:true}}],'2026-10-02').date,'2028-02-29');
 assert.equal(helper()([{data:{title:'Futuro',date:'2030-01-01',annual:true}}],'2026-10-02').date,'2030-01-01');
 assert.equal(helper()([{data:{title:'Malo',date:'2026-02-30'}}],'2026-01-01'),null);
 assert.equal(helper()([{data:{title:'Malo',date:'2026-99-99'}}],'2026-01-01'),null);
});
