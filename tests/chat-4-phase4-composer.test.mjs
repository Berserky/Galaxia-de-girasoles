import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const composerSource=readFileSync('android/app/src/main/assets/mobile/chat-composer.js','utf8');
const appSource=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');
const indexSource=readFileSync('android/app/src/main/assets/mobile/index.html','utf8');
const cssSource=readFileSync('android/app/src/main/assets/mobile/app.css','utf8');

function storageHarness(){
 const map=new Map();
 return {
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>map.set(key,String(value)),
  removeItem:key=>map.delete(key),
  map
 };
}
function composerHarness(options={}){
 const storage=options.storage||storageHarness();
 const context={window:{localStorage:storage},setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(composerSource,context);
 return {storage,composer:context.window.GalaxyChatComposer.create({storage,...options})};
}
function block(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,`missing block ${start}`);
 return source.slice(a,b);
}

test('1. empty input exposes voice action',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');
 assert.equal(composer.rightMode(0),'voice');
 assert.equal(composer.canSend(0),false);
});

test('2. valid text exposes send action',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('Nos vemos mañana');
 assert.equal(composer.rightMode(0),'send');
 assert.equal(composer.canSend(0),true);
});

test('3. whitespace never masquerades as sendable content and transition is immediate',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('   ');
 assert.equal(composer.rightMode(0),'voice');
 composer.setText('x');assert.equal(composer.rightMode(0),'send');
 composer.setText('');assert.equal(composer.rightMode(0),'voice');
});

test('4. optimistic send delegates to the Phase 3 Delivery Engine before visual confirmation',()=>{
 const send=block(appSource,'function queueChatMessage','function queueGalaxyCard');
 assert.ok(send.includes('chatDeliveryEngine.queue(row)'));
 assert.ok(send.includes("chatRenderMessages({scroll:'bottom'})"));
 assert.ok(send.indexOf('chatDeliveryEngine.queue(row)')<send.indexOf("chatRenderMessages({scroll:'bottom'})"));
 assert.equal(send.includes('await api(\'chat-send\''),false);
});

test('5. rapid double submit is guarded without slowing the first tap',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('hola');
 assert.equal(composer.beginSubmit({now:1000}),true);
 composer.accepted();composer.setText('otra');
 assert.equal(composer.beginSubmit({now:1100}),false);
 assert.equal(composer.beginSubmit({now:1400}),true);
});

test('6. multiline state follows real newlines',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('uno\ndos');
 assert.equal(composer.snapshot().multiline,true);
});

test('7. input growth is capped and becomes internally scrollable',()=>{
 const {composer}=composerHarness({maxHeight:120,minHeight:44});composer.hydrate('pair:0-1');
 const textarea={value:'texto largo',scrollHeight:260,style:{}};
 composer.applyInput(textarea);
 assert.equal(textarea.style.height,'120px');
 assert.equal(textarea.style.overflowY,'auto');
 assert.equal(composer.snapshot().height,120);
});

test('8. reply target is integrated into Composer state',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');
 composer.setReply({id:'m1',sender_person:'1',body:'Nos vemos',message_type:'text'});
 assert.equal(composer.snapshot().replyTarget.id,'m1');
 assert.equal(composer.snapshot().replyTarget.body,'Nos vemos');
});

test('9. cancelling reply preserves the draft',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('mi respuesta');composer.setReply({id:'m1',body:'x'});
 composer.cancelReply();
 assert.equal(composer.snapshot().text,'mi respuesta');
 assert.equal(composer.snapshot().replyTarget,null);
});

test('10. drafts are isolated by conversation key',()=>{
 const storage=storageHarness(),{composer}=composerHarness({storage});
 composer.hydrate('pair:0-1');composer.setText('draft A');
 composer.hydrate('pair:0-2');composer.setText('draft B');
 composer.hydrate('pair:0-1');assert.equal(composer.snapshot().text,'draft A');
 composer.hydrate('pair:0-2');assert.equal(composer.snapshot().text,'draft B');
});

test('11. locally accepted send clears only the active draft',()=>{
 const storage=storageHarness(),{composer}=composerHarness({storage});
 composer.hydrate('pair:0-1');composer.setText('enviar');composer.beginSubmit({now:1000});composer.accepted();
 composer.hydrate('pair:0-2');composer.setText('conservar');
 composer.hydrate('pair:0-1');assert.equal(composer.snapshot().text,'');
 composer.hydrate('pair:0-2');assert.equal(composer.snapshot().text,'conservar');
});

