import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java',import.meta.url),'utf8');

test('Android UI harness allows first actual WebView touch before testing focused input',()=>{
 const helper=source.slice(source.indexOf('private void tapWebElement('),source.indexOf('private void runJs('));
 assert.match(helper,/UiDevice\.getInstance\(instrumentation\)\.click\(x, y\)/);
 assert.match(helper,/web\.dispatchTouchEvent\(down\)/);
 assert.doesNotMatch(helper,/web\.hasFocus\(\)\s*&&\s*web\.hasWindowFocus\(\)/);
 assert.match(helper,/document\.activeElement===document\.querySelector/);
 assert.match(helper,/isAcceptingText\(\)/);
 assert.match(helper,/WebView is not laid out for Android touch/);
});

test('Android picker waits for the resolved external app, not a transient system resolver',()=>{
 const helper=source.slice(source.indexOf('void cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem('),source.indexOf('private void sendChat('));
 assert.match(helper,/Intent\.ACTION_OPEN_DOCUMENT|docs?umentsComponent|resolve-activity/);
 assert.match(helper,/pickerForeground/);
 assert.match(helper,/documentsPackage\.equals\(device\.getCurrentPackageName\(\)\)/);
 assert.match(helper,/isResumedPackage\(documentsPackage\)/);
 assert.match(source,/private boolean isResumedPackage\(String expectedPackage\)/);
 assert.match(source,/dumpsys activity activities.*mResumedActivity\|topResumedActivity/);
 assert.match(helper,/assertEquals\("OPEN_DOCUMENT did not reach resolved picker"/);
 assert.doesNotMatch(helper,/!pkg\.equals\(foreground\)/);
 assert.match(helper,/device\.pressBack\(\)/);
 assert.match(helper,/finally\s*\{[\s\S]*GALAXY_FILE_PICKER_QA_CLEANUP/);
 assert.match(helper,/!isPhysicalDevice\(\)\s*&&\s*!pkg\.equals\(device\.getCurrentPackageName\(\)\)/);
 assert.doesNotMatch(helper,/com\.google\.android\.documentsui\s*\)/);
});
