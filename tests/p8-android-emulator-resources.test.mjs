import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflows = [
  {file:'visual-evolution-p0.yml',expectedScript:'script: bash scripts/visual-evolution-p1-avd.sh'},
  {file:'qa-phase5-real-integration.yml',expectedScript:'script: bash scripts/qa-phase5-emulator.sh'},
  {file:'chat-4-phase11-torture.yml',expectedScript:'script: bash scripts/p8-phase11-run-shard.sh closure-0'},
];

for (const {file,expectedScript} of workflows) {
  test('P8 API 35 emulator resources and strict QA gates: '+file,()=>{
    const yaml=readFileSync(new URL('../.github/workflows/'+file,import.meta.url),'utf8');
    assert.match(yaml,/on:\s*\n\s*pull_request:/);
    assert.match(yaml,/uses:\s*reactivecircus\/android-emulator-runner@v2/);
    assert.match(yaml,/api-level:\s*35/);
    assert.ok(yaml.includes(expectedScript),file+': real instrumentation script must remain');
    const launches=[...yaml.matchAll(/emulator-options: ([^\n]+)/g)];
    assert.equal(launches.length,file==='chat-4-phase11-torture.yml'?4:1,
      file+': missing required clean AVD session');
    for(const [,opts] of launches){
      assert.match(opts,/-memory 2048(?:\s|$)/);
      assert.match(opts,/-gpu swiftshader -feature -Vulkan/);
      assert.doesNotMatch(opts,/-gpu swiftshader_indirect/);
      assert.match(opts,/-no-snapshot/);
    }
    if(file==='chat-4-phase11-torture.yml'){
      for(const shard of ['garden','closure-0','closure-1','media']){
        assert.ok(yaml.includes('script: bash scripts/p8-phase11-run-shard.sh '+shard),
          'Missing distinct Phase11 real AVD run: '+shard);
      }
      assert.equal((yaml.match(/force-avd-creation: true/g)||[]).length,4);
      assert.match(yaml,/node scripts\/p8-verify-phase11-shards\.mjs qa-artifacts\/phase11-shards/);
      const helper=readFileSync(new URL('../scripts/p8-phase11-run-shard.sh',import.meta.url),'utf8');
      assert.match(helper,/gradle -p android --no-daemon connectedDebugAndroidTest/);
      assert.match(helper,/numShards=2/);
      assert.match(helper,/notClass=com\.nuestragalaxia\.companion\.GalaxyDeviceClosureTest#visualEvolutionP5_realMomentsAndroidScreens_andPrivacy/);
      assert.match(helper,/class=com\.nuestragalaxia\.companion\.GalaxyDeviceClosureTest#visualEvolutionP5_realMomentsAndroidScreens_andPrivacy/);
      assert.match(helper,/shardIndex=\$shard_index/);
      assert.match(helper,/if \(\( status != 0 \)\)/);
      const receipt=readFileSync(new URL('../scripts/p8-verify-phase11-shards.mjs',import.meta.url),'utf8');
      assert.match(receipt,/EXACTLY_ONCE/);
      assert.match(receipt,/rows\.garden\.length,1/);
      assert.match(receipt,/Duplicate Android JUnit case/);
      assert.match(receipt,/Unexecuted Android tests/);
    }
    assert.match(yaml,/if:\s*failure\(\)/);
    assert.doesNotMatch(yaml,/continue-on-error:\s*true/);
    assert.doesNotMatch(yaml,/\b(?:skip|ignore)-(?:android|instrumentation|qa):\s*true/);
  });
}
