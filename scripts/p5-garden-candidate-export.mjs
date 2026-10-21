#!/usr/bin/env node
/**
 * P5 staging/export ONLY. Extracts the canonical engine and scoped garden CSS
 * from the reviewed, offline V3.3 prototype; never edits Android app files,
 * never contacts services, never creates git commits, and never enables
 * future chapter counts outside an explicit demo.
 *
 * Example, from repository root:
 *   node scripts/p5-garden-candidate-export.mjs --out /tmp/ng-p5-v33-staging
 */
import {readFileSync,mkdirSync,writeFileSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const PROTOTYPE='docs/visual-evolution-5/prototypes/jardin-vivo-v3.3.html';
export const BRIDGE='scripts/p5-garden-bond-bridge.js';
export const LIFECYCLE='scripts/p5-moments-garden-lifecycle.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fail=m=>{throw new Error('P5_STAGING_BLOCKED: '+m);};
const within=(base,target)=>{
 const rel=relative(base,target);
 return rel===''||!(rel==='..'||rel.startsWith('..'+sep));
};
// Resolve symlinks of the nearest existing ancestor BEFORE making any directory.
// A lexical /tmp/staging path must not redirect into the source checkout.
function realDestination(target){
 let ancestor=target;
 while(!existsSync(ancestor)){
  const parent=dirname(ancestor);
  if(parent===ancestor)fail('unresolvable export destination');
  ancestor=parent;
 }
 return resolve(realpathSync(ancestor),relative(ancestor,target));
}

export function extractGardenCandidate(html,bridgeSource=readFileSync(resolve(sourceRoot,BRIDGE),'utf8'),lifecycleSource=readFileSync(resolve(sourceRoot,LIFECYCLE),'utf8')){
 if(typeof html!=='string'||!/<title>[^<]*V3\.3/.test(html)||!html.includes('LABORATORIO VISUAL'))fail('not the approved synthetic V3.3 prototype');
 const styles=[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]);
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 if(styles.length!==3||scripts.length!==2)fail('style/script blocks drifted; audit before extracting');
 const css=styles[0].trim()+'\n\n'+styles[2].trim()+'\n';
 const js=scripts[0].trim()+'\n';
 if(!js.includes('global.GalaxyGardenV5=Object.freeze(')||!css.includes('.ng-garden'))fail('missing standalone garden engine');
 if(!css.includes('V3.3 PERF')||!js.includes('function attach(')||!js.includes('options.onAmbient?.(state)'))fail('latest motion/clock fixes not present');
 if(/@import\b|url\(\s*['"]?https?:/i.test(css)||/\bfetch\s*\(|XMLHttpRequest|localStorage|navigator\.geolocation/i.test(js))fail('external dependency or private-data access');
 if(js.includes('function draw(){')||js.includes('function updateAppearance(){'))fail('demo controls must not ship as Android core engine');
 if(typeof bridgeSource!=='string'||!bridgeSource.includes('global.GalaxyGardenBondBridge=Object.freeze({plan,create})'))fail('canonical Bond bridge missing');
 const bridge=bridgeSource.trim()+'\n';
 if(/\bfetch\s*\(|XMLHttpRequest|localStorage|navigator\.geolocation|previewBloomTotal|demo:true|supabase|\bapi\s*\(/i.test(bridge))fail('unsafe Bond bridge dependency or preview world');
 if(!bridge.includes('NO_AUTHENTIC_STAGE')||!bridge.includes('engine.render({stage:state.stage},options)')||!bridge.includes("initialEntrance='grow'"))fail('Bond bridge contract drifted');
 if(typeof lifecycleSource!=='string'||!lifecycleSource.includes('global.GalaxyMomentsGardenLifecycle=Object.freeze({authenticGarden,create})'))fail('canonical Moments lifecycle missing');
 const lifecycle=lifecycleSource.trim()+'\n';
 if(/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|navigator\.geolocation|previewBloomTotal|demo:true|supabase|\bapi\s*\(/i.test(lifecycle))fail('unsafe Moments lifecycle dependency');
 if(!lifecycle.includes('authenticGarden(cloud)')||!lifecycle.includes("initialEntrance:everEntered?'none':'grow'")||!lifecycle.includes('controller?.dispose()'))fail('Moments lifecycle contract drifted');
 const manifest={schemaVersion:3,source:PROTOTYPE,bridgeSource:BRIDGE,lifecycleSource:LIFECYCLE,mode:'CANDIDATE_ONLY_NOT_APK',
  officialStageMin:0,officialStageMax:8,worldProgressEnabled:false,
  files:['galaxy-garden-world-v3.css','galaxy-garden-world-v3.js','p5-garden-bond-bridge.js','p5-moments-garden-lifecycle.js'],
  sha256:{engine:sha(js),stylesheet:sha(css),bridge:sha(bridge),lifecycle:sha(lifecycle)},
  bytes:{engine:Buffer.byteLength(js),stylesheet:Buffer.byteLength(css),bridge:Buffer.byteLength(bridge),lifecycle:Buffer.byteLength(lifecycle)}};
 return {javascript:js,stylesheet:css,bridge,lifecycle,manifest};
}

export function exportGardenCandidate({repoRoot=sourceRoot,outDir}){
 if(!outDir)fail('explicit --out directory required');
 const root=resolve(repoRoot),target=resolve(outDir);
 const trueRoot=realpathSync(root),trueTarget=realDestination(target);
 if(within(root,target)||within(trueRoot,trueTarget))
  fail('output MUST be outside repository checkout, including symlink aliases');
 // Refuse Android-like directories in both the requested and resolved path.
 if([target,trueTarget].some(p=>p.split(sep).includes('android')))fail('Android directories forbidden');
 const files=extractGardenCandidate(readFileSync(resolve(root,PROTOTYPE),'utf8'),readFileSync(resolve(root,BRIDGE),'utf8'),readFileSync(resolve(root,LIFECYCLE),'utf8'));
 const outputs=[
  ['galaxy-garden-world-v3.js',files.javascript],
  ['galaxy-garden-world-v3.css',files.stylesheet],
  ['p5-garden-bond-bridge.js',files.bridge],
  ['p5-moments-garden-lifecycle.js',files.lifecycle],
  ['garden-candidate-manifest.json',JSON.stringify(files.manifest,null,2)+'\n']
 ];
 // A pre-existing output or file symlink must never be overwritten. This also
 // prevents changing source files through symlinked/hardlinked output files.
 for(const [name] of outputs){
  if(lstatSync(resolve(target,name),{throwIfNoEntry:false}))fail('refusing to overwrite an existing export file: '+name);
 }
 mkdirSync(target,{recursive:true});
 const created=realpathSync(target);
 if(within(trueRoot,created)||created.split(sep).includes('android'))fail('output resolved into a protected directory');
 for(const [name,contents] of outputs)writeFileSync(resolve(target,name),contents,{flag:'wx'});
 return files.manifest;
}

const isCli=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCli){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--out'){console.error('Usage: node scripts/p5-garden-candidate-export.mjs --out /tmp/p5-candidate');process.exitCode=64;}
 else try{console.log(JSON.stringify(exportGardenCandidate({outDir:args[1]}),null,2));}
 catch(e){console.error(e.message);process.exitCode=2;}
}
