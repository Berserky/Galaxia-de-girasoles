import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

// Execute the canonical prototype engine and the proposed browser-compatible
// adapter, not a mock of either implementation. Android assets are unchanged.
const root=resolve(import.meta.dirname,'..');
const html=readFileSync(resolve(root,'docs/visual-evolution-5/prototypes/jardin-vivo-v3.3.html'),'utf8');
const source=readFileSync(resolve(root,'scripts/p5-garden-bond-bridge.js'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,2);
const window={};
runInNewContext(scripts[0],{window},{timeout:3000});
runInNewContext(source,{window},{timeout:3000});
const engine=window.GalaxyGardenV5;
const {plan,create}=window.GalaxyGardenBondBridge;
function host(){
 let current=null,renderCount=0;
 return {get renderCount(){return renderCount},get current(){return current},
  set innerHTML(value){renderCount++;this.html=value;
   current=value.includes('ng-garden"')?{
    dataset:Object.fromEntries([...value.matchAll(/data-([a-z-]+)="([^"]*)"/g)]
     .filter(x=>['daypart','season','celebration','motion','stage'].includes(x[1])).map(x=>[x[1],x[2]])),
    isConnected:true,style:{setProperty(){}},addEventListener(){},removeEventListener(){},
    setAttribute(k,v){this[k]=v}
   }:null;
  },
  get innerHTML(){return this.html},
  querySelector(name){return name==='.ng-garden'?current:null}
 };
}

test('P5 bridge: missing, boolean, empty or malformed Bond stage is unavailable, not a fake seed',()=>{
 for(const entry of [null,{}, {stage:null},{stage:false},{stage:''},{stage:'8'},{stage:-1},{stage:NaN},{stage:2.5}])
  assert.equal(plan(entry).ready,false);
 assert.equal(plan({stage:0}).ready,true);
});

test('P5 bridge: stages 0–8 are real; future stages are capped, never enabled as demos',()=>{
 for(const number of [0,1,3,8,9,122,365]){
  const state=plan({stage:number},{demo:true,previewBloomTotal:122});
  assert.equal(state.stage,Math.min(number,8));
  const page=engine.render({stage:state.stage},{theme:state.theme,daypart:state.daypart||undefined});
  assert.match(page,/data-demo="false"/);
  assert.match(page,/data-chapter="garden"/);
  assert.equal((page.match(/data-flower="/g)||[]).length,Math.min(number,8));
 }
});

test('P5 bridge: lighting, theme, season and motion updates preserve original flower nodes',()=>{
 const el=host(),ctl=create({engine,host:el});
 ctl.update({stage:8},{theme:'daylight',daypart:'day',season:'summer'});
 const flowerScene=el.current;
 assert.ok(flowerScene);assert.equal(el.renderCount,1);
 ctl.update({stage:8},{theme:'christmas',daypart:'night',season:'winter',motion:'reduce'});
 assert.equal(el.current,flowerScene);assert.equal(el.renderCount,1);
 assert.equal(flowerScene.dataset.celebration,'christmas');
 assert.equal(flowerScene.dataset.motion,'reduce');
 assert.match(flowerScene['aria-label'],/etapa oficial 8/);
 ctl.dispose();
});

test('P5 bridge: unlock redraws once; disconnected/malformed Bond state is visibly unavailable',()=>{
 const el=host(),ctl=create({engine,host:el});
 ctl.update({stage:3},{daypart:'day'});
 ctl.update({stage:3},{daypart:'night'});
 assert.equal(el.renderCount,1);
 ctl.update({stage:8},{daypart:'night'});
 assert.equal(el.renderCount,2);
 assert.match(el.html,/data-stage="8"/);
 ctl.update({stage:null});
 assert.match(el.html,/progreso del jardín no está disponible/);
 ctl.dispose();
 assert.throws(()=>ctl.update({stage:1}),/DISPOSED/);
});

test('P5 bridge: only allowlisted theme/season/daypart and reduced-motion preferences',()=>{
 const invalid=plan({stage:8},{theme:'unsafe',season:'weird',daypart:'zzz',motion:'busy'});
 assert.deepEqual([invalid.theme,invalid.season,invalid.daypart,invalid.motion],['daylight',null,null,'full']);
 const valid=plan({stage:2},{theme:'cosmic',daypart:'sunset',season:'winter',motion:'reduce'});
 assert.deepEqual([valid.theme,valid.season,valid.daypart,valid.motion],['cosmic','winter','sunset','reduce']);
});

test('P5 bridge: auto-season refresh works alongside manually selected daylight',()=>{
 const el=host(),calls=[];
 const tracking={...engine,attach(node,opts){calls.push({node,opts});return()=>{};}};
 const ctl=create({engine:tracking,host:el});
 ctl.update({stage:8},{daypart:'sunset'});
 assert.equal(calls[0].opts.autoAmbient,true,'clock must track season even with manual daypart');
 assert.equal(calls[0].opts.autoSeason,true);
 el.current.dataset.daypart='night';
 calls[0].opts.onAmbient();
 assert.equal(el.current.dataset.daypart,'sunset');
 ctl.update({stage:8},{season:'winter',daypart:'sunset'});
 assert.equal(calls.length,2,'changing clock ownership rebinds observer without redrawing flowers');
 assert.equal(el.renderCount,1);
 assert.equal(calls[1].opts.autoSeason,false);
 ctl.dispose();
});

test('P5 bridge: staging source has no network, storage, GPS or experimental world controls',()=>{
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|navigator\.geolocation|previewBloomTotal|demo:true|supabase|api\(/);
 assert.match(source,/engine\.attach\(/);
 assert.match(source,/engine\.render\(/);
});

test('P5 bridge: inherits live seven-theme palette without replacing eight sunflowers',()=>{
 const previous=window.document;
 try{
  const el=host(),ctl=create({engine,host:el});
  window.document={documentElement:{dataset:{theme:'christmas'}}};
  const initial=ctl.update({stage:8},{daypart:'day'});
  assert.equal(initial.theme,'christmas');
  const flowers=el.current;
  assert.equal(el.renderCount,1);
  assert.equal(flowers.dataset.celebration,'christmas');
  window.document.documentElement.dataset.theme='halloween';
  const changed=ctl.update({stage:8},{daypart:'day'});
  assert.equal(changed.theme,'halloween');
  assert.equal(flowers,el.current);
  assert.equal(el.renderCount,1,'celebration change must never replay bloom');
  assert.equal(flowers.dataset.celebration,'halloween');
  assert.equal(ctl.update({stage:8},{theme:'valentine',daypart:'day'}).theme,'valentine');
  assert.equal(flowers.dataset.celebration,'valentine','explicit valid override takes priority');
  assert.equal(ctl.update({stage:8},{theme:'untrusted-theme',daypart:'day'}).theme,'daylight');
  assert.equal(flowers.dataset.celebration,'daylight','unsafe override has safe fallback');
  ctl.dispose();
 }finally{if(previous===undefined)delete window.document;else window.document=previous;}
});

test('P5 bridge: invalid preference payload never crashes Moments or invents progress',()=>{
 const previous=window.document;
 try{
  window.document={documentElement:{dataset:{theme:'christmas'}}};
  for(const malformed of [null,undefined,false,0,'night',[],[1,2]]){
   const result=plan({stage:3},malformed);
   assert.equal(result.ready,true);
   assert.equal(result.stage,3);
   assert.equal(result.theme,'christmas');
   assert.equal(result.motion,'full');
   assert.equal(result.autoDaypart,true);
  }
  const el=host(),ctl=create({engine,host:el});
  assert.equal(ctl.update({stage:3},null).stage,3);
  assert.equal(el.current.dataset.celebration,'christmas');
  assert.equal(ctl.update({stage:3},{theme:'unlisted'}).theme,'daylight');
  assert.equal(ctl.update(null,null).ready,false);
  assert.match(el.html,/El progreso del jardín no está disponible/);
  ctl.dispose();
 }finally{if(previous===undefined)delete window.document;else window.document=previous;}
});

test('P5 bridge: parent redraw and Bond transitions release every stale listener exactly once',()=>{
 let attaches=0,stops=0;
 const tracked={...engine,attach(){attaches++;let released=false;return()=>{assert.equal(released,false,'duplicate stop');released=true;stops++;};}};
 const el=host(),ctl=create({engine:tracked,host:el});
 ctl.update({stage:3},{daypart:'day',season:'winter'});
 assert.equal(attaches,1);
 const original=el.current;
 ctl.update({stage:3},{theme:'easter',daypart:'night',season:'winter'});
 assert.equal(el.current,original);
 assert.equal(attaches,1);
 ctl.update({stage:8},{daypart:'night',season:'winter'});
 assert.equal(attaches,2);assert.equal(stops,1);
 el.innerHTML='<main>Parent replaced the Moments view</main>';
 ctl.update({stage:8},{daypart:'night',season:'winter'});
 assert.equal(attaches,3,'detached host must rebind only new scene');
 assert.equal(stops,2);
 assert.match(el.html,/data-stage="8"/);
 assert.equal(ctl.update({stage:null}).ready,false);
 assert.equal(stops,3);
 ctl.update({stage:1},{daypart:'day',season:'summer'});
 assert.equal(attaches,4);
 ctl.dispose();ctl.dispose();
 assert.equal(stops,4,'all active observers must be removed exactly once');
 assert.throws(()=>ctl.update({stage:1}),/DISPOSED/);
});


test('P5 bridge: first entrance can be disabled on parent remount without disabling real unlock',()=>{
 const rendered=[];
 const spy={...engine,render(garden,opts){rendered.push({...opts,stage:garden.stage});return engine.render(garden,opts);}};
 const el=host(),ctl=create({engine:spy,host:el,initialEntrance:'none'});
 ctl.update({stage:8},{daypart:'day',season:'summer'});
 assert.equal(rendered[0].entrance,'none');
 assert.match(el.html,/data-entrance="none"/);
 ctl.update({stage:8},{daypart:'night',season:'summer'});
 assert.equal(rendered.length,1,'night mode should not replay any growth');
 ctl.update({stage:3},{daypart:'night',season:'summer'});
 assert.equal(rendered[1].entrance,'none','new stage on same controller does not replay initial growth');
 ctl.dispose();
 const newEl=host(),fresh=create({engine:spy,host:newEl});
 fresh.update({stage:0},{daypart:'morning'});
 assert.equal(rendered[2].entrance,'grow','genuine first view still animates by default');
 fresh.dispose();
});
