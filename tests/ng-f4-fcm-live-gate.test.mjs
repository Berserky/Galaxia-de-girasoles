import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workflow=readFileSync('.github/workflows/android-release-candidate.yml','utf8').replace(/\r\n/g,'\n');
const script=readFileSync('scripts/qa-f4-fcm-live.sh','utf8');
const android=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyFcmTransportQaTest.java','utf8');

test('real Firebase transport runs only in authenticated QA release-candidate workflow',()=>{
 assert.match(workflow,/QA_OIDC_AUDIENCE: nuestra-galaxia-qa/);
 assert.match(workflow,/id-token: write/);
 assert.match(workflow,/Real QA FCM transport: foreground, background and revoked device/);
 assert.match(workflow,/script: bash scripts\/qa-f4-fcm-live.sh/);
 assert.match(workflow,/Revoke ephemeral QA identities\n\s+if: always\(\)/);
 assert.match(workflow,/"fcmTransport": "PASS"/);
 assert.match(script,/vwtcncvmwjfywrzjmskw\.supabase\.co/);
 assert.doesNotMatch(script,/zqiknzivfahvvadmxrvt/);
 assert.match(script,/F4_FCM_LIVE_GATE=VERIFIED/);
 assert.match(script,/len\(cases\)!=1/);
 assert.match(script,/skipped','failure','error/);
 assert.match(script,/REDACTED_QA_TOKEN/);
});

test('transport Android test exercises actual FCM token and provider dispatch',()=>{
 assert.match(android,/FirebaseMessaging\.getInstance\(\)\.getToken\(\)/);
 assert.match(android,/ApiClient\.pushRegister/);
 assert.match(android,/sendSyntheticChat\("foreground"\)/);
 assert.match(android,/sendSyntheticChat\("background"\)/);
 assert.match(android,/ApiClient\.pushUnregister/);
 assert.match(android,/sendSyntheticChat\("after-revocation"\)/);
 assert.match(android,/assertFalse\("Revoked phone displayed a late private push"/);
 assert.doesNotMatch(android,/GalaxyFirebaseService\.handleIncoming\(/);
});


test('real provider gate taps the Android PendingIntent and validates exact chat message after activity relaunch',()=>{
 assert.match(android,/Instrumentation\.ActivityMonitor monitor=instrumentation\.addMonitor/);
 assert.match(android,/activity\.close\(\);\s*click\.send\(\)/);
 assert.match(android,/waitForMonitorWithTimeout\(monitor,25_000\)/);
 assert.match(android,/getStringExtra\("galaxy_entity_id"\)/);
 assert.match(android,/getStringExtra\("galaxy_action"\)/);
 assert.match(android,/awaitExactChatMessage\(reopened,background\.getString\("body"\),60_000\)/);
 assert.match(android,/document\.querySelector\('#chatMessages'\)/);
 assert.match(android,/GALAXY_F4_FCM_DEEPLINK=VERIFIED/);
 assert.doesNotMatch(android,/GalaxyFirebaseService\.handleIncoming\(/);
});

test('signed QA device candidate has a separate application ID and fail-closed QA backend',()=>{
 const gradle=readFileSync('android/app/build.gradle.kts','utf8');
 const qa=gradle.split('create("qaDevice") {')[1]?.split('\n   }')[0]||'';
 assert.ok(qa,'dedicated qaDevice build type is required');
 assert.match(qa,/initWith\(getByName\("release"\)\)/);
 assert.match(qa,/applicationIdSuffix = "\.qa"/);
 assert.match(qa,/vwtcncvmwjfywrzjmskw\.supabase\.co/);
 assert.doesNotMatch(qa,/zqiknzivfahvvadmxrvt/);
 assert.match(workflow,/assembleQaDevice/);
 assert.match(workflow,/QA_BUILD_CONFIG/);
 assert.match(workflow,/FAIL: production host in QA candidate BuildConfig/);
 assert.match(workflow,/name: android-qa-device-candidate/);
 assert.match(workflow,/backendEnvironment:"qa"/);
 const ci=readFileSync('.github/workflows/android-companion.yml','utf8');
 assert.match(ci,/assembleRelease assembleQaDevice/);
});

test('hermetic Android debug rejects production hosts and pins storage to QA',()=>{
 const gradle=readFileSync('android/app/build.gradle.kts','utf8');
 const debug=gradle.split('getByName("debug") {')[1]?.split('create("qaDevice") {')[0]||'';
 assert.ok(debug,'debug build type is required');
 assert.match(debug,/val qaOrigin = "https:\/\/vwtcncvmwjfywrzjmskw\.supabase\.co"/);
 assert.match(debug,/qaEdgeUrl == "http:\/\/127\.0\.0\.1:18765"/);
 assert.match(debug,/qaEdgeUrl == "\$qaOrigin\/functions\/v1\/android-companion"/);
 assert.match(debug,/buildConfigField\("String","SUPABASE_URL","\\\"\$qaOrigin\\\""\)/);
 assert.doesNotMatch(debug,/qaEdgeUrl\.substringBefore\("/);
 assert.doesNotMatch(debug,/zqiknzivfahvvadmxrvt/);
});
