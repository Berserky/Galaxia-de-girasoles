import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/monthly.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Intl,Date};
vm.runInNewContext(source,context);
const {shiftMonth,monthLabel,canGoNext,summaryHasActivity}=context.module.exports;

test('monthly navigation crosses year boundaries',()=>{
 assert.equal(shiftMonth('2026-01',-1),'2025-12');
 assert.equal(shiftMonth('2026-12',1),'2027-01');
 assert.equal(canGoNext('2026-09','2026-10'),true);
 assert.equal(canGoNext('2026-10','2026-10'),false);
});

test('monthly labels are localized for Colombia',()=>{
 assert.match(monthLabel('2026-10'),/octubre de 2026/i);
});

test('monthly activity understands couple metrics',()=>{
 assert.equal(summaryHasActivity({counts:{memories:0,saved:0},trips:{count:0},encounters:{count:0},bond:{gestures:0,voices:0}}),false);
 assert.equal(summaryHasActivity({counts:{memories:1},trips:{count:0},encounters:{count:0},bond:{gestures:0,voices:0}}),true);
});
