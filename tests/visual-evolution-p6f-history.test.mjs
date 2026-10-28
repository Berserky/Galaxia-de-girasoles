import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const d=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile'),read=p=>readFileSync(resolve(d,p),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:1500});
const h=sandbox.window.GalaxyMemoriesV5,esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:i=>'<i>'+esc(i)+'</i>',itemCard:i=>'<article class="card">CARD-'+esc(i.id)+'</article>'};
const input=[
 {id:'past',kind:'memory',data:{title:'Historia pasada',date:'2024-03-12'}},
 {id:'future',kind:'event',data:{title:'Próxima cita',date:'2027-03-10'}},
 {id:'undated',kind:'journey',created:'2026-10-20T10:30:00Z',data:{title:'Viaje sin fecha'}},
 {id:'locked',kind:'capsule',data:{title:'LOCKED-TITLE',locked:true,date:'2020-01-01',body:'LOCKED-BODY'}},
 {id:'opened',kind:'capsule',data:{title:'Cápsula abierta',date:'2025-01-01'}}
];
test('P6F: separate past and upcoming with explicit date, no invented event date',()=>{
 const rows=h.timelineRows(input,'2026-10-28');
 assert.equal(rows.known.filter(x=>x.upcoming).length,1);
 assert.equal(rows.undated.length,1);
 assert.equal(rows.undated[0].created,'2026-10-20');
});
test('P6F: locked capsule excluded regardless of scheduled date',()=>{
 const html=h.historyTimeline(input,'2026-10-28',ui);
 assert.doesNotMatch(html,/LOCKED-TITLE|LOCKED-BODY|CARD-locked/);
 assert.match(html,/Cápsula abierta/);
 assert.match(html,/Próximamente/);assert.match(html,/Lo que vivimos/);
});
test('P6F: created timestamp is displayed as saved date, never lived date',()=>{
 const html=h.historyTimeline(input,'2026-10-28',ui);
 assert.match(html,/Guardado el 2026-10-20/);
 assert.doesNotMatch(html,/Vivido el 2026-10-20/);
});
test('P6F: all valid items kept, no arbitrary top-12 truncation',()=>{
 const rows=Array.from({length:25},(_,n)=>({id:String(n),kind:'memory',data:{title:String(n),date:'2026-10-28'}}));
 const html=h.historyTimeline(rows,'2026-10-28',ui);
 assert.equal((html.match(/class="memories-v5-history-card"/g)||[]).length,25);
});
test('P6F: headings and item titles escape untrusted fields',()=>{
 const html=h.historyTimeline([{id:'x" onclick="evil',kind:'note',data:{title:'IGNORED'}},{id:'a',kind:'memory',data:{title:'<script>x</script>',date:'2026-10-28'}}],'2026-10-28',ui);
 assert.match(html,/&lt;script&gt;/);
 assert.doesNotMatch(html,/<script>|onclick="evil"|IGNORED/);
});
test('P6F: pure presenter never requests media or private state',()=>{
 const source=read('galaxy-memories-v5.js'),app=read('app.js');
 assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
 assert.match(app,/GalaxyMemoriesV5\.historyTimeline\(cloud\?\.items/);
});
