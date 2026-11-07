import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {placeLayoutProbeExpression,parsePlaceLayoutProof} from '../scripts/p5-map-layout-probe.mjs';

function fake({view='map',marker=true,mapNode=true,presenter=true,inFlight=0,focused=true,width=46,height=48,mapLeft=0,mapRight=320,scrollWidth=320,viewport=320}={}){
  const node=mapNode?{getBoundingClientRect:()=>({left:mapLeft,right:mapRight})}:null;
  const button=marker?{getBoundingClientRect:()=>({width,height})}:null;
  const document={
    querySelector:s=>s==='#map'?node:s==='#map .gmap-marker.place.open button'?button:null,
    querySelectorAll:()=>button?[button]:[],
    documentElement:{scrollWidth},
    activeElement:focused?button:null
  };
  const ctx={document,view,innerWidth:viewport,map:presenter?{el:node}:{el:{}},mapStateReadsInFlight:inFlight};
  return JSON.parse(runInNewContext(placeLayoutProbeExpression,ctx,{timeout:1000}));
}

test('P5 map probe: valid, mounted, focused 44px+ marker is a passing synthetic fixture',()=>{
 const proof=fake();
 assert.equal(proof.kind,'READY');
 assert.deepEqual(proof.missing,[]);
 assert.equal(parsePlaceLayoutProof(JSON.stringify(proof)).status,'PASS');
});

test('P5 map probe: detached marker or detached map yields a diagnostic, never a JS TypeError',()=>{
 for(const options of [{marker:false},{mapNode:false},{marker:false,mapNode:false}]){
  const proof=fake(options);
  assert.equal(proof.kind,'NOT_READY');
  assert.ok(proof.missing.length);
  assert.equal(parsePlaceLayoutProof(JSON.stringify(proof)).status,'RETRYABLE_NOT_READY');
 }
});

test('P5 map probe: presenter replacement, async map-state and wrong view all block readiness',()=>{
 for(const options of [{presenter:false},{inFlight:1},{view:'moments'}]){
  const proof=fake(options);
  assert.equal(proof.kind,'NOT_READY');
  assert.equal(parsePlaceLayoutProof(JSON.stringify(proof)).status,'RETRYABLE_NOT_READY');
 }
});

test('P5 map probe: missing keyboard focus and undersized/overflowing viewport fail strictly',()=>{
 for(const options of [{focused:false},{width:40},{height:30},{scrollWidth:333},{mapRight:350}]){
  const proof=fake(options);
  assert.equal(proof.kind,'READY');
  assert.equal(parsePlaceLayoutProof(JSON.stringify(proof)).status,'FAIL_REQUIREMENT');
 }
});

test('P5 map probe: JavaScript ERR, invalid JSON and partial evidence never count as success',()=>{
 for(const sample of ['ERR:Cannot read properties of null','nope','', 'null','{}','[]']){
  assert.throws(()=>parsePlaceLayoutProof(sample),/^Error: BLOCK_QA:/);
 }
});

test('P5 map probe: inconsistent READY-with-missing-state cannot fake a PASS',()=>{
 const proof=fake();proof.missing=['marker-detached'];
 assert.throws(()=>parsePlaceLayoutProof(JSON.stringify(proof)),/INCONSISTENT_READY_STATE/);
});

test('P5 map probe: no real GPS, no outgoing requests, no unsupported UI actions',()=>{
 assert.doesNotMatch(placeLayoutProbeExpression,/fetch\(|XMLHttpRequest|geolocation|localStorage|api\(|cloud\.|longitude|latitude/);
 assert.match(placeLayoutProbeExpression,/getBoundingClientRect\(\)/);
 assert.match(placeLayoutProbeExpression,/mapStateReadsInFlight/);
});
