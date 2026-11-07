import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const base=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile'),read=name=>readFileSync(resolve(base,name),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:2000});
const h=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:x=>'<i>'+esc(x)+'</i>',itemCard:i=>'<div class="card">'+esc(i.data?.title||'Evento')+'</div>'};
const items=[{kind:'event',id:'a',data:{title:'Viaje',date:'2026-10-28'}},{kind:'event',id:'b',data:{title:'Aniversario',date:'2024-11-01',annual:true}},{kind:'event',id:'c',data:{title:'Sin fecha'}},{kind:'capsule',id:'secret',data:{title:'SECRET-CAPSULE',date:'2026-10-28'}}];
test('P6D: only exact ISO calendar dates accepted, not ambiguous date parsing',()=>{
 for(const date of ['2026-02-29','2026-13-01','2026-00-05','2026-1-05','2026-04-31','2026-05-00',false,null])assert.equal(h.validDate(date),false);
 for(const date of ['2024-02-29','2026-10-28','2026-12-31'])assert.equal(h.validDate(date),true);
});
test('P6D: next annual occurrence comes only from explicit annual flag',()=>{
 assert.equal(h.eventOccurrence(items[1],'2026-10-28'),'2026-11-01');
 assert.equal(h.eventOccurrence({...items[1],data:{...items[1].data,annual:false}},'2026-10-28'),'2024-11-01');
 const leap={kind:'event',data:{date:'2024-02-29',annual:true}};
 assert.equal(h.eventOccurrence(leap,'2025-03-01'),'2028-02-29');
});
test('P6D: calendar grid lists authenticated events only and excludes capsules',()=>{
 const s=h.eventCalendar(items,{today:'2026-10-28',month:'2026-10',mode:'month',selectedDate:'2026-10-28'},ui);
 assert.match(s,/Calendario de fechas especiales/);
 assert.match(s,/Viaje/);
 assert.doesNotMatch(s,/SECRET-CAPSULE|Sin fecha<\/div>/);
 assert.equal((s.match(/data-action="memories-calendar-day"/g)||[]).length,31);
});
test('P6D: month switching and unknown date are bounded, no infinite shifts',()=>{
 assert.equal(h.shiftMonth('2026-12',1),'2027-01');
 assert.equal(h.shiftMonth('2026-01',-1),'2025-12');
 assert.equal(h.shiftMonth('1900-01',-1),null);
 assert.equal(h.shiftMonth('broken',1),null);
 assert.equal(h.calendarMonth('bad','2026-10-28',items),'2026-10');
});
test('P6D: agenda separates future from past and keeps undated safely',()=>{
 const out=h.eventCalendar(items,{today:'2026-10-28',mode:'agenda'},ui);
 assert.match(out,/Próximas fechas/);
 assert.match(out,/Sin fecha definida/);
 assert.match(out,/Aniversario/);
 assert.doesNotMatch(out,/SECRET-CAPSULE/);
});
test('P6D: app uses existing item actions, records calendar mode and avoids new APIs',()=>{
 const app=read('app.js'),module=read('galaxy-memories-v5.js');
 assert.match(app,/GalaxyMemoriesV5\.eventCalendar\(list,/);
 assert.match(app,/if\(a==='memories-month-shift'/);
 assert.match(app,/if\(a==='memories-calendar-day'/);
 assert.match(app,/data-action="item-new" data-kind="event"/);
 assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
