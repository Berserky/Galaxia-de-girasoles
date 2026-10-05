import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const edge=read('supabase/functions/android-companion/index.ts');
const push=read('supabase/functions/android-companion/push-engine.ts');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const firebase=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java');
const notifications=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyNotifications.java');
const migration=read('supabase/migrations/20261004165848_galaxy_chat_premium_340.sql');
const gradle=read('android/app/build.gradle.kts');

test('Premium 3.4 migration remains compatible under Universe 3.5 post-audit patch',()=>{
 assert.match(gradle,/versionCode = 35; versionName = "3\.5\.1"/);
 for(const marker of ['scheduled_at','schedule_state','expires_at','view_once','galaxy_chat_preferences','galaxy_chat_transcripts','galaxy_chat_translations','galaxy_chat_albums','galaxy_chat_stickers','galaxy_chat_cron_dispatch','cron.schedule'])assert.ok(migration.includes(marker),marker);
 assert.equal(/drop table|truncate table|drop column/i.test(migration),false);
});

test('server-side scheduling and expiry are authoritative',()=>{
 for(const marker of ['chat-process-due','chatProcessDue','schedule_state:scheduled?"pending":"sent"','chatExpireRow','x-galaxy-cron-token'])assert.ok(edge.includes(marker),marker);
 assert.ok(edge.includes('scheduled?"pending":"sent"'));
 assert.ok(edge.includes('dispatchPushEvent({person:sender,id:null}'));
});

test('silent, one-time, privacy and translation paths are end to end',()=>{
 for(const action of ['chat-schedule-update','chat-preferences','chat-open-once','chat-transcript','chat-translate'])assert.ok(edge.includes(action)&&main.includes(action),action);
 assert.ok(push.includes('out.silent="true"'));
 assert.ok(firebase.includes('getOrDefault("silent","false")'));
 assert.ok(notifications.includes('if(silent)builder.setSilent(true)'));
 assert.ok(edge.includes('notification_privacy'));
 assert.ok(edge.includes('show_read'));
 assert.ok(edge.includes('show_last_seen'));
 assert.ok(edge.includes('show_typing'));
});

test('premium composer UX exposes long press, schedule, silent and temporary modes',()=>{
 for(const marker of ['openChatSendMenu','chatPremiumSendForm','Enviar en silencio','Programar envío','viewOnce','ttlSeconds','effect','chatSendHold'])assert.ok(app.includes(marker),marker);
 assert.ok(css.includes('Galaxy Chat Premium 3.4.0'));
});

test('view once media is not hydrated to recipient before explicit open',()=>{
 assert.ok(edge.includes('row.view_once&&String(row.sender_person)!==person'));
 assert.ok(app.includes("data-action=\"chat-view-once\""));
 assert.ok(app.includes("api('chat-open-once'"));
});

test('premium chat settings remain scoped to Galaxy Chat',()=>{
 for(const marker of ['chatPreferencesState','chatPartnerLabel','chat-theme-','chatPreferencesForm','notificationPrivacy'])assert.ok(app.includes(marker),marker);
 assert.ok(css.includes('.chat-theme-cyberpunk'));
});


test('premium shared media features are wired end to end',()=>{
 for(const action of ['chat-shared','chat-albums','chat-stickers','chat-live-location','chat-gif-import','chat-transcript-delete']){
  assert.ok(edge.includes(action),action+' edge');
  assert.ok(main.includes(action),action+' android allowlist');
 }
 for(const marker of ['openChatAlbums','openChatStickerPicker','openChatLocationMenu','chat-video-message','chat-gif-pick','chat-location-live']){
  assert.ok(app.includes(marker),marker);
 }
});

test('live location is consent based and reuses the existing GPS source of truth',()=>{
 assert.ok(migration.includes('galaxy_chat_live_locations'));
 assert.ok(migration.includes('Live location reuses galaxy_locations'));
 assert.ok(edge.includes('db.from("galaxy_locations")'));
 assert.ok(app.includes("if(!native.tracking)"));
 assert.equal(app.includes("native=await GalaxyNative.call('startLocation')"),false);
});

test('translation is ephemeral unless persistence is explicitly requested',()=>{
 assert.ok(edge.includes('persist=body.persist===true'));
 assert.ok(edge.includes('if(!persist)return json({translation:result,persisted:false})'));
});

test('backup v5 preserves premium chat metadata through canonical sections',()=>{
 for(const marker of ['chatStickerRecents','chatLiveLocations','BACKUP_SECTION_NAMES','galaxy_backup_export_v5'])assert.ok(edge.includes(marker),marker);
});

test('native premium bridge includes short video, GIPHY and point location',()=>{
 const bridge=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
 const mobile=read('android/app/src/main/java/com/nuestragalaxia/companion/MobileApiClient.java');
 const gradle=read('android/app/build.gradle.kts');
 for(const marker of ['captureChatVideoMessage','searchGiphy','getChatLocation'])assert.ok(bridge.includes(marker),marker);
 assert.ok(mobile.includes('giphySearch('));
 assert.ok(edge.includes('Deno.env.get("GIPHY_API_KEY")'));
 assert.ok(edge.includes('action==="giphy-search"'));
 assert.equal(gradle.includes('GIPHY_API_KEY'),false,'La clave GIPHY no puede quedar en el APK');
});
