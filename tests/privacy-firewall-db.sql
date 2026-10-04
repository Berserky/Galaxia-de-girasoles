-- Phase 0 Privacy Firewall — integración real sobre Supabase/Postgres efímero.
-- Todos los fixtures de este archivo se revierten.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email,email_confirmed_at) values
 ('b0000000-0000-4000-8000-000000000001','privacy-owner@example.invalid',now()),
 ('b0000000-0000-4000-8000-000000000002','privacy-partner@example.invalid',now())
on conflict(id) do nothing;

insert into public.galaxy_members(person,email) values
 ('0','privacy-owner@example.invalid'),
 ('1','privacy-partner@example.invalid')
on conflict(person) do update set email=excluded.email;

update public.galaxy_locations
set sharing=false,latitude=null,longitude=null,accuracy=null,speed=null,heading=null,motion=null,updated_at=now()
where person in ('0','1');

insert into public.galaxy_items(id,kind,data,author) values
 ('b1000000-0000-4000-8000-000000000001','capsule',
  '{"title":"Fecha futura","body":"SECRET-DATE","unlockType":"date","unlockDate":"2099-12-01","unlockTime":"21:30","photoPath":"0/qa-future.jpg","audioPath":"0/qa-future.m4a","songId":"b2000000-0000-4000-8000-000000000001","latitude":4.6001,"longitude":-74.1001}'::jsonb,'0'),
 ('b1000000-0000-4000-8000-000000000002','capsule',
  '{"title":"Fecha abierta","body":"OPEN-DATE","unlockType":"date","unlockDate":"2020-01-01","unlockTime":"00:00","photoPath":"0/qa-open.jpg"}'::jsonb,'0'),
 ('b1000000-0000-4000-8000-000000000003','capsule',
  '{"title":"Lugar","body":"SECRET-PLACE","unlockType":"place","placeId":1,"placeName":"QA","latitude":4.6001,"longitude":-74.1001,"radius":150,"photoPath":"0/qa-place.jpg"}'::jsonb,'1')
on conflict(id) do nothing;

-- Metadata sintética: basta para comprobar la política SELECT de Storage y se revierte al final.
insert into storage.objects(bucket_id,name) values
 ('galaxy-photos','0/qa-future.jpg'),
 ('galaxy-voice','0/qa-future.m4a'),
 ('galaxy-photos','0/qa-open.jpg'),
 ('galaxy-photos','0/qa-place.jpg');

insert into public.galaxy_trip_points(person,latitude,longitude) values
 ('0',4.61,-74.11),('1',4.62,-74.12);
insert into public.galaxy_location_history(person,latitude,longitude,captured_at) values
 ('0',4.61,-74.11,now()),('1',4.62,-74.12,now());

-- Perfil 0: cápsulas futuras y de lugar permanecen cerradas incluso para su autor.
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);

do $qa$
begin
 if public.galaxy_person() is distinct from '0' then raise exception 'NG-QA profile 0 mapping failed'; end if;
 if exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000001') then raise exception 'NG-QA-001 future capsule exposed to profile 0'; end if;
 if exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000003') then raise exception 'NG-QA-001 place capsule exposed while location paused'; end if;
 if not exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000002' and data->>'body'='OPEN-DATE') then raise exception 'Unlocked capsule unexpectedly hidden'; end if;
 if exists(select 1 from storage.objects where bucket_id='galaxy-photos' and name='0/qa-future.jpg') then raise exception 'NG-QA-001 locked photo exposed'; end if;
 if exists(select 1 from storage.objects where bucket_id='galaxy-voice' and name='0/qa-future.m4a') then raise exception 'NG-QA-001 locked audio exposed'; end if;
 if not exists(select 1 from storage.objects where bucket_id='galaxy-photos' and name='0/qa-open.jpg') then raise exception 'Unlocked photo unexpectedly hidden'; end if;
 if public.galaxy_capsule_unlocked('{"unlockType":"date","unlockDate":"2099-12-01","unlockTime":"21:30"}'::jsonb,'0','2099-12-01 21:29:59 America/Bogota'::timestamptz) then raise exception 'Exact time unlocked early'; end if;
 if not public.galaxy_capsule_unlocked('{"unlockType":"date","unlockDate":"2099-12-01","unlockTime":"21:30"}'::jsonb,'0','2099-12-01 21:30:00 America/Bogota'::timestamptz) then raise exception 'Exact time did not unlock'; end if;
end $qa$;

