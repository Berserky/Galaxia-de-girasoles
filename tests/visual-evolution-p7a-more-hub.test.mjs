import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(dir,name),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-more-v5.js'),sandbox);
const classify=sandbox.window.GalaxyMoreV5.classify;
test('P7A sensitive actions remain isolated',()=>{
 assert.equal(classify({actions:['unpair']}),'sensitive');
 assert.equal(classify({actions:['gps-history-export'],classes:['gps-history-card']}),'privacy');
 assert.equal(classify({actions:['backup-import']}),'backups');
});
test('P7A real settings are categorized, never reimplemented',()=>{
 for(const [action,group] of [['theme-set','appearance'],['moment-notifications','notifications'],['widget-add','widgets'],['device-revoke','profiles'],['update-check','system']])
  assert.equal(classify({actions:[action]}),group);
});
test('P7A original handlers and forms are preserved',()=>{
 const app=read('app.js');
 assert.match(app,/if\(a==='unpair'\)/);
 assert.match(app,/if\(a==='backup-import'\)/);
 assert.match(app,/id="settingsForm"/);
 assert.match(app,/GalaxyMoreV5\?\.organize\(app\)/);
});
test('P7A script is local, idempotent and non-networked',()=>{
 const index=read('index.html'),script=read('galaxy-more-v5.js');
 assert.ok(index.indexOf('./galaxy-more-v5.js')<index.indexOf('./app.js'));
 assert.match(script,/section\.querySelector\('\.v5-more-hub'\)/);
 assert.match(script,/\.body\.append\(el\)/);
 assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
