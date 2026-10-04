-- Galaxy Chat Universe 3.5.0
-- Native references bridge Chat with existing Nuestra Galaxia domains.
-- New Chat-native state is limited to polls and checklists.

alter table public.galaxy_chat_messages
 drop constraint if exists galaxy_chat_messages_message_type_check;

alter table public.galaxy_chat_messages
 add constraint galaxy_chat_messages_message_type_check
 check(message_type in (
  'text','photo','video','video_message','audio','file','location','song','link','sticker','gif','card'
 ));

create table if not exists public.galaxy_chat_entity_refs (
 message_id uuid primary key references public.galaxy_chat_messages(id) on delete cascade,
 card_type text not null check(card_type in (
  'MEMORY','PLAN','GOAL','PLACE','SONG','ETA','CHECK_IN','POLL','CHECKLIST','CAPSULE','DAILY_QUESTION','EVENT','STATUS'
 )),
 entity_kind text not null check(length(entity_kind) between 1 and 40),
 entity_id text not null check(length(entity_id) between 1 and 120),
 snapshot jsonb not null default '{}'::jsonb,
 created_by text not null check(created_by in ('0','1')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(snapshot)='object')
);

create index if not exists galaxy_chat_entity_refs_entity_idx
 on public.galaxy_chat_entity_refs(card_type,entity_kind,entity_id);

create table if not exists public.galaxy_chat_polls (
 id uuid primary key default gen_random_uuid(),
 message_id uuid unique references public.galaxy_chat_messages(id) on delete set null,
 created_by text not null check(created_by in ('0','1')),
 question text not null check(length(trim(question)) between 1 and 500),
 allow_multiple boolean not null default false,
 closes_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(closes_at is null or closes_at>created_at),
 check(closed_at is null or closed_at>=created_at)
);

create table if not exists public.galaxy_chat_poll_options (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.galaxy_chat_polls(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 240),
 position smallint not null check(position between 0 and 9),
 created_at timestamptz not null default now(),
 unique(poll_id,position),
 unique(poll_id,id)
);

create index if not exists galaxy_chat_poll_options_poll_idx
 on public.galaxy_chat_poll_options(poll_id,position);

create table if not exists public.galaxy_chat_poll_votes (
 poll_id uuid not null,
 option_id uuid not null,
 person text not null check(person in ('0','1')),
 voted_at timestamptz not null default now(),
 primary key(poll_id,option_id,person),
 constraint galaxy_chat_poll_votes_option_fkey
  foreign key(poll_id,option_id)
  references public.galaxy_chat_poll_options(poll_id,id)
  on delete cascade
);

create index if not exists galaxy_chat_poll_votes_person_idx
 on public.galaxy_chat_poll_votes(poll_id,person);

create or replace function public.galaxy_chat_poll_vote_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
 poll_row public.galaxy_chat_polls%rowtype;
begin
 select * into poll_row
 from public.galaxy_chat_polls
 where id=new.poll_id
 for update;

 if not found then
  raise exception 'Encuesta no disponible';
 end if;

 if poll_row.closed_at is not null or (poll_row.closes_at is not null and poll_row.closes_at<=now()) then
  raise exception 'La encuesta está cerrada';
 end if;

 if not poll_row.allow_multiple then
  delete from public.galaxy_chat_poll_votes
  where poll_id=new.poll_id and person=new.person and option_id<>new.option_id;
 end if;

 return new;
end;
$$;

drop trigger if exists galaxy_chat_poll_vote_guard_trigger on public.galaxy_chat_poll_votes;
create trigger galaxy_chat_poll_vote_guard_trigger
 before insert on public.galaxy_chat_poll_votes
 for each row execute function public.galaxy_chat_poll_vote_guard();

create table if not exists public.galaxy_chat_checklists (
 id uuid primary key default gen_random_uuid(),
 message_id uuid unique references public.galaxy_chat_messages(id) on delete set null,
 created_by text not null check(created_by in ('0','1')),
 title text not null check(length(trim(title)) between 1 and 300),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_chat_checklist_items (
 id uuid primary key default gen_random_uuid(),
 checklist_id uuid not null references public.galaxy_chat_checklists(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 300),
 position smallint not null check(position between 0 and 99),
 checked boolean not null default false,
 updated_by text check(updated_by is null or updated_by in ('0','1')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(checklist_id,position)
);

create index if not exists galaxy_chat_checklist_items_list_idx
 on public.galaxy_chat_checklist_items(checklist_id,position);

alter table public.galaxy_chat_entity_refs enable row level security;
alter table public.galaxy_chat_polls enable row level security;
alter table public.galaxy_chat_poll_options enable row level security;
alter table public.galaxy_chat_poll_votes enable row level security;
alter table public.galaxy_chat_checklists enable row level security;
alter table public.galaxy_chat_checklist_items enable row level security;

revoke all on table public.galaxy_chat_entity_refs from anon,authenticated;
revoke all on table public.galaxy_chat_polls from anon,authenticated;
revoke all on table public.galaxy_chat_poll_options from anon,authenticated;
revoke all on table public.galaxy_chat_poll_votes from anon,authenticated;
revoke all on table public.galaxy_chat_checklists from anon,authenticated;
revoke all on table public.galaxy_chat_checklist_items from anon,authenticated;

revoke all on function public.galaxy_chat_poll_vote_guard() from public,anon,authenticated;
