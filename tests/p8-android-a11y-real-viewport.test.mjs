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

test('P8 P4 map expansion remains at least 44px even with active scale',()=>{
 const map=read('android/app/src/main/assets/mobile/galaxy-journeys-v5.css');
 assert.match(map,/\.map-immersive-toggle\s*\{[^}]*min-width:52px;min-height:52px;/);
 assert.match(map,/box-sizing:border-box/);
 assert.match(java,/P4 map expansion button too small/);
 assert.match(java,/touch:b\.width>=44&&b\.height>=44/);
});
test('P8 slow visual AOSP callbacks do not weaken Chat 5-second limit or native-paint checks',()=>{
 const p5=java.slice(java.indexOf('public void visualEvolutionP5_realMomentsAndroidScreens_andPrivacy()'),java.indexOf('@Test public void galaxyChat_renders13Cards_pollChecklistAndSend()'));
 assert.match(java,/jsWithDeadline\("document\.documentElement\.innerHTML\.includes\('P5_SECRET_TITLE'\)/);
 assert.match(p5,/\.action-card'\)\.length===8",20\)/);
 assert.match(p5,/markerRect\.optDouble\("width"\)>=90d/);
 assert.match(p5,/awaitV5QaPainted\("p5-moments-premeasure-"\+css\)/);
 assert.match(java,/private String js\(String expression\) \{ return jsWithDeadline\(expression,5\); \}/);
});

test('P8 native map focus and physical P5 paint remain strict after CSS fractional rounding',()=>{
 const map=read('android/app/src/main/assets/mobile/galaxy-journeys-v5.css');
 assert.match(map,/\.gmap-marker button\{[^}]*min-width:52px;min-height:52px;/);
 assert.match(map,/\.gmap-marker.place button\{width:52px;height:52px;/);
 assert.match(java,/P4 focused place not keyboard accessible/);
 assert.match(java,/markerInside:b.width>=44&&b.height>=44/);
 assert.match(java,/P5 native paint QA marker geometry/);
 assert.match(java,/awaitV5QaPainted\("p5-moments-premeasure-"\+css\)/);
});

test('P8 rounded 361px viewport retains accessible header buttons',()=>{
 assert.match(shell,/@media\(min-width:360px\) and \(max-width:375px\)/);
 assert.match(shell,/#app \.header \.header-actions > button\.header-search\s*\{[^}]*flex:0 0 48px;width:48px;min-width:48px;/);
 assert.match(java,/Header search actions narrower than 44px/);
});
test('P8 saved-map-place focus is synchronous and survives deferred redraw',()=>{
 const app=read('android/app/src/main/assets/mobile/app.js');
 const part=app.slice(app.indexOf('function focusSavedPlaceOnMap(point){'),app.indexOf('function focusEtaOnMap(){'));
 assert.match(part,/const revealSavedPlace=\(\)=>\{/);
 assert.match(part,/revealSavedPlace\(\);[\s\S]*requestAnimationFrame\(revealSavedPlace\)/);
 assert.match(part,/if\(map!==targetMap\|\|view!=='map'\)return/);
 assert.match(part,/if\(!marker\.open\)button\.click\(\)/);
 assert.match(part,/button\.focus\(\{preventScroll:true\}\)/);
});
