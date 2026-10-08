import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../android/app/src/main/assets/mobile/app.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../android/app/src/main/assets/mobile/app.js',import.meta.url),'utf8');

test('NG-AUD-003 landscape onboarding uses compact card and visible two-column form',()=>{
 const marker=css.indexOf('/* NG-AUD-003:');
 assert.ok(marker>0,'Landscape fix marker missing');
 const chunk=css.slice(marker,css.indexOf('}',css.indexOf('}',marker)+1)+1);
 assert.match(chunk,/@media\s*\(orientation:landscape\)\s*and\s*\(max-height:560px\)/);
 assert.match(chunk,/\.onboarding\s+\.card\s*\{[^}]*padding:12px 16px/);
 assert.match(chunk,/\.onboarding\s+#pairForm\s*\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.doesNotMatch(chunk,/overflow:hidden|display:none/);
});

test('NG-AUD-003 pairing form remains labeled, required and keyboard-submit capable',()=>{
 const view=js.slice(js.indexOf('function renderOnboarding(){'),js.indexOf('function renderAdriWelcome(){'));
 assert.ok(view.includes('id="pairForm"'));
 assert.ok(view.includes('<label for="pairCode">Código de vinculación</label>'));
 assert.ok(view.includes('<input id="pairCode"'));
 assert.match(view,/name="code"[^>]*required/);
 assert.match(view,/type="submit">Vincular este teléfono/);
});
