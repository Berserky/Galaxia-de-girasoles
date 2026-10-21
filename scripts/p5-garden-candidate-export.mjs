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
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const PROTOTYPE='docs/visual-evolution-5/prototypes/jardin-vivo-v3.3.html';
const sha=s=>createHash('sha256').update(s).digest('hex');
const sourceRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fail=m=>{throw new Error('P5_STAGING_BLOCKED: '+m);};

export function extractGardenCandidate(html){
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
 const manifest={schemaVersion:1,source:PROTOTYPE,mode:'CANDIDATE_ONLY_NOT_APK',officialStageMin:0,officialStageMax:8,worldProgressEnabled:false,sha256:{engine:sha(js),stylesheet:sha(css)},bytes:{engine:Buffer.byteLength(js),stylesheet:Buffer.byteLength(css)}};
 return {javascript:js,stylesheet:css,manifest};
}

export function exportGardenCandidate({repoRoot=sourceRoot,outDir}){
 if(!outDir)fail('explicit --out directory required');
 const root=resolve(repoRoot),target=resolve(outDir);
 const rel=relative(root,target);
 if(rel===''||!(rel==='..'||rel.startsWith('..'+sep)))fail('output MUST be outside repository checkout');
 // Extra defense in depth: refuse to mutate any app or source directory even on unusual paths.
 if(target.includes('/android/')||target.endsWith('/android')||target.includes('\\android\\'))fail('Android directories forbidden');
 const files=extractGardenCandidate(readFileSync(resolve(root,PROTOTYPE),'utf8'));
 mkdirSync(target,{recursive:true});
 for(const [name,contents] of [['galaxy-garden-world-v3.js',files.javascript],['galaxy-garden-world-v3.css',files.stylesheet],['garden-candidate-manifest.json',JSON.stringify(files.manifest,null,2)+'\n']])writeFileSync(resolve(target,name),contents);
 return files.manifest;
}

const isCli=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isCli){
 const args=process.argv.slice(2);
 if(args.length!==2||args[0]!=='--out'){console.error('Usage: node scripts/p5-garden-candidate-export.mjs --out /tmp/p5-candidate');process.exitCode=64;}
 else try{console.log(JSON.stringify(exportGardenCandidate({outDir:args[1]}),null,2));}
 catch(e){console.error(e.message);process.exitCode=2;}
}
