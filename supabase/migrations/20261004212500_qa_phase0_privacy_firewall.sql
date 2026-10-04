begin;

-- NG-QA-001 / NG-QA-002: one server-side capsule lock predicate shared by RLS/Storage.
create or replace function public.galaxy_capsule_unlocked(
  capsule jsonb,
  viewer text,
  at_time timestamptz default now()
) returns boolean
language plpgsql stable security invoker
set search_path=''
as $$
declare
  unlock_type text:=coalesce(nullif(capsule->>'unlockType',''),nullif(capsule->>'unlock_type',''),'date');
  raw_at text;
  unlock_day text;
  unlock_time text;
  unlock_at timestamptz;
  target_lat double precision;
  target_lon double precision;
  target_radius double precision;
  loc public.galaxy_locations%rowtype;
  h double precision;
  distance_m double precision;
begin
  if viewer not in ('0','1') then return false; end if;

  if unlock_type='place' then
    begin
      target_lat:=(capsule->>'latitude')::double precision;
      target_lon:=(capsule->>'longitude')::double precision;
      target_radius:=greatest(50,least(1000,coalesce((capsule->>'radius')::double precision,150)));
    exception when others then
      return false;
    end;
    if target_lat not between -90 and 90 or target_lon not between -180 and 180 then return false; end if;

    select * into loc
    from public.galaxy_locations
    where person=viewer
      and sharing=true
      and latitude is not null
      and longitude is not null
      and updated_at>=at_time-interval '4 minutes'
    limit 1;
    if not found then return false; end if;

    h:=power(sin(radians((loc.latitude-target_lat)/2)),2)
       +cos(radians(target_lat))*cos(radians(loc.latitude))
       *power(sin(radians((loc.longitude-target_lon)/2)),2);
    distance_m:=6371000*2*asin(sqrt(least(1,greatest(0,h))));
    return distance_m<=target_radius;
  end if;

  raw_at:=coalesce(nullif(capsule->>'unlockAt',''),nullif(capsule->>'unlock_at',''));
  if raw_at is not null then
    begin unlock_at:=raw_at::timestamptz; exception when others then unlock_at:=null; end;
  end if;
  if unlock_at is null then
    unlock_day:=coalesce(nullif(capsule->>'unlockDate',''),nullif(capsule->>'unlock_date',''),nullif(capsule->>'date',''));
    unlock_time:=coalesce(nullif(capsule->>'unlockTime',''),nullif(capsule->>'unlock_time',''),'00:00');
    if unlock_day is null or unlock_day!~'^\d{4}-\d{2}-\d{2}$' or unlock_time!~'^\d{2}:\d{2}$' then return false; end if;
    begin unlock_at:=(unlock_day||' '||unlock_time||':00 America/Bogota')::timestamptz; exception when others then return false; end;
  end if;
  return unlock_at<=at_time;
end $$;

revoke all on function public.galaxy_capsule_unlocked(jsonb,text,timestamptz) from public,anon;
grant execute on function public.galaxy_capsule_unlocked(jsonb,text,timestamptz) to authenticated,service_role;

drop policy if exists items_read on public.galaxy_items;
create policy items_read on public.galaxy_items
for select to authenticated
using (
  public.galaxy_person() is not null
  and (kind<>'capsule' or public.galaxy_capsule_unlocked(data,public.galaxy_person(),now()))
);

drop policy if exists items_update on public.galaxy_items;
create policy items_update on public.galaxy_items
for update to authenticated
using(
  public.galaxy_person() is not null
  and (kind<>'capsule' or author=public.galaxy_person())
)
with check(
  public.galaxy_person() is not null
  and (kind<>'capsule' or author=public.galaxy_person())
);

drop policy if exists items_delete on public.galaxy_items;
create policy items_delete on public.galaxy_items
for delete to authenticated
using(
  public.galaxy_person() is not null
  and (kind<>'capsule' or author=public.galaxy_person())
);


