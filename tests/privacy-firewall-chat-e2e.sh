#!/usr/bin/env bash
set -euo pipefail

DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
FUNCTION_URL='http://127.0.0.1:54321/functions/v1/android-companion'
DEVICE_TOKEN='qa-device-token-000000000000000000000000000000000000000000000000000001'
PARTNER_TOKEN='qa-device-token-000000000000000000000000000000000000000000000000000002'

TOKEN_HASH=$(printf '%s' "$DEVICE_TOKEN" | sha256sum | awk '{print $1}')
PARTNER_HASH=$(printf '%s' "$PARTNER_TOKEN" | sha256sum | awk '{print $1}')
psql "$DB_URL" -v ON_ERROR_STOP=1 -v token_hash="$TOKEN_HASH" -v partner_hash="$PARTNER_HASH" <<'SQL'
insert into public.galaxy_devices(person,name,token_hash,last_seen_at)
values
 ('0','Privacy QA Device 0',:'token_hash',now()),
 ('1','Privacy QA Device 1',:'partner_hash',now())
on conflict(token_hash) do update set revoked_at=null,last_seen_at=excluded.last_seen_at;

insert into public.galaxy_items(id,kind,data,author) values
(
 'b5000000-0000-4000-8000-000000000001',
 'capsule',
 '{"title":"Edge locked capsule","body":"EDGE-CAPSULE-SECRET","unlockType":"date","unlockDate":"2099-12-01","unlockTime":"21:30","photoPath":"0/edge-capsule.jpg"}'::jsonb,
 '0'
),
(
 'b5000000-0000-4000-8000-000000000002',
 'capsule',
 jsonb_build_object(
   'title','Today locked capsule',
   'body','TODAY-LOCKED-SECRET',
   'date',(now() at time zone 'America/Bogota')::date::text,
   'unlockType','date',
   'unlockAt','2099-12-01T02:30:00.000Z'
 ),
 '0'
),
(
 'b5000000-0000-4000-8000-000000000003',
 'capsule',
 '{"title":"Edge place capsule","body":"EDGE-PLACE-SECRET","unlockType":"place","placeId":1,"placeName":"QA point","latitude":4.7001,"longitude":-74.1001,"radius":150}'::jsonb,
 '1'
)
on conflict(id) do nothing;
SQL

printf '\xff\xd8\xff\xd9' > /tmp/qa-chat-photo.jpg

supabase functions serve android-companion --no-verify-jwt >/tmp/android-companion-e2e.log 2>&1 &
EDGE_PID=$!
cleanup(){ kill "$EDGE_PID" >/dev/null 2>&1 || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  status=$(curl -sS -o /tmp/edge-health.json -w '%{http_code}' \
    -X POST "$FUNCTION_URL" \
    -H 'content-type: application/json' \
    --data '{"action":"pair"}' || true)
  if [ "$status" != "000" ]; then break; fi
  sleep 1
done

owner_backup=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data '{"action":"backup-export"}')
partner_backup=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $PARTNER_TOKEN" -H 'content-type: application/json' --data '{"action":"backup-export"}')
for backup in "$owner_backup" "$partner_backup"; do
  if grep -q 'EDGE-CAPSULE-SECRET' <<<"$backup"; then
    echo "NG-QA-001: backup leaked locked capsule body"
    exit 1
  fi
  if grep -q '0/edge-capsule.jpg' <<<"$backup"; then
    echo "NG-QA-001: backup leaked locked capsule media path"
    exit 1
  fi
  if grep -q 'EDGE-PLACE-SECRET' <<<"$backup"; then
    echo "NG-QA-001: backup leaked locked place capsule before arrival"
    exit 1
  fi
done

partner_location_on='{"action":"location","sharing":true,"latitude":4.8101,"longitude":-74.1201,"accuracy":5,"motion":"still"}'
curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $PARTNER_TOKEN" -H 'content-type: application/json' --data "$partner_location_on" >/dev/null

map_shared=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data '{"action":"map-state"}')
jq -e '.locations[] | select(.person=="1" and .sharing==true and (.latitude != null) and (.longitude != null))' >/dev/null <<<"$map_shared" || {
  echo "NG-QA-003: actively shared partner coordinates missing"; exit 1;
}

live_start=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $PARTNER_TOKEN" -H 'content-type: application/json' --data '{"action":"chat-live-location","operation":"start","durationSeconds":900}')
live_id=$(jq -r '.session.id // empty' <<<"$live_start")
[ -n "$live_id" ] || { echo "NG-QA-003: live location session did not start"; echo "$live_start"; exit 1; }
live_state_payload=$(jq -nc --arg id "$live_id" '{action:"chat-live-location",operation:"state",id:$id}')
live_shared=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data "$live_state_payload")
jq -e '.location.latitude != null and .location.longitude != null' >/dev/null <<<"$live_shared" || {
  echo "NG-QA-003: shared live coordinates missing"; exit 1;
}

curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $PARTNER_TOKEN" -H 'content-type: application/json' --data '{"action":"location","sharing":false}' >/dev/null

map_paused=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data '{"action":"map-state"}')
jq -e '.locations[] | select(.person=="1" and .sharing==false and .latitude==null and .longitude==null)' >/dev/null <<<"$map_paused" || {
  echo "NG-QA-003: paused partner coordinates leaked through map-state"; echo "$map_paused"; exit 1;
}
live_paused=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data "$live_state_payload")
jq -e '.location == null' >/dev/null <<<"$live_paused" || {
  echo "NG-QA-003: paused partner coordinates leaked through live location"; echo "$live_paused"; exit 1;
}

location_on='{"action":"location","sharing":true,"latitude":4.7001,"longitude":-74.1001,"accuracy":5,"motion":"still"}'
curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data "$location_on" >/dev/null
owner_after_arrival=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data '{"action":"mobile-state"}')
grep -q 'EDGE-PLACE-SECRET' <<<"$owner_after_arrival" || { echo "NG-QA-001: place capsule did not unlock on server after arrival"; exit 1; }

curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data '{"action":"location","sharing":false}' >/dev/null
owner_after_pause=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data '{"action":"mobile-state"}')
grep -q 'EDGE-PLACE-SECRET' <<<"$owner_after_pause" || { echo "NG-QA-001: place capsule relocked after valid arrival"; exit 1; }

partner_after_owner_arrival=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $PARTNER_TOKEN" -H 'content-type: application/json' --data '{"action":"mobile-state"}')
if grep -q 'EDGE-PLACE-SECRET' <<<"$partner_after_owner_arrival"; then
  echo "NG-QA-001: place unlock leaked across profiles"
  exit 1
fi

today=$(TZ=America/Bogota date +%F)
history_payload=$(jq -nc --arg day "$today" '{action:"today-history",day:$day}')
history_resp=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data "$history_payload")
if grep -q 'TODAY-LOCKED-SECRET' <<<"$history_resp"; then
  echo "NG-QA-001: Today History leaked locked capsule body to its author"
  exit 1
fi

