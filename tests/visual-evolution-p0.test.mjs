import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const contract=JSON.parse(read('docs/visual-evolution-5/CELESTIAL_TOKENS.json'));
const mobile='android/app/src/main/assets/mobile/';
function luminosity(hex){
 assert.match(hex,/^#[0-9a-f]{6}$/i);
 const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
 return .2126*v[0]+.7152*v[1]+.0722*v[2];
}
const ratio=(a,b)=>{const x=luminosity(a),y=luminosity(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('P0: contrato completo de los ocho temas existentes (auto no duplica paleta)',()=>{
 const source=read(mobile+'theme.js');
 const declared=source.match(/const THEMES=\[([^\]]+)\]/)?.[1].match(/'[^']+'/g)?.map(s=>s.slice(1,-1));
 assert.deepEqual(contract.themes,declared);
 assert.deepEqual(Object.keys(contract.palettes),declared.filter(t=>t!=='auto'));
 assert.match(contract.themeResolution.auto,/GalaxyTheme\.resolve/);
});
test('P0: texto, texto secundario, acento y CTA cumplen contraste WCAG AA en superficie propuesta',()=>{
 for(const [name,c] of Object.entries(contract.palettes)){
  for(const [a,b,label] of [['text','bg','cuerpo'],['text','surface','tarjeta'],['muted','surface','secundario'],['accent','surface','enlace'],['onAccent','accent','CTA']]){
   const value=ratio(c[a],c[b]);
   assert.ok(value>=contract.contrast.normalText, name+' / '+label+' = '+value.toFixed(2)+' (<4.5)');
  }
 }
});
test('P0: contrato de interacción y movimiento accesible y preparado para insets',()=>{
 assert.deepEqual(contract.geometry.viewportsCssPx,[320,360,393,412]);
 assert.ok(contract.touch.minimumCssPx>=44&&contract.touch.recommendedAndroidDp>=48);
 assert.ok(contract.motion.standardMs>=150&&contract.motion.standardMs<=300);
 assert.ok(contract.geometry.bottomNavSafeArea.includes('safe-area-inset-bottom'));
 assert.ok(contract.motion.reduced.includes('misma funcionalidad'));
 const css=read(mobile+'app.css');
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/safe-area-inset-bottom/);
});
test('P0: rutas críticas conservadas y contratos de IA / Chat no sustituidos',()=>{
 const app=read(mobile+'app.js'),index=read(mobile+'index.html');
 for(const route of ['home','map','moments','memories','goals','ai','chat','more'])assert.ok(app.includes("view==='"+route+"'"),'Ruta existente '+route);
 for(const fn of ['renderNav','renderChatFab','syncChatViewportHeight','showModal','showBottomSheet','openUniversalSearch','openNotificationCenter'])assert.ok(app.includes('function '+fn+'('),'Se conserva '+fn);
 assert.match(index,/id="bottomNav"/);
 assert.match(index,/id="chatFab"/);
 assert.match(index,/viewport-fit=cover/);
 assert.match(index,/\.\/theme\.js/);
});
test('P0: maqueta aislada, sin endpoint ni datos privados y sin integración APK',()=>{
 const p=read('docs/visual-evolution-5/prototypes/celestial-shell.html');
 for(const t of contract.themes.filter(x=>x!=='auto'))assert.ok(p.includes('data-theme="'+t+'"'));
 assert.ok(p.includes('DEMO SINTÉTICA'));
 assert.ok(!p.includes('supabase.co')&&!p.includes('firebase'));
 assert.ok(!read(mobile+'index.html').includes('celestial-shell.html'));
});
