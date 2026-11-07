import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const css=read('docs/visual-evolution-5/candidates/nav-p5-textzoom-135.css');
const oldCss=read('android/app/src/main/assets/mobile/app.css');
const shell=read('android/app/src/main/assets/mobile/celestial-shell.css');
const moments=read('android/app/src/main/assets/mobile/galaxy-moments-v5.css');
const index=read('android/app/src/main/assets/mobile/index.html');
const app=read('android/app/src/main/assets/mobile/app.js');

test('P5 #176: proposal is deliberately not loaded into Android without authorization',()=>{
 assert.doesNotMatch(index,/nav-p5-textzoom-135\.css/);
 assert.match(css,/CANDIDATE ONLY; NOT LOADED BY ANDROID/);
});
test('P5 #176: proposal targets the six real Moments navigation labels only',()=>{
 assert.match(css,/body:not\(\.chat-mode\):has\(\.living-moments\) \.bottom-nav \.nav-btn span/);
 assert.match(app,/function renderNav\(\)/);
 assert.match(app,/class="nav-btn /);
 assert.match(app,/aria-current="page"/);
 assert.match(oldCss,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)/);
});
test('P5 #176: old APK contract is explicitly truncated at widths above 359 CSS px',()=>{
 assert.match(oldCss,/\.nav-btn span\{[^}]*text-overflow:ellipsis;white-space:nowrap/);
 assert.match(moments,/@media\(max-width:359px\)\{body:not\(\.chat-mode\):has\(\.living-moments\) \.bottom-nav \.nav-btn span/);
 assert.match(shell,/\.nav-btn span \{font-size:clamp\(9px,2\.8vw,11px\)/);
});
test('P5 #176: proposed labels use complete, naturally wrapped readable text',()=>{
 for(const text of ['white-space:normal','text-overflow:clip','overflow:visible','overflow-wrap:anywhere','word-break:normal','transform:none']){
  assert.ok(css.includes(text),text);
 }
 assert.doesNotMatch(css,/scaleX\(|white-space:nowrap|text-overflow:ellipsis|font-size:/);
});
test('P5 #176: actual nav buttons retain 48px target, focus, and six labels',()=>{
 assert.match(shell,/\.nav-btn \{[\s\S]*?min-height:48px/);
 assert.match(shell,/\.nav-btn\[aria-current="page"\]/);
 assert.match(shell,/:focus-visible/);
 assert.match(app,/const nav=\[\['home','Inicio'/);
});
test('P5 #176: candidate is networkless and cannot change progression or navigation logic',()=>{
 assert.doesNotMatch(css,/url\(|@import|fetch\(|http[s]?:|display:none|visibility:hidden|pointer-events:none|:root|data-stage/);
 assert.equal(css.match(/\{/g)?.length,css.match(/\}/g)?.length);
});
