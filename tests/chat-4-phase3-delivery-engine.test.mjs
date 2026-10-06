import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const deliverySource=readFileSync('android/app/src/main/assets/mobile/chat-delivery-engine.js','utf8');
const messageSource=readFileSync('android/app/src/main/assets/mobile/chat-message-engine.js','utf8');
const appSource=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');
const indexSource=readFileSync('android/app/src/main/assets/mobile/index.html','utf8');

const clone=value=>JSON.parse(JSON.stringify(value));
const cid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const local=(n,extra={})=>({client_id:cid(n),client_created_at:'2026-10-05T19:00:00-05:00',body:'m'+n,message_type:'text',_localState:'PENDING',retryCount:0,local_order:n,...extra});
const httpError=(status,message)=>Object.assign(new Error(message||('HTTP '+status)),{status});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};

function deliveryRuntime({seed=[],online=true,send=null,sharedServer=null,user='0'}={}){
 const context={window:{},setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(deliverySource,context);
 let persisted=clone(seed),isOnline=online,clock=1000,timer=null,sendCalls=0,active=0,maxActive=0,seq=sharedServer?.seq||0;
 const server=sharedServer?.rows||new Map(),changes=[],confirms=[],metrics=[];
 const defaultSend=async item=>{
  sendCalls++;active++;maxActive=Math.max(maxActive,active);
  try{
   const key=user+'|'+item.client_id;
   if(server.has(key))return {message:server.get(key),idempotent:true};
   const nextSeq=sharedServer?++sharedServer.seq:++seq;
   const row={...item,id:'s-'+item.client_id,client_id:item.client_id,sender_person:user,server_seq:nextSeq,created_at:new Date().toISOString(),status:'SENT'};
   server.set(key,row);
   return {message:row,idempotent:false};
  }finally{active--;}
 };
 const engine=context.window.GalaxyDeliveryEngine.create({
  load:()=>clone(persisted),save:rows=>{persisted=clone(rows);},online:()=>isOnline,now:()=>clock,
  setTimer:(fn,ms)=>{timer={fn,ms};return timer;},clearTimer:id=>{if(timer===id)timer=null;},
  send:send||defaultSend,onChange:e=>changes.push(clone(e)),onConfirm:(m,meta)=>confirms.push({message:clone(m),meta:clone(meta)}),onMetric:m=>metrics.push(clone(m)),
  baseDelayMs:100,maxDelayMs:1000,maxRetries:4
 });
 return {
  engine,server,changes,confirms,metrics,
  rows:()=>clone(persisted),setOnline:v=>{isOnline=v;},isOnline:()=>isOnline,
  clock:()=>clock,advance:ms=>{clock+=ms;},timer:()=>timer,fireTimer:async()=>{const t=timer;timer=null;if(t)await t.fn();},
  sendCalls:()=>sendCalls,maxActive:()=>maxActive
 };
}

function messageEngine(){
 const context={window:{}};vm.createContext(context);vm.runInContext(messageSource,context);
 return context.window.GalaxyMessageEngine.create({pageSize:60,maxCache:420,windowSize:84,windowStep:28,estimatedHeight:92});
}

test('Phase 3 delivery engine loads before app and app owns the integration',()=>{
 const delivery=indexSource.indexOf('chat-delivery-engine.js'),app=indexSource.indexOf('./app.js');
 assert.ok(delivery>0&&app>delivery);
 assert.equal(indexSource.includes('chat-delivery-integration.js'),false);
 assert.ok(appSource.includes('window.GalaxyDeliveryEngine.create')&&appSource.includes('chatDeliveryEngine=createChatDeliveryEngine()'));
});

test('1. successful send converges from pending to one confirmed server message',async()=>{
 const h=deliveryRuntime();h.engine.queue(local(1));await h.engine.flush();
 assert.equal(h.rows().length,0);assert.equal(h.server.size,1);assert.equal(h.confirms.length,1);
 assert.ok(h.changes.some(x=>x.type==='sending'));assert.ok(h.changes.some(x=>x.type==='sent'));
});

test('2. optimistic message exists synchronously before transport confirmation',async()=>{
 const gate=deferred();let entered=false;
 const h=deliveryRuntime({send:async item=>{entered=true;return gate.promise;}});
 h.engine.queue(local(2));const flushing=h.engine.flush();
 assert.equal(h.rows().length,1);assert.equal(h.rows()[0]._localState,'SENDING');assert.equal(entered,true);
 gate.resolve({message:{...local(2),id:'s2',sender_person:'0',server_seq:2},idempotent:false});await flushing;
 assert.equal(h.rows().length,0);
});

test('3. API before realtime leaves one logical message',async()=>{
 const h=deliveryRuntime();h.engine.queue(local(3));await h.engine.flush();
 const confirmed=h.confirms[0].message;
 assert.equal(h.engine.reconcile(confirmed,{source:'realtime'}),false);
 assert.equal(h.server.size,1);assert.equal(h.rows().length,0);
});

test('4. realtime before API removes optimistic row and late API cannot duplicate it',async()=>{
 const gate=deferred(),serverMessage={...local(4),id:'s4',sender_person:'0',server_seq:4};
 const h=deliveryRuntime({send:async()=>gate.promise});
 h.engine.queue(local(4));const flushing=h.engine.flush();await Promise.resolve();
 assert.equal(h.engine.reconcile(serverMessage,{source:'realtime'}),true);assert.equal(h.rows().length,0);
 gate.resolve({message:serverMessage,idempotent:true});await flushing;
 assert.equal(h.rows().length,0);assert.equal(h.confirms.length,1);
});

test('5. timeout after persistence retries same client id without a second persisted message',async()=>{
 const server=new Map();let first=true,calls=0;
 const h=deliveryRuntime({send:async item=>{
  calls++;const key=item.client_id;
  if(first){first=false;server.set(key,{...item,id:'persisted',sender_person:'0',server_seq:1});throw new Error('timeout');}
  return {message:server.get(key),idempotent:true};
 }});
 h.engine.queue(local(5));await h.engine.flush();assert.equal(h.rows()[0]._localState,'FAILED');assert.equal(server.size,1);
 h.advance(1000);await h.engine.flush();assert.equal(h.rows().length,0);assert.equal(server.size,1);assert.equal(calls,2);
});

test('6. timeout without persistence remains recoverable and later creates exactly one message',async()=>{
 let first=true,persisted=0;
 const h=deliveryRuntime({send:async item=>{if(first){first=false;throw new Error('timeout');}persisted++;return {message:{...item,id:'ok6',sender_person:'0',server_seq:6},idempotent:false};}});
 h.engine.queue(local(6));await h.engine.flush();assert.equal(h.rows()[0]._localState,'FAILED');
 h.advance(1000);await h.engine.flush();assert.equal(h.rows().length,0);assert.equal(persisted,1);
});

test('7. manual retry reuses stable client id',async()=>{
 let fail=true,seen=[];
 const h=deliveryRuntime({send:async item=>{seen.push(item.client_id);if(fail){fail=false;throw httpError(503,'Temporal');}return {message:{...item,id:'ok7',sender_person:'0',server_seq:7}};}});
 h.engine.queue(local(7));await h.engine.flush();assert.equal(h.rows()[0]._localState,'FAILED');
 await h.engine.retry(cid(7));assert.deepEqual(seen,[cid(7),cid(7)]);assert.equal(h.rows().length,0);
});

test('8. offline before send keeps message pending and performs no transport call',async()=>{
 const h=deliveryRuntime({online:false});h.engine.queue(local(8));await h.engine.flush();
 assert.equal(h.rows()[0]._localState,'PENDING');assert.equal(h.sendCalls(),0);
});

test('9. connection loss during send returns in-flight message to pending',async()=>{
 let h;h=deliveryRuntime({send:async()=>{h.setOnline(false);throw new Error('network disconnected');}});
 h.engine.queue(local(9));await h.engine.flush();
 assert.equal(h.rows()[0]._localState,'PENDING');assert.equal(h.rows()[0].retryable,true);
});

test('10. reconnect flushes pending work and converges',async()=>{
 const h=deliveryRuntime({online:false});h.engine.queue(local(10));await h.engine.flush();h.setOnline(true);await h.engine.kick();
 assert.equal(h.rows().length,0);assert.equal(h.server.size,1);
});

test('11. kill with SENDING work recovers it to PENDING on next engine creation',()=>{
 const h=deliveryRuntime({seed:[local(11,{_localState:'SENDING'})],online:false});
 assert.equal(h.rows()[0]._localState,'PENDING');
});

test('12. restart with persisted PENDING work can resume safely',async()=>{
 const shared={rows:new Map(),seq:0};const h=deliveryRuntime({seed:[local(12)],sharedServer:shared});
 await h.engine.flush();assert.equal(h.rows().length,0);assert.equal(shared.rows.size,1);
});

test('13. duplicate queue/idempotency key never schedules two local operations',async()=>{
 const h=deliveryRuntime();h.engine.queue(local(13));h.engine.queue({...local(13),body:'ignored duplicate'});
 assert.equal(h.rows().length,1);await h.engine.flush();assert.equal(h.server.size,1);assert.equal(h.sendCalls(),1);
});

test('14. duplicate realtime event is discarded after first reconciliation',()=>{
 const h=deliveryRuntime({seed:[local(14)],online:false}),remote={...local(14),id:'s14',server_seq:14};
 assert.equal(h.engine.reconcile(remote),true);assert.equal(h.engine.reconcile(remote),false);assert.equal(h.rows().length,0);
});

test('15. out-of-order confirmed events are sorted deterministically by server_seq',()=>{
 const e=messageEngine(),state={messages:[]};
 const a={id:'a',client_id:'ca',server_seq:15,sender_person:'0'},b={id:'b',client_id:'cb',server_seq:13,sender_person:'1'},c={id:'c',client_id:'cc',server_seq:14,sender_person:'0'};
 const merged=e.applySingle(e.applySingle(e.applySingle(state,a),b),c);
 assert.deepEqual(Array.from(merged.messages,x=>x.server_seq),[13,14,15]);
});

test('16. burst of 20 messages is backpressured through one sequential sender',async()=>{
 let active=0,max=0,seq=0;
 const h=deliveryRuntime({send:async item=>{active++;max=Math.max(max,active);await Promise.resolve();active--;return {message:{...item,id:'b'+(++seq),sender_person:'0',server_seq:seq}};}});
 for(let i=100;i<120;i++)h.engine.queue(local(i));
 await h.engine.flush();assert.equal(h.rows().length,0);assert.equal(max,1);assert.equal(seq,20);
});

test('17. two users can send simultaneously while server sequence stays unique',async()=>{
 const shared={rows:new Map(),seq:0},a=deliveryRuntime({sharedServer:shared,user:'0'}),b=deliveryRuntime({sharedServer:shared,user:'1'});
 for(let i=200;i<210;i++)a.engine.queue(local(i));
 for(let i=300;i<310;i++)b.engine.queue(local(i));
 await Promise.all([a.engine.flush(),b.engine.flush()]);
 const seqs=[...shared.rows.values()].map(x=>x.server_seq);
 assert.equal(shared.rows.size,20);assert.equal(new Set(seqs).size,20);assert.equal(a.rows().length+b.rows().length,0);
});

test('18. attachment failure keeps safe retryable content visible and never marks it sent',async()=>{
 const h=deliveryRuntime({send:async()=>{throw httpError(422,'Adjunto inválido');}});
 h.engine.queue(local(18,{message_type:'photo',attachments:[{kind:'photo',path:'0/x.jpg'}]}));await h.engine.flush();
 const row=h.rows()[0];assert.equal(row._localState,'FAILED');assert.equal(row.retryable,false);assert.equal(row.attachments.length,1);assert.equal(h.confirms.length,0);
});

test('19. authorization error is permanent and is not retried automatically',async()=>{
 let calls=0;const h=deliveryRuntime({send:async()=>{calls++;throw httpError(403,'Sin permiso');}});
 h.engine.queue(local(19));await h.engine.flush();assert.equal(h.rows()[0]._localState,'FAILED');assert.equal(h.rows()[0].retryable,false);
 h.advance(5000);await h.engine.flush();assert.equal(calls,1);
});

test('20. pagination plus realtime keeps server_seq order and reconciles optimistic row',()=>{
 const e=messageEngine();
 let state=e.applyPage({messages:[]},{messages:Array.from({length:60},(_,i)=>({id:'m'+(i+61),client_id:'c'+(i+61),server_seq:i+61,sender_person:String(i%2)})),nextBeforeSeq:61},{direction:'latest'});
 state=e.applyPage(state,{messages:Array.from({length:60},(_,i)=>({id:'m'+(i+1),client_id:'c'+(i+1),server_seq:i+1,sender_person:String(i%2)})),nextBeforeSeq:1},{direction:'older'});
 state=e.applySingle(state,{id:'m121',client_id:cid(20),server_seq:121,sender_person:'1'});
 const seqs=Array.from(state.messages,x=>x.server_seq);assert.deepEqual(seqs,[...seqs].sort((a,b)=>a-b));assert.equal(new Set(seqs).size,seqs.length);
 const h=deliveryRuntime({seed:[local(20)],online:false});assert.equal(h.engine.reconcile({client_id:cid(20),server_seq:121}),true);
});

test('50 repeated/out-of-order realtime events collapse to unique deterministic messages',()=>{
 const e=messageEngine();let state={messages:[]};
 const events=Array.from({length:50},(_,i)=>({id:'rt'+(i%25),client_id:'rtc'+(i%25),server_seq:(i%25)+1,sender_person:String(i%2)})).reverse();
 for(const row of events)state=e.applySingle(state,row);
 assert.equal(state.messages.length,25);assert.deepEqual(Array.from(state.messages,x=>x.server_seq),Array.from({length:25},(_,i)=>i+1));
});

test('transient retry uses bounded exponential backoff while permanent errors schedule none',async()=>{
 const h=deliveryRuntime({send:async()=>{throw httpError(503,'Temporal');}});h.engine.queue(local(21));await h.engine.flush();
 assert.equal(h.rows()[0].nextAttemptAt,1100);assert.equal(h.engine.backoff(2),200);assert.equal(h.engine.backoff(20),1000);
 const p=deliveryRuntime({send:async()=>{throw httpError(400,'Inválido');}});p.engine.queue(local(22));await p.engine.flush();assert.equal(p.rows()[0].nextAttemptAt,null);
});

test('delivery diagnostics never log message bodies or attachment URLs',()=>{
 assert.equal(/console\.(log|info|warn|error)/.test(deliverySource),false);
});
