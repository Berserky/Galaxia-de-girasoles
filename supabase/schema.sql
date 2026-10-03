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
returns text language plpgsql security definer set search_path='' as $$
declare p text := public.galaxy_person(); token text;
begin
 if p is null then raise exception 'No autorizado'; end if;
 if length(trim(device_name))<1 or length(device_name)>80 then raise exception 'Nombre de dispositivo no válido'; end if;
 delete from public.galaxy_device_pair_codes where person=p and (expires_at<now() or used_at is not null);
 token := upper(replace(gen_random_uuid()::text,'-','') || substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.galaxy_device_pair_codes(code_hash,person,device_name,expires_at)
 values(encode(extensions.digest(token,'sha256'),'hex'),p,trim(device_name),now()+interval '10 minutes');
 return token;
end $$;
revoke all on function public.galaxy_device_pair_start(text) from public,anon;
grant execute on function public.galaxy_device_pair_start(text) to authenticated;

create or replace function public.galaxy_device_pair_start_for(target_person text, device_name text default 'Android')
returns text language plpgsql security definer set search_path=''
as $$
declare
 caller_person text := public.galaxy_person();
 token text;
begin
 if caller_person is null then raise exception 'No autorizado'; end if;
 if target_person not in ('0','1') then raise exception 'Perfil no válido'; end if;
 if target_person<>caller_person and caller_person<>'0' then raise exception 'Solo el administrador puede vincular el teléfono de su pareja'; end if;
 if length(trim(device_name))<1 or length(device_name)>80 then raise exception 'Nombre de dispositivo no válido'; end if;
 delete from public.galaxy_device_pair_codes where person=target_person and (expires_at<now() or used_at is not null);
 token := upper(replace(gen_random_uuid()::text,'-','') || substr(replace(gen_random_uuid()::text,'-',''),1,8));
 insert into public.galaxy_device_pair_codes(code_hash,person,device_name,expires_at)
 values(encode(extensions.digest(token,'sha256'),'hex'),target_person,trim(device_name),now()+interval '10 minutes');
 return token;
end $$;
revoke all on function public.galaxy_device_pair_start_for(text,text) from public,anon;
grant execute on function public.galaxy_device_pair_start_for(text,text) to authenticated;

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

-- Momentos para dos. Additive, repeatable migration; RPCs enforce membership.
create table if not exists public.galaxy_bond (
 id uuid primary key default gen_random_uuid(), type text not null check(type in ('gesture','game','ritual','sharednote','voice')),
 author text not null check(author in ('0','1')), version integer not null default 1 check(version>0),
 created timestamptz not null default now(), data jsonb not null check(jsonb_typeof(data)='object')
);
create index if not exists galaxy_bond_created_idx on public.galaxy_bond(created desc);
create unique index if not exists galaxy_bond_ritual_week_idx on public.galaxy_bond(author,(data->>'week')) where type='ritual';
create table if not exists public.galaxy_bond_config(id integer primary key check(id=1),photo_path text not null default '');
insert into public.galaxy_bond_config(id) values(1) on conflict do nothing;
create table if not exists public.galaxy_bond_participation(day date not null,person text not null check(person in ('0','1')),primary key(day,person));
alter table public.galaxy_bond enable row level security;
alter table public.galaxy_bond_config enable row level security;
alter table public.galaxy_bond_participation enable row level security;
revoke all on public.galaxy_bond,public.galaxy_bond_config,public.galaxy_bond_participation from public,anon,authenticated;
-- Preserve earned garden days even when a moment, daily response or item is removed.
insert into public.galaxy_bond_participation(day,person)
 select (created at time zone 'America/Bogota')::date,author from public.galaxy_items
 union select day,person from public.galaxy_daily where mood is not null or answer is not null
 union select (created at time zone 'America/Bogota')::date,author from public.galaxy_bond
 on conflict do nothing;

create or replace function public.galaxy_bond_options(question_id text) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select case question_id
 when 'comfort' then '["Un abrazo","Hablar de todo","Un rato de calma","Algo rico"]'::jsonb
 when 'date' then '["Película en casa","Paseo al aire libre","Cocinar juntos","Descubrir un café"]'::jsonb
 when 'love' then '["Palabras bonitas","Tiempo juntos","Una sorpresa","Ayuda con algo"]'::jsonb
 when 'travel' then '["La playa","La montaña","Una ciudad nueva","Una cabaña"]'::jsonb
 when 'morning' then '["Dormir un poco más","Desayunar juntos","Salir a caminar","Música y café"]'::jsonb
 when 'memory' then '["Nuestro primer encuentro","Un viaje juntos","Una conversación","Un abrazo especial"]'::jsonb
 else null end
$$;
create or replace function public.galaxy_bond_validate(entry_type text,payload jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare allowed text[]; required text[]; key text; val text; lim integer; parsed date;
begin
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Datos no válidos'; end if;
 case entry_type
 when 'gesture' then allowed:=array['gesture','gestureId','name','icon','text','behavior'];required:=array['gesture'];
 when 'game' then allowed:=array['questionId','answer'];required:=allowed;
 when 'ritual' then allowed:=array['week','gratitude','need','plan'];required:=allowed;
 when 'sharednote' then allowed:=array['title','body'];required:=array['title'];
 when 'voice' then allowed:=array['title','body','audioPath','mime','referenceId'];required:=array['title','audioPath','mime'];
 else raise exception 'Tipo no válido'; end case;
 for key in select jsonb_object_keys(payload) loop
  if not key=any(allowed) or jsonb_typeof(payload->key)<>'string' then raise exception 'Campo no válido'; end if;
  val:=payload->>key;lim:=case key when 'title' then 120 when 'body' then case when entry_type='sharednote' then 10000 else 2000 end when 'gratitude' then 2000 when 'need' then 2000 when 'plan' then 2000 when 'audioPath' then 100 when 'referenceId' then 100 when 'week' then 10 when 'gesture' then 80 when 'gestureId' then 80 when 'name' then 40 when 'icon' then 40 when 'behavior' then 30 else 180 end;
  if length(val)>lim then raise exception 'Contenido demasiado largo'; end if;
  payload:=jsonb_set(payload,array[key],to_jsonb(trim(val)));
 end loop;
 foreach key in array required loop
  if not payload?key or coalesce(length(trim(payload->>key)),0)=0 then raise exception 'Completa el contenido'; end if;
 end loop;
 if entry_type='gesture' and (payload->>'gesture') not in ('hug','kiss','miss','tap') and (payload->>'gesture') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Gesto no válido'; end if;
 if entry_type='gesture' and payload?'behavior' and (payload->>'behavior') not in ('message','haptic','message_haptic') then raise exception 'Comportamiento no válido'; end if;
 if entry_type='game' and (public.galaxy_bond_options(payload->>'questionId') is null or not public.galaxy_bond_options(payload->>'questionId') ? (payload->>'answer')) then raise exception 'Respuesta no válida'; end if;
 if entry_type='ritual' then
  if (payload->>'week') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Semana no válida'; end if;
  parsed:=(payload->>'week')::date;
  if extract(isodow from parsed)<>1 or to_char(parsed,'YYYY-MM-DD')<>payload->>'week' then raise exception 'Elige el lunes de la semana'; end if;
 end if;
 if entry_type='voice' and ((payload->>'audioPath') !~ '^[01]/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|ogg|webm|m4a)$' or (payload->>'mime') not in ('audio/mpeg','audio/ogg','audio/webm','audio/mp4')) then raise exception 'Audio no válido'; end if;
 if entry_type in ('voice','sharednote') and not payload?'body' then payload:=payload||'{"body":""}'::jsonb;end if;
 return payload;
end $$;

create or replace function public.galaxy_bond_record_participation() returns trigger
language plpgsql security definer set search_path='' as $$
declare participant text; participation_day date;
begin
 if tg_table_name='galaxy_daily' then
  if new.mood is null and new.answer is null then return new;end if;
  participant:=new.person;participation_day:=new.day;
 else participant:=case when tg_op='INSERT' then new.author else coalesce(public.galaxy_person(),new.author) end;
  participation_day:=case when tg_op='INSERT' then (new.created at time zone 'America/Bogota')::date else (now() at time zone 'America/Bogota')::date end;
 end if;
 insert into public.galaxy_bond_participation(day,person) values(participation_day,participant) on conflict do nothing;return new;
end $$;
drop trigger if exists galaxy_bond_participation_trigger on public.galaxy_bond;
create trigger galaxy_bond_participation_trigger after insert or update on public.galaxy_bond for each row execute function public.galaxy_bond_record_participation();
drop trigger if exists galaxy_items_participation_trigger on public.galaxy_items;
create trigger galaxy_items_participation_trigger after insert or update on public.galaxy_items for each row execute function public.galaxy_bond_record_participation();
drop trigger if exists galaxy_daily_participation_trigger on public.galaxy_daily;
create trigger galaxy_daily_participation_trigger after insert or update on public.galaxy_daily for each row execute function public.galaxy_bond_record_participation();

create or replace function public.galaxy_bond_read() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare p text:=public.galaxy_person(); days integer; entries jsonb; photo text;
begin
 if p is null then raise exception 'No autorizado'; end if;
 select count(*) into days from (select day from public.galaxy_bond_participation group by day having count(distinct person)=2) earned;
 select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'type',b.type,'author',b.author,'version',b.version,'created',b.created,'data',case when b.type='game' and b.author<>p and not b.data?'guess' then b.data-'answer' else b.data end) order by b.created desc,b.id),'[]'::jsonb) into entries from public.galaxy_bond b;
 select photo_path into photo from public.galaxy_bond_config where id=1;
 return jsonb_build_object('entries',entries,'garden',jsonb_build_object('days',days,'stage',case when days>=30 then 4 when days>=14 then 3 when days>=7 then 2 when days>=1 then 1 else 0 end),'widget',jsonb_build_object('photoPath',coalesce(photo,'')));