partner_update=$(jq -nc '{
  action:"item-save",
  id:"b5000000-0000-4000-8000-000000000001",
  version:1,
  kind:"capsule",
  data:{title:"Edge locked capsule",body:"HACKED",unlockType:"date",unlockDate:"2020-01-01",unlockTime:"00:00"}
}')
partner_update_status=$(curl -sS -o /tmp/partner-update.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $PARTNER_TOKEN" -H 'content-type: application/json' --data "$partner_update")
[ "$partner_update_status" = "403" ] || { echo "NG-QA-001: partner mutated locked capsule through Edge ($partner_update_status)"; cat /tmp/partner-update.json; exit 1; }

partner_delete='{"action":"item-delete","id":"b5000000-0000-4000-8000-000000000001","version":1}'
partner_delete_status=$(curl -sS -o /tmp/partner-delete.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $PARTNER_TOKEN" -H 'content-type: application/json' --data "$partner_delete")
[ "$partner_delete_status" = "403" ] || { echo "NG-QA-001: partner deleted locked capsule through Edge ($partner_delete_status)"; cat /tmp/partner-delete.json; exit 1; }

upload_json=$(curl -fsS \
  -X POST "$FUNCTION_URL" \
  -H "x-device-token: $DEVICE_TOKEN" \
  -H 'x-mobile-action: upload' \
  -H 'x-media-kind: chat-photo' \
  -H 'x-file-name: qa-chat-photo.jpg' \
  -H 'content-type: image/jpeg' \
  --data-binary @/tmp/qa-chat-photo.jpg)

path=$(jq -r '.path // empty' <<<"$upload_json")
signed_url=$(jq -r '.url // empty' <<<"$upload_json")
[ -n "$path" ] || { echo "upload path missing: $upload_json"; exit 1; }
[ -n "$signed_url" ] || { echo "upload signed URL missing: $upload_json"; exit 1; }

signed_url=$(printf '%s' "$signed_url" | sed 's#http://kong:8000#http://127.0.0.1:54321#g; s#http://supabase_kong_nuestragalaxia:8000#http://127.0.0.1:54321#g')

before_status=$(curl -sS -o /tmp/media-before.bin -w '%{http_code}' "$signed_url" || true)
[ "$before_status" = "200" ] || { echo "signed URL invalid before deletion: $before_status $signed_url"; exit 1; }

client_id='b4000000-0000-4000-8000-000000000001'
send_json=$(jq -nc --arg cid "$client_id" --arg p "$path" '{
  action:"chat-send",
  clientId:$cid,
  messageType:"photo",
  body:"",
  attachments:[{kind:"photo",bucket:"galaxy-chat-media",path:$p,mime:"image/jpeg",name:"qa-chat-photo.jpg",size:4}]
}')
send_resp=$(curl -fsS \
  -X POST "$FUNCTION_URL" \
  -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' \
  --data "$send_json")
message_id=$(jq -r '.message.id // empty' <<<"$send_resp")
[ -n "$message_id" ] || { echo "chat message id missing: $send_resp"; exit 1; }

reuse_json=$(jq -nc --arg cid 'b4000000-0000-4000-8000-000000000002' --arg p "$path" '{
  action:"chat-send",
  clientId:$cid,
  messageType:"photo",
  body:"",
  attachments:[{kind:"photo",bucket:"galaxy-chat-media",path:$p,mime:"image/jpeg",name:"qa-chat-photo.jpg",size:4}]
}')
reuse_status=$(curl -sS -o /tmp/reuse.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" \
  -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' \
  --data "$reuse_json")
[ "$reuse_status" = "409" ] || { echo "NG-QA-014: reused Storage path was accepted ($reuse_status)"; cat /tmp/reuse.json; exit 1; }

pin_json=$(jq -nc --arg id "$message_id" '{action:"chat-pin",id:$id,pinned:true}')
fav_json=$(jq -nc --arg id "$message_id" '{action:"chat-favorite",id:$id,saved:true}')
curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data "$pin_json" >/dev/null
curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data "$fav_json" >/dev/null

delete_json=$(jq -nc --arg id "$message_id" '{action:"chat-delete",id:$id,scope:"both"}')
curl -fsS -X POST "$FUNCTION_URL" \
  -H "x-device-token: $DEVICE_TOKEN" \
  -H 'content-type: application/json' \
  --data "$delete_json" >/tmp/chat-delete.json

after_status=$(curl -sS -o /tmp/media-after.bin -w '%{http_code}' "$signed_url" || true)
if [ "$after_status" = "200" ]; then
  echo "NG-QA-014: old signed URL still serves deleted media"
  exit 1
fi

around_json=$(jq -nc --arg id "$message_id" '{action:"chat-state",aroundId:$id}')
around_status=$(curl -sS -o /tmp/around.json -w '%{http_code}' \
  -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data "$around_json")
[ "$around_status" = "404" ] || { echo "NG-QA-014: deep-link still resolves deleted message ($around_status)"; cat /tmp/around.json; exit 1; }

for payload in \
  '{"action":"chat-search","query":"qa-chat-photo"}' \
  '{"action":"chat-saved"}' \
  '{"action":"chat-pins"}' \
  '{"action":"chat-shared","category":"media","query":"qa-chat-photo"}'
do
  resp=$(curl -fsS -X POST "$FUNCTION_URL" \
    -H "x-device-token: $DEVICE_TOKEN" \
    -H 'content-type: application/json' \
    --data "$payload")
  if jq -e --arg id "$message_id" '.. | objects | select(.id? == $id)' >/dev/null <<<"$resp"; then
    echo "NG-QA-014: deleted message survived in endpoint payload: $payload"
    echo "$resp"
    exit 1
  fi
done

post_delete_backup=$(curl -fsS -X POST "$FUNCTION_URL" -H "x-device-token: $DEVICE_TOKEN" -H 'content-type: application/json' --data '{"action":"backup-export"}')
if grep -q "$message_id" <<<"$post_delete_backup" || grep -q "$path" <<<"$post_delete_backup"; then
  echo "NG-QA-014: backup retained deleted message or attachment path"
  exit 1
fi

attachment_count=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_chat_attachments where message_id='$message_id'::uuid")
object_count=$(psql "$DB_URL" -Atqc "select count(*) from storage.objects where bucket_id='galaxy-chat-media' and name='$path'")
pin_count=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_chat_pins where message_id='$message_id'::uuid")
favorite_count=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_chat_favorites where message_id='$message_id'::uuid")

[ "$attachment_count" = "0" ] || { echo "attachment row survived"; exit 1; }
[ "$object_count" = "0" ] || { echo "storage object survived"; exit 1; }
[ "$pin_count" = "0" ] || { echo "pin survived"; exit 1; }
[ "$favorite_count" = "0" ] || { echo "favorite survived"; exit 1; }

echo "NG-QA-014 E2E passed"
