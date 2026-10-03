import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Mega 3.0 release migration is canonical and non-destructive',()=>{
 const sql=read('supabase/migrations/20261003220000_mega_update_3_release.sql');
 assert.equal(/\bas \$\s*$/m.test(sql),false,'PL/pgSQL bodies must use valid dollar quoting');
 assert.equal(/^\s*end \$;\s*$/m.test(sql),false,'PL/pgSQL bodies must close with $$');
 assert.equal(/\b(drop table|truncate table|drop column|drop schema)\b/i.test(sql),false,'release migration must stay additive');
 for(const table of ['galaxy_daily_questions','galaxy_goals','galaxy_push_tokens','galaxy_context_events','galaxy_intelligence_documents'])
  assert.ok(sql.includes('create table if not exists public.'+table),table);
 const tables=[...sql.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map(m=>m[1]);
 assert.equal(new Set(tables).size,tables.length,'migration must not repeat table blocks');
});

test('Android stable metadata is aligned to Mega 3.0',()=>{
 const gradle=read('android/app/build.gradle.kts'),workflow=read('.github/workflows/android-companion.yml');
 assert.match(gradle,/versionCode = 24/);
 assert.match(gradle,/versionName = "3\.0\.2"/);
 assert.match(workflow,/"versionCode":24/);
 assert.match(workflow,/"versionName":"3\.0\.2"/);
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
