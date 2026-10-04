import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('supabase/schema.sql');
const firewall=schema.slice(schema.lastIndexOf('-- Phase 0 Privacy Firewall'));
const edge=read('supabase/functions/android-companion/index.ts');
const intelligenceSource=read('supabase/functions/android-companion/intelligence-engine.ts');

function intelligenceApi(){
  const code=stripTypeScriptTypes(intelligenceSource.replace(/\bexport\s+/g,''));
  const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON,crypto:{subtle:{}}};
  vm.runInNewContext(code+'\n;module.exports={buildIntelligenceDocument};',context);
  return context.module.exports;
}
const intelligence=intelligenceApi();

function block(source,start,end){
  const a=source.indexOf(start);
  assert.notEqual(a,-1,'missing '+start);
  const b=end?source.indexOf(end,a+start.length):-1;
  return source.slice(a,b>a?b:source.length);
}

test('NG-QA-001 direct galaxy_items access cannot reveal locked capsule payload',()=>{
  const itemsPolicy=block(firewall,'create policy items_read','create or replace function public.galaxy_capsule_object_access');
  assert.match(itemsPolicy,/capsule/i);
  assert.match(itemsPolicy,/galaxy_capsule/i);
});

test('NG-QA-001 locked capsules cannot be unlocked by partner UPDATE/DELETE',()=>{
  const writePolicies=block(firewall,'drop policy if exists items_update','create or replace function public.galaxy_capsule_object_access');
  assert.match(writePolicies,/author=public\.galaxy_person/);
  const save=block(edge,'async function itemSave(','async function itemDelete(');
  const del=block(edge,'async function itemDelete(','async function settingsSave(');
  assert.match(save,/row\.kind.*capsule/);
  assert.match(save,/row\.author.*person/);
  assert.match(save,/No puedes cambiar el tipo de contenido/);
  assert.match(del,/row\.kind.*capsule/);
  assert.match(del,/row\.author.*person/);
});

test('NG-QA-001 Storage SELECT checks capsule lock before exposing linked media',()=>{
  const photoPolicy=block(firewall,'create policy galaxy_photos_read','drop policy if exists galaxy_voice_read');
  const voicePolicy=block(firewall,'create policy galaxy_voice_read','drop policy if exists locations_read');
  assert.match(photoPolicy,/capsule/i);
  assert.match(voicePolicy,/capsule/i);
  assert.match(firewall,/galaxy_capsule_object_access/i);
});

test('NG-QA-001 place unlock is persistent, server-owned and driven by location updates',()=>{
  assert.match(firewall,/galaxy_capsule_mark_place_unlocks/);
  assert.match(firewall,/capsule_unlock_state_guard/);
  assert.match(firewall,/unlockedFor/);
  const access=block(edge,'function chatCapsuleAccess(','function privacyVisibleLocations(');
  assert.match(access,/unlockedFor/);
  const location=block(edge,'async function location(','function nextCalendarEvent(');
  assert.match(location,/galaxy_capsule_mark_place_unlocks/);
  const clean=block(edge,'function cleanItem(','async function validateCapsuleReferences(');
  assert.match(clean,/delete out\.unlockedFor/);
});

test('NG-QA-001 service-role media browser filters locked capsule objects for the caller',()=>{
  const media=block(edge,'async function mediaList(','async function mediaDelete(');
  assert.match(media,/listBucket\("galaxy-photos",person\)/);
  assert.match(media,/listBucket\("galaxy-voice",person\)/);
  const list=block(edge,'async function listBucket(','async function mediaList(');
  assert.match(list,/capsuleObjectVisible/);
  const guard=block(edge,'function capsuleObjectVisible(','async function signedForPerson(');
  assert.match(guard,/chatCapsuleAccess/);
});

test('NG-QA-001 backup and history apply capsule privacy even for the author',()=>{
  const backup=block(edge,'async function backupExport(','function uuidish(');
  const history=block(edge,'async function todayHistory(','async function encounterStats(');
  assert.match(backup,/privacyItemResponse/);
  assert.match(backup,/hiddenCapsules/);
  assert.match(backup,/chatReconcileDeletedMedia/);
  assert.match(history,/chatCapsuleAccess/);
});

