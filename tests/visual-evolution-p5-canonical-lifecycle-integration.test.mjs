import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
import {extractGardenCandidate,PROTOTYPE,BRIDGE,LIFECYCLE} from '../scripts/p5-garden-candidate-export.mjs';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const bundle=extractGardenCandidate(read(PROTOTYPE),read(BRIDGE),read(LIFECYCLE));

function browser(){
 const window={document:{documentElement:{dataset:{theme:'daylight'}},hidden:false}};
 for(const source of [bundle.javascript,bundle.bridge,bundle.lifecycle])
  runInNewContext(source,{window},{timeout:2500});
 return window;
}
function fakeHost(){
 let scene=null,count=0,html='';
 const nodes=[];
 return {
  nodes,get scene(){return scene},get html(){return html},get renderCount(){return count},
  set innerHTML(text){
   html=text;count++;
   if(scene)scene.isConnected=false;
   if(!text.includes(' living-garden-scene ng-garden"')){scene=null;return;}
   const match=[...text.matchAll(/data-([a-z-]+)="([^"]*)"/g)];
   const dataset=Object.fromEntries(match.filter(x=>['stage','daypart','season','celebration','motion'].includes(x[1])).map(x=>[x[1],x[2]]));
   const listeners=new Map();
   scene={
    dataset,isConnected:true,removed:[],handlers:listeners,
    style:{setProperty(){}},contains(){return true},
    addEventListener(type,cb){listeners.set(type,cb)},
    removeEventListener(type,cb){this.removed.push(type);if(listeners.get(type)===cb)listeners.delete(type)},
    setAttribute(name,value){this[name]=value}
   };
   nodes.push(scene);
  },
  querySelector(selector){return selector==='.ng-garden'?scene:null}
 };
}
function tap(scene,n){
 const button={dataset:{flower:String(n)},closest(){return this},animate(){},querySelector(){return null}};
 scene.handlers.get('click')?.({target:button});
}
test('P5 end-to-end: all four canonical V3.3 sources run together without Android globals',()=>{
 assert.equal(bundle.manifest.schemaVersion,3);
 assert.equal(bundle.manifest.files.length,4);
 const window=browser();
 assert.equal(typeof window.GalaxyGardenV5.render,'function');
 assert.equal(typeof window.GalaxyGardenBondBridge.create,'function');
 assert.equal(typeof window.GalaxyMomentsGardenLifecycle.create,'function');
});
test('P5 end-to-end: missing Bond stays unavailable; authentic 0 then 8 retain official stage boundaries',()=>{
 const window=browser(),host=fakeHost(),ctl=window.GalaxyMomentsGardenLifecycle.create();
 assert.equal(ctl.update({host,cloud:null}).ready,false);
 assert.equal(host.scene,null);
 const seed=ctl.update({host,cloud:{bond:{garden:{stage:0,totalDays:0}}}});
 assert.equal(seed.ready,true);
 assert.equal(seed.stage,0);
 assert.match(host.html,/data-demo="false"/);
 assert.match(host.html,/data-stage="0"/);
 assert.equal((host.html.match(/data-flower="/g)||[]).length,0);
 const full=ctl.update({host,cloud:{bond:{garden:{stage:8,totalDays:365}}}});
 assert.equal(full.ready,true);
 assert.equal(full.stage,8);
 assert.match(host.html,/data-stage="8"/);
 assert.equal((host.html.match(/data-flower="/g)||[]).length,8);
 assert.match(host.scene['aria-label'],/etapa oficial 8/);
 ctl.dispose();
});
test('P5 end-to-end: themes and winter/night updates keep the same eight flower nodes',()=>{
 const window=browser(),host=fakeHost(),ctl=window.GalaxyMomentsGardenLifecycle.create();
 const cloud={bond:{garden:{stage:8,totalDays:365}}};
 ctl.update({host,cloud,preferences:{motion:'reduce',season:'winter',daypart:'night'}});
 const first=host.scene,count=host.renderCount;
 window.document.documentElement.dataset.theme='christmas';
 const result=ctl.update({host,cloud,preferences:{motion:'reduce',season:'winter',daypart:'night'}});
 assert.equal(result.theme,'christmas');
 assert.equal(host.scene,first);
 assert.equal(host.renderCount,count);
 assert.equal(host.scene.dataset.season,'winter');
 assert.equal(host.scene.dataset.daypart,'night');
 assert.equal(host.scene.dataset.celebration,'christmas');
 assert.match(host.scene['aria-label'],/invierno, noche/);
 ctl.dispose();
});
test('P5 end-to-end: only real flowers can be tapped, after leaving there are no listeners',()=>{
 const window=browser(),host=fakeHost(),pressed=[];
 const ctl=window.GalaxyMomentsGardenLifecycle.create({onFlowerTap:id=>pressed.push(id)});
 ctl.update({host,cloud:{bond:{garden:{stage:3}}},preferences:{motion:'reduce',daypart:'day'}});
 const old=host.scene;
 tap(old,2);tap(old,7);tap(old,-1);
 assert.deepEqual(pressed,[2]);
 ctl.update({host,cloud:{bond:{garden:{stage:8}}},preferences:{motion:'reduce',daypart:'day'}});
 assert.equal(old.isConnected,false);
 assert.ok(old.removed.includes('click'));
 tap(old,2);
 tap(host.scene,8);
 assert.deepEqual(pressed,[2,8]);
 const current=host.scene;
 ctl.leave();
 assert.ok(current.removed.includes('click'));
 tap(current,8);
 assert.deepEqual(pressed,[2,8]);
 ctl.dispose();
});
test('P5 end-to-end: changing Moments parent does not replay bloom or keep old listeners',()=>{
 const window=browser(),first=fakeHost(),second=fakeHost();
 const ctl=window.GalaxyMomentsGardenLifecycle.create();
 const cloud={bond:{garden:{stage:8}}};
 ctl.update({host:first,cloud});
 assert.match(first.html,/data-entrance="grow"/);
 ctl.update({host:second,cloud});
 assert.match(second.html,/data-entrance="none"/);
 assert.ok(first.scene.removed.includes('click'));
 ctl.leave();
 ctl.update({host:first,cloud});
 assert.match(first.html,/data-entrance="none"/);
 ctl.reset();
 ctl.update({host:second,cloud:{bond:{garden:{stage:0}}}});
 assert.match(second.html,/data-entrance="grow"/);
 ctl.dispose();
});
test('P5 end-to-end: future-world demonstration is never activated by Bond data',()=>{
 const window=browser(),host=fakeHost(),ctl=window.GalaxyMomentsGardenLifecycle.create();
 const value=ctl.update({host,cloud:{bond:{garden:{stage:123,totalDays:9999}}},
  preferences:{previewBloomTotal:123,demo:true}});
 assert.equal(value.ready,true);
 assert.equal(value.stage,8);
 assert.equal(value.capped,true);
 assert.match(host.html,/data-demo="false"/);
 assert.match(host.html,/data-chapter="garden"/);
 assert.equal((host.html.match(/data-flower="/g)||[]).length,8);
 ctl.dispose();
});