create or replace function public.galaxy_capsule_object_access(bucket text,object_name text)
returns boolean
language plpgsql stable security definer
set search_path=''
as $$
declare viewer text:=public.galaxy_person();
begin
  if viewer not in ('0','1') or object_name is null or object_name='' then return false; end if;
  return not exists(
    select 1
    from public.galaxy_items i
    where i.kind='capsule'
      and (
        (bucket='galaxy-photos' and i.data->>'photoPath'=object_name)
        or (bucket='galaxy-voice' and i.data->>'audioPath'=object_name)
      )
      and not public.galaxy_capsule_unlocked(i.data,viewer,now())
  );
end $$;

revoke all on function public.galaxy_capsule_object_access(text,text) from public,anon;
grant execute on function public.galaxy_capsule_object_access(text,text) to authenticated;

drop policy if exists galaxy_photos_read on storage.objects;
create policy galaxy_photos_read on storage.objects for select to authenticated
using(
  bucket_id='galaxy-photos'
  and public.galaxy_person() is not null
  and public.galaxy_capsule_object_access(bucket_id,name)
);

drop policy if exists galaxy_voice_read on storage.objects;
create policy galaxy_voice_read on storage.objects for select to authenticated
using(
  bucket_id='galaxy-voice'
  and public.galaxy_person() is not null
  and public.galaxy_capsule_object_access(bucket_id,name)
);

-- NG-QA-003: own GPS remains readable; partner GPS/history requires active sharing.
drop policy if exists locations_read on public.galaxy_locations;
create policy locations_read on public.galaxy_locations for select to authenticated
using(person=public.galaxy_person() or sharing=true);

drop policy if exists trip_points_read on public.galaxy_trip_points;
create policy trip_points_read on public.galaxy_trip_points for select to authenticated
using(
  person=public.galaxy_person()
  or exists(select 1 from public.galaxy_locations l where l.person=galaxy_trip_points.person and l.sharing=true)
);

drop policy if exists location_history_read on public.galaxy_location_history;
create policy location_history_read on public.galaxy_location_history for select to authenticated
using(
  person=public.galaxy_person()
  or exists(select 1 from public.galaxy_locations l where l.person=galaxy_location_history.person and l.sharing=true)
);

drop policy if exists trip_history_read on public.galaxy_trip_history;
create policy trip_history_read on public.galaxy_trip_history for select to authenticated
using(
  person=public.galaxy_person()
  or exists(select 1 from public.galaxy_locations l where l.person=galaxy_trip_history.person and l.sharing=true)
);

-- NG-QA-013: source deletion creates a durable, idempotent cleanup obligation.
create table if not exists public.galaxy_intelligence_cleanup_queue(
  source_type text not null check(length(source_type) between 1 and 40),
  source_id text not null check(length(source_id) between 1 and 300),
  requested_at timestamptz not null default now(),
  attempts integer not null default 0 check(attempts>=0),
  last_error text check(last_error is null or length(last_error)<=300),
  primary key(source_type,source_id)
);
alter table public.galaxy_intelligence_cleanup_queue enable row level security;
revoke all on public.galaxy_intelligence_cleanup_queue from public,anon,authenticated;
grant select,insert,update,delete on public.galaxy_intelligence_cleanup_queue to service_role;

create or replace function public.galaxy_intelligence_enqueue_source_cleanup()
returns trigger
language plpgsql security invoker
set search_path=''
as $$
declare payload jsonb:=to_jsonb(old); source_kind text:=tg_argv[0]; source_key text;
begin
  if source_kind='item' then
    source_kind:=payload->>'kind';
    source_key:=payload->>'id';
  elsif source_kind='bond' then
    if payload->>'type'='voice' then source_kind:='voice-transcript';
    elsif payload->>'type' in ('sharednote','ritual') then source_kind:=payload->>'type';
    else return old;
    end if;
    source_key:=payload->>'id';
  else
    source_key:=payload->>tg_argv[1];
  end if;
  if source_kind is null or source_key is null or source_key='' then return old; end if;
  insert into public.galaxy_intelligence_cleanup_queue(source_type,source_id,requested_at,attempts,last_error)
  values(source_kind,source_key,now(),0,null)
  on conflict(source_type,source_id) do update
  set requested_at=excluded.requested_at,attempts=0,last_error=null;
  return old;
