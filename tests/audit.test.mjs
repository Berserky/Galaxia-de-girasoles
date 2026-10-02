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