-- Perfil 0 ve su propia fila GPS, pero no coordenadas/historial del perfil 1 pausado.
do $qa$
begin
 if (select count(*) from public.galaxy_locations)<>1 then raise exception 'NG-QA-003 paused partner location row exposed'; end if;
 if not exists(select 1 from public.galaxy_locations where person='0') then raise exception 'Own location unavailable'; end if;
 if exists(select 1 from public.galaxy_trip_points where person='1') then raise exception 'NG-QA-003 paused partner trip point exposed'; end if;
 if exists(select 1 from public.galaxy_location_history where person='1') then raise exception 'NG-QA-003 paused partner history exposed'; end if;
end $qa$;

reset role;
update public.galaxy_locations
set sharing=true,latitude=4.6001,longitude=-74.1001,accuracy=5,motion='still',updated_at=now()
where person='0';
update public.galaxy_locations
set sharing=true,latitude=4.6200,longitude=-74.1200,accuracy=5,motion='still',updated_at=now()
where person='1';

set local role service_role;
select public.galaxy_capsule_mark_place_unlocks('0',now());
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
do $qa$
begin
 if not exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000003' and data->>'body'='SECRET-PLACE') then raise exception 'Place capsule did not unlock near target'; end if;
 if not exists(select 1 from storage.objects where bucket_id='galaxy-photos' and name='0/qa-place.jpg') then raise exception 'Place-linked media did not unlock near target'; end if;
 if not exists(select 1 from public.galaxy_locations where person='1' and sharing=true) then raise exception 'Shared partner location hidden'; end if;
 if not exists(select 1 from public.galaxy_trip_points where person='1') then raise exception 'Shared partner trip point hidden'; end if;
 if not exists(select 1 from public.galaxy_location_history where person='1') then raise exception 'Shared partner history hidden'; end if;
end $qa$;

-- Llegar desbloquea una sola vez: pausar después no vuelve a bloquear el contenido
-- ni deja un signed URL autorizado apuntando a un estado que luego sería privado.
reset role;
update public.galaxy_locations set sharing=false,latitude=null,longitude=null,accuracy=null,motion=null,updated_at=now() where person='0';
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
do $qa$
begin
 if not exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000003' and data->>'body'='SECRET-PLACE') then raise exception 'Place capsule relocked after valid arrival'; end if;
 if not exists(select 1 from storage.objects where bucket_id='galaxy-photos' and name='0/qa-place.jpg') then raise exception 'Place media relocked after valid arrival'; end if;
end $qa$;

-- Perfil 1 también debe respetar el mismo firewall.
reset role;
update public.galaxy_locations set sharing=false,latitude=null,longitude=null,accuracy=null,motion=null,updated_at=now() where person='1';
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
do $qa$
declare affected integer;
begin
 if public.galaxy_person() is distinct from '1' then raise exception 'NG-QA profile 1 mapping failed'; end if;
 if exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000001') then raise exception 'NG-QA-001 future capsule exposed to profile 1'; end if;
 if exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000003') then raise exception 'NG-QA-001 own place capsule exposed while sharing false'; end if;
 if exists(select 1 from storage.objects where bucket_id='galaxy-photos' and name='0/qa-place.jpg') then raise exception 'NG-QA-001 place media exposed while sharing false'; end if;

 update public.galaxy_items
 set data=jsonb_set(data,'{unlockedFor}','["1"]'::jsonb,true)
 where id='b1000000-0000-4000-8000-000000000003';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'NG-QA-001 authenticated client updated a locked capsule through RLS'; end if;

 update public.galaxy_items
 set data=jsonb_set(data,'{unlockDate}','"2020-01-01"'::jsonb,true)
 where id='b1000000-0000-4000-8000-000000000001';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'NG-QA-001 partner changed locked capsule unlock date'; end if;

 delete from public.galaxy_items where id='b1000000-0000-4000-8000-000000000001';
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'NG-QA-001 partner deleted locked capsule'; end if;
end $qa$;
reset role;

-- Incluso service_role (android-companion) no puede falsificar unlockedFor mediante item-save/update.
set local role service_role;
update public.galaxy_items
set data=jsonb_set(data,'{unlockedFor}','["1"]'::jsonb,true)
where id='b1000000-0000-4000-8000-000000000003';
reset role;

do $qa$
begin
 if coalesce((select (data->'unlockedFor') @> '["1"]'::jsonb from public.galaxy_items where id='b1000000-0000-4000-8000-000000000003'),false) then
  raise exception 'NG-QA-001 service_role forged server-owned place unlock state';
 end if;
end $qa$;

