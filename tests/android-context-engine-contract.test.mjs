import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('supabase/schema.sql');
const edge=read('supabase/functions/android-companion/index.ts');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const bridge=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
const pushManager=read('android/app/src/main/java/com/nuestragalaxia/companion/PushManager.java');
const qa=read('scripts/qa-android-mobile.mjs');
const contextStorePath=new URL('../android/app/src/main/java/com/nuestragalaxia/companion/ContextStore.java',import.meta.url);
const contextEnginePath=new URL('../supabase/functions/android-companion/context-engine.ts',import.meta.url);

test('Context Engine persists events, state, settings, sessions, ETA samples and suggestions',()=>{
 for(const table of ['galaxy_context_state','galaxy_context_settings','galaxy_context_events','galaxy_context_sessions','galaxy_context_eta_history','galaxy_context_suggestions','galaxy_shared_trips'])
  assert.ok(schema.includes('create table if not exists public.'+table),table);
 for(const table of ['galaxy_context_state','galaxy_context_settings','galaxy_context_events','galaxy_context_sessions','galaxy_context_eta_history','galaxy_context_suggestions','galaxy_shared_trips'])
  assert.ok(schema.includes('alter table public.'+table+' enable row level security'),table);
 assert.ok(schema.includes('dedupe_key text not null unique'));
});

test('location has one unified context tick instead of calling independent smartPlaces and encounter detectors',()=>{
 assert.ok(edge.includes('async function contextTick('));
 const block=edge.slice(edge.indexOf('async function location('),edge.indexOf('function nextCalendarEvent'));
 assert.ok(block.includes('await contextTick('));
 assert.equal(block.includes('await smartPlaces('),false);
 assert.equal(block.includes('await encounter('),false);
});

test('Context Engine exposes reusable event feed and operations',()=>{
 for(const action of ['context-state','context-settings','context-session','context-events','context-suggestion','context-recap'])
  assert.ok(edge.includes('action==="'+action+'"'),action);
 assert.ok(edge.includes('CONTEXT_EVENTS'));
 assert.ok(edge.includes('persistContextEvent'));
});

test('nearby and arrived-safe reuse Bond push infrastructure and require explicit settings',()=>{
 assert.ok(edge.includes('eventType:"nearby"')||edge.includes('"nearby"'));
 assert.ok(edge.includes('eventType:"arrived_safe"')||edge.includes('"arrived_safe"'));
 assert.ok(edge.includes('near_enabled'));
 assert.ok(edge.includes('arrived_safe_enabled'));
 assert.ok(edge.includes('dispatchPushEvent'));
});

test('Acompañame 2.0 and return-home sessions track destination, progress, ETA history and arrival',()=>{
 assert.ok(edge.includes('return_home'));
 assert.ok(edge.includes('initial_distance_m'));
 assert.ok(edge.includes('progress_pct'));
 assert.ok(edge.includes('galaxy_context_eta_history'));
 assert.ok(edge.includes('DESTINATION_REACHED'));
 assert.ok(edge.includes('status:"arrived"')||edge.includes('status: "arrived"'));
});

test('shared trips and date/memory suggestions require coherent context and human confirmation',()=>{
 assert.ok(edge.includes('SHARED_TRIP_DETECTED'));
 assert.ok(edge.includes('LONG_ENCOUNTER'));
 assert.ok(edge.includes('galaxy_shared_trips'));
 assert.ok(edge.includes('galaxy_context_suggestions'));
 assert.ok(edge.includes('requiresConfirmation'));
 assert.ok(app.includes('¿Esto fue una cita?'));
});

test('recaps include contextual route/distance/duration/places/photos/music/memories',()=>{
 assert.ok(edge.includes('buildDateContextRecap'));
 assert.ok(edge.includes('buildTripContextRecap'));
 for(const word of ['photos','songs','memories','places'])assert.ok(edge.includes(word),word);
 assert.ok(app.includes('Recap de cita'));
 assert.ok(app.includes('Recap de recorrido'));
});

test('context events are exposed without raw GPS dependency for Notes/Capsules and future engines',()=>{
 assert.ok(edge.includes('async function contextEventsFeed('));
 assert.ok(edge.includes('galaxy_context_events'));
 assert.ok(edge.includes('event_type'));
});

test('Android keeps context push preferences local and does not auto-start location',()=>{
 assert.ok(existsSync(contextStorePath));
 const store=read('android/app/src/main/java/com/nuestragalaxia/companion/ContextStore.java');
 assert.ok(store.includes('nearbyEnabled'));
 assert.ok(store.includes('arrivedSafeEnabled'));
 assert.ok(pushManager.includes('nearbyEnabled()'));
 assert.ok(pushManager.includes('arrivedSafeEnabled()'));
 assert.ok(main.includes('setContextPushPrefs'));
 assert.ok(bridge.includes('setContextPushPrefs'));
 assert.equal(store.includes('TrackingService.ACTION_START'),false);
});

test('map UI exposes Context Engine controls without enabling GPS itself',()=>{
 for(const marker of ['Galaxy Context Engine','Estamos cerca','Regreso a casa','Acompáñame 2.0','context-near-toggle','context-return-home'])
  assert.ok(app.includes(marker),marker);
 assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Context Engine */'));
});

test('mobile QA explicitly guards Context Engine',()=>{
 assert.ok(qa.includes('Galaxy Context Engine'));
 assert.ok(qa.includes('context-engine.ts'));
 assert.ok(qa.includes('ContextStore.java'));
});
