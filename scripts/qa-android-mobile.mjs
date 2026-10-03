import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

const app=read('android/app/src/main/assets/mobile/app.js');
const map=read('android/app/src/main/assets/mobile/map.js');
const search=read('android/app/src/main/assets/mobile/search.js');
const monthly=read('android/app/src/main/assets/mobile/monthly.js');
const todayHistory=read('android/app/src/main/assets/mobile/today-history.js');
const encounters=read('android/app/src/main/assets/mobile/encounters.js');
const distance=read('android/app/src/main/assets/mobile/distance.js');
const eta=read('android/app/src/main/assets/mobile/eta.js');
const frequentPlaces=read('android/app/src/main/assets/mobile/frequent-places.js');
const gpsHistory=read('android/app/src/main/assets/mobile/gps-history.js');
const theme=read('android/app/src/main/assets/mobile/theme.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const index=read('android/app/src/main/assets/mobile/index.html');
const lucideSource=read('android/app/src/main/assets/mobile/lucide.js');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const bridge=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
const pendingPoints=read('android/app/src/main/java/com/nuestragalaxia/companion/PendingPointStore.java');
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
assert.deepEqual(scriptSources,['./lucide.js','https://www.youtube.com/iframe_api','https://open.spotify.com/embed/iframe-api/v1','./map.js','./search.js','./monthly.js','./today-history.js','./encounters.js','./distance.js','./eta.js','./frequent-places.js','./gps-history.js','./theme.js','./app.js'],'Solo se permiten scripts locales y los SDK oficiales de YouTube/Spotify, manteniendo Lucide primero');
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
for(const action of ['presence-set','backup-export','backup-import','pair-code-create','profile-repair','device-revoke'])assert.ok(mainActions.has(action)&&edgeActions.has(action),'Falta '+action+' end-to-end');
assert.ok(app.includes('function deviceProfilesCard()'),'Falta administración visible de perfiles y teléfonos');
assert.ok(app.includes("data-action=\"pair-code-partner\"")&&app.includes("data-action=\"profile-repair\""),'Falta flujo explícito para Adri');
assert.ok(main.includes('store.setPerson(repaired)'),'La reparación de perfil debe sincronizar la identidad local');
assert.ok(bridge.includes('copyText')&&main.includes('ClipboardManager'),'El código de vinculación debe poder copiarse de forma nativa');
assert.ok(edge.includes('action==="backup-restore"')&&edge.includes('action==="backup-import"'),'La API debe mantener compatibilidad con restauraciones de 2.1.0');
assert.ok(app.includes('function nowCard()')&&app.includes('Privacidad de “Ahora”'),'Falta panel Ahora con privacidad');
assert.ok(app.includes('function historyPlacesView()')&&app.includes('placeId'),'Falta mapa histórico enlazado a recuerdos');
assert.ok(app.includes('function openOurAI()')&&app.includes('function aiResult(question)'),'Falta Nuestra IA sobre la historia');
assert.ok(search.includes('function searchUniverse(')&&search.includes('normalizeSearch'),'Falta motor independiente de búsqueda universal');
assert.ok(app.includes('function openUniversalSearch()')&&app.includes('function openUniversalSearchResult(btn)'),'Falta interfaz de búsqueda universal Android');
assert.ok(app.includes('data-action="universal-search-open"')&&app.includes('data-action="universal-search-result"'),'Faltan accesos del buscador universal');
assert.ok(css.includes('.universal-search-result')&&css.includes('.search-hit'),'Faltan estilos del buscador universal');
assert.ok(monthly.includes('function shiftMonth(')&&monthly.includes('function summaryHasActivity('),'Falta módulo mensual independiente');
assert.ok(app.includes('function monthlySummaryTeaser()')&&app.includes('function openMonthlySummary('),'Falta experiencia mensual Android');
assert.ok(app.includes('data-action="monthly-summary-open"')&&app.includes("api('monthly-summary'"),'Falta acceso al resumen mensual');
assert.ok(mainActions.has('monthly-summary')&&edgeActions.has('monthly-summary'),'Falta resumen mensual end-to-end');
assert.ok(edge.includes('async function monthlySummary(')&&edge.includes('together_seconds')&&edge.includes('mood_days'),'El backend mensual debe incluir recorridos, encuentros y conexión');
assert.ok(css.includes('.monthly-metrics')&&css.includes('.monthly-highlight'),'Faltan estilos del resumen mensual');
assert.ok(todayHistory.includes('sameMonthDay')&&todayHistory.includes('function anniversaryLabel(')&&todayHistory.includes('function groupHasActivity('),'Falta módulo independiente de Un día como hoy');
assert.ok(app.includes('function todayHistoryTeaser()')&&app.includes('function openTodayHistory(')&&app.includes('function openTodayHistoryItem('),'Falta experiencia completa de Un día como hoy');
assert.ok(app.includes('data-action="today-history-open"')&&app.includes("api('today-history'"),'Falta acceso a Un día como hoy');
assert.ok(mainActions.has('today-history')&&edgeActions.has('today-history'),'Falta Un día como hoy end-to-end');
assert.ok(edge.includes('async function todayHistory(')&&edge.includes('together_seconds')&&edge.includes('mood_together')&&edge.includes('galaxy_place_events'),'El historial del día debe reconstruir actividad completa');
assert.ok(css.includes('.today-history-year')&&css.includes('.today-history-chip')&&css.includes('.today-history-item'),'Faltan estilos de Un día como hoy');
assert.ok(encounters.includes('function durationLabel(')&&encounters.includes('function totalWithActive('),'Falta módulo independiente de encuentros');
assert.ok(app.includes('function encounterStatsTeaser()')&&app.includes('function openEncounterStats('),'Falta contador de encuentros Android');
assert.ok(app.includes('data-action="encounter-stats-open"')&&app.includes("api('encounter-stats'"),'Falta acceso al contador de encuentros');
assert.ok(mainActions.has('encounter-stats')&&edgeActions.has('encounter-stats'),'Falta contador de encuentros end-to-end');
assert.ok(edge.includes('async function encounterStats(')&&edge.includes('average_seconds')&&edge.includes('current_month')&&edge.includes('longest'),'El backend debe calcular estadísticas completas de encuentros');
assert.ok(edge.includes('if(!locs||locs.length!==2')&&edge.includes('update({ended_at:new Date().toISOString()})'),'El detector debe cerrar encuentros cuando deja de existir presencia mutua');
assert.ok(css.includes('.encounter-metrics')&&css.includes('.encounter-live')&&css.includes('.encounter-recent'),'Faltan estilos del contador de encuentros');
assert.ok(distance.includes('function metersBetween(')&&distance.includes('function coupleDistance(')&&distance.includes('function distanceMood('),'Falta motor independiente de distancia de pareja');
assert.ok(app.includes('function coupleDistanceCard(')&&app.includes('function focusCoupleOnMap('),'Falta distancia entre Sebas y Adri en Android');
assert.ok(app.includes('data-action="couple-distance-map"')&&app.includes('data-action="couple-distance-focus"'),'Faltan acciones de distancia de pareja');
assert.ok(app.includes('distancia en línea recta'),'La UI debe aclarar que la distancia no es una ruta vial');
assert.ok(css.includes('.couple-distance')&&css.includes('.couple-distance-value'),'Faltan estilos de distancia de pareja');
assert.ok(eta.includes('function movementMode(')&&eta.includes('function resolveDestination(')&&eta.includes('function eta(')&&eta.includes('function etaLabel('),'Falta motor independiente de ETA');
assert.ok(app.includes('function etaCard()')&&app.includes('function focusEtaOnMap()')&&app.includes('function etaState()'),'Falta experiencia ETA en Android');
assert.ok(app.includes('data-action="eta-focus"')&&app.includes('ETA HACIA'),'Falta navegación y tarjeta ETA');
assert.ok(app.includes('No reemplaza navegación vial'),'La interfaz ETA debe aclarar que no es navegación vial');
assert.ok(app.includes("current==='person:'")&&app.includes("current==='place:'"),'Acompáñame debe recordar el destino activo');
assert.ok(css.includes('.eta-card')&&css.includes('.eta-value')&&css.includes('.eta-actions'),'Faltan estilos del ETA');
assert.ok(frequentPlaces.includes('function suggestionKey(')&&frequentPlaces.includes('function visibleSuggestions(')&&frequentPlaces.includes('function dismiss('),'Falta módulo de sugerencias frecuentes');
assert.ok(app.includes('function frequentPlacesView()')&&app.includes('function loadFrequentPlaces(')&&app.includes('function openFrequentPlaceSuggestion('),'Falta experiencia de lugares frecuentes');
assert.ok(app.includes('data-action="frequent-place-save"')&&app.includes('data-action="frequent-place-dismiss"')&&app.includes('data-action="frequent-place-focus"'),'Faltan acciones de lugares frecuentes');
assert.ok(mainActions.has('frequent-places')&&edgeActions.has('frequent-places'),'Falta detección de lugares frecuentes end-to-end');
assert.ok(edge.includes('async function frequentPlaces(')&&edge.includes('function frequentPlaceCandidates('),'Falta detector backend de permanencias frecuentes');
assert.ok(edge.includes('.eq("person",person)')&&edge.includes('galaxy_location_history'),'La detección debe analizar solo el historial del perfil autenticado');
assert.ok(edge.includes('x.days>=3')&&edge.includes('x.dwell_minutes>=45')&&edge.includes('dist(cluster,p)<=180'),'El detector debe exigir repetición, permanencia y excluir lugares ya guardados');
assert.ok(app.includes('Nada se guarda sin que tú lo decidas')&&app.includes('No guarda lugares automáticamente'),'La UI debe explicar que la detección solo sugiere');
assert.ok(css.includes('.frequent-place-card')&&css.includes('.frequent-place-privacy'),'Faltan estilos de lugares frecuentes');
assert.ok(gpsHistory.includes("DATASETS=['history','trips','tripPoints','placeEvents']")&&gpsHistory.includes('function validDeleteConfirmation(')&&gpsHistory.includes('function appendPage('),'Falta módulo individual de historial GPS');
assert.ok(app.includes('function gpsHistoryPrivacyCard()')&&app.includes('function exportGpsHistory()')&&app.includes('function deleteGpsHistory()'),'Falta experiencia de privacidad GPS individual');
assert.ok(app.includes('data-action="gps-history-export"')&&app.includes('data-action="gps-history-delete-open"'),'Faltan acciones de historial GPS individual');
assert.ok(mainActions.has('gps-history-export')&&edgeActions.has('gps-history-export')&&mainActions.has('gps-history-delete')&&edgeActions.has('gps-history-delete'),'Falta historial GPS individual end-to-end');
assert.ok(edge.includes('async function gpsHistoryExport(')&&edge.includes('snapshot')&&edge.includes('.limit(requested)'),'La exportación GPS debe ser paginada y estable');
const gpsDeleteBlock=edge.match(/async function gpsHistoryDelete\([\s\S]*?(?=\nasync function mapState)/)?.[0]||'';
assert.ok(gpsDeleteBlock.includes('galaxy_location_history')&&gpsDeleteBlock.includes('galaxy_trip_history')&&gpsDeleteBlock.includes('galaxy_trip_points')&&gpsDeleteBlock.includes('galaxy_place_events'),'El borrado GPS debe cubrir todas las fuentes individuales de movilidad');
assert.equal(gpsDeleteBlock.includes('galaxy_places').toString(),false.toString(),'El borrado GPS no debe borrar lugares guardados');
assert.equal(gpsDeleteBlock.includes('galaxy_encounters').toString(),false.toString(),'El borrado GPS no debe borrar encuentros compartidos');
assert.ok(gpsDeleteBlock.includes('.eq("person",person)'),'El borrado GPS debe limitarse al perfil autenticado');
assert.ok(gpsDeleteBlock.includes('if(loc.trip_active)'),'No se debe borrar historial en medio de un recorrido activo');
assert.ok(bridge.includes('clearPendingGps')&&main.includes('clearPendingGps')&&pendingPoints.includes('synchronized int clear()'),'Android debe limpiar la cola GPS local después del borrado');
assert.ok(app.includes("validDeleteConfirmation(value)")&&app.includes('Escribe BORRAR exactamente'),'El borrado GPS requiere confirmación escrita');
assert.ok(app.includes("GalaxyNative.call('stopLocation')")&&app.includes("GalaxyNative.call('clearPendingGps')"),'El borrado GPS debe pausar tracking y limpiar puntos pendientes');
assert.ok(css.includes('.gps-history-card')&&css.includes('.gps-delete-warning')&&css.includes('.gps-preserved'),'Faltan estilos de privacidad GPS individual');
assert.ok(theme.includes("THEMES=['auto','daylight','cosmic','halloween','christmas','valentine','friendship','easter']")&&theme.includes('function seasonal(')&&theme.includes('function applyTheme('),'Falta motor Android de temas estacionales');
for(const seasonalName of ['halloween','christmas','valentine','friendship','easter'])assert.ok(theme.includes("return'"+seasonalName+"'"),'Falta ventana automática de '+seasonalName);
assert.ok(app.includes('function themeSettingsCard()')&&app.includes('data-action="theme-set"'),'Falta selector Android de temas');
assert.ok(app.includes('GalaxyTheme?.applyTheme')&&app.includes('GalaxyTheme.getChoice()'),'Android debe reaplicar el tema elegido al renderizar');
assert.ok(css.includes('html[data-theme="cosmic"]')&&css.includes('html[data-theme="halloween"]')&&css.includes('html[data-theme="christmas"]')&&css.includes('html[data-theme="valentine"]')&&css.includes('html[data-theme="friendship"]')&&css.includes('html[data-theme="easter"]'),'Faltan paletas estacionales completas');
assert.ok(css.includes('.theme-grid')&&css.includes('.theme-preview[data-preview="auto"]'),'Faltan controles visuales de temas');
assert.ok(app.includes('La apariencia se guarda en este teléfono'),'El selector debe aclarar que el tema es local por teléfono');
assert.ok(edge.includes('async function backupExport')&&edge.includes('async function backupRestore'),'Falta backup seguro en backend');
const backupSection=edge.slice(edge.indexOf('async function backupExport'),edge.indexOf('async function recordParticipation'));
assert.ok(!backupSection.includes('galaxy_presence')&&!backupSection.includes('share_battery')&&!backupSection.includes('share_song'),'El backup no debe restaurar permisos de presencia');

const nativeCalls=new Set([...app.matchAll(/GalaxyNative\.call\(['"]([^'"]+)['"]/g)].map(m=>m[1]));
const bridgeMethods=new Set([...bridge.matchAll(/public void (\w+)\(/g)].map(m=>m[1]));
for(const method of nativeCalls)assert.ok(bridgeMethods.has(method),'Método nativo sin bridge: '+method);
assert.ok(bridgeMethods.has('closeApp')&&app.includes('GalaxyAndroid.closeApp()'),'El botón Atrás debe poder cerrar la app desde Inicio');
assert.ok(bridgeMethods.has('exportJson')&&bridgeMethods.has('importJson'),'Faltan puentes nativos de backup');
assert.ok(main.includes('REQ_BACKUP_EXPORT')&&main.includes('REQ_BACKUP_IMPORT'),'Falta Storage Access Framework para backups');

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
assert.ok(widget.includes('widgetNow')&&widget.includes('nowText'),'El widget debe mostrar el estado Ahora');
assert.ok(edge.includes('p.share_battery?p.battery:null')&&edge.includes('p.share_song?text(p.song_title,160):""'),'El widget no debe exponer batería o música sin opt-in');
assert.ok(edge.includes('sharing:!!loc?.sharing')&&edge.includes('listening'),'El widget debe conservar el contrato sharing/listening');

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

console.log('QA móvil Nuestra Galaxia: OK');
