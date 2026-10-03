import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/gps-history.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Date};
vm.runInNewContext(source,context);
const {validDeleteConfirmation,exportFileName,emptyBundle,appendPage,counts,totalRows}=context.module.exports;

test('GPS delete requires explicit confirmation word',()=>{
 assert.equal(validDeleteConfirmation('BORRAR'),true);
 assert.equal(validDeleteConfirmation(' borrar '),true);
 assert.equal(validDeleteConfirmation('eliminar'),false);
});

test('GPS export file name is profile-specific and safe',()=>{
 assert.equal(exportFileName('2026-10-03','Sebastián'),'nuestra-galaxia-gps-sebastian-2026-10-03.json');
});

test('GPS export bundle appends paginated datasets',()=>{
 const b=emptyBundle('0','Sebas');
 appendPage(b,'history',[{id:1},{id:2}]);
 appendPage(b,'trips',[{id:3}]);
 assert.deepEqual({...counts(b)},{history:2,trips:1,tripPoints:0,placeEvents:0});
 assert.equal(totalRows(b),3);
});
