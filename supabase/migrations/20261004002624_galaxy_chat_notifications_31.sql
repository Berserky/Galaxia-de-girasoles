begin;

alter table public.galaxy_push_subscriptions
  drop constraint if exists galaxy_push_subscriptions_event_type_check;
alter table public.galaxy_push_subscriptions
  add constraint galaxy_push_subscriptions_event_type_check
  check(event_type in (
    'gesture','arrived_safe','nearby','capsule','note','reminder',
    'chat_message','status_changed','mood_changed','daily_answer',
    'goal_update','memory_shared','plan_update'
  ));

alter table public.galaxy_push_events
  drop constraint if exists galaxy_push_events_event_type_check;
alter table public.galaxy_push_events
  add constraint galaxy_push_events_event_type_check
  check(event_type in (
    'gesture','arrived_safe','nearby','capsule','note','reminder',
    'chat_message','status_changed','mood_changed','daily_answer',
    'goal_update','memory_shared','plan_update'
  ));

create table if not exists public.galaxy_chat_messages (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  sender_person text not null check(sender_person in ('0','1')),
  body text not null check(length(trim(body)) between 1 and 4000),
  reply_to uuid references public.galaxy_chat_messages(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique(sender_person,client_id)
);
create index if not exists galaxy_chat_messages_created_idx
  on public.galaxy_chat_messages(created_at desc,id desc);
create index if not exists galaxy_chat_messages_sender_created_idx
  on public.galaxy_chat_messages(sender_person,created_at desc);

create table if not exists public.galaxy_chat_read_state (
  person text primary key check(person in ('0','1')),
  last_read_at timestamptz,
  last_read_message_id uuid references public.galaxy_chat_messages(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.galaxy_chat_read_state(person) values('0'),('1')
on conflict(person) do nothing;

create table if not exists public.galaxy_notifications (
  id uuid primary key default gen_random_uuid(),
  target_person text not null check(target_person in ('0','1')),
  source_person text check(source_person is null or source_person in ('0','1')),
  event_type text not null check(length(event_type) between 2 and 64),
  title text not null check(length(title) between 1 and 120),
  body text not null default '' check(length(body)<=500),
  action text check(action is null or length(action)<=80),
  entity_type text check(entity_type is null or length(entity_type)<=80),
  entity_id text check(entity_id is null or length(entity_id)<=160),
  data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object' and octet_length(data::text)<=8192),
  push_event_id uuid unique references public.galaxy_push_events(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists galaxy_notifications_target_created_idx
  on public.galaxy_notifications(target_person,created_at desc);
create index if not exists galaxy_notifications_target_unread_idx
  on public.galaxy_notifications(target_person,created_at desc)
  where read_at is null;

alter table public.galaxy_chat_messages enable row level security;
alter table public.galaxy_chat_read_state enable row level security;
alter table public.galaxy_notifications enable row level security;

revoke all on public.galaxy_chat_messages,public.galaxy_chat_read_state,public.galaxy_notifications from public,anon,authenticated;
grant select,insert,update,delete on public.galaxy_chat_messages,public.galaxy_chat_read_state,public.galaxy_notifications to service_role;

commit;