-- Ejecutar una vez en el editor SQL de un proyecto Supabase FREE.
begin;
create extension if not exists pgcrypto;
create table public.galaxy_members (
 person text primary key check (person in ('0','1')),
 email text not null unique check(email = lower(trim(email)))
);
alter table public.galaxy_members enable row level security;
-- Sin políticas ni permisos para clientes: solo el administrador cambia los invitados.
revoke all on public.galaxy_members from anon, authenticated;
create function public.galaxy_person() returns text language sql stable security definer
set search_path = '' as $$
 select m.person from public.galaxy_members m join auth.users u on lower(u.email)=m.email
 where u.id=auth.uid() and u.email_confirmed_at is not null
$$;
revoke all on function public.galaxy_person() from public, anon;
grant execute on function public.galaxy_person() to authenticated;

create table public.galaxy_invitation(id integer primary key check(id=1), digest text not null, expires timestamptz not null);
alter table public.galaxy_invitation enable row level security;
revoke all on public.galaxy_invitation from anon,authenticated;
create function public.galaxy_invite() returns text language plpgsql security definer set search_path='' as $$
declare token text:=gen_random_uuid()::text||gen_random_uuid()::text;
begin
 if public.galaxy_person() is distinct from '0' then raise exception 'Solo el administrador puede invitar'; end if;
 if exists(select 1 from public.galaxy_members where person='1') then raise exception 'Tu pareja ya está registrada'; end if;
 insert into public.galaxy_invitation values(1,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '7 days')
 on conflict(id) do update set digest=excluded.digest,expires=excluded.expires;
 return token;
end $$;
create function public.galaxy_claim(token text) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.galaxy_invitation; mail text;
begin
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Entra con un correo verificado'; end if;
 if public.galaxy_person() is not null then raise exception 'Esta cuenta ya pertenece al espacio'; end if;
 select * into invitation from public.galaxy_invitation where id=1 for update;
 if token is null or length(token)<>72 or invitation.digest is null or invitation.expires<now() or invitation.digest is distinct from encode(sha256(convert_to(token,'UTF8')),'hex') then raise exception 'La invitación no es válida o expiró'; end if;
 insert into public.galaxy_members(person,email) values('1',mail);
 delete from public.galaxy_invitation where id=1;
end $$;
revoke all on function public.galaxy_invite(),public.galaxy_claim(text) from public,anon;
grant execute on function public.galaxy_invite(),public.galaxy_claim(text) to authenticated;

create table public.galaxy_settings (
 id integer primary key check(id=1),
 data jsonb not null,
 version integer not null default 1
);
insert into public.galaxy_settings values(1,'{"names":["Sebas","Adri"],"startDate":"","albumUrl":""}',1);
create table public.galaxy_items (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('memory','song','event','plan','note','capsule','wish','journey')),
 data jsonb not null check(jsonb_typeof(data)='object' and length(data::text)<=12000),
 version integer not null default 1,
 author text not null default public.galaxy_person() check(author in ('0','1')),
 created timestamptz not null default now()
);
create function public.galaxy_version() returns trigger language plpgsql set search_path='' as $$
begin
 new.version := old.version + 1;
 if tg_table_name='galaxy_items' then
  new.id:=old.id; new.kind:=old.kind; new.author:=old.author; new.created:=old.created;
 end if;
 return new;
end $$;
create trigger settings_version before update on public.galaxy_settings for each row execute function public.galaxy_version();
create trigger items_version before update on public.galaxy_items for each row execute function public.galaxy_version();
alter table public.galaxy_settings enable row level security;
alter table public.galaxy_items enable row level security;
create policy settings_read on public.galaxy_settings for select to authenticated using(public.galaxy_person() is not null);
create policy settings_update on public.galaxy_settings for update to authenticated using(public.galaxy_person() is not null) with check(public.galaxy_person() is not null);
create policy items_read on public.galaxy_items for select to authenticated using(public.galaxy_person() is not null);
create policy items_insert on public.galaxy_items for insert to authenticated with check(author=public.galaxy_person());
create policy items_update on public.galaxy_items for update to authenticated using(public.galaxy_person() is not null) with check(public.galaxy_person() is not null);
create policy items_delete on public.galaxy_items for delete to authenticated using(public.galaxy_person() is not null);