end $$;
create or replace function public.galaxy_bond_save(entry_type text,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); row public.galaxy_bond; item public.galaxy_items; object_meta jsonb;
begin
 if p is null then raise exception 'No autorizado'; end if;
 payload:=public.galaxy_bond_validate(entry_type,payload);
 -- Serialize per profile so concurrent saves cannot exceed the gesture rate limit.
 perform pg_advisory_xact_lock(hashtext('galaxy-bond-'||p));
 if entry_type='gesture' and (select count(*) from public.galaxy_bond where author=p and type='gesture' and created>now()-interval '1 minute')>=20 then raise exception 'Espera antes de enviar otro gesto';end if;
 if entry_type='ritual' and exists(select 1 from public.galaxy_bond where author=p and type='ritual' and data->>'week'=payload->>'week') then raise exception 'Ya guardaste el ritual de esta semana';end if;
 if entry_type='voice' then
  if split_part(payload->>'audioPath','/',1)<>p then raise exception 'El audio no pertenece a tu perfil';end if;
  select metadata into object_meta from storage.objects where bucket_id='galaxy-voice' and name=payload->>'audioPath';
  if object_meta is null or object_meta->>'mimetype'<>payload->>'mime' or coalesce((object_meta->>'size')::bigint,0) not between 1 and 5242880 then raise exception 'Audio no encontrado o no válido';end if;
  if payload?'referenceId' and payload->>'referenceId'<>'' then
   select * into item from public.galaxy_items where id::text=payload->>'referenceId' and kind in ('memory','song','capsule');
   if not found then raise exception 'Referencia no válida';end if;
   if item.kind='capsule' and coalesce(item.data->>'date','')>to_char(now() at time zone 'America/Bogota','YYYY-MM-DD') then raise exception 'La cápsula aún está cerrada';end if;
  end if;
 end if;
 insert into public.galaxy_bond(type,author,data) values(entry_type,p,payload) returning * into row;return to_jsonb(row);
