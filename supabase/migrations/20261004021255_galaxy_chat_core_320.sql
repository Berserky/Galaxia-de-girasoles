-- Galaxy Chat Core 3.2.0
-- Premium delivery semantics, idempotent outbox reconciliation, rich message metadata,
-- private chat utilities, ephemeral presence and content-free observability.
begin;

create sequence if not exists public.galaxy_chat_server_seq;

alter table public.galaxy_chat_messages
 add column if not exists server_seq bigint,
 add column if not exists client_created_at timestamptz,
 add column if not exists server_received_at timestamptz,
 add column if not exists sent_at timestamptz,
 add column if not exists delivered_at timestamptz,
 add column if not exists read_at timestamptz,
 add column if not exists edited_at timestamptz,
 add column if not exists message_type text not null default 'text',
 add column if not exists attachment jsonb not null default '{}'::jsonb,
 add column if not exists link_preview jsonb not null default '{}'::jsonb;

update public.galaxy_chat_messages
set server_seq=nextval('public.galaxy_chat_server_seq')
where server_seq is null;

select setval(
 'public.galaxy_chat_server_seq',
 greatest(coalesce((select max(server_seq) from public.galaxy_chat_messages),0),1),
 true
);

alter table public.galaxy_chat_messages
 alter column server_seq set default nextval('public.galaxy_chat_server_seq'),
 alter column server_seq set not null,
 alter column body set default '',
 alter column client_created_at set default now(),
 alter column server_received_at set default now(),
 alter column sent_at set default now();

update public.galaxy_chat_messages
set client_created_at=coalesce(client_created_at,created_at),
    server_received_at=coalesce(server_received_at,created_at),
    sent_at=coalesce(sent_at,created_at);

alter table public.galaxy_chat_messages drop constraint if exists galaxy_chat_messages_body_check;
alter table public.galaxy_chat_messages drop constraint if exists galaxy_chat_messages_message_type_check;
alter table public.galaxy_chat_messages
 add constraint galaxy_chat_messages_body_check
 check (
   deleted_at is not null
   or (message_type='text' and length(trim(body)) between 1 and 4000)
   or (message_type<>'text' and length(body)<=4000)
 ),
 add constraint galaxy_chat_messages_message_type_check
 check(message_type in ('text','photo','video','audio','file','location','song','link'));

create unique index if not exists galaxy_chat_messages_server_seq_idx
 on public.galaxy_chat_messages(server_seq);
create index if not exists galaxy_chat_messages_sender_seq_idx
 on public.galaxy_chat_messages(sender_person,server_seq desc);
create index if not exists galaxy_chat_messages_type_seq_idx
 on public.galaxy_chat_messages(message_type,server_seq desc);
create index if not exists galaxy_chat_messages_search_idx
 on public.galaxy_chat_messages using gin(to_tsvector('simple',coalesce(body,'')));

