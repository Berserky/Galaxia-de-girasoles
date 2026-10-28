import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflows = [
  {
    file: 'visual-evolution-p0.yml',
    expectedScript: 'script: bash scripts/visual-evolution-p1-avd.sh',
  },
  {
    file: 'qa-phase5-real-integration.yml',
    expectedScript: 'script: bash scripts/qa-phase5-emulator.sh',
  },
  {
    file: 'chat-4-phase11-torture.yml',
    expectedScript: "gradle -p android --no-daemon connectedDebugAndroidTest",
  },
];

for (const { file, expectedScript } of workflows) {
  test(`P8 API 35 emulator resources and strict QA gates: ${file}`, () => {
    const yaml = readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8');
    assert.match(yaml, /on:\s*\n\s*pull_request:/);
    assert.match(yaml, /uses:\s*reactivecircus\/android-emulator-runner@v2/);
    assert.match(yaml, /api-level:\s*35/);
    assert.match(yaml, /emulator-options:[^\n]*-memory 2048(?:\s|$)/);
    assert.match(yaml, /emulator-options:[^\n]*-gpu swiftshader_indirect/);
    assert.ok(yaml.includes(expectedScript), `${file}: real instrumentation script must remain`);
    assert.match(yaml, /if:\s*failure\(\)/);
    assert.doesNotMatch(yaml, /continue-on-error:\s*true/);
    assert.doesNotMatch(yaml, /\b(?:skip|ignore)-(?:android|instrumentation|qa):\s*true/);
  });
}
