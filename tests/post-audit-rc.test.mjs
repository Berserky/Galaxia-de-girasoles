import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('post-audit RC uses a new Android version without reusing stable code 34',()=>{
  const gradle=read('android/app/build.gradle.kts');
  const match=gradle.match(/versionCode = (\d+); versionName = "([^"]+)"/);
  assert.ok(match,'Android version metadata missing');
  assert.equal(Number(match[1]),35);
  assert.equal(match[2],'3.5.1');
  assert.ok(Number(match[1])>34);
});

test('candidate requires the full automated release gate set',()=>{
  const workflow=read('.github/workflows/android-release-candidate.yml');
  for(const marker of [
    'npm test','deno check','privacy-firewall.test.mjs','supabase start',
    'testDebugUnitTest','lintDebug','qa-phase5-emulator.sh','sha256sum',
    'apksigner','qa-phase5-staging.mjs','android-candidate','release-gates.json'
  ]) assert.ok(workflow.includes(marker),marker);
  assert.ok(workflow.includes('adb install -r candidate/NuestraGalaxia.apk'),'candidate must prove in-place upgrade over stable');
  assert.ok(workflow.includes('"upgradeInstall": "PASS"'),'candidate ledger must record upgrade install');
  assert.equal(workflow.includes('gh release upload android-stable'),false);
});

test('stable promotion remains explicit and provenance-bound',()=>{
  const workflow=read('.github/workflows/android-release-stable.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/candidate_run_id:/);
  assert.match(workflow,/GOOGLE_ONLY_OR_LEAK_PROTECTION_ENABLED/);
  assert.match(workflow,/PROMOTE_ANDROID_STABLE/);
  assert.match(workflow,/environment: android-stable/);
  assert.match(workflow,/\.head_branch.*main/);
  assert.match(workflow,/\.conclusion.*success/);
  assert.match(workflow,/NEW_CODE.*-gt.*OLD_CODE/);
  assert.match(workflow,/sha256sum -c/);
  assert.match(workflow,/certificate SHA-256 digest/);
  assert.match(workflow,/upgradeInstall/);
  assert.match(workflow,/gh release upload android-stable/);
});
