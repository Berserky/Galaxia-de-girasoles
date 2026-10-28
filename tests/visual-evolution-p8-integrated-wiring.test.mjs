import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const root=resolve(import.meta.dirname,'..');
const read=name=>readFileSync(resolve(dir,name),'utf8');
const index=read('index.html'),app=read('app.js');
const qa=readFileSync(resolve(root,'scripts/qa-android-mobile.mjs'),'utf8');
const css=[...index.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map(x=>x[1]);
const scripts=[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(x=>x[1]);

test('P8 integrated: moments, memories and settings presenters load before app exactly once',()=>{
 for(const name of ['galaxy-voice-v5.js','galaxy-garden-world-v3.js','p5-garden-bond-bridge.js',
  'p5-moments-garden-lifecycle.js','galaxy-memories-v5.js','galaxy-more-v5.js']){
  const path='./'+name;
  assert.equal(scripts.filter(x=>x===path).length,1,'Missing or duplicated script: '+path);
  assert.ok(scripts.indexOf(path)<scripts.indexOf('./app.js'),'Presenters must load before app.js');
  assert.ok(existsSync(resolve(dir,name)),'Missing bundled asset: '+name);
 }
 assert.equal(scripts.at(-1),'./app.js');
 for(const name of ['galaxy-moments-v5.css','galaxy-garden-world-v3.css',
  'galaxy-memories-v5.css','galaxy-more-v5.css']){
  assert.equal(css.filter(x=>x==='./'+name).length,1,'Missing or duplicated CSS: '+name);
  assert.ok(existsSync(resolve(dir,name)));
 }
 assert.equal(new Set(scripts).size,scripts.length,'No script may load twice');
});

test('P8 integrated: P5 uses authenticated Bond and drops garden lifecycle on exit/unpair',()=>{
 assert.match(app,/let gardenLifecycle=null/);
 assert.match(app,/gardenLifecycle\.update\(\{host,cloud\}\)/);
 assert.match(app,/\[data-p5-garden-host\]/);
 assert.match(app,/if\(!native\.paired\)gardenLifecycle\?\.reset\(\)/);
 assert.match(app,/view!=='moments'\|\|!cloud/);
 assert.match(app,/if\(a==='unpair'\).*gardenLifecycle\?\.reset\(\)/);
 assert.match(app,/function bondGardenStage\(garden\)/);
 assert.match(read('p5-garden-bond-bridge.js'),/GalaxyGardenBondBridge/);
 assert.match(read('p5-moments-garden-lifecycle.js'),/GalaxyMomentsGardenLifecycle/);
});

test('P8 integrated: P6 navigation and P7 form focus protections survive P5 wiring',()=>{
 assert.match(app,/if\(view==='memories'\).*memorySection==='collections'/);
 assert.match(app,/GalaxyMemoriesV5/);
 assert.match(app,/GalaxyMoreV5/);
 assert.match(app,/const settingsFocus=window\.GalaxyMoreV5\?\.captureSettingsFocus\(app\)/);
 assert.match(app,/restoreSettingsForm\(\);\s*if\(focusOwner===settingsDraftOwner/);
 assert.match(read('galaxy-more-v5.js'),/restoreSettingsFocus/);
});

test('P8 integrated: Android QA script manifest matches packaged scripts after the merge',()=>{
 const m=qa.match(/assert\.deepEqual\(scriptSources,\[([^\]]+)\]/);
 assert.ok(m,'Source-order assertion must remain present');
 const expected=[...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
 assert.deepEqual(scripts,expected);
 assert.match(qa,/GalaxyGardenBondBridge/);
 assert.match(qa,/GalaxyMomentsGardenLifecycle/);
 assert.match(qa,/P5 presentation must never fetch or access private storage/);
 assert.match(index,/connect-src 'none'/);
});

test('P8 integrated: shared app source parses as a classic WebView script',()=>{
 assert.doesNotThrow(()=>new Function(app));
 assert.doesNotMatch(app,/^(?:<<<<<<<|=======|>>>>>>>)/m);
});

test('P8 security: unpair clears P5 garden and transient P7 settings/navigation',()=>{
 assert.match(app,/if\(a==='unpair'\)[\s\S]*?gardenLifecycle\?\.reset\(\)/);
 assert.match(app,/if\(!native\.paired\)\{settingsDraftCache=null;settingsDraftOwner='';window\.GalaxyMoreV5\?\.resetNavigation\(\)/);
 assert.match(app,/if\(!native\.paired\)gardenLifecycle\?\.reset\(\)/);
});

test('P8 security: backup and device revocation remain fail-closed and server-verified',()=>{
 assert.match(app,/const preview=window\.GalaxyMoreV5\?\.backupManifestPreview\?\.\(backup\)/);
 assert.match(app,/if\(!preview\?\.ok\)\{toast\(/);
 assert.match(app,/if\(!confirm\(preview\.message\)\)return;/);
 assert.match(app,/if\(result\?\.verified!==true\)/);
 assert.match(app,/const context=window\.GalaxyMoreV5\?\.deviceRevokePreview\?\.\(cloud\?\.devices,cloud\?\.device\?\.id,id,names\(\)\)/);
 assert.match(app,/if\(!context\?\.ok\)\{toast\(/);
 assert.match(app,/if\(!confirm\(context\.message\)\)return;/);
});
