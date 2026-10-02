import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../app/public/sw.js',import.meta.url),'utf8');
function harness(caches){const handlers={};vm.runInNewContext(source,{self:{addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}}},location:{origin:'https://galaxy.test'},URL,caches,fetch:async()=>{throw Error('offline');}});return handlers;}
test('service worker never intercepts authenticated voice or photo media',()=>{
 const handlers=harness({match:async()=>null});
 for(const path of ['/media/voice/0/example.mp3','/media/example-photo','/api/bond','/auth/google']){
  let intercepted=false;handlers.fetch({request:{method:'GET',url:'https://galaxy.test'+path,mode:'cors'},respondWith:()=>intercepted=true});assert.equal(intercepted,false,path);
 }
});
test('activation removes historical private media from the current shell cache',async()=>{
 const deleted=[],media={url:'https://galaxy.test/media/voice/private.webm'},shell={url:'https://galaxy.test/app.js'};
 const handlers=harness({keys:async()=>['galaxia-shell-v49'],delete:async()=>true,open:async()=>({keys:async()=>[media,shell],delete:async request=>deleted.push(request.url)})});
 let work;handlers.activate({waitUntil:p=>work=p});await work;assert.deepEqual(deleted,[media.url]);
});
