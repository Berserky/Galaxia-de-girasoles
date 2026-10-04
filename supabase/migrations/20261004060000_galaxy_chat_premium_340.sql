-- Galaxy Chat Premium 3.4.0
-- Extends the existing chat architecture with server-side scheduling/expiry,
-- view-once media, chat-scoped preferences, transcripts, translations,
-- albums and reusable stickers. No client role receives direct table access.
begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.galaxy_chat_messages
 add column if not exists silent boolean not null default false,
 add column if not exists scheduled_at timestamptz,
 add column if not exists schedule_state text not null default 'sent',
 add column if not exists expires_at timestamptz,
 add column if not exists view_once boolean not null default false,
 add column if not exists opened_at timestamptz,
 add column if not exists effect text,
 add column if not exists format_version smallint not null default 1;

alter table public.galaxy_chat_messages
 drop constraint if exists galaxy_chat_messages_schedule_state_check,
 drop constraint if exists galaxy_chat_messages_effect_check,
 drop constraint if exists galaxy_chat_messages_expiry_check;

alter table public.galaxy_chat_messages
 add constraint galaxy_chat_messages_schedule_state_check
 check(schedule_state in ('pending','processing','sent','cancelled')),
 add constraint galaxy_chat_messages_effect_check
 check(effect is null or effect in ('hearts','confetti','stars','kiss','sunflowers','galaxy')),
 add constraint galaxy_chat_messages_expiry_check
 check(expires_at is null or expires_at>created_at);

create index if not exists galaxy_chat_messages_due_idx
 on public.galaxy_chat_messages(scheduled_at)
 where schedule_state='pending' and deleted_at is null;

create index if not exists galaxy_chat_messages_expiry_idx
 on public.galaxy_chat_messages(expires_at)
 where expires_at is not null and deleted_at is null;

alter table public.galaxy_chat_attachments
 add column if not exists media_quality text not null default 'optimized',
 add column if not exists waveform jsonb not null default '[]'::jsonb;

alter table public.galaxy_chat_attachments
 drop constraint if exists galaxy_chat_attachments_media_quality_check,
 drop constraint if exists galaxy_chat_attachments_waveform_check;

alter table public.galaxy_chat_attachments
 add constraint galaxy_chat_attachments_media_quality_check
 check(media_quality in ('optimized','hd','original')),
 add constraint galaxy_chat_attachments_waveform_check
 check(jsonb_typeof(waveform)='array' and octet_length(waveform::text)<=16000);

