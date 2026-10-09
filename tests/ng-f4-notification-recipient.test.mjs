import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const notification=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyNotifications.java','utf8');
const activity=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java','utf8');
const suite=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java','utf8');

test('Android chat PendingIntent includes receiving identity and isolated requestCode',()=>{
  assert.match(notification,/putExtra\("galaxy_recipient_person",recipient\)/);
  assert.match(notification,/recipient\+"\|"\+eventType\+"\|"\+id/);
  assert.match(notification,/Intent\.FLAG_ACTIVITY_CLEAR_TOP\|Intent\.FLAG_ACTIVITY_SINGLE_TOP/);
});

test('cold and warm deep links refuse unpaired, missing recipient and new account',()=>{
  const auth=activity.slice(activity.indexOf('static boolean shouldAcceptNotificationDeepLink'),activity.indexOf('private void clearPendingDeepLink'));
  assert.match(auth,/current\.pairedFast\(\)/);
  assert.match(auth,/recipient\.equals\(current\.person\(\)\)/);
  assert.match(auth,/"0"\.equals\(recipient\)/);
  assert.match(auth,/"1"\.equals\(recipient\)/);
  assert.match(activity,/if\(!shouldAcceptNotificationDeepLink\(this,intent\)\)/);
  assert.match(activity,/if\(!current\.pairedFast\(\)\|\|!pendingDeepLinkRecipient\.equals\(current\.person\(\)\)\)/);
  assert.match(suite,/notificationDeepLink_deniesUnpairedAndChangedAccount/);
  assert.match(suite,/notificationDeepLink_opensChatAfterColdLaunch/);
  assert.match(suite,/view==='chat'/);
  assert.doesNotMatch(suite,/assumeTrue\([^\n]*notificationDeepLink/);
});
