import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ci=read('.github/workflows/android-companion.yml');
const candidate=read('.github/workflows/android-release-candidate.yml');
const stable=read('.github/workflows/android-release-stable.yml');
const releaseDocs=read('docs/RELEASE_GOVERNANCE.md');
const cloud=read('app/cloud/adapter.js');

test('NG-QA-007 normal main pushes cannot mutate android-stable',()=>{
  assert.equal(/\n\s*push:\s*\n/.test(ci),false,'CI workflow must not run on push');
  assert.equal(ci.includes('contents: write'),false);
  assert.equal(ci.includes('gh release upload'),false);
  assert.equal(ci.includes('android-stable'),false);
  assert.equal(candidate.includes('gh release upload'),false);
  assert.equal(candidate.includes('contents: write'),false);
  assert.match(candidate,/gh release download android-stable/);
});

test('qa creates a candidate only after required automated gates',()=>{
  assert.match(candidate,/push:\s*\n\s*branches: \[qa\]/);
  for(const marker of [
    'npm test',
    'deno check',
    'privacy-firewall.test.mjs',
    'supabase start',
    'testDebugUnitTest',
    'lintDebug',
    'qa-phase5-emulator.sh',
    'sha256sum',
    'apksigner',
    'qa-phase5-staging.mjs',
    'android-candidate',
    'release-gates.json'
  ]) assert.ok(candidate.includes(marker),marker);
});

test('stable promotion is manual, provenance-bound and approval-gated',()=>{
  assert.equal(/\n\s*push:\s*\n/.test(stable),false);
  assert.match(stable,/workflow_dispatch:/);
  assert.match(stable,/candidate_run_id:/);
  assert.match(stable,/PROMOTE_ANDROID_STABLE/);
  assert.match(stable,/GOOGLE_ONLY_OR_LEAK_PROTECTION_ENABLED/);
  assert.match(stable,/environment: android-stable/);
  assert.match(stable,/\.event.*push/);
  assert.match(stable,/\.head_branch.*qa/);
  assert.match(stable,/github.ref == .refs\/heads\/prod./);
  assert.match(stable,/CANDIDATE_SHA.*GITHUB_SHA/);
  assert.match(stable,/\.conclusion.*success/);
  assert.match(stable,/NEW_CODE.*-gt.*OLD_CODE/);
  assert.match(stable,/sha256sum -c/);
  assert.match(stable,/apksigner/);
  assert.match(stable,/certificate SHA-256 digest/);
  assert.match(stable,/stagingSmoke/);
  assert.match(stable,/gh release upload android-stable/);
  assert.match(stable,/--clobber/);
});

test('NG-QA-019 documents password leak protection against the real auth model',()=>{
  assert.match(cloud,/signInWithOAuth\(\{provider:'google'/);
  assert.match(cloud,/signInWithPassword/);
  assert.match(releaseDocs,/0 usuarios con contraseña/i);
  assert.match(releaseDocs,/Leaked Password Protection/i);
  assert.match(releaseDocs,/GOOGLE_ONLY_OR_LEAK_PROTECTION_ENABLED/);
});

test('NG-QA-020 operational docs describe candidate and explicit stable promotion',()=>{
  assert.match(releaseDocs,/PR → CI/);
  assert.match(releaseDocs,/qa → candidate/);
  assert.match(releaseDocs,/candidate → staging\/smoke/);
  assert.match(releaseDocs,/approval explícito → stable/);
});

test('legacy web publishing is manual-only and PR targets are staged',()=>{
 const pages=read('.github/workflows/pages.yml');
 assert.match(pages,/workflow_dispatch:/);
 assert.doesNotMatch(pages,/\n\s*push:\s*\n/);
 assert.doesNotMatch(pages,/\n\s*pull_request:\s*\n/);
 assert.match(ci,/branches: \[desarrollo, qa, prod\]/);
});
