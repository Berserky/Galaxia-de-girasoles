import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const app=readFileSync(resolve(import.meta.dirname,'../android/app/src/main/assets/mobile/app.js'),'utf8');
const start=app.indexOf('function updateMarkup(){');
const end=app.indexOf('function renderUpdateOnly()',start);
assert.ok(start>=0&&end>start,'Update markup function exists');
const snippet=app.slice(start,end);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function markup(native,updateState){
 const context={native,updateState,esc:escape};
 runInNewContext(snippet+';this.result=updateMarkup();',context);
 return context.result;
}
test('P7H shows only the real native installed version',()=>{
 assert.match(markup({version:'4.1.2'},{text:'Sin comprobar',busy:false}),/Versión instalada: 4.1.2/);
 assert.match(markup({},{text:'Sin comprobar',busy:false}),/no informada por Android/);
});
test('P7H does not claim up to date without a native result',()=>{
 assert.match(app,/Todavía no se ha comprobado si hay actualizaciones/);
 assert.doesNotMatch(app.slice(app.indexOf('let toastTimer'),app.indexOf('let dateContext')),/La app está al día/);
});
test('P7H escapes native status and version before HTML rendering',()=>{
 const html=markup({version:'<script>'},{text:'<img>',busy:false});
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img&gt;/);
 assert.doesNotMatch(html,/<script>|<img>/);
});
test('P7H clamps progress and only shows it during native busy',()=>{
 assert.match(markup({version:'1'},{text:'Descargando',progress:150,busy:true}),/aria-valuenow="100"/);
 assert.match(markup({version:'1'},{text:'Descargando',progress:-5,busy:true}),/aria-valuenow="0"/);
 assert.doesNotMatch(markup({version:'1'},{text:'Completado',progress:100,busy:false}),/role="progressbar"/);
});
test('P7H prevents duplicate checks while Android is busy',()=>{
 assert.match(markup({version:'1'},{text:'Buscando',busy:true}),/disabled aria-disabled="true"/);
 assert.match(app,/if\(a==='update-check'\)\{\s*if\(updateState\?\.busy\)return;/);
});
test('P7H uses Android callback and restores UI after invocation error',()=>{
 assert.match(app,/if\(name==='update'\)\{updateState=\{text:String\(data\?\.text/);
 assert.match(app,/catch\(err\)\{updateState=\{text:'No se pudo iniciar la comprobación\.',progress:0,busy:false\};renderUpdateOnly\(\);throw err;\}/);
 assert.match(app,/GalaxyNative\.call\('checkUpdate'\)/);
});
