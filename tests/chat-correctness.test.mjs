import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const edge=read('supabase/functions/android-companion/index.ts');
const app=read('android/app/src/main/assets/mobile/app.js');
const migration=read('supabase/migrations/20261005023031_qa_phase2_chat_correctness.sql');
const schema=read('supabase/schema.sql');
const workflow=read('.github/workflows/chat-correctness-db.yml');

const block=(source,start,end)=>{
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'missing block '+start);
  return source.slice(a,b);
};

test('Phase 2 evolves the canonical Chat model without alternate tables',()=>{
  for(const fn of ['galaxy_chat_search_page','galaxy_chat_poll_mutate','galaxy_chat_poll_winner','galaxy_chat_checklist_set']){
    assert.ok(migration.includes('function public.'+fn),fn);
    assert.ok(schema.includes('function public.'+fn),fn+' missing from schema snapshot');
  }
  assert.equal(/create\s+table/i.test(migration),false);
  assert.equal(migration.includes("errcode='40001'")||migration.includes('errcode = \'40001\''),false);
  assert.ok(migration.includes('to service_role'));
  assert.ok(migration.includes('from public,anon,authenticated'));
});

test('NG-QA-008 searches the full canonical history with a server_seq cursor',()=>{
  const search=block(edge,'async function chatSearch(','\nasync function ');
  assert.ok(search.includes('db.rpc("galaxy_chat_search_page"'));
  assert.ok(search.includes('p_before_seq'));
  assert.ok(search.includes('nextBeforeSeq'));
  assert.equal(search.includes('.limit(500)'),false);
  assert.ok(migration.includes("order by m.server_seq desc"));
  assert.ok(migration.includes("m.server_seq<p_before_seq"));
  assert.ok(migration.includes("galaxy_chat_entity_refs"));
  assert.ok(app.includes("data-action=\"chat-search-more\""));
  assert.ok(app.includes("beforeSeq:Number(beforeSeq||0)"));
});

test('NG-QA-009 poll mutations are atomic and idempotent at the database boundary',()=>{
  const poll=block(edge,'async function chatPoll(','\nasync function chatChecklist(');
  assert.ok(poll.includes('db.rpc("galaxy_chat_poll_mutate"'));
  assert.ok(poll.includes('mutation?.changed'));
  assert.equal(poll.includes('db.from("galaxy_chat_poll_votes").upsert'),false);
  assert.ok(migration.includes('for update'));
  assert.ok(migration.includes('on conflict(poll_id,option_id,person) do nothing'));
  assert.ok(migration.includes("if effective_closed then"));
  assert.ok(workflow.includes('chat-correctness-concurrency.sh'));
});

test('NG-QA-010 Plan conversion resolves one authoritative closed-poll winner',()=>{
  const poll=block(edge,'async function chatPoll(','\nasync function chatChecklist(');
  assert.ok(poll.includes('operation==="winner"'));
  assert.ok(poll.includes('db.rpc("galaxy_chat_poll_winner"'));
  assert.ok(app.includes("operation:'winner',pollId:btn.dataset.pollId"));
  const render=block(app,"if(card.type==='POLL')","if(card.type==='CHECKLIST')");
  assert.ok(render.includes('card.winner'));
  assert.ok(render.includes('card.tie'));
  assert.equal(render.includes('data-option='),false);
  const handler=app.slice(app.indexOf("if(a==='chat-poll-plan')"),app.indexOf("if(a==='chat-check-set')"));
  assert.equal(handler.includes('btn.dataset.option'),false);
});

test('NG-QA-011 checklist aggregate versions increment under one parent row lock',()=>{
  const checklist=block(edge,'async function chatChecklist(','\nasync function ');
  assert.ok(checklist.includes('db.rpc("galaxy_chat_checklist_set"'));
  assert.ok(checklist.includes('idempotent:!mutation?.changed'));
  assert.match(migration,/where id=p_checklist_id\r?\n  for update/);
  assert.ok(migration.includes('set version=version+1'));
  assert.ok(migration.includes('if item_row.checked=p_checked then'));
});
