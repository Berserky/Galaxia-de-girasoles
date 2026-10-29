import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL('../'+x,import.meta.url),'utf8');
const script=read('scripts/p8-configure-native-avd.sh');
test('P8 native CI AVD boots at physically bounded 768x1280 with real Android screenshot capture intact',()=>{
 for(const [name,count] of [
  ['chat-4-phase11-torture.yml',4],
  ['qa-phase5-real-integration.yml',1],
  ['visual-evolution-p0.yml',1],
  ['chat-4-phase10-android-performance.yml',1]
 ]){
  const yaml=read('.github/workflows/'+name);
  assert.equal((yaml.match(/pre-emulator-launch-script: bash scripts\/p8-configure-native-avd\.sh/g)||[]).length,count,
   name+' must physically configure every real AVD, without altering coverage');
  assert.equal((yaml.match(/-gpu swiftshader -feature -Vulkan -memory 2048 -no-snapshot/g)||[]).length,count);
  assert.match(yaml,/connectedDebugAndroidTest|scripts\/p8-phase11-run-shard\.sh|scripts\/qa-phase5-emulator\.sh|scripts\/visual-evolution-p1-avd\.sh/);
  assert.doesNotMatch(yaml,/continue-on-error:\s*true/);
 }
 assert.match(script,/hw\.lcd\.width=768/);
 assert.match(script,/hw\.lcd\.height=1280/);
 assert.match(script,/hw\.lcd\.density=320/);
 assert.match(script,/awk '!\/\^hw/,'Original pixel6 dimensions must be replaced, not duplicated');
 assert.match(script,/set -euo pipefail/);
 assert.match(read('scripts/visual-evolution-p1-avd.sh'),/dimensions\[320\]\[0\]>=720/);
 assert.match(read('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),/wm density /);
});
