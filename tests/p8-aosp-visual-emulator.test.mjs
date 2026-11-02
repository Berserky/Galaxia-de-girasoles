import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=n=>readFileSync(new URL('../.github/workflows/'+n,import.meta.url),'utf8');

test('P8 screenshot-intensive Android CI uses regular AOSP API35 without background GMS',()=>{
 for(const [file,count] of [
  ['chat-4-phase11-torture.yml',4],
  ['qa-phase5-real-integration.yml',1],
  ['visual-evolution-p0.yml',1]]){
  const ci=get(file);
  assert.equal((ci.match(/          target: default/g)||[]).length,count,'AOSP target count '+file);
  assert.equal((ci.match(/          target: google_apis/g)||[]).length,0,'GMS not required for P8 visual scenarios');
  assert.equal((ci.match(/          api-level: 35/g)||[]).length,count);
  assert.equal((ci.match(/-gpu swiftshader -feature -Vulkan -memory 4096 -no-snapshot/g)||[]).length,count);
  assert.equal((ci.match(/pre-emulator-launch-script: bash scripts\/p8-configure-native-avd.sh/g)||[]).length,count);
  assert.match(ci,/connectedDebugAndroidTest|scripts\/p8-phase11-run-shard\.sh|scripts\/qa-phase5-emulator\.sh|scripts\/visual-evolution-p1-avd\.sh/);
  assert.doesNotMatch(ci,/continue-on-error:\s*true/);
 }
});

test('P8 AOSP image is preinstalled with strict property and retry gate',()=>{
 const ci=get('visual-evolution-p0.yml');
 assert.match(ci,/system-images;android-35;default;x86_64/);
 assert.match(ci,/system-images\/android-35\/default\/x86_64/);
 assert.match(ci,/test -f "\$SYS_IMAGE\/source\.properties"/);
 assert.match(ci,/test "\$image_ok" -eq 1/);
 assert.doesNotMatch(ci,/system-images;android-35;google_apis;x86_64/);
});

test('P8 preserves the Google APIs device for already passing Android performance and onboarding',()=>{
 const phase10=get('chat-4-phase10-android-performance.yml');
 assert.match(phase10,/          target: google_apis/);
 assert.match(phase10,/-memory 2048 -no-snapshot/);
});
