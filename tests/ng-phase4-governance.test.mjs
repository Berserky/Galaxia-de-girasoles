import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const readme = read('android/README.md');
const candidate = read('.github/workflows/android-release-candidate.yml');
const stable = read('.github/workflows/android-release-stable.yml');
const policy = read('docs/BRANCH_POLICY.md');

test('NG-AUD-002 Android README describes QA candidate, not main', () => {
  assert.match(readme, /push a `qa` activa \*\*Android Release Candidate\*\*/i);
  assert.match(candidate, /push:\s*\n\s*branches: \[qa\]/);
  assert.doesNotMatch(readme, /`main` genera un \*\*release candidate\*\*/i);
  assert.match(readme, /`desarrollo` → `qa` → `prod`/);
});

test('NG-AUD-002 stable release remains manual and prod-only', () => {
  assert.match(stable, /workflow_dispatch:/);
  assert.match(stable, /github.ref == 'refs\/heads\/prod'/);
  assert.match(stable, /PROMOTE_ANDROID_STABLE/);
  assert.match(readme, /solo desde `prod`/i);
  assert.match(policy, /desarrollo.*qa.*prod/i);
});
