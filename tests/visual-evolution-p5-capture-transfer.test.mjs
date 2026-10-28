import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,chmodSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const source=readFileSync(resolve(import.meta.dirname,'../scripts/visual-evolution-p1-avd.sh'),'utf8');
const adbFn=source.match(/^adb\(\) \{\n[\s\S]*?^\}/m)?.[0];
function simulate(fail){
 const dir=mkdtempSync(join(tmpdir(),'p5-adb-proof-'));
 try{
  const executable=join(dir,'adb'),destination=join(dir,'screen.png'),report=join(dir,'p1-capture-transfer.tsv');
  const emulator=[
   '#!/usr/bin/env bash',
   'if [[ "$1" == "pull" ]]; then',
   '  if [[ "$MOCK_PULL_FAIL" == "1" ]]; then',
   '    echo "remote object does not exist" >&2; exit 2',
   '  fi',
   '  printf "PNG-SYNTHETIC" > "$3"',
   '  echo "one file pulled"',
   '  exit 0',
   'fi',
   'if [[ "$1" == "shell" ]]; then echo "FAKE SHELL OK"; exit 0; fi',
   'echo "unsupported mock command" >&2; exit 3'
  ].join('\n')+'\n';
  writeFileSync(executable,emulator,{mode:0o755});chmodSync(executable,0o755);
  const bash=[
   'set -euo pipefail',adbFn,
   'CAPTURE_REPORT="'+report+'"',
   'printf "status\\tscreenshot\\tdetail\\n" > "$CAPTURE_REPORT"',
   'adb pull "/sdcard/Download/V5-P1-synthetic-daylight.png" "'+destination+'" >/dev/null 2>&1 || true',
   'adb shell echo harmless'
  ].join('\n');
  const run=spawnSync('bash',['-c',bash],{
    encoding:'utf8',timeout:10000,
    env:{...process.env,PATH:dir+':'+process.env.PATH,MOCK_PULL_FAIL:fail?'1':'0'}
  });
  return {exit:run.status,stderr:run.stderr,stdout:run.stdout,
   report:existsSync(report)?readFileSync(report,'utf8'):'',
   imageExists:existsSync(destination),
   imageBytes:existsSync(destination)?readFileSync(destination).length:0};
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('P5 Android QA diagnostics: all 16 original adb pulls remain and physical PNG gate stays strict',()=>{
 assert.equal((source.match(/^    adb pull "\/sdcard\/Download\/V5-/gm)||[]).length,16);
 assert.match(source,/assert len\(paths\)==7/);
 assert.match(source,/assert all\(p\.is_file\(\) for p in images\)/);
 assert.match(source,/p1-capture-transfer\.tsv/);
 assert.ok(adbFn,'adb diagnostic wrapper must exist');
});
test('P5 Android QA diagnostics: actual Bash wrapper records a copied mock image and its byte length',{
 skip:process.platform==='win32'
},()=>{
 const r=simulate(false);
 assert.equal(r.exit,0,r.stderr);
 assert.equal(r.imageExists,true);
 assert.equal(r.imageBytes,13);
 assert.match(r.report,/COPIED\tV5-P1-synthetic-daylight\.png\t13 bytes/);
 assert.match(r.stdout,/FAKE SHELL OK/,'non-pull commands must reach underlying adb');
});
test('P5 Android QA diagnostics: failed transport is recorded and never treated as an image',{
 skip:process.platform==='win32'
},()=>{
 const r=simulate(true);
 assert.equal(r.exit,0,r.stderr);
 assert.equal(r.imageExists,false);
 assert.match(r.report,/MISSING\tV5-P1-synthetic-daylight\.png\tremote object does not exist/);
 assert.doesNotMatch(r.report,/COPIED/);
 assert.match(r.stdout,/FAKE SHELL OK/);
});
test('P5 Android QA diagnostics: synthetic mock checks never replace emulator screenshot assertions',()=>{
 assert.match(source,/Android synthetic QA:.*screenshot transfers failed/);
 assert.match(source,/V5-P1-synthetic-\$\{theme\}\.png/);
 assert.match(source,/sha!=hashlib\.sha256/);
});
