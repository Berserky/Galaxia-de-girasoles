import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const main=readFileSync(new URL('../android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java',import.meta.url),'utf8');
const section=(from,to)=> {
  const start=main.indexOf(from);
  const end=main.indexOf(to,start+from.length);
  assert.ok(start>=0&&end>start,'Expected Android section '+from);
  return main.slice(start,end);
};

test('backup import picker captures current session and clears token on launch failure',()=>{
  const launch=section('void importJson(String requestId)','void startVoiceRecording(');
  assert.match(launch,/String sessionToken=store\.token\(\)/);
  assert.match(launch,/pendingBackupImportRequest=requestId;pendingBackupImportToken=sessionToken/);
  assert.match(launch,/catch\(Exception e\)\{pendingBackupImportRequest=null;pendingBackupImportToken=null;/);
});

test('backup import never delivers private JSON after an unpair or re-pair',()=>{
  const handler=section('if(requestCode==REQ_BACKUP_IMPORT){','void exportJson(');
  assert.match(handler,/sessionToken=pendingBackupImportToken/);
  assert.match(handler,/pendingBackupImportRequest=null;pendingBackupImportToken=null/);
  const read=handler.indexOf('openInputStream(uri)');
  const parse=handler.indexOf('new JSONObject(json);');
  const check=handler.lastIndexOf('if(!sessionToken.equals(store.token()))');
  const deliver=handler.indexOf('resolve(request,new JSONObject().put("json",json))');
  assert.ok(handler.indexOf('if(sessionToken==null||!sessionToken.equals(store.token()))')>=0);
  assert.ok(read>=0&&parse>read&&check>parse&&deliver>check,'Session check must precede exposing imported JSON');
});

test('Drive folder picker binds URI grant to the session that requested it',()=>{
  const launch=section('void pickDriveFolder(String requestId)','void disconnectDriveFolder(');
  const handler=section('if(requestCode==REQ_DRIVE_FOLDER){','if(requestCode==REQ_MEDIA){');
  assert.match(launch,/pendingDriveFolderRequest=requestId;pendingDriveFolderToken=sessionToken/);
  assert.match(launch,/pendingDriveFolderRequest=null;pendingDriveFolderToken=null;reject/);
  assert.match(handler,/pendingDriveFolderRequest=null;pendingDriveFolderToken=null/);
  const grant=handler.indexOf('takePersistableUriPermission(uri');
  const check=handler.indexOf('if(!sessionToken.equals(store.token()))');
  const save=handler.indexOf('cloudMedia.saveDrive(uri,name)');
  assert.ok(handler.includes('if(sessionToken==null||!sessionToken.equals(store.token()))'));
  assert.ok(grant>=0&&check>grant&&save>check);
  assert.ok(handler.slice(check,save).includes('releasePersistableUriPermission(uri'));
});

test('unpair and new pairing revoke previously connected Drive folder access',()=>{
  const unpair=section('void unpair(String requestId)','void copyText(');
  const pair=section('void pair(String requestId,String code)','void unpair(');
  for(const block of [unpair,pair]){
    assert.match(block,/cloudMedia\.driveTree\(\)/);
    assert.match(block,/releasePersistableUriPermission\(oldDrive,Intent\.FLAG_GRANT_READ_URI_PERMISSION\)/);
    assert.match(block,/cloudMedia\.clearDrive\(\)/);
  }
  assert.ok(unpair.indexOf('cloudMedia.clearDrive()')<unpair.indexOf('store.clear()'));
  assert.match(pair,/if\(oldToken==null\|\|!oldToken\.equals\(result\.token\)\)/);
  assert.match(pair,/synchronized\(cloudMedia\)/);
  assert.match(unpair,/synchronized\(cloudMedia\)/);
  assert.match(section('if(requestCode==REQ_DRIVE_FOLDER){','if(requestCode==REQ_MEDIA){'),/synchronized\(cloudMedia\)/);
});

test('export and import callbacks synchronize final identity checks with unpair',()=>{
  const exportHandler=section('if(requestCode==REQ_BACKUP_EXPORT){','if(requestCode==REQ_BACKUP_IMPORT){');
  const importHandler=section('if(requestCode==REQ_BACKUP_IMPORT){','void exportJson(');
  const exportLock=exportHandler.lastIndexOf('synchronized(cloudMedia)');
  const exportCheck=exportHandler.lastIndexOf('if(!sessionToken.equals(store.token()))');
  const exportResolve=exportHandler.indexOf('resolve(request,new JSONObject().put("saved",true))');
  assert.ok(exportLock>=0&&exportCheck>exportLock&&exportResolve>exportCheck);
  const importLock=importHandler.lastIndexOf('synchronized(cloudMedia)');
  const importCheck=importHandler.lastIndexOf('if(!sessionToken.equals(store.token()))');
  const importResolve=importHandler.indexOf('resolve(request,new JSONObject().put("json",json))');
  assert.ok(importLock>=0&&importCheck>importLock&&importResolve>importCheck);
});
