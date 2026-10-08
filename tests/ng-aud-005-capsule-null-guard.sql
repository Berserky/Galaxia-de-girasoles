-- NG-AUD-005: run AFTER the forward-only capsule helper migration on an isolated DB.
-- A real authenticated outsider receives false; changes are rolled back.
\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','e4000000-0000-4000-8000-000000000003',true);
do $test$
begin
  if public.galaxy_person() is not null then
    raise exception 'NG-AUD-005 test identity unexpectedly has membership';
  end if;
  if public.galaxy_capsule_object_access('galaxy-photos','0/ng-aud-005.jpg') is distinct from false then
    raise exception 'NG-AUD-005 outsider permitted photo';
  end if;
  if public.galaxy_capsule_object_access('galaxy-voice','0/ng-aud-005.mp3') is distinct from false then
    raise exception 'NG-AUD-005 outsider permitted audio';
  end if;
  if public.galaxy_capsule_object_access('galaxy-photos',null) is distinct from false then
    raise exception 'NG-AUD-005 outsider accepted null path';
  end if;
end $test$;
rollback;
