import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const java=readFileSync(new URL('../android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java',import.meta.url),'utf8');
const capture=readFileSync(new URL('../scripts/visual-evolution-p1-avd.sh',import.meta.url),'utf8');
const begin=java.indexOf('public void visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe()');
const p5=java.indexOf('public void visualEvolutionP5_realMomentsAndroidScreens_andPrivacy()');
const next=java.indexOf('@Test public void galaxyChat_renders13Cards_pollChecklistAndSend()',p5);
const p1=java.slice(begin,p5),moments=java.slice(p5,next);

test('P8 physical Android matrix changes real display density, never resize GPU framebuffer',()=>{
 assert.ok(begin>0&&p5>begin&&next>p5,'P1/P5 real Android methods must exist');
 for(const native of [p1,moments]){
  assert.match(native,/new int\[\]\{320,360,393,412\}/);
  assert.match(native,/shell\("wm density "\+/);
  assert.match(native,/shell\("wm density reset"\)/);
  assert.doesNotMatch(native,/shell\("wm size/);
  assert.match(native,/awaitV5QaPainted\(/,'Actual framebuffer must be proven painted');
  assert.match(native,/getUiAutomation\(\)\.takeScreenshot\(\)/,'Actual Android display screenshot required');
 }
 assert.match(p1,/160d\*displayWidthPx\/targetCss/);
 assert.match(moments,/160d\*realWidth\/css/);
 assert.match(moments,/setTextZoom\(135\)/);
 assert.match(moments,/new String\[\]\{"daylight","cosmic","halloween","christmas"/);
});
test('P8 screenshot acceptance still insists on full-size distinct physical frames and JUnit',()=>{
 assert.match(capture,/len\(set\(dimensions\.values\(\)\)\)==1/);
 assert.match(capture,/dimensions\[320\]\[0\]>=720/);
 assert.match(capture,/hashlib\.sha256\(p\.read_bytes\(\)\)/);
 assert.match(capture,/assert tests==2 and failures==0 and errors==0/);
 assert.match(capture,/p5_android_verified_by_real_instrumentation/);
});
