import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const more=readFileSync(resolve(dir,'galaxy-more-v5.js'),'utf8');
const app=readFileSync(resolve(dir,'app.js'),'utf8');
const sandbox={window:{}};runInNewContext(more,sandbox);
const {deviceRevokePreview,pairCodeValidity}=sandbox.window.GalaxyMoreV5;
const devices=[{id:'one',person:'0',name:'Mi teléfono'},{id:'two',person:'1',name:'Teléfono de pareja'}];
test('P7G uses authenticated target name and actual profile',()=>{
 const r=deviceRevokePreview(devices,'one','two',['Persona 0','Persona 1']);
 assert.equal(r.ok,true);assert.match(r.message,/Teléfono de pareja/);assert.match(r.message,/Persona 1/);
 assert.doesNotMatch(r.message,/one/);
});
test('P7G refuses revocation of current, missing or revoked device',()=>{
 assert.equal(deviceRevokePreview(devices,'one','one').ok,false);
 assert.equal(deviceRevokePreview(devices,'one','missing').ok,false);
 assert.equal(deviceRevokePreview([{id:'two',revoked_at:'2026-01-01'}],'one','two').ok,false);
 assert.equal(deviceRevokePreview(null,'one','two').ok,false);
});
test('P7G sanitizes control characters and bounds device labels',()=>{
 const r=deviceRevokePreview([{id:'two',person:1,name:'A\nB'.repeat(90)}],'one','two',['Uno','Dos']);
 assert.equal(r.ok,true);assert.doesNotMatch(r.message,/\nB/);
 assert.ok(r.message.length<500);
});
test('P7G pairing expiry is sourced from server response, not hardcoded',()=>{
 assert.match(pairCodeValidity(10),/10 minutos/);
 assert.doesNotMatch(pairCodeValidity('10'),/10 minutos/);
 assert.doesNotMatch(pairCodeValidity(0),/0 minutos/);
 assert.match(app,/pairCodeValidity\?\.\(r\.expires_minutes\)/);
 assert.match(app,/if\(!\/\^\[A-F0-9\]\{8\}\$\/\.test/);
});
test('P7G context confirmation gates existing revoke API',()=>{
 const s=app.slice(app.indexOf("if(a==='device-revoke'){"),app.indexOf("if(a==='app-settings')"));
 assert.match(s,/deviceRevokePreview\?\.\(cloud\?\.devices,cloud\?\.device\?\.id,id,names\(\)\)/);
 assert.ok(s.indexOf('if(!context?.ok)')<s.indexOf('confirm(context.message)'));
 assert.ok(s.indexOf('confirm(context.message)')<s.indexOf("api('device-revoke',{id})"));
});
test('P7G does not modify backend auth, RLS, tokens or native APIs',()=>{
 const s=more.slice(more.indexOf('function deviceRevokePreview('),more.indexOf('function organize(container)'));
 assert.doesNotMatch(s,/XMLHttpRequest|fetch\(|localStorage|sessionStorage|innerHTML|GalaxyNative|api\(/);
 assert.match(app,/if\(a==='unpair'\)\{if\(confirm\(/);
});
