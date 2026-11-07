import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const java=read('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java');
test('P8 system document picker requires foreground app, real WebView paint and real Android pixels',()=>{
 const start=java.indexOf('public void cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem()');
 const end=java.indexOf('android.graphics.Bitmap beforePicker=',start);
 assert.ok(start>=0 && end>start,'Picker native test must remain');
 const b=java.slice(start,end);
 assert.match(b,/awaitCondition\(\(\) -> isResumedPackage\(pkg\), UI_TIMEOUT_MS\)/);
 assert.match(b,/new WebView\.VisualStateCallback\(\)/);
 assert.match(b,/@Override public void onComplete\(long requestId\)/);
 assert.match(b,/pickerFrameReady\.await\(10, TimeUnit\.SECONDS\)/);
 assert.match(b,/awaitV5QaPainted\("before-real-system-document-picker"\)/);
 assert.doesNotMatch(b,/Assume\.assumeTrue\("(?:GUI|frame|paint)/);
 assert.match(java,/documentsPackage\.equals\(device\.getCurrentPackageName\(\)\)/);
});
test('P8 heavy Android visual runners have 4096MB guest RAM without changing passing phase10',()=>{
 for(const name of ['visual-evolution-p0.yml','qa-phase5-real-integration.yml','chat-4-phase11-torture.yml']){
  const w=read('.github/workflows/'+name);
  assert.match(w,/-memory 4096 -no-snapshot/);
  assert.doesNotMatch(w,/-memory 2048/);
  assert.match(w,/script: bash scripts\//);
 }
 const passing=read('.github/workflows/chat-4-phase10-android-performance.yml');
 assert.match(passing,/-memory 2048 -no-snapshot/);
});
