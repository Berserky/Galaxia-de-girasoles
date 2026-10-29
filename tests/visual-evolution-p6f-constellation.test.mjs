import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=p=>readFileSync(resolve(dir,p),'utf8'),sandbox={window:{}};
runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:2200});
const hub=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:n=>'<i>'+esc(n)+'</i>'};
const rows=[
 {kind:'memory',id:'m1',data:{title:'Abril',date:'2026-04-02',body:'Recordamos'}},
 {kind:'event',id:'e1',data:{title:'Cumple',date:'2026-04-27'}},
 {kind:'journey',id:'j1',data:{title:'Viaje',date:'2025-10-12'}},
 {kind:'song',id:'s1',data:{title:'Sin fecha'}},
 {kind:'capsule',id:'locked',data:{locked:true,title:'SECRETO',date:'2026-04-03',body:'HIDDEN-BODY'}},
 {kind:'note',id:'private',data:{title:'NOTA-PRIVADA',body:'HIDDEN'}}];
test('P6F: only allowed authenticated kinds become constellations, no capsules or notes',()=>{
 const model=hub.constellationModel(rows);
 assert.equal(model.length,4);
 assert.equal(model.some(x=>x.id==='locked'||x.id==='private'),false);
});
test('P6F: lines mean only explicitly dated steps of same year, not synthetic affiliations',()=>{
 const markup=hub.constellationView(rows,{expanded:true},ui);
 assert.equal((markup.match(/<line /g)||[]).length,1);
 assert.match(markup,/Las líneas unen fechas consecutivas del mismo año/);
 assert.doesNotMatch(markup,/SECRETO|HIDDEN-BODY|NOTA-PRIVADA/);
});
test('P6F: views do not silently truncate; expansion shows all saved allowed objects',()=>{
 const many=Array.from({length:45},(_,i)=>({kind:'memory',id:'m'+i,data:{title:'Memoria '+i,date:'2025-05-20'}}));
 const compact=hub.constellationView(many,{limit:18},ui),full=hub.constellationView(many,{expanded:true},ui);
 assert.match(compact,/Mostrando 18 de 45/);
 assert.match(compact,/Mostrar más \(27\)/);
 assert.match(full,/Mostrando 45 de 45/);
 assert.equal((full.match(/data-action="constellation-item"/g)||[]).length,45);
});
test('P6F: without explicit life date, no guessed relation from created',()=>{
 const noDate=[{kind:'memory',id:'a',created:'2026-01-02T12:30:00Z',data:{title:'A'}},{kind:'song',id:'b',created:'2026-01-03T12:30:00Z',data:{title:'B'}}];
 const html=hub.constellationView(noDate,{expanded:true},ui);
 assert.match(html,/Sin fecha de vivencia/);
 assert.doesNotMatch(html,/<line /);
});
test('P6F: escaped titles and ids prevent HTML/attribute injection',()=>{
 const input=[{kind:'memory',id:'x" onclick="evil',data:{title:'<img src=x>',date:'2026-09-03',body:'<script>evil</script>'}}];
 const html=hub.constellationView(input,{expanded:true},ui),preview=hub.constellationPreview(input[0],ui);
 assert.match(html,/&lt;img src=x&gt;/);
 assert.match(preview,/&lt;script&gt;/);
 assert.doesNotMatch(html+preview,/<img src=x>|<script>|onclick="evil"/);
});
test('P6F: app preserves safe shortcut gate and fullscreen modal cleanup',()=>{
 const app=read('app.js');
 assert.match(app,/if\(a==='constellation-item'\)/);
 assert.match(app,/if\(a==='constellation-expand'/);
 assert.match(app,/!\['memory','journey','song','event'\]\.includes\(item\.kind\)/);
 assert.match(app,/memories-v5-constellation-modal/);
 assert.match(app,/GalaxyMemoriesV5\.constellationView\(cloud\?\.items/);
 assert.doesNotMatch(read('galaxy-memories-v5.js'),/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