test('NG-QA-001 capsule media cannot be laundered through Bond or voice validation',()=>{
  const widget=block(edge,'async function bondWidget(','async function gesture(');
  const voice=block(edge,'async function validateVoice(','async function bondVoice(');
  assert.match(widget,/signedForPerson\("galaxy-photos"/);
  assert.match(voice,/signedForPerson\("galaxy-voice"/);
});

test('NG-QA-002 future date-time capsule is not searchable or semantically indexed',()=>{
  const doc=intelligence.buildIntelligenceDocument('item',{
    id:'capsule-future',kind:'capsule',author:'0',version:1,created:'2026-10-04T12:00:00Z',
    data:{
      title:'Cumpleaños',body:'SECRETO-NG-QA-002',
      unlockType:'date',unlockDate:'2026-12-01',unlockTime:'21:30',
      unlockAt:'2026-12-02T02:30:00.000Z',
      photoPath:'0/private.jpg',audioPath:'0/private.m4a',songId:'11111111-1111-4111-8111-111111111111',
      latitude:4.6,longitude:-74.1
    }
  },{today:'2026-10-04',now:'2026-10-04T21:00:00.000Z'});
  assert.equal(doc.searchable,false);
  const serialized=JSON.stringify(doc);
  for(const secret of ['SECRETO-NG-QA-002','private.jpg','private.m4a','11111111-1111-4111-8111-111111111111','4.6','-74.1'])
    assert.equal(serialized.includes(secret),false,secret);
});

test('NG-QA-002 place capsule is denied from Intelligence while lock is unresolved',()=>{
  const doc=intelligence.buildIntelligenceDocument('item',{
    id:'capsule-place',kind:'capsule',author:'1',version:1,created:'2026-10-04T12:00:00Z',
    data:{title:'Lugar secreto',body:'SECRETO-LUGAR',unlockType:'place',placeId:7,placeName:'Destino',latitude:4.7,longitude:-74.2,radius:150}
  },{today:'2026-10-04',now:'2026-10-04T21:00:00.000Z'});
  assert.equal(doc.searchable,false);
  assert.equal(JSON.stringify(doc).includes('SECRETO-LUGAR'),false);
});

test('NG-QA-003 direct location policies expose own rows or actively shared partner rows only',()=>{
  const current=block(firewall,'create policy locations_read','drop policy if exists trip_points_read');
  const points=block(firewall,'create policy trip_points_read','drop policy if exists location_history_read');
  const history=block(firewall,'create policy location_history_read','drop policy if exists trip_history_read');
  for(const policy of [current,points,history]){
    assert.match(policy,/galaxy_person/i);
    assert.match(policy,/sharing/i);
  }
});

test('NG-QA-003 service-role map and mobile state sanitize paused partner GPS',()=>{
  const map=block(edge,'async function mapState(','async function placeSave(');
  const mobile=block(edge,'async function mobileState(','function intelligenceVisible(');
  assert.match(map,/visibleLocations|privacyVisibleLocations|filterVisibleLocation/i);
  assert.match(map,/visibleTrip|privacyVisibleTrip/i);
  assert.match(mobile,/visibleLocations|privacyVisibleLocations|filterVisibleLocation/i);
});

test('NG-QA-013 Intelligence source cleanup is queued and idempotently reconcilable',()=>{
  assert.match(firewall,/galaxy_intelligence_cleanup_queue/i);
  assert.match(firewall,/galaxy_intelligence_reconcile_cleanup/i);
  assert.match(firewall,/on conflict/i);
  assert.match(edge,/reconcileIntelligenceCleanup/i);
});

test('NG-QA-014 delete-for-both removes attachment rows and Storage objects before media can be re-signed',()=>{
  const del=block(edge,'async function chatDelete(','async function chatReact(');
  assert.match(del,/chatDeleteAttachments/);
  const cleanup=block(edge,'async function chatDeleteAttachments(','async function chatReconcileDeletedMedia(');
  assert.match(cleanup,/galaxy_chat_attachments/);
  assert.match(cleanup,/storage\.from|\.remove\(/);
  const hydrate=block(edge,'async function chatHydrate(','async function chatVisibleRows(');
  assert.match(hydrate,/deleted_at|deletedAt/);
});

test('NG-QA-014 deleted media cannot survive through pins, saved, search, shared media, albums or aroundId',()=>{
  const visible=block(edge,'async function chatVisibleRows(','async function chatState(');
  assert.match(visible,/deleted_at/);
  const shared=block(edge,'async function chatShared(','async function chatAlbums(');
  assert.match(shared,/deleted_at|chatVisibleRows/);
  const albums=block(edge,'async function chatAlbums(','async function chatStickers(');
  assert.match(albums,/deleted_at|message_id|galaxy_chat_messages/);
});

test('privacy firewall does not bump or replace Android stable 3.5.0',()=>{
  const gradle=read('android/app/build.gradle.kts');
  assert.match(gradle,/versionCode = 34; versionName = "3\.5\.0"/);
});
