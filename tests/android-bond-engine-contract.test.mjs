import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('supabase/schema.sql');
const edge=read('supabase/functions/android-companion/index.ts');
const pushEngine=read('supabase/functions/android-companion/push-engine.ts');
const insights=read('supabase/functions/android-companion/insights.ts');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const build=read('android/app/build.gradle.kts');
const manifest=read('android/app/src/main/AndroidManifest.xml');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const bridge=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
const worker=read('android/app/src/main/java/com/nuestragalaxia/companion/BondWorker.java');
const widget=read('android/app/src/main/java/com/nuestragalaxia/companion/BondWidget.java');
const widgetLayout=read('android/app/src/main/res/layout/widget_bond.xml');
const config=read('android/app/src/main/java/com/nuestragalaxia/companion/WidgetConfigureActivity.java');
const store=read('android/app/src/main/java/com/nuestragalaxia/companion/BondStore.java');
const apiClient=read('android/app/src/main/java/com/nuestragalaxia/companion/ApiClient.java');
const qa=read('scripts/qa-android-mobile.mjs');
const pushServicePath=new URL('../android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java',import.meta.url);
const pushManagerPath=new URL('../android/app/src/main/java/com/nuestragalaxia/companion/PushManager.java',import.meta.url);
const widgetPrefsPath=new URL('../android/app/src/main/java/com/nuestragalaxia/companion/WidgetPrefs.java',import.meta.url);
const pushEnginePath=new URL('../supabase/functions/android-companion/push-engine.ts',import.meta.url);

test('Bond 2.0 adds relational custom gestures and reusable push infrastructure',()=>{
 for(const table of ['galaxy_bond_gestures','galaxy_push_tokens','galaxy_push_subscriptions','galaxy_push_events','galaxy_push_deliveries'])
  assert.ok(schema.includes('create table if not exists public.'+table),table);
 assert.ok(schema.includes('device_id uuid')&&schema.includes('references public.galaxy_devices(id)'));
 assert.ok(schema.includes('event_type text'));
});

test('new Bond and push tables are private from direct clients',()=>{
 for(const table of ['galaxy_bond_gestures','galaxy_push_tokens','galaxy_push_subscriptions','galaxy_push_events','galaxy_push_deliveries'])
  assert.ok(schema.includes('alter table public.'+table+' enable row level security'),table);
 assert.ok(schema.includes('revoke all on public.galaxy_bond_gestures,public.galaxy_push_tokens,public.galaxy_push_subscriptions,public.galaxy_push_events,public.galaxy_push_deliveries from public,anon,authenticated'));
});

test('Bond state exposes total days, current streak, record and garden without replacing old participation',()=>{
 assert.ok(edge.includes('computeBondProgress'));
 assert.ok(edge.includes('galaxy_bond_participation'));
 assert.ok(edge.includes('currentStreak'));
 assert.ok(edge.includes('recordStreak'));
 assert.equal(/delete from public\.galaxy_bond_participation/i.test(schema),false);
});

test('custom gestures are CRUD-managed separately from historical galaxy_bond entries',()=>{
 assert.ok(edge.includes('async function bondGestureCatalog('));
 assert.ok(edge.includes('async function bondGestureSave('));
 assert.ok(edge.includes('async function bondGestureDelete('));
 assert.ok(edge.includes('galaxy_bond_gestures'));
 assert.ok(edge.includes('gestureSnapshot'));
});

test('gesture sending uses reusable push events rather than a haptic-only endpoint',()=>{
 assert.ok(edge.includes('async function dispatchPushEvent('));
 assert.ok(edge.includes('dispatchPushEvent(d,target,"gesture"')||edge.includes("dispatchPushEvent(d,target,'gesture'"));
 for(const future of ['arrived_safe','nearby','capsule','note','reminder'])assert.ok(pushEngine.includes(future),future);
 assert.equal(edge.includes('haptic-only'),false);
});

test('FCM server credentials remain server-only and HTTP v1 is used',()=>{
 assert.ok(existsSync(pushEnginePath));
 assert.ok(edge.includes('FCM_SERVICE_ACCOUNT_JSON'));
 assert.ok(edge.includes('fcm.googleapis.com/v1/projects/'));
 assert.ok(edge.includes('oauth2.googleapis.com/token'));
 assert.equal(build.includes('FCM_SERVICE_ACCOUNT_JSON'),false);
 assert.equal(main.includes('FCM_SERVICE_ACCOUNT_JSON'),false);
 assert.equal(app.includes('FCM_SERVICE_ACCOUNT_JSON'),false);
});

