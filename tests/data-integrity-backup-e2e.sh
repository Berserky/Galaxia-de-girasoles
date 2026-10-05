#!/usr/bin/env bash
set -euo pipefail

DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
FUNCTION_URL='http://127.0.0.1:54321/functions/v1/android-companion'
DEVICE_TOKEN='qa-data-integrity-device-0000000000000000000000000000000000000001'
TOKEN_HASH=$(printf '%s' "$DEVICE_TOKEN" | sha256sum | awk '{print $1}')

ANON_KEY=$(supabase status -o env | sed -n 's/^ANON_KEY="\(.*\)"$/\1/p')
[ -n "$ANON_KEY" ] || { echo "local Supabase ANON_KEY missing"; exit 1; }
curl(){ command curl -H "Authorization: Bearer $ANON_KEY" "$@"; }

psql "$DB_URL" -v ON_ERROR_STOP=1 -v token_hash="$TOKEN_HASH" <<'SQL'
insert into public.galaxy_devices(person,name,token_hash,last_seen_at)
values('0','Data Integrity QA',:'token_hash',now())
on conflict(token_hash) do update set revoked_at=null,last_seen_at=excluded.last_seen_at;

-- Exceed the old hard limit of 2,000 items without relying on application paging.
insert into public.galaxy_items(id,kind,data,author,created)
select gen_random_uuid(),'note',
       jsonb_build_object('title','Bulk QA '||g,'body','row-'||g),
       '0',now()-make_interval(secs=>g)
from generate_series(1,2105) g;

insert into public.galaxy_rewards(person,reward_key,day,coins)
values('0','qa_phase1_restore',(now() at time zone 'America/Bogota')::date,3)
on conflict do nothing;

-- Exercise exact restore through triggers that normally own server-side fields.
insert into public.galaxy_items(id,kind,data,author,created) values(
 'c1000000-0000-4000-8000-000000000003',
 'capsule',
 '{"title":"Unlocked place capsule","body":"server state must survive","unlockType":"place","latitude":4.7,"longitude":-74.2,"radius":150,"unlockedFor":["0"]}'::jsonb,
 '0',
 '2026-10-01T10:00:00Z'
);
insert into public.galaxy_goals(
 id,kind,title,description,category,target_date,status,target_amount,created_by,version,completed_at,created_at,updated_at
) values(
 'c3000000-0000-4000-8000-000000000001',
 'goal','Restore exact goal','trigger-owned fields must survive','project',null,'active',null,'0',7,null,
 '2026-09-01T10:00:00Z','2026-09-20T15:30:00Z'
);
SQL

printf '\xff\xd8\xff\xd9' > /tmp/qa-backup-photo.jpg

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "notify pgrst, 'reload schema';"
sleep 2
supabase functions serve android-companion --no-verify-jwt >/tmp/data-integrity-edge.log 2>&1 &
EDGE_PID=$!
cleanup(){ kill "$EDGE_PID" >/dev/null 2>&1 || true; }
dump_edge_log(){ echo "--- android-companion local log ---"; tail -200 /tmp/data-integrity-edge.log 2>/dev/null || true; }
trap cleanup EXIT
trap 'code=$?; dump_edge_log; exit "$code"' ERR

ready=false
for _ in $(seq 1 60); do
  status=$(curl -sS -o /tmp/phase1-health.json -w '%{http_code}' \
    -X POST "$FUNCTION_URL" -H 'content-type: application/json' --data '{"action":"pair"}' || true)
  if [ "$status" = "400" ]; then ready=true; break; fi
  sleep 1
done
[ "$ready" = "true" ] || { echo "Edge did not become ready"; dump_edge_log; exit 1; }

upload=$(curl -fsS -X POST "$FUNCTION_URL" \
  -H "x-device-token: $DEVICE_TOKEN" \
  -H 'x-mobile-action: upload' \
  -H 'x-media-kind: photo' \
  -H 'x-file-name: qa-backup-photo.jpg' \
  -H 'content-type: image/jpeg' \
  --data-binary @/tmp/qa-backup-photo.jpg)
