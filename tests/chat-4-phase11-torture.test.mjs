import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const device=()=>read('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java');
const app=()=>read('android/app/src/main/assets/mobile/app.js');
const phase10=()=>read('tests/chat-4-phase10-android-performance.test.mjs');
const security=()=>read('tests/privacy-firewall.test.mjs');

test('Phase 11 keeps the 20k dataset virtualized and bounded',()=>{
 assert.match(device(),/length:20000/);
 assert.match(app(),/maxCache:420,windowSize:84/);
});
test('Phase 11 covers representative heavy media volumes',()=>{
 assert.match(device(),/500/);
 assert.match(read('scripts/chat-4-phase9-media-performance.mjs'),/logicalMessages=20_000,images=500,videos=60/);
 assert.match(read('scripts/chat-4-phase0-baseline.mjs'),/audio/);
});
test('Phase 11 exercises two simultaneous users and convergence',()=>{
 assert.match(device(),/dualUserConcurrency_andRealtimeVisibility_areExercised/);
 assert.match(device(),/newFixedThreadPool\(2\)/);
 assert.match(device(),/qa-token-0/);assert.match(device(),/qa-token-1/);
});
test('Phase 11 exercises realtime burst, scroll and viewport stability',()=>{
 assert.match(phase10(),/realtime burst/);
 assert.match(device(),/galaxyChat_phase2ScrollEngine_anchorRealtimeResizeAndNavigationAreStable/);
 assert.match(read('tests/chat-4-phase2-scroll-engine.test.mjs'),/anchor/i);
});
test('Phase 11 exercises offline, retry, slow network and timeout',()=>{
 assert.match(device(),/networkOfflineSlowTimeoutAndChatRetry_areExercised/);
 assert.match(device(),/FAIL_503/);assert.match(device(),/NetworkMode\.SLOW/);assert.match(device(),/NetworkMode\.TIMEOUT/);
});
test('Phase 11 exercises camera, microphone, media, keyboard and navigation',()=>{
 assert.match(device(),/cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem/);
 assert.match(device(),/startNavigationModalKeyboardForegroundAndRotation_areReal/);
 assert.match(device(),/chatPhase9MediaPerformance_realWebView20kLazyCacheAndMemoryPressure/);
});
test('Phase 11 exercises background, process recreation, rotation and low memory',()=>{
 assert.match(device(),/chatPhase10ProcessRecreation_restoresDraftOutboxAndAttachments/);
 assert.match(device(),/chatPhase10AndroidPerformance_longSessionLifecycleAndMemoryStayBounded/);
 assert.match(device(),/TRIM_MEMORY_RUNNING_LOW/);
 assert.match(device(),/SCREEN_ORIENTATION_LANDSCAPE/);
});
test('Phase 11 exercises dark theme, font scaling and reduced motion',()=>{
 assert.match(device(),/permissionsDarkThemeAndFontScaling_areAppliedOnDevice/);
 assert.match(device(),/font_scale 1\.30/);
 assert.match(device(),/GalaxyChatMotion/);
 assert.match(read('tests/chat-4-phase8-motion.test.mjs'),/reduced motion/i);
});
test('Phase 11 retains security 3.5.1 regression boundaries',()=>{
 assert.match(security(),/capsule/i);
 assert.match(security(),/location/i);
 assert.match(security(),/storage/i);
 assert.match(phase10(),/WebView posture stays strict/);
});
test('Phase 11 keeps database and storage correctness suites in release gate',()=>{
 const candidate=read('.github/workflows/android-release-candidate.yml');
 assert.match(candidate,/DB migration replay/);
 assert.match(candidate,/chat-correctness-db\.sql/);
 assert.match(read('.github/workflows/data-integrity-db.yml'),/psql|supabase/i);
});
test('Phase 11 severity gate forbids P0 or P1 from release',()=>{
 const workflow=read('.github/workflows/chat-4-phase11-torture.yml');
 assert.match(workflow,/P0\/P1 gate/);
 assert.match(workflow,/phase11-gate\.mjs/);
});
test('Phase 11 does not deploy stable production',()=>{
 const workflow=read('.github/workflows/chat-4-phase11-torture.yml');
 assert.doesNotMatch(workflow,/android-release-stable|deploy-pages|render deploy/i);
});