create table if not exists public.galaxy_chat_preferences (
 person text primary key check(person in ('0','1')),
 partner_nickname text check(partner_nickname is null or char_length(partner_nickname)<=40),
 theme text not null default 'galaxy'
  check(theme in ('galaxy','sunflowers','night','cyberpunk','romantic','minimal')),
 notification_privacy text not null default 'full'
  check(notification_privacy in ('full','name','generic')),
 show_read boolean not null default true,
 show_last_seen boolean not null default true,
 show_typing boolean not null default true,
 default_ttl_seconds integer
  check(default_ttl_seconds is null or default_ttl_seconds between 3600 and 31536000),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_chat_transcripts (
 attachment_id uuid primary key references public.galaxy_chat_attachments(id) on delete cascade,
 requested_by text not null check(requested_by in ('0','1')),
 transcript text not null check(char_length(transcript)<=30000),
 segments jsonb not null default '[]'::jsonb
  check(jsonb_typeof(segments)='array' and octet_length(segments::text)<=100000),
 provider text not null check(char_length(provider)<=40),
 model text not null check(char_length(model)<=120),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_chat_translations (
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 person text not null check(person in ('0','1')),
 target_language text not null check(char_length(target_language) between 2 and 24),
 translated_text text not null check(char_length(translated_text)<=8000),
 provider text not null check(char_length(provider)<=40),
 model text not null check(char_length(model)<=120),
 created_at timestamptz not null default now(),
 primary key(message_id,person,target_language)
);

create table if not exists public.galaxy_chat_albums (
 id uuid primary key default gen_random_uuid(),
 name text not null check(char_length(name) between 1 and 80),
 cover_attachment_id uuid references public.galaxy_chat_attachments(id) on delete set null,
 album_date date,
 created_by text not null check(created_by in ('0','1')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_chat_album_items (
 album_id uuid not null references public.galaxy_chat_albums(id) on delete cascade,
 attachment_id uuid not null references public.galaxy_chat_attachments(id) on delete cascade,
 added_by text not null check(added_by in ('0','1')),
 added_at timestamptz not null default now(),
 primary key(album_id,attachment_id)
);

create table if not exists public.galaxy_chat_stickers (
 id uuid primary key default gen_random_uuid(),
 created_by text not null check(created_by in ('0','1')),
 bucket text not null default 'galaxy-chat-media',
 path text not null,
 name text not null default 'Sticker' check(char_length(name)<=80),
 created_at timestamptz not null default now(),
 unique(bucket,path)
);

create table if not exists public.galaxy_chat_sticker_favorites (
 sticker_id uuid not null references public.galaxy_chat_stickers(id) on delete cascade,
 person text not null check(person in ('0','1')),
 last_used_at timestamptz,
 saved_at timestamptz not null default now(),
 primary key(sticker_id,person)
);

-- Private runtime state used only by the server-side minute scheduler.
create table if not exists public.galaxy_chat_runtime (
 id integer primary key check(id=1),
 cron_token text not null check(char_length(cron_token)=64),
 updated_at timestamptz not null default now()
);

insert into public.galaxy_chat_runtime(id,cron_token)
values(1,encode(gen_random_bytes(32),'hex'))
on conflict(id) do nothing;

alter table public.galaxy_chat_preferences enable row level security;
alter table public.galaxy_chat_transcripts enable row level security;
alter table public.galaxy_chat_translations enable row level security;
alter table public.galaxy_chat_albums enable row level security;
alter table public.galaxy_chat_album_items enable row level security;
alter table public.galaxy_chat_stickers enable row level security;
alter table public.galaxy_chat_sticker_favorites enable row level security;
alter table public.galaxy_chat_runtime enable row level security;

revoke all on
 public.galaxy_chat_preferences,
 public.galaxy_chat_transcripts,
 public.galaxy_chat_translations,
 public.galaxy_chat_albums,
 public.galaxy_chat_album_items,
 public.galaxy_chat_stickers,
 public.galaxy_chat_sticker_favorites,
 public.galaxy_chat_runtime
from public,anon,authenticated;

grant select,insert,update,delete on
 public.galaxy_chat_preferences,
 public.galaxy_chat_transcripts,
 public.galaxy_chat_translations,
 public.galaxy_chat_albums,
 public.galaxy_chat_album_items,
 public.galaxy_chat_stickers,
 public.galaxy_chat_sticker_favorites
to service_role;

grant select,update on public.galaxy_chat_runtime to service_role;

create or replace function public.galaxy_chat_cron_dispatch()
returns bigint
language plpgsql
security definer
set search_path=''
as $$
declare
 request_id bigint;
 secret text;
begin
 select cron_token into secret
 from public.galaxy_chat_runtime
 where id=1;

 if secret is null then
  raise exception 'Galaxy Chat cron token missing';
 end if;

 select net.http_post(
  url := 'https://zqiknzivfahvvadmxrvt.supabase.co/functions/v1/android-companion',
  headers := jsonb_build_object(
   'content-type','application/json',
   'x-galaxy-cron-token',secret
  ),
  body := '{"action":"chat-process-due"}'::jsonb,
  timeout_milliseconds := 15000
 ) into request_id;

 return request_id;
end;
$$;

revoke all on function public.galaxy_chat_cron_dispatch() from public,anon,authenticated;
grant execute on function public.galaxy_chat_cron_dispatch() to service_role;

select cron.schedule(
 'galaxy-chat-premium-tick',
 '* * * * *',
 'select public.galaxy_chat_cron_dispatch();'
);

commit;