create table public.galaxy_daily (
 day date not null, person text not null check(person in ('0','1')),
 mood text check(mood in ('feliz','tranquilo','cansado','sensible','abrazo')),
 answer text check(length(answer)<=3000), primary key(day,person)
);
alter table public.galaxy_daily enable row level security;
-- Las respuestas nunca se leen directamente. La función solo revela ambas al responder los dos.
revoke all on public.galaxy_daily from anon, authenticated;
create function public.galaxy_daily_read() returns table(day date,person text,mood text,answer text,answered boolean)
language sql stable security definer set search_path='' as $$
 select d.day,d.person,d.mood,
 case when d.person=public.galaxy_person() or
 (select count(*) from public.galaxy_daily a where a.day=d.day and nullif(trim(a.answer),'') is not null)=2
 then d.answer else null end,
 nullif(trim(d.answer),'') is not null
 from public.galaxy_daily d where public.galaxy_person() is not null
$$;
create function public.galaxy_daily_save(field text,value text) returns void
language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); today date:=(now() at time zone 'America/Bogota')::date;
begin
 if p is null then raise exception 'Acceso no autorizado'; end if;
 if field='mood' and value in ('feliz','tranquilo','cansado','sensible','abrazo') then
  insert into public.galaxy_daily(day,person,mood) values(today,p,value)
  on conflict(day,person) do update set mood=excluded.mood;
 elsif field='answer' and length(trim(value)) between 1 and 3000 then
  insert into public.galaxy_daily(day,person,answer) values(today,p,trim(value))
  on conflict(day,person) do update set answer=excluded.answer;
 else raise exception 'Respuesta no válida'; end if;
end $$;
revoke all on function public.galaxy_daily_read(), public.galaxy_daily_save(text,text) from public, anon;
grant execute on function public.galaxy_daily_read(), public.galaxy_daily_save(text,text) to authenticated;
grant select,update on public.galaxy_settings to authenticated;
grant select,insert,update,delete on public.galaxy_items to authenticated;
revoke all on public.galaxy_settings,public.galaxy_items from anon;

-- Fotos privadas. Los dos miembros pueden subir, ver y quitar fotos.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('galaxy-photos','galaxy-photos',false,12582912,array['image/jpeg','image/png','image/webp']);
create policy galaxy_photos_read on storage.objects for select to authenticated
 using(bucket_id='galaxy-photos' and public.galaxy_person() is not null);
create policy galaxy_photos_add on storage.objects for insert to authenticated
 with check(bucket_id='galaxy-photos' and public.galaxy_person() is not null);
create policy galaxy_photos_delete on storage.objects for delete to authenticated
 using(bucket_id='galaxy-photos' and public.galaxy_person() is not null);
-- Música privada. MP3 compartidos solo entre los dos miembros.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('galaxy-music','galaxy-music',false,20971520,array['audio/mpeg']);
create policy galaxy_music_read on storage.objects for select to authenticated
 using(bucket_id='galaxy-music' and public.galaxy_person() is not null);
create policy galaxy_music_add on storage.objects for insert to authenticated
 with check(bucket_id='galaxy-music' and public.galaxy_person() is not null);
create policy galaxy_music_delete on storage.objects for delete to authenticated
 using(bucket_id='galaxy-music' and public.galaxy_person() is not null);
