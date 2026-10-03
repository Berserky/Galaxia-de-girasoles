import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/distance.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Date,Math};
vm.runInNewContext(source,context);
const {metersBetween,formatDistance,distanceMood,coupleDistance}=context.module.exports;

test('distance helper calculates realistic meters',()=>{
 const m=metersBetween({latitude:4.711,longitude:-74.0721},{latitude:4.7115,longitude:-74.0721});
 assert.ok(m>50&&m<60);
 assert.equal(formatDistance(850),'850 m');
 assert.equal(formatDistance(2450),'2.5 km');
});

test('distance mood follows encounter thresholds',()=>{
 assert.equal(distanceMood(60).key,'together');
 assert.equal(distanceMood(150).key,'very-close');
 assert.equal(distanceMood(800).key,'close');
 assert.equal(distanceMood(2500).key,'apart');
});

test('distance requires fresh shared locations from both people',()=>{
 const now=Date.parse('2026-10-03T12:00:00Z');
 const fresh=[
  {person:'0',sharing:true,latitude:4.7,longitude:-74.07,updated_at:'2026-10-03T11:59:30Z'},
  {person:'1',sharing:true,latitude:4.701,longitude:-74.07,updated_at:'2026-10-03T11:59:20Z'}
 ];
 assert.equal(coupleDistance(fresh,now).available,true);
 assert.equal(coupleDistance([{...fresh[0],sharing:false},fresh[1]],now).reason,'paused');
 assert.equal(coupleDistance([fresh[0],{...fresh[1],updated_at:'2026-10-03T11:00:00Z'}],now).reason,'stale');
});
