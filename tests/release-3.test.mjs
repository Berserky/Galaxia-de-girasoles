import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Mega 3.0 release migration is canonical and non-destructive',()=>{
 const sql=read('supabase/migrations/20261003213818_mega_update_3_release.sql');
 assert.equal(/\bas \$\s*$/m.test(sql),false,'PL/pgSQL bodies must use valid dollar quoting');
 assert.equal(/^\s*end \$;\s*$/m.test(sql),false,'PL/pgSQL bodies must close with $$');
 assert.equal(/\b(drop table|truncate table|drop column|drop schema)\b/i.test(sql),false,'release migration must stay additive');
 for(const table of ['galaxy_daily_questions','galaxy_goals','galaxy_push_tokens','galaxy_context_events','galaxy_intelligence_documents'])
  assert.ok(sql.includes('create table if not exists public.'+table),table);
 const tables=[...sql.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map(m=>m[1]);
 assert.equal(new Set(tables).size,tables.length,'migration must not repeat table blocks');
});

test('Android release candidate metadata is 3.5.1 with versionCode 35',()=>{
 const gradle=read('android/app/build.gradle.kts');
 const candidate=read('.github/workflows/android-release-candidate.yml');
 const stable=read('.github/workflows/android-release-stable.yml');
 assert.match(gradle,/versionCode = 35/);
 assert.match(gradle,/versionName = "3\.5\.1"/);
 assert.match(candidate,/VERSION_CODE=.*versionCode/);
 assert.match(candidate,/VERSION_NAME=.*versionName/);
 assert.match(stable,/versionCode:\$versionCode/);
 assert.match(stable,/versionName:\$versionName/);
 assert.match(candidate,/permissions:\r?\n\s+contents: read/);
 assert.match(stable,/permissions:[\s\S]*?contents: write/);
});

test('canonical schema no longer contains duplicated Mega blocks or broken dollar quotes',()=>{
 const sql=read('supabase/schema.sql');
 assert.equal(/\bas \$\s*$/m.test(sql),false);
 assert.equal(/^\s*end \$;\s*$/m.test(sql),false);
 assert.equal((sql.match(/-- Mega Update 3\.0 · Galaxy Goals Engine/g)||[]).length,1);
 assert.equal((sql.match(/-- Mega Update 3\.0 · Galaxy Bond Engine 2\.0/g)||[]).length,1);
 assert.equal((sql.match(/-- Mega Update 3\.0 · Galaxy Context Engine/g)||[]).length,1);
 assert.equal((sql.match(/-- Mega Update 3\.0 · Galaxy Intelligence Engine/g)||[]).length,1);
});


test('QA hardening migration keeps least privilege and removes known planner warnings',()=>{
 const sql=read('supabase/migrations/20261004051137_qa_hardening_330.sql');
 assert.match(sql,/revoke all on public\.galaxy_daily_questions from public, anon, authenticated/i);
 assert.match(sql,/drop policy if exists destinations_write_own/i);
 assert.match(sql,/create policy destinations_insert_own/i);
 assert.match(sql,/create policy destinations_update_own/i);
 assert.match(sql,/create policy destinations_delete_own/i);
 assert.match(sql,/create index if not exists galaxy_chat_metrics_message_idx\s+on public\.galaxy_chat_metrics\(message_id\)/i);
 assert.equal(/drop table|truncate table|drop column/i.test(sql),false);
});


test('chat_sync push hotfix is compatible with database constraints',()=>{
 const sql=read('supabase/migrations/20261004045515_allow_chat_sync_push.sql');
 assert.match(sql,/galaxy_push_subscriptions_event_type_check[\s\S]*?'chat_sync'/i);
 assert.match(sql,/galaxy_push_events_event_type_check[\s\S]*?'chat_sync'/i);
 assert.equal(/drop table|truncate table|drop column/i.test(sql),false);
});


test('encounter stats defines deterministic Bogotá month boundaries',()=>{
 const edge=read('supabase/functions/android-companion/index.ts');
 assert.match(edge,/function monthBounds\(month:string\)/);
 assert.match(edge,/Date\.UTC\(yearValue,monthValue-1,1,5,0,0,0\)/);
 assert.match(edge,/bounds=monthBounds\(currentMonth\)/);
});


test('Android CI typechecks the Supabase Edge Function',()=>{
 const workflow=read('.github/workflows/android-companion.yml');
 assert.match(workflow,/denoland\/setup-deno@v2/);
 assert.match(workflow,/deno check(?: --[^\n]+)? supabase\/functions\/android-companion\/index\.ts/);
});


test('GPS history writes are idempotent without raising duplicate-key errors',()=>{
 const edge=read('supabase/functions/android-companion/index.ts');
 assert.match(edge,/galaxy_location_history"\)\.upsert\(row,\{onConflict:"source_device_id,client_sample_id",ignoreDuplicates:true\}\)/);
 assert.equal(edge.includes('error.code!=="23505"'),false);
});


test('trip point map reads have a recent-first index',()=>{
 const sql=read('supabase/migrations/20261004052203_trip_points_map_index.sql');
 assert.match(sql,/create index if not exists galaxy_trip_points_created_idx\s+on public\.galaxy_trip_points\(created_at desc\)/i);
});
