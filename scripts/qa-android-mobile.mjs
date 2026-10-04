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
const insights=read('android/app/src/main/assets/mobile/insights.js');
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
const cloudMediaStore=read('android/app/src/main/java/com/nuestragalaxia/companion/CloudMediaStore.java');
const bondWorker=read('android/app/src/main/java/com/nuestragalaxia/companion/BondWorker.java');
const bondStore=read('android/app/src/main/java/com/nuestragalaxia/companion/BondStore.java');
const pushService=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java');
const galaxyNotifications=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyNotifications.java');
const pushManager=read('android/app/src/main/java/com/nuestragalaxia/companion/PushManager.java');
const widgetPrefs=read('android/app/src/main/java/com/nuestragalaxia/companion/WidgetPrefs.java');
const trackingService=read('android/app/src/main/java/com/nuestragalaxia/companion/TrackingService.java');
const updater=read('android/app/src/main/java/com/nuestragalaxia/companion/UpdateManager.java');
const edge=read('supabase/functions/android-companion/index.ts');
const serverInsights=read('supabase/functions/android-companion/insights.ts');
const dateEngine=read('supabase/functions/android-companion/date-engine.ts');
const goalsEngine=read('supabase/functions/android-companion/goals-engine.ts');
const bondEngine=read('supabase/functions/android-companion/bond-engine.ts');
const pushEngine=read('supabase/functions/android-companion/push-engine.ts');
const contextEngine=read('supabase/functions/android-companion/context-engine.ts');
const intelligenceEngine=read('supabase/functions/android-companion/intelligence-engine.ts');
const intelligenceProvider=read('supabase/functions/android-companion/intelligence-provider.ts');
const contextStore=read('android/app/src/main/java/com/nuestragalaxia/companion/ContextStore.java');
const schema=read('supabase/schema.sql');
const build=read('android/app/build.gradle.kts');
const manifest=read('android/app/src/main/AndroidManifest.xml');
const workflow=read('.github/workflows/android-companion.yml');
const chatMigration=read('supabase/migrations/20261003235000_galaxy_chat_notifications_31.sql');
const widget=read('android/app/src/main/res/layout/widget_bond.xml')+read('android/app/src/main/java/com/nuestragalaxia/companion/BondWidget.java');
const motionTest=read('android/app/src/test/java/com/nuestragalaxia/companion/MotionClassifierThresholdTest.java');

const emoji=/[☀-➿🀀-🫿]/u;
assert.equal(emoji.test(app),false,'La UI móvil no debe usar emojis/dingbats como iconos');
assert.equal(emoji.test(map),false,'El mapa móvil no debe usar emojis/dingbats como iconos');
assert.equal(emoji.test(widget),false,'El widget no debe usar emojis/dingbats como iconos');

