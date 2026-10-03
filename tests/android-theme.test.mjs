import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/theme.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Date};
vm.runInNewContext(source,context);
const {seasonal,resolve,normalize,options,activeLabel}=context.module.exports;
const local=(iso)=>new Date(iso+'T12:00:00');

test('seasonal theme windows match the existing web experience',()=>{
 assert.equal(seasonal(local('2026-10-20')),'halloween');
 assert.equal(seasonal(local('2026-10-31')),'halloween');
 assert.equal(seasonal(local('2026-12-01')),'christmas');
 assert.equal(seasonal(local('2026-02-07')),'valentine');
 assert.equal(seasonal(local('2026-02-14')),'valentine');
 assert.equal(seasonal(local('2026-09-10')),'friendship');
 assert.equal(seasonal(local('2026-09-30')),'friendship');
 assert.equal(seasonal(local('2026-03-20')),'easter');
 assert.equal(seasonal(local('2026-04-20')),'easter');
 assert.equal(seasonal(local('2026-05-01')),'daylight');
});

test('manual theme overrides seasonal automatic selection',()=>{
 assert.deepEqual({...resolve('cosmic',local('2026-12-24'))},{selected:'cosmic',active:'cosmic'});
 assert.deepEqual({...resolve('auto',local('2026-12-24'))},{selected:'auto',active:'christmas'});
 assert.equal(normalize('unknown'),'auto');
});

test('all expected themes are exposed to Android settings',()=>{
 const ids=Array.from(options(),x=>x.id);
 assert.deepEqual(ids,['auto','daylight','cosmic','halloween','christmas','valentine','friendship','easter']);
 assert.equal(activeLabel('auto',local('2026-10-25')),'Halloween');
});
