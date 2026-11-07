import test from 'node:test';
import assert from 'node:assert/strict';
import {compareP5AndroidRuns,MARKER_CASES} from '../scripts/p5-android-crossrun-forensics.mjs';

const sha='b721766f82e5f9b8078ffaa00cc48772f0b46b0b';
const names=MARKER_CASES.map(x=>x.test);
const junit=(bad=[],mapFocus=false)=>{
 const cases=names.map((name,i)=>{
  const text=bad.includes(name)?
    'java.lang.AssertionError: V5 P1 screenshot rejected: real Android display has no QA home paint marker for '+MARKER_CASES[i].label:
    mapFocus&&i===2?'java.lang.AssertionError: V5_P4_PLACE_FOCUS_GATE={popupOpen:false}; Caused by: GALAXY_QA_CHAT_TIMEOUT=sent=0':'';
  return '<testcase name="'+name+'">'+(text?'<failure>'+text+'</failure>':'')+'</testcase>';
 });
 const failures=bad.length+(mapFocus&&!bad.includes(names[2])?1:0);
 return '<testsuites tests="3" failures="'+failures+'" errors="0" skipped="0"><testsuite>'+cases.join('')+'</testsuite></testsuites>';
};
const log=label=>'ActivityTaskManager: Displayed com.nuestragalaxia.companion/.MainActivity\n'
 +'Choreographer: Skipped 70 frames!\nSystem.out: V5_P1_ANDROID_VISIBLE_FRAME='+label+':true';
const logcats=()=>Object.fromEntries(MARKER_CASES.map(x=>[x.test,log(x.label)]));
const one=(runId,junitData,logs={})=>({runId,sha,junit:junitData,logcats:logs});

test('Cross-run QA: all three markers rejected in Phase5 but confirmed in independent torture',()=>{
 const report=compareP5AndroidRuns({sha,runs:[
  one(39880086425,junit(names),Object.fromEntries(names.map(n=>[n,'MainActivity launched, no marker confirmed']))),
  one(39880086438,junit([],true),logcats())
 ]});
 assert.equal(report.disposition,'BLOCK_QA');
 assert.equal(report.androidVerified,false);
 assert.equal(report.releaseApproved,false);
 assert.equal(report.paintDivergences.length,3);
 assert.deepEqual(report.paintDivergences.map(x=>x.test),names);
 const third=report.reports[1].observations[2];
 assert.equal(third.testStatus,'FAIL');
 assert.equal(third.paintEvidence,'SCREENSHOT_MARKER_CONFIRMED');
 assert.equal(third.otherFailure,'MAP_FOCUS_GATE');
 assert.equal(third.nestedChatTimeout,true);
 assert.equal(report.reports[0].tests.failures,3);
 assert.equal(report.reports[1].tests.failures,1);
});
test('Cross-run QA: positive screenshot logcat never upgrades failed whole testcase to PASS',()=>{
 const report=compareP5AndroidRuns({sha,runs:[
  one(1,junit([],true),logcats()),one(2,junit(),logcats())
 ]});
 const failed=report.reports[0].observations[2];
 assert.equal(failed.testStatus,'FAIL');
 assert.equal(failed.paintEvidence,'SCREENSHOT_MARKER_CONFIRMED');
 assert.equal(report.disposition,'BLOCK_QA');
 assert.equal(report.paintDivergences.length,0);
});
test('Cross-run QA: no positive marker logs means no proof despite passing JUnit',()=>{
 const report=compareP5AndroidRuns({sha,runs:[
  one(1,junit(),{}),one(2,junit(),{})
 ]});
 assert.equal(report.reports[0].observations[0].paintEvidence,'NO_POSITIVE_SCREENSHOT_EVIDENCE');
 assert.equal(report.disposition,'EVIDENCE_ONLY_NOT_APK_CERTIFICATION');
 assert.equal(report.androidVerified,false);
});
test('Cross-run QA: same commit SHA is required for both independent executions',()=>{
 assert.throws(()=>compareP5AndroidRuns({sha,runs:[
  one(1,junit(),{}),{...one(2,junit(),{}),sha:'a'.repeat(40)}
 ]}),/CROSS_SHA_EVIDENCE_FORBIDDEN/);
 assert.throws(()=>compareP5AndroidRuns({sha:'123',runs:[]}),/EXPECTED_FULL_HEAD_SHA_REQUIRED/);
 assert.throws(()=>compareP5AndroidRuns({sha,runs:[one(1,junit(),{})]}),/TWO_INDEPENDENT_RUNS_REQUIRED/);
 assert.throws(()=>compareP5AndroidRuns({sha,runs:[
  one(1,junit(),{}),one(1,junit(),{})
 ]}),/DISTINCT_VALID_RUN_IDS_REQUIRED/);
});
test('Cross-run QA: missing monitored cases stay missing, not silently green',()=>{
 const incomplete='<testsuites tests="1" failures="0" errors="0" skipped="0"><testsuite><testcase name="unrelated"/></testsuite></testsuites>';
 const report=compareP5AndroidRuns({sha,runs:[
  one(1,incomplete,logcats()),one(2,junit(),logcats())
 ]});
 assert.equal(report.reports[0].observations[0].testStatus,'MISSING_OR_AMBIGUOUS');
 assert.equal(report.reports[0].disposition,'BLOCK_QA');
 assert.equal(report.disposition,'BLOCK_QA');
});
test('Cross-run QA: truncated JUnit is rejected, not recategorized as a PASS',()=>{
 const truncated='<testsuites tests="10" failures="0" errors="0" skipped="0"><testsuite><testcase name="only"/></testsuite></testsuites>';
 assert.throws(()=>compareP5AndroidRuns({sha,runs:[
  one(1,truncated,logcats()),one(2,junit(),logcats())
 ]}),/Truncated JUnit/);
});
