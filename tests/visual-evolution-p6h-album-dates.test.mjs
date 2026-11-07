import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=f=>readFileSync(resolve(root,f),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:2000});
const {albumDateGroups,albumGallery,albumViewer}=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={attr:esc,ico:esc};
const photo=(name,created)=>({url:'https://photos.example.test/'+name,path:'0/'+name,created});
const photos=[photo('old','2026-10-25T10:00:00Z'),photo('new','2026-10-26T09:00:00Z'),photo('old2','2026-10-25T18:00:00Z'),{...photo('unknown'),date:'2020-01-01'}];

test('P6H VE-164/166: groups only by backend storage created timestamps',()=>{
 const groups=albumDateGroups(photos);
 assert.deepEqual(Array.from(groups,x=>x.date),['2026-10-26','2026-10-25','']);
 assert.deepEqual(Array.from(groups[1].entries,x=>x.index),[0,2]);
});
test('P6H VE-164/166: never infer capture date from filename or other fields',()=>{
 const html=albumGallery(photos,ui);
 assert.match(html,/Incorporadas el 2026-10-25/);
 assert.match(html,/Sin fecha de incorporación/);
 assert.doesNotMatch(html,/Incorporadas el 2020-01-01/);
});
test('P6H: original viewer indices survive date-group sorting',()=>{
 const html=albumGallery(photos,ui);
 for(let i=0;i<photos.length;i++)assert.match(html,new RegExp('data-index="'+i+'"'));
 assert.match(albumViewer(photos,0,ui),/Foto 1 de 4/);
 assert.match(albumViewer(photos,1,ui),/Foto 2 de 4/);
});
test('P6H: no destructive control or private path exposed in thumbnail',()=>{
 const html=albumGallery(photos,ui);
 assert.doesNotMatch(html,/media-delete|data-path=|0\/old/);
});
test('P6H: invalid timestamps are undated and cannot trigger invented grouping',()=>{
 const groups=albumDateGroups([{created:'2026-02-30T01:00:00Z'}, {created:'2026-02-01'},null]);
 assert.equal(groups.length,1);assert.equal(groups[0].date,'');assert.equal(groups[0].entries.length,3);
});
test('P6H: grouping is presentation-only and preserves all source objects',()=>{
 const before=JSON.stringify(photos);
 const html=albumGallery(photos,ui);
 assert.equal((html.match(/class="memories-v5-photo-card"/g)||[]).length,photos.length);
 assert.equal(JSON.stringify(photos),before);
});
