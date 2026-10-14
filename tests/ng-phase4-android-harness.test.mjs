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
 assert.match(helper,/assertTrue\("OPEN_DOCUMENT did not reach resolved picker/);
 assert.doesNotMatch(helper,/!pkg\.equals\(foreground\)/);
 assert.match(helper,/device\.pressBack\(\)/);
 assert.match(helper,/finally\s*\{[\s\S]*GALAXY_FILE_PICKER_QA_CLEANUP/);
 assert.match(helper,/!isPhysicalDevice\(\)\s*&&\s*!isResumedPackage\(pkg\)/);
 assert.match(helper,/cancelPickerAndVerifyForeground\(device, pkg, documentsPackage\)/);
 assert.match(source,/private void cancelPickerAndVerifyForeground\(UiDevice device, String appPkg, String pickerPkg\)/);
 assert.match(source,/isResumedPackage\(appPkg\)/);
 assert.match(source,/document\.visibilityState/);
 assert.match(source,/boolean acknowledged=device\.pressBack\(\)/);
 assert.match(source,/if \(!acknowledged && pickerStillResumed && !isResumedPackage\(appPkg\)\)/);
 assert.match(source,/shell\("input keyevent KEYCODE_BACK"\)/);
 assert.match(source,/awaitPickerMainActivityVisible\(appPkg, 4_000\)/);
 assert.match(source,/scenario\.getState\(\)==Lifecycle\.State\.DESTROYED/);
 assert.match(source,/scenario\.getState\(\)==Lifecycle\.State\.RESUMED/);
 assert.match(source,/"visible"\.equals\(js\("document\.visibilityState"\)\)/);
 const pickerReturn=source.slice(source.indexOf('private void cancelPickerAndVerifyForeground('),
   source.indexOf('/** Match the ACTUAL foreground activity'));
 assert.match(pickerReturn,/stablePickerPolls=isPickerFocusedAndAccessible\(device,pickerPkg\)\?stablePickerPolls\+1:0/);
 assert.match(source,/private boolean isPickerFocusedAndAccessible\(UiDevice device,String pickerPkg\)/);
 assert.match(source,/private boolean isFocusedPackage\(String expectedPackage\)/);
 assert.match(source,/dumpsys window.*mCurrentFocus=/);
 assert.match(source,/pickerPkg\.equals\(device\.getCurrentPackageName\(\)\)/);
 const strict=source.slice(source.indexOf('private boolean isPickerFocusedAndAccessible('),
   source.indexOf('/** Match the ACTUAL foreground activity'));
 for(const required of ['isResumedPackage(pickerPkg)','isFocusedPackage(pickerPkg)',
   'pickerPkg.equals(device.getCurrentPackageName())']){
  assert.ok(strict.includes(required),'Rendered picker gate must check '+required);
 }
 assert.match(pickerReturn,/pickerWindowFocused=/);
 assert.match(pickerReturn,/refusing premature Back/);
 assert.match(pickerReturn,/stablePickerPolls>=3/);
 assert.match(pickerReturn,/if\(!isResumedPackage\(pickerPkg\)\)/);
 assert.ok(pickerReturn.indexOf('stablePickerPolls>=3') <
   pickerReturn.indexOf('boolean acknowledged=device.pressBack()'),
   'Never issue Back before resolved DocumentsUI is stably foreground');
 assert.doesNotMatch(pickerReturn,/Document picker closed but MainActivity WebView did not recover visibility/);
 assert.ok(source.indexOf('awaitPickerMainActivityVisible(appPkg, 4_000)') <
   source.indexOf('shell("input keyevent KEYCODE_BACK")'),
   'Wait for actual MainActivity return BEFORE fallback to avoid double Back');
 assert.doesNotMatch(source,/if \(!uiBackAcknowledged\)\s*\{\s*shell\("input keyevent KEYCODE_BACK"\)/);
 assert.doesNotMatch(source,/assertTrue\("Android did not handle Back while closing document picker"/);
 assert.doesNotMatch(helper,/com\.google\.android\.documentsui\s*\)/);
});
