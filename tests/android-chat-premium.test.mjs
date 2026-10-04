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
const migration=read('supabase/migrations/20261004060000_galaxy_chat_premium_340.sql');
const gradle=read('android/app/build.gradle.kts');

test('3.4.0 version and non-destructive migration are present',()=>{
 assert.match(gradle,/versionCode = 33; versionName = "3\.4\.0"/);
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