-- Un cliente no puede falsificar el estado server-owned unlockedFor al crear una cápsula.
set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
insert into public.galaxy_items(id,kind,data,author) values(
 'b1000000-0000-4000-8000-000000000004',
 'capsule',
 '{"title":"Lugar forjado","body":"FORGED-UNLOCK","unlockType":"place","latitude":4.7001,"longitude":-74.2001,"radius":150,"unlockedFor":["1"]}'::jsonb,
 '0'
);
reset role;

do $qa$
begin
 if coalesce((select data ? 'unlockedFor' from public.galaxy_items where id='b1000000-0000-4000-8000-000000000004'),true) then
  raise exception 'NG-QA-001 client forged unlockedFor on capsule insert';
 end if;
end $qa$;

set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
do $qa$
begin
 if exists(select 1 from public.galaxy_items where id='b1000000-0000-4000-8000-000000000004') then
  raise exception 'NG-QA-001 forged place capsule became visible to profile 1';
 end if;
end $qa$;
reset role;

-- NG-QA-013: la migración debe haber detectado el huérfano preexistente.
do $qa$
begin
 if not exists(select 1 from public.galaxy_intelligence_cleanup_queue where source_type='place' and source_id='999999999') then
  raise exception 'NG-QA-013 preexisting orphan was not queued';
 end if;
end $qa$;

set local role service_role;
select public.galaxy_intelligence_reconcile_cleanup(100);
reset role;

do $qa$
begin
 if exists(select 1 from public.galaxy_intelligence_documents where source_type='place' and source_id='999999999') then raise exception 'NG-QA-013 preexisting orphan survived reconciliation'; end if;
 if exists(select 1 from public.galaxy_intelligence_cleanup_queue where source_type='place' and source_id='999999999') then raise exception 'NG-QA-013 reconciled orphan queue survived'; end if;
end $qa$;

-- Fuerza un fallo real de cleanup y verifica que queda pendiente para reintento.
insert into public.galaxy_items(id,kind,data,author) values
 ('b3000000-0000-4000-8000-000000000001','memory','{"title":"Cleanup source","body":"delete me"}'::jsonb,'0');
insert into public.galaxy_intelligence_documents(
 source_type,source_id,source_version,title,content,metadata,searchable,content_hash,embedding_status
) values(
 'memory','b3000000-0000-4000-8000-000000000001','1','Cleanup source','delete me','{}'::jsonb,true,'qa-cleanup-source','pending'
);

create function public.qa_force_cleanup_failure() returns trigger
language plpgsql as $qa$
begin
 if old.source_type='memory' and old.source_id='b3000000-0000-4000-8000-000000000001' then
  raise exception 'forced cleanup failure';
 end if;
 return old;
end $qa$;
create trigger qa_force_cleanup_failure before delete on public.galaxy_intelligence_documents
for each row execute function public.qa_force_cleanup_failure();

set local role authenticated;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
delete from public.galaxy_items where id='b3000000-0000-4000-8000-000000000001';
reset role;

do $qa$
begin
 if not exists(select 1 from public.galaxy_intelligence_cleanup_queue where source_type='memory' and source_id='b3000000-0000-4000-8000-000000000001') then raise exception 'NG-QA-013 authenticated source delete did not enqueue cleanup'; end if;
end $qa$;

set local role service_role;
select public.galaxy_intelligence_reconcile_cleanup(100);
reset role;

do $qa$
begin
 if not exists(select 1 from public.galaxy_intelligence_documents where source_type='memory' and source_id='b3000000-0000-4000-8000-000000000001') then raise exception 'Forced cleanup failure was not exercised'; end if;
 if not exists(select 1 from public.galaxy_intelligence_cleanup_queue where source_type='memory' and source_id='b3000000-0000-4000-8000-000000000001' and attempts>=1 and last_error is not null) then raise exception 'NG-QA-013 failed cleanup was not retained for retry'; end if;
end $qa$;

drop trigger qa_force_cleanup_failure on public.galaxy_intelligence_documents;
drop function public.qa_force_cleanup_failure();

set local role service_role;
select public.galaxy_intelligence_reconcile_cleanup(100);
select public.galaxy_intelligence_reconcile_cleanup(100);
reset role;

do $qa$
begin
 if exists(select 1 from public.galaxy_intelligence_documents where source_type='memory' and source_id='b3000000-0000-4000-8000-000000000001') then raise exception 'NG-QA-013 orphan survived successful retry'; end if;
 if exists(select 1 from public.galaxy_intelligence_cleanup_queue where source_type='memory' and source_id='b3000000-0000-4000-8000-000000000001') then raise exception 'NG-QA-013 queue not idempotently drained'; end if;
end $qa$;

rollback;
