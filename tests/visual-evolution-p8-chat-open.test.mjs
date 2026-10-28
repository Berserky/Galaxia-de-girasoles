import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';

const app=readFileSync(resolve(import.meta.dirname,'../android/app/src/main/assets/mobile/app.js'),'utf8');
const begin=app.indexOf("  if(a==='chat-open'){");
const end=app.indexOf("  if(a==='chat-close')",begin);
assert.ok(begin>0&&end>begin,'The authenticated Chat action must be extractable');
const branch=app.slice(begin,end);

function harness({locked=false,unlockError=null}={}){
 const calls=[],timers=[],state={
  a:'chat-open',chatOpenPending:false,chatUnlockedSession:false,
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
 const action=vm.runInContext('(async function(){'+branch+'})',context);
 return {calls,timers,state,action};
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
