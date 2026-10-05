import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const scrollSource=readFileSync('android/app/src/main/assets/mobile/chat-scroll-engine.js','utf8');
const app=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');
const index=readFileSync('android/app/src/main/assets/mobile/index.html','utf8');
const css=readFileSync('android/app/src/main/assets/mobile/app.css','utf8');
const messageSource=readFileSync('android/app/src/main/assets/mobile/chat-message-engine.js','utf8');

function storage(){
 const values=new Map();
 return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),dump:()=>[...values.entries()]};
}
function runtime(){
 const store=storage();
 let raf=0;
 const context={
  window:{matchMedia:()=>({matches:false}),GalaxyChatPerf:{note(){}}},
  sessionStorage:store,
  requestAnimationFrame:fn=>{raf++;fn(raf*16);return raf;},
  cancelAnimationFrame(){},
  setTimeout:fn=>{fn();return 1;},clearTimeout(){},
  Date,Math,JSON,Number,String,Object,Array,Map,Set
 };
 vm.createContext(context);
 vm.runInContext(scrollSource,context);
 return {engine:context.window.GalaxyScrollEngine.create({memoryTtlMs:600000}),store};
}
function fakeList(count=20,height=100){
 const el={scrollTop:0,clientHeight:500,scrollHeight:count*height,isConnected:true,_rows:[]};
 el.getBoundingClientRect=()=>({top:0,bottom:el.clientHeight,height:el.clientHeight});
 el.querySelectorAll=selector=>selector==='.chat-message'?el._rows:[];
 el.scrollTo=({top})=>{el.scrollTop=top;};
 el._rows=Array.from({length:count},(_,i)=>({
  dataset:{chatId:'m'+i,id:'m'+i},
  getBoundingClientRect:()=>{
   const top=i*height-el.scrollTop;
   return {top,bottom:top+height,height};
  }
 }));
 return el;
}
function prepend(el,count,height=100){
 const old=el._rows;
 const added=Array.from({length:count},(_,i)=>({
  dataset:{chatId:'old'+i,id:'old'+i},
  getBoundingClientRect:()=>{
   const idx=el._rows.indexOf(added[i]),top=idx*height-el.scrollTop;
   return {top,bottom:top+height,height};
  }
 }));
 el._rows=[...added,...old.map(row=>({
  dataset:row.dataset,
  getBoundingClientRect:()=>{
   const idx=el._rows.findIndex(x=>x.dataset.chatId===row.dataset.chatId),top=idx*height-el.scrollTop;
   return {top,bottom:top+height,height};
  }
 }))];
 el.scrollHeight=el._rows.length*height;
}
function block(source,start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'missing block '+start);
 return source.slice(i,j);
}

test('phase2 runtime loads after Message Engine and before app',()=>{
 assert.ok(index.indexOf('chat-scroll-engine.js')>index.indexOf('chat-message-engine.js'));
 assert.ok(index.indexOf('chat-scroll-engine.js')<index.indexOf('app.js'));
 assert.ok(app.includes('window.GalaxyScrollEngine.create'));
});

test('stable message anchor preserves viewport after 50-message prepend',()=>{
 const {engine}=runtime(),el=fakeList(80);
 el.scrollTop=2400;engine.bind(el);
 const before=engine.captureAnchor(el);
 assert.equal(before.messageId,'m24');
 prepend(el,50);
 assert.ok(engine.restoreAnchor(el,before,'prepend'));
 const after=engine.captureAnchor(el);
 assert.equal(after.messageId,before.messageId);
 assert.ok(Math.abs(after.viewportOffset-before.viewportOffset)<1);
 assert.equal(el.scrollTop,7400);
});

test('repeated prepends do not accumulate visual drift',()=>{
 const {engine}=runtime(),el=fakeList(100);
 el.scrollTop=3300;engine.bind(el);
 const anchor=engine.captureAnchor(el);
 for(let i=0;i<4;i++){prepend(el,50);engine.restoreAnchor(el,anchor,'prepend');}
 const after=engine.captureAnchor(el);
 assert.equal(after.messageId,anchor.messageId);
 assert.ok(Math.abs(after.viewportOffset-anchor.viewportOffset)<1);
});

test('bottom state uses one tolerance contract',()=>{
 const {engine}=runtime(),el=fakeList(20);
 el.scrollTop=1400;
 assert.equal(engine.isAtBottom(el),true);
 el.scrollTop=1389;
 assert.equal(engine.isAtBottom(el),false);
});

test('programmatic bottom and message jumps are centralized and reduced-motion aware',()=>{
 const {engine}=runtime(),el=fakeList(30);
 engine.toBottom(el,{reason:'new-message'});
 assert.equal(el.scrollTop,2500);
 engine.toMessage(el,'m10',{block:'center',smooth:true,reason:'search'});
 assert.ok(el.scrollTop>=750&&el.scrollTop<=850);
 const jump=block(app,'function jumpToChatMessage(','function openChatMessageMenu');
 assert.equal(jump.includes('scrollIntoView'),false);
 assert.ok(jump.includes('chatScrollEngine.toMessage'));
 assert.ok(scrollSource.includes('prefers-reduced-motion'));
});

