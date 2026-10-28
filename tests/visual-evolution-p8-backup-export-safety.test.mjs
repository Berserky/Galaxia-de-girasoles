import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const mobile=new URL('../android/app/src/main/assets/mobile/app.js',import.meta.url);
const native=new URL('../android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java',import.meta.url);
const app=readFileSync(mobile,'utf8');
const java=readFileSync(native,'utf8');
const exportBlock=app.slice(app.indexOf("if(a==='backup-export'){"),app.indexOf("if(a==='gps-history-export')"));
const nativeCallback=java.slice(java.indexOf('if(requestCode==REQ_BACKUP_EXPORT){'),java.indexOf('if(requestCode==REQ_BACKUP_IMPORT){'));
const nativeMethod=java.slice(java.indexOf('void exportJson(String requestId'),java.indexOf('void clearPendingGps(String requestId'));

function handler(deps){
  const create=new Function('deps','let backupExportInFlight=false;const {api,GalaxyNative,cloud,toast}=deps;return async function handle(a){'+exportBlock+'}');
  return create(deps);
}

test('P8 export handler and native callback retain valid syntax and a bounded single-flight guard',()=>{
  assert.ok(exportBlock.startsWith("if(a==='backup-export'){"));
  assert.match(app,/let backupExportInFlight=false/);
  assert.match(exportBlock,/if\(backupExportInFlight\)return/);
  assert.match(exportBlock,/finally\s*\{backupExportInFlight=false;/);
  assert.doesNotThrow(()=>new Function(app));
});

test('P8 export does not report success without Android saved:true acknowledgement',async()=>{
  const messages=[];
  const handle=handler({cloud:{today:'2026-10-28'},api:async()=>({format:'backup'}),GalaxyNative:{call:async()=>({saved:false})},toast:x=>messages.push(x)});
  await handle('backup-export');
  assert.deepEqual(messages,['Android no confirmó que la copia se haya guardado.']);
});

test('P8 export serializes repeated taps while the native picker is open',async()=>{
  let release,apiCalls=0,nativeCalls=0;
  const pending=new Promise(resolve=>{release=resolve;});
  const messages=[];
  const handle=handler({cloud:{today:'2026-10-28'},api:async()=>{apiCalls++;return {format:'backup'};},GalaxyNative:{call:async()=>{nativeCalls++;return pending;}},toast:x=>messages.push(x)});
  const first=handle('backup-export');
  await Promise.resolve(); // Let the API request settle and the picker open.
  await handle('backup-export');
  assert.equal(apiCalls,1);
  assert.equal(nativeCalls,1);
  release({saved:true});
  await first;
  assert.deepEqual(messages,['Copia guardada en el teléfono.']);
  const second=handle('backup-export');
  await second;
  assert.equal(apiCalls,2,'new export is allowed after the first finishes');
});

test('P8 canceled or rejected native export releases the guard and never announces saved data',async()=>{
  let calls=0;
  const messages=[];
  const handle=handler({cloud:{today:'copia'},api:async()=>({format:'backup'}),GalaxyNative:{call:async()=>{calls++;if(calls===1)throw Error('Exportación cancelada.');return {saved:true};}},toast:x=>messages.push(x)});
  await assert.rejects(handle('backup-export'),/Exportación cancelada/);
  assert.equal(messages.length,0);
  await handle('backup-export');
  assert.equal(calls,2);
  assert.deepEqual(messages,['Copia guardada en el teléfono.']);
});

test('P8 Android export binds pending private JSON to the original authenticated session',()=>{
  assert.match(java,/private String pendingBackupExportToken;/);
  assert.match(nativeMethod,/String sessionToken=store.token\(\)/);
  assert.match(nativeMethod,/if\(sessionToken==null\)/);
  assert.match(nativeMethod,/pendingBackupExportToken=sessionToken/);
  assert.match(nativeMethod,/pendingBackupExportToken=null/);
  assert.match(nativeCallback,/sessionToken=pendingBackupExportToken/);
  assert.match(nativeCallback,/pendingBackupExportToken=null/);
  assert.match(nativeCallback,/sessionToken==null\|\|!sessionToken.equals\(store.token\(\)\)/);
  assert.ok(nativeCallback.indexOf('sessionToken==null||!sessionToken.equals(store.token())')<nativeCallback.indexOf('openOutputStream(uri,"w")'));
});

test('P8 native saved:true only resolves after flush and successful close, not inside try-with-resources',()=>{
  const close=nativeCallback.indexOf('}catch(Exception e){');
  const resolve=nativeCallback.indexOf('resolve(request,new JSONObject().put("saved",true))');
  assert.ok(nativeCallback.indexOf('out.write(bytes)')<nativeCallback.indexOf('out.flush()'));
  assert.ok(nativeCallback.indexOf('out.flush()')<close);
  assert.ok(close>=0&&resolve>close,'acknowledgement must follow the close/error branch');
  assert.match(nativeCallback,/if\(!sessionToken.equals\(store.token\(\)\)\)/);
});
