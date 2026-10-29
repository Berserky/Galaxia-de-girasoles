import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(dir,name),'utf8');
const win={};
for(const name of ['galaxy-memories-v5.js','galaxy-more-v5.js'])
 runInNewContext(read(name),{window:win},{timeout:1800});
const memories=win.GalaxyMemoriesV5,more=win.GalaxyMoreV5,app=read('app.js');
const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const ui={esc:escape,attr:escape,ico:()=>'<i aria-hidden="true"></i>',itemCard:item=>'<div data-expanded-id="'+escape(item.id)+'">BODY-'+escape(item.data.body||'')+'</div>'};
const SECRET='P8-DUMMY-PRIVATE-CAPSULE-BODY-NEVER-RENDER';
const PATH='P8-DUMMY-SECRET-STORAGE-PATH';
const synthetic=[
 {id:'sealed',kind:'capsule',created:'2026-10-26T10:20:00Z',data:{title:'Sobre cerrado',locked:true,body:SECRET,photoPath:PATH,category:'SECRET-CATEGORY',date:'2026-10-26',unlockType:'place',unlockDate:'2026-10-29'}},
 {id:'open',kind:'memory',created:'2026-10-25T10:00:00Z',data:{title:'Recuerdo público de prueba',body:'SAFE',date:'2026-10-25',category:'Compartido'}}
];

test('P8 P6: one sealed capsule remains unreadable across every composed Memories surface',()=>{
 const fragments=[
  memories.discover(synthetic,{photo:[],music:[]},ui),
  memories.capsuleShelf(synthetic,ui),
  memories.historyTimeline(synthetic,'2026-10-29',ui),
  memories.constellationView(synthetic,{},ui),
  memories.filtersPanel(synthetic,{},ui)
 ];
 for(const [i,html] of fragments.entries()){
  for(const secret of [SECRET,PATH,'SECRET-CATEGORY','BODY-'+SECRET])
   assert.equal(html.includes(secret),false,'P6 surface '+i+' leaked '+secret);
 }
 assert.match(fragments[1],/Contenido protegido/);
 assert.match(fragments[2],/Recuerdo público de prueba/);
 assert.equal(memories.constellationModel(synthetic).length,1);
 assert.equal(memories.safeItems(synthetic).length,1);
 assert.equal(memories.filterItems(synthetic,{query:SECRET}).length,0);
 assert.equal(memories.filterItems(synthetic,{query:'SECRET-CATEGORY'}).length,0);
 assert.equal(memories.filterItems(synthetic,{query:'Sobre cerrado'}).length,1,'public locked title remains searchable');
});

test('P8 P6: Drive error and unknown states never masquerade as completed sync',()=>{
 const none=memories.driveSyncFeedback(null,ui);
 const working=memories.driveSyncFeedback({phase:'working'},ui);
 const failed=memories.driveSyncFeedback({phase:'error',imported:999},ui);
 const partial=memories.driveSyncFeedback({phase:'partial',imported:2,skipped:1,failed:3},ui);
 assert.doesNotMatch(none,/Sincronización completada/);
 assert.doesNotMatch(working,/Sincronización completada/);
 assert.doesNotMatch(failed,/Sincronización completada|999 nuevas/);
 assert.match(partial,/Importación con incidencias/);
 assert.match(partial,/2 nuevas/);
 assert.match(partial,/3 con error/);
});

test('P8 P7: no self or revoked-device action; other device still requires real confirmation',()=>{
 const devices=[{id:'current',person:'0',name:'Este teléfono'},{id:'other',person:'1',name:'Teléfono secundario'},{id:'revoked',person:'0',revoked_at:'2026-01-01',name:'Sesión antigua'}];
 for(const target of ['current','revoked','not-present'])
  assert.equal(more.deviceRevokePreview(devices,'current',target).ok,false);
 const confirm=more.deviceRevokePreview(devices,'current','other',['Perfil A','Perfil B']);
 assert.equal(confirm.ok,true);
 assert.match(confirm.message,/Teléfono secundario/);
 const action=app.slice(app.indexOf("if(a==='device-revoke'){"),app.indexOf("if(a==='app-settings')"));
 assert.ok(action.includes('if(!context?.ok)'));
 assert.ok(action.includes('if(!confirm(context.message))return;'));
 assert.ok(action.indexOf('if(!confirm(context.message))return;')<action.indexOf("api('device-revoke',{id})"));
 assert.ok(!read('galaxy-more-v5.js').includes("api('device-revoke'"),'presentational layer must not revoke');
});