create table if not exists public.galaxy_chat_reactions (
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 person text not null check(person in ('0','1')),
 emoji text not null check(emoji in ('❤️','😂','🥹','😮','😢','👍')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(message_id,person)
);
create index if not exists galaxy_chat_reactions_message_idx
 on public.galaxy_chat_reactions(message_id);

create table if not exists public.galaxy_chat_hidden (
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 person text not null check(person in ('0','1')),
 hidden_at timestamptz not null default now(),
 primary key(message_id,person)
);

create table if not exists public.galaxy_chat_pins (
 message_id uuid primary key references public.galaxy_chat_messages(id) on delete cascade,
 pinned_by text not null check(pinned_by in ('0','1')),
 pinned_at timestamptz not null default now()
);
create index if not exists galaxy_chat_pins_time_idx on public.galaxy_chat_pins(pinned_at desc);

create table if not exists public.galaxy_chat_favorites (
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 person text not null check(person in ('0','1')),
 saved_at timestamptz not null default now(),
 primary key(message_id,person)
);
create index if not exists galaxy_chat_favorites_person_time_idx
 on public.galaxy_chat_favorites(person,saved_at desc);

create table if not exists public.galaxy_chat_edits (
 id bigint generated always as identity primary key,
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 editor_person text not null check(editor_person in ('0','1')),
 previous_body text not null check(length(previous_body)<=4000),
 edited_at timestamptz not null default now()
);
create index if not exists galaxy_chat_edits_message_time_idx
 on public.galaxy_chat_edits(message_id,edited_at desc);

create table if not exists public.galaxy_chat_attachments (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 kind text not null check(kind in ('photo','video','audio','file')),
 bucket text not null default 'galaxy-chat-media',
 path text not null,
 mime text not null,
 name text not null default '',
 size_bytes bigint not null default 0 check(size_bytes>=0),
 duration_ms bigint check(duration_ms is null or duration_ms>=0),
 width integer check(width is null or width>0),
 height integer check(height is null or height>0),
 thumbnail_path text,
 caption text not null default '' check(length(caption)<=1000),
 created_at timestamptz not null default now(),
 unique(message_id,path)
);
create index if not exists galaxy_chat_attachments_message_idx
 on public.galaxy_chat_attachments(message_id);

create table if not exists public.galaxy_chat_presence (
 person text primary key check(person in ('0','1')),
 state text not null default 'ONLINE'
  check(state in ('ONLINE','TYPING','RECORDING_AUDIO','UPLOADING_MEDIA')),
 last_active_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '45 seconds'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=2048),
 updated_at timestamptz not null default now()
);
create index if not exists galaxy_chat_presence_expiry_idx on public.galaxy_chat_presence(expires_at);

create table if not exists public.galaxy_chat_metrics (
 id bigint generated always as identity primary key,
 message_id uuid references public.galaxy_chat_messages(id) on delete set null,
 event text not null check(length(event) between 2 and 40),
 send_latency_ms integer check(send_latency_ms is null or send_latency_ms>=0),
 server_latency_ms integer check(server_latency_ms is null or server_latency_ms>=0),
 delivery_latency_ms integer check(delivery_latency_ms is null or delivery_latency_ms>=0),
 retry_count integer not null default 0 check(retry_count between 0 and 100),
 failure_code text check(failure_code is null or length(failure_code)<=80),
 created_at timestamptz not null default now()
);
create index if not exists galaxy_chat_metrics_created_idx on public.galaxy_chat_metrics(created_at desc);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
 'galaxy-chat-media','galaxy-chat-media',false,62914560,
 array[
  'image/jpeg','image/png','image/webp',
  'video/mp4','video/webm',
  'audio/mpeg','audio/ogg','audio/webm','audio/mp4',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain','application/zip'
 ]::text[]
)
on conflict(id) do update set
 public=false,
 file_size_limit=excluded.file_size_limit,
 allowed_mime_types=excluded.allowed_mime_types;

alter table public.galaxy_chat_reactions enable row level security;
alter table public.galaxy_chat_hidden enable row level security;
alter table public.galaxy_chat_pins enable row level security;
alter table public.galaxy_chat_favorites enable row level security;
alter table public.galaxy_chat_edits enable row level security;
alter table public.galaxy_chat_attachments enable row level security;
alter table public.galaxy_chat_presence enable row level security;
alter table public.galaxy_chat_metrics enable row level security;

revoke all on
 public.galaxy_chat_reactions,
 public.galaxy_chat_hidden,
 public.galaxy_chat_pins,
 public.galaxy_chat_favorites,
 public.galaxy_chat_edits,
 public.galaxy_chat_attachments,
 public.galaxy_chat_presence,
 public.galaxy_chat_metrics
from public,anon,authenticated;

grant select,insert,update,delete on
 public.galaxy_chat_reactions,
 public.galaxy_chat_hidden,
 public.galaxy_chat_pins,
 public.galaxy_chat_favorites,
 public.galaxy_chat_edits,
 public.galaxy_chat_attachments,
 public.galaxy_chat_presence,
 public.galaxy_chat_metrics
to service_role;

grant usage,select on sequence public.galaxy_chat_server_seq to service_role;

commit;
