import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(root,name),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:2500});
const module=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:x=>'<i>'+esc(x)+'</i>',itemCard:x=>'<article class="card">ITEM:'+esc(x.id)+':'+esc(x.data?.title||'')+'</article>'};
test('P6D: plans split by user-defined category and explicit completion only',()=>{
 const rows=[{id:'a',kind:'plan',data:{title:'Primero',planCategory:'this-week'}},{id:'b',kind:'plan',data:{title:'Segundo',planCategory:'someday'}},{id:'c',kind:'plan',data:{title:'Tercero',done:true}},{id:'d',kind:'plan',data:{title:'Cuarto',done:'true'}}];
 const html=module.organizedCollection(rows,'plan',ui);
 for(const id of ['a','b','c','d'])assert.equal((html.match(new RegExp('ITEM:'+id+':','g'))||[]).length,1);
 assert.match(html,/Elegidos para esta semana/);assert.match(html,/Algún día/);assert.match(html,/Planes realizados/);
 assert.ok(html.indexOf('ITEM:c:')>html.indexOf('ITEM:d:'));
});
test('P6D: notes show real categories; original card actions inside accessible disclosure',()=>{
 const html=module.organizedCollection([{kind:'note',id:'a',data:{title:'Una carta',category:'Cartas'}},{kind:'note',id:'b',data:{title:'Sin grupo'}}],'note',ui);
 assert.match(html,/Cartas/);assert.match(html,/Sin categoría/);
 assert.match(html,/data-item-id="a"/);
 assert.equal((html.match(/class="memories-v5-note"/g)||[]).length,2);
 assert.match(html,/Ver contenido y opciones de esta nota/);
});
test('P6D: wishes do not assume goal completion',()=>{
 const html=module.organizedCollection([{kind:'wish',id:'one',data:{title:'A'}},{kind:'wish',id:'two',data:{done:true,title:'B'}},{kind:'wish',id:'three',data:{done:'true',title:'C'}}],'wish',ui);
 assert.match(html,/Deseos marcados como cumplidos/);
 assert.ok(html.indexOf('ITEM:three:')<html.indexOf('ITEM:two:'));
});
test('P6D: injection in note title/category and ids is escaped',()=>{
 const html=module.organizedCollection([{kind:'note',id:'" onclick="evil',data:{title:'<script>x</script>',category:'<img src=x>'}}],'note',ui);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img src=x&gt;/);
 assert.doesNotMatch(html,/<script>|<img src=x>|onclick="evil"/);
});
test('P6D: capsule and nonmatching items never render in collections',()=>{
 const html=module.organizedCollection([{id:'private',kind:'capsule',data:{title:'SECRET-CAPSULE'}},{id:'public',kind:'note',data:{title:'Visible'}}],'note',ui);
 assert.doesNotMatch(html,/SECRET-CAPSULE|ITEM:private/);assert.match(html,/ITEM:public/);
});
test('P6D: app retains item create/edit/delete and opens notes via recent link',()=>{
 const app=read('app.js');
 assert.match(app,/GalaxyMemoriesV5\.organizedCollection\(list,kind,\{esc,attr,ico,itemCard\}\)/);
 assert.match(app,/matches\?\.\('details\.memories-v5-note'\)/);
 assert.match(app,/if\(a==='item-delete'\)/);
 assert.match(app,/data-action="item-new"/);
 assert.doesNotMatch(read('galaxy-memories-v5.js'),/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
