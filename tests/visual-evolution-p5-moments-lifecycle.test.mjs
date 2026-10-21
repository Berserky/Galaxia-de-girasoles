import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const source=readFileSync(resolve(import.meta.dirname,'../scripts/p5-moments-garden-lifecycle.js'),'utf8');
const window={};
runInNewContext(source,{window},{timeout:2000});
const {authenticGarden,create}=window.GalaxyMomentsGardenLifecycle;
const host=()=>({querySelector(){return null}});
function tracking(){
 const instances=[];
 const bridge={plan(){},create(opts){
  const record={...opts,stopped:0,updates:[]};
  instances.push(record);
  return {
   update(garden,prefs){record.updates.push({garden,prefs});return garden?.stage===undefined?
    {ready:false,reason:'NO_AUTHENTIC_STAGE'}:
    {ready:true,stage:garden.stage};
   },
   dispose(){record.stopped++;assert.equal(record.stopped,1,'stale observer released twice');}
  };
 }};
 return {bridge,instances};
}
test('P5 lifecycle: no implicit stage 0 or fabricated garden from missing Bond snapshot',()=>{
 for(const entry of [undefined,null,{}, {bond:null},{bond:{}},{bond:{garden:null}},
  {bond:{garden:0}}, {bond:{garden:[]}}])
  assert.equal(authenticGarden(entry),null);
 const garden={stage:0,days:0};
 assert.equal(authenticGarden({bond:{garden}}),garden,'genuine stage 0 is valid');
});
test('P5 lifecycle: stage 0 is authentic only after the Bond garden exists',()=>{
 const {bridge,instances}=tracking(),ctl=create({bridge}),mount=host();
 assert.equal(ctl.update({host:mount,cloud:null}).ready,false);
 assert.equal(instances[0].updates[0].garden,null);
 const real=ctl.update({host:mount,cloud:{bond:{garden:{stage:0}}}});
 assert.equal(real.ready,true);
 assert.equal(real.stage,0);
 assert.equal(instances.length,1,'same host must not create another observer');
 ctl.dispose();
 assert.equal(instances[0].stopped,1);
});
test('P5 lifecycle: no bloom replay after parent rerender, layout navigation or same stage',()=>{
 const {bridge,instances}=tracking(),ctl=create({bridge});
 const first=host(),second=host(),state={bond:{garden:{stage:8}}};
 assert.equal(ctl.update({host:first,cloud:state}).stage,8);
 assert.equal(instances[0].initialEntrance,'grow');
 assert.equal(ctl.update({host:first,cloud:state}).stage,8);
 assert.equal(instances.length,1);
 assert.equal(ctl.update({host:second,cloud:state}).stage,8);
 assert.equal(instances[0].stopped,1);
 assert.equal(instances[1].initialEntrance,'none','parent redraw must not regrow eight flowers');
 ctl.leave();
 assert.equal(instances[1].stopped,1);
 ctl.update({host:first,cloud:state});
 assert.equal(instances[2].initialEntrance,'none','re-entering tab must not falsely replay bloom');
 ctl.dispose();ctl.dispose();
 assert.equal(instances[2].stopped,1);
 assert.throws(()=>ctl.update({host:first,cloud:state}),/P5_LIFECYCLE_DISPOSED/);
});
test('P5 lifecycle: relationship reset releases scene and permits a new first entrance',()=>{
 const {bridge,instances}=tracking(),ctl=create({bridge});
 const existing=host();
 ctl.update({host:existing,cloud:{bond:{garden:{stage:3}}}});
 ctl.reset();
 assert.equal(instances[0].stopped,1);
 ctl.update({host:host(),cloud:{bond:{garden:{stage:0}}}});
 assert.equal(instances[1].initialEntrance,'grow','new relationship has a new lifecycle');
 assert.equal(instances[1].updates[0].garden.stage,0);
 ctl.dispose();
});
test('P5 lifecycle: no host means do not mount or leak a previous observer',()=>{
 const {bridge,instances}=tracking(),ctl=create({bridge});
 assert.equal(ctl.update({cloud:{bond:{garden:{stage:4}}}}).reason,'NO_GARDEN_HOST');
 assert.equal(instances.length,0);
 const h=host();ctl.update({host:h,cloud:{bond:{garden:{stage:4}}}});
 assert.equal(ctl.update({host:null}).reason,'NO_GARDEN_HOST');
 assert.equal(instances[0].stopped,1);
 ctl.dispose();
});
test('P5 lifecycle: rejects missing bridge and cannot fetch, store or enable demonstration worlds',()=>{
 assert.throws(()=>create({bridge:{create(){}}}),/P5_LIFECYCLE_BLOCKED/);
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|navigator\.geolocation|previewBloomTotal|demo:true|supabase|document\.write/);
 assert.match(source,/authenticGarden\(cloud\)/);
 assert.match(source,/controller\?\.dispose\(\)/);
});
