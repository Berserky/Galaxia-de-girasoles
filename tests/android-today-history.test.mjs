import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/today-history.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Intl,Date};
vm.runInNewContext(source,context);
const {sameMonthDay,yearsAgo,anniversaryLabel,dayLabel,groupHasActivity}=context.module.exports;

test('today history matches only previous years on the same month and day',()=>{
 assert.equal(sameMonthDay('2025-10-03','2026-10-03'),true);
 assert.equal(sameMonthDay('2026-10-03','2026-10-03'),false);
 assert.equal(sameMonthDay('2025-10-04','2026-10-03'),false);
});

test('today history creates human anniversary labels',()=>{
 assert.equal(yearsAgo('2025','2026-10-03'),1);
 assert.equal(anniversaryLabel('2025','2026-10-03'),'Hace 1 año');
 assert.equal(anniversaryLabel('2023','2026-10-03'),'Hace 3 años');
 assert.match(dayLabel('2026-10-03'),/3 de octubre/i);
});

test('today history detects activity even without saved items',()=>{
 assert.equal(groupHasActivity({items:[],stats:{trips:0,encounters:0,gestures:0,voices:0,arrivals:0}}),false);
 assert.equal(groupHasActivity({items:[],stats:{trips:1}}),true);
});
