#!/usr/bin/env bash
set -euo pipefail

DB_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
FUNCTION_URL='http://127.0.0.1:54321/functions/v1/android-companion'
DEVICE_TOKEN='qa-device-token-000000000000000000000000000000000000000000000000000001'

TOKEN_HASH=$(printf '%s' "$DEVICE_TOKEN" | sha256sum | awk '{print $1}')
psql "$DB_URL" -v ON_ERROR_STOP=1 -v token_hash="$TOKEN_HASH" <<'SQL'
insert into public.galaxy_devices(person,name,token_hash,last_seen_at)
values('0','Privacy QA Device',:'token_hash',now())
on conflict(token_hash) do update set revoked_at=null,last_seen_at=excluded.last_seen_at;
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

attachment_count=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_chat_attachments where message_id='$message_id'::uuid")
object_count=$(psql "$DB_URL" -Atqc "select count(*) from storage.objects where bucket_id='galaxy-chat-media' and name='$path'")
pin_count=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_chat_pins where message_id='$message_id'::uuid")
favorite_count=$(psql "$DB_URL" -Atqc "select count(*) from public.galaxy_chat_favorites where message_id='$message_id'::uuid")

[ "$attachment_count" = "0" ] || { echo "attachment row survived"; exit 1; }
[ "$object_count" = "0" ] || { echo "storage object survived"; exit 1; }
[ "$pin_count" = "0" ] || { echo "pin survived"; exit 1; }
[ "$favorite_count" = "0" ] || { echo "favorite survived"; exit 1; }

echo "NG-QA-014 E2E passed"
