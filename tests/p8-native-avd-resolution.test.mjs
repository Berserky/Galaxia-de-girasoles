import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
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
  const guestRam = name==='chat-4-phase10-android-performance.yml' ? 2048 : 4096;
  assert.equal((yaml.match(new RegExp('-gpu swiftshader -feature -Vulkan -memory '+guestRam+' -no-snapshot','g'))||[]).length,count);
  assert.match(yaml,/connectedDebugAndroidTest|scripts\/p8-phase11-run-shard\.sh|scripts\/qa-phase5-emulator\.sh|scripts\/visual-evolution-p1-avd\.sh/);
  assert.doesNotMatch(yaml,/continue-on-error:\s*true/);
 }
 assert.match(script,/hw\.lcd\.width=768/);
 assert.match(script,/hw\.lcd\.height=1280/);
 assert.match(script,/hw\.lcd\.density=320/);
 assert.ok(script.includes("awk '!/^hw[.]lcd[.](width|height|density)=/"),'Legacy Pixel 6 keys must be removed with a correct awk expression');
 assert.match(script,/set -euo pipefail/);
 assert.match(read('scripts/visual-evolution-p1-avd.sh'),/dimensions\[320\]\[0\]>=720/);
 assert.match(read('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),/wm density /);
});

test('P8 emulator prelaunch removes old dimensions, validates unique keys and is idempotent',()=>{
 const root=mkdtempSync(join(tmpdir(),'p8-avd-'));
 try{
  const avd=join(root,'test.avd');mkdirSync(avd);
  const config=join(avd,'config.ini');
  writeFileSync(config,'avd.ini.encoding=UTF-8\nhw.lcd.density=420\nhw.lcd.height=2400\nhw.lcd.width=1080\nhw.cpu.ncore=2\n');
  const invoke=()=>execFileSync('bash',[fileURLToPath(new URL('../scripts/p8-configure-native-avd.sh',import.meta.url))],{
   env:{...process.env,ANDROID_AVD_HOME:root},encoding:'utf8'
  });
  assert.match(invoke(),/P8 AVD verified framebuffer/);
  const result=readFileSync(config,'utf8');
  for(const [k,v] of Object.entries({width:768,height:1280,density:320})){
   const records=result.split('\n').filter(s=>s.startsWith('hw.lcd.'+k+'='));
   assert.deepEqual(records,['hw.lcd.'+k+'='+v],'Exactly one native AVD geometry key '+k);
  }
  assert.match(result,/hw.cpu.ncore=2/,'Keep all other AVD settings');
  invoke();
  assert.equal(readFileSync(config,'utf8'),result,'Second invocation must leave valid config unchanged');
 }finally{rmSync(root,{recursive:true,force:true});}
});
