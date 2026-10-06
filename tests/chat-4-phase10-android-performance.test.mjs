import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const main=()=>read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const camera=()=>read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyCameraActivity.java');
const review=()=>read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyMediaReviewActivity.java');
const manifest=()=>read('android/app/src/main/AndroidManifest.xml');
const app=()=>read('android/app/src/main/assets/mobile/app.js');
const bridge=()=>read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
const scroll=()=>read('android/app/src/main/assets/mobile/chat-scroll-engine.js');

test('1 open close chat repeated keeps one WebView and one secure bridge',()=>{
 assert.equal((main().match(/setupWeb\(\)/g)||[]).length,2);
 assert.equal((main().match(/addWebMessageListener/g)||[]).length,1);
 assert.equal((app().match(/const chatMessageEngine=/g)||[]).length,1);
});
test('2 WebView reuse recreation is controlled by configChanges and renderer recovery',()=>{
 assert.match(manifest(),/MainActivity[^>]+configChanges="orientation\|screenSize\|keyboardHidden"/);
 assert.match(main(),/onRenderProcessGone[\s\S]*recreate\(\)/);
});
test('3 background foreground uses per-WebView lifecycle without global timer freezes',()=>{
 assert.match(main(),/onResume\(\)[\s\S]*web\.onResume\(\)/);
 assert.match(main(),/onPause\(\)[\s\S]*web\.onPause\(\)/);
 assert.doesNotMatch(main(),/pauseTimers\(|resumeTimers\(/);
 assert.match(app(),/document\.visibilityState==='visible'/);
});
test('4 process kill keeps composer draft and pending outbox in local storage',()=>{
 assert.match(app(),/draftPrefix:'nuestra-galaxia\.chat-draft\.v4'/);
 assert.match(app(),/CHAT_OUTBOX_KEY='nuestra-galaxia\.chat-outbox\.v3'/);
});
test('5 restore draft includes pending attachment metadata without signed URLs',()=>{
 assert.match(app(),/CHAT_ATTACHMENTS_DRAFT_KEY='nuestra-galaxia\.chat-attachments-draft\.v4'/);
 assert.match(app(),/readChatAttachmentsDraft\(\)/);
 assert.match(app(),/url:'',thumbnailUrl:''/);
});
test('6 restore pending message keeps the Phase 3 delivery engine as source of truth',()=>{
 assert.match(app(),/load:\(\)=>readChatOutbox\(\)/);
 assert.match(app(),/chatDeliveryEngine\.flush/);
});
test('7 network switch path stays event based instead of native polling',()=>{
 assert.match(app(),/window\.addEventListener\('online'/);
 assert.match(app(),/window\.addEventListener\('offline'/);
 assert.doesNotMatch(main(),/ConnectivityManager[\s\S]*while\s*\(/);
});
test('8 offline reconnect retries pending work without a second sender',()=>{
 assert.match(app(),/flushChatOutbox\(\{retryFailed:true\}\)/);
 assert.equal((app().match(/const chatDeliveryEngine|chatDeliveryEngine=null/g)||[]).length,1);
});
test('9 keyboard remains owned by visual viewport and composer state',()=>{
 assert.match(app(),/visualViewport\?\.addEventListener\('resize',syncChatViewportHeight\)/);
 assert.match(app(),/setKeyboard\(true/);
});
test('10 orientation preserves MainActivity WebView instead of recreating it',()=>{
 assert.match(manifest(),/orientation\|screenSize\|keyboardHidden/);
 assert.doesNotMatch(main(),/setRequestedOrientation/);
});
test('11 camera roundtrip uses lifecycle CameraX and async review decoding',()=>{
 assert.match(camera(),/bindToLifecycle/);
 assert.match(camera(),/mediaIo\.execute[\s\S]*decodeScaled/);
});
test('12 audio roundtrip prepares playback asynchronously and releases on pause',()=>{
 assert.match(main(),/prepareAsync\(\)/);
 assert.doesNotMatch(main(),/voicePlayer\.prepare\(\)/);
 assert.match(main(),/onPause\(\)[\s\S]*releaseVoicePlayer\(\)/);
});
test('13 media viewer review inspection and bitmap decode stay off UI thread',()=>{
 assert.match(review(),/mediaIo\.execute[\s\S]*MediaInspector\.inspect[\s\S]*decodeScaled/);
});
test('14 file picker keeps contextual SAF access and no universal file access',()=>{
 assert.match(main(),/Intent\.ACTION_OPEN_DOCUMENT/);
 assert.match(main(),/setAllowUniversalAccessFromFileURLs\(false\)/);
});
test('15 20000 messages remain virtualized instead of full DOM history',()=>{
 assert.match(app(),/maxCache:420,windowSize:84/);
});
test('16 500 media items remain under bounded media cache and concurrency',()=>{
 assert.match(app(),/maxEntries:96,maxConcurrent:4/);
});
test('17 realtime burst has one native chat sync receiver and one consumer',()=>{
 assert.equal((main().match(/ContextCompat\.registerReceiver\(/g)||[]).length,1);
 assert.match(app(),/name==='chat-sync'[\s\S]*consumeChatSync/);
});
test('18 low memory releases media and native preview resources',()=>{
 assert.match(main(),/onTrimMemory[\s\S]*memory-pressure/);
 assert.match(main(),/TRIM_MEMORY_UI_HIDDEN[\s\S]*releaseVoicePlayer/);
 assert.match(app(),/name==='memory-pressure'[\s\S]*chatMediaEngine\.memoryPressure/);
});
test('19 cache trim and startup prune do not perform camera cache IO on UI thread',()=>{
 assert.match(main(),/io\.execute\(this::pruneCameraMediaCache\)/);
 assert.doesNotMatch(main(),/onCreate[\s\S]{0,700}pruneCameraMediaCache\(\);/);
});
test('20 long session avoids unbounded media preview ownership',()=>{
 assert.match(camera(),/releaseReviewMedia\(\)/);
 assert.match(review(),/releasePreview\(\)/);
 assert.match(main(),/web\.removeAllViews\(\);web\.destroy\(\)/);
});
test('21 repeated navigation has explicit background media detach and scroll memory',()=>{
 assert.match(app(),/previous==='chat'[\s\S]*chatMediaEngine\.detach\(\{release:true\}\)/);
 assert.match(scroll(),/remember\(/);
});
test('22 multiple chat entries do not create a second scroll container or message engine',()=>{
 assert.equal((app().match(/const chatMessageEngine=/g)||[]).length,1);
 assert.equal((app().match(/const chatScrollEngine=/g)||[]).length,1);
});
test('23 no duplicate realtime subscriptions are introduced',()=>{
 assert.doesNotMatch(app(),/supabase\.channel|new WebSocket/);
 assert.equal((main().match(/chatSyncReceiver=new BroadcastReceiver/g)||[]).length,1);
});
test('24 destroy cleans receiver executor voice and WebView resources',()=>{
 const source=main();
 assert.match(source,/onDestroy\(\)[\s\S]*cleanupVoice\(true\)/);
 assert.match(source,/unregisterReceiver/);
 assert.match(source,/io\.shutdownNow\(\)/);
 assert.match(source,/web\.destroy\(\)/);
});
test('25 failed native callback and renderer failure stay controlled',()=>{
 assert.match(bridge(),/catch\(Exception e\)[\s\S]*activity\.reject/);
 assert.match(main(),/onRenderProcessGone/);
});
test('security WebView posture stays strict while performance settings change',()=>{
 const source=main();
 assert.match(source,/setAllowFileAccess\(false\)/);
 assert.match(source,/setAllowContentAccess\(false\)/);
 assert.match(source,/MIXED_CONTENT_NEVER_ALLOW/);
 assert.match(source,/setSafeBrowsingEnabled\(true\)/);
 assert.match(source,/WebView\.setWebContentsDebuggingEnabled\(BuildConfig\.DEBUG\)/);
 assert.match(source,/appassets\.androidplatform\.net/);
});
test('debug StrictMode is opt in and never enables destructive production penalties',()=>{
 const source=main();
 assert.match(source,/BuildConfig\.DEBUG&&getIntent\(\)\.getBooleanExtra\("galaxy\.strictMode",false\)/);
 assert.match(source,/detectDiskReads\(\)\.detectDiskWrites\(\)\.detectNetwork\(\)\.penaltyLog\(\)/);
 assert.doesNotMatch(source,/penaltyDeath/);
});
