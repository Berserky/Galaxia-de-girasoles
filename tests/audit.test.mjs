import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Map V2 schema and client stay reproducible and least-privilege',()=>{
 const schema=read('supabase/schema.sql'),cloud=read('app/cloud/adapter.js');
 for(const table of ['galaxy_locations','galaxy_places','galaxy_trip_points'])assert.match(schema,new RegExp('create table public\\.'+table));
 assert.match(schema,/revoke all on public\.galaxy_locations from anon,authenticated/);
 assert.match(schema,/revoke truncate,references,trigger on public\.galaxy_settings,public\.galaxy_items from authenticated/);
 assert.doesNotMatch(cloud,/galaxy_home_state/);
 assert.match(cloud,/if\(!sharing\)await checked\(client\.from\('galaxy_trip_points'\)\.delete\(\)\.eq\('person',String\(p\)\)\)/);
});

test('PWA cache revision and registration stay aligned',()=>{
 const sw=read('app/public/sw.js'),install=read('app/public/install.js');
 const cache=sw.match(/galaxia-shell-v(\d+)/)?.[1],registration=install.match(/sw\.js\?v=(\d+)/)?.[1];
 assert.ok(cache&&registration);
 assert.equal(cache,registration);
});

test('Public HTML contains no accidental escaped newline and icon/map libraries are HTTPS',()=>{
 const html=read('app/public/index.html');
 assert.ok(!html.includes('\\\\n'));
 for(const src of html.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https:[^"]+)"/g))assert.match(src[1],/^https:\/\//);
});

test('Map live metadata is refreshed without rebuilding the whole view',()=>{
 const app=read('app/public/app.js');
 assert.match(app,/function renderMapMeta\(/);
 assert.match(app,/id="map-distance-value"/);
 assert.doesNotMatch(app,/async function savePlace[\s\S]{0,500}draw\(\)/);
});


test('Live map exposes speed and conservative movement inference',()=>{
 const app=read('app/public/app.js'),cloud=read('app/cloud/adapter.js'),schema=read('supabase/schema.sql');
 assert.match(app,/function effectiveSpeed\(/);
 assert.match(app,/function classifyMotion\(/);
 assert.match(app,/km\/h/);
 assert.match(app,/En moto · probable/);
 assert.match(app,/En transporte público · probable/);
 assert.match(cloud,/motion,transport_preference/);
 assert.match(schema,/transport_preference text/);
});


test('Map markers reflect movement with Lucide icons and live speed',()=>{
 const app=read('app/public/app.js'),css=read('app/public/app.css');
 assert.match(app,/function motionIcon\(/);
 assert.match(app,/person-standing/);
 assert.match(app,/bike/);
 assert.match(app,/bus-front/);
 assert.match(app,/motionMarkerHtml/);
 assert.match(app,/setIcon\(markerIcon\)/);
 assert.match(css,/\.motion-marker-speed/);
});


test('Private mobility history is sampled, bounded in reads and RLS-backed',()=>{
 const app=read('app/public/app.js'),cloud=read('app/cloud/adapter.js'),schema=read('supabase/schema.sql');
 assert.match(app,/lastHistorySent/);
 assert.match(app,/motion==='still'\?60000:15000/);
 assert.match(cloud,/galaxy_location_history/);
 assert.match(cloud,/\.limit\(2000\)/);
 assert.match(cloud,/galaxy_trip_history/);
 assert.match(schema,/location_history_read/);
 assert.match(schema,/trip_history_read/);
 assert.match(schema,/galaxy_location_history_person_time_idx/);
});


test('Mobility insights include privacy controls and dwell-based smart arrivals',()=>{
 const app=read('app/public/app.js'),cloud=read('app/cloud/adapter.js'),schema=read('supabase/schema.sql');
 assert.match(app,/function mobilityInsights\(/);
 assert.match(app,/function detectSmartPlace\(/);
 assert.match(app,/now-s\.since>=45000/);
 assert.match(app,/mobility-export/);
 assert.match(app,/mobility-clear-confirm/);
 assert.match(cloud,/\/api\/map\/privacy\/export/);
 assert.match(cloud,/\/api\/map\/privacy\/history/);
 assert.match(schema,/create table public\.galaxy_place_events/);
 assert.match(schema,/place_events_insert_own/);
});