assert.ok(existsSync(resolve(root,'android/app/src/main/assets/mobile/lucide.js')),'Falta Lucide local');
assert.ok(existsSync(resolve(root,'android/app/src/main/assets/mobile/LICENSE-lucide')),'Falta licencia de Lucide');
const scriptSources=[...index.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(scriptSources,['./lucide.js','https://www.youtube.com/iframe_api','https://open.spotify.com/embed/iframe-api/v1','./map.js','./search.js','./insights.js','./monthly.js','./today-history.js','./encounters.js','./distance.js','./eta.js','./frequent-places.js','./gps-history.js','./theme.js','./app.js'],'Solo se permiten scripts locales y los SDK oficiales de YouTube/Spotify, manteniendo Lucide primero');
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

for(const action of ['chat-state','chat-send','chat-read','chat-delete','notifications-list','notifications-read']){
 assert.ok(mainActions.has(action)&&edgeActions.has(action),'Falta '+action+' end-to-end');
}
assert.ok(index.includes('id="chatFab"')&&app.includes('function renderChatFab()'),'Galaxy Chat debe abrir desde una burbuja flotante persistente');
assert.ok(app.includes('function chatView()')&&app.includes('id="chatForm"')&&app.includes('partnerLastReadAt'),'Falta experiencia completa de Galaxy Chat');
assert.ok(app.includes("if(a==='chat-reply')")&&app.includes("if(a==='chat-delete')")&&app.includes("if(a==='chat-load-more')"),'Chat debe soportar respuesta, eliminación y paginación');
assert.ok(css.includes('.chat-fab')&&css.includes('.chat-message.own')&&css.includes('.chat-composer'),'Faltan estilos del chat flotante y conversación');
assert.ok(chatMigration.includes('galaxy_chat_messages')&&chatMigration.includes('galaxy_chat_read_state')&&chatMigration.includes('galaxy_notifications'),'Falta persistencia privada de Chat y Centro de notificaciones');
assert.ok(chatMigration.includes('enable row level security')&&chatMigration.includes('revoke all'),'Chat y notificaciones deben quedar cerrados a clientes directos');
assert.ok(pushEngine.includes('chat_message')&&pushEngine.includes('status_changed')&&pushEngine.includes('goal_update'),'Push Engine debe cubrir mensajería y actividad de producto');
assert.ok(galaxyNotifications.includes('galaxy-chat-v1')&&galaxyNotifications.includes('IMPORTANCE_HIGH')&&galaxyNotifications.includes('MessagingStyle'),'Mensajes deben usar un canal Android visible y MessagingStyle');
assert.ok(galaxyNotifications.includes('galaxy-activity-v1'),'Actividad general debe usar un canal separado');
assert.ok(pushService.includes('GalaxyNotifications.show')&&pushService.includes('chat_message'),'FCM debe rutear eventos al Notification Router');
assert.ok(main.includes('captureDeepLink')&&main.includes('onNewIntent')&&app.includes("name==='deep-link'")&&app.includes('routeGalaxyAction'),'Las notificaciones deben abrir la superficie correcta');
assert.ok(app.includes('function openNotificationCenter()')&&app.includes('header-notification-badge'),'Falta centro de notificaciones con badge');
assert.ok(bridge.includes('requestGalaxyNotifications')&&main.includes('REQ_GALAXY_NOTIFICATIONS'),'Permiso general de notificaciones debe ser independiente del sistema legacy de momentos');
for(const key of ['FIREBASE_PROJECT_ID','FIREBASE_APPLICATION_ID','FIREBASE_API_KEY','FIREBASE_SENDER_ID'])assert.ok(workflow.includes(key),'Workflow no inyecta '+key);
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
assert.ok(app.includes('function monthlySummaryTeaser()')&&app.includes('function openMonthlySummary('),'Falta compatibilidad de experiencia mensual Android');
assert.ok(app.includes('data-action="insights-month-open"')&&app.includes("api('insights-summary'"),'El mes 3.0 debe consumir Galaxy Insights');
assert.ok(mainActions.has('insights-summary')&&edgeActions.has('insights-summary'),'Falta Galaxy Insights end-to-end');
assert.ok(insights.includes('function periodFor(')&&insights.includes('function relationshipClock('),'Falta motor temporal reutilizable de Insights');
assert.ok(mainActions.has('monthly-summary')&&edgeActions.has('monthly-summary'),'Falta resumen mensual end-to-end');
assert.ok(edge.includes('async function monthlySummary(')&&edge.includes('together_seconds')&&edge.includes('mood_days'),'El backend mensual debe incluir recorridos, encuentros y conexión');
assert.ok(css.includes('.insights-metrics')&&css.includes('.monthly-highlight'),'Faltan estilos del resumen común de Insights');
assert.ok(app.includes('function insightsTeaser()')&&app.includes('function wrappedCards(')&&app.includes('function emotionalHeatmap(')&&app.includes('function achievementGrid('),'Faltan superficies Galaxy Insights 3.0');
assert.ok(css.includes('.wrapped-card')&&css.includes('.emotion-heatmap')&&css.includes('.achievement-card'),'Faltan estilos Galaxy Insights 3.0');
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
assert.ok(contextEngine.includes('signalLossGraceS')&&contextEngine.includes('ENCOUNTER_ENDED'),'Context Engine debe cerrar encuentros tras pérdida sostenida de presencia mutua');
assert.ok(css.includes('.encounter-metrics')&&css.includes('.encounter-live')&&css.includes('.encounter-recent'),'Faltan estilos del contador de encuentros');
assert.ok(distance.includes('function metersBetween(')&&distance.includes('function coupleDistance(')&&distance.includes('function distanceMood('),'Falta motor independiente de distancia de pareja');
assert.ok(app.includes('function coupleDistanceCard(')&&app.includes('function focusCoupleOnMap('),'Falta distancia entre Sebas y Adri en Android');
assert.ok(app.includes('data-action="couple-distance-map"')&&app.includes('data-action="couple-distance-focus"'),'Faltan acciones de distancia de pareja');
assert.ok(app.includes('distancia en línea recta'),'La UI debe aclarar que la distancia no es una ruta vial');
assert.ok(app.includes('function locationFreshState(')&&app.includes('Sin actualizar · hace'),'Las tarjetas de personas deben distinguir ubicaciones viejas de posiciones en vivo');
assert.ok(css.includes('.status-dot.stale')&&css.includes('.gmap-marker.stale'),'El mapa debe diferenciar visualmente una última ubicación antigua');
assert.ok(app.includes('function refreshMapNow(')&&app.includes("GalaxyNative.call('refreshLocation')"),'Actualizar mapa debe pedir una lectura GPS real al teléfono, no solo releer Supabase');
assert.ok(bridge.includes('refreshLocation')&&main.includes('void refreshLocation(')&&main.includes('CurrentLocationRequest'),'Falta actualización GPS nativa de alta precisión');
assert.ok(main.includes('ensureTrackingService()')&&main.includes('startForegroundService(new Intent(this,TrackingService.class).setAction(TrackingService.ACTION_START))'),'La app debe reactivar el servicio de ubicación al volver si el usuario dejó compartir ubicación activo');
assert.ok(css.includes('.couple-distance')&&css.includes('.couple-distance-value'),'Faltan estilos de distancia de pareja');
assert.ok(eta.includes('function movementMode(')&&eta.includes('function resolveDestination(')&&eta.includes('function eta(')&&eta.includes('function etaLabel('),'Falta motor independiente de ETA');
assert.ok(app.includes('function etaCard()')&&app.includes('function focusEtaOnMap()')&&app.includes('function etaState()'),'Falta experiencia ETA en Android');
assert.ok(app.includes('data-action="eta-focus"')&&app.includes('ETA HACIA'),'Falta navegación y tarjeta ETA');
assert.ok(app.includes('No reemplaza navegación vial'),'La interfaz ETA debe aclarar que no es navegación vial');
assert.ok(app.includes('ETA significa tiempo estimado de llegada')&&app.includes('ETA = tiempo estimado de llegada'),'La UI debe explicar ETA tanto antes como durante el cálculo');
assert.ok(app.includes('Tú no puedes actualizar su GPS desde este teléfono'),'ETA debe explicar que una ubicación stale de la pareja solo puede renovarse desde su propio dispositivo');
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
assert.ok(css.includes('--field:color-mix')&&css.includes('--good-surface:color-mix')&&css.includes('--nav-glass:color-mix'),'Los temas deben definir superficies semánticas reutilizables');
assert.equal(app.includes('background:#fff7f8'),false,'No deben quedar fondos claros inline que rompan temas oscuros');
assert.ok(css.includes('.partner-answer{background:color-mix'),'La respuesta de la pareja debe adaptarse al tema');
assert.ok(css.includes('.bottom-nav')&&css.includes('background:var(--nav-glass)'),'La navegación inferior debe respetar el tema');
assert.ok(css.includes('.universal-search-box')&&css.includes('background:var(--field)'),'El buscador debe respetar el tema');
assert.ok(css.includes('.global-player.visible')&&css.includes('background:var(--nav-glass)'),'El reproductor flotante debe respetar el tema');
assert.ok(css.includes('.nav-btn span{')&&css.includes('font-size:10px'),'Las etiquetas de navegación deben mantener proporción móvil');
assert.ok(css.includes('grid-template-columns:repeat(6,minmax(0,1fr))'),'La navegación principal debe soportar seis accesos visibles sin overflow');
assert.ok(app.includes("['ai','IA']")&&app.includes("if(view==='ai'){app.innerHTML=header()+intelligenceHubView()"),'Galaxy Intelligence debe ser una sección visible del menú principal');
assert.ok(app.includes('function cloudRenderFingerprint(')&&app.includes('function refreshStateIfChanged(')&&app.includes('requestAnimationFrame'),'El refresco de fondo debe evitar renders completos si no cambió el estado');
assert.ok(app.includes("refreshStateIfChanged().catch"),'El polling debe usar refresco condicional');
assert.ok(app.includes('function syncSystemTheme(')&&app.includes("GalaxyNative.call('setSystemTheme'"),'El tema web debe sincronizar barras nativas Android');
assert.ok(main.includes('void setSystemTheme(')&&main.includes('setStatusBarColor')&&main.includes('setNavigationBarColor'),'Android debe colorear barras del sistema según el tema');
assert.ok(bridge.includes('setSystemTheme'),'Falta puente del tema hacia Android');
assert.ok(main.includes('notificationsEnabled')&&main.includes('BondWorker.notificationsAllowed(this)'),'El estado nativo debe reportar bloqueo real del canal de notificaciones');
assert.ok(bondWorker.includes('CHANNEL="galaxy-moments-v2"')&&bondWorker.includes('NotificationManager.IMPORTANCE_DEFAULT'),'Las notificaciones de momentos deben migrar a un canal visible');
assert.ok(bondWorker.includes('void prepareNotifications')&&bondWorker.includes('enableVibration(true)'),'El canal de momentos debe configurarse explícitamente');
assert.ok(bondWorker.includes('void testNotification')&&main.includes('void testMomentNotification(')&&bridge.includes('testMomentNotification'),'Debe existir prueba end-to-end de notificaciones');
assert.ok(app.includes('data-action="moment-notification-test"')&&app.includes('Probar ahora'),'La UI debe permitir comprobar notificaciones desde el teléfono');
assert.ok(trackingService.includes('now-lastMoments>=120000')&&trackingService.includes('BondWorker.refresh'),'El servicio GPS activo debe acelerar el refresco de momentos sin hacerlo en cada punto');
assert.ok(bondStore.includes('startsWith("galaxy-moments")'),'Desactivar notificaciones debe limpiar canales activos de momentos');
assert.ok(main.includes('new ActivityResultContracts.PickMultipleVisualMedia(30)')&&main.includes('PickVisualMedia.ImageOnly.INSTANCE'),'Android debe usar el Photo Picker nativo múltiple para imágenes');
assert.ok(main.includes('void pickPhotos(')&&bridge.includes('pickPhotos'),'Falta puente nativo de Google Photos Picker');
assert.ok(main.includes('Intent.ACTION_OPEN_DOCUMENT_TREE')&&main.includes('takePersistableUriPermission'),'Drive compartido debe usar un árbol de documentos con acceso persistente');
assert.ok(main.includes('void syncDriveFolder(')&&main.includes('collectDriveImages(')&&bridge.includes('syncDriveFolder'),'Falta sincronización nativa de carpeta Drive');
assert.ok(main.includes('DocumentsContract.buildChildDocumentsUriUsingTree')&&main.includes('DocumentsContract.buildDocumentUriUsingTree'),'La sincronización Drive debe recorrer el árbol seleccionado');
assert.ok(main.includes('image/jpeg')&&main.includes('image/png')&&main.includes('image/webp')&&main.includes('12L*1024L*1024L'),'Drive debe limitar formatos y tamaño de fotos');
assert.ok(main.includes('out.size()>=250')&&main.includes('depth>5'),'Drive debe tener límites de recorrido para evitar bloqueos');
assert.ok(cloudMediaStore.includes('KEY_DRIVE_URI')&&cloudMediaStore.includes('KEY_DRIVE_IMPORTED')&&cloudMediaStore.includes('markImported'),'Falta persistencia local de carpeta Drive y deduplicación');
assert.ok(app.includes('Google Photos Picker')&&app.includes('Google Drive compartido'),'El álbum debe exponer ambas fuentes Google');
assert.ok(app.includes("data-action=\"photos-picker\"")&&app.includes("data-action=\"drive-sync\"")&&app.includes("data-action=\"drive-folder-disconnect\""),'Faltan acciones UI de Photos Picker/Drive');
assert.ok(app.includes('Las fotos elegidas o sincronizadas se copian al álbum privado'),'La UI debe explicar el modelo de copia privada');
assert.ok(css.includes('.cloud-album-card')&&css.includes('.cloud-source-note')&&css.includes('.cloud-sync-progress'),'Faltan estilos de integración Google del álbum');
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
assert.ok(widget.includes('widgetModules')&&widget.includes('moduleValue')&&widget.includes('"mood"'),'El Widget 2.0 debe conservar el estado Ahora mediante módulos dinámicos');
assert.ok(edge.includes('p.share_battery?p.battery:null')&&edge.includes('p.share_song?text(p.song_title,160):""'),'El widget no debe exponer batería o música sin opt-in');
assert.ok(edge.includes('sharing:!!loc?.sharing')&&edge.includes('listening'),'El widget debe conservar el contrato sharing/listening');

assert.ok(edge.includes('body.detail!==true'),'El mapa debe tener refresco ligero');
assert.ok(app.includes("refreshMap({quiet:true,detail:false})"),'El polling del mapa debe usar refresco ligero');
assert.ok(app.includes("document.visibilityState!=='visible'"),'La app debe pausar polling fuera de primer plano');
assert.ok(app.includes('editingNow()'),'La sincronización automática debe respetar formularios en edición');
assert.ok(app.includes("memoriesTabsScroll=0")&&app.includes("$('.memories-tabs')")&&app.includes("tabs.scrollLeft=memoriesTabsScroll"),'Las etiquetas de Recuerdos deben conservar su posición horizontal después de renderizar');
assert.ok(app.includes('class="chips memories-tabs"'),'La barra de etiquetas de Recuerdos necesita un selector estable para restaurar el scroll');
assert.ok(app.includes("WELCOME_KEY='nuestra-galaxia.adri-welcome.v1'"),'Falta persistencia de la bienvenida de Adri');
assert.ok(app.includes("String(native.person)==='1'"),'La bienvenida especial debe limitarse a Adri/person 1');
assert.ok(app.includes("welcomePreview||(String(native.person)==='1'&&!welcomeDone())"),'El preview de Sebas debe poder abrir la bienvenida sin alterar la regla real de Adri');
assert.ok(app.includes("data-action=\"welcome-next\""),'Falta navegación de la bienvenida');
assert.ok(app.includes("data-action=\"welcome-skip\""),'La bienvenida debe poder omitirse');
assert.ok(app.includes("data-action=\"welcome-replay\""),'Falta opción para volver a ver la bienvenida');
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'),'La bienvenida debe respetar reducir movimiento');
assert.equal(motionTest.includes('placeholderKeepsUnitTestTaskActive'),false,'La prueba de movimiento no puede ser placeholder');
assert.ok(motionTest.includes('medianIgnoresSingleGpsSpeedSpike'),'Falta prueba de ruido GPS');


// Galaxy Date Engine 3.0
assert.ok(main.includes('"date-engine"')&&edge.includes('action==="date-engine"'),'Galaxy Date debe estar permitido end-to-end');
assert.ok(dateEngine.includes('selectQuestion')&&dateEngine.includes('buildSurpriseExperience')&&dateEngine.includes('buildSequentialPlan'),'Galaxy Date necesita un motor contextual determinístico');
assert.ok(schema.includes('galaxy_daily_questions')&&schema.includes('question_id text')&&schema.includes('favorite boolean'),'Galaxy Date debe estabilizar la pregunta diaria sin duplicar respuestas');
assert.ok(app.includes('function dailyQuestionCard(')&&app.includes('function loadDateContext('),'Galaxy Date debe reemplazar la pregunta diaria aislada por contexto reutilizable');
assert.ok(app.includes('function openDateMode(')&&app.includes('date-mode-camera')&&app.includes('date-mode-save'),'Galaxy Date debe incluir Modo Cita completo');
assert.ok(app.includes('function openSurprise2(')&&app.includes('function openPlanRoulette(')&&app.includes('function openDatePlanner('),'Galaxy Date debe reutilizar el mismo motor para sorpresa, ruleta y planner');
assert.ok(main.includes('MediaStore.ACTION_IMAGE_CAPTURE')&&bridge.includes('capturePhoto'),'Modo Cita debe tener cámara nativa');
assert.ok(css.includes('.plan-roulette')&&css.includes('@media(prefers-reduced-motion:reduce)'),'La ruleta de Galaxy Date debe respetar reduced-motion');


// Galaxy Goals Engine 3.0
assert.ok(main.includes('"goals-engine"')&&edge.includes('action==="goals-engine"'),'Galaxy Goals debe estar permitido end-to-end');
assert.ok(goalsEngine.includes('normalizeGoalInput')&&goalsEngine.includes('computeGoalProgress')&&goalsEngine.includes('buildGoalInsightSummary'),'Galaxy Goals necesita dominio determinístico y progreso derivado');
assert.ok(schema.includes('galaxy_goals')&&schema.includes('galaxy_goal_steps')&&schema.includes('galaxy_goal_contributions'),'Galaxy Goals debe usar tablas relacionales');
assert.ok(schema.includes('enable row level security')&&schema.includes('from public,anon,authenticated'),'Galaxy Goals debe quedar cerrado al acceso directo del cliente');
assert.ok(app.includes('function goalsView(')&&app.includes('function openGoalDetail(')&&app.includes('Aportes manuales'),'Galaxy Goals debe tener experiencia móvil completa');
assert.ok(app.includes("if(view==='goals'){app.innerHTML=header()+goalsView()")&&app.includes("if(a==='goals-open'){go('goals');await loadGoals(true);return;}"),'Galaxy Goals debe renderizarse y cargar desde su acceso visible');
assert.ok(app.includes('goal-convert-item')&&app.includes("['plan','wish'].includes(i.kind)"),'Planes y deseos deben poder convertirse sin cambiar su modelo actual');
assert.ok(app.includes('Sin conexión bancaria')&&goalsEngine.includes('No se permiten campos bancarios'),'Galaxy Goals no puede convertirse en integración bancaria');
assert.ok(dateEngine.includes('context.goalSuggestions')&&!dateEngine.includes('galaxy_goals'),'Date Engine solo puede recibir sugerencias genéricas de Goals');
assert.ok(edge.includes('buildGoalInsightSummary')&&app.includes('goalsCompleted')&&app.includes('savingsAchieved'),'Insights debe mostrar actividad de objetivos sin duplicar su modelo');
assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Goals Engine */')&&css.includes('.goal-card'),'Faltan estilos de Galaxy Goals');


// Galaxy Bond Engine 2.0
assert.ok(bondEngine.includes('computeBondProgress')&&bondEngine.includes('gardenState')&&bondEngine.includes('recordStreak'),'Galaxy Bond Engine 2.0 necesita días acumulados, racha y récord');
assert.ok(schema.includes('galaxy_bond_gestures')&&schema.includes('galaxy_push_tokens')&&schema.includes('galaxy_push_subscriptions'),'Galaxy Bond Engine 2.0 requiere catálogo y routing push relacional');
assert.ok(edge.includes('bond-send-gesture')&&edge.includes('dispatchPushEvent')&&edge.includes('FCM_SERVICE_ACCOUNT_JSON'),'Galaxy Bond Engine 2.0 debe usar eventos push reutilizables');
assert.ok(pushEngine.includes('arrived_safe')&&pushEngine.includes('nearby')&&pushEngine.includes('capsule')&&pushEngine.includes('note')&&pushEngine.includes('reminder'),'La capa push debe quedar preparada para futuros eventos');
assert.ok(build.includes('com.google.firebase:firebase-messaging:25.1.3'),'Falta Firebase Messaging');
assert.ok(manifest.includes('com.google.firebase.MESSAGING_EVENT')&&manifest.includes('android.permission.VIBRATE'),'Falta registrar FCM/hápticos');
assert.ok(pushService.includes('onNewToken')&&pushService.includes('onMessageReceived')&&pushService.includes('hapticEnabled()'),'FCM debe manejar rotación y respetar opt-in háptico');
assert.equal(pushService.includes('TrackingService.ACTION_START'),false,'Push no puede iniciar ubicación');
assert.ok(main.includes('setBondHaptics')&&bridge.includes('setBondHaptics')&&bondStore.includes('hapticEnabled()'),'Hápticos necesitan control explícito por usuario');
assert.ok(pushManager.includes('bond.enabled()||bond.hapticEnabled()'),'El gesto push solo se suscribe cuando notificación o háptico están habilitados');
assert.ok(widgetPrefs.includes('photo')&&widgetPrefs.includes('distance')&&widgetPrefs.includes('eta')&&widgetPrefs.includes('garden'),'WidgetPrefs debe controlar módulos de Widget 2.0');
assert.ok(widget.includes('getAppWidgetOptions')&&widget.includes('compact')&&widget.includes('WidgetPrefs'),'Widget 2.0 debe adaptarse a tamaño y preferencias');
assert.ok(app.includes('Nuestro jardín')&&app.includes('currentStreak')&&app.includes('recordStreak')&&app.includes('bond-gesture-new')&&app.includes('bond-haptics'),'La UI debe exponer jardín, rachas, gestos y hápticos');
assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Bond Engine 2.0 */')&&css.includes('.bond-garden-scene'),'Faltan estilos del jardín 2.0');
assert.ok(serverInsights.includes('current_streak')&&serverInsights.includes('record_streak')&&serverInsights.includes('gestures'),'Insights debe consumir métricas Bond 2.0');
assert.equal(build.includes('FCM_SERVICE_ACCOUNT_JSON')||main.includes('FCM_SERVICE_ACCOUNT_JSON')||app.includes('FCM_SERVICE_ACCOUNT_JSON'),false,'La credencial privada FCM jamás puede entrar al cliente');


// Galaxy Context Engine
assert.ok(contextEngine.includes('contextStep')&&contextEngine.includes('SHARED_TRIP_DETECTED')&&contextEngine.includes('DESTINATION_REACHED'),'Galaxy Context Engine requiere máquina común de eventos derivados');
assert.ok(schema.includes('galaxy_context_events')&&schema.includes('galaxy_context_sessions')&&schema.includes('galaxy_context_eta_history'),'Falta persistencia privada de Context Engine');
assert.ok(edge.includes('async function contextTick(')&&edge.includes('await contextTick(d)'),'La ubicación debe alimentar un único Context Engine');
const locationBlock=edge.slice(edge.indexOf('async function location('),edge.indexOf('function nextCalendarEvent'));
assert.equal(locationBlock.includes('await smartPlaces(')||locationBlock.includes('await encounter('),false,'Location no debe ejecutar detectores GPS independientes');
assert.ok(main.includes('context-state')&&main.includes('context-settings')&&main.includes('context-session'),'Android debe permitir las acciones de Context Engine');
assert.ok(contextStore.includes('nearbyEnabled')&&contextStore.includes('arrivedSafeEnabled'),'ContextStore debe preservar opt-ins push');
assert.ok(pushManager.includes('nearbyEnabled()')&&pushManager.includes('arrivedSafeEnabled()'),'FCM debe respetar preferencias Context locales');
assert.equal(contextStore.includes('TrackingService.ACTION_START'),false,'ContextStore jamás puede encender ubicación');
assert.ok(app.includes('Galaxy Context Engine')&&app.includes('Estamos cerca')&&app.includes('Regreso a casa')&&app.includes('Acompáñame 2.0'),'Faltan superficies Context Engine');
assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Context Engine */'),'Faltan estilos Context Engine');
assert.ok(css.includes('.context-controls{display:grid;grid-template-columns:1fr')&&css.includes('@media(min-width:560px){.context-controls{grid-template-columns:repeat(2,minmax(0,1fr))}}'),'Context Engine debe apilar controles en móvil y usar dos columnas solo con ancho suficiente');
assert.ok(css.includes('.context-controls .btn{width:100%;max-width:100%'),'Los botones de Context no pueden desbordar sus tarjetas');
assert.ok(edge.includes('buildDateContextRecap')&&edge.includes('buildTripContextRecap'),'Faltan recaps contextuales');
assert.ok(edge.includes('galaxy_context_suggestions')&&app.includes('¿Esto fue una cita?'),'El detector de cita debe pedir confirmación humana');


// Galaxy Intelligence Engine
assert.ok(schema.includes('create extension if not exists vector')&&schema.includes('extensions.vector(384)')&&schema.includes('using hnsw'),'Galaxy Intelligence Engine requiere pgvector 384d + HNSW');
assert.ok(schema.includes('galaxy_intelligence_hybrid_search')&&schema.includes('ts_rank_cd')&&schema.includes('<=>'),'La búsqueda híbrida debe combinar exacto, FTS y similitud vectorial');
assert.ok(intelligenceEngine.includes('buildIntelligenceDocument')&&intelligenceEngine.includes('mergeHybridRanks')&&intelligenceEngine.includes('validateNarrative'),'Galaxy Intelligence Engine necesita proyección, ranking y grounding determinísticos');
assert.ok(intelligenceProvider.includes('gte-small')&&intelligenceProvider.includes('OPENAI_API_KEY'),'Embeddings y proveedor deben quedar solo en backend');
assert.equal(app.includes('OPENAI_API_KEY')||main.includes('OPENAI_API_KEY'),false,'Nunca exponer claves de IA al cliente');
assert.ok(main.includes('"intelligence-search"')&&edge.includes('action==="intelligence-search"'),'Intelligence Search debe estar permitido end-to-end');
assert.ok(edge.includes('intelligence-ask')&&edge.includes('intelligence-connections')&&edge.includes('intelligence-narrate')&&edge.includes('intelligence-book'),'Faltan servicios de Galaxy Intelligence');
assert.ok(search.includes('function searchUniverse(')&&app.includes('GalaxySearch.searchUniverse'),'La búsqueda clásica debe sobrevivir como fallback');
assert.ok(app.includes('Nuestra IA 2.0')&&app.includes('IA de conexiones')&&app.includes('IA narradora')&&app.includes('Libro de Nuestra Galaxia'),'Faltan superficies de Intelligence Engine');
assert.ok(app.includes('function intelligenceHubView(')&&app.includes('PREGÚNTALE A SU HISTORIA'),'Galaxy Intelligence necesita un hub principal visible, no solo una tarjeta en Ajustes');
assert.ok(app.includes('Transcribir')&&app.includes('Eliminar transcripción'),'Voz 2.0 debe controlar la transcripción por separado');
assert.ok(edge.includes('syncIntelligenceItem(updated)')&&edge.includes('syncIntelligenceItem(created)')&&edge.includes('deleteIntelligenceSource("item"'),'El índice debe actualizarse incrementalmente');
assert.ok(schema.includes('galaxy_voice_transcripts')&&edge.includes('audioPreserved:true'),'Eliminar transcripción no puede borrar el audio');
assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Intelligence Engine */'),'Faltan estilos de Galaxy Intelligence Engine');

console.log('QA móvil Nuestra Galaxia: OK');
