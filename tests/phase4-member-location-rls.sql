-- NG-AUD-004: deny all member-only reads to authenticated NON-members, even while GPS sharing is on.
-- Four ephemeral auth identities: A/B are the app's ONLY pair; C/D are outsiders.
-- The current single-couple schema cannot host an independent second pair.
-- Always use isolated Supabase local DB. Transaction rolls back all fixture rows.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email,email_confirmed_at) values
 ('e4000000-0000-4000-8000-000000000001','ng4-a@example.invalid',now()),
 ('e4000000-0000-4000-8000-000000000002','ng4-b@example.invalid',now()),
 ('e4000000-0000-4000-8000-000000000003','ng4-c@example.invalid',now()),
 ('e4000000-0000-4000-8000-000000000004','ng4-d@example.invalid',now());

insert into public.galaxy_members(person,email) values
 ('0','ng4-a@example.invalid'),
 ('1','ng4-b@example.invalid')
on conflict(person) do update set email=excluded.email;

insert into public.galaxy_items(id,kind,data,author) values
 ('e4000000-0000-4000-8000-000000000011','note',
  '{"title":"NG4 member-only sentinel","body":"QA ONLY"}'::jsonb,'0');
insert into public.galaxy_devices(person,name,token_hash) values
 ('0','NG4 privacy test device',repeat('e',64));
insert into storage.objects(bucket_id,name) values
 ('galaxy-photos','0/ng4-member-only.jpg');

update public.galaxy_locations set
 sharing=true,latitude=4.63001,longitude=-74.08001,accuracy=5,updated_at=now()
where person='0';
update public.galaxy_locations set
 sharing=true,latitude=4.63002,longitude=-74.08002,accuracy=5,updated_at=now()
where person='1';
insert into public.galaxy_trip_points(person,latitude,longitude) values ('0',4.63001,-74.08001);
insert into public.galaxy_location_history(person,latitude,longitude,captured_at) values ('0',4.63001,-74.08001,now());
insert into public.galaxy_trip_history(person,started_at,ended_at) values ('0',now()-interval '5 minutes',now());

set local role authenticated;
-- Positive controls first: prevent vacuous 'everything is denied' passing.
select set_config('request.jwt.claim.sub','e4000000-0000-4000-8000-000000000001',true);
do $qa$
begin
 if public.galaxy_person() is distinct from '0' then raise exception 'NG-AUD-004 member A mapping broken'; end if;
 if not exists(select 1 from public.galaxy_locations where person='0' and sharing) then raise exception 'NG-AUD-004 own location hidden'; end if;
 if not exists(select 1 from public.galaxy_locations where person='1' and sharing) then raise exception 'NG-AUD-004 shared partner location hidden'; end if;
 if not exists(select 1 from public.galaxy_trip_points where person='0') then raise exception 'NG-AUD-004 member trip points hidden'; end if;
 if not exists(select 1 from public.galaxy_location_history where person='0') then raise exception 'NG-AUD-004 member GPS history hidden'; end if;
 if not exists(select 1 from public.galaxy_trip_history where person='0') then raise exception 'NG-AUD-004 member trip history hidden'; end if;
 if not exists(select 1 from public.galaxy_items where id='e4000000-0000-4000-8000-000000000011') then raise exception 'NG-AUD-004 member note hidden'; end if;
 if not exists(select 1 from public.galaxy_devices where person='0' and name='NG4 privacy test device') then raise exception 'NG-AUD-004 member device hidden'; end if;
 if not exists(select 1 from storage.objects where bucket_id='galaxy-photos' and name='0/ng4-member-only.jpg') then raise exception 'NG-AUD-004 member media hidden'; end if;
end $qa$;

select set_config('request.jwt.claim.sub','e4000000-0000-4000-8000-000000000002',true);
do $qa$
begin
 if public.galaxy_person() is distinct from '1' then raise exception 'NG-AUD-004 member B mapping broken'; end if;
 if not exists(select 1 from public.galaxy_locations where person='0' and sharing) then raise exception 'NG-AUD-004 member B cannot see shared GPS'; end if;
 if not exists(select 1 from public.galaxy_trip_points where person='0') then raise exception 'NG-AUD-004 member B cannot see shared route'; end if;
end $qa$;

-- Negative controls: outsiders C and D have authenticated JWTs but no galaxy_members row.
-- All direct queries MUST be zero rows even while the couple shares live coordinates.
do $qa$
declare outsider uuid;
begin
 foreach outsider in array array[
  'e4000000-0000-4000-8000-000000000003'::uuid,
  'e4000000-0000-4000-8000-000000000004'::uuid
 ] loop
  perform set_config('request.jwt.claim.sub',outsider::text,true);
  if public.galaxy_person() is not null then raise exception 'NG-AUD-004 outsider unexpectedly mapped'; end if;
  if exists(select 1 from public.galaxy_settings) then raise exception 'NG-AUD-004 outsider settings exposed'; end if;
  if exists(select 1 from public.galaxy_items where id='e4000000-0000-4000-8000-000000000011') then raise exception 'NG-AUD-004 outsider note exposed'; end if;
  if exists(select 1 from public.galaxy_devices where person='0' and name='NG4 privacy test device') then raise exception 'NG-AUD-004 outsider device exposed'; end if;
  if exists(select 1 from storage.objects where bucket_id='galaxy-photos' and name='0/ng4-member-only.jpg') then raise exception 'NG-AUD-004 outsider media exposed'; end if;
  if exists(select 1 from public.galaxy_locations where person='0' and sharing) then raise exception 'NG-AUD-004 outsider live GPS exposed'; end if;
  if exists(select 1 from public.galaxy_trip_points where person='0') then raise exception 'NG-AUD-004 outsider trip points exposed'; end if;
  if exists(select 1 from public.galaxy_location_history where person='0') then raise exception 'NG-AUD-004 outsider GPS history exposed'; end if;
  if exists(select 1 from public.galaxy_trip_history where person='0') then raise exception 'NG-AUD-004 outsider trip history exposed'; end if;
 end loop;
end $qa$;

rollback;
