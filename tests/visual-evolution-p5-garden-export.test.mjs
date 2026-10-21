import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {createHash} from 'node:crypto';
import {extractGardenCandidate,exportGardenCandidate,PROTOTYPE} from '../scripts/p5-garden-candidate-export.mjs';
const repo=resolve(import.meta.dirname,'..');
const source=readFileSync(resolve(repo,PROTOTYPE),'utf8');
const candidate=extractGardenCandidate(source);
const engine=(globals={})=>{const window=globals;runInNewContext(candidate.javascript,{window},{timeout:2000});return window.GalaxyGardenV5;};
const e=engine();

test('P5 staging: canonical V3.3 engine and CSS are exported from ONE source',()=>{
 assert.ok(candidate.javascript.length>13000&&candidate.stylesheet.length>30000);
 assert.equal(candidate.manifest.schemaVersion,1);
 assert.equal(candidate.manifest.mode,'CANDIDATE_ONLY_NOT_APK');
 assert.equal(candidate.manifest.worldProgressEnabled,false);
 for(const [key,asset] of [['engine',candidate.javascript],['stylesheet',candidate.stylesheet]]){
  assert.equal(candidate.manifest.sha256[key],createHash('sha256').update(asset).digest('hex'));
 }
 assert.equal(extractGardenCandidate(source).javascript,candidate.javascript);
 assert.equal(extractGardenCandidate(source).stylesheet,candidate.stylesheet);
});

test('P5 staging: official 0–8 milestones never gain preview blooms',()=>{
 for(const stage of [0,1,3,8,9,22,365]){
  const html=e.render({stage},{entrance:'none',previewBloomTotal:123});
  const expected=Math.max(0,Math.min(8,stage));
  assert.match(html,new RegExp('data-official-stage="'+expected+'"'));
  assert.match(html,new RegExp('data-stage="'+expected+'"'));
  assert.match(html,/data-demo="false"/);
  assert.equal((html.match(/data-flower="/g)||[]).length,expected);
 }
});

test('P5 staging: future expanded worlds remain explicitly isolated demo',()=>{
 const normal=e.render({stage:8},{previewBloomTotal:123});
 const demo=e.render({stage:8},{demo:true,previewBloomTotal:123});
 assert.match(normal,/data-chapter="garden"/);
 assert.match(demo,/data-chapter="constellation"/);
 assert.match(demo,/data-demo="true"/);
 assert.equal((normal.match(/data-flower="/g)||[]).length,8);
});

test('P5 staging: budgeted CSS, layered decoration and accessibility remain intact',()=>{
 for(const selector of ['.ng-grass>i:not(','.ng-xmas-lights i:not(','.ng-wildflower:not('])assert.ok(candidate.stylesheet.includes(selector));
 for(const token of ['prefers-reduced-motion','[data-paused="true"]','[data-entrance="none"]','pointer-events:none','ng-plant[data-flower="8"]'])assert.ok(candidate.stylesheet.includes(token));
 const html=e.render({stage:8},{theme:'christmas',daypart:'night',season:'winter',motion:'reduce'});
 assert.ok(html.indexOf('class="ng-decorations"')<html.indexOf('class="ng-plant-field"'));
 assert.match(html,/role="group" aria-label="Jardín compartido/);
 assert.match(html,/data-motion="reduce"/);
});

test('P5 staging: extraction rejects altered, unsafe or incomplete source',()=>{
 for(const tampered of [source.replace('LABORATORIO VISUAL','LABORATORIO'),source.replace('options.onAmbient?.(state)',''),source.replace('V3.3 PERF',''),source.replace('</script>',''),source.replace('function attach(','function notAttach(')]){
  assert.throws(()=>extractGardenCandidate(tampered),/P5_STAGING_BLOCKED/);
 }
});

test('P5 staging: candidate files may be exported OUTSIDE repository, never into Android or source tree',()=>{
 const temp=mkdtempSync(resolve(tmpdir(),'ng-p5-export-'));
 try{
  const data=exportGardenCandidate({repoRoot:repo,outDir:temp});
  assert.equal(data.sha256.engine,candidate.manifest.sha256.engine);
  assert.equal(readFileSync(resolve(temp,'galaxy-garden-world-v3.js'),'utf8'),candidate.javascript);
  assert.equal(readFileSync(resolve(temp,'galaxy-garden-world-v3.css'),'utf8'),candidate.stylesheet);
  assert.ok(existsSync(resolve(temp,'garden-candidate-manifest.json')));
  assert.throws(()=>exportGardenCandidate({repoRoot:repo,outDir:resolve(repo,'android/app/src/main/assets/mobile')}),/P5_STAGING_BLOCKED/);
  assert.throws(()=>exportGardenCandidate({repoRoot:repo,outDir:resolve(repo,'staging-output')}),/P5_STAGING_BLOCKED/);
 }finally{rmSync(temp,{recursive:true,force:true});}
});

test('P5 staging: no fetch, storage, geolocation or demo controls in exported engine',()=>{
 assert.doesNotMatch(candidate.javascript,/\bfetch\s*\(|XMLHttpRequest|localStorage|navigator\.geolocation/);
 assert.doesNotMatch(candidate.javascript,/function draw\(\)|function updateAppearance\(\)/);
 assert.doesNotMatch(candidate.stylesheet,/@import|url\(\s*['"]?https?:/i);
 assert.match(candidate.javascript,/options.onAmbient\?\.\(state\)/);
 assert.match(candidate.javascript,/if\(doc\?\.addEventListener\)/);
});
