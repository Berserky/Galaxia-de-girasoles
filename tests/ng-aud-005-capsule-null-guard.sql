-- NG-AUD-005: run only against an ISOLATED throwaway database after applying migration.
-- Fixtures and all writes are rolled back. Do not run against QA/prod shared state.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('e5000000-0000-4000-8000-000000000001','ng5-a@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000002','ng5-b@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000003','ng5-c@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000004','ng5-d@example.invalid',now());
insert into public.galaxy_members(person,email) values
 ('0','ng5-a@example.invalid'),('1','ng5-b@example.invalid')
on conflict(person) do update set email=excluded.email;
insert into public.galaxy_items(id,kind,data,author) values
 ('e5000000-0000-4000-8000-000000000011','capsule',
 '{"photoPath":"0/ng5-locked.jpg","audioPath":"0/ng5-locked.mp3","unlockType":"date","unlockAt":"2999-01-01T00:00:00Z"}'::jsonb,'0'),
 ('e5000000-0000-4000-8000-000000000012','capsule',
 '{"photoPath":"0/ng5-open.jpg","audioPath":"0/ng5-open.mp3","unlockType":"date","unlockAt":"2000-01-01T00:00:00Z"}'::jsonb,'0');
set local role authenticated;
do $test$
declare identity uuid;
begin
  foreach identity in array array[
    'e5000000-0000-4000-8000-000000000001'::uuid,
    'e5000000-0000-4000-8000-000000000002'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub',identity::text,true);
    if public.galaxy_person() is null then raise exception 'NG-AUD-005 member mapping failed'; end if;
    if public.galaxy_capsule_object_access('galaxy-photos','0/ng5-locked.jpg') is distinct from false then raise exception 'NG-AUD-005 locked photo exposed'; end if;
    if public.galaxy_capsule_object_access('galaxy-voice','0/ng5-locked.mp3') is distinct from false then raise exception 'NG-AUD-005 locked voice exposed'; end if;
    if public.galaxy_capsule_object_access('galaxy-photos','0/ng5-open.jpg') is distinct from true then raise exception 'NG-AUD-005 unlocked photo denied'; end if;
    if public.galaxy_capsule_object_access('galaxy-voice','0/ng5-open.mp3') is distinct from true then raise exception 'NG-AUD-005 unlocked voice denied'; end if;
  end loop;
  foreach identity in array array[
    'e5000000-0000-4000-8000-000000000003'::uuid,
    'e5000000-0000-4000-8000-000000000004'::uuid
  ] loop
    perform set_config('request.jwt.claim.sub',identity::text,true);
    if public.galaxy_person() is not null then raise exception 'NG-AUD-005 outsider unexpectedly mapped'; end if;
    if public.galaxy_capsule_object_access('galaxy-photos','0/ng5-open.jpg') is distinct from false then raise exception 'NG-AUD-005 outsider permitted photo'; end if;
    if public.galaxy_capsule_object_access('galaxy-voice','0/ng5-open.mp3') is distinct from false then raise exception 'NG-AUD-005 outsider permitted audio'; end if;
    if public.galaxy_capsule_object_access('galaxy-photos',null) is distinct from false then raise exception 'NG-AUD-005 outsider accepted NULL path'; end if;
  end loop;
end $test$;
rollback;
