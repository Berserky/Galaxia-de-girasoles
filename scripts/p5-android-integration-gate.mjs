#!/usr/bin/env node
/**
 * P5 Android integration gate: READ ONLY and fails closed.
 * Staging artifacts and Node green checks are NOT evidence of APK integration.
 * No Android files are created, overwritten or modified by this script.
 */
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {extractGardenCandidate,PROTOTYPE,BRIDGE,LIFECYCLE} from './p5-garden-candidate-export.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const mobile='android/app/src/main/assets/mobile/';
const hash=value=>createHash('sha256').update(value).digest('hex');
const assetPath={
  stylesheet:'galaxy-garden-world-v3.css',
  engine:'galaxy-garden-world-v3.js',
  bridge:'p5-garden-bond-bridge.js',
  lifecycle:'p5-moments-garden-lifecycle.js'
};
function references(html,kind){
  const regex=kind==='link'?/<link\b[^>]*>/g:/<script\b[^>]*><\/script>/g;
  return [...String(html||'').matchAll(regex)].map(m=>m[0]).map(tag=>{
    const hit=tag.match(kind==='link'?/\bhref=["']([^"']+)["']/:/\bsrc=["']([^"']+)["']/);
    return hit?.[1]||'';
  }).filter(Boolean);
}
function required(checks,name,ok,detail){
  checks.push({name,passed:!!ok,...(detail?{detail}:{})});
}
/**
 * get(relPath) -> UTF-8 string or null. Exposed for synthetic offline tests.
 * No string proof of integration can replace Android screenshots/instrumentation.
 */
export function evaluateP5AndroidReadiness({get,expected}){
  const checks=[];
  const index=get(mobile+'index.html');
  const app=get(mobile+'app.js');
  required(checks,'ANDROID_INDEX_PRESENT',typeof index==='string');
  required(checks,'ANDROID_APP_PRESENT',typeof app==='string');
  const links=references(index,'link'),scripts=references(index,'script');
  const css='./'+assetPath.stylesheet,engine='./'+assetPath.engine,bridge='./'+assetPath.bridge,lifecycle='./'+assetPath.lifecycle;
  const j=links.indexOf(css),oldCss=links.indexOf('./galaxy-moments-v5.css');
  const e=scripts.indexOf(engine),b=scripts.indexOf(bridge),l=scripts.indexOf(lifecycle),a=scripts.indexOf('./app.js');
  required(checks,'GARDEN_STYLESHEET_AFTER_MOMENTS',j>=0&&oldCss>=0&&oldCss<j);
  required(checks,'ENGINE_BEFORE_BRIDGE_BEFORE_APP',e>=0&&b>e&&a>b);
  required(checks,'LIFECYCLE_AFTER_BRIDGE_BEFORE_APP',l>b&&a>l);
  required(checks,'NO_DUPLICATE_ASSET_LINKS',
    links.filter(x=>x===css).length===1&&scripts.filter(x=>x===engine).length===1&&scripts.filter(x=>x===bridge).length===1&&scripts.filter(x=>x===lifecycle).length===1);
  const manifest=expected?.manifest;
  required(checks,'CANONICAL_CANDIDATE_SCHEMA',
    manifest?.schemaVersion===3&&manifest.mode==='CANDIDATE_ONLY_NOT_APK'&&
    manifest.officialStageMin===0&&manifest.officialStageMax===8&&manifest.worldProgressEnabled===false);
  for(const [key,filename] of Object.entries(assetPath)){
    const actual=get(mobile+filename);
    const correct=expected?.[key==='stylesheet'?'stylesheet':key==='engine'?'javascript':key];
    required(checks,'ASSET_'+key.toUpperCase()+'_EXACT_SHA256',
      typeof actual==='string'&&typeof correct==='string'&&hash(actual)===hash(correct),
      typeof actual==='string'?('sha256:'+hash(actual)):'not installed');
  }
  // This asserts bridge usage in the app's actual garden presenter, not merely a
  // linked script or documentation mentioning the bridge.
  const presenter=typeof app==='string'?
    app.match(/function bondGardenVisual\(garden\)\s*\{([\s\S]*?)\n\}/)?.[1]||'':'';
  required(checks,'BOND_PRESENTER_USES_BRIDGE',/GalaxyGardenBondBridge/.test(presenter)&&/\.create\(/.test(presenter));
  const lifecycleWired=/GalaxyMomentsGardenLifecycle\.create\s*\(/.test(String(app||''))&&
    /\.update\s*\(\s*\{[^}]*\bcloud\b/.test(String(app||''))&&
    /\.(?:leave|dispose)\s*\(/.test(String(app||''));
  required(checks,'AUTHENTIC_LIFECYCLE_WIRED',lifecycleWired);
  required(checks,'GARDEN_FALLBACK_PRESERVED',/bondGardenVisual/.test(String(app||''))&&
    /garden\.stage|bondGardenStage\(garden\)/.test(String(app||'')));
  const failures=checks.filter(x=>!x.passed).map(x=>x.name);
  return {
    status:failures.length?'BLOCKED_NOT_INTEGRATED':'STATIC_PREFLIGHT_READY_ANDROID_QA_REQUIRED',
    androidVerified:false,prototypeIsNotApk:true,officialStageMax:8,
    checks,blockers:failures
  };
}
export function inspectCurrentCheckout(repoRoot=root){
  const get=path=>{try{return readFileSync(resolve(repoRoot,path),'utf8')}catch{return null}};
  const html=get(PROTOTYPE),bridge=get(BRIDGE),lifecycle=get(LIFECYCLE);
  let expected=null;
  try{expected=extractGardenCandidate(html,bridge,lifecycle)}
  catch(err){return {status:'BLOCKED_CANDIDATE_DRIFT',androidVerified:false,blockers:[String(err.message)],checks:[]}}
  return evaluateP5AndroidReadiness({get,expected});
}
const direct=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const args=process.argv.slice(2);
  if(args.some(a=>a!=='--report-only')){console.error('Usage: node scripts/p5-android-integration-gate.mjs [--report-only]');process.exitCode=64}
  else{
    const report=inspectCurrentCheckout();
    console.log(JSON.stringify(report,null,2));
    if(args[0]!=='--report-only'&&report.status!=='STATIC_PREFLIGHT_READY_ANDROID_QA_REQUIRED')process.exitCode=2;
  }
}
