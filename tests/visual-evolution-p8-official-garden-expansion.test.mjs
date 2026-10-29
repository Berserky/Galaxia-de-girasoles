import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const read=f=>readFileSync(resolve(root,f),'utf8');
const source=read('supabase/functions/android-companion/bond-engine.ts');
const begin='export function gardenState(totalDays:unknown){';
const start=source.indexOf(begin);
const end=source.indexOf('\nexport function computeBondProgress(',start);
assert.ok(start>=0&&end>start,'Bond is the only authority for true bloom progression');
const gardenState=runInNewContext(source.slice(start,end).replace(begin,'function gardenState(totalDays){')+'\ngardenState',{});
const window={document:{documentElement:{dataset:{theme:'daylight'}},hidden:false}};
runInNewContext(read('android/app/src/main/assets/mobile/galaxy-garden-world-v3.js'),{window,Date,Math});
runInNewContext(read('android/app/src/main/assets/mobile/p5-garden-bond-bridge.js'),{window});
const renderer=window.GalaxyGardenV5,bridge=window.GalaxyGardenBondBridge;
const chapter=(garden)=>renderer.render(garden,{entrance:'none'});

test('P8 server extends flowers only from real joint-participation totals after day 365',()=>{
 const expectations=[[0,0],[30,4],[364,7],[365,8],[394,8],[395,9],[785,22],[815,23],[5705,186],[99999,186]];
 for(const [days,count] of expectations){
  const s=gardenState(days);
  assert.equal(s.bloomTotal,count,String(days));
  assert.equal(s.stage,Math.min(8,s.stage));
  assert.equal(s.totalDays,days);
  assert.ok(s.bloomTotal>=s.stage);
 }
 assert.equal(gardenState(365).next,null);
 assert.equal(gardenState(99999).next,null,'legacy milestone contract stays unchanged');
});

test('P8 authenticated expansion enters meadow after 8 without using preview flags',()=>{
 for(const [days,total,chapterId] of [[365,8,'garden'],[395,9,'meadow'],[785,22,'meadow'],[815,23,'valley'],[5705,186,'constellation']]){
  const canonical=gardenState(days);
  const planned=bridge.plan(canonical);
  assert.equal(planned.ready,true);
  assert.equal(planned.bloomTotal,total);
  const html=chapter({stage:planned.stage,bloomTotal:planned.bloomTotal});
  assert.match(html,new RegExp('data-stage="'+total+'"'));
  assert.match(html,new RegExp('data-chapter="'+chapterId+'"'));
  assert.match(html,/data-demo="false"/);
  assert.equal((html.match(/class="ng-plant /g)||[]).length,Math.min(total,22)*Number(!['planet','constellation'].includes(chapterId)));
 }
});

test('P8 client rejects tampered or absent bloom counts and never infers from days',()=>{
 for(const bad of [null,undefined,-1,7,187,999999,'30',NaN,Infinity,1.5,false]){
  const s=bridge.plan({stage:8,bloomTotal:bad,totalDays:1200});
  assert.equal(s.bloomTotal,8,'untrusted bloom count must not unlock an additional flower');
  assert.match(chapter({stage:8,bloomTotal:bad,totalDays:1200}),/data-stage="8"/);
 }
 const early=bridge.plan({stage:3,bloomTotal:166,totalDays:365});
 assert.equal(early.bloomTotal,3);
 assert.match(chapter({stage:3,bloomTotal:166}),/data-stage="3"/);
 assert.equal(bridge.plan({stage:8,totalDays:99999}).bloomTotal,8,'no local-day extrapolation');
});

test('P8 authenticated bridge re-renders on new verified blooms, never on mere clock motion',()=>{
 let html='',scene=null,count=0;
 const host={
  get innerHTML(){return html},
  set innerHTML(value){
   html=value;count++;
   scene=value.includes('ng-garden"')?{
    dataset:{daypart:'day',season:'summer',stage:String(value.match(/data-stage="(\d+)"/)?.[1]||'')},
    isConnected:true,addEventListener(){},removeEventListener(){},setAttribute(){}
   }:null;
  },
  querySelector(selector){return selector==='.ng-garden'?scene:null}
 };
 const tracker={...renderer,attach(){return ()=>{};}};
 const ctl=bridge.create({engine:tracker,host});
 ctl.update(gardenState(365));
 assert.equal(count,1);
 assert.match(html,/data-stage="8"/);
 ctl.update(gardenState(365));
 assert.equal(count,1,'same state should not re-mount');
 ctl.update(gardenState(395));
 assert.equal(count,2,'new authenticated bloom must render enlarged terrain');
 assert.match(html,/data-chapter="meadow"/);
 ctl.update({stage:8,bloomTotal:999999});
 assert.equal(count,3,'bad bloom input revokes stale expanded terrain');
 assert.match(html,/data-stage="8"/);
 ctl.dispose();
});
