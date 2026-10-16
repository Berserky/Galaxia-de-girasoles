import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const asset=resolve(root,'android/app/src/main/assets/mobile');
const file=name=>readFileSync(resolve(asset,name),'utf8');
const moduleCode=file('galaxy-journeys-v5.js'),styles=file('galaxy-journeys-v5.css');
const app=file('app.js'),html=file('index.html'),mapEngine=file('map.js');
const sandbox={};
runInNewContext(moduleCode,sandbox,{timeout:1500});
const journeys=sandbox.GalaxyJourneysV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=name=>'<i aria-hidden="true">'+esc(name)+'</i>';
const now=Date.parse('2026-10-15T12:00:00Z');
const observedAt=ms=>new Date(now-ms).toISOString();
const where=(sharing,ageMs)=>({person:'0',sharing,latitude:4.711,longitude:-74.072,updated_at:observedAt(ageMs)});

test('P4: location freshness is honest for paused, missing, stale and fresh signals',()=>{
 assert.equal(journeys.freshness(where(false,1000),now).kind,'paused');
 assert.equal(journeys.freshness(null,now).kind,'missing');
 assert.equal(journeys.freshness({sharing:true,latitude:null,longitude:-74.1,updated_at:observedAt(1000)},now).kind,'missing');
 assert.equal(journeys.freshness({sharing:true,latitude:92,longitude:-74.1,updated_at:observedAt(1000)},now).kind,'missing');
 assert.equal(journeys.freshness(where(true,60*1000),now).kind,'fresh');
 assert.equal(journeys.freshness(where(true,11*60*1000),now).kind,'stale');
 assert.match(journeys.freshness(where(true,11*60*1000),now).detail,/11 min/);
 assert.equal(journeys.freshness(where(true,now+60*1000),now).kind,'stale');
 assert.equal(journeys.FRESH_MS,10*60*1000);
});

