import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile'),read=x=>readFileSync(resolve(dir,x),'utf8');
const context={window:{}};runInNewContext(read('galaxy-more-v5.js'),context,{timeout:2000});
const {settingsDraft}=context.window.GalaxyMoreV5;
const original={names:['Adri','Sebas'],startDate:'2026-05-01',albumUrl:''};
test('P7I: unchanged settings never enable submission',()=>{
 const result=settingsDraft(original,original);
 assert.equal(result.valid,true);assert.equal(result.changed,false);
});
test('P7I: edited name is dirty; payload retains explicit two-person ordering',()=>{
 const result=settingsDraft(original,{...original,names:['Adri','Sebastián']});
 assert.equal(result.changed,true);assert.equal(result.valid,true);
 assert.equal(result.data.names[0],'Adri');assert.equal(result.data.names[1],'Sebastián');
});
test('P7I: blank or excessively long names fail before network submission',()=>{
 for(const value of ['', '   ', 'A'.repeat(81)]){
  const result=settingsDraft(original,{...original,names:[value,'Sebas']});
  assert.equal(result.valid,false);assert.match(result.reason,/nombres/);
 }
});
test('P7I: February 29 only valid for actual leap years',()=>{
 assert.equal(settingsDraft(original,{...original,startDate:'2024-02-29'}).valid,true);
 for(const date of ['2026-02-29','2026-13-01','2026-04-31'])assert.equal(settingsDraft(original,{...original,startDate:date}).valid,false);
});
test('P7I: unsafe and unencrypted album links rejected locally',()=>{
 for(const url of ['javascript:alert(1)','http://photos.google.com/x','https://','https://user@domain.com/a']){
  const result=settingsDraft(original,{...original,albumUrl:url});
  assert.equal(result.valid,false);
 }
 assert.equal(settingsDraft(original,{...original,albumUrl:'https://photos.app.goo.gl/AbC123'}).valid,true);
});
test('P7I: server version gate, one request and inline feedback remain',()=>{
 const app=read('app.js');
 assert.match(app,/if\(settingsSaveInFlight\)return/);
 assert.match(app,/version:cloud\.settings\.version,data:check\.data/);
 assert.match(app,/settingsFormFeedback\(form,'Guardando cambios…'\)/);
 assert.match(app,/settingsDraftCache=null/);
 assert.match(app,/if\(e\.target\.closest\?\.\('#settingsForm'\)\)settingsFormFeedback/);
 assert.doesNotMatch(read('galaxy-more-v5.js'),/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