test('push token rotation upserts by device and revoked devices lose delivery tokens',()=>{
 assert.ok(edge.includes('async function pushTokenRegister('));
 assert.ok(edge.includes('onConflict:"device_id"'));
 assert.ok(edge.includes('async function pushTokenUnregister('));
 const revoke=edge.slice(edge.indexOf('async function deviceRevoke('),edge.indexOf('function point('));
 assert.ok(revoke.includes('galaxy_push_tokens'));
 assert.ok(schema.includes('device_id uuid primary key'));
});

test('Android includes FCM receive service, token refresh and secure haptic handling',()=>{
 assert.ok(existsSync(pushServicePath));
 assert.ok(existsSync(pushManagerPath));
 assert.ok(build.includes('com.google.firebase:firebase-messaging:25.1.3'));
 assert.ok(manifest.includes('android.permission.VIBRATE'));
 assert.ok(manifest.includes('com.google.firebase.MESSAGING_EVENT'));
 const service=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java');
 assert.ok(service.includes('onNewToken'));
 assert.ok(service.includes('onMessageReceived'));
 assert.ok(service.includes('VibrationEffect'));
 assert.ok(service.includes('hapticEnabled()'));
});

test('Firebase client identifiers are optional non-secret build inputs, not private credentials',()=>{
 for(const key of ['FIREBASE_PROJECT_ID','FIREBASE_APPLICATION_ID','FIREBASE_API_KEY','FIREBASE_SENDER_ID'])assert.ok(build.includes(key),key);
 assert.equal(build.includes('private_key'),false);
 assert.equal(build.includes('client_email'),false);
});

test('notification blocking and haptic opt-in remain separate',()=>{
 assert.ok(store.includes('hapticEnabled()'));
 assert.ok(main.includes('setBondHaptics'));
 assert.ok(bridge.includes('setBondHaptics'));
 assert.ok(worker.includes('notificationsAllowed'));
 assert.ok(app.includes('bond-haptics'));
});

test('unpair unregisters FCM before local device state is cleared',()=>{
 assert.ok(apiClient.includes('pushUnregister'));
 const unpair=main.slice(main.indexOf('void unpair('),main.indexOf('void copyText('));
 assert.ok(unpair.indexOf('pushUnregister')<unpair.indexOf('store.clear()'));
});

test('Widget 2.0 has per-widget module configuration and compact/large behavior',()=>{
 assert.ok(existsSync(widgetPrefsPath));
 assert.ok(config.includes('WidgetPrefs'));
 assert.ok(config.includes('moveUp')&&config.includes('moveDown'));
 for(const module of ['photo','date','hug','mood','distance','eta','song','plan','garden'])assert.ok(config.includes('"'+module+'"'),module);
 assert.ok(widget.includes('getAppWidgetOptions'));
 assert.ok(widget.includes('compact'));
 assert.ok(widget.includes('WidgetPrefs'));
 assert.ok(widgetLayout.includes('widgetModules'));
});

test('widget snapshot includes privacy-safe distance ETA song plan and garden data without raw coordinates',()=>{
 const moments=edge.slice(edge.indexOf('async function moments('),edge.indexOf('Deno.serve'));
 for(const key of ['distanceM','etaMinutes','nextPlan','garden'])assert.ok(moments.includes(key),key);
 const projection=moments.slice(moments.lastIndexOf('return json({'));
 assert.equal(/\blatitude\b|\blongitude\b/.test(projection),false);
 assert.ok(moments.includes('share_battery')&&moments.includes('share_song'));
});

test('Bond UI renders Garden 2.0, streaks and customizable quick gestures',()=>{
 assert.ok(app.includes('Nuestro jardín'));
 assert.ok(app.includes('currentStreak'));
 assert.ok(app.includes('recordStreak'));
 assert.ok(app.includes('bond-gesture-new'));
 assert.ok(app.includes('bond-haptics'));
 assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Bond Engine 2.0 */'));
 assert.ok(css.includes('.bond-garden-scene'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});

test('Insights achievements consume Bond streak and gesture metrics',()=>{
 for(const metric of ['current_streak','record_streak','gestures'])assert.ok(insights.includes(metric),metric);
 assert.ok(edge.includes('recordStreak'));
});

test('Bond 2.0 does not start location automatically',()=>{
 const pushService=existsSync(pushServicePath)?read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java'):'';
 assert.equal(pushService.includes('PushManager.startLocation'),false);
 assert.equal(pushService.includes('TrackingService.ACTION_START'),false);
 assert.ok(pushService.includes('onMessageReceived'));
});

test('mobile QA explicitly guards Galaxy Bond 2.0',()=>{
 assert.ok(qa.includes('Galaxy Bond Engine 2.0'));
 assert.ok(qa.includes('GalaxyFirebaseService'));
 assert.ok(qa.includes('WidgetPrefs'));
 assert.ok(qa.includes('currentStreak'));
});
