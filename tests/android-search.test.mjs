import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/search.js'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{}};
vm.runInNewContext(source,context);
const {normalizeSearch,searchUniverse}=context.module.exports;

test('Android universal search ignores accents and ranks title matches first',()=>{
 const rows=searchUniverse({
  items:[
   {id:'1',kind:'memory',data:{title:'Viaje a Útica',body:'Pescar juntos'},created:'2026-01-01'},
   {id:'2',kind:'note',data:{title:'Una nota',body:'Algún día volvemos a Utica'},created:'2026-02-01'}
  ],places:[]
 },'utica');
 assert.equal(rows.length,2);
 assert.equal(rows[0].id,'1');
 assert.equal(normalizeSearch('ÚTICA  juntos'),'utica juntos');
});

test('Android universal search combines items and places and requires every token',()=>{
 const rows=searchUniverse({
  items:[{id:'a',kind:'plan',data:{title:'Picnic en el parque',body:'Llevar manta'}}],
  places:[
   {id:9,name:'Parque de los Novios',note:'Picnic favorito',kind:'memory',latitude:4.66,longitude:-74.09},
   {id:10,name:'Casa',note:'Películas',kind:'home',latitude:4.6,longitude:-74.1}
  ]
 },'parque picnic');
 assert.deepEqual(Array.from(rows,x=>x.type),['item','place']);
 assert.equal(rows.some(x=>x.id==='10'),false);
});

test('Android universal search understands content type labels',()=>{
 const rows=searchUniverse({
  items:[
   {id:'w',kind:'wish',data:{title:'Ir a Japón',body:''}},
   {id:'s',kind:'song',data:{title:'Nuestra canción',body:''}}
  ],places:[]
 },'deseo');
 assert.equal(rows.length,1);
 assert.equal(rows[0].id,'w');
});
