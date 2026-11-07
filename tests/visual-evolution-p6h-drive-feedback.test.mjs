import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile'),read=x=>readFileSync(resolve(dir,x),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:2000});
const hub=sandbox.window.GalaxyMemoriesV5;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,ico:n=>'<i>'+esc(n)+'</i>'};
test('P6H Drive: no guessed historical sync timestamp',()=>{
 const html=hub.driveSyncFeedback(null,ui);
 assert.match(html,/No hay sincronizaciones registradas en esta sesión/);
 assert.doesNotMatch(html,/Última sincronización/);
});
test('P6H Drive: honest partial counts from native result',()=>{
 const html=hub.driveSyncFeedback({phase:'partial',imported:2,skipped:4,failed:1,completedAt:1760000000000},ui);
 assert.match(html,/Importación con incidencias/);
 assert.match(html,/2 nuevas · 4 ya existentes · 1 con error/);
 assert.match(html,/Última sincronización de esta sesión/);
});
test('P6H Drive: no successful receipt when working or failed',()=>{
 for(const phase of ['working','error']){
  const h=hub.driveSyncFeedback({phase},ui);
  assert.doesNotMatch(h,/Sincronización completada|Última sincronización de esta sesión/);
 }
 assert.match(hub.driveSyncFeedback({phase:'error'},ui),/No se pudo sincronizar/);
});
test('P6H Drive: invalid numeric fields cannot inject text',()=>{
 const html=hub.driveSyncFeedback({phase:'success',imported:'<script>x</script>',skipped:-5,failed:Infinity},ui);
 assert.match(html,/0 nuevas · 0 ya existentes · 0 con error/);
 assert.doesNotMatch(html,/<script>|Infinity/);
});
test('P6H Drive: native calls, in-flight guard and delete confirmation remain',()=>{
 const app=read('app.js');
 assert.match(app,/await GalaxyNative\.call\('syncDriveFolder'\)/);
 assert.match(app,/await GalaxyNative\.call\('disconnectDriveFolder'\)/);
 assert.match(app,/¿Desconectar esta carpeta de Google Drive\?/);
 assert.match(app,/if\(driveSyncInFlight\|\|!native\.paired\|\|!native\.driveFolderConnected\)return/);
 assert.match(app,/driveSyncSnapshot=null/);
});
test('P6H Drive: no new network/storage access in the presenter',()=>{
 const mod=read('galaxy-memories-v5.js');
 assert.doesNotMatch(mod,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
 assert.match(read('app.js'),/Origen: carpeta elegida y subcarpetas de Drive/);
});
