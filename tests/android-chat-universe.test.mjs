import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('android/app/src/main/assets/mobile/app.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const edge=read('supabase/functions/android-companion/index.ts');
const migration=read('supabase/migrations/20261004173000_galaxy_chat_universe_350.sql');
const schema=read('supabase/schema.sql');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const gradle=read('android/app/build.gradle.kts');

test('Galaxy Chat Universe 3.5 parses and is versioned as Android 34',()=>{
 assert.doesNotThrow(()=>new vm.Script(app,{filename:'app.js'}));
 assert.match(gradle,/versionCode = 34; versionName = "3\.5\.0"/);
 assert.ok(css.includes('Galaxy Chat Universe 3.5.0'));
});

test('Universe migration adds only Chat-native references, polls and checklists',()=>{
 for(const table of ['galaxy_chat_entity_refs','galaxy_chat_polls','galaxy_chat_poll_options','galaxy_chat_poll_votes','galaxy_chat_checklists','galaxy_chat_checklist_items']){
  assert.match(migration,new RegExp('create table if not exists public\\.'+table));
  assert.match(schema,new RegExp('create table if not exists public\\.'+table));
 }
 for(const forbidden of ['galaxy_chat_memories','galaxy_chat_plans','galaxy_chat_goals','galaxy_chat_places','galaxy_chat_songs','galaxy_chat_capsules','galaxy_chat_eta_engine'])
  assert.equal(migration.includes(forbidden),false,forbidden);
 assert.ok(migration.includes('to service_role'));
 assert.equal(/\b(drop table|truncate table|drop column|drop schema)\b/i.test(migration),false);
});

test('native cards preserve references to the original Galaxy domains',()=>{
 for(const marker of ['MEMORY:"memory"','PLAN:"plan"','GOAL:"goal"','PLACE:"place"','SONG:"song"','ETA:"context_session"','CHECK_IN:"context_session"','POLL:"poll"','CHECKLIST:"checklist"','CAPSULE:"capsule"','DAILY_QUESTION:"daily_question"','EVENT:"event"','STATUS:"status"'])
  assert.ok(edge.includes(marker),marker);
 for(const source of ['db.from("galaxy_items")','db.from("galaxy_goals")','db.from("galaxy_places")','db.from("galaxy_daily_questions")','db.from("galaxy_context_sessions")'])
  assert.ok(edge.includes(source),source);
 assert.ok(edge.includes('chatCardUnavailable(ref)'));
});

test('unlocked capsules reuse existing photo, voice and song storage by reference',()=>{
 assert.ok(app.includes('data-action="capsule-photo-file"'));
 assert.ok(app.includes('data-action="capsule-audio-file"'));
 assert.ok(app.includes('name="capsuleSongId"'));
 assert.ok(edge.includes('db.schema("storage").from("objects")'));
 assert.ok(edge.includes('bucket_id","galaxy-photos"'));
 assert.ok(edge.includes('bucket_id","galaxy-voice"'));
 assert.ok(edge.includes('card.photoUrl=await signed("galaxy-photos"'));
 assert.ok(edge.includes('card.audioUrl=await signed("galaxy-voice"'));
 assert.ok(app.includes('capsule-reveal-media'));
});

test('capsules support date/time or place unlock without exposing coordinates while locked',()=>{
 assert.ok(app.includes('name="unlockType"'));
 assert.ok(app.includes('name="unlockPlaceId"'));
 assert.ok(edge.includes('out.unlockType=String(out.unlockType||"date")==="place"?"place":"date"'));
 assert.ok(edge.includes('chatCapsuleAccess(data,person,locations||[])'));
 assert.ok(app.includes('Se desbloquea al llegar al lugar elegido.'));
 const card=edge.slice(edge.indexOf('function chatItemCard('),edge.indexOf('function chatNormalizeEntityRef(')>edge.indexOf('function chatItemCard(')?edge.indexOf('function chatNormalizeEntityRef('):edge.indexOf('async function chatHydrateEntityRef('));
 assert.equal(/latitude|longitude/.test(card.slice(card.indexOf('if(access.locked)'),card.indexOf('if(data.body)'))),false);
});

test('locked capsules never expose protected content through Chat hydration',()=>{
 const itemStart=edge.indexOf('function chatItemCard(');
 const lock=edge.indexOf('if(access.locked)return {...base,title,locked:true,unlockType:access.unlockType,unlockAt:access.unlockAt}',itemStart);
 const body=edge.indexOf('if(data.body)safe.body',itemStart);
 assert.ok(lock>=itemStart&&body>lock,'capsule access guard must run before body/media metadata is exposed');
 assert.ok(app.includes("card.type==='CAPSULE'&&card.locked"));
});

test('polls are normalized, idempotent and notify the exact Chat card',()=>{
 assert.ok(migration.includes('galaxy_chat_poll_vote_guard'));
 assert.ok(migration.includes('position between 0 and 9'));
 assert.ok(edge.includes('labels.length<2'));
 assert.ok(edge.includes('slice(0,10)'));
 assert.ok(edge.includes('onConflict:"poll_id,option_id,person"'));
 assert.ok(edge.includes('senderName+" votó en "'));
 assert.ok(edge.includes('entityType:"chat_message",entityId:String(poll.message_id)'));
 assert.ok(app.includes('chat-poll-vote'));
 assert.ok(app.includes('chat-poll-plan'));
});

test('checklists use optimistic versions and exact-card notifications',()=>{
 assert.ok(migration.includes('version integer not null default 1'));
 assert.ok(edge.includes('expectedVersion'));
 assert.ok(edge.includes('.eq("version",item.version)'));
 assert.ok(edge.includes('senderName+(checked?" completó ":" reabrió ")'));
 assert.ok(app.includes('chat-check-set'));
 assert.ok(app.includes('chat-check-convert'));
});

test('Chat can start Acompáñame through the existing Context Engine without auto-enabling GPS',()=>{
 assert.ok(app.includes('function openChatContextMenu('));
 assert.ok(app.includes("api('context-session',{operation:'start',mode:'return_home'})"));
 assert.ok(app.includes("api('context-session',{operation:'start',mode:'accompany'"));
 assert.ok(app.includes("queueGalaxyCard('CHECK_IN','context_session'"));
 const start=app.indexOf("if(a==='chat-context-start')");
 const end=app.indexOf("if(a==='chat-galaxy-open'",start);
 const block=app.slice(start,end);
 assert.ok(block.includes('if(!native.tracking)'));
 assert.equal(block.includes("GalaxyNative.call('startLocation')"),false);
});

test('ETA and check-in reuse Context Engine and expose lifecycle states',()=>{
 assert.equal(migration.includes('create table if not exists public.galaxy_chat_eta'),false);
 assert.ok(edge.includes('db.from("galaxy_context_sessions")'));
 assert.ok(edge.includes('db.from("galaxy_context_eta_history")'));
 for(const state of ['EN CAMINO','CERCA','LLEGÓ','CANCELADO','FINALIZADO'])assert.ok(edge.includes('"'+state+'"'),state);
 assert.ok(app.includes('chat-card-eta-map'));
 assert.ok(edge.includes('.in("card_type",["ETA","CHECK_IN"])'));
 assert.ok(edge.includes('entityType:"chat_message",entityId:String(ref.message_id)'));
});

test('Daily Question replies stay in the existing Daily system',()=>{
 assert.ok(edge.includes('db.from("galaxy_daily_questions")'));
 assert.ok(edge.includes('db.from("galaxy_daily")'));
 assert.ok(app.includes("saveDaily('answer',answer)"));
 assert.equal(migration.includes('galaxy_chat_daily_answers'),false);
});

test('sharing, save-as and album-to-memory require human confirmation paths',()=>{
 assert.ok(app.includes('Compartir en Galaxy Chat'));
 for(const kind of ['memory','plan','goal','place','song','note','wish'])assert.ok(app.includes("'"+kind+"'"),kind);
 assert.ok(app.includes('No se creará nada automáticamente.'));
 assert.ok(app.includes("type:'chat-album'"));
 assert.ok(app.includes('attachmentIds'));
 assert.ok(app.includes('Nada se guardará hasta que confirmes en el editor.'));
});

test('statuses can enter Chat and be replied to from the exact status card',()=>{
 assert.ok(app.includes('status-chat-reply'));
 assert.ok(app.includes('chat-card-status-reply'));
 assert.ok(edge.includes('type:"STATUS"'));
});

test('smart actions are deterministic and do not invoke Galaxy Intelligence',()=>{
 const start=app.indexOf('function chatSmartActionsMarkup(');
 const end=app.indexOf('\nfunction ',start+1);
 const block=app.slice(start,end);
 for(const marker of ['chat-smart-link','chat-smart-plan','chat-smart-place'])assert.ok(block.includes(marker),marker);
 assert.equal(/intelligence|openai|embedding/i.test(block),false);
});

test('typed search includes Universe cards',()=>{
 for(const type of ['memories','plans','music','places','goals','polls','checklists','capsules','events','eta','daily','status'])
  assert.ok(edge.includes(type+':"'),type);
 for(const label of ['Recuerdos','Planes','Música','Lugares','Objetivos','Encuestas','Checklists','Cápsulas','Eventos'])
  assert.ok(app.includes(label),label);
});

test('backup v4 includes new Chat-native Universe state by reference',()=>{
 assert.ok(edge.includes('version:4'));
 for(const field of ['entityRefs:chatEntityRefs','polls:chatPolls','pollOptions:chatPollOptions','pollVotes:chatPollVotes','checklists:chatChecklists','checklistItems:chatChecklistItems'])
  assert.ok(edge.includes(field),field);
 assert.ok(edge.includes('![1,2,3,4].includes(Number(backup.version))'));
});

test('Android native allowlist exposes new Chat APIs',()=>{
 for(const action of ['chat-poll','chat-checklist','chat-search'])assert.ok(main.includes('"'+action+'"'),action);
});


test('Smart Actions detects deterministic date/time and routes reminders through the existing event flow',()=>{
 assert.ok(app.includes('function chatSmartDateTime('));
 assert.ok(app.includes('chat-smart-remind'));
 assert.ok(app.includes("chatOpenItemDraft('event'"));
 assert.ok(app.includes('Confirma el evento para activar su recordatorio.'));
 const start=app.indexOf('function chatSmartDateTime('),end=app.indexOf('\nfunction ',app.indexOf('function chatSmartActionsMarkup(')+1);
 const block=app.slice(start,end>start?end:app.length);
 assert.equal(/intelligence|openai|embedding/i.test(block),false);
});

test('events preserve optional time and render it through native cards',()=>{
 assert.ok(app.includes('name="eventTime"'));
 assert.ok(edge.includes('if(kind==="event"&&out.time)'));
 assert.ok(edge.includes('safe.time=text(data.time,12)'));
});

test('album to memory keeps binary media by reference and signs previews only at read time',()=>{
 assert.ok(app.includes("type:'chat-album'"));
 assert.ok(app.includes('attachmentIds'));
 assert.ok(edge.includes('albumMemoryItems'));
 assert.ok(edge.includes('galaxy_chat_attachments'));
 assert.ok(edge.includes('row.data.sourceMedia=media'));
 assert.ok(app.includes('memory-source-media'));
});
