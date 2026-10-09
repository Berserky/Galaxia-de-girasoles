import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const service=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/TrackingService.java','utf8');
const device=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyGpsConsentDeviceTest.java','utf8');

test('Android sticky service restart never silently re-enables GPS opt-in',()=>{
 assert.match(service,/static boolean mayStartForConsent\(Intent intent,boolean priorConsent\)/);
 assert.match(service,/if\(intent==null\)return priorConsent;/);
 assert.match(service,/return ACTION_START\.equals\(intent\.getAction\(\)\);/);
 assert.match(service,/if\(!mayStartForConsent\(intent,store\.tracking\(\)\)\)/);
 assert.match(service,/stopSelf\(startId\);/);
 assert.match(service,/store\.setTracking\(false\);/);
 assert.match(device,/stickyRestartCannotResumeAfterGpsConsentWasRevoked/);
 assert.match(device,/TrackingService\.mayStartForConsent\(null,device\.tracking\(\)\)/);
});

test('GPS queued uploads are discarded if local pairing or sharing was revoked',()=>{
 const callback=service.slice(service.indexOf('private void handle(Location loc)'),service.indexOf('private void flush('));
 const denial='if(!store.tracking()||!store.pairedFast())';
 assert.ok(callback.includes(denial));
 assert.ok(callback.indexOf(denial)<callback.indexOf('MotionClassifier.Result'));
 assert.ok(callback.indexOf(denial,callback.indexOf('io.execute'))>callback.indexOf('io.execute'));
 assert.ok(callback.includes('stopForeground(STOP_FOREGROUND_REMOVE)'));
});