PHOTO_PATH=$(jq -r '.path // empty' <<<"$upload")
[ -n "$PHOTO_PATH" ] || { echo "photo upload failed: $upload"; exit 1; }

psql "$DB_URL" -v ON_ERROR_STOP=1 -v photo_path="$PHOTO_PATH" <<'SQL'
insert into public.galaxy_items(id,kind,data,author,created) values
(
 'c1000000-0000-4000-8000-000000000001',
 'memory',
 jsonb_build_object('title','Restore sentinel','body','must survive','photoPath',:'photo_path'),
 '0',
 '2026-10-04T18:00:00Z'
),
(
 'c1000000-0000-4000-8000-000000000002',
 'note',
 '{"title":"Atomic sentinel","body":"must not appear after failed restore"}'::jsonb,
 '0',
 '2026-10-04T18:00:01Z'
);
SQL

PRE_HASH=$(psql "$DB_URL" -Atqc "select md5(public.galaxy_backup_export_v5()::text)")
PRE_ITEMS=$(psql "$DB_URL" -Atqc "select jsonb_array_length(public.galaxy_backup_export_v5()->'items')")
[ "$PRE_ITEMS" -gt 2000 ] || { echo "dataset did not exceed old item limit: $PRE_ITEMS"; exit 1; }

export_status=$(curl -sS -o /tmp/phase1-backup.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data '{"action":"backup-export"}')
[ "$export_status" = "200" ] || { echo "backup export failed: $export_status"; cat /tmp/phase1-backup.json; exit 1; }

jq -e --argjson items "$PRE_ITEMS" '
  .format=="nuestra-galaxia-backup" and
  .version==5 and
  .manifest.schemaVersion=="20261005011401" and
  .manifest.counts.items==$items and
  .manifest.limits.maxRowsPerSection>=100000 and
  .manifest.media.count>=1 and
  .manifest.media.strategy=="same-project-storage-snapshot-v1" and
  .manifest.payload.algorithm=="SHA-256" and
  (.manifest.payload.sha256|test("^[0-9a-f]{64}$"))
' /tmp/phase1-backup.json >/dev/null || { echo "descriptor/manifest invalid"; cat /tmp/phase1-backup.json; exit 1; }

DESCRIPTOR_BYTES=$(wc -c </tmp/phase1-backup.json)
[ "$DESCRIPTOR_BYTES" -lt $((2*1024*1024)) ] || { echo "portable descriptor unexpectedly exceeds old Android limit"; exit 1; }

# Destroy the backed staging state while intentionally preserving auth/device and
# server-side backup payload/snapshots.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
truncate table
 public.galaxy_settings,
 public.galaxy_items,
 public.galaxy_daily,
 public.galaxy_home,
 public.galaxy_rewards,
 public.galaxy_places,
 public.galaxy_location_history,
 public.galaxy_trip_history,
 public.galaxy_place_events,
 public.galaxy_destinations,
 public.galaxy_encounters,
 public.galaxy_bond,
 public.galaxy_bond_config,
 public.galaxy_bond_participation,
 public.galaxy_daily_questions,
 public.galaxy_goals,
 public.galaxy_goal_participants,
 public.galaxy_goal_steps,
 public.galaxy_goal_links,
 public.galaxy_goal_contributions,
 public.galaxy_bond_gestures,
 public.galaxy_context_settings,
 public.galaxy_voice_transcripts,
 public.galaxy_photo_context,
 public.galaxy_chat_messages,
 public.galaxy_chat_read_state,
 public.galaxy_chat_reactions,
 public.galaxy_chat_hidden,
 public.galaxy_chat_pins,
 public.galaxy_chat_favorites,
 public.galaxy_chat_edits,
 public.galaxy_chat_attachments,
 public.galaxy_chat_preferences,
 public.galaxy_chat_transcripts,
 public.galaxy_chat_translations,
 public.galaxy_chat_albums,
 public.galaxy_chat_album_items,
 public.galaxy_chat_stickers,
 public.galaxy_chat_sticker_favorites,
 public.galaxy_chat_sticker_recents,
 public.galaxy_chat_live_locations,
 public.galaxy_chat_entity_refs,
 public.galaxy_chat_polls,
 public.galaxy_chat_poll_options,
 public.galaxy_chat_poll_votes,
 public.galaxy_chat_checklists,
 public.galaxy_chat_checklist_items