test('P4: no private coordinates or stale-as-live claims in summary; names are escaped',()=>{
 const htmlText=journeys.renderPresence([where(true,12*60*1000),
   {...where(false,1000),person:'1'}],'0',['<img src=x>','Pareja'],{esc,ico,now});
 assert.match(htmlText,/aria-label="Antigüedad de ubicaciones"/);
 assert.match(htmlText,/journey-presence stale/);
 assert.match(htmlText,/Última señal histórica/);
 assert.match(htmlText,/journey-presence paused/);
 assert.match(htmlText,/Ubicación pausada/);
 assert.doesNotMatch(htmlText,/(-74\.072|4\.711|<img)/);
 const swapped=journeys.renderPresence([where(true,1000),
   {...where(true,1000),person:'1'}],'1',['<img src=x>','Pareja'],{esc,ico,now});
 assert.match(swapped,/Tu ubicación/);
 assert.match(swapped,/&lt;img src=x&gt;/);
 assert.equal((swapped.match(/class="journey-presence /g)||[]).length,2);
});

test('P4: module is a read-only presenter and is loaded before map view runtime',()=>{
 assert.doesNotMatch(moduleCode,/fetch\s*\(|\bGalaxyNative\b|\bSupabase\b|localStorage|geolocation|getCurrentPosition|watchPosition/);
 assert.match(html,/href="\.\/galaxy-journeys-v5\.css"/);
 assert.match(html,/src="\.\/galaxy-journeys-v5\.js"[\s\S]*src="\.\/app\.js"/);
 assert.match(app,/window\.GalaxyJourneysV5\?\.renderPresence\(/);
 assert.match(app,/mapData\?\.locations\?\.length\?mapData\.locations:\(cloud\?\.locations\|\|\[\]\)/);
});

test('P4: immersive map has accessible exit, Escape and preserves original map engine',()=>{
 assert.match(app,/data-action="map-immersive-toggle"/);
 assert.match(app,/aria-pressed="'\+String\(mapImmersive\)/);
 assert.match(app,/aria-label="'\+\(mapImmersive\?'Cerrar mapa ampliado'/);
 assert.match(app,/if\(a==='map-immersive-toggle'\)\{toggleImmersiveMap\(\);return;\}/);
 assert.match(app,/if\(e\.key==='Escape'&&mapImmersive&&!modal\.open\)toggleImmersiveMap\(false\)/);
 assert.match(app,/if\(next!=='map'\)\{mapImmersive=false;document\.body\.classList\.remove\('map-immersive-open'\)/);
 assert.match(app,/map\?\.scheduleRender\?\.\(\)/);
 assert.match(styles,/\.journey-map-region\.immersive\s*\{/);
 assert.match(styles,/\.journey-map-region\.immersive #map\s*\{[^}]*height:100%/);
 assert.match(styles,/100dvh/);
 assert.match(styles,/env\(safe-area-inset-top\)/);
 assert.match(styles,/min-height:44px/);
 assert.match(styles,/focus-visible/);
 assert.match(styles,/prefers-reduced-motion:reduce/);
 assert.match(mapEngine,/class GalaxyMap\s*\{/);
 assert.match(app,/map\.addPolyline\(points/);
});

test('P4: journey panel retains distance, ETA, transport, GPS and destinations routes',()=>{
 assert.match(app,/class="journey-companion" aria-label="Distancia y llegada"/);
 assert.match(app,/coupleDistanceCard\(\{mapMode:true\}\)\+etaCard\(\)/);
 assert.match(app,/aria-label="Modo de transporte habitual"/);
 assert.match(app,/aria-pressed="'\+String\(\(own\.transport_preference\|\|''\)===value\)/);
 for(const action of ['map-refresh','location-start','location-stop','transport-set','trip-toggle','destination','context-session-stop']){
  assert.match(app,new RegExp("a==='"+action+"'"));
 }
 assert.match(app,/role="region" aria-label="Mapa interactivo de nuestra galaxia"/);
 assert.match(app,/aria-controls="statusMenu"/);
 assert.doesNotMatch(moduleCode,/latitude\s*:\s*4\.711|longitude\s*:\s*-74\.072/);
});

test('P4: invalid or absent GPS coordinates never become a recent map marker',()=>{
 const valid=app.slice(app.indexOf('function mapLocationValid('),
   app.indexOf('function ageDurationLabel('));
 assert.match(valid,/location\?\.latitude==null\|\|location\?\.longitude==null/);
 assert.match(valid,/Number\.isFinite\(lat\)&&Number\.isFinite\(lon\)/);
 assert.match(valid,/Math\.abs\(lat\)<=90&&Math\.abs\(lon\)<=180/);
 assert.match(valid,/locationAgeMs\(location\)<=freshMs/);
 assert.match(app,/const locs=\(mapData\.locations\|\|\[\]\)\.filter\(x=>x\.sharing&&mapLocationValid\(x\)\)/);
 assert.match(app,/coupleDistanceLocations\(\)\.filter\(l=>l\.sharing&&mapLocationValid\(l\)\)/);
});


test('P4B: a saved alert preference is not claimed as successful delivery',()=>{
 assert.equal(journeys.alertPreference(true),'Configurado');
 assert.equal(journeys.alertPreference(false),'No configurado');
 assert.equal(journeys.alertPreference(undefined),'No configurado');
 assert.equal(journeys.cooldownCopy(60),'Intervalo mínimo de 1 hora');
 assert.equal(journeys.cooldownCopy(120),'Intervalo mínimo de 2 horas');
 assert.equal(journeys.cooldownCopy(15),'Intervalo mínimo de 15 minutos');
 assert.equal(journeys.cooldownCopy(0),'Intervalo sin definir');
 assert.match(app,/Configurado no significa entregado/);
 assert.match(app,/Los avisos dependen del GPS compartido/);
 assert.match(app,/data-action="context-near-toggle"/);
 assert.match(app,/data-action="context-arrived-toggle"/);
 assert.match(app,/data-action="context-settings-open"/);
 assert.match(styles,/\.journey-alerts-summary:focus-visible/);
});

test('P4B: a session is not invented from absent or malformed progress',()=>{
 assert.equal(journeys.sessionProgress(null),null);
 assert.equal(journeys.sessionProgress(''),null);
 assert.equal(journeys.sessionProgress('invalid'),null);
 assert.equal(journeys.sessionProgress(undefined),null);
 assert.equal(journeys.sessionProgress(110),100);
 assert.equal(journeys.sessionProgress(-12),0);
 assert.equal(journeys.sessionProgress('36.7'),37);
 assert.match(app,/role="progressbar" aria-label="Progreso aproximado del recorrido"/);
 assert.match(app,/aria-valuetext="Progreso no disponible"/);
 assert.match(app,/data-action="context-session-stop"/);
 assert.match(app,/data-action="context-return-home"/);
 assert.match(app,/if\(a==='context-session-stop'\)\{await api\('context-session',\{operation:'stop'\}\)/);
 assert.match(app,/if\(a==='context-return-home'\)\{if\(!native.tracking\)/);
});

test('P4B: alert controls live in semantic collapsible details; unrelated APIs remain unchanged',()=>{
 assert.match(app,/<details class="journey-alerts" id="journeyAlerts">/);
 assert.match(app,/<summary class="journey-alerts-summary">/);
 assert.match(app,/data-action="destination"/);
 assert.match(app,/data-action="context-return-home"/);
 assert.match(styles,/\.journey-context \.context-controls/);
 assert.match(styles,/@media\(max-width:540px\)/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(moduleCode,/fetch\s*\(|GalaxyNative\.call|localStorage/);
});


test('P4C: chronological map timeline merges all three real sources without suppressing categories',()=>{
 const trips=[{id:'trip',started_at:'2026-10-10T10:00:00Z'}];
 const events=[{id:'arrival',happened_at:'2026-10-12T10:00:00Z'},{id:'old',happened_at:'bad-date'}];
 const encounters=[{id:'meeting',started_at:'2026-10-11T10:00:00Z'}];
 const rows=journeys.timeline(trips,events,encounters);
 assert.deepEqual(Array.from(rows.map(r=>r.kind)),['event','encounter','trip','event']);
 assert.deepEqual(Array.from(rows.map(r=>r.item.id)),['arrival','meeting','trip','old']);
 assert.equal(rows.at(-1).occurredAt,null);
 assert.equal(journeys.timeline([],[],[]).length,0);
 assert.equal(journeys.timeline(null,undefined,{}).length,0);
 assert.deepEqual(trips,[{id:'trip',started_at:'2026-10-10T10:00:00Z'}]);
 assert.doesNotMatch(moduleCode,/fetch\s*\(|GalaxyNative\.call/);
});

test('P4C: places with invalid coordinates remain readable but cannot focus the map',()=>{
 assert.match(app,/function historyPlacesView\(\)/);
 assert.match(app,/const valid=mapLocationValid\(p\)/);
 assert.match(app,/disabled aria-disabled="true"/);
 assert.match(app,/if\(!map\|\|!mapLocationValid\(point\)\)return false/);
 assert.match(app,/data-action="history-place"/);
 assert.match(app,/data-action="memory-at-place"/);
 assert.match(app,/data-action="galaxy-share"/);
 assert.match(app,/data-action="map-places-more"/);
 assert.match(app,/data-action="map-history-more"/);
 assert.match(app,/timeline\.slice\(0,mapHistoryVisible\)\.map\(mapTimelineRow\)/);
 assert.match(app,/timeline=window\.GalaxyJourneysV5\?\.timeline\(mapData\.trips,mapData\.events,mapData\.encounters\)/);
 assert.match(styles,/\.journey-timeline-item/);
 assert.match(styles,/@media\(max-width:620px\)/);
});

test('P4C: no invented arrival dates or forced map data operations',()=>{
 assert.match(app,/entry\.occurredAt==null\?'Sin fecha registrada'/);
 assert.match(app,/if\(entry\.kind==='trip'\)/);
 assert.match(app,/if\(entry\.kind==='event'\)/);
 assert.match(app,/data-action="context-trip-recap"/);
 assert.match(app,/function mapHistoryView\(\)/);
 assert.match(app,/mapHistoryVisible\+=6/);
 assert.match(app,/mapPlacesVisible\+=6/);
});


test('P4: missing, paused, future-dated and valid GPS are disjoint presentation states',()=>{
 assert.equal(journeys.freshness(undefined,now).kind,'missing');
 assert.equal(journeys.freshness({sharing:false,latitude:4,longitude:-74},now).kind,'paused');
 assert.equal(journeys.freshness({...where(true,1000),updated_at:observedAt(-120000)},now).kind,'missing');
 assert.match(journeys.freshness({...where(true,1000),updated_at:observedAt(-120000)},now).label,/Hora del dispositivo/);
 assert.equal(journeys.freshness(where(true,1000),now).kind,'fresh');
 assert.match(app,/const hasFix=mapLocationValid\(l\)/);
});

test('P4: every map layer validates latitude/longitude before creating graphics',()=>{
 assert.match(app,/\(mapData\.places\|\|\[\]\)\.filter\(mapLocationValid\)\.forEach/);
 assert.match(app,/visibleFrequentSuggestions\(\)\.filter\(mapLocationValid\)\.slice\(0,3\)/);
 assert.match(app,/\(mapData\.tripPoints\|\|\[\]\)\.filter\(mapLocationValid\)\.slice\(\)\.reverse\(\)/);
 assert.match(app,/if\(map&&mapLocationValid\(point\)\)\{map\.setView/);
 assert.match(app,/function focusSavedPlaceOnMap\(point\)/);
 assert.match(app,/const places=\(map\?\.markers\|\|\[\]\)\.filter/);
 assert.match(app,/document\.querySelectorAll\('#map \.gmap-marker\.place button'\)/);
 assert.match(app,/if\(!focusSavedPlaceOnMap\(point\)\)return/);
});

test('P4: querying map never asserts the partner GPS was remotely refreshed',()=>{
 const next=app.slice(app.indexOf('async function refreshMapNow()'),app.indexOf('const mediaFresh='));
 assert.match(next,/Solicitando una nueva lectura GPS solo en este teléfono/);
 assert.match(next,/const mapLoaded=await refreshMap\(\{quiet:true,detail:true\}\)/);
 assert.match(next,/if\(!mapLoaded\)/);
 assert.match(next,/GPS de tu pareja solo se actualiza desde su propio teléfono/);
 assert.doesNotMatch(next,/Ubicaciones actualizadas|Mapa actualizado/);
 assert.match(app,/data-action="map-refresh">Consultar mapa/);
 assert.match(app,/class="section journey-sharing"/);
 assert.match(app,/data-action="app-settings">Permisos Android/);
 assert.match(app,/Detener mi ubicación/);
 assert.match(styles,/\.journey-permissions-row/);
 assert.match(styles,/\.journey-sharing-actions/);
 assert.doesNotMatch(app,/Acompáñame 2\.0/);
});

test('P4: Android themed map paint proof survives asynchronous inner map rendering',()=>{
 const java=readFileSync(resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 const start=java.indexOf('// The map subtree can be replaced by asynchronous QA state');
 assert.ok(start>0,'native real-map paint guard present');
 const section=java.slice(start,start+2200);
 assert.match(section,/document\.body\.append\(el\)/);
 assert.match(section,/scrollIntoView/);
 assert.match(section,/r\.top<innerHeight-48/);
 assert.match(section,/awaitV5P3ModalPainted\(themedHome,themedCssWidth,"p4-theme-"\+theme/);
 assert.match(section,/screencap -p \/sdcard\/Download\/V5-P4-theme-map-/);
 assert.match(java,/document\.getElementById\('p4-theme-paint-marker'\)\?\.remove\(\)/);
});