-- Nuestro Mapa: ubicación actual voluntaria, lugares y recorridos temporales.
create table public.galaxy_locations (
 person text primary key check(person in ('0','1')),
 latitude double precision check(latitude between -90 and 90), longitude double precision check(longitude between -180 and 180),
 accuracy double precision check(accuracy>=0), speed double precision check(speed>=0), heading double precision check(heading between 0 and 360),
 motion text check(motion is null or motion in ('still','walking','vehicle')),
 transport_preference text check(transport_preference is null or transport_preference in ('motorcycle','transit')),
 sharing boolean not null default false, status text check(status is null or length(status)<=40),
 trip_active boolean not null default false, trip_started_at timestamptz, updated_at timestamptz not null default now()
);
insert into public.galaxy_locations(person,transport_preference) values('0','motorcycle'),('1','transit');
alter table public.galaxy_locations enable row level security;
create policy locations_read on public.galaxy_locations for select to authenticated using(public.galaxy_person() is not null);
create policy locations_insert_own on public.galaxy_locations for insert to authenticated with check(person=public.galaxy_person());
create policy locations_update_own on public.galaxy_locations for update to authenticated using(person=public.galaxy_person()) with check(person=public.galaxy_person());
revoke all on public.galaxy_locations from anon,authenticated;
grant select,insert,update on public.galaxy_locations to authenticated;

create table public.galaxy_places (
 id bigint generated by default as identity primary key, owner text not null check(owner in ('0','1')),
 kind text not null check(kind in ('home','work','memory','adventure')), name text not null check(length(name) between 1 and 80),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 note text check(note is null or length(note)<=300), created_at timestamptz not null default now()
);
alter table public.galaxy_places enable row level security;
create policy places_read on public.galaxy_places for select to authenticated using(public.galaxy_person() is not null);
create policy places_insert_own on public.galaxy_places for insert to authenticated with check(owner=public.galaxy_person());
create policy places_update_own on public.galaxy_places for update to authenticated using(owner=public.galaxy_person()) with check(owner=public.galaxy_person());
create policy places_delete_own on public.galaxy_places for delete to authenticated using(owner=public.galaxy_person());
revoke all on public.galaxy_places from anon,authenticated;
grant select,insert,update,delete on public.galaxy_places to authenticated;
grant usage,select on sequence public.galaxy_places_id_seq to authenticated;

create table public.galaxy_trip_points (
 id bigint generated by default as identity primary key, person text not null check(person in ('0','1')),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 created_at timestamptz not null default now()
);
alter table public.galaxy_trip_points enable row level security;
create policy trip_points_read on public.galaxy_trip_points for select to authenticated using(public.galaxy_person() is not null);
create policy trip_points_insert_own on public.galaxy_trip_points for insert to authenticated with check(person=public.galaxy_person());
create policy trip_points_delete_own on public.galaxy_trip_points for delete to authenticated using(person=public.galaxy_person());
revoke all on public.galaxy_trip_points from anon,authenticated;
grant select,insert,delete on public.galaxy_trip_points to authenticated;
grant usage,select on sequence public.galaxy_trip_points_id_seq to authenticated;

create table public.galaxy_location_history (
 id bigint generated by default as identity primary key, person text not null check(person in ('0','1')),
 latitude double precision not null check(latitude between -90 and 90), longitude double precision not null check(longitude between -180 and 180),
 accuracy double precision check(accuracy is null or accuracy>=0), speed double precision check(speed is null or speed>=0), heading double precision check(heading is null or heading between 0 and 360),
 motion text check(motion is null or motion in ('still','walking','vehicle')), captured_at timestamptz not null default now(),
 source_device_id uuid, client_sample_id uuid
);
create index galaxy_location_history_person_time_idx on public.galaxy_location_history(person,captured_at desc);
create unique index galaxy_location_history_device_sample_uidx on public.galaxy_location_history(source_device_id,client_sample_id) where source_device_id is not null and client_sample_id is not null;
alter table public.galaxy_location_history enable row level security;
create policy location_history_read on public.galaxy_location_history for select to authenticated using(public.galaxy_person() is not null);
create policy location_history_insert_own on public.galaxy_location_history for insert to authenticated with check(person=public.galaxy_person());
create policy location_history_delete_own on public.galaxy_location_history for delete to authenticated using(person=public.galaxy_person());
revoke all on public.galaxy_location_history from anon,authenticated;
grant select,insert,delete on public.galaxy_location_history to authenticated;
grant usage,select on sequence public.galaxy_location_history_id_seq to authenticated;

