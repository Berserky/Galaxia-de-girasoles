import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Crown Jewel release metadata is 4.1.0 code 37',()=>{
  const gradle=read('android/app/build.gradle.kts');
  assert.match(gradle,/versionCode = 37; versionName = "4\.1\.0"/);
});

test('Crown Jewel QA ledger contains exactly VIS-001 through VIS-066',()=>{
  const qa=read('docs/qa/chat-4.1-crown-jewel-release.md');
  const ids=[...qa.matchAll(/^\| (VIS-\d{3}) \|/gm)].map(m=>m[1]);
  assert.equal(ids.length,66,'QA matrix must have exactly 66 VIS rows');
  assert.equal(new Set(ids).size,66,'QA matrix must not duplicate VIS IDs');
  assert.deepEqual(ids,Array.from({length:66},(_,i)=>'VIS-'+String(i+1).padStart(3,'0')));
  assert.doesNotMatch(qa,/\| VIS-\d{3} \|[^\n]*\| (?:FAIL|NOT TESTED) \|/);
});

test('Crown Jewel QA ledger keeps physical smoke explicit and stable promotion forbidden',()=>{
  const qa=read('docs/qa/chat-4.1-crown-jewel-release.md');
  assert.match(qa,/Physical smoke:[^\n]*NOT TESTED/i);
  assert.match(qa,/NO ejecutar android-stable/i);
  assert.match(qa,/#109/);
});
