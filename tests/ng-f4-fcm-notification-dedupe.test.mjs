import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const notification=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyNotifications.java','utf8');
const device=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/DeviceStore.java','utf8');
const android=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyFcmPrivacyDeviceTest.java','utf8');

test('a retried chat push cannot append the same event to notification history twice',()=>{
  assert.match(notification,/private static synchronized boolean rememberChatEvent\(/);
  assert.ok(notification.includes('person+"|"+eventId'));
  assert.match(notification,/key\.equals\(previous\.optString\(i\)\)\)return false;/);
  assert.match(notification,/if\("chat_message"\.equals\(eventType\)&&!rememberChatEvent\(context,id\)\)return;/);
  assert.match(notification,/Math\.max\(0,previous\.length\(\)-127\)/);
  assert.match(android,/retriedChatEventDoesNotDuplicateAndAccountSwitchClearsPreviews/);
  assert.match(android,/FCM retry appended a duplicate chat notification/);
  assert.doesNotMatch(android,/@Ignore|assumeTrue/);
});

test('unpairing and switching the active profile clears private previews',()=>{
  assert.match(device,/GalaxyNotifications\.resetChat\(context\)/);
  assert.match(notification,/remove\(SEEN_CHAT_EVENT_KEYS\)/);
  assert.match(notification,/remove\(HISTORY_CIPHER\)/);
  assert.match(android,/Profile switch retained encrypted history/);
  assert.match(android,/Unpair retained encrypted message preview/);
});