end $$;
create or replace function public.galaxy_bond_update(entry_id uuid,expected_version integer,payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); row public.galaxy_bond;
begin
 if p is null then raise exception 'No autorizado';end if;
 select * into row from public.galaxy_bond where id=entry_id for update;if not found then raise exception 'El momento ya no existe';end if;
 if row.type not in ('sharednote','ritual') or (row.type='ritual' and row.author<>p) then raise exception 'No puedes editar este momento';end if;
 if expected_version is null or row.version<>expected_version then raise exception 'Cambió en otro dispositivo. Actualiza antes de guardar';end if;
 payload:=public.galaxy_bond_validate(row.type,payload);
 if row.type='ritual' and payload->>'week'<>row.data->>'week' then raise exception 'La semana no se puede cambiar';end if;
 update public.galaxy_bond set data=payload,version=version+1 where id=entry_id returning * into row;return to_jsonb(row);
end $$;
create or replace function public.galaxy_bond_guess(entry_id uuid,guess_value text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); row public.galaxy_bond;
begin
 if p is null then raise exception 'No autorizado';end if;
 select * into row from public.galaxy_bond where id=entry_id for update;if not found then raise exception 'El momento ya no existe';end if;
 if row.type<>'game' or row.author=p then raise exception 'Solo tu pareja puede adivinar';end if;
 if row.data?'guess' then raise exception 'La respuesta ya fue adivinada';end if;
 if guess_value is null or not public.galaxy_bond_options(row.data->>'questionId')?guess_value then raise exception 'Respuesta no válida';end if;
 update public.galaxy_bond set data=data||jsonb_build_object('guess',guess_value,'correct',guess_value=data->>'answer'),version=version+1 where id=entry_id returning * into row;return to_jsonb(row);
end $$;
create or replace function public.galaxy_bond_delete(entry_id uuid,expected_version integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); row public.galaxy_bond;
begin
 if p is null then raise exception 'No autorizado';end if;
 select * into row from public.galaxy_bond where id=entry_id for update;if not found then raise exception 'El momento ya no existe';end if;
 if row.type<>'sharednote' and row.author<>p then raise exception 'Solo su autor puede eliminar este momento';end if;
 if expected_version is null or row.version<>expected_version then raise exception 'Cambió en otro dispositivo. Actualiza antes de borrar';end if;
 delete from public.galaxy_bond where id=entry_id;return '{"ok":true}'::jsonb;
