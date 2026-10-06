import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../android/app/src/main/assets/mobile/app.css',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../android/app/src/main/assets/mobile/app.js',import.meta.url),'utf8');

test('Phase 7 exposes semantic chat design tokens',()=>{
 for(const token of ['--chat-space-1','--chat-radius-lg','--chat-font-body','--chat-touch','--chat-bg','--chat-surface-primary','--chat-bubble-self','--chat-danger','--chat-success','--chat-disabled-opacity']) assert.match(css,new RegExp(token.replaceAll('-','\\-')));
});
test('Phase 7 keeps accessible touch targets and reduced motion',()=>{
 assert.match(css,/--chat-touch:48px/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);
});
test('Phase 7 unifies primary chat surfaces',()=>{
 for(const selector of ['.chat-message .chat-bubble','.chat-reply-preview','.chat-galaxy-card','.chat-voice-inline','.chat-composer-v2']) assert.ok(css.includes(selector),selector);
});
test('Phase 7 groups only safe consecutive messages',()=>{
 assert.match(js,/gap<=5\*60\*1000/);
 assert.match(js,/message_type!=='card'/);
 assert.match(js,/grouped-next/);
});
