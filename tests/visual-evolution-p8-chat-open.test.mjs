import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';

const app=readFileSync(resolve(import.meta.dirname,'../android/app/src/main/assets/mobile/app.js'),'utf8');
const begin=app.indexOf('async function openGalaxyChat(){');
const end=app.indexOf("chatFab?.addEventListener('click'",begin);
assert.ok(begin>0&&end>begin,'The shared authenticated Chat handler must be extractable');
const branch=app.slice(begin,end);

function harness({locked=false,unlockError=null}={}){
 const calls=[],timers=[],state={
  a:'chat-open',chatOpenPending:false,chatOpenPhase:'idle',chatUnlockedSession:false,
  native:{paired:true,chatLockEnabled:locked},view:'more',
  cloud:{capabilities:{chat:true}},
  window:{GalaxyChatPerf:{beginOpen:(kind)=>calls.push(['perf',kind])}},
  chatState:null,
  chatScrollEngine:{clearMemory:()=>calls.push(['clear'])},
  chatRestoreOnRender:false,chatInitialScroll:false,
  GalaxyNative:{call:async name=>{calls.push(['native',name]);if(unlockError)throw unlockError;}},
  setTimeout:(callback)=>{timers.push(callback);return timers.length;},
  go:view=>calls.push(['go',view]),
  setChatPresence:value=>calls.push(['presence',value]),
  loadChat:async opts=>{calls.push(['load',opts.force]);},
  flushChatOutbox:()=>{calls.push(['flush']);return Promise.resolve();},
 };
 const context=vm.createContext(state);
 const action=vm.runInContext(branch+';openGalaxyChat',context);
 return {calls,timers,state,context,action};
}

test('P8 Chat FAB leaves the native click stack before rendering once',async()=>{
 const h=harness();
 const first=h.action();
 assert.equal(h.state.chatOpenPending,true);
 assert.equal(h.calls.length,0,'the real click must not synchronously run heavyweight rendering');
 await h.action();
 assert.equal(h.timers.length,1,'double clicks must not queue duplicate chat mounts');
 assert.equal(h.calls.length,0);
 h.timers.shift()();
 await first;
 assert.equal(h.state.chatOpenPending,false);
 assert.equal(h.calls.filter(x=>x[0]==='go').length,1);
 assert.deepEqual(h.calls.map(x=>x[0]),['perf','clear','go','presence','load','flush']);
 assert.deepEqual(h.calls.find(x=>x[0]==='go'),['go','chat']);
 assert.equal(h.state.chatInitialScroll,true);
});

test('P8 Chat FAB does not bypass a failing device unlock',async()=>{
 const h=harness({locked:true,unlockError:new Error('Device auth unavailable')});
 await assert.rejects(h.action(),/Device auth unavailable/);
 assert.equal(h.state.chatOpenPending,false);
 assert.equal(h.state.chatUnlockedSession,false);
 assert.equal(h.timers.length,0);
 assert.equal(h.calls.some(x=>x[0]==='go'),false);
});

test('P8 Chat FAB abandons route after pairing is revoked mid-click',async()=>{
 const h=harness();
 const pending=h.action();
 h.state.native.paired=false;
 h.timers.shift()();
 await pending;
 assert.equal(h.state.chatOpenPending,false);
 assert.equal(h.calls.some(x=>x[0]==='go'),false);
});

test('P8 Chat FAB does not steal navigation if the user changes screens first',async()=>{
 const h=harness();
 const pending=h.action();
 h.state.view='map';
 h.timers.shift()();
 await pending;
 assert.equal(h.state.chatOpenPending,false);
 assert.equal(h.calls.some(x=>x[0]==='go'),false);
});

test('P8 persistent Chat FAB dispatches a single authenticated action before document delegation',async()=>{
 const h=harness();
 const start=app.indexOf("chatFab?.addEventListener('click'");
 const end=app.indexOf("document.addEventListener('click'",start);
 assert.ok(start>=0&&end>start);
 let click,stopped=false;
 h.state.chatFab={addEventListener:(name,cb)=>{assert.equal(name,'click');click=cb;}};
 h.state.toast=()=>{throw new Error('Unexpected Chat FAB error toast')};
 vm.runInContext(app.slice(start,end),h.context);
 click({stopPropagation:()=>{stopped=true;}});
 assert.equal(stopped,true);
 assert.equal(h.state.chatOpenPending,true);
 assert.equal(h.timers.length,1);
 h.timers.shift()();
 await new Promise(r=>setImmediate(r));
 assert.equal(h.calls.filter(x=>x[0]==='go').length,1);
 assert.equal(h.state.chatOpenPending,false);
 assert.equal(h.state.chatOpenPhase,'ready');
});
test('P8 native Chat timeout telemetry is state-only and includes open progress',()=>{
 const java=readFileSync(resolve(import.meta.dirname,'../android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 assert.match(java,/chatOpenPending:!!chatOpenPending/);
 assert.match(java,/chatOpenPhase:String\(chatOpenPhase/);
 assert.match(java,/chatLockEnabled:!!native.chatLockEnabled/);
 assert.match(app,/if\(a==='chat-open'\)\{await openGalaxyChat\(\);return;\}/);
});
