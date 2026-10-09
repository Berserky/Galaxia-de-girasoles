import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const tracking=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/TrackingService.java','utf8');
const device=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/DeviceStore.java','utf8');
const android=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyGpsConsentDeviceTest.java','utf8');

test('native GPS denies in-flight callback and worker upload after stop or unpair',()=>{
  assert.match(tracking,/if\(!store\.tracking\(\)\|\|!store\.pairedFast\(\)\)return;/);
  assert.match(tracking,/if\(!store\.tracking\(\)\|\|!store\.pairedFast\(\)\)break;/);
  assert.match(tracking,/if\(history&&store\.tracking\(\)\)pending\.add/);
});
test('GPS consent loss removes stored offline coordinates before new pairing',()=>{
  assert.match(device,/try\(PendingPointStore queued=new PendingPointStore\(context\)\)\{queued\.clear\(\);\}/);
  assert.match(tracking,/private void stopTracking\(\)\{[\s\S]{0,150}pending\.clear\(\);/);
  assert.match(android,/unpairErasesOfflineGpsHistoryBeforeAnotherIdentityPairs/);
  assert.match(android,/assertEquals\("New pairing inherited another user's GPS backlog",0,queued\.count\(\)\)/);
  assert.doesNotMatch(android,/assumeTrue|@Ignore/);
});