restart identity cascade;
SQL

delete_media=$(jq -nc --arg path "$PHOTO_PATH" '{action:"media-delete",kind:"photo",path:$path}')
curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data "$delete_media" >/dev/null
ORIGINAL_MEDIA=$(psql "$DB_URL" -Atqc "select count(*) from storage.objects where bucket_id='galaxy-photos' and name='$PHOTO_PATH'")
[ "$ORIGINAL_MEDIA" = "0" ] || { echo "staging media destroy failed"; exit 1; }

# Inject one incompatible destination row. Restore must fail after it has already
# attempted earlier sections, and PostgreSQL must roll all DB writes back.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.galaxy_items(id,kind,data,author,created) values(
 'c1000000-0000-4000-8000-000000000001',
 'memory',
 '{"title":"CONFLICT","body":"wrong state"}'::jsonb,
 '0',
 '2026-10-04T18:00:00Z'
);
SQL

restore_body=$(jq -nc --slurpfile b /tmp/phase1-backup.json '{action:"backup-restore",backup:$b[0]}')
failed_status=$(curl -sS -o /tmp/phase1-restore-failed.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data "$restore_body")
[ "$failed_status" = "409" ] || { echo "conflicting restore should fail: $failed_status"; cat /tmp/phase1-restore-failed.json; exit 1; }
jq -e '.code=="BACKUP_RESTORE_FAILED" and .mediaRollbackComplete==true' /tmp/phase1-restore-failed.json >/dev/null

REWARD_AFTER_FAIL=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_rewards")
ITEMS_AFTER_FAIL=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_items")
MEDIA_AFTER_FAIL=$(psql "$DB_URL" -Atqc "select count(*) from storage.objects where bucket_id='galaxy-photos' and name='$PHOTO_PATH'")
[ "$REWARD_AFTER_FAIL" = "0" ] || { echo "DB restore was partial: reward row survived failed transaction"; exit 1; }
[ "$ITEMS_AFTER_FAIL" = "1" ] || { echo "DB restore was partial: unexpected item rows survived failed transaction"; exit 1; }
[ "$MEDIA_AFTER_FAIL" = "0" ] || { echo "media rollback was partial"; exit 1; }

psql "$DB_URL" -v ON_ERROR_STOP=1 -c "delete from public.galaxy_items where id='c1000000-0000-4000-8000-000000000001'::uuid"

success_status=$(curl -sS -o /tmp/phase1-restore-ok.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data "$restore_body")
[ "$success_status" = "200" ] || { echo "restore failed: $success_status"; cat /tmp/phase1-restore-ok.json; dump_edge_log; exit 1; }
jq -e '.ok==true and .verified==true and .media.verified>=1' /tmp/phase1-restore-ok.json >/dev/null

POST_HASH=$(psql "$DB_URL" -Atqc "select md5(public.galaxy_backup_export_v5()::text)")
[ "$POST_HASH" = "$PRE_HASH" ] || { echo "deep DB compare failed: $PRE_HASH != $POST_HASH"; exit 1; }

