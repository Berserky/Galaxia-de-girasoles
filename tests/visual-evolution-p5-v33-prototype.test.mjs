import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

// V3.3 remains a synthetic/offline design reference, NOT the Android entrypoint.
const html=readFileSync(resolve(import.meta.dirname,'../docs/visual-evolution-5/prototypes/jardin-vivo-v3.3.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,2,'standalone prototype has core renderer and demo controls');
const sandbox={};
runInNewContext(scripts[0],{window:sandbox},{timeout:3000});
const garden=sandbox.GalaxyGardenV5;
assert.ok(garden,'prototype exposes its offline renderer');
const count=(text,fragment)=>text.split(fragment).length-1;

test('P5 V3.3 preview: standalone, offline, conspicuously synthetic',()=>{
 assert.match(html,/<!doctype html>/i);
 assert.match(html,/<title>[^<]*V3\.3/);
 assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=|https?:\/\/|\bfetch\s*\(/i);
 assert.match(html,/LABORATORIO VISUAL/);
 assert.match(html,/FUTURO demo/);
 assert.match(html,/sin Bond nuevo/i);
});

test('P5 V3.3: without demo flag stage always remains in official 0–8 garden',()=>{
 for(const stage of [0,1,3,7,8,9,22,365,Number.MAX_SAFE_INTEGER]){
  const scene=garden.render({stage},{theme:'daylight',entrance:'none'});
  const real=Math.min(stage,8);
  assert.ok(scene.includes('data-stage="'+real+'"'));
  assert.ok(scene.includes('data-official-stage="'+real+'"'));
  assert.ok(scene.includes('data-demo="false"'));
  assert.ok(scene.includes('data-chapter="garden"'));
 }
});

test('P5 V3.3: 0,1,3,8 accessible blooms and true-stage labels',()=>{
 for(const stage of [0,1,3,8]){
  const scene=garden.render({stage},{motion:'reduce',entrance:'none'});
  assert.equal(count(scene,'data-flower="'),stage);
  for(let i=1;i<=stage;i++)assert.ok(scene.includes('data-flower="'+i+'"'));
  assert.match(scene,/data-motion="reduce"/);
  assert.match(scene,/aria-label="Jardín compartido; etapa oficial/);
 }
});

test('P5 V3.3: chapters beyond 8 require explicit conceptual demo',()=>{
 for(const [total,chapter] of [[9,'meadow'],[23,'valley'],[43,'region'],[75,'planet'],[123,'constellation']]){
  const scene=garden.render({stage:8},{demo:true,previewBloomTotal:total});
  assert.ok(scene.includes('data-stage="'+total+'"'));
  assert.ok(scene.includes('data-official-stage="8"'));
  assert.ok(scene.includes('data-chapter="'+chapter+'"'));
  assert.match(scene,/data-demo="true"/);
  assert.match(scene,/simulación de/);
 }
 assert.match(garden.render({stage:8},{previewBloomTotal:123}),/data-stage="8"/);
});

test('P5 V3.3: themes/decorations behind botany and local seasonal light',()=>{
 assert.equal(garden.THEMES.length,7);
 for(const theme of garden.THEMES){
  const scene=garden.render({stage:8},{theme,daypart:'night',season:'winter'});
  assert.ok(scene.includes('data-celebration="'+theme+'"'));
  assert.ok(scene.indexOf('class="ng-decorations"')<scene.indexOf('class="ng-plant-field"'));
 }
 for(const cls of ['ng-santa-flight','ng-firework','ng-weather'])assert.ok(html.includes(cls));
});

test('P5 V3.3: motion budget, reduced motion and teardown contracts',()=>{
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/\[data-paused="true"\]/);
 assert.match(html,/animation-play-state:paused!important/);
 for(const cls of ['ng-grass','ng-wildflower','ng-starfield','ng-weather','ng-xmas-lights'])assert.ok(html.includes(cls));
 for(const fn of ['IntersectionObserver','visibilitychange','removeEventListener'])assert.ok(scripts[0].includes(fn));
});

test('P5 V3.3: original eight blooms stay present on first conceptual zoom',()=>{
 const close=garden.render({stage:8},{demo:true,previewBloomTotal:8});
 const zoom=garden.render({stage:8},{demo:true,previewBloomTotal:9});
 for(let i=1;i<=8;i++){
  assert.ok(close.includes('data-flower="'+i+'"'));
  assert.ok(zoom.includes('data-flower="'+i+'"'));
 }
 assert.match(zoom,/data-chapter="meadow"/);
});


// A deterministic faux DOM tests scene lifecycle without depending on the
// host browser, QA device, wall clock, Supabase or real user data.
function sceneFixture(options={}){
 const registered=new Map(),removed=[],timers=new Map(),cleared=[],watched=[];
 let observer=null,nextTimer=1,disconnected=false;
 const doc={hidden:false,
  addEventListener:(name,fn)=>registered.set('document:'+name,fn),
  removeEventListener:(name,fn)=>{removed.push('document:'+name);registered.delete('document:'+name)}
 };
 class IO{
  constructor(cb){this.callback=cb;observer=this;}
  observe(node){watched.push(node)}
  disconnect(){disconnected=true;}
 }
 const global={document:doc,IntersectionObserver:IO,matchMedia:()=>({matches:false}),
  addEventListener:(name,fn)=>registered.set('window:'+name,fn),
  removeEventListener:(name,fn)=>{removed.push('window:'+name);registered.delete('window:'+name)},
  setTimeout:(fn,delay)=>{const id=nextTimer++;timers.set(id,{fn,delay});return id},
  clearTimeout:(id)=>{timers.delete(id);cleared.push(id)}
 };
 runInNewContext(scripts[0],{window:global},{timeout:3000});
 const root={dataset:{motion:'full',season:'spring',daypart:'sunset'},isConnected:true,
  style:{setProperty(){}},addEventListener:(name,fn)=>registered.set('root:'+name,fn),
  removeEventListener:(name,fn)=>{removed.push('root:'+name);registered.delete('root:'+name)}};
 const dispose=global.GalaxyGardenV5.attach(root,options);
 return {root,doc,registered,removed,timers,cleared,watched,dispose,
  enter:()=>observer?.callback([{isIntersecting:true}]),
  exit:()=>observer?.callback([{isIntersecting:false}]),
  disconnected:()=>disconnected,
  ambient:()=>global.GalaxyGardenV5.ambient()};
}

test('V3.3 manual daypart still pauses all offscreen animations and restores on return',()=>{
 const f=sceneFixture({autoAmbient:false});
 assert.equal(f.watched.length,1,'IntersectionObserver must run even with manual daypart');
 assert.equal(f.root.dataset.paused,'false');
 assert.equal(f.timers.size,0,'manual lighting must not create a clock timer');
 f.exit();
 assert.equal(f.root.dataset.paused,'true');
 f.enter();
 assert.equal(f.root.dataset.paused,'false');
 assert.equal(f.root.dataset.daypart,'sunset','manual lighting should not change itself');
 assert.equal(f.root.dataset.season,'spring','manual season should remain selected');
 f.dispose();
 assert.equal(f.disconnected(),true);
 assert.equal(f.registered.size,0,'all listeners are removed');
});

test('V3.3 automatic clock updates daypart, never overrides the manually selected season',()=>{
 const f=sceneFixture({autoAmbient:true,autoSeason:false});
 assert.equal(f.root.dataset.daypart,f.ambient().daypart);
 assert.equal(f.root.dataset.season,'spring','autumn/spring choice is independent of automatic clock');
 assert.equal(f.timers.size,1,'clock is scheduled for next daypart boundary only');
 f.exit();
 assert.equal(f.root.dataset.paused,'true');
 assert.equal(f.timers.size,0,'offscreen clocks must be cleared');
 f.enter();
 assert.equal(f.root.dataset.paused,'false');
 assert.equal(f.timers.size,1,'clock resumes only when scene becomes visible');
 f.doc.hidden=true;
 f.registered.get('document:visibilitychange')();
 assert.equal(f.root.dataset.paused,'true');
 assert.equal(f.timers.size,0,'hidden tabs must not run clock timers');
 f.doc.hidden=false;
 f.registered.get('document:visibilitychange')();
 assert.equal(f.root.dataset.paused,'false');
 assert.equal(f.timers.size,1);
 f.dispose();
 assert.equal(f.registered.size,0);
 assert.equal(f.timers.size,0);
 assert.equal(f.disconnected(),true);
});

test('V3.3 demo actually enables the automatic clock option without re-rendering the flowers',()=>{
 assert.match(scripts[1],/autoAmbient:settings\.daypart==='auto'/);
 assert.match(scripts[1],/autoSeason:false/);
 assert.doesNotMatch(scripts[0],/setInterval\(/,'ambient updates must use event/boundary timers');
});

test('V3.3 preview: appearance changes preserve the sunflower DOM instead of replaying growth',()=>{
 assert.match(scripts[1],/function updateAppearance\(\)/);
 assert.match(scripts[1],/node\.dataset\.celebration=settings\.theme/);
 assert.match(scripts[1],/node\.dataset\.motion=settings\.motion/);
 assert.match(scripts[1],/node\.dataset\.season=settings\.season/);
 for(const control of ['themeSelect','motionToggle','timeSelect']){
  const line=scripts[1].split('\n').find(x=>x.includes("$('"+control+"').addEventListener('change'"));
  assert.ok(line,'missing change handler for '+control);
  assert.match(line,/updateAppearance\(\)/);
  assert.doesNotMatch(line,/draw\(\)/,'climate-only changes must retain flower nodes');
 }
 assert.match(scripts[1],/seasonSelect'\)\.value=settings\.season;updateAppearance\(\)/);
 assert.match(scripts[1],/function mountScene\(node\)/);
 assert.match(scripts[1],/dispose=G\.attach\(node/);
});

test('V3.3 preview: the growth slider still changes chapter and camera with real draw',()=>{
 assert.match(scripts[1],/stageRange'\)\.addEventListener\('input',e=>\{settings\.total=Number\(e\.target\.value\);draw\(\)\}/);
 assert.match(scripts[1],/chapterPills'\)\.addEventListener\('click',e=>/);
 assert.match(scripts[1],/if\(wasAuto!==\(settings\.daypart==='auto'\)\)mountScene/);
});

test('V3.3 preview: dynamic ambient refresh offers a label update without re-creating scene',()=>{
 const states=[];
 const f=sceneFixture({autoAmbient:true,autoSeason:false,onAmbient:state=>states.push(state)});
 assert.equal(states.length,1,'first visible mount supplies a daylight state');
 assert.equal(states[0].daypart,f.root.dataset.daypart);
 assert.equal(f.root.dataset.season,'spring');
 f.exit();
 assert.equal(f.root.dataset.paused,'true');
 f.enter();
 assert.equal(states.length,2,'returning to view refreshes only the ambient state');
 f.dispose();
 assert.equal(f.timers.size,0);
 assert.equal(f.registered.size,0);
 assert.match(scripts[1],/onAmbient:\(\)=>accessibleScene\(node\)/);
 assert.match(scripts[1],/node\.setAttribute\('aria-label'/);
});
