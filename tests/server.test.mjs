import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp,configuration} from '../app/server.mjs';
test('production requires two users, secrets, HTTPS and forbids demo',()=>{
 assert.throws(()=>configuration({NODE_ENV:'production'},true));
 assert.throws(()=>configuration({},false));
 assert.throws(()=>configuration({GOOGLE_CLIENT_ID:'x',GOOGLE_CLIENT_SECRET:'x',ALLOWED_EMAILS:'a,a',TOKEN_KEY:'a'.repeat(64)},false));
});
test('private mode denies unauthenticated data, photos and original gift',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'galaxia-private-')),port=4193,base=`http://localhost:${port}`;
 const config=configuration({PORT:String(port),BASE_URL:base,DATA_DIR:dir,GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret',ALLOWED_EMAILS:'one@example.test,two@example.test',TOKEN_KEY:'a'.repeat(64)},false);
 const {server,store}=await createApp(config);await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try{
  for(const route of ['/api/state','/api/export','/media/test','/regalo/'])assert.equal((await fetch(base+route)).status,401);
  const auth=await fetch(base+'/auth/google',{redirect:'manual'});assert.equal(auth.status,302);const url=new URL(auth.headers.get('location'));assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal((await fetch(base+'/auth/callback?state=wrong&code=wrong')).status,403);
  assert.equal((await fetch(base+'/.env')).status,404);
 }finally{await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
test('API: CSRF, persistence, hidden answers, validation and private routes',async()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'galaxia-api-')),port=4192,base=`http://localhost:${port}`;
 const config=configuration({PORT:String(port),BASE_URL:base,DATA_DIR:dir},true);const {server,store}=await createApp(config);await new Promise(r=>server.listen(port,'127.0.0.1',r));
 try {
  const initial=await fetch(base);let cookie=initial.headers.get('set-cookie').split(';')[0];
  const state=await(await fetch(base+'/api/state',{headers:{Cookie:cookie}})).json();
  const headers={Cookie:cookie,Origin:base,'X-CSRF-Token':state.csrf,'Content-Type':'application/json'};
  let r=await fetch(base+'/api/items',{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({kind:'note',title:'bad'})});assert.equal(r.status,403);
  r=await fetch(base+'/api/items',{method:'POST',headers,body:JSON.stringify({kind:'song',title:'x',url:'https://evil.test'})});assert.equal(r.status,400);
  r=await fetch(base+'/api/daily',{method:'POST',headers,body:JSON.stringify({field:'answer',value:'Mi respuesta privada'})});assert.equal(r.status,200);
  r=await fetch(base+'/api/demo-person',{method:'POST',headers,body:JSON.stringify({person:'1'})});cookie=r.headers.get('set-cookie').split(';')[0];
  const partner=await(await fetch(base+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(partner.person,'1');assert.equal(partner.daily[0].answer,null);assert.equal(partner.daily[0].answered,true);
  r=await fetch(base+'/api/daily',{method:'POST',headers:{...headers,Cookie:cookie,'X-CSRF-Token':partner.csrf},body:JSON.stringify({field:'answer',value:'La otra respuesta'})});assert.equal(r.status,200);
  const revealed=await(await fetch(base+'/api/state',{headers:{Cookie:cookie}})).json();assert.equal(revealed.allAnswered,true);assert.equal(revealed.daily.length,2);assert.ok(revealed.daily.every(d=>d.answer));
  r=await fetch(base+'/api/photos/upload',{method:'POST',headers:{...headers,Cookie:cookie,'X-CSRF-Token':partner.csrf,'Content-Type':'application/octet-stream'},body:'<svg onload="alert(1)"></svg>'});assert.equal(r.status,400);
  r=await fetch(base+'/api/items',{method:'POST',headers:{...headers,Cookie:cookie,'X-CSRF-Token':partner.csrf},body:JSON.stringify({kind:'plan',title:'Una tarde juntos'})});assert.equal(r.status,201);
  assert.equal(store.list().length,7);
  r=await fetch(base+'/api/picker',{method:'POST',headers:{...headers,Cookie:cookie,'X-CSRF-Token':partner.csrf},body:'{}'});assert.equal(r.status,409);
  r=await fetch(base+'/.env',{headers:{Cookie:cookie}});assert.equal(r.status,404);
 } finally {await new Promise(r=>server.close(r));store.close();rmSync(dir,{recursive:true,force:true});}
});
