#!/usr/bin/env node
/**
 * P5 diagnostic, read-only. Compare strict Android paint-marker evidence from
 * Gradle connectedDebugAndroidTest JUnit XML and per-test logcat files.
 * Never replaces the physical screenshot assertion or marks CI green.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const attr=(s,k)=>s.match(new RegExp('\\b'+k+'="([^"]*)"'))?.[1]??null;
const markerText='real Android display has no QA home paint marker for ';
const sharedTests=[
 'cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem',
 'visualEvolutionP5_realMomentsAndroidScreens_andPrivacy',
 'visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe'
];

export function parseAndroidJunit(xml){
 const head=xml.match(/<testsuites\b([^>]*)>/)?.[1];
 if(!head)throw new Error('Invalid JUnit XML: no testsuites');
 const totals=Object.fromEntries(['tests','failures','errors','skipped'].map(k=>[k,Number(attr(head,k))]));
 if(Object.values(totals).some(x=>!Number.isInteger(x)||x<0))throw new Error('Invalid JUnit totals');
 const tests=[];
 const re=/<testcase\b([^>]*?)\s*(?:\/>|>([\s\S]*?)<\/testcase>)/g;
 for(const match of xml.matchAll(re)){
  const body=match[2]??'', failure=body.match(/<(?:failure|error)\b[^>]*>([\s\S]*?)<\/(?:failure|error)>/)?.[1]??'';
  const i=failure.indexOf(markerText);
  const marker=i<0?null:failure.slice(i+markerText.length).split(/[\r\n<]/)[0].trim();
  tests.push({name:attr(match[1],'name')||'',status:body.includes('<failure')?'FAIL':body.includes('<error')?'ERROR':body.includes('<skipped')?'SKIP':'PASS',paintMarker:marker});
 }
 if(tests.length!==totals.tests)throw new Error('Truncated JUnit XML: testcase count differs');
 return {totals,tests,markerFailures:tests.filter(x=>x.paintMarker).map(x=>({test:x.name,marker:x.paintMarker}))};
}

export function parseDeviceLogcat(logcat){
 const skips=[...logcat.matchAll(/Choreographer:\s*Skipped\s+(\d+)\s+frames!/g)].map(x=>Number(x[1]));
 const painted=[...logcat.matchAll(/V5_P1_ANDROID_VISIBLE_FRAME=([^\s:]+):true/g)].map(x=>x[1]);
 return {
  appDisplayed:/ActivityTaskManager:\s*Displayed\s+com\.nuestragalaxia\.companion\/\.MainActivity/.test(logcat),
  confirmedPaintCount:painted.length,confirmedLabels:[...new Set(painted)],
  frameSkipEvents:skips.length,maxSkippedFrames:skips.length?Math.max(...skips):0,
  totalSkippedFrames:skips.reduce((a,b)=>a+b,0),
  androidRuntimeFatal:/FATAL EXCEPTION:\s*main/.test(logcat)
 };
}

export function diagnose({junit,logcat,label='Android QA'}){
 const j=parseAndroidJunit(junit), device=parseDeviceLogcat(logcat);
 const markerFailures=j.markerFailures;
 const shared=markerFailures.length===3&&sharedTests.every(name=>markerFailures.some(x=>x.test===name));
 return {
  label,summary:j.totals,markerFailures,
  pattern:shared?'THREE_SHARED_MARKER_FAILURES':markerFailures.length?'MARKER_FAILURES_PRESENT':'NO_MARKER_FAILURES',
  device,disposition:j.totals.failures+j.totals.errors?'BLOCK_QA':'NO_TEST_FAILURES',
  cause:'UNDETERMINED: need actual framebuffer, display metrics, insets and window state. Skipped frames alone cannot prove cause.'
 };
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const args=process.argv.slice(2),opts={};
 for(let i=0;i<args.length;i+=2)opts[args[i]]=args[i+1];
 if(!opts['--junit']||!opts['--logcat']){
  console.error('Usage: node scripts/p5-android-marker-forensics.mjs --junit test-results.xml --logcat p5-logcat.txt [--label NAME] [--output report.json]');
  process.exitCode=64;
 }else try {
  const report=diagnose({junit:readFileSync(opts['--junit'],'utf8'),logcat:readFileSync(opts['--logcat'],'utf8'),label:opts['--label']});
  const out=JSON.stringify(report,null,2)+'\n';
  if(opts['--output'])writeFileSync(opts['--output'],out);
  process.stdout.write(out);
 }catch(error){console.error('Forensics failed:',error.message);process.exitCode=2;}
}
