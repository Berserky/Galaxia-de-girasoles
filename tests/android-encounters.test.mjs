import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/encounters.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Date};
vm.runInNewContext(source,context);
const {durationLabel,countLabel,activeElapsed,totalWithActive}=context.module.exports;

test('encounter helpers format durations and counts',()=>{
 assert.equal(durationLabel(90),'1 min');
 assert.equal(durationLabel(3900),'1 h 5 min');
 assert.equal(durationLabel(90000),'1 d 1 h');
 assert.equal(countLabel(1),'1 encuentro');
 assert.equal(countLabel(4),'4 encuentros');
});

test('active encounter time advances from its start',()=>{
 const now=Date.parse('2026-10-03T12:30:00Z');
 assert.equal(activeElapsed({started_at:'2026-10-03T12:00:00Z'},now),1800);
});

test('cached total keeps advancing while encounter is active',()=>{
 const now=Date.parse('2026-10-03T12:05:00Z');
 assert.equal(totalWithActive({total_seconds:3600,active:{started_at:'2026-10-03T12:00:00Z'},generated_at:'2026-10-03T12:00:00Z'},now),3900);
});