test('position memory stores only anchor/context metadata and restores it',()=>{
 const {engine,store}=runtime(),el=fakeList(40);
 el.scrollTop=1700;engine.bind(el);
 const before=engine.captureAnchor(el);
 engine.remember(el,'chat');
 const raw=store.dump()[0][1];
 assert.equal(/body|attachment|latitude|longitude|url/i.test(raw),false);
 el.scrollTop=0;
 assert.ok(engine.restoreMemory(el,'chat'));
 const after=engine.captureAnchor(el);
 assert.equal(after.messageId,before.messageId);
});

test('global chat render, navigation and background paths preserve context',()=>{
 const render=block(app,'function render(){','function renderOnboarding');
 assert.ok(render.includes('previousChatAnchor=previousChatEl?chatCaptureAnchor(previousChatEl):null'));
 assert.ok(render.includes('render-preserve'));
 assert.ok(render.includes('chatScrollEngine.restoreMemory'));
 const go=block(app,'function go(next){','let nativeThemeSent');
 assert.ok(go.includes("previous==='chat'&&next!=='chat'"));
 assert.ok(go.includes('chatScrollEngine.remember'));
 assert.ok(app.includes("document.visibilityState==='hidden'")&&app.includes("chatScrollEngine.remember(document.querySelector('#chatMessages'),'chat')"));
});

test('keyboard, composer and orientation resize use anchor/bottom restoration',()=>{
 const sync=block(app,'function syncChatViewportHeight(){','function go(next)');
 assert.ok(sync.includes('beforeViewportChange'));
 assert.ok(sync.includes('afterViewportChange'));
 const observe=block(app,'function chatObserveWindow(){','function chatUpdateVirtualSpacers');
 assert.ok(observe.includes("document.querySelector('#chatForm')"));
 assert.ok(observe.includes('chatScrollEngine.stabilize'));
 assert.ok(observe.includes('ResizeObserver'));
});

test('Realtime while reading history increments indicator without moving viewport',()=>{
 const load=block(app,'async function loadChat(','async function refreshChatBadge');
 assert.ok(load.includes('const readingHistory=!!chatState?.nextAfterSeq||!wasNear'));
 assert.ok(load.includes('chatNewCount+=1'));
 assert.ok(load.includes('syncDeferred=true'));
 assert.ok(load.includes("scroll:aroundId?'none':shouldBottom?'bottom':'preserve'"));
 assert.ok(load.includes('if(!wasNear&&!older&&!newer&&!aroundId&&!present&&added)chatNewCount+=added'));
});

test('Realtime at bottom and own sends use explicit bottom policy',()=>{
 const load=block(app,'async function loadChat(','async function refreshChatBadge');
 assert.ok(load.includes('const shouldBottom=!aroundId&&!older&&!newer&&(present||chatInitialScroll||wasNear)'));
 const queue=block(app,'function queueChatMessage(','function queueGalaxyCard');
 assert.ok(queue.includes("chatRenderMessages({scroll:'bottom'})"));
 assert.ok(app.includes("if(a==='chat-jump-present')"));
});

