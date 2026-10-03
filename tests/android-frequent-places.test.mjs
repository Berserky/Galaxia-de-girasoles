import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const distanceSource=readFileSync(resolve(root,'android/app/src/main/assets/mobile/distance.js'),'utf8');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/frequent-places.js'),'utf8');
const store=new Map();
const localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
const context={module:{exports:{}},exports:{},globalThis:{localStorage},Date,Math};
vm.runInNewContext(distanceSource,context);
context.module={exports:{}};context.exports=context.module.exports;context.globalThis.GalaxyDistance=context.globalThis.GalaxyDistance;context.globalThis.localStorage=localStorage;
vm.runInNewContext(source,context);
const {suggestionKey,confidenceLabel,isNearby,dismiss,isDismissed,visibleSuggestions}=context.module.exports;

test('frequent place suggestions use stable approximate keys',()=>{
 assert.equal(suggestionKey({latitude:4.71124,longitude:-74.07214}),'4.711,-74.072');
 assert.equal(suggestionKey({latitude:4.71131,longitude:-74.07208}),'4.711,-74.072');
});

test('frequent place confidence reflects repeat days and dwell',()=>{
 assert.equal(confidenceLabel({days:3,dwell_minutes:50}),'Lugar repetido');
 assert.equal(confidenceLabel({days:4,dwell_minutes:120}),'Frecuente');
 assert.equal(confidenceLabel({days:7,dwell_minutes:240}),'Muy frecuente');
});

test('dismissals hide a suggestion temporarily',()=>{
 const s={latitude:4.711,longitude:-74.072};
 dismiss(s,14,localStorage);
 assert.equal(isDismissed(s,localStorage,Date.now()),true);
 assert.equal(visibleSuggestions([s,{latitude:4.72,longitude:-74.08}],localStorage).length,1);
});

test('nearby detects the current frequent zone',()=>{
 const s={latitude:4.711,longitude:-74.0721};
 const current={sharing:true,latitude:4.7115,longitude:-74.0721};
 assert.equal(isNearby(s,current),true);
});
