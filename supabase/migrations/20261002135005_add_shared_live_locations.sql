create table if not exists public.galaxy_locations (
 person text primary key check (person in ('0','1')),
 latitude double precision,
 longitude double precision,
 accuracy double precision,
 speed double precision,
 heading double precision,
 sharing boolean not null default false,
 updated_at timestamptz not null default now(),
 constraint galaxy_locations_lat check (latitude is null or latitude between -90 and 90),
 constraint galaxy_locations_lon check (longitude is null or longitude between -180 and 180),
 constraint galaxy_locations_accuracy check (accuracy is null or accuracy >= 0),
 constraint galaxy_locations_speed check (speed is null or speed >= 0),
 constraint galaxy_locations_heading check (heading is null or (heading >= 0 and heading <= 360))
);
alter table public.galaxy_locations enable row level security;
drop policy if exists locations_read on public.galaxy_locations;
drop policy if exists locations_insert_own on public.galaxy_locations;
drop policy if exists locations_update_own on public.galaxy_locations;
create policy locations_read on public.galaxy_locations for select to authenticated using (public.galaxy_person() is not null);
create policy locations_insert_own on public.galaxy_locations for insert to authenticated with check (person = public.galaxy_person());
create policy locations_update_own on public.galaxy_locations for update to authenticated using (person = public.galaxy_person()) with check (person = public.galaxy_person());
grant select, insert, update on public.galaxy_locations to authenticated;
insert into public.galaxy_locations(person,sharing) values ('0',false),('1',false) on conflict (person) do nothing;
do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='galaxy_locations') then
  alter publication supabase_realtime add table public.galaxy_locations;
 end if;
end $$;