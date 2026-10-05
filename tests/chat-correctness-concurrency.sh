#!/usr/bin/env bash
set -euo pipefail

DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q)

cleanup() {
  "${PSQL[@]}" <<'SQL' >/dev/null
delete from public.galaxy_chat_poll_votes where poll_id::text like '93000000-%';
delete from public.galaxy_chat_poll_options where poll_id::text like '93000000-%';
delete from public.galaxy_chat_polls where id::text like '93000000-%';
delete from public.galaxy_chat_checklist_items where checklist_id::text like '93000000-%';
delete from public.galaxy_chat_checklists where id::text like '93000000-%';
SQL
}
trap cleanup EXIT
cleanup

"${PSQL[@]}" <<'SQL'
insert into public.galaxy_chat_polls(id,created_by,question,allow_multiple) values
 ('93000000-0000-4000-8000-000000000001','0','single race',false),
 ('93000000-0000-4000-8000-000000000010','0','multi race',true),
 ('93000000-0000-4000-8000-000000000020','0','two people',false),
 ('93000000-0000-4000-8000-000000000030','0','close race',false);
insert into public.galaxy_chat_poll_options(id,poll_id,label,position) values
 ('93000000-0000-4000-8000-000000000002','93000000-0000-4000-8000-000000000001','A',0),
 ('93000000-0000-4000-8000-000000000003','93000000-0000-4000-8000-000000000001','B',1),
 ('93000000-0000-4000-8000-000000000011','93000000-0000-4000-8000-000000000010','A',0),
 ('93000000-0000-4000-8000-000000000012','93000000-0000-4000-8000-000000000010','B',1),
 ('93000000-0000-4000-8000-000000000021','93000000-0000-4000-8000-000000000020','A',0),
 ('93000000-0000-4000-8000-000000000022','93000000-0000-4000-8000-000000000020','B',1),
 ('93000000-0000-4000-8000-000000000031','93000000-0000-4000-8000-000000000030','A',0),
 ('93000000-0000-4000-8000-000000000032','93000000-0000-4000-8000-000000000030','B',1);

insert into public.galaxy_chat_checklists(id,created_by,title) values
 ('93000000-0000-4000-8000-000000000040','0','same item race'),
 ('93000000-0000-4000-8000-000000000050','0','different item race');
insert into public.galaxy_chat_checklist_items(id,checklist_id,label,position,checked,updated_by) values
 ('93000000-0000-4000-8000-000000000041','93000000-0000-4000-8000-000000000040','One',0,false,'0'),
 ('93000000-0000-4000-8000-000000000051','93000000-0000-4000-8000-000000000050','One',0,false,'0'),
 ('93000000-0000-4000-8000-000000000052','93000000-0000-4000-8000-000000000050','Two',1,false,'0');
SQL

# Same person selects two choices concurrently in a single-choice poll.
"${PSQL[@]}" -c "select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000001','0','vote','93000000-0000-4000-8000-000000000002',true)" >/tmp/phase2-single-a.log 2>&1 &
P1=$!
"${PSQL[@]}" -c "select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000001','0','vote','93000000-0000-4000-8000-000000000003',true)" >/tmp/phase2-single-b.log 2>&1 &
P2=$!
wait "$P1"; wait "$P2"
test "$("${PSQL[@]}" -Atc "select count(*) from public.galaxy_chat_poll_votes where poll_id='93000000-0000-4000-8000-000000000001' and person='0'")" = "1"

# Multiple-choice keeps both concurrent selections.
"${PSQL[@]}" -c "select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000010','0','vote','93000000-0000-4000-8000-000000000011',true)" >/tmp/phase2-multi-a.log 2>&1 &
P1=$!
"${PSQL[@]}" -c "select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000010','0','vote','93000000-0000-4000-8000-000000000012',true)" >/tmp/phase2-multi-b.log 2>&1 &
P2=$!
wait "$P1"; wait "$P2"
test "$("${PSQL[@]}" -Atc "select count(*) from public.galaxy_chat_poll_votes where poll_id='93000000-0000-4000-8000-000000000010' and person='0'")" = "2"

# Both people can vote simultaneously without corrupting each other's state.
"${PSQL[@]}" -c "select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000020','0','vote','93000000-0000-4000-8000-000000000021',true)" >/tmp/phase2-person-a.log 2>&1 &
P1=$!
"${PSQL[@]}" -c "select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000020','1','vote','93000000-0000-4000-8000-000000000022',true)" >/tmp/phase2-person-b.log 2>&1 &
P2=$!
wait "$P1"; wait "$P2"
test "$("${PSQL[@]}" -Atc "select count(*) from public.galaxy_chat_poll_votes where poll_id='93000000-0000-4000-8000-000000000020'")" = "2"

# Close wins the row lock first; a concurrent vote must block and then be rejected.
"${PSQL[@]}" <<'SQL' >/tmp/phase2-close.log 2>&1 &
begin;
select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000030','0','close',null,true);
select pg_sleep(1);
commit;
SQL
CLOSE_PID=$!
sleep 0.2
if "${PSQL[@]}" -c "select public.galaxy_chat_poll_mutate('93000000-0000-4000-8000-000000000030','1','vote','93000000-0000-4000-8000-000000000032',true)" >/tmp/phase2-vote-after-close.log 2>&1; then
  echo "vote-vs-close race accepted a post-close vote" >&2
  exit 1
fi
wait "$CLOSE_PID"
test "$("${PSQL[@]}" -Atc "select count(*) from public.galaxy_chat_poll_votes where poll_id='93000000-0000-4000-8000-000000000030'")" = "0"

# Identical concurrent checklist retries mutate once and remain idempotent.
"${PSQL[@]}" -c "select public.galaxy_chat_checklist_set('93000000-0000-4000-8000-000000000040','93000000-0000-4000-8000-000000000041','0',true,1)" >/tmp/phase2-check-same-a.log 2>&1 &
P1=$!
"${PSQL[@]}" -c "select public.galaxy_chat_checklist_set('93000000-0000-4000-8000-000000000040','93000000-0000-4000-8000-000000000041','1',true,1)" >/tmp/phase2-check-same-b.log 2>&1 &
P2=$!
wait "$P1"; wait "$P2"
test "$("${PSQL[@]}" -Atc "select version from public.galaxy_chat_checklists where id='93000000-0000-4000-8000-000000000040'")" = "2"
test "$("${PSQL[@]}" -Atc "select version from public.galaxy_chat_checklist_items where id='93000000-0000-4000-8000-000000000041'")" = "2"

# Different items serialize on the parent and each real mutation increments the aggregate version.
"${PSQL[@]}" -c "select public.galaxy_chat_checklist_set('93000000-0000-4000-8000-000000000050','93000000-0000-4000-8000-000000000051','0',true,1)" >/tmp/phase2-check-diff-a.log 2>&1 &
P1=$!
"${PSQL[@]}" -c "select public.galaxy_chat_checklist_set('93000000-0000-4000-8000-000000000050','93000000-0000-4000-8000-000000000052','1',true,1)" >/tmp/phase2-check-diff-b.log 2>&1 &
P2=$!
wait "$P1"; wait "$P2"
test "$("${PSQL[@]}" -Atc "select version from public.galaxy_chat_checklists where id='93000000-0000-4000-8000-000000000050'")" = "3"
test "$("${PSQL[@]}" -Atc "select min(version)||':'||max(version) from public.galaxy_chat_checklist_items where checklist_id='93000000-0000-4000-8000-000000000050'")" = "2:2"

echo "Phase 2 concurrency checks passed"
