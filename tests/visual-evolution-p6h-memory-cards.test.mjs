import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const source=readFileSync(resolve(import.meta.dirname,'../android/app/src/main/assets/mobile/app.js'),'utf8');
const start=source.indexOf('function memoryCardExcerpt('),end=source.indexOf('\nfunction storyTimeline(){',start);
assert.ok(start>=0&&end>start);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const context={esc,attr:esc,ico:s=>'<i>'+esc(s)+'</i>',kindMeta:{memory:['heart','Recuerdo'],event:['calendar','Fecha especial'],plan:['check','Plan'],note:['file-text','Nota'],capsule:['lock','Cápsula'],wish:['star','Deseo'],journey:['route','Viaje'],song:['music','Canción']},fmtDate:s=>s,fmtDateTime:s=>s,linkedVoices:()=>[],linkedDailyQuestionAnswers:()=>'',voiceCard:()=>''};
const {itemCard,memoryCardExcerpt}=runInNewContext(source.slice(start,end)+'\n;({itemCard,memoryCardExcerpt})',context,{timeout:2000});
const item=(kind='memory',data={title:'Nuestro día',body:'Un recuerdo real'})=>({id:'id-1',kind,data,created:'2026-10-01T12:00:00Z'});
test('P6H: long text is summarized and full original remains accessible',()=>{
 const html=itemCard(item('memory',{title:'Historia',body:'Recuerdo extenso '.repeat(35)+'FINAL-REAL'}));
 assert.match(html,/Leer texto completo/);assert.match(html,/FINAL-REAL/);
 assert.ok(html.indexOf('Leer texto completo')<html.indexOf('FINAL-REAL'));
});
test('P6H: short content is escaped without collapsing',()=>{
 const html=memoryCardExcerpt('<script>alert(1)</script>');
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/Leer texto completo/);
});
test('P6H: destructive actions require opening secondary menu; confirmation retained',()=>{
 const html=itemCard(item());
 assert.match(html,/<details class="memories-v5-card-more">/);
 assert.match(html,/data-action="item-edit"/);assert.match(html,/data-action="item-delete"/);
 assert.match(source,/async function deleteItem\(id\)\{[\s\S]*?confirm\('¿Eliminar este contenido\?'\)/);
});
test('P6H: media preview only from existing authenticated HTTPS entries',()=>{
 const html=itemCard(item('memory',{title:'Fotos',source:{type:'chat-album'},sourceMedia:[{kind:'image',url:'https://example.test/photo'},{kind:'video',url:'https://example.test/video'},{kind:'image',url:'javascript:alert(1)'},{kind:'image',url:'http://insecure.test/pic'}]}));
 assert.match(html,/example\.test\/photo/);assert.match(html,/example\.test\/video/);
 assert.match(html,/Ver 1 archivo más/);assert.doesNotMatch(html,/javascript:|insecure\.test/);
 assert.doesNotMatch(itemCard(item()),/memories-v5-card-media/);
});
test('P6H: locked capsules never expose body, media or edit/delete',()=>{
 const html=itemCard(item('capsule',{title:'Cerrada',locked:true,body:'SECRETO',photoUrl:'https://example.test/private'}));
 assert.doesNotMatch(html,/SECRETO|private|data-action="item-edit"|data-action="item-delete"/);
 assert.match(html,/servidor mantiene su contenido protegido/);
});
test('P6H: type and category metadata escape user content',()=>{
 const html=itemCard(item('journey',{title:'<Viaje>',category:'<Lugar>',date:'2026-10-10'}));
 assert.match(html,/memories-v5-card--journey/);assert.match(html,/&lt;Viaje&gt;|&lt;Lugar&gt;/);
 assert.doesNotMatch(html,/<Viaje>|<Lugar>/);
});
