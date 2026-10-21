import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {evaluateP5AndroidReadiness,inspectCurrentCheckout} from '../scripts/p5-android-integration-gate.mjs';
import {extractGardenCandidate,PROTOTYPE,BRIDGE} from '../scripts/p5-garden-candidate-export.mjs';
const root='android/app/src/main/assets/mobile/';
const localExpected=extractGardenCandidate(
  readFileSync(PROTOTYPE,'utf8'),readFileSync(BRIDGE,'utf8')
);
const stubIndex=[
 '<link rel="stylesheet" href="./galaxy-moments-v5.css">',
 '<link rel="stylesheet" href="./galaxy-garden-world-v3.css">',
 '<script src="./galaxy-garden-world-v3.js"></script>',
 '<script src="./p5-garden-bond-bridge.js"></script>',
 '<script src="./app.js"></script>'
].join('\n');
const stubApp=[
 'function bondGardenStage(garden){return garden.stage}',
 'function bondGardenVisual(garden) {',
 ' const ctl=window.GalaxyGardenBondBridge.create({host:container});',
 ' return ctl.update({stage:bondGardenStage(garden)});',
 '}'
].join('\n');
function fixtures(){
 const sources={
  [root+'index.html']:stubIndex,
  [root+'app.js']:stubApp,
  [root+'galaxy-garden-world-v3.css']:localExpected.stylesheet,
  [root+'galaxy-garden-world-v3.js']:localExpected.javascript,
  [root+'p5-garden-bond-bridge.js']:localExpected.bridge
 };
 return {sources,get:path=>sources[path]??null,expected:localExpected};
}
function run(modifier){
 const fixture=fixtures();
 if(modifier)modifier(fixture.sources,fixture);
 return evaluateP5AndroidReadiness(fixture);
}
test('P5 integration gate: complete, exact candidate is only static-ready, never Android certified',()=>{
 const result=run();
 assert.equal(result.status,'STATIC_PREFLIGHT_READY_ANDROID_QA_REQUIRED');
 assert.equal(result.androidVerified,false);
 assert.equal(result.prototypeIsNotApk,true);
 assert.equal(result.officialStageMax,8);
 assert.equal(result.blockers.length,0);
 assert.ok(result.checks.length>=9);
});
test('P5 integration gate: app without installed scripts/assets is blocked, not misrepresented as APK',()=>{
 const report=run(files=>{files[root+'index.html']='<!doctype html><script src="./app.js"></script>';
  delete files[root+'galaxy-garden-world-v3.css'];delete files[root+'galaxy-garden-world-v3.js'];delete files[root+'p5-garden-bond-bridge.js'];
 });
 assert.equal(report.status,'BLOCKED_NOT_INTEGRATED');
 assert.equal(report.androidVerified,false);
 for(const item of ['ENGINE_BEFORE_BRIDGE_BEFORE_APP','ASSET_STYLESHEET_EXACT_SHA256','ASSET_BRIDGE_EXACT_SHA256'])
  assert.ok(report.blockers.includes(item));
});
test('P5 integration gate: exact SHA-256 detects stale or tampered canonical bridge',()=>{
 for(const key of ['galaxy-garden-world-v3.js','galaxy-garden-world-v3.css','p5-garden-bond-bridge.js']){
  const result=run(files=>{files[root+key]+='\n/* old or modified */\n'});
  assert.equal(result.status,'BLOCKED_NOT_INTEGRATED',key);
  assert.ok(result.blockers.some(x=>x.includes('ASSET_')),key);
 }
});
test('P5 integration gate: script order, CSS order and duplicate loads block readiness',()=>{
 for(const index of [
  stubIndex.replace('<script src="./p5-garden-bond-bridge.js"></script>','')+
   '\n<script src="./p5-garden-bond-bridge.js"></script>',
  stubIndex.replace('<link rel="stylesheet" href="./galaxy-garden-world-v3.css">','')
    .replace('<link rel="stylesheet" href="./galaxy-moments-v5.css">',
    '<link rel="stylesheet" href="./galaxy-garden-world-v3.css">\n<link rel="stylesheet" href="./galaxy-moments-v5.css">'),
  stubIndex+'<script src="./galaxy-garden-world-v3.js"></script>'
 ]){
  const report=run(files=>{files[root+'index.html']=index});
  assert.equal(report.status,'BLOCKED_NOT_INTEGRATED');
  assert.ok(report.blockers.includes('ENGINE_BEFORE_BRIDGE_BEFORE_APP')||
            report.blockers.includes('GARDEN_STYLESHEET_AFTER_MOMENTS')||
            report.blockers.includes('NO_DUPLICATE_ASSET_LINKS'));
 }
});
test('P5 integration gate: linking scripts alone never proves actual Bond presenter integration',()=>{
 const report=run(files=>{files[root+'app.js']='function bondGardenVisual(garden){return "legacy"}'});
 assert.equal(report.status,'BLOCKED_NOT_INTEGRATED');
 assert.ok(report.blockers.includes('BOND_PRESENTER_USES_BRIDGE'));
 assert.ok(report.blockers.includes('GARDEN_FALLBACK_PRESERVED'));
});
test('P5 integration gate: spoofed manifest or enabled future worlds is rejected',()=>{
 const source=fixtures();
 for(const manifest of [
  {...localExpected.manifest,worldProgressEnabled:true},
  {...localExpected.manifest,officialStageMax:123},
  {...localExpected.manifest,schemaVersion:1}
 ]){
  const report=evaluateP5AndroidReadiness({...source,expected:{...localExpected,manifest}});
  assert.ok(report.blockers.includes('CANONICAL_CANDIDATE_SCHEMA'));
 }
});
test('P5 integration gate: repository inspection is read-only and honest about incomplete APK',()=>{
 const result=inspectCurrentCheckout();
 assert.ok(['BLOCKED_NOT_INTEGRATED','STATIC_PREFLIGHT_READY_ANDROID_QA_REQUIRED'].includes(result.status),
  'source candidate must be available and gate must return an explicit status');
 assert.equal(result.androidVerified,false,'static checks never certify a real Android display');
 assert.ok(Array.isArray(result.blockers));
});
