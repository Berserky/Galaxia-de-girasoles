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
 assert.match(app,/function visibleTrailSegments\(\)/);
 assert.match(app,/GalaxyJourneysV5\?\.trailSegments\(mapData\?\.tripPoints\|\|\[\]\)/);
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


test('P4 VE-067/068/070: location people are expandable with accessible speed details',()=>{
 const block=app.slice(app.indexOf('function personCard(l){'),app.indexOf('function transportLabel(l){'));
 assert.match(block,/<details class="card person-card journey-person /);
 assert.match(block,/<summary class="journey-person-summary">/);
 assert.match(block,/journey-person-heading/);
 assert.match(block,/class="journey-speed"/);
 assert.match(block,/Velocidad sin lectura reciente/);
 assert.match(block,/const hasFix=mapLocationValid\(l\)/);
 assert.match(block,/data-action="'\+\(mine\?'galaxy-share':'status-chat-reply'\)/);
 assert.match(styles,/\.person-card\.journey-person\{display:block/);
 assert.match(styles,/\.journey-person-summary:focus-visible/);
 assert.match(styles,/\.journey-person-details/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)\{\.journey-person-chevron/);
 assert.doesNotMatch(block,/<button[^>]+class="journey-person-summary"/);
});


test('P4 VE-062/064: cartographic themes preserve OSM attribution and trail truth',()=>{
 for(const theme of ['daylight','cosmic','halloween','christmas','valentine','friendship','easter']){
  assert.ok(styles.includes('html[data-theme="'+theme+'"] #map .gmap-tiles'),theme);
 }
 assert.match(styles,/#map \.gmap-tiles\{transition:filter/);
 assert.match(styles,/@media\(prefers-reduced-motion:reduce\)\{#map \.gmap-tiles\{transition:none/);
 assert.match(mapEngine,/https:\/\/tile\.openstreetmap\.org\//);
 assert.match(mapEngine,/gmap-attrib/);
 assert.match(app,/class="journey-map-legend" role="note"/);
 assert.match(app,/Recorrido registrado propio/);
 assert.match(app,/Recorrido registrado de pareja/);
 assert.match(app,/Los tramos separados no se conectan/);
 assert.match(app,/un destino elegido no representa una ruta vial calculada/);
 assert.match(app,/map\.addPolyline\(points,\{className:'recorded '/);
 assert.match(styles,/\.journey-route-line\.partner\{border-color:var\(--accent2\)/);
 assert.doesNotMatch(moduleCode,/openstreetmap|tile\.openstreetmap/);
});


test('P4 VE-079: selected transport chip has readable contrast in every theme',()=>{
 assert.match(styles,/\.journey-mobility \.chip\[aria-pressed="true"\]\{background:var\(--text\);\s*color:var\(--bg\);border-color:var\(--text\)\}/);
 const themeCss=file('app.css');
 const base=themeCss.match(/:root\s*\{([^}]*)\}/)?.[1];
 assert.ok(base,'theme base must exist');
 const token=(block,name)=>block.match(new RegExp('--'+name+':\\s*(#[0-9a-fA-F]{6})'))?.[1];
 const luminance=hex=>{
  const rgb=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255);
  const [r,g,b]=rgb.map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  return 0.2126*r+0.7152*g+0.0722*b;
 };
 for(const theme of ['daylight','cosmic','halloween','christmas','valentine','friendship','easter']){
  const block=theme==='daylight'?base:themeCss.match(new RegExp('html\\[data-theme="'+theme+'"\\]\\s*\\{([^}]*)\\}'))?.[1];
  assert.ok(block,'missing theme '+theme);
  const foreground=token(block,'bg')||token(base,'bg');
  const background=token(block,'text')||token(base,'text');
  assert.ok(foreground&&background,'missing chip colors '+theme);
  const [lighter,darker]=[luminance(foreground),luminance(background)].sort((x,y)=>y-x);
  assert.ok((lighter+0.05)/(darker+0.05)>=7,'AAA chip contrast '+theme);
 }
});


test('P4: coordinate validation rejects blank strings without losing legitimate zero',()=>{
 const from=app.indexOf('function mapLocationValid(location){');
 const to=app.indexOf('function locationFreshState(',from);
 assert.ok(from>=0&&to>from);
 const validity=runInNewContext(app.slice(from,to)+'\nmapLocationValid',{}, {timeout:1000});
 for(const point of [
  {latitude:'',longitude:'-74'},{latitude:'4.7',longitude:' '},
  {latitude:null,longitude:-74},{latitude:'4.7',longitude:'undefined'},
  {latitude:91,longitude:15}
 ])assert.equal(validity(point),false);
 assert.equal(validity({latitude:0,longitude:0}),true);
 assert.equal(validity({latitude:'0',longitude:'0'}),true);
});

test('P4 VE-090/093/094: quick actions and saved-place secondary actions are compact and keyboard accessible',()=>{
 assert.match(app,/class="section journey-actions" role="group"/);
 assert.match(app,/class="journey-actions-row"/);
 assert.match(app,/data-action="trip-toggle"/);
 assert.match(app,/data-action="place-new"/);
 assert.match(app,/class="journey-place-more"/);
 assert.match(app,/<summary aria-label="Opciones del lugar /);
 assert.match(app,/journey-place-more-content/);
 assert.match(app,/data-action="galaxy-share" data-card-type="PLACE"/);
 assert.match(app,/data-action="memory-at-place"/);
 assert.match(app,/Sin recuerdos asociados/);
 assert.match(styles,/\.journey-actions-row \.btn\{min-height:44px/);
 assert.match(styles,/\.journey-place-more summary:focus-visible/);
 assert.match(styles,/@media\(max-width:390px\)\{\.journey-actions-row \.btn/);
 assert.doesNotMatch(app,/actionCard\('route',own\.trip_active/);
});

test('P4 VE-099: historical activity uses only existing place, motion, and timed encounter data',()=>{
 const a=app.indexOf('function mapTimelineRow(entry){');
 const b=app.indexOf('function mapHistoryView(){',a);
 assert.ok(a>0&&b>a);
 const script=app.slice(a,b);
 const render=entry=>runInNewContext(script+'\nmapTimelineRow(entry)',{
  entry,mapData:{places:[{id:91,name:'Plaza <Seguro>'}]},
  names:()=>['Sol','Luna'],esc,attr:x=>String(x),
  fmtDateTime:()=> '12 oct 2026',fmtDistance:m=>m+' m',
  fmtDuration:s=>s+' s',ico:name=>name
 },{timeout:1000});
 const arrival=render({kind:'event',item:{place_id:91,event:'arrived',happened_at:'2026-10-13T10:00:00Z'},occurredAt:Date.parse('2026-10-13T10:00:00Z')});
 assert.match(arrival,/Plaza &lt;Seguro&gt;/);
 assert.match(arrival,/Llegada registrada/);
 const missing=render({kind:'event',item:{place_id:999,event:'left'},occurredAt:null});
 assert.match(missing,/Lugar no disponible/);
 assert.match(missing,/Sin fecha registrada/);
 const encounter=render({kind:'encounter',item:{started_at:'2026-10-13T10:00:00Z',ended_at:'2026-10-13T10:30:00Z',distance_m:24},occurredAt:Date.parse('2026-10-13T10:00:00Z')});
 assert.match(encounter,/Duró 1800 s/);
 assert.match(encounter,/24 m/);
 const unfinished=render({kind:'encounter',item:{started_at:'2026-10-13T10:00:00Z',ended_at:null},occurredAt:Date.parse('2026-10-13T10:00:00Z')});
 assert.doesNotMatch(unfinished,/Duró|0 s|24 m/);
 const trip=render({kind:'trip',item:{person:'1',distance_m:120,duration_s:80,dominant_motion:'walking'},occurredAt:null});
 assert.match(trip,/Caminando/);
 assert.match(trip,/120 m/);
 assert.match(trip,/80 s/);
});


test('P4 VE-063: only the current profile destination is emphasized, without creating a second marker',()=>{
 const begin=app.indexOf('function drawMap({fit=true}={}){');
 const end=app.indexOf('function showChatSurface(',begin);
 assert.ok(begin>0&&end>begin);
 const draw=app.slice(begin,end);
 assert.match(draw,/selectedDestination=\(mapData\.destinations\|\|\[\]\)\.find/);
 assert.match(draw,/String\(d\.person\)===String\(cloud\.person\)/);
 assert.match(draw,/selectedDestination\?\.kind==='person'/);
 assert.match(draw,/selectedDestination\?\.kind==='place'/);
 assert.match(draw,/className:'place'\+\(chosen\?' destination':''\)/);
 assert.match(draw,/className:\(mine\?'mine':'partner'\).*\(chosen\?' destination':''\)/);
 assert.match(draw,/Destino elegido · /);
 assert.match(draw,/l\.speed==null\|\|String\(l\.speed\)\.trim\(\)===''/);
 assert.match(draw,/Velocidad sin lectura/);
 assert.match(styles,/#map \.gmap-marker\.destination button/);
 assert.match(styles,/#map \.gmap-marker\.destination::after/);
 assert.match(draw,/\(mapData\.places\|\|\[\]\)\.filter\(mapLocationValid\)\.forEach/);
});

test('P4 VE-073/077: ETA is phrased naturally and privacy is a separate disclosure',()=>{
 assert.match(app,/Si sigues '\+e\.mode_label\+'/);
 assert.match(app,/el trayecto podría tardar/);
 assert.match(app,/ETA = tiempo estimado de llegada/);
 assert.match(app,/<details class="journey-permissions-row">/);
 assert.match(app,/<summary aria-label="Ver opciones de privacidad y permisos">/);
 assert.match(app,/class="journey-permissions-content"/);
 assert.match(app,/data-action="app-settings">Permisos Android/);
 assert.match(app,/data-action="'\+\(native\.tracking\?'location-stop':'location-start'\)/);
 assert.match(styles,/\.journey-permissions-row>summary:focus-visible/);
 assert.match(styles,/\.journey-permissions-content \.btn\{min-height:44px\}/);
});


test('P4 VE-064: timestamped route segments never connect different people or unrelated journeys',()=>{
 const now=Date.parse('2026-10-16T14:00:00Z');
 const at=m=>new Date(now+m*60000).toISOString();
 const p=(person,minute,latitude=4.70,longitude=-74.06)=>({person,created_at:at(minute),latitude,longitude});
 const source=[p('0',-60),p('0',-55),p('0',-10),p('0',-9),p('1',-6),p('1',-5),
  p('1',2),p('1',-4,'',''),p('0',-3,110,-74.05)];
 const got=journeys.trailSegments(source,{now});
 assert.equal(got.length,3);
 assert.deepEqual(Array.from(got.map(x=>x.person)),['0','0','1']);
 assert.deepEqual(Array.from(got.map(x=>x.points.length)),[2,2,2]);
 assert.ok(got.every(x=>x.startedAt<=x.endedAt));
 assert.ok(got.every(x=>x.points.every(([lat,lon])=>Math.abs(lat)<=90&&Math.abs(lon)<=180)));
 assert.doesNotMatch(moduleCode,/fetch\s*\(|GalaxyNative\.call|localStorage/);
});

test('P4 VE-064: partner paused trail is not painted from stale cached history',()=>{
 const begin=app.indexOf('function visibleTrailSegments(){');
 const end=app.indexOf('function drawMap({fit=true}',begin);
 assert.ok(begin>0&&end>begin);
 const code=app.slice(begin,end);
 const now=Date.now(),at=m=>new Date(now+m*60000).toISOString();
 const p=(person,minute,latitude)=>({person,created_at:at(minute),latitude,longitude:-74.1});
 const points=[p('0',-5,4.6),p('0',-4,4.7),p('1',-5,4.8),p('1',-4,4.9)];
 const context={window:{GalaxyJourneysV5:journeys},cloud:{person:'0'},
  mapData:{tripPoints:points,locations:[
    {person:'0',sharing:true,trip_active:true,trip_started_at:at(-10),updated_at:at(-1),latitude:4.7,longitude:-74.1},
    {person:'1',sharing:false,trip_active:true,trip_started_at:at(-10),updated_at:at(-1),latitude:4.9,longitude:-74.1}
  ]},
  locationFreshState:loc=>loc.sharing===true,
 };
 const visible=runInNewContext(code+'\nvisibleTrailSegments()',context,{timeout:1000});
 assert.equal(visible.length,1);
 assert.equal(visible[0].person,'0');
 assert.equal(visible[0].active,true);
 context.mapData.locations[0].updated_at=at(120);
 const invalidFuture=runInNewContext(code+'\nvisibleTrailSegments()',context,{timeout:1000});
 assert.equal(invalidFuture[0].active,false);
 assert.match(app,/map\.addPolyline\(points,\{className:'recorded '/);
 assert.match(app,/visibleTrailSegments\(\)\.forEach/);
 assert.match(styles,/#map \.gmap-line\.recorded\.historical/);
 assert.match(styles,/#map \.gmap-line\.recorded\.active/);
});
