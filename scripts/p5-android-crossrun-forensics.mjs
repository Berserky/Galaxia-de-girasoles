#!/usr/bin/env node
/**
 * Read-only comparison of two independent Android instrumentation artifact runs.
 * A marker printed by awaitV5QaPainted proves that specific screenshot assertion
 * at that instant, not that the entire test, garden or release has passed.
 *
 * No Android source changes, emulators, network calls or CI bypasses.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseAndroidJunit,parseDeviceLogcat} from './p5-android-marker-forensics.mjs';

export const MARKER_CASES=Object.freeze([
 Object.freeze({test:'cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem',label:'before-real-system-document-picker'}),
 Object.freeze({test:'visualEvolutionP5_realMomentsAndroidScreens_andPrivacy',label:'p5-moments-320'}),
 Object.freeze({test:'visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe',label:'before-first-theme'})
]);

function failureFlags(xml){
 const map=new Map();
 const re=/<testcase\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/testcase>)/g;
 for(const entry of String(xml).matchAll(re)){
  const name=entry[1].match(/\bname="([^"]+)"/)?.[1];
  if(!name)continue;
  const body=entry[2]||'';
  const failure=body.match(/<(?:failure|error)\b[^>]*>([\s\S]*?)<\/(?:failure|error)>/)?.[1]||'';
  map.set(name,{
   mapFocusGate:failure.includes('V5_P4_PLACE_FOCUS_GATE='),
   chatTimeoutNested:failure.includes('GALAXY_QA_CHAT_TIMEOUT='),
   jsEvaluationError:failure.includes('Value ERR')||failure.includes('WEBVIEW_JS_ERROR')
  });
 }
 return map;
}
const legitimateSha=sha=>typeof sha==='string'&&/^[0-9a-f]{40}$/.test(sha);

export function compareP5AndroidRuns({sha,runs}={}){
 if(!legitimateSha(sha))throw new Error('BLOCK_QA: EXPECTED_FULL_HEAD_SHA_REQUIRED');
 if(!Array.isArray(runs)||runs.length<2)throw new Error('BLOCK_QA: TWO_INDEPENDENT_RUNS_REQUIRED');
 const seen=new Set();
 const reports=runs.map(run=>{
  if(!Number.isSafeInteger(run?.runId)||run.runId<=0||seen.has(run.runId))
   throw new Error('BLOCK_QA: DISTINCT_VALID_RUN_IDS_REQUIRED');
  seen.add(run.runId);
  if(run.sha!==sha)throw new Error('BLOCK_QA: CROSS_SHA_EVIDENCE_FORBIDDEN');
  if(typeof run.junit!=='string'||!run.junit.trim())
   throw new Error('BLOCK_QA: JUNIT_XML_REQUIRED');
  if(!run.logcats||typeof run.logcats!=='object'||Array.isArray(run.logcats))
   throw new Error('BLOCK_QA: PER_TEST_LOGCATS_REQUIRED');
  const parsed=parseAndroidJunit(run.junit);
  const flags=failureFlags(run.junit);
  const observations=MARKER_CASES.map(({test,label})=>{
   const cases=parsed.tests.filter(t=>t.name===test);
   const entry=cases.length===1?cases[0]:null;
   const rawLog=run.logcats[test];
   const hasLog=typeof rawLog==='string';
   const device=hasLog?parseDeviceLogcat(rawLog):null;
   const confirmed=!!device?.confirmedLabels.includes(label);
   const failedForMarker=entry?.paintMarker===label;
   return {
    test,label,testStatus:entry?.status||'MISSING_OR_AMBIGUOUS',
    paintEvidence:failedForMarker?'SCREENSHOT_MARKER_REJECTED':
     confirmed?'SCREENSHOT_MARKER_CONFIRMED':'NO_POSITIVE_SCREENSHOT_EVIDENCE',
    otherFailure:entry?.status==='FAIL'||entry?.status==='ERROR'?
     (flags.get(test)?.mapFocusGate?'MAP_FOCUS_GATE':
      flags.get(test)?.jsEvaluationError?'JS_EVALUATION_ERROR':'OTHER_OR_NESTED_FAILURE'):null,
    nestedChatTimeout:!!flags.get(test)?.chatTimeoutNested,
    logcatPresent:hasLog,
    maxSkippedFrames:device?.maxSkippedFrames??null
   };
  });
  const missing=observations.filter(x=>x.testStatus==='MISSING_OR_AMBIGUOUS');
  return {
   runId:run.runId,tests:parsed.totals,observations,
   disposition:parsed.totals.failures+parsed.totals.errors||missing.length?
    'BLOCK_QA':'UNVERIFIED_ANDROID_RELEASE'
  };
 });
 const divergences=MARKER_CASES.flatMap(({test,label})=>{
  const rejected=reports.filter(r=>r.observations.some(x=>x.test===test&&x.paintEvidence==='SCREENSHOT_MARKER_REJECTED')).map(r=>r.runId);
  const confirmed=reports.filter(r=>r.observations.some(x=>x.test===test&&x.paintEvidence==='SCREENSHOT_MARKER_CONFIRMED')).map(r=>r.runId);
  return rejected.length&&confirmed.length?[{test,label,rejectedRuns:rejected,confirmedRuns:confirmed}]:[];
 });
 return {
  sha,runCount:reports.length,reports,paintDivergences:divergences,
  disposition:reports.some(r=>r.disposition==='BLOCK_QA')?'BLOCK_QA':'EVIDENCE_ONLY_NOT_APK_CERTIFICATION',
  androidVerified:false,releaseApproved:false,
  cause:'UNDETERMINED. Same-SHA marker differences are evidence of intermittent screenshot observation, not proof of GPU, WebView, renderer or app root cause.'
 };
}
function readManifest(file){
 const base=dirname(resolve(file));
 const data=JSON.parse(readFileSync(file,'utf8'));
 return compareP5AndroidRuns({
  sha:data.sha,
  runs:data.runs?.map(r=>({
   runId:r.runId,sha:r.sha,
   junit:readFileSync(resolve(base,r.junitFile),'utf8'),
   logcats:Object.fromEntries(Object.entries(r.logcatFiles||{}).map(([name,path])=>
    [name,readFileSync(resolve(base,path),'utf8')]))
  }))
 });
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2)options[args[i]]=args[i+1];
 if(!options['--manifest']||args.length%2!==0||Object.keys(options).some(k=>!['--manifest','--output'].includes(k))){
  console.error('Usage: node scripts/p5-android-crossrun-forensics.mjs --manifest comparison.json [--output report.json]');
  process.exitCode=64;
 }else try{
  const result=compareP5AndroidRuns===undefined?null:readManifest(options['--manifest']);
  const json=JSON.stringify(result,null,2)+'\n';
  if(options['--output'])writeFileSync(options['--output'],json);
  process.stdout.write(json);
  if(result.disposition==='BLOCK_QA')process.exitCode=2;
 }catch(error){console.error('Cross-run forensics blocked:',error.message);process.exitCode=2;}
}