end $$;
create or replace function public.galaxy_bond_widget(photo_path text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if public.galaxy_person() is null then raise exception 'No autorizado';end if;
 if photo_path is null or length(photo_path)>300 or (photo_path<>'' and not exists(select 1 from storage.objects o where o.bucket_id='galaxy-photos' and o.name=photo_path and o.metadata->>'mimetype' in ('image/jpeg','image/png','image/webp'))) then raise exception 'Elige una foto de su álbum';end if;
 update public.galaxy_bond_config set photo_path=galaxy_bond_widget.photo_path where id=1;return jsonb_build_object('photoPath',photo_path);
end $$;
revoke all on function public.galaxy_bond_options(text),public.galaxy_bond_validate(text,jsonb),public.galaxy_bond_record_participation() from public,anon,authenticated;
revoke all on function public.galaxy_bond_read(),public.galaxy_bond_save(text,jsonb),public.galaxy_bond_update(uuid,integer,jsonb),public.galaxy_bond_guess(uuid,text),public.galaxy_bond_delete(uuid,integer),public.galaxy_bond_widget(text) from public,anon;
grant execute on function public.galaxy_bond_read(),public.galaxy_bond_save(text,jsonb),public.galaxy_bond_update(uuid,integer,jsonb),public.galaxy_bond_guess(uuid,text),public.galaxy_bond_delete(uuid,integer),public.galaxy_bond_widget(text) to authenticated;

-- Edge service checks the encrypted device token and revocation before calling.
create or replace function public.galaxy_bond_gesture_device(person_value text,gesture_value text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.galaxy_bond; payload jsonb;
begin
 if person_value is null or person_value not in ('0','1') or not exists(select 1 from public.galaxy_members where person=person_value) then raise exception 'Dispositivo no válido';end if;
 payload:=public.galaxy_bond_validate('gesture',jsonb_build_object('gesture',gesture_value));
 perform pg_advisory_xact_lock(hashtext('galaxy-bond-'||person_value));
 if (select count(*) from public.galaxy_bond where author=person_value and type='gesture' and created>now()-interval '1 minute')>=20 then raise exception 'Espera antes de enviar otro gesto';end if;
 insert into public.galaxy_bond(type,author,data) values('gesture',person_value,payload) returning * into row;return to_jsonb(row);
end $$;
revoke all on function public.galaxy_bond_gesture_device(text,text) from public,anon,authenticated;
grant execute on function public.galaxy_bond_gesture_device(text,text) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('galaxy-voice','galaxy-voice',false,5242880,array['audio/mpeg','audio/ogg','audio/webm','audio/mp4'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists galaxy_voice_read on storage.objects;
create policy galaxy_voice_read on storage.objects for select to authenticated using(bucket_id='galaxy-voice' and public.galaxy_person() is not null);
drop policy if exists galaxy_voice_add on storage.objects;
create policy galaxy_voice_add on storage.objects for insert to authenticated with check(bucket_id='galaxy-voice' and public.galaxy_person() is not null and name ~ '^[01]/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|ogg|webm|m4a)$' and split_part(name,'/',1)=public.galaxy_person());
drop policy if exists galaxy_voice_delete on storage.objects;
create policy galaxy_voice_delete on storage.objects for delete to authenticated using(bucket_id='galaxy-voice' and public.galaxy_person() is not null and split_part(name,'/',1)=public.galaxy_person());

commit;


-- Galaxy Date Engine 3.0: stable daily-question assignment metadata.
-- Answers remain exclusively in galaxy_daily and keep the existing reveal rules.
create table if not exists public.galaxy_daily_questions (
 day date primary key,
 question_id text not null check(length(question_id) between 1 and 80),
 deck text not null check(length(deck) between 1 and 40),
 context_kind text not null default 'daily' check(length(context_kind) between 1 and 40),
 favorite boolean not null default false,
 memory_id uuid references public.galaxy_items(id) on delete set null,
 created_at timestamptz not null default now()
);
create index if not exists galaxy_daily_questions_created_idx on public.galaxy_daily_questions(created_at desc);
alter table public.galaxy_daily_questions enable row level security;


-- Mega Update 3.0 · Galaxy Goals Engine
-- Goals are relational. Plans and wishes remain in galaxy_items.
begin;

create table if not exists public.galaxy_goals (
 id uuid primary key default gen_random_uuid(),
 kind text not null default 'goal' check(kind in ('goal','savings')),
 title text not null check(length(title) between 1 and 160),
 description text not null default '' check(length(description)<=4000),
 category text not null default 'other' check(category in ('travel','home','learning','experience','project','wellbeing','other')),
 target_date date,
 status text not null default 'active' check(status in ('active','paused','completed','archived')),
 target_amount bigint check(target_amount is null or target_amount between 1 and 1000000000000),
 created_by text not null check(created_by in ('0','1')),
 version integer not null default 1 check(version>0),
 completed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((kind='savings' and target_amount is not null) or (kind='goal' and target_amount is null))
);

create table if not exists public.galaxy_goal_participants (
 goal_id uuid not null references public.galaxy_goals(id) on delete cascade,
 person text not null check(person in ('0','1')),
 created_at timestamptz not null default now(),
 primary key(goal_id,person)
);

create table if not exists public.galaxy_goal_steps (
 id uuid primary key default gen_random_uuid(),
 goal_id uuid not null references public.galaxy_goals(id) on delete cascade,
 title text not null check(length(title) between 1 and 300),
 position integer not null default 0 check(position>=0),
 completed_at timestamptz,
 completed_by text check(completed_by is null or completed_by in ('0','1')),
 created_at timestamptz not null default now()
);

create table if not exists public.galaxy_goal_links (
 id uuid primary key default gen_random_uuid(),
 goal_id uuid not null references public.galaxy_goals(id) on delete cascade,
 item_id uuid not null references public.galaxy_items(id) on delete cascade,
 relation text not null check(relation in ('note','memory','plan','source-plan','source-wish')),
 created_at timestamptz not null default now(),
 unique(goal_id,item_id,relation)
);

create table if not exists public.galaxy_goal_contributions (
 id uuid primary key default gen_random_uuid(),
 goal_id uuid not null references public.galaxy_goals(id) on delete cascade,
 amount bigint not null check(amount between 1 and 1000000000000),
 contribution_date date not null,
 note text check(note is null or length(note)<=300),
 contributor text not null check(contributor in ('0','1')),
 created_at timestamptz not null default now()
);

create index if not exists galaxy_goals_status_idx on public.galaxy_goals(status,updated_at desc);
create index if not exists galaxy_goals_target_date_idx on public.galaxy_goals(target_date) where target_date is not null;
create index if not exists galaxy_goal_steps_goal_position_idx on public.galaxy_goal_steps(goal_id,position);
create index if not exists galaxy_goal_links_goal_idx on public.galaxy_goal_links(goal_id);
create index if not exists galaxy_goal_links_item_idx on public.galaxy_goal_links(item_id);
create index if not exists galaxy_goal_contributions_goal_date_idx on public.galaxy_goal_contributions(goal_id,contribution_date desc,created_at desc);

create or replace function public.galaxy_goal_version() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='UPDATE' then
  new.id:=old.id;
  new.created_by:=old.created_by;
  new.created_at:=old.created_at;
  new.version:=old.version+1;
 else
  new.version:=coalesce(new.version,1);
 end if;
 new.updated_at:=now();
 if new.status='completed' and new.completed_at is null then new.completed_at:=now(); end if;
 if new.status<>'completed' then new.completed_at:=null; end if;
 return new;
end $$;

drop trigger if exists goals_version on public.galaxy_goals;
create trigger goals_version before insert or update on public.galaxy_goals
for each row execute function public.galaxy_goal_version();

alter table public.galaxy_goals enable row level security;
alter table public.galaxy_goal_participants enable row level security;
alter table public.galaxy_goal_steps enable row level security;
alter table public.galaxy_goal_links enable row level security;
alter table public.galaxy_goal_contributions enable row level security;

revoke all on public.galaxy_goals,public.galaxy_goal_participants,public.galaxy_goal_steps,public.galaxy_goal_links,public.galaxy_goal_contributions from public,anon,authenticated;
grant select,insert,update,delete on public.galaxy_goals,public.galaxy_goal_participants,public.galaxy_goal_steps,public.galaxy_goal_links,public.galaxy_goal_contributions to service_role;

commit;


-- Mega Update 3.0 · Galaxy Bond Engine 2.0
-- Additive only: galaxy_bond_participation remains the durable source of all earned days.
begin;

create table if not exists public.galaxy_bond_gestures (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 40),
 icon text not null check(length(icon) between 1 and 40),
 text text not null check(length(text) between 1 and 180),
 behavior text not null check(behavior in ('message','haptic','message_haptic')),
 created_by text not null check(created_by in ('0','1')),
 enabled boolean not null default true,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists galaxy_bond_gestures_enabled_idx on public.galaxy_bond_gestures(enabled,created_at);

create or replace function public.galaxy_bond_gesture_version() returns trigger
language plpgsql set search_path='' as $$
begin
 new.id:=old.id;
 new.created_by:=old.created_by;
 new.created_at:=old.created_at;
 new.version:=old.version+1;
 new.updated_at:=now();
 return new;
end $$;
drop trigger if exists bond_gesture_version on public.galaxy_bond_gestures;
create trigger bond_gesture_version before update on public.galaxy_bond_gestures
for each row execute function public.galaxy_bond_gesture_version();

create table if not exists public.galaxy_push_tokens (
 device_id uuid primary key references public.galaxy_devices(id) on delete cascade,
 token text not null unique check(length(token) between 20 and 4096),
 platform text not null default 'android' check(platform='android'),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_push_subscriptions (
 device_id uuid not null references public.galaxy_devices(id) on delete cascade,
 event_type text not null check(event_type in ('gesture','arrived_safe','nearby','capsule','note','reminder')),
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(device_id,event_type)
);

create table if not exists public.galaxy_push_events (
 id uuid primary key default gen_random_uuid(),
 source_device_id uuid references public.galaxy_devices(id) on delete set null,
 source_person text not null check(source_person in ('0','1')),
 target_person text not null check(target_person in ('0','1')),
 event_type text not null check(event_type in ('gesture','arrived_safe','nearby','capsule','note','reminder')),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=4096),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '1 day')
);
create index if not exists galaxy_push_events_target_idx on public.galaxy_push_events(target_person,created_at desc);

create table if not exists public.galaxy_push_deliveries (
 event_id uuid not null references public.galaxy_push_events(id) on delete cascade,
 device_id uuid not null references public.galaxy_devices(id) on delete cascade,
 status text not null check(status in ('sent','skipped','failed','unregistered')),
 error_code text,
 attempted_at timestamptz not null default now(),
 primary key(event_id,device_id)
);
create index if not exists galaxy_push_deliveries_device_idx on public.galaxy_push_deliveries(device_id,attempted_at desc);

alter table public.galaxy_bond_gestures enable row level security;
alter table public.galaxy_push_tokens enable row level security;
alter table public.galaxy_push_subscriptions enable row level security;
alter table public.galaxy_push_events enable row level security;
alter table public.galaxy_push_deliveries enable row level security;

revoke all on public.galaxy_bond_gestures,public.galaxy_push_tokens,public.galaxy_push_subscriptions,public.galaxy_push_events,public.galaxy_push_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.galaxy_bond_gestures,public.galaxy_push_tokens,public.galaxy_push_subscriptions,public.galaxy_push_events,public.galaxy_push_deliveries to service_role;

commit;


-- Mega Update 3.0 · Galaxy Context Engine
-- Derived context is private server-side state. Raw GPS keeps its existing ownership/privacy model.
begin;

create table if not exists public.galaxy_context_state (
 singleton boolean primary key default true check(singleton),
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'),
 updated_at timestamptz not null default now()
);
insert into public.galaxy_context_state(singleton,data) values(true,'{}'::jsonb)
on conflict(singleton) do nothing;

create table if not exists public.galaxy_context_settings (
 person text primary key check(person in ('0','1')),
 near_enabled boolean not null default false,
 near_distance_m integer not null default 300 check(near_distance_m between 80 and 5000),
 near_cooldown_minutes integer not null default 60 check(near_cooldown_minutes between 5 and 1440),
 arrived_safe_enabled boolean not null default false,
 date_suggestions boolean not null default true,
 memory_suggestions boolean not null default true,
 shared_trip_detection boolean not null default false,
 updated_at timestamptz not null default now()
);
insert into public.galaxy_context_settings(person) values('0'),('1')
on conflict(person) do nothing;

create table if not exists public.galaxy_context_events (
 id uuid primary key default gen_random_uuid(),
 event_type text not null check(event_type in (
  'USER_NEAR_PARTNER','ENCOUNTER_STARTED','ENCOUNTER_ENDED','TRIP_STARTED','TRIP_ENDED',
  'PLACE_ENTERED','PLACE_LEFT','DESTINATION_REACHED','LONG_ENCOUNTER','SHARED_TRIP_DETECTED'
 )),
 dedupe_key text not null unique check(length(dedupe_key) between 8 and 240),
 person text check(person is null or person in ('0','1')),
 partner_person text check(partner_person is null or partner_person in ('0','1')),
 source_device_id uuid references public.galaxy_devices(id) on delete set null,
 occurred_at timestamptz not null,
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=8192),
 created_at timestamptz not null default now()
);
create index if not exists galaxy_context_events_type_time_idx on public.galaxy_context_events(event_type,occurred_at desc);
create index if not exists galaxy_context_events_person_time_idx on public.galaxy_context_events(person,occurred_at desc);

create table if not exists public.galaxy_context_sessions (
 id uuid primary key default gen_random_uuid(),
 person text not null check(person in ('0','1')),
 mode text not null check(mode in ('accompany','return_home')),
 destination_kind text not null check(destination_kind in ('person','place')),
 target_person text check(target_person is null or target_person in ('0','1')),
 place_id bigint references public.galaxy_places(id) on delete set null,
 label text not null check(length(label) between 1 and 80),
 status text not null default 'active' check(status in ('active','arrived','cancelled')),
 auto_finish boolean not null default true,
 started_at timestamptz not null default now(),
 ended_at timestamptz,
 arrived_at timestamptz,
 initial_distance_m integer check(initial_distance_m is null or initial_distance_m>=0),
 last_distance_m integer check(last_distance_m is null or last_distance_m>=0),
 last_eta_s integer check(last_eta_s is null or last_eta_s>=0),
 progress_pct integer not null default 0 check(progress_pct between 0 and 100),
 last_eta_sample_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check((destination_kind='person' and target_person is not null and target_person<>person) or (destination_kind='place' and place_id is not null))
);
create unique index if not exists galaxy_context_sessions_one_active_idx on public.galaxy_context_sessions(person) where status='active';
create index if not exists galaxy_context_sessions_time_idx on public.galaxy_context_sessions(started_at desc);

create table if not exists public.galaxy_context_eta_history (
 id bigint generated by default as identity primary key,
 session_id uuid not null references public.galaxy_context_sessions(id) on delete cascade,
 captured_at timestamptz not null default now(),
 distance_m integer not null check(distance_m>=0),
 eta_s integer check(eta_s is null or eta_s>=0),
 progress_pct integer not null default 0 check(progress_pct between 0 and 100)
);
create index if not exists galaxy_context_eta_history_session_time_idx on public.galaxy_context_eta_history(session_id,captured_at desc);

create table if not exists public.galaxy_context_suggestions (
 id uuid primary key default gen_random_uuid(),
 kind text not null check(kind in ('date','memory')),
 source_event_id uuid references public.galaxy_context_events(id) on delete cascade,
 person text not null check(person in ('0','1')),
 status text not null default 'pending' check(status in ('pending','accepted','dismissed')),
 payload jsonb not null default '{}'::jsonb check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=16384),
 created_at timestamptz not null default now(),
 resolved_at timestamptz
);
create unique index if not exists galaxy_context_suggestions_source_kind_person_idx on public.galaxy_context_suggestions(source_event_id,kind,person) where source_event_id is not null;
create index if not exists galaxy_context_suggestions_status_idx on public.galaxy_context_suggestions(status,created_at desc);

create table if not exists public.galaxy_shared_trips (
 id uuid primary key default gen_random_uuid(),
 source_event_id uuid unique references public.galaxy_context_events(id) on delete set null,
 started_at timestamptz not null,
 ended_at timestamptz,
 distance_m integer not null default 0 check(distance_m>=0),
 duration_s integer not null default 0 check(duration_s>=0),
 sample_count integer not null default 0 check(sample_count>=0),
 status text not null default 'detected' check(status in ('detected','ended')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists galaxy_shared_trips_time_idx on public.galaxy_shared_trips(started_at desc);

alter table public.galaxy_context_state enable row level security;
alter table public.galaxy_context_settings enable row level security;
alter table public.galaxy_context_events enable row level security;
alter table public.galaxy_context_sessions enable row level security;
alter table public.galaxy_context_eta_history enable row level security;
alter table public.galaxy_context_suggestions enable row level security;
alter table public.galaxy_shared_trips enable row level security;

revoke all on public.galaxy_context_state,public.galaxy_context_settings,public.galaxy_context_events,public.galaxy_context_sessions,public.galaxy_context_eta_history,public.galaxy_context_suggestions,public.galaxy_shared_trips from public,anon,authenticated;
grant select,insert,update,delete on public.galaxy_context_state,public.galaxy_context_settings,public.galaxy_context_events,public.galaxy_context_sessions,public.galaxy_context_eta_history,public.galaxy_context_suggestions,public.galaxy_shared_trips to service_role;
grant usage,select on sequence public.galaxy_context_eta_history_id_seq to service_role;

commit;


-- Mega Update 3.0 · Galaxy Intelligence Engine
-- Search projections only. Raw GPS coordinates and provider secrets never enter this index.
begin;

create extension if not exists vector with schema extensions;

create or replace function public.galaxy_search_normalize(value text)
returns text
language sql immutable parallel safe
set search_path=''
as $$
 select trim(regexp_replace(
   lower(translate(coalesce(value,''),
    'áéíóúüñÁÉÍÓÚÜÑ',
    'aeiouunAEIOUUN')),
   '[^a-z0-9]+',' ','g'))
$$;

create table if not exists public.galaxy_intelligence_documents (
 id uuid primary key default gen_random_uuid(),
 source_type text not null check(length(source_type) between 1 and 40),
 source_id text not null check(length(source_id) between 1 and 300),
 source_version text not null default '' check(length(source_version)<=160),
 title text not null default '' check(length(title)<=500),
 content text not null default '' check(length(content)<=20000),
 occurred_on date,
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=8192),
 owner_person text check(owner_person is null or owner_person in ('0','1')),
 visible_after date,
 searchable boolean not null default true,
 content_hash text not null check(length(content_hash) between 1 and 128),
 embedding extensions.vector(384),
 embedding_model text not null default 'gte-small' check(length(embedding_model)<=80),
 embedding_status text not null default 'pending' check(embedding_status in ('pending','ready','error','disabled')),
 embedding_error text check(embedding_error is null or length(embedding_error)<=300),
 search_vector tsvector generated always as (
   to_tsvector('simple',public.galaxy_search_normalize(title||' '||content))
 ) stored,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(source_type,source_id)
);
create index if not exists galaxy_intelligence_search_idx on public.galaxy_intelligence_documents using gin(search_vector);
create index if not exists galaxy_intelligence_embedding_hnsw_idx on public.galaxy_intelligence_documents using hnsw (embedding vector_cosine_ops);
create index if not exists galaxy_intelligence_source_idx on public.galaxy_intelligence_documents(source_type,source_id);
create index if not exists galaxy_intelligence_date_idx on public.galaxy_intelligence_documents(occurred_on desc);

create table if not exists public.galaxy_voice_transcripts (
 bond_id uuid primary key references public.galaxy_bond(id) on delete cascade,
 transcript text not null check(length(transcript)<=30000),
 segments jsonb not null default '[]'::jsonb check(jsonb_typeof(segments)='array' and octet_length(segments::text)<=50000),
 provider text not null check(length(provider)<=40),
 model text not null check(length(model)<=120),
 status text not null default 'ready' check(status in ('ready','error')),
 last_error text check(last_error is null or length(last_error)<=300),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_photo_context (
 path text primary key check(length(path) between 3 and 300),
 author text not null check(author in ('0','1')),
 caption text check(caption is null or length(caption)<=3000),
 context text check(context is null or length(context)<=5000),
 taken_on date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_intelligence_usage (
 day date not null,
 person text not null check(person in ('0','1')),
 operation text not null check(operation in ('ask','narrate','transcribe')),
 count integer not null default 0 check(count>=0),
 updated_at timestamptz not null default now(),
 primary key(day,person,operation)
);

alter table public.galaxy_intelligence_documents enable row level security;
alter table public.galaxy_voice_transcripts enable row level security;
alter table public.galaxy_photo_context enable row level security;
alter table public.galaxy_intelligence_usage enable row level security;

revoke all on public.galaxy_intelligence_documents,public.galaxy_voice_transcripts,public.galaxy_photo_context,public.galaxy_intelligence_usage from public,anon,authenticated;
grant select,insert,update,delete on public.galaxy_intelligence_documents,public.galaxy_voice_transcripts,public.galaxy_photo_context,public.galaxy_intelligence_usage to service_role;

create or replace function public.galaxy_intelligence_hybrid_search(
 query_text text,
 query_embedding extensions.vector(384),
 query_person text,
 match_count integer default 20
)
returns table(
 id uuid,
 source_type text,
 source_id text,
 title text,
 content text,
 occurred_on date,
 metadata jsonb,
 exact_rank bigint,
 fulltext_rank bigint,
 semantic_rank bigint,
 exact_score double precision,
 fulltext_score real,
 semantic_score double precision,
 final_score double precision
)
language sql stable security definer
set search_path=''
as $$
 with permitted as (
  select d.*,
   public.galaxy_search_normalize(query_text) q,
   plainto_tsquery('simple',public.galaxy_search_normalize(query_text)) tsq
  from public.galaxy_intelligence_documents d
  where d.searchable
    and (d.owner_person is null or d.owner_person=query_person)
    and (d.visible_after is null or d.visible_after <= (now() at time zone 'America/Bogota')::date or d.owner_person=query_person)
 ),
 exact as (
  select p.id,
   case
    when public.galaxy_search_normalize(p.title)=p.q then 1.0
    when public.galaxy_search_normalize(p.title) like p.q||'%' then 0.95
    when public.galaxy_search_normalize(p.title) like '%'||p.q||'%' then 0.9
    when public.galaxy_search_normalize(p.content) like '%'||p.q||'%' then 0.8
    else 0.0 end exact_score,
   row_number() over(order by
    case
     when public.galaxy_search_normalize(p.title)=p.q then 1.0
     when public.galaxy_search_normalize(p.title) like p.q||'%' then 0.95
     when public.galaxy_search_normalize(p.title) like '%'||p.q||'%' then 0.9
     else 0.8 end desc,
    p.occurred_on desc nulls last,p.id) exact_rank
  from permitted p
  where length(p.q)>0 and (
   public.galaxy_search_normalize(p.title) like '%'||p.q||'%'
   or public.galaxy_search_normalize(p.content) like '%'||p.q||'%')
  limit 100
 ),
 fulltext as (
  select p.id,ts_rank_cd(p.search_vector,p.tsq) fulltext_score,
   row_number() over(order by ts_rank_cd(p.search_vector,p.tsq) desc,p.occurred_on desc nulls last,p.id) fulltext_rank
  from permitted p
  where length(p.q)>0 and p.search_vector @@ p.tsq
  order by fulltext_score desc
  limit 100
 ),
 semantic as (
  select p.id,(1-(p.embedding OPERATOR(extensions.<=>) query_embedding))::double precision semantic_score,
   row_number() over(order by p.embedding OPERATOR(extensions.<=>) query_embedding,p.occurred_on desc nulls last,p.id) semantic_rank
  from permitted p
  where query_embedding is not null and p.embedding is not null and p.embedding_status='ready'
  order by p.embedding OPERATOR(extensions.<=>) query_embedding
  limit 100
 ),
 ids as (
  select exact.id from exact
  union select fulltext.id from fulltext
  union select semantic.id from semantic
 ),
 scored as (
  select p.id,p.source_type,p.source_id,p.title,p.content,p.occurred_on,p.metadata,
   e.exact_rank,f.fulltext_rank,s.semantic_rank,
   coalesce(e.exact_score,0)::double precision exact_score,
   coalesce(f.fulltext_score,0)::real fulltext_score,
   coalesce(s.semantic_score,0)::double precision semantic_score,
   (
    case when e.exact_rank is not null then 100 + e.exact_score*10 + 1.0/(50+e.exact_rank) else 0 end
    + case when f.fulltext_rank is not null then f.fulltext_score*2.5 + 1.0/(50+f.fulltext_rank) else 0 end
    + case when s.semantic_rank is not null then greatest(0,s.semantic_score) + 1.0/(50+s.semantic_rank) else 0 end
   )::double precision final_score
  from ids
  join permitted p using(id)
  left join exact e using(id)
  left join fulltext f using(id)
  left join semantic s using(id)
 )
 select * from scored
 order by final_score desc,occurred_on desc nulls last,id
 limit greatest(1,least(coalesce(match_count,20),100))
$$;

revoke all on function public.galaxy_intelligence_hybrid_search(text,extensions.vector,text,integer) from public,anon,authenticated;
grant execute on function public.galaxy_intelligence_hybrid_search(text,extensions.vector,text,integer) to service_role;

commit;
