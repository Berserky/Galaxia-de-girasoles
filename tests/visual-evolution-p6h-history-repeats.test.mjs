import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const src=readFileSync(resolve(import.meta.dirname,'../android/app/src/main/assets/mobile/galaxy-memories-v5.js'),'utf8');
const sandbox={window:{}};runInNewContext(src,sandbox,{timeout:2000});
const {historyVisualGroups,historyTimeline,timelineRows}=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={esc,attr:esc,ico:s=>'<i>'+esc(s)+'</i>',itemCard:i=>'<article>ORIGINAL-'+esc(i.id)+'</article>'};
const item=(id,title,date,kind='event')=>({id,kind,data:{title,date}});
const fixture=[item('a','Concierto','2026-02-14'),item('b',' concierto ','2026-02-14'),item('c','Concierto','2026-02-15'),item('d','Concierto','2026-02-14','memory')];

test('P6H VE-158: same-date events are marked for visual review, not merged in storage',()=>{
 const html=historyTimeline(fixture,'2026-10-28',ui);
 assert.equal((html.match(/Posible repetición visual/g)||[]).length,1);
 for(const row of fixture)assert.match(html,new RegExp('ORIGINAL-'+row.id));
 assert.match(html,/2 registros independientes/);
 assert.match(html,/no se ha fusionado ni eliminado ningún registro/);
});
test('P6H VE-158: title and explicit date must both match, never inferred',()=>{
 const rows=timelineRows([...fixture,item('undated','Concierto',undefined)],'2026-10-28');
 assert.equal(historyVisualGroups(rows.known).filter(x=>x.length>1).length,1);
 assert.equal(rows.undated.length,1);
 assert.equal(historyVisualGroups(rows.undated).length,1);
});
test('P6H VE-158: records with different kinds or dates remain distinct',()=>{
 const html=historyTimeline(fixture,'2026-10-28',ui);
 assert.match(html,/ORIGINAL-c/);assert.match(html,/ORIGINAL-d/);
 assert.equal((html.match(/class="memories-v5-history-repeat"/g)||[]).length,1);
});
test('P6H: no hidden capsule body or title can appear in visual group',()=>{
 const html=historyTimeline([...fixture,{id:'secret',kind:'capsule',data:{locked:true,title:'TOP SECRET',body:'SECRET BODY',date:'2026-02-14'}}],'2026-10-28',ui);
 assert.doesNotMatch(html,/TOP SECRET|SECRET BODY|ORIGINAL-secret/);
});
test('P6H: HTML escapes untrusted titles and never renders scripts',()=>{
 const html=historyTimeline([item('a','<img src=x onerror=alert(1)>','2026-02-14'),item('b','<img src=x onerror=alert(1)>','2026-02-14')],'2026-10-28',ui);
 assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img src=x|onerror=/);
});
test('P6H: presentation grouping never mutates source records',()=>{
 const before=JSON.stringify(fixture),rows=timelineRows(fixture,'2026-10-28');
 historyVisualGroups(rows.known);historyTimeline(fixture,'2026-10-28',ui);
 assert.equal(JSON.stringify(fixture),before);
});
