import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

// Read the *authoritative* Bond engine, not a duplicated list of thresholds.
// Only the isolated, dependency-free gardenState function is evaluated; the
// test does not need Deno, Supabase credentials or a TypeScript runtime.
const repo=resolve(import.meta.dirname,'..');
const source=readFileSync(resolve(repo,'supabase/functions/android-companion/bond-engine.ts'),'utf8');
const begin='export function gardenState(totalDays:unknown){';
const start=source.indexOf(begin);
const end=source.indexOf('\nexport function computeBondProgress(',start+begin.length);
assert.ok(start>=0&&end>start,'gardenState must remain independently auditable');
const snippet=source.slice(start,end)
 .replace('export function gardenState(totalDays:unknown){','function gardenState(totalDays){');
const gardenState=runInNewContext(`${snippet}\ngardenState`,{}, {timeout:1000});

const thresholds=[0,1,7,14,30,60,100,180,365];
const ids=['seed','sprout','leaves','bud','sunflower','path','bench','lights','galaxy-garden'];
const days=(n)=>gardenState(n);

test('Bond contract P5: each of the nine official stages unlocks at its authentic day threshold',()=>{
 for(let i=0;i<thresholds.length;i++){
  const state=days(thresholds[i]);
  assert.equal(state.stage,i,`threshold ${thresholds[i]} must unlock stage ${i}`);
  assert.equal(state.totalDays,thresholds[i]);
  assert.equal(state.days,thresholds[i]);
  assert.ok(state.progressPct>=0&&state.progressPct<=100);
  if(i<8){
   assert.equal(state.next.days,thresholds[i+1]);
   assert.equal(state.next.stage,i+1);
  }else{
   assert.equal(state.next,null);
   assert.equal(state.progressPct,100);
  }
 }
});

test('Bond contract P5: a day before each milestone does NOT unlock it prematurely',()=>{
 for(let i=1;i<thresholds.length;i++){
  const before=days(thresholds[i]-1);
  assert.equal(before.stage,i-1,`day ${thresholds[i]-1} must stay at stage ${i-1}`);
  assert.equal(before.next.days,thresholds[i]);
  assert.ok(before.progressPct<100);
 }
});

test('Bond contract P5: milestones are ordered, unique, and locked until their real threshold',()=>{
 for(const amount of [0,1,13,30,180,364,365,700]){
  const state=days(amount);
  assert.equal(state.milestones.length,8);
  assert.equal(state.milestones.map(x=>x.days).join(','),thresholds.slice(1).join(','));
  assert.equal(state.milestones.map(x=>x.id).join(','),ids.slice(1).join(','));
  assert.equal(new Set(state.milestones.map(x=>x.id)).size,8);
  for(const item of state.milestones){
   assert.equal(item.unlocked,amount>=item.days,`milestone ${item.id} on day ${amount}`);
  }
  assert.equal(state.unlockables.length,state.milestones.filter(x=>x.unlocked).length);
 }
});

test('Bond contract P5: total shared days are preserved beyond stage eight; no fabricated next sector',()=>{
 for(const n of [365,366,420,730,1460]){
  const state=days(n);
  assert.equal(state.stage,8);
  assert.equal(state.totalDays,n,'never silently reset accumulated days');
  assert.equal(state.days,n);
  assert.equal(state.next,null,'future expansion milestones need a separate, approved server contract');
  assert.equal(state.progressPct,100);
  assert.equal(state.unlockables.length,8);
 }
});

test('Bond contract P5: stage percentage is clamped and nondecreasing within each stage',()=>{
 for(let i=0;i<thresholds.length-1;i++){
  let previous=-1;
  for(let d=thresholds[i];d<thresholds[i+1];d++){
   const progress=days(d).progressPct;
   assert.ok(Number.isInteger(progress)&&progress>=0&&progress<=100);
   assert.ok(progress>=previous,`progress went backwards at day ${d}`);
   previous=progress;
  }
 }
});

test('Bond contract P5: existing API carries no speculative world or bloom counts',()=>{
 const existing=days(400);
 for(const key of ['world','chapter','chapterId','sectorIndex','sectorTarget','totalBloomCount','previewBloomTotal']){
  assert.equal(Object.hasOwn(existing,key),false,`${key} is a proposal, not an active API field`);
 }
 assert.equal(JSON.stringify(days(365)),JSON.stringify(days(365)),'same input must produce the same official garden');
});

test('Bond contract P5: invalid or fractional day counts never grant additional stages',()=>{
 for(const [input,expected] of [[null,0],[undefined,0],['',0],[-1,0],[-90,0],[0.9,0],[6.9,6],[364.9,364]]){
  const result=days(input);
  assert.equal(result.totalDays,expected);
  assert.equal(result.stage,days(expected).stage);
 }
});
