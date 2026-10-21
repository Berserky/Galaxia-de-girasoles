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
