import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAndroidJunit,parseDeviceLogcat,diagnose} from '../scripts/p5-android-marker-forensics.mjs';

const names=[
 'cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem',
 'visualEvolutionP5_realMomentsAndroidScreens_andPrivacy',
 'visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe'
];
const labels=['before-real-system-document-picker','p5-moments-320','before-first-theme'];

function junit(failed=true){
 const cases=names.map((name,i)=>'<testcase name="'+name+'" classname="GalaxyDeviceClosureTest" time="1">'+(failed?'<failure>java.lang.AssertionError: V5 P1 screenshot rejected: real Android display has no QA home paint marker for '+labels[i]+'\nat Test.java:123</failure>':'')+'</testcase>').join('');
 return '<testsuites tests="3" failures="'+(failed?3:0)+'" errors="0" skipped="0"><testsuite>'+cases+'</testsuite></testsuites>';
}
const log='10-21 I ActivityTaskManager: Displayed com.nuestragalaxia.companion/.MainActivity for user 0: +500ms\n'
 +'10-21 I Choreographer: Skipped 121 frames! The application may be doing too much work\n'
 +'10-21 I System.out: V5_P1_ANDROID_VISIBLE_FRAME=p5-moments-320:true';

test('P5 forensic: recognizes the three shared failures and exact failed marker labels',()=>{
 const report=diagnose({junit:junit(),logcat:log,label:'QA fixture'});
 assert.equal(report.summary.failures,3);
 assert.equal(report.markerFailures.length,3);
 assert.deepEqual(report.markerFailures.map(x=>x.marker),labels);
 assert.equal(report.pattern,'THREE_SHARED_MARKER_FAILURES');
 assert.equal(report.disposition,'BLOCK_QA');
});

test('P5 forensic: a passing JUnit run does not become a false marker failure',()=>{
 const report=diagnose({junit:junit(false),logcat:log});
 assert.equal(report.markerFailures.length,0);
 assert.equal(report.pattern,'NO_MARKER_FAILURES');
 assert.equal(report.disposition,'NO_TEST_FAILURES');
});

test('P5 forensic: skipped frames are only observations, never established cause',()=>{
 const device=parseDeviceLogcat(log);
 assert.equal(device.appDisplayed,true);
 assert.equal(device.maxSkippedFrames,121);
 assert.equal(device.confirmedPaintCount,1);
 assert.match(diagnose({junit:junit(),logcat:log}).cause,/UNDETERMINED/);
});

test('P5 forensic: rejects incomplete or non-JUnit reports instead of reporting green',()=>{
 assert.throws(()=>parseAndroidJunit('<testsuites tests="3" failures="0" errors="0" skipped="0"><testcase name="only" />'),/Truncated/);
 assert.throws(()=>parseAndroidJunit('<html/>'),/no testsuites/);
});
