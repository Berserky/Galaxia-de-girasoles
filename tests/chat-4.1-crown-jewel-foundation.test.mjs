import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const block=(start,end)=>{
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0,'Missing '+start);
 assert.ok(b>a,'Missing '+end+' after '+start);
 return app.slice(a,b);
};
const crownCss=css.slice(css.indexOf('Galaxy Chat 4.1 — CROWN JEWEL'));

test('Crown Jewel app source parses',()=>{
 assert.doesNotThrow(()=>new vm.Script(app,{filename:'app.js'}));
});

test('header keeps one primary row with only Search and More actions',()=>{
 const view=block('function chatView()','async function loadChatPreferences');
 assert.equal((view.match(/class="chat-head-action"/g)||[]).length,2);
 assert.match(view,/data-action="chat-search-open"/);
 assert.match(view,/data-action="chat-more-open"/);
 assert.doesNotMatch(view,/data-action="chat-shared-open"/);
 assert.doesNotMatch(view,/data-action="chat-saved-open"/);
 assert.doesNotMatch(view,/data-action="chat-settings-open"/);
 const more=block('function openChatMoreMenu()','function chatView()');
 for(const action of ['chat-shared-open','chat-saved-open','chat-settings-open'])assert.match(more,new RegExp(action));
 assert.match(crownCss,/grid-template-columns:44px 40px minmax\(0,1fr\) 44px 44px/);
});

test('intelligent search has one primary textbox, debounce, states and exact navigation',()=>{
 const search=block('function openChatSearch()','function chatFormatText(');
 assert.equal((search.match(/type="search"/g)||[]).length,1);
 assert.match(search,/showBottomSheet\('Buscar en el chat'/);
 assert.match(search,/scheduleChatSearch\(form,delay=280\)/);
 assert.match(search,/date=String\(fd\.get\('date'\)\|\|''\)\|\|null/);
 assert.match(search,/sender=String\(fd\.get\('sender'\)\|\|'all'\)/);
 assert.match(search,/type=String\(fd\.get\('type'\)\|\|'all'\)/);
 assert.match(search,/chatSetSearchState\('searching'/);
 assert.match(search,/chatSetSearchState\('no-results'/);
 assert.match(search,/chatSetSearchState\('error'/);
 assert.match(search,/result\.nextBeforeSeq/);
 const jump=block('function jumpToChatMessage(','function openChatMessageMenu(');
 assert.match(jump,/chatScrollEngine\.toMessage/);
 assert.match(jump,/aroundId:String\(id\)/);
 const click=app.slice(app.indexOf("if(a==='chat-result-jump')"),app.indexOf("if(a==='chat-edit-open')"));
 assert.match(click,/closeModal\(\);await jumpToChatMessage\(id\)/);
});

test('Shared Hub uses contained tabs, integrated live search and media grid',()=>{
 const shared=block('function scheduleChatShared(','function chatFormatText(');
 assert.match(shared,/function runChatShared/);
 assert.match(shared,/role="tablist"/);
 assert.match(shared,/chat-albums-open/);
 assert.match(shared,/type="search"/);
 assert.doesNotMatch(shared,/chatSharedSearchForm[^\n]+type="submit"/);
 assert.match(crownCss,/\.chat-shared-tabs\{[\s\S]*?overflow-x:auto/);
 assert.match(crownCss,/\.chat-shared-list\[data-category="media"\]\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(app,/if\(a==='chat-shared-tab'\)[^\n]+runChatShared/);
});

test('long press owns message actions without stealing interactive descendants or swipe reply',()=>{
 const menu=block('function openChatMessageMenu(','function openChatEdit(');
 assert.match(menu,/showBottomSheet\('Acciones del mensaje'/);
 assert.match(menu,/chat-copy-message/);
 const gestures=app.slice(app.indexOf('let chatPress=null'),app.indexOf("document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'"));
 assert.match(gestures,/chatMessageInteractiveTarget/);
 assert.match(gestures,/contextmenu/);
 assert.match(gestures,/selectstart/);
 assert.match(gestures,/removeAllRanges/);
 assert.match(gestures,/openChatMessageMenu\(id\)/);
 assert.match(gestures,/520/);
 assert.match(gestures,/dx>58&&dy<45/);
 assert.match(gestures,/setReply\(m\)/);
 assert.match(crownCss,/-webkit-touch-callout:none/);
});

test('voice composer remains the single GalaxyChatVoice state machine and cannot overflow viewport',()=>{
 assert.equal((app.match(/GalaxyChatVoice\.create\(/g)||[]).length,1);
 assert.match(app,/chatVoiceEngine\.lock\(\)/);
 assert.match(app,/pauseVoiceRecording/);
 assert.match(app,/resumeVoiceRecording/);
 assert.match(app,/chat-voice-instruction/);
 assert.match(crownCss,/body\.chat-mode,[\s\S]*?overflow-x:hidden/);
 assert.match(crownCss,/\.chat-voice-inline\{[\s\S]*?max-width:100%[\s\S]*?min-width:0/);
 assert.match(crownCss,/\.chat-voice-waveform\{[\s\S]*?min-width:0/);
 assert.match(crownCss,/\.chat-voice-waveform i\{[\s\S]*?min-width:1px/);
});

test('responsive contracts cover 320, 360, 390, landscape, safe areas and font scaling',()=>{
 for(const width of [320,360,390])assert.match(crownCss,new RegExp('@media\\(max-width:'+width+'px\\)'));
 assert.match(crownCss,/@media\(orientation:landscape\) and \(max-height:560px\)/);
 assert.match(crownCss,/text-size-adjust:100%/);
 assert.match(crownCss,/env\(safe-area-inset-bottom\)/);
 assert.doesNotMatch(crownCss,/chat-head-action,.chat-back\{[^}]*min-width:(?:38|40|42)px/);
 assert.doesNotMatch(crownCss,/chat-voice-inline button\{[^}]*min-width:(?:38|40|42)px/);
});

test('reduced motion keeps new loading and press feedback nonessential',()=>{
 assert.match(crownCss,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(crownCss,/chat-search-status\[data-state="searching"\][\s\S]*?animation:none/);
 assert.match(crownCss,/chat-message\.chat-message-action-target[\s\S]*?transform:none/);
});
