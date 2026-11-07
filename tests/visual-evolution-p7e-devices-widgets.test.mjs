import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(dir,name),'utf8');
const source=read('galaxy-more-v5.js'),app=read('app.js');
const sandbox={window:{}};runInNewContext(source,sandbox);
const {classify,permissionReadings,enhanceDevices,enhanceWidgets}=sandbox.window.GalaxyMoreV5;
test('P7E permissions belong to profiles, without moving unrelated system settings',()=>{
 assert.equal(classify({heading:'Permisos de Android',actions:['app-settings']}),'profiles');
 assert.equal(classify({heading:'Otro',actions:['update-check']}),'system');
 assert.equal(classify({actions:['unpair']}),'sensitive');
});
test('P7E permission labels are parsed from Android-rendered data only',()=>{
 assert.equal(JSON.stringify(permissionReadings('Ubicación: concedida · Segundo plano: opcional · Notificaciones: pendientes')),JSON.stringify([['Ubicación','concedida'],['Segundo plano','opcional'],['Notificaciones','pendientes']]));
 assert.equal(permissionReadings('Ubicación: concedida').length,0);
 assert.equal(permissionReadings('Ubicación: concedida · Segundo plano: opcional · Notificaciones: ').length,0);
 assert.equal(permissionReadings('Ubicación: concedida · GPS: activo · Notificaciones: pendientes').length,0);
});
test('P7E preserves server-side revoke and repair confirmation',()=>{
 assert.match(app,/if\(a==='device-revoke'\)\{[\s\S]*?GalaxyMoreV5\?\.deviceRevokePreview\?\.\([\s\S]*?if\(!context\?\.ok\)[\s\S]*?if\(!confirm\(context\.message\)\)return;/);
 assert.match(app,/if\(a==='profile-repair'\)\{[\s\S]*?if\(!confirm\(/);
 assert.match(app,/if\(a==='unpair'\)\{if\(confirm\(/);
});
test('P7E keeps original widget and Android permission handlers',()=>{
 assert.match(app,/if\(a==='widget-add'\)\{await GalaxyNative\.call\('addWidget'\)/);
 assert.match(app,/if\(a==='widget-photo-clear'\)\{await api\('bond-widget'/);
 assert.match(app,/if\(a==='app-settings'\)\{await GalaxyNative\.call\('openAppSettings'\)/);
});
test('P7E enhancement is DOM-only and keeps original actions',()=>{
 const block=source.slice(source.indexOf('function permissionReadings'),source.indexOf('function organize(container)'));
 assert.doesNotMatch(block,/XMLHttpRequest|\bfetch\s*\(|GalaxyNative|localStorage|sessionStorage|innerHTML/);
 assert.match(block,/advanced\.append\(repair\)/);
 assert.match(block,/section\.append\(heading,note,\.\.\.buttons\)/);
 assert.match(source,/enhanceDevices\(hub\);\s*enhanceWidgets\(hub\)/);
});
test('P7E graceful no-op when widgets or profiles are absent',()=>{
 assert.equal(enhanceDevices({querySelector:()=>null}),false);
 assert.equal(enhanceWidgets({querySelector:()=>null}),false);
});
