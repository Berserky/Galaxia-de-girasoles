import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const firebase=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java','utf8');
const notificationTest=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyFcmPrivacyDeviceTest.java','utf8');

test('FCM rejects in-flight push before notification and broadcast when unpaired',()=>{
  const handler=firebase.slice(firebase.indexOf('static void handleIncoming('),firebase.indexOf('public static void performHaptic('));
  const deny=handler.indexOf('if(!new DeviceStore(context).pairedFast())return;');
  assert.ok(deny>=0,'missing fast paired guard');
  assert.ok(deny<handler.indexOf('context.sendBroadcast(sync)'));
  assert.ok(deny<handler.indexOf('GalaxyNotifications.show(context,'));
  assert.match(firebase,/handleIncoming\(getApplicationContext\(\),message\.getData\(\)\)/);
});

test('Android FCM QA tests distinguish handler from actual Firebase transport',()=>{
  assert.match(notificationTest,/inFlightPushAfterUnpair_cannotRevealPrivateNotification/);
  assert.match(notificationTest,/GalaxyFirebaseService\.handleIncoming\(context,payload\("qa-unpaired"\)\)/);
  assert.match(notificationTest,/GalaxyFirebaseService\.handleIncoming\(context,payload\("qa-paired"\)\)/);
  assert.match(notificationTest,/GalaxyFirebaseService\.handleIncoming\(context,payload\("qa-revoked"\)\)/);
  assert.match(notificationTest,/NotificationManager/);
  assert.match(notificationTest,/contentIntent/);
  assert.doesNotMatch(notificationTest,/assumeTrue|@Ignore/);
});


test('strict QA staging requires Firebase bootstrap from two OIDC devices without leaking config',()=>{
  const probe=readFileSync('scripts/qa-phase5-staging.mjs','utf8');
  assert.match(probe,/action:'push-client-config'/);
  assert.match(probe,/response\.available,true/);
  assert.match(probe,/projectId','senderId','applicationId','apiKey/);
  assert.match(probe,/assert\.notEqual\(String\(pushConfigs\[0\]\.deviceId\)/);
  assert.match(probe,/VERIFIED: QA Firebase client bootstrap \(not FCM delivery\)/);
  assert.doesNotMatch(probe,/console\.log\(.*pushConfigs\[0\]\.config/);
});
