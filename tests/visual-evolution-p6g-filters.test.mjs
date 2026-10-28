import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const d=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile'),read=p=>readFileSync(resolve(d,p),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:2000});
const hub=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:s=>'<i>'+esc(s)+'</i>'};
const rows=[
 {kind:'memory',id:'a',data:{title:'Álbum de Bogotá',category:'Viajes',date:'2026-09-12'}},
 {kind:'memory',id:'b',data:{title:'Carta',category:'Cartas',date:'2026-10-04',body:'SECRET-BODY'}},
 {kind:'memory',id:'c',data:{title:'Cerrado',category:'SECRET-PRIVATE',locked:true,body:'SECRET-BODY'}},
 {kind:'capsule',id:'secret',data:{locked:true,title:'Cápsula',body:'SECRET-CAPSULE',category:'SECRET-PRIVATE'}}];
test('P6G: accent-insensitive title/category search and exact saved month',()=>{
 assert.equal(hub.filterItems(rows,{query:'bogota',month:'2026-09'}).length,1);
 assert.equal(hub.filterItems(rows,{query:'viajes'}).length,1);
 assert.equal(hub.filterItems(rows,{month:'2026-10'}).length,1);
});
test('P6G: never search body, hidden media or private capsule category',()=>{
 for(const query of ['SECRET-BODY','SECRET-PRIVATE','SECRET-CAPSULE'])assert.equal(hub.filterItems(rows,{query}).length,0);
 assert.equal(hub.filterItems(rows,{query:'Cápsula'}).length,1);
});
test('P6G: malformed date filter remains neutral and does not parse arbitrary strings',()=>{
 assert.equal(hub.filterItems(rows,{month:'yesterday'}).length,4);
 assert.equal(hub.filterItems(rows,{month:'2026-13'}).length,4);
});
test('P6G: category matching exact, not semantic/inferred',()=>{
 assert.equal(hub.filterItems(rows,{category:'Cartas'}).length,1);
 assert.equal(hub.filterItems(rows,{category:'Carta'}).length,0);
});
test('P6G: filter controls escape external labels and never offer locked categories',()=>{
 const html=hub.filtersPanel([...rows,{kind:'memory',data:{title:'x',category:'<img src=x>'}}],{},ui);
 assert.doesNotMatch(html,/SECRET-PRIVATE|<img src=x>/);
 assert.match(html,/&lt;img src=x&gt;/);
 assert.match(html,/data-action="memories-filter-apply"/);
});
test('P6G: app uses existing authenticated item list with local filters',()=>{
 const app=read('app.js'),module=read('galaxy-memories-v5.js');
 assert.match(app,/GalaxyMemoriesV5\.filterItems\(source,memoryFilters\)/);
 assert.match(app,/if\(a==='memories-filter-reset'/);
 assert.match(app,/if\(a==='memories-filter-apply'/);
 assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