test('new message indicator is local, accumulates and clears at bottom',()=>{
 const handler=block(app,'function chatHandleScroll(','function chatDraftAttachmentMarkup');
 assert.ok(handler.includes('if(chatNewCount){chatNewCount=0;chatUpdateNewButton();}'));
 assert.ok(app.includes('function chatUpdateNewButton()'));
 assert.match(css,/\.chat-new-button\{/);
});

test('late image/card/composer resize stabilizes the live anchor',()=>{
 const observe=block(app,'function chatObserveWindow(){','function chatUpdateVirtualSpacers');
 assert.ok(observe.includes("new ResizeObserver(()=>{chatScrollEngine.stabilize(el,'content-resize');chatScheduleMeasure();})"));
 assert.ok(app.includes('chatMediaRatioStyle'));
 assert.ok(app.includes('aspect-ratio:'));
 assert.ok(app.includes('chat-galaxy-card'));
});

test('virtualization measurement preserves anchor while spacer estimates change',()=>{
 const measure=block(app,'function chatMeasureRendered(){','function chatScheduleMeasure');
 assert.ok(measure.includes("captureState(el,'measure')"));
 assert.ok(measure.includes("restoreState(el,stable,{reason:'virtual-measure',fallbackBottom:true})"));
 assert.ok(measure.includes('chatUpdateVirtualSpacers'));
});

test('virtual window rotates at rendered boundaries instead of absolute scroll container edges',()=>{
 const handler=block(app,'function chatHandleScroll(','function chatDraftAttachmentMarkup');
 assert.ok(handler.includes('firstDistance>-760'));
 assert.ok(handler.includes('lastDistance<760'));
 assert.ok(handler.includes("el.querySelectorAll('.chat-message')"));
 assert.equal(handler.includes('el.scrollTop<760&&range.start>0'),false);
 assert.ok(handler.includes('chatScrollEngine.isProgrammatic()'));
});

test('fast scroll into a virtual spacer recenters the existing window instead of leaving blank space',()=>{
 const handler=block(app,'function chatHandleScroll(','function chatDraftAttachmentMarkup');
 assert.ok(handler.includes('viewportAnchor?.virtual'));
 assert.ok(app.includes('chatMessageEngine.indexAtOffset'));
 assert.ok(app.includes('chatMessageEngine.offsetBefore'));
 assert.ok(messageSource.includes('function indexAtOffset'));
 assert.ok(messageSource.includes('function offsetBefore'));
});

test('keyboard viewport restoration coalesces competing animation-frame corrections',()=>{
 assert.ok(scrollSource.includes('viewportRaf'));
 assert.ok(scrollSource.includes('cancelAnimationFrame(viewportRaf)'));
 assert.ok(scrollSource.includes("if(!viewportToken)viewportToken=el?captureState(el,'viewport'):null"));
});

test('history/search/deep contextual navigation does not force present',()=>{
 const load=block(app,'async function loadChat(','async function refreshChatBadge');
 assert.ok(load.includes("direction=aroundId?'around'"));
 assert.ok(load.includes("scroll:aroundId?'none'"));
 assert.ok(app.includes("return loadChat({aroundId:String(id),quiet:true,force:true});"));
});

test('deletion/edit/sync reconciliation stays anchor-preserving',()=>{
 const load=block(app,'async function loadChat(','async function refreshChatBadge');
 assert.ok(load.includes("if(view==='chat')chatRenderMessages({anchor,scroll:'preserve'})"));
 assert.ok(load.includes('nextState=chatMessageEngine.applySingle'));
 assert.ok(load.includes('chatRenderMessages({anchor'));
});

test('network foreground/reconnect refresh keeps scroll engine in the loop',()=>{
 assert.ok(app.includes("window.addEventListener('online'"));
 assert.ok(app.includes("loadChat({quiet:true,force:true})"));
 assert.ok(app.includes("requestAnimationFrame(()=>chatScrollEngine.restoreMemory(document.querySelector('#chatMessages'),'chat'))"));
});

test('20k logical history remains windowed while phase2 adds no second scroll container',()=>{
 const context={window:{}};
 vm.createContext(context);vm.runInContext(messageSource,context);
 const e=context.window.GalaxyMessageEngine.create({windowSize:84});
 const rows=Array.from({length:20000},(_,i)=>({id:'m'+i,server_seq:i+1}));
 e.resetWindow(rows.length,{align:'end'});
 assert.ok(e.range(rows).messages.length<=84);
 assert.equal((app.match(/id="chatMessages"/g)||[]).length,1);
});

test('chat programmatic scroll writes are routed through GalaxyScrollEngine',()=>{
 const renderMessages=block(app,'function chatRenderMessages(','function chatHandleScroll');
 assert.equal(renderMessages.includes('.scrollIntoView'),false);
 assert.equal(/\.scrollTop\s*=/.test(renderMessages),false);
 const jump=block(app,'function jumpToChatMessage(','function openChatMessageMenu');
 assert.equal(/\.scrollTop\s*=|scrollIntoView/.test(jump),false);
 assert.ok(scrollSource.includes('el.scrollTop=to'));
});

test('phase0 spontaneous jump regression is encoded as anchor restoration',()=>{
 assert.ok(app.includes('chatRenderState'));
 assert.ok(app.includes("chatScrollEngine.restoreState(chatEl,chatRenderState,{reason:'render-preserve',fallbackBottom:true})"));
 const {engine}=runtime(),el=fakeList(60);
 el.scrollTop=2200;engine.bind(el);
 const state=engine.captureState(el,'render');
 const old=state.anchor.messageId;
 el.scrollTop=0;
 engine.restoreState(el,state,{reason:'render-preserve'});
 assert.equal(engine.captureAnchor(el).messageId,old);
});


test('anchor fallback survives deletion of the primary visible message',()=>{
 const {engine}=runtime(),el=fakeList(30);
 el.scrollTop=1000;engine.bind(el);
 const anchor=engine.captureAnchor(el),fallback=anchor.fallbacks?.[0];
 assert.ok(fallback?.messageId);
 el._rows=el._rows.filter(row=>row.dataset.chatId!==anchor.messageId);
 el.scrollHeight=el._rows.length*100;
 assert.ok(engine.restoreAnchor(el,anchor,'delete-race'));
 const after=engine.captureAnchor(el);
 assert.equal(after.messageId,fallback.messageId);
 assert.ok(Math.abs(after.viewportOffset-fallback.viewportOffset)<1);
});
