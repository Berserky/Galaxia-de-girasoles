import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Crown Jewel 4.1.1 maintenance release is newer than 4.1.0 stable code 37',()=>{
  const gradle=read('android/app/build.gradle.kts');
  const match=gradle.match(/versionCode = (\d+); versionName = "([^"]+)"/);
  assert.ok(match,'Android version metadata missing');
  assert.equal(Number(match[1]),38);
  assert.equal(match[2],'4.1.1');
  assert.ok(Number(match[1])>37);
});

test('candidate requires the full automated release gate set',()=>{
  const workflow=read('.github/workflows/android-release-candidate.yml');
  for(const marker of [
    'npm test','deno check','privacy-firewall.test.mjs','supabase start',
    'testDebugUnitTest','lintDebug','qa-phase5-emulator.sh','sha256sum',
    'apksigner','qa-phase4-strict-staging.mjs','android-candidate','release-gates.json'
  ]) assert.ok(workflow.includes(marker),marker);
  assert.match(read('scripts/qa-phase4-strict-staging.mjs'),/qa-phase5-staging\.mjs/,'strict gate reuses existing staging E2E');
  assert.ok(workflow.includes('F4_QA_REMOTE_GATE=VERIFIED'),'QA smoke must require an actual verified E2E');
  const upgrade=read('scripts/qa-candidate-upgrade.sh');
  assert.ok(upgrade.includes('adb install -r candidate/NuestraGalaxia.apk'),'candidate must prove in-place upgrade over stable');
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
  assert.match(workflow,/\.head_branch.*qa/);
  assert.match(workflow,/\.conclusion.*success/);
  assert.match(workflow,/NEW_CODE.*-gt.*OLD_CODE/);
  assert.match(workflow,/sha256sum -c/);
  assert.match(workflow,/certificate SHA-256 digest/);
  assert.match(workflow,/upgradeInstall/);
  assert.match(workflow,/gh release upload android-stable/);
});


test('rollback assets are preserved and backend rollback source is explicit',()=>{
  const stable=read('.github/workflows/android-release-stable.yml');
  const docs=read('docs/RELEASE_GOVERNANCE.md');
  assert.match(stable,/Archive current stable before clobber/);
  assert.match(stable,/android-stable-prepromotion-/);
  assert.match(stable,/sha256sum prepromotion-stable\/NuestraGalaxia\.apk/);
  assert.match(docs,/forward rollback/i);
  assert.match(docs,/72b10c94a683d4cbec506d8e143b3db1bd997310/);
  assert.match(docs,/versionCode.*mayor/i);
});


test('NG-QA-006-004 preserves retry success against stale chat-state snapshots',()=>{
  const app=read('android/app/src/main/assets/mobile/app.js');
  assert.match(app,/NG-QA-006-004/);
  assert.match(app,/confirmedAfterLoad/);
  assert.match(app,/server_seq\|\|0\)>oldLastSeq/);
  assert.match(app,/chatStateSignature=chatSignature\(chatState\)/);
});


test('candidate staging uses GitHub OIDC and ephemeral QA identities',()=>{
  const workflow=read('.github/workflows/android-release-candidate.yml');
  assert.match(workflow,/id-token: write/);
  assert.match(workflow,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(workflow,/qa-github-bootstrap/);
  assert.match(workflow,/QA_OIDC_AUDIENCE: nuestra-galaxia-qa/);
  assert.match(workflow,/::add-mask::\$TOKEN0/);
  assert.match(workflow,/Revoke ephemeral QA identities/);
  assert.equal(workflow.includes('secrets.QA_STAGING_TOKEN_0'),false);
  assert.equal(workflow.includes('secrets.QA_STAGING_TOKEN_1'),false);
});


test('upgrade smoke is executed by Bash with pipefail preserved',()=>{
  const workflow=read('.github/workflows/android-release-candidate.yml');
  const script=read('scripts/qa-candidate-upgrade.sh');
  assert.match(workflow,/script: bash scripts\/qa-candidate-upgrade\.sh/);
  assert.match(script,/^#!\/usr\/bin\/env bash/m);
  assert.match(script,/set -euo pipefail/);
  assert.match(script,/adb install previous\/NuestraGalaxia\.apk \| tee/);
  assert.match(script,/adb install -r candidate\/NuestraGalaxia\.apk \| tee -a/);
});
