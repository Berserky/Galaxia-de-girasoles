import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
test('GIPHY creator logo attribution is bundled and shown in all online discovery/embed UI',()=>{
  const js=fs.readFileSync(path.join(root,'android/app/src/main/assets/mobile/app.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'android/app/src/main/assets/mobile/app.css'),'utf8');
  const logo=fs.readFileSync(path.join(root,'android/app/src/main/assets/mobile/giphy-official-logo.png'));
  const credit='<div class="chat-giphy-credit" aria-label="Powered by GIPHY"><span>Powered by</span><img src="./giphy-official-logo.png" alt="GIPHY" loading="lazy"></div>';
  assert.equal(js.split(credit).length-1,4);
  assert.equal(js.includes('<small class="chat-giphy-credit">Powered by GIPHY</small>'),false);
  assert.ok(css.includes('.chat-giphy-credit img{'));
  assert.ok(logo.length>5000);
  assert.deepEqual([...logo.subarray(0,8)],[137,80,78,71,13,10,26,10]);
});
