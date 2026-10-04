import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(p,'utf8');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const edge=read('supabase/functions/android-companion/index.ts');
const push=read('supabase/functions/android-companion/push-engine.ts');
const firebase=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java');
const notifications=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyNotifications.java');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const bridge=read('android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java');
const workflow=read('.github/workflows/android-companion.yml');
const migration=read('supabase/migrations/20261003235000_galaxy_chat_notifications_31.sql');

test('Galaxy Chat has private persistence, read state and service-role-only access',()=>{
 for(const marker of ['galaxy_chat_messages','galaxy_chat_read_state','galaxy_notifications','enable row level security','revoke all'])assert.ok(migration.includes(marker),marker);
 assert.ok(migration.includes('unique(sender_person,client_id)'));
 assert.ok(migration.includes('reply_to uuid references'));
});

test('chat API supports history, idempotent send, read receipts and own-delete',()=>{
 for(const action of ['chat-state','chat-send','chat-read','chat-delete'])assert.ok(edge.includes(action),action);
 assert.ok(edge.includes('client_id'));
 assert.ok(edge.includes('partnerLastReadAt'));
 assert.ok(edge.includes('Solo puedes eliminar tus propios mensajes.'));
});

test('chat is a floating entry point, not a bottom-nav or More tool',()=>{
 assert.ok(app.includes('function renderChatFab()'));
 assert.ok(app.includes('data-action="chat-open"')||read('android/app/src/main/assets/mobile/index.html').includes('data-action="chat-open"'));
 assert.ok(css.includes('.chat-fab'));
 assert.ok(app.includes("if(view==='chat')"));
 const navLine=app.match(/const nav=\[[^\n]+/i)?.[0]||'';
 assert.equal(navLine.includes("'chat'"),false);
 const moreStart=app.indexOf('function moreView()'),moreEnd=app.indexOf('function updateMarkup()',moreStart),more=app.slice(moreStart,moreEnd);
 assert.equal(more.includes('data-action="chat-open"'),false,'Más no debe contener un acceso funcional al Chat');
});

test('chat UI supports reply, delete, unread badge and active synchronization',()=>{
 for(const marker of ['chatMessageMarkup','chat-reply','chat-delete','chat-load-more','chatForm','partnerLastReadAt','Leído','Enviado'])assert.ok(app.includes(marker),marker);
 assert.ok(css.includes('.chat-message.own'));
 assert.ok(css.includes('.chat-composer'));
 assert.ok(app.includes("view==='chat'&&document.visibilityState==='visible'"));
});

test('unified notification center includes chat and product events',()=>{
 for(const event of ['chat_message','status_changed','mood_changed','daily_answer','goal_update','memory_shared','plan_update'])assert.ok(push.includes(event),event);
 assert.ok(edge.includes('persistNotification'));
 assert.ok(edge.includes('notifications-list'));
 assert.ok(app.includes('openNotificationCenter'));
 assert.ok(app.includes('header-notification-badge'));
});

test('Android routes chat through a high-priority message channel and activity separately',()=>{
 assert.ok(notifications.includes('CHANNEL_MESSAGES="galaxy-chat-v1"'));
 assert.ok(notifications.includes('CHANNEL_ACTIVITY="galaxy-activity-v1"'));
 assert.ok(notifications.includes('IMPORTANCE_HIGH'));
 assert.ok(notifications.includes('MessagingStyle'));
 assert.ok(firebase.includes('GalaxyNotifications.show'));
 assert.ok(firebase.includes('"chat_message"'));
});

test('notification taps deep-link back into the relevant product surface',()=>{
 assert.ok(notifications.includes('"galaxy_action"'));
 assert.ok(main.includes('captureDeepLink'));
 assert.ok(main.includes('emitPendingDeepLink'));
 assert.ok(main.includes('onNewIntent'));
 assert.ok(app.includes("name==='deep-link'"));
 assert.ok(app.includes('routeGalaxyAction'));
});

test('Android build consumes Firebase client identifiers from GitHub environment',()=>{
 for(const key of ['FIREBASE_PROJECT_ID','FIREBASE_APPLICATION_ID','FIREBASE_API_KEY','FIREBASE_SENDER_ID'])assert.ok(workflow.includes(key),key);
 assert.ok(workflow.includes('secrets.FIREBASE_PROJECT_ID'));
 assert.ok(workflow.includes('vars.FIREBASE_PROJECT_ID'));
});

test('system notification permission is independent from legacy moment opt-in',()=>{
 assert.ok(bridge.includes('requestGalaxyNotifications'));
 assert.ok(main.includes('REQ_GALAXY_NOTIFICATIONS'));
 assert.ok(main.includes('GalaxyNotifications.allowed(this)'));
 assert.ok(app.includes('galaxy-notifications-enable'));
});