CAPSULE_UNLOCK=$(psql "$DB_URL" -Atqc "select coalesce((data->'unlockedFor') @> '[\"0\"]'::jsonb,false) from public.galaxy_items where id='c1000000-0000-4000-8000-000000000003'::uuid")
[ "$CAPSULE_UNLOCK" = "t" ] || { echo "server-owned capsule unlock state was not restored"; exit 1; }
GOAL_STATE=$(psql "$DB_URL" -Atqc "select version||'|'||to_char(updated_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS') from public.galaxy_goals where id='c3000000-0000-4000-8000-000000000001'::uuid")
[ "$GOAL_STATE" = "7|2026-09-20T15:30:00" ] || { echo "goal trigger-owned fields drifted: $GOAL_STATE"; exit 1; }

media_state=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data '{"action":"media-list","kind":"photo"}')
RESTORED_URL=$(jq -r --arg path "$PHOTO_PATH" '.items[] | select(.path==$path) | .url' <<<"$media_state" | head -1)
[ -n "$RESTORED_URL" ] || { echo "restored media path missing"; echo "$media_state"; exit 1; }
RESTORED_URL=$(printf '%s' "$RESTORED_URL" | sed 's#http://kong:8000#http://127.0.0.1:54321#g; s#http://supabase_kong_nuestragalaxia:8000#http://127.0.0.1:54321#g')
media_http=$(curl -sS -o /tmp/restored-photo.bin -w '%{http_code}' "$RESTORED_URL" || true)
[ "$media_http" = "200" ] || { echo "restored binary is not downloadable: $media_http"; exit 1; }
[ "$(wc -c </tmp/restored-photo.bin)" = "4" ] || { echo "restored binary size differs"; exit 1; }

# Invalid multimedia reference must make export fail loudly, never truncate or
# silently produce a descriptor that cannot be restored.
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'SQL'
insert into public.galaxy_items(id,kind,data,author,created) values(
 'c2000000-0000-4000-8000-000000000001','memory',
 '{"title":"Broken media","body":"must fail backup","photoPath":"0/does-not-exist.jpg"}'::jsonb,
 '0',now()
);
SQL
invalid_status=$(curl -sS -o /tmp/invalid-media-backup.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data '{"action":"backup-export"}')
[ "$invalid_status" = "409" ] || { echo "invalid media reference was accepted: $invalid_status"; cat /tmp/invalid-media-backup.json; exit 1; }
jq -e '.code=="BACKUP_EXPORT_FAILED"' /tmp/invalid-media-backup.json >/dev/null
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "delete from public.galaxy_items where id='c2000000-0000-4000-8000-000000000001'::uuid"

legacy_status=$(curl -sS -o /tmp/legacy-backup.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data '{"action":"backup-restore","backup":{"format":"nuestra-galaxia-backup","version":4}}')
[ "$legacy_status" = "409" ] || { echo "legacy unsafe backup should be rejected: $legacy_status"; exit 1; }
jq -e '.code=="BACKUP_LEGACY_UNSAFE"' /tmp/legacy-backup.json >/dev/null

malformed_status=$(curl -sS -o /tmp/malformed-backup.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data '{"action":"backup-restore","backup":{"hello":"world"}}')
[ "$malformed_status" = "400" ] || { echo "malformed backup should be rejected: $malformed_status"; exit 1; }

jq '.manifest.payload.sha256=("0"*64)' /tmp/phase1-backup.json >/tmp/corrupt-descriptor.json
corrupt_body=$(jq -nc --slurpfile b /tmp/corrupt-descriptor.json '{action:"backup-restore",backup:$b[0]}')
corrupt_status=$(curl -sS -o /tmp/corrupt-backup.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' --data "$corrupt_body")
[ "$corrupt_status" = "409" ] || { echo "corrupt backup should be rejected: $corrupt_status"; cat /tmp/corrupt-backup.json; exit 1; }
jq -e '.code=="BACKUP_RESTORE_FAILED"' /tmp/corrupt-backup.json >/dev/null

echo "Phase 1 backup/restore E2E passed: items=$PRE_ITEMS descriptorBytes=$DESCRIPTOR_BYTES hash=$POST_HASH"
