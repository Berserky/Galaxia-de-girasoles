import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp,configuration} from '../app/server.mjs';
test('bond API masks guesses, protects versions and persists the shared garden',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'bond-')),port=4299,base=`http://localhost:${port}`;
 const {server,store}=await createApp(configuration({PORT:String(port),BASE_URL:base,DATA_DIR:dir},true));
 await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{
  let cookie=(await fetch(base)).headers.get('set-cookie').split(';')[0];
  const state=()=>fetch(base+'/api/state',{headers:{Cookie:cookie}}).then(r=>r.json());
  let csrf=(await state()).csrf;
  const api=async(url,method='GET',data)=>{const r=await fetch(base+url,{method,headers:{Cookie:cookie,Origin:base,'X-CSRF-Token':csrf,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};};
  const quiz=await api('/api/bond','POST',{type:'game',data:{questionId:'comfort',answer:'Un abrazo'}});assert.equal(quiz.status,201);
  const note=await api('/api/bond','POST',{type:'sharednote',data:{title:'Nosotros',body:'Primero'}});assert.equal(note.status,201);
  assert.equal((await api('/api/bond','POST',{type:'gesture',data:{gesture:'hug',answer:'secret'}})).status,400);
  const ritual={week:'2026-09-28',gratitude:'Gracias',need:'Tiempo',plan:'Paseo'};
  assert.equal((await api('/api/bond','POST',{type:'ritual',data:ritual})).status,201);
  assert.equal((await api('/api/bond','POST',{type:'ritual',data:ritual})).status,409);
  const switched=await api('/api/demo-person','POST',{person:'1'});cookie=switched.cookie.split(';')[0];csrf=(await state()).csrf;
  const hidden=await api('/api/bond');assert.equal(hidden.data.entries.find(e=>e.id===quiz.data.id).data.answer,undefined);
  assert.equal((await api('/api/bond/'+quiz.data.id+'/guess','POST',{guess:'Un abrazo'})).data.data.correct,true);
  assert.equal((await api('/api/bond/'+quiz.data.id+'/guess','POST',{guess:'Un abrazo'})).status,409);
  assert.equal((await api('/api/bond/'+note.data.id,'PUT',{version:1,data:{title:'Nosotros',body:'Juntos'}})).status,200);
  assert.equal((await api('/api/bond/'+note.data.id,'PUT',{version:1,data:{title:'Nosotros',body:'Perdido'}})).status,409);
  assert.equal((await api('/api/bond','POST',{type:'gesture',data:{gesture:'kiss'}})).status,201);
  assert.equal((await api('/api/bond')).data.garden.days,1);
  assert.equal((await api('/api/bond/widget','POST',{photoPath:'https://evil.test/p.jpg'})).status,400);
  assert.equal((await api('/api/export')).data.bond.entries.find(e=>e.id===note.data.id).data.body,'Juntos');
  assert.equal((await api('/api/bond/'+quiz.data.id,'DELETE',{version:2})).status,403);
  const gesture=(await api('/api/bond')).data.entries.find(e=>e.type==='gesture');
  assert.equal((await api('/api/bond/'+gesture.id,'DELETE',{version:gesture.version})).status,200);
  assert.equal((await api('/api/bond')).data.garden.days,1);
  assert.equal((await api('/api/bond','POST',{type:'voice',data:{title:'Falso',body:'',audioPath:'1/00000000-0000-0000-0000-000000000000.mp3',mime:'audio/mpeg'}})).status,400);
 }finally{await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
test('bond audio checks signature, header, limit and private playback',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'bond-audio-')),port=4298,base=`http://localhost:${port}`;
 const {server,store}=await createApp(configuration({PORT:String(port),BASE_URL:base,DATA_DIR:dir},true));await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{
  const cookie=(await fetch(base)).headers.get('set-cookie').split(';')[0],s=await(await fetch(base+'/api/state',{headers:{Cookie:cookie}})).json();
  const headers={Cookie:cookie,Origin:base,'X-CSRF-Token':s.csrf,'Content-Type':'audio/mpeg','X-File-Name':'voz.mp3'};
  assert.equal((await fetch(base+'/api/bond/audio',{method:'POST',headers,body:'not audio'})).status,400);
  assert.equal((await fetch(base+'/api/bond/audio',{method:'POST',headers,body:Buffer.alloc(5242881)})).status,413);
  const bytes=Buffer.from([73,68,51,4,0,0,0,0,0,1,0]);
  assert.equal((await fetch(base+'/api/bond/audio',{method:'POST',headers:{...headers,'Content-Type':'audio/ogg'},body:bytes})).status,400);
  const r=await fetch(base+'/api/bond/audio',{method:'POST',headers,body:bytes});assert.equal(r.status,201);const audio=await r.json();assert.match(audio.path,/^0\/[a-f0-9-]+\.mp3$/);
  const voiceHeaders={...headers,'Content-Type':'application/json'};
  assert.equal((await fetch(base+'/api/bond',{method:'POST',headers:voiceHeaders,body:JSON.stringify({type:'voice',data:{title:'Te pienso',body:'Con cariño',audioPath:audio.path,mime:audio.mime}})})).status,201);
  assert.equal((await fetch(base+'/api/bond',{method:'POST',headers:voiceHeaders,body:JSON.stringify({type:'voice',data:{title:'Te pienso',body:'',audioPath:audio.path,mime:audio.mime,referenceId:'not-existing'}})})).status,400);
  const page=await fetch(base+'/',{headers:{Cookie:cookie}});assert.match(page.headers.get('content-security-policy'),/media-src 'self' blob:/);
  const play=await(await fetch(base+'/api/bond/audio/'+encodeURIComponent(audio.path),{headers:{Cookie:cookie}})).json();
  assert.deepEqual(Buffer.from(await(await fetch(base+play.url,{headers:{Cookie:cookie}})).arrayBuffer()),bytes);
 }finally{await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
test('garden participation survives item deletion and a reopened store',async()=>{
 const {openStore}=await import('../app/store.mjs'),{bondStore}=await import('../app/bond-store.mjs');
 const dir=mkdtempSync(path.join(os.tmpdir(),'bond-garden-'));let store=openStore(dir);
 try{let bond=bondStore(store.db);store.db.prepare('DELETE FROM items').run();
  store.saveDaily('2025-01-01','0','mood','feliz');store.saveDaily('2025-01-01','1','answer','Gracias');
  const note=bond.add('sharednote',{title:'Persistente',body:'Nuestro plan'},'0');
  const id=store.add({kind:'plan',title:'Pasear'},'1');assert.equal(bond.read('0').garden.days,2);
  store.remove(id,1);store.db.prepare('DELETE FROM daily').run();store.close();store=openStore(dir);bond=bondStore(store.db);
  assert.equal(bond.read('1').garden.days,2);
  assert.equal(bond.read('1').entries.find(e=>e.id===note.id).data.body,'Nuestro plan');
 }finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