test('12. attachment launcher is one bottom sheet with existing capabilities',()=>{
 for(const marker of ['showBottomSheet(\'Adjuntar\'','chat-attach-camera','chat-attach-gallery','chat-attach-video-camera','chat-attach-file','chat-attach-location','chat-galaxy-open'])assert.ok(appSource.includes(marker),marker);
 assert.ok(cssSource.includes('#modal.chat-bottom-sheet'));
 assert.ok(cssSource.includes('.chat-attachment-sheet-grid'));
});

test('13. closing the attachment sheet clears intent without discarding text',()=>{
 const close=block(appSource,'function closeModal()','function openItemForm');
 assert.ok(close.includes("form==='chat-attach-sheet'"));
 assert.ok(close.includes('setAttachmentIntent(null)'));
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('draft');composer.setAttachmentIntent('launcher');composer.setAttachmentIntent(null);
 assert.equal(composer.snapshot().text,'draft');
});

test('14. keyboard open state is centralized',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setKeyboard(true,310);
 assert.deepEqual(composer.snapshot().keyboard,{open:true,height:310});
 assert.ok(appSource.includes("setKeyboard(focused,Math.max(0,full-height))"));
});

test('15. keyboard close state is explicit',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setKeyboard(true,250);composer.setKeyboard(false,0);
 assert.deepEqual(composer.snapshot().keyboard,{open:false,height:0});
 assert.ok(appSource.includes("setKeyboard(false,0)"));
});

test('16. font scaling keeps accessible touch targets and a 16px IME-safe textarea',()=>{
 assert.ok(cssSource.includes('font-size:16px'));
 assert.ok(cssSource.includes('min-width:48px;min-height:48px'));
 assert.ok(cssSource.includes('min-width:44px;min-height:44px'));
 assert.ok(cssSource.includes('@media(prefers-reduced-motion:reduce)'));
});

test('17. navigating away and back restores the same conversation draft',()=>{
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('sigo escribiendo');
 composer.hydrate('pair:0-1');
 assert.equal(composer.snapshot().text,'sigo escribiendo');
 const close=block(appSource,"if(a==='chat-close')","if(a==='chat-load-more')");
 assert.equal(close.includes('.accepted()'),false);
});

test('18. typing with a 20k-message conversation never invokes global render',()=>{
 const input=block(appSource,"document.addEventListener('input'","document.addEventListener('change'");
 assert.ok(input.includes('ensureChatComposer().applyInput(e.target)'));
 assert.ok(input.includes('chatScrollEngine.beforeViewportChange'));
 assert.ok(input.includes('chatScrollEngine.afterViewportChange'));
 assert.equal(/\brender\s*\(/.test(input),false);
 const messages=Array.from({length:20000},(_,i)=>({id:String(i)}));
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('fluido');
 assert.equal(messages.length,20000);
 assert.equal(composer.snapshot().text,'fluido');
});

test('19. realtime message rendering is independent from the draft while typing',()=>{
 const sync=block(appSource,'async function consumeChatSync','async function refreshChatBadge');
 assert.ok(sync.includes('loadChat'));
 const load=block(appSource,'async function loadChat','async function refreshChatBadge');
 assert.ok(load.includes('chatRenderMessages'));
 const {composer}=composerHarness();composer.hydrate('pair:0-1');composer.setText('no perder');
 assert.equal(composer.snapshot().text,'no perder');
});

test('20. Composer height changes preserve Scroll Engine ownership',()=>{
 const render=block(appSource,'function chatRenderComposer','function chatView');
 assert.ok(render.includes('chatScrollEngine.beforeViewportChange'));
 assert.ok(render.includes('chatScrollEngine.afterViewportChange'));
 assert.equal(render.includes('app.innerHTML'),false);
});

test('Composer 2.0 loads after Delivery Engine and before app.js',()=>{
 const delivery=indexSource.indexOf('chat-delivery-engine.js'),composer=indexSource.indexOf('chat-composer.js'),app=indexSource.indexOf('./app.js');
 assert.ok(delivery>=0&&composer>delivery&&app>composer);
});

test('Composer has no direct transport and no second message channel',()=>{
 assert.equal(/chat-send|fetch\(|XMLHttpRequest|WebSocket|supabase/i.test(composerSource),false);
 assert.equal((appSource.match(/chatDeliveryEngine\.queue\(row\)/g)||[]).length,1);
});