create table public.galaxy_trip_history (
 id bigint generated by default as identity primary key, person text not null check(person in ('0','1')),
 started_at timestamptz not null, ended_at timestamptz not null default now(), distance_m integer not null default 0 check(distance_m>=0),
 duration_s integer not null default 0 check(duration_s>=0), max_speed double precision check(max_speed is null or max_speed>=0),
 dominant_motion text check(dominant_motion is null or dominant_motion in ('still','walking','vehicle')), created_at timestamptz not null default now()
);
create index galaxy_trip_history_person_time_idx on public.galaxy_trip_history(person,started_at desc);
alter table public.galaxy_trip_history enable row level security;
create policy trip_history_read on public.galaxy_trip_history for select to authenticated using(public.galaxy_person() is not null);
create policy trip_history_insert_own on public.galaxy_trip_history for insert to authenticated with check(person=public.galaxy_person());
create policy trip_history_delete_own on public.galaxy_trip_history for delete to authenticated using(person=public.galaxy_person());
revoke all on public.galaxy_trip_history from anon,authenticated;
grant select,insert,delete on public.galaxy_trip_history to authenticated;
grant usage,select on sequence public.galaxy_trip_history_id_seq to authenticated;

create table public.galaxy_place_events (
 id bigint generated by default as identity primary key, person text not null check(person in ('0','1')),
 place_id bigint not null references public.galaxy_places(id) on delete cascade, event text not null check(event in ('arrived','left')),
 happened_at timestamptz not null default now()
);
create index galaxy_place_events_person_time_idx on public.galaxy_place_events(person,happened_at desc);
alter table public.galaxy_place_events enable row level security;
create policy place_events_read on public.galaxy_place_events for select to authenticated using(public.galaxy_person() is not null);
create policy place_events_insert_own on public.galaxy_place_events for insert to authenticated with check(person=public.galaxy_person());
create policy place_events_delete_own on public.galaxy_place_events for delete to authenticated using(person=public.galaxy_person());
revoke all on public.galaxy_place_events from anon,authenticated;
grant select,insert,delete on public.galaxy_place_events to authenticated;
grant usage,select on sequence public.galaxy_place_events_id_seq to authenticated;
create index galaxy_place_events_place_id_idx on public.galaxy_place_events(place_id);

create table public.galaxy_destinations (
 person text primary key check(person in ('0','1')), kind text not null check(kind in ('person','place')),
 target_person text check(target_person is null or target_person in ('0','1')), place_id bigint references public.galaxy_places(id) on delete set null,
 label text not null check(length(label)<=80), active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((kind='person' and target_person is not null) or (kind='place' and place_id is not null))
);
alter table public.galaxy_destinations enable row level security;
create policy destinations_read on public.galaxy_destinations for select to authenticated using(public.galaxy_person() is not null);
create policy destinations_write_own on public.galaxy_destinations for all to authenticated using(person=public.galaxy_person()) with check(person=public.galaxy_person());
revoke all on public.galaxy_destinations from anon,authenticated;
grant select,insert,update,delete on public.galaxy_destinations to authenticated;
create index galaxy_destinations_place_id_idx on public.galaxy_destinations(place_id);

create table public.galaxy_encounters (
 id bigint generated by default as identity primary key, started_at timestamptz not null, ended_at timestamptz,
 distance_m integer check(distance_m is null or distance_m>=0), created_by text not null check(created_by in ('0','1')), created_at timestamptz not null default now()
);
create unique index galaxy_encounters_open_idx on public.galaxy_encounters((ended_at is null)) where ended_at is null;
alter table public.galaxy_encounters enable row level security;
create policy encounters_read on public.galaxy_encounters for select to authenticated using(public.galaxy_person() is not null);
create policy encounters_insert on public.galaxy_encounters for insert to authenticated with check(created_by=public.galaxy_person());
create policy encounters_update on public.galaxy_encounters for update to authenticated using(public.galaxy_person() is not null) with check(public.galaxy_person() is not null);
revoke all on public.galaxy_encounters from anon,authenticated;
grant select,insert,update on public.galaxy_encounters to authenticated;
grant usage,select on sequence public.galaxy_encounters_id_seq to authenticated;

