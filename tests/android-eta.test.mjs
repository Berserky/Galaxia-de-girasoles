import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const distanceSource=readFileSync(resolve(root,'android/app/src/main/assets/mobile/distance.js'),'utf8');
const etaSource=readFileSync(resolve(root,'android/app/src/main/assets/mobile/eta.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Date,Math};
vm.runInNewContext(distanceSource,context);
context.module={exports:{}};context.exports=context.module.exports;context.globalThis.GalaxyDistance=context.globalThis.GalaxyDistance;
vm.runInNewContext(etaSource,context);
const {movementMode,speedEstimate,resolveDestination,eta,etaLabel}=context.module.exports;
const now=Date.parse('2026-10-03T12:00:00Z');

test('ETA chooses transport mode and live speed when reliable',()=>{
 assert.equal(movementMode({motion:'walking'}),'walking');
 assert.equal(movementMode({motion:'vehicle',transport_preference:'motorcycle'}),'motorcycle');
 assert.equal(movementMode({motion:'vehicle',transport_preference:'transit'}),'transit');
 assert.equal(speedEstimate({speed:10},'motorcycle').source,'live');
 assert.equal(speedEstimate({speed:0},'motorcycle').source,'typical');
});

test('ETA resolves partner and saved place destinations',()=>{
 const base={locations:[
  {person:'0',sharing:true,latitude:4.7,longitude:-74.07,updated_at:'2026-10-03T11:59:30Z'},
  {person:'1',sharing:true,latitude:4.71,longitude:-74.08,updated_at:'2026-10-03T11:59:30Z'}
 ],places:[{id:9,name:'Nuestro parque',latitude:4.72,longitude:-74.09}]};
 assert.equal(resolveDestination({...base,destinations:[{person:'0',kind:'person',target_person:'1',active:true}]},'0',now).type,'person');
 assert.equal(resolveDestination({...base,destinations:[{person:'0',kind:'place',place_id:9,active:true}]},'0',now).label,'Nuestro parque');
});

test('ETA estimates time but refuses stale locations',()=>{
 const data={locations:[
  {person:'0',sharing:true,latitude:4.7,longitude:-74.07,updated_at:'2026-10-03T11:59:30Z',motion:'vehicle',transport_preference:'motorcycle',speed:0},
  {person:'1',sharing:true,latitude:4.71,longitude:-74.08,updated_at:'2026-10-03T11:59:30Z'}
 ],places:[],destinations:[{person:'0',kind:'person',target_person:'1',label:'Adri',active:true}]};
 const result=eta(data,'0',now);
 assert.equal(result.available,true);
 assert.equal(result.mode,'motorcycle');
 assert.ok(result.seconds>0);
 assert.match(etaLabel(result.seconds),/^≈ /);
 const stale={...data,locations:[{...data.locations[0],updated_at:'2026-10-03T10:00:00Z'},data.locations[1]]};
 assert.equal(eta(stale,'0',now).reason,'own-stale');
});
