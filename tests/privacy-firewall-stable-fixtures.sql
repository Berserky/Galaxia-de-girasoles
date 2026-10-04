-- Test-only reconstruction of production objects that are present in the
-- Galaxy Chat Universe 3.5.0 database but are not yet represented by main/schema.sql
-- or the checked-in migration chain. This file is never deployed to production.

create table if not exists public.galaxy_presence(
  person text primary key check(person in ('0','1')),
  battery smallint check(battery between 0 and 100),
  song_title text,
  share_battery boolean not null default false,
  share_song boolean not null default false,
  updated_at timestamptz not null default now()
);

revoke all on public.galaxy_presence from public,anon,authenticated;
grant all on public.galaxy_presence to service_role;
