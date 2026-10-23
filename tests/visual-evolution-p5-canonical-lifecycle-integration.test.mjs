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
 const retiredScene=first.scene;
 ctl.update({host:second,cloud});
 assert.match(second.html,/data-entrance="none"/);
 assert.equal(first.scene,null,'previous host must no longer expose its old flowers');
 assert.doesNotMatch(first.html,/data-flower="/);
 assert.ok(retiredScene.removed.includes('click'));
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


test('P5 end-to-end privacy: unpairing clears prior flowers, listeners and scene contents',()=>{
 const window=browser(),host=fakeHost(),ctl=window.GalaxyMomentsGardenLifecycle.create();
 const first=ctl.update({host,cloud:{bond:{garden:{stage:8}}},sessionKey:'authenticated-A'});
 assert.equal(first.stage,8);
 assert.equal((host.html.match(/data-flower="/g)||[]).length,8);
 const old=host.scene;
 const invalidated=ctl.update({host,cloud:{bond:{garden:{stage:8}}}});
 assert.equal(invalidated.ready,false);
 assert.equal(invalidated.reason,'SESSION_IDENTITY_REQUIRED');
 assert.equal(host.scene,null,'previous pairing garden must disappear immediately');
 assert.doesNotMatch(host.html,/data-flower="/,'old flowers may not remain on screen');
 assert.match(host.html,/El progreso del jardín no está disponible/);
 assert.ok(old.removed.includes('click'),'previous callbacks must be disconnected');
 const recovered=ctl.update({host,cloud:{bond:{garden:{stage:0}}},sessionKey:'authenticated-B'});
 assert.equal(recovered.stage,0);
 assert.match(host.html,/data-stage="0"/);
 assert.doesNotMatch(host.html,/data-flower="/);
 assert.match(host.html,/data-entrance="grow"/,'new pairing begins its own bloom');
 ctl.dispose();
 assert.equal(host.scene,null,'dispose clears current couple garden too');
});
test('P5 end-to-end privacy: changing pair on same host leaves no previous flowers visible',()=>{
 const window=browser(),host=fakeHost(),ctl=window.GalaxyMomentsGardenLifecycle.create();
 ctl.update({host,cloud:{bond:{garden:{stage:8}}},sessionKey:'pair-A'});
 const old=host.scene;
 ctl.update({host,cloud:{bond:{garden:{stage:3}}},sessionKey:'pair-B'});
 assert.equal(old.isConnected,false);
 assert.ok(old.removed.includes('click'));
 assert.match(host.html,/data-stage="3"/);
 assert.equal((host.html.match(/data-flower="/g)||[]).length,3);
 assert.match(host.html,/data-entrance="grow"/);
 ctl.reset();
 assert.equal(host.scene,null,'explicit unpair reset must remove prior scene');
 ctl.dispose();
});


test('P5 end-to-end: detached real V3.3 scene refuses clicks when old host still holds DOM',()=>{
 const window=browser(),host=fakeHost(),pressed=[];
 const ctl=window.GalaxyMomentsGardenLifecycle.create({onFlowerTap:flower=>pressed.push(flower)});
 ctl.update({host,cloud:{bond:{garden:{stage:8}}},sessionKey:'authenticated-pair'});
 const scene=host.scene;
 tap(scene,2);
 assert.deepEqual(pressed,[2]);
 scene.isConnected=false;
 assert.equal(host.querySelector('.ng-garden'),scene,'parent detach does not clear old host children');
 tap(scene,3);
 assert.deepEqual(pressed,[2],'detached parent must not send garden actions');
 ctl.dispose();
 assert.ok(scene.removed.includes('click'));
});

test('P5 end-to-end privacy: absent Moments host clears visible orphan without replaying bloom for same pair',()=>{
 const window=browser(),oldHost=fakeHost(),newHost=fakeHost(),pressed=[];
 const ctl=window.GalaxyMomentsGardenLifecycle.create({onFlowerTap:flower=>pressed.push(flower)});
 const cloud={bond:{garden:{stage:8,totalDays:365}}};
 ctl.update({host:oldHost,cloud,sessionKey:'pair-A'});
 const scene=oldHost.scene;
 tap(scene,2);
 assert.deepEqual(pressed,[2]);
 const missing=ctl.update({host:null,cloud,sessionKey:'pair-A'});
 assert.equal(missing.ready,false);
 assert.equal(missing.reason,'NO_GARDEN_HOST');
 assert.equal(oldHost.scene,null,'orphaned host must not display flowers after navigation');
 assert.doesNotMatch(oldHost.html,/data-flower="/);
 assert.match(oldHost.html,/El progreso del jardín no está disponible/);
 assert.equal(scene.isConnected,false);
 assert.ok(scene.removed.includes('click'),'detached scene has no active handlers');
 tap(scene,3);
 assert.deepEqual(pressed,[2],'orphaned scene must not dispatch stale taps');
 ctl.update({host:newHost,cloud,sessionKey:'pair-A'});
 assert.match(newHost.html,/data-stage="8"/);
 assert.match(newHost.html,/data-entrance="none"/,'same pair must not repeat initial bloom');
 ctl.dispose();
});

test('P5 end-to-end privacy: direct authenticated host replacement clears old DOM and keeps same-pair bloom stable',()=>{
 const window=browser(),oldHost=fakeHost(),nextHost=fakeHost(),pressed=[];
 const ctl=window.GalaxyMomentsGardenLifecycle.create({onFlowerTap:id=>pressed.push(id)});
 const cloud={bond:{garden:{stage:8,totalDays:365}}};
 ctl.update({host:oldHost,cloud,sessionKey:'paired-identity'});
 const retiredScene=oldHost.scene;
 assert.equal((oldHost.html.match(/data-flower="/g)||[]).length,8);
 ctl.update({host:nextHost,cloud,sessionKey:'paired-identity'});
 assert.equal(oldHost.scene,null,'old host must never retain a visible garden after direct swap');
 assert.doesNotMatch(oldHost.html,/data-flower="/,'old flower markup must be cleared');
 assert.match(oldHost.html,/El progreso del jardín no está disponible/);
 assert.equal(retiredScene.isConnected,false);
 assert.ok(retiredScene.removed.includes('click'));
 tap(retiredScene,3);
 assert.deepEqual(pressed,[],'retired host cannot emit flower clicks');
 assert.equal((nextHost.html.match(/data-flower="/g)||[]).length,8);
 assert.match(nextHost.html,/data-entrance="none"/,'same pairing must not replay first bloom');
 tap(nextHost.scene,8);
 assert.deepEqual(pressed,[8]);
 ctl.dispose();
});
