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
 assert.equal(journeys.freshness(null,now).kind,'paused');
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