create table public.galaxy_devices (
 id uuid primary key default gen_random_uuid(), person text not null check(person in ('0','1')),
 name text not null check(length(name) between 1 and 80), token_hash text not null unique check(length(token_hash)=64),
 created_at timestamptz not null default now(), last_seen_at timestamptz, revoked_at timestamptz
);
create index galaxy_devices_person_idx on public.galaxy_devices(person,created_at desc);
alter table public.galaxy_devices enable row level security;
create policy devices_read_own on public.galaxy_devices for select to authenticated using(person=public.galaxy_person());
create policy devices_delete_own on public.galaxy_devices for delete to authenticated using(person=public.galaxy_person());
revoke all on public.galaxy_devices from anon,authenticated;
grant select,delete on public.galaxy_devices to authenticated;

alter table public.galaxy_location_history
 add constraint galaxy_location_history_source_device_fk foreign key(source_device_id) references public.galaxy_devices(id) on delete set null;

create table public.galaxy_device_pair_codes (
 code_hash text primary key check(length(code_hash)=64), person text not null check(person in ('0','1')),
 device_name text not null check(length(device_name) between 1 and 80), expires_at timestamptz not null,
 used_at timestamptz, created_at timestamptz not null default now()
);
alter table public.galaxy_device_pair_codes enable row level security;
revoke all on public.galaxy_device_pair_codes from anon,authenticated;

create or replace function public.galaxy_device_pair_start(device_name text default 'Android')
returns text language plpgsql security definer set search_path='' as $
declare p text := public.galaxy_person(); token text;
begin
 if p is null then raise exception 'No autorizado'; end if;
 if length(trim(device_name))<1 or length(device_name)>80 then raise exception 'Nombre de dispositivo no válido'; end if;
 delete from public.galaxy_device_pair_codes where person=p and (expires_at<now() or used_at is not null);
 token := upper(replace(gen_random_uuid()::text,'-','') || substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.galaxy_device_pair_codes(code_hash,person,device_name,expires_at)
 values(encode(extensions.digest(token,'sha256'),'hex'),p,trim(device_name),now()+interval '10 minutes');
 return token;
end $;
revoke all on function public.galaxy_device_pair_start(text) from public,anon;
grant execute on function public.galaxy_device_pair_start(text) to authenticated;

create table public.galaxy_device_place_presence (
 device_id uuid not null references public.galaxy_devices(id) on delete cascade,
 place_id bigint not null references public.galaxy_places(id) on delete cascade,
 entered_at timestamptz not null default now(), arrived boolean not null default false,
 primary key(device_id,place_id)
);
alter table public.galaxy_device_place_presence enable row level security;
revoke all on public.galaxy_device_place_presence from anon,authenticated;
create index galaxy_device_place_presence_place_id_idx on public.galaxy_device_place_presence(place_id);

create table public.galaxy_encounter_runtime (
 singleton boolean primary key default true check(singleton), near_since timestamptz
);
insert into public.galaxy_encounter_runtime(singleton,near_since) values(true,null) on conflict do nothing;
alter table public.galaxy_encounter_runtime enable row level security;
revoke all on public.galaxy_encounter_runtime from anon,authenticated;

-- Menor privilegio: RLS no protege TRUNCATE, por eso nunca se concede al cliente.
revoke truncate,references,trigger on public.galaxy_settings,public.galaxy_items from authenticated;
revoke delete,insert on public.galaxy_settings from authenticated;

commit;
