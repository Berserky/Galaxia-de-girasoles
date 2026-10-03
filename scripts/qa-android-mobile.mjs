import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

const app=read('android/app/src/main/assets/mobile/app.js');
const map=read('android/app/src/main/assets/mobile/map.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const index=read('android/app/src/main/assets/mobile/index.html');
const lucideSource=read('android/app/src/main/assets/mobile/lucide.js');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const bridge=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
const updater=read('android/app/src/main/java/com/nuestragalaxia/companion/UpdateManager.java');
const edge=read('supabase/functions/android-companion/index.ts');
const build=read('android/app/build.gradle.kts');
const workflow=read('.github/workflows/android-companion.yml');
const widget=read('android/app/src/main/res/layout/widget_bond.xml')+read('android/app/src/main/java/com/nuestragalaxia/companion/BondWidget.java');
const motionTest=read('android/app/src/test/java/com/nuestragalaxia/companion/MotionClassifierThresholdTest.java');

const emoji=/[☀-➿🀀-🫿]/u;
assert.equal(emoji.test(app),false,'La UI móvil no debe usar emojis/dingbats como iconos');
assert.equal(emoji.test(map),false,'El mapa móvil no debe usar emojis/dingbats como iconos');
assert.equal(emoji.test(widget),false,'El widget no debe usar emojis/dingbats como iconos');

assert.ok(existsSync(resolve(root,'android/app/src/main/assets/mobile/lucide.js')),'Falta Lucide local');
assert.ok(existsSync(resolve(root,'android/app/src/main/assets/mobile/LICENSE-lucide')),'Falta licencia de Lucide');
const scriptSources=[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(scriptSources,['./lucide.js','https://www.youtube.com/iframe_api','https://open.spotify.com/embed/iframe-api/v1','./map.js','./app.js'],'Solo se permiten scripts locales y los SDK oficiales de YouTube/Spotify, manteniendo Lucide primero');
assert.ok(index.includes("connect-src 'none'"),'La UI local no debe hacer fetch directo ni recibir credenciales');
assert.equal(/leaflet/i.test(css+index),false,'No deben quedar estilos o assets muertos de Leaflet');

const module={exports:{}};
vm.runInNewContext(lucideSource,{module,exports:module.exports,console:{warn(){},error(){},log(){}}});
const lucide=module.exports;
assert.ok(lucide.icons,'El bundle local de Lucide no expuso sus iconos');
const pascal=name=>name.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join('');
const iconNames=new Set([
 'house','map-pin','heart','images','more-horizontal','smile','waves','moon','hand-heart',
 'calendar','circle-check-big','file-text','lock','star','route','music','sparkles','camera',
 'trash-2','sprout','flower-2','message-circle','dice-5','gamepad-2','notebook-pen','mic',
 'bike','bus-front','navigation','briefcase','compass','x','zoom-in','zoom-out'
]);
for(const m of app.matchAll(/\b(?:ico|actionCard)\(['"]([a-z0-9-]+)['"]/g))iconNames.add(m[1]);
for(const m of map.matchAll(/lucideNode\(['"]([a-z0-9-]+)['"]/g))iconNames.add(m[1]);
for(const name of iconNames)assert.ok(lucide.icons[pascal(name)],'Icono Lucide inexistente: '+name);

const staticActions=[...app.matchAll(/data-action="([^"]+)"/g)]
 .map(m=>m[1]).filter(x=>!/[+'$]/.test(x));
const handlers=new Set([...app.matchAll(/if\(a===['"]([^'"]+)['"]/g)].map(m=>m[1]));
for(const action of staticActions)assert.ok(handlers.has(action),'Acción sin handler: '+action);
for(const action of ['map','moments','add-memory','add-plan','new-game','new-ritual','trip-toggle','place-new','destination','transport-set','location-start','location-stop'])
 assert.ok(handlers.has(action),'Falta handler crítico: '+action);

const forms=[...new Set([...app.matchAll(/id="([A-Za-z][A-Za-z0-9]*Form)"/g)].map(m=>m[1]))];
const formHandlers=new Set([...app.matchAll(/e\.target\.id===['"]([^'"]+)['"]/g)].map(m=>m[1]));
for(const form of forms)assert.ok(formHandlers.has(form),'Formulario sin submit handler: '+form);

const apiCalls=new Set([...app.matchAll(/\bapi\(['"]([^'"]+)['"]/g)].map(m=>m[1]));
const allowedBlock=main.match(/MOBILE_ACTIONS=Set\.of\(([\s\S]*?)\);/)?.[1]||'';
const mainActions=new Set([...allowedBlock.matchAll(/"([^"]+)"/g)].map(m=>m[1]));
const edgeActions=new Set([...edge.matchAll(/action===["']([^"']+)["']/g)].map(m=>m[1]));
for(const action of apiCalls){
 assert.ok(mainActions.has(action),'Acción UI no permitida en Android: '+action);
 assert.ok(edgeActions.has(action),'Acción UI no implementada en Edge Function: '+action);
}
assert.ok(mainActions.has('transport-set')&&edgeActions.has('transport-set'),'Falta transporte habitual end-to-end');
for(const action of ['presence-set','backup-export','backup-restore'])assert.ok(mainActions.has(action)&&edgeActions.has(action),'Falta función 2.1 end-to-end: '+action);
assert.ok(edge.includes('galaxy_presence'),'Falta presencia privada en backend');
assert.ok(app.includes('function nowCard()'),'Falta tarjeta Ahora en Inicio');
assert.ok(app.includes('function relationshipAnswer('),'Falta Nuestra IA local');
assert.ok(app.includes('Mapa de nuestra historia'),'Falta mapa histórico enlazado');
assert.ok(app.includes("data-action="backup-export"")&&app.includes("data-action="backup-import""),'Faltan controles de backup');
assert.ok(app.includes("data-action="presence-battery-toggle"")&&app.includes("data-action="presence-song-toggle""),'Faltan controles de privacidad Ahora');
assert.ok(edge.includes('["memory","song","capsule","journey","note"]'),'Las notas de voz deben poder enlazarse a viajes y sorpresas');

const nativeCalls=new Set([...app.matchAll(/GalaxyNative\.call\(['"]([^'"]+)['"]/g)].map(m=>m[1]));
const bridgeMethods=new Set([...bridge.matchAll(/public void (\w+)\(/g)].map(m=>m[1]));
for(const method of nativeCalls)assert.ok(bridgeMethods.has(method),'Método nativo sin bridge: '+method);
assert.ok(bridgeMethods.has('closeApp')&&app.includes('GalaxyAndroid.closeApp()'),'El botón Atrás debe poder cerrar la app desde Inicio');
for(const method of ['saveBackup','pickBackup'])assert.ok(bridgeMethods.has(method),'Falta puente nativo para '+method);
assert.ok(main.includes('BATTERY_PROPERTY_CAPACITY'),'Ahora debe leer batería real sin permisos sensibles');
assert.ok(main.includes('previewEnded'),'El preview de voz debe avisar cuando termina');
assert.ok(main.includes('onPause()')&&main.includes('stopVoiceRecording(null)'),'La grabación debe detenerse al pasar a segundo plano');

const version=build.match(/versionCode\s*=\s*(\d+);\s*versionName\s*=\s*"([^"]+)"/);
assert.ok(version,'No se pudo leer la versión Android');
const [,versionCode,versionName]=version;
assert.ok(workflow.includes('"versionCode":'+versionCode),'versionCode desalineado en update.json');
assert.ok(workflow.includes('"versionName":"'+versionName+'"'),'versionName desalineado en update.json');
assert.ok(workflow.includes('NuestraGalaxia.apk'),'El release debe usar el nombre final NuestraGalaxia.apk');
assert.ok(workflow.includes('lintDebug'),'El pipeline debe ejecutar Android Lint');
assert.ok(workflow.includes('qa-android-mobile.mjs'),'El pipeline debe ejecutar esta auditoría');

assert.ok(updater.includes('BuildConfig.APPLICATION_ID.equals(info.packageName)'),'El updater debe verificar packageName');
assert.ok(updater.includes('version<=BuildConfig.VERSION_CODE'),'El updater debe rechazar APK no superior');
assert.ok(updater.includes('resumePendingInstall'),'El updater debe retomar la instalación tras conceder permisos');
assert.ok(updater.includes('MAX_APK_BYTES'),'El updater debe limitar el tamaño de descarga');
assert.ok(widget.includes('widgetNow'),'El widget debe mostrar el contexto Ahora');
assert.ok(widget.includes('nowText'),'El widget debe convertir presencia compartida en texto');

assert.ok(edge.includes('body.detail!==true'),'El mapa debe tener refresco ligero');
assert.ok(app.includes("refreshMap({quiet:true,detail:false})"),'El polling del mapa debe usar refresco ligero');
assert.ok(app.includes("document.visibilityState!=='visible'"),'La app debe pausar polling fuera de primer plano');
assert.ok(app.includes('editingNow()'),'La sincronización automática debe respetar formularios en edición');
assert.ok(app.includes("WELCOME_KEY='nuestra-galaxia.adri-welcome.v1'"),'Falta persistencia de la bienvenida de Adri');
assert.ok(app.includes("String(native.person)==='1'"),'La bienvenida especial debe limitarse a Adri/person 1');
assert.ok(app.includes("welcomePreview||(String(native.person)==='1'&&!welcomeDone())"),'El preview de Sebas debe poder abrir la bienvenida sin alterar la regla real de Adri');
assert.ok(app.includes("data-action=\"welcome-next\""),'Falta navegación de la bienvenida');
assert.ok(app.includes("data-action=\"welcome-skip\""),'La bienvenida debe poder omitirse');
assert.ok(app.includes("data-action=\"welcome-replay\""),'Falta opción para volver a ver la bienvenida');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'),'La bienvenida debe respetar reducir movimiento');
assert.equal(motionTest.includes('placeholderKeepsUnitTestTaskActive'),false,'La prueba de movimiento no puede ser placeholder');
assert.ok(motionTest.includes('medianIgnoresSingleGpsSpeedSpike'),'Falta prueba de ruido GPS');

console.log('QA móvil 2.1: OK');