end $$;

revoke all on function public.galaxy_intelligence_enqueue_source_cleanup() from public,anon,authenticated;

drop trigger if exists galaxy_intelligence_cleanup_item on public.galaxy_items;
create trigger galaxy_intelligence_cleanup_item after delete on public.galaxy_items
for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('item','id');

drop trigger if exists galaxy_intelligence_cleanup_place on public.galaxy_places;
create trigger galaxy_intelligence_cleanup_place after delete on public.galaxy_places
for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('place','id');

drop trigger if exists galaxy_intelligence_cleanup_trip on public.galaxy_trip_history;
create trigger galaxy_intelligence_cleanup_trip after delete on public.galaxy_trip_history
for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('trip','id');

drop trigger if exists galaxy_intelligence_cleanup_goal on public.galaxy_goals;
create trigger galaxy_intelligence_cleanup_goal after delete on public.galaxy_goals
for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('goal','id');

drop trigger if exists galaxy_intelligence_cleanup_bond on public.galaxy_bond;
create trigger galaxy_intelligence_cleanup_bond after delete on public.galaxy_bond
for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('bond','id');

drop trigger if exists galaxy_intelligence_cleanup_voice_transcript on public.galaxy_voice_transcripts;
create trigger galaxy_intelligence_cleanup_voice_transcript after delete on public.galaxy_voice_transcripts
for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('voice-transcript','bond_id');

drop trigger if exists galaxy_intelligence_cleanup_photo on public.galaxy_photo_context;
create trigger galaxy_intelligence_cleanup_photo after delete on public.galaxy_photo_context
for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('photo','path');

create or replace function public.galaxy_intelligence_reconcile_cleanup(batch_size integer default 100)
returns jsonb
language plpgsql security invoker
set search_path=''
as $$
declare q record; processed integer:=0; failed integer:=0; batch integer:=greatest(1,least(coalesce(batch_size,100),500));
begin
  for q in
    select source_type,source_id
    from public.galaxy_intelligence_cleanup_queue
    order by requested_at
    limit batch
    for update skip locked
  loop
    begin
      delete from public.galaxy_intelligence_documents
      where source_type=q.source_type and source_id=q.source_id;
      delete from public.galaxy_intelligence_cleanup_queue
      where source_type=q.source_type and source_id=q.source_id;
      processed:=processed+1;
    exception when others then
      update public.galaxy_intelligence_cleanup_queue
      set attempts=attempts+1,last_error=left(sqlerrm,300),requested_at=now()
      where source_type=q.source_type and source_id=q.source_id;
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object('processed',processed,'failed',failed);
end $$;

revoke all on function public.galaxy_intelligence_reconcile_cleanup(integer) from public,anon,authenticated;
grant execute on function public.galaxy_intelligence_reconcile_cleanup(integer) to service_role;

-- Seed reconciliation for any pre-existing orphan documents.
insert into public.galaxy_intelligence_cleanup_queue(source_type,source_id)
select d.source_type,d.source_id
from public.galaxy_intelligence_documents d
where
 (d.source_type in ('memory','song','event','plan','note','capsule','wish','journey')
  and not exists(select 1 from public.galaxy_items i where i.id::text=d.source_id and i.kind=d.source_type))
 or (d.source_type='place' and not exists(select 1 from public.galaxy_places p where p.id::text=d.source_id))
 or (d.source_type='trip' and not exists(select 1 from public.galaxy_trip_history t where t.id::text=d.source_id))
 or (d.source_type='goal' and not exists(select 1 from public.galaxy_goals g where g.id::text=d.source_id))
 or (d.source_type in ('sharednote','ritual') and not exists(select 1 from public.galaxy_bond b where b.id::text=d.source_id and b.type=d.source_type))
 or (d.source_type='voice-transcript' and not exists(select 1 from public.galaxy_voice_transcripts v where v.bond_id::text=d.source_id))
 or (d.source_type='photo' and not exists(select 1 from public.galaxy_photo_context p where p.path=d.source_id))
on conflict(source_type,source_id) do nothing;

commit;
