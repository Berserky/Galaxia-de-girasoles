create table if not exists public.galaxy_presence(
  person text primary key check (person in ('0','1')),
  battery smallint check (battery between 0 and 100),
  song_title text,
  share_battery boolean not null default false,
  share_song boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.galaxy_presence enable row level security;
revoke all on table public.galaxy_presence from anon, authenticated;
grant all on table public.galaxy_presence to service_role;

insert into public.galaxy_presence(person) values ('0'),('1')
on conflict (person) do nothing;