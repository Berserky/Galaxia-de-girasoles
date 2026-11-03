import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const shell=read('android/app/src/main/assets/mobile/celestial-shell.css');
const moments=read('android/app/src/main/assets/mobile/galaxy-moments-v5.css');
const java=read('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java');
test('P8 real 320px header controls remain larger than 44px during active scaling',()=>{
 assert.match(shell,/@media\(max-width:360px\)[\s\S]*#app \.header \.header-actions > button\.header-search\s*\{[\s\S]*flex:0 0 48px;width:48px;min-width:48px;/);
 assert.match(shell,/height:48px;min-height:48px;/);
 assert.match(shell,/#app \.brand \{min-width:0\}/);
});
test('P8 Moments real voice, note and gesture controls retain accessibility gates',()=>{
 assert.match(moments,/\.living-voice-toggle\{width:48px;min-width:48px;height:48px;min-height:48px;/);
 assert.match(moments,/\.living-note-full>summary\{[^}\n]*min-height:48px;/);
 assert.match(moments,/\.living-gestures \.bond-gesture-grid \.gesture\{min-height:80px;/);
 const p5=java.slice(java.indexOf('public void visualEvolutionP5_realMomentsAndroidScreens_andPrivacy()'),java.indexOf('@Test public void galaxyChat_renders13Cards_pollChecklistAndSend()'));
 assert.match(p5,/document\.readyState==='complete'/);
 assert.match(p5,/galaxy-moments-v5\.css/);
 assert.match(p5,/awaitV5QaPainted\("p5-moments-premeasure-"\+css\)/);
 assert.match(p5,/touch:btns\.every\(b=>!!b&&b\.getBoundingClientRect\(\)\.height>=44\)/);
 assert.match(p5,/touchHeights:btns\.map\(/);
 assert.match(p5,/assertTrue\("P5 touch targets below 44px/);
});
test('P8 Phase1 opens authentic Chat FAB with real lifecycle and still asserts messages',()=>{
 const start=java.indexOf('public void galaxyChat_phase1MessageEngine_windowingAndLifecycleAreMeasured()');
 const end=java.indexOf('@Test',start+20);
 const phase=java.slice(start,end);
 assert.match(phase,/launchChat\(\)/);
 assert.match(phase,/awaitJs\("!!document\.querySelector\('\.chat-shell'\) && document\.querySelectorAll\('\.chat-message'\)\.length>0"\)/);
 assert.match(java,/private void launchChat\(\)/);
 assert.match(java,/document\.querySelector\('#chatFab'\)\?\.click\(\)/);
});
