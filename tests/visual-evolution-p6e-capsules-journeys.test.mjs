import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile'),read=x=>readFileSync(resolve(dir,x),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:1500});
const hub=sandbox.window.GalaxyMemoriesV5,esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:x=>'<i>'+esc(x)+'</i>',itemCard:x=>'<article class="card">FULL-'+esc(x.id)+'</article>'};
test('P6E: locked capsule never renders body, media or full item card',()=>{
 const html=hub.capsuleShelf([{kind:'capsule',id:'secret',data:{title:'Carta cerrada',locked:true,unlockType:'place',body:'SEALED',photoUrl:'SECRET-PHOTO',audioUrl:'SECRET-AUDIO'}},{kind:'capsule',id:'visible',data:{title:'Abierta',locked:false}}],ui);
 for(const marker of ['SEALED','SECRET-PHOTO','SECRET-AUDIO','FULL-secret'])assert.equal(html.includes(marker),false);
 assert.match(html,/Contenido protegido/);assert.match(html,/FULL-visible/);
});
test('P6E: date-based locked capsule shows only valid schedule',()=>{
 const html=hub.capsuleShelf([{kind:'capsule',data:{locked:true,unlockDate:'bad',body:'SECRET'}}],ui);
 assert.match(html,/Aún no disponible/);assert.doesNotMatch(html,/bad|SECRET|<details/);
});
test('P6E: journeys by exact date, undated distinct; no capsule leakage',()=>{
 const html=hub.journeyShelf([{kind:'journey',id:'a',data:{date:'2024-06-08'}},{kind:'journey',id:'b',data:{date:'2026-10-28'}},{kind:'journey',id:'c',data:{}},{kind:'capsule',id:'z',data:{title:'SECRET'}}],ui);
 assert.ok(html.indexOf('2026 <small>')<html.indexOf('2024 <small>'));assert.match(html,/Sin fecha registrada/);
 assert.doesNotMatch(html,/FULL-z|SECRET/);
});
test('P6E: escapes metadata and refuses unproven photo metadata',()=>{
 const html=hub.journeyShelf([{kind:'journey',id:'a',data:{title:'<script>x</script>',placeName:'<img src=x>',photoUrl:'SECRET-PHOTO'}}],ui);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img src=x&gt;/);
 assert.doesNotMatch(html,/<script>|<img src=x>|SECRET-PHOTO/);
});
test('P6E: original edit/delete and confirmation remain unchanged',()=>{
 const app=read('app.js');assert.match(app,/GalaxyMemoriesV5\.capsuleShelf\(list/);assert.match(app,/GalaxyMemoriesV5\.journeyShelf\(list/);
 assert.match(app,/if\(a==='item-delete'\)/);
 assert.doesNotMatch(read('galaxy-memories-v5.js'),/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
