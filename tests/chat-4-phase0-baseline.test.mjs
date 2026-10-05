import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const app=read('android/app/src/main/assets/mobile/app.js');
const perf=read('android/app/src/main/assets/mobile/chat-perf.js');
const bench=read('scripts/chat-4-phase0-baseline.mjs');
const gradle=read('android/app/build.gradle.kts');

test('Phase 0 starts from Galaxy Chat Universe 3.5.1',()=>{
 assert.match(gradle,/versionCode = 35; versionName = "3\.5\.1"/);
});
test('baseline covers 100, 500, 5000 and 20000 mixed messages',()=>{
 for(const n of ['100','500','5000','20000'])assert.ok(bench.includes(n),n);
 for(const kind of ['text','reply','reaction','photo','video','audio','Galaxy Card','location','system','combined'])assert.ok(bench.includes(kind),kind);
});
test('performance instrumentation is opt-in and content-blind',()=>{
 assert.ok(perf.includes("localStorage.getItem(KEY)==='1'"));
 assert.ok(perf.includes('window.GalaxyChatPerf'));
 assert.equal(/messageBody|bodyText|latitude|longitude|attachmentUrl|payloadContent/.test(perf),false);
});
test('P0 scroll jump mechanism is characterized without fixing it',()=>{
 assert.ok(app.includes("app.innerHTML=chatView()"));
 assert.ok(app.includes("oldTop+(el.scrollHeight-oldHeight)"));
 assert.ok(app.includes("else if(wasNear||chatInitialScroll)"));
 const restoreBlock=app.slice(app.indexOf("requestAnimationFrame(()=>{",app.indexOf("async function loadChat")),app.indexOf("chatRestorePlayback",app.indexOf("async function loadChat")));
 assert.equal(restoreBlock.includes("else if(!wasNear)"),false);
});
test.todo('P0 Scroll Engine: ordinary incoming refresh preserves the visible anchor while user reads history');
test('Phase 0 benchmark reuses Phase 4 hydration benchmark instead of duplicating it',()=>{
 assert.ok(bench.includes("scripts/benchmark-phase4.mjs"));
});