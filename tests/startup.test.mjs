import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('a stalled service worker registration cannot block login',async()=>{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{register:()=>new Promise(()=>{})}}});
 globalThis.matchMedia=()=>({matches:true});
 globalThis.document={documentElement:{classList:{add(){}}}};
 const source=await readFile(new URL('../app/public/install.js',import.meta.url),'utf8');
 const {setupPwa}=await import('data:text/javascript,'+encodeURIComponent(source));
 const result=await Promise.race([setupPwa(()=>assert.fail('installed app should not show install gate')),new Promise(resolve=>setTimeout(()=>resolve('stalled'),50))]);
 assert.equal(result,false);
});



test('session waits end with a retryable error',async()=>{
 const {withTimeout}=await import('../app/public/network.js');
 await assert.rejects(withTimeout(new Promise(()=>{}),10),/conexión tardó demasiado/);
 assert.equal(await withTimeout(Promise.resolve('session'),10),'session');
});

test('failed module loading leaves a retry button without clearing session',async()=>{
 const {runInNewContext}=await import('node:vm');
 const source=await readFile(new URL('../app/public/startup.js',import.meta.url),'utf8');
 let expire,reloads=0;
 const button={},app={innerHTML:'',querySelector:()=>true};
 runInNewContext(source,{document:{querySelector:s=>s==='#app'?app:button},setTimeout:fn=>{expire=fn;},clearTimeout(){},MutationObserver:class{observe(){} disconnect(){}},location:{reload(){reloads++;}}});
 expire();
 assert.match(app.innerHTML,/Volver a intentar/);
 button.onclick();
 assert.equal(reloads,1);
});
