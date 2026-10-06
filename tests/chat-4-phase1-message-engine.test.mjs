import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const engineSource=readFileSync('android/app/src/main/assets/mobile/chat-message-engine.js','utf8');
const app=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');
const edge=readFileSync('supabase/functions/android-companion/index.ts','utf8');
const index=readFileSync('android/app/src/main/assets/mobile/index.html','utf8');
const css=readFileSync('android/app/src/main/assets/mobile/app.css','utf8');

function engine(options={}){
 const context={window:{}};
 vm.createContext(context);
 vm.runInContext(engineSource,context);
 return context.window.GalaxyMessageEngine.create(options);
}
const rows=(from,count,extra={})=>Array.from({length:count},(_,i)=>({
 id:'m'+(from+i),client_id:'c'+(from+i),server_seq:from+i,
 sender_person:String((from+i)%2),body:'Mensaje '+(from+i),
 created_at:new Date(2026,0,1,0,0,from+i).toISOString(),
 message_type:'text',attachments:[],...extra
}));
function block(source,start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'missing block '+start);
 return source.slice(i,j);
}

test('phase1 runtime is loaded before app.js',()=>{
 assert.ok(index.indexOf('chat-message-engine.js')>index.indexOf('chat-perf.js'));
 assert.ok(index.indexOf('chat-message-engine.js')<index.indexOf('app.js'));
 assert.match(css,/\.chat-virtual-spacer\{/);
});

test('initial load is bounded independently from total conversation size',()=>{
 for(const total of [100,500,5000,20000]){
  const e=engine(),page=rows(total-59,60);
  const state=e.applyPage(null,{messages:page,nextBeforeSeq:total-59},{direction:'latest'});
  e.resetWindow(state.messages.length,{align:'end'});
  const range=e.range(state.messages);
  assert.equal(state.messages.length,60);
  assert.ok(range.messages.length<=84);
  assert.equal(e.maxSeq(state.messages),total);
 }
});

test('backward cursor pagination merges multiple pages without duplicates or holes',()=>{
 const e=engine({maxCache:420});
 let state=e.applyPage(null,{messages:rows(4941,60),nextBeforeSeq:4941},{direction:'latest'});
 state=e.applyPage(state,{messages:rows(4881,60),nextBeforeSeq:4881},{direction:'older'});
 state=e.applyPage(state,{messages:rows(4821,60),nextBeforeSeq:4821},{direction:'older'});
 const seqs=Array.from(state.messages,x=>x.server_seq);
 assert.equal(seqs.length,180);
 assert.deepEqual(seqs,Array.from({length:180},(_,i)=>4821+i));
 assert.equal(new Set(seqs).size,seqs.length);
 assert.equal(state.nextBeforeSeq,4821);
});

test('cache remains bounded while historical navigation continues',()=>{
 const e=engine({maxCache:420});
 let state=e.applyPage(null,{messages:rows(19941,60),nextBeforeSeq:19941},{direction:'latest'});
 for(let end=19940;end>=19000;end-=60){
  state=e.applyPage(state,{messages:rows(end-59,60),nextBeforeSeq:end-59},{direction:'older'});
  assert.ok(state.messages.length<=420);
 }
 e.resetWindow(state.messages.length,{align:'start'});
 assert.ok(e.range(state.messages).messages.length<=84);
});

test('Realtime during pagination reconciles by id/client_id and preserves server_seq order',()=>{
 const e=engine();
 let state=e.applyPage(null,{messages:rows(941,60),nextBeforeSeq:941},{direction:'latest'});
 state=e.applyPage(state,{messages:rows(881,60),nextBeforeSeq:881},{direction:'older'});
 const incoming={...rows(1001,1)[0],client_id:'optimistic-1'};
 state=e.applySingle(state,incoming);
 state=e.applySingle(state,{...incoming,body:'Reconciliado'});
 assert.equal(state.messages.filter(x=>x.id==='m1001').length,1);
 assert.equal(state.messages.at(-1).server_seq,1001);
 assert.equal(state.messages.at(-1).body,'Reconciliado');
});

test('incremental sync cannot grow loaded memory beyond the cache bound',()=>{
 const e=engine({maxCache:420});
 let state={messages:rows(1,420)};
 for(let seq=421;seq<=900;seq++)state=e.applySingle(state,rows(seq,1)[0]);
 assert.equal(state.messages.length,420);
 assert.equal(state.messages.at(-1).server_seq,900);
});

test('client optimistic event and server confirmation deduplicate by client_id',()=>{
 const e=engine();
 let state={messages:[{id:'local:x',client_id:'x',server_seq:null,local_order:1,client_created_at:'2026-10-05T12:00:00Z'}]};
 state=e.applySingle(state,{id:'server-x',client_id:'x',server_seq:10,created_at:'2026-10-05T12:00:01Z'});
 assert.equal(state.messages.length,1);
 assert.equal(state.messages[0].id,'server-x');
 assert.equal(state.messages[0].server_seq,10);
});

test('server_seq is the primary deterministic order key',()=>{
 const e=engine();
 const unordered=[
  {id:'b',server_seq:2,created_at:'2026-01-01T00:00:00Z'},
  {id:'a',server_seq:1,created_at:'2026-12-01T00:00:00Z'},
  {id:'c',server_seq:2,created_at:'2026-01-01T00:00:01Z'}
 ];
 const sorted=e.mergeMessages([],unordered);
 assert.deepEqual(Array.from(sorted,x=>x.id),['a','b','c']);
});

test('20k logical history never requires a 20k rendered window',()=>{
 const e=engine();
 const logical=rows(1,20000);
 e.resetWindow(logical.length,{align:'end'});
 let range=e.range(logical);
 assert.equal(range.messages.length,84);
 assert.ok(range.topPx>0);
 e.shift(logical.length,-1);
 range=e.range(logical);
 assert.equal(range.messages.length,84);
 assert.ok(range.start<20000-84);
});

test('mixed variable-height message types are preserved by windowing',()=>{
 const e=engine();
 const kinds=['text','photo','video','audio','card','location','system'];
 const mixed=rows(1,140).map((m,i)=>({...m,message_type:kinds[i%kinds.length],attachments:i%3?[{kind:'photo'}]:[],card:i%5?null:{type:'PLAN'}}));
 e.resetWindow(mixed.length,{align:'end'});
 const r=e.range(mixed);
 for(const m of r.messages)e.measure(e.messageKey(m),48+(m.server_seq%9)*37);
 const after=e.range(mixed);
 assert.equal(after.messages.length,84);
 assert.ok(after.topPx>0);
 assert.ok(after.averageHeight>48);
});

test('server exposes stable before/after/around/single server_seq cursor paths',()=>{
 const chatState=block(edge,'async function chatState(','async function chatAttachmentClaimProblem');
 for(const marker of ['beforeSeq','afterSeq','aroundId','messageId','nextBeforeSeq','nextAfterSeq','server_seq'])assert.ok(chatState.includes(marker),marker);
 assert.ok(chatState.includes('.lt("server_seq",beforeSeq)'));
 assert.ok(chatState.includes('.gt("server_seq",afterSeq)'));
 assert.ok(chatState.includes('.order("server_seq",{ascending:false})'));
 assert.ok(chatState.includes('.order("server_seq",{ascending:true})'));
 assert.equal(chatState.includes('.range('),false);
});

test('old search result opens contextual window instead of loading full history',()=>{
 assert.ok(app.includes("return loadChat({aroundId:String(id),quiet:true,force:true});"));
 assert.ok(app.includes("payload.aroundId=String(aroundId)"));
 assert.ok(app.includes("chatMessageEngine.focus(list.length,index)"));
 assert.ok(edge.includes('seq-35')&&edge.includes('seq+35'));
});

test('native chat-sync is consumed incrementally and does not force a global chat render',()=>{
 assert.ok(app.includes("name==='chat-sync'"));
 assert.ok(app.includes("loadChat({quiet:true,syncId:id})"));
 assert.ok(app.includes("payload.messageId=String(syncId)"));
 const load=block(app,'async function loadChat(','async function refreshChatBadge');
 assert.ok(load.includes('chatRenderMessages('));
 assert.equal(/(^|[^A-Za-z])render\(\)/m.test(load),false);
});

test('message list updates are incremental and navigation cleans window observers',()=>{
 const queue=block(app,'function queueChatMessage(','function queueGalaxyCard');
 const load=block(app,'async function loadChat(','async function refreshChatBadge');
 assert.ok(queue.includes('chatRenderMessages'));
 assert.equal(queue.includes('render();'),false);
 assert.ok(load.includes('chatMessageEngine.applyPage'));
 assert.ok(app.includes("if(a==='chat-close'){ensureChatComposer().cancelReply();chatResizeObserver?.disconnect()"));
 assert.ok(app.includes("if(a==='chat-open'"));
});

test('virtual window uses measured variable heights and proactive preload',()=>{
 for(const marker of ['ResizeObserver','chatMeasureRendered','chatCaptureAnchor','chatRestoreAnchor','chatUpdateVirtualSpacers','chatHandleScroll'])assert.ok(app.includes(marker),marker);
 assert.ok(app.includes('el.scrollTop<1100'));
 assert.ok(app.includes('remaining<1100'));
 assert.ok(app.includes("loadChat({older:true,quiet:true})"));
 assert.ok(app.includes("loadChat({newer:true,quiet:true})"));
});

test('legacy search remains cursor-based and does not require history in memory',()=>{
 const search=block(edge,'async function chatSearch(','\nasync function ');
 assert.ok(search.includes('galaxy_chat_search_page'));
 assert.ok(search.includes('p_before_seq'));
 assert.ok(search.includes('nextBeforeSeq'));
 assert.equal(search.includes('.limit(500)'),false);
});
