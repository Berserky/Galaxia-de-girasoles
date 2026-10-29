import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const more=readFileSync(resolve(dir,'galaxy-more-v5.js'),'utf8');
const app=readFileSync(resolve(dir,'app.js'),'utf8');
const sandbox={window:{}};runInNewContext(more,sandbox);
const preview=sandbox.window.GalaxyMoreV5.backupManifestPreview;
const sample=()=>({format:'nuestra-galaxia-backup',version:5,backupId:'00000000-0000-4000-8000-000000000001',manifest:{
 schemaVersion:'20261005011401',
 counts:{settings:1,items:3,places:2,bond:4,chatMessages:6,locationHistory:0,tripHistory:0},
 media:{count:2},payload:{bucket:'galaxy-backups',path:'0/00000000-0000-4000-8000-000000000001.json',sizeBytes:128,sha256:'a'.repeat(64)}
}});
test('P7F shows manifest counts without leaking private content',()=>{
 const x=sample();x.secret='SECRET_CAPSULE';x.manifest.secret='SECRET_LOCATION';
 const r=preview(x);assert.equal(r.ok,true);assert.match(r.message,/Registros: 16/);
 assert.doesNotMatch(r.message,/SECRET_|00000000-0000/);
});
test('P7F rejects wrong format, version and schema',()=>{
 for(const f of [x=>x.version=4,x=>x.format='fake',x=>x.manifest.schemaVersion='bad',x=>x.backupId='invalid']){
  const x=sample();f(x);assert.equal(preview(x).ok,false);
 }
});
test('P7F rejects missing, negative, fractional and excessive counts',()=>{
 for(const f of [x=>delete x.manifest.counts.items,x=>x.manifest.counts.items=-1,x=>x.manifest.counts.items=1.5,x=>x.manifest.counts.items=100001]){
  const x=sample();f(x);assert.equal(preview(x).ok,false);
 }
});
test('P7F rejects bad media count and integrity pointer',()=>{
 for(const f of [x=>x.manifest.media.count=-1,x=>x.manifest.payload.sha256='bad',x=>x.manifest.payload.bucket='wrong',x=>x.manifest.payload.sizeBytes=0,x=>x.manifest.payload.path='wrong.json']){
  const x=sample();f(x);assert.equal(preview(x).ok,false);
 }
});
test('P7F picker, preview, confirmation precede server mutation',()=>{
 const s=app.slice(app.indexOf("if(a==='backup-import'){"),app.indexOf("if(a==='context-near-toggle')"));
 const steps=["GalaxyNative.call('importJson')","JSON.parse(file.json)","backupManifestPreview?.(backup)","confirm(preview.message)","api('backup-import',{backup})"];
 steps.forEach((step,i)=>{assert.ok(s.includes(step));if(i)assert.ok(s.indexOf(steps[i-1])<s.indexOf(step));});
 assert.match(s,/result\?\.verified!==true/);assert.doesNotMatch(s,/añadirá lo que falte sin borrar/);
});
test('P7F preview does not access network, storage or private rows',()=>{
 const s=more.slice(more.indexOf('function backupManifestPreview('),more.indexOf('function organize(container)'));
 assert.doesNotMatch(s,/XMLHttpRequest|fetch\(|localStorage|sessionStorage|innerHTML|GalaxyNative|api\(/);
 assert.match(s,/El teléfono NO verifica/);
});
