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
create index if not exists galaxy_trip_points_created_idx on public.galaxy_trip_points(created_at desc);
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
create unique index galaxy_location_history_device_sample_uidx on public.galaxy_location_history(source_device_id,client_sample_id);
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
create policy destinations_insert_own on public.galaxy_destinations for insert to authenticated with check(person=public.galaxy_person());
create policy destinations_update_own on public.galaxy_destinations for update to authenticated using(person=public.galaxy_person()) with check(person=public.galaxy_person());
create policy destinations_delete_own on public.galaxy_destinations for delete to authenticated using(person=public.galaxy_person());
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
revoke all on public.galaxy_daily_questions from public,anon,authenticated;


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
 event_type text not null check(event_type in ('gesture','arrived_safe','nearby','capsule','note','reminder','chat_message','chat_sync','status_changed','mood_changed','daily_answer','goal_update','memory_shared','plan_update')),
 enabled boolean not null default false,
 updated_at timestamptz not null default now(),
 primary key(device_id,event_type)
);

create table if not exists public.galaxy_push_events (
 id uuid primary key default gen_random_uuid(),
 source_device_id uuid references public.galaxy_devices(id) on delete set null,
 source_person text not null check(source_person in ('0','1')),
 target_person text not null check(target_person in ('0','1')),
 event_type text not null check(event_type in ('gesture','arrived_safe','nearby','capsule','note','reminder','chat_message','chat_sync','status_changed','mood_changed','daily_answer','goal_update','memory_shared','plan_update')),
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


-- Mega Update 3.1 / Galaxy Chat Core 3.2 · private messenger + Notification Center
begin;

create sequence if not exists public.galaxy_chat_server_seq;

create table if not exists public.galaxy_chat_messages (
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null,
 sender_person text not null check(sender_person in ('0','1')),
 body text not null default '',
 reply_to uuid references public.galaxy_chat_messages(id) on delete set null,
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 server_seq bigint not null default nextval('public.galaxy_chat_server_seq'),
 client_created_at timestamptz not null default now(),
 server_received_at timestamptz not null default now(),
 sent_at timestamptz not null default now(),
 delivered_at timestamptz,
 read_at timestamptz,
 edited_at timestamptz,
 message_type text not null default 'text' check(message_type in ('text','photo','video','audio','file','location','song','link')),
 attachment jsonb not null default '{}'::jsonb,
 link_preview jsonb not null default '{}'::jsonb,
 unique(sender_person,client_id),
 constraint galaxy_chat_messages_body_check check (
   deleted_at is not null
   or (message_type='text' and length(trim(body)) between 1 and 4000)
   or (message_type<>'text' and length(body)<=4000)
 )
);
create unique index if not exists galaxy_chat_messages_server_seq_idx on public.galaxy_chat_messages(server_seq);
create index if not exists galaxy_chat_messages_created_idx on public.galaxy_chat_messages(created_at desc,id desc);
create index if not exists galaxy_chat_messages_sender_created_idx on public.galaxy_chat_messages(sender_person,created_at desc);
create index if not exists galaxy_chat_messages_sender_seq_idx on public.galaxy_chat_messages(sender_person,server_seq desc);
create index if not exists galaxy_chat_messages_type_seq_idx on public.galaxy_chat_messages(message_type,server_seq desc);
create index if not exists galaxy_chat_messages_reply_to_idx on public.galaxy_chat_messages(reply_to) where reply_to is not null;
create index if not exists galaxy_chat_messages_search_idx on public.galaxy_chat_messages using gin(to_tsvector('simple',coalesce(body,'')));

create table if not exists public.galaxy_chat_read_state (
 person text primary key check(person in ('0','1')),
 last_read_at timestamptz,
 last_read_message_id uuid references public.galaxy_chat_messages(id) on delete set null,
 updated_at timestamptz not null default now()
);
insert into public.galaxy_chat_read_state(person) values('0'),('1') on conflict(person) do nothing;
create index if not exists galaxy_chat_read_state_last_message_idx on public.galaxy_chat_read_state(last_read_message_id) where last_read_message_id is not null;

create table if not exists public.galaxy_chat_reactions (
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 person text not null check(person in ('0','1')),
 emoji text not null check(emoji in ('❤️','😂','🥹','😮','😢','👍')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(message_id,person)
);
create index if not exists galaxy_chat_reactions_message_idx on public.galaxy_chat_reactions(message_id);

create table if not exists public.galaxy_chat_hidden (
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 person text not null check(person in ('0','1')),
 hidden_at timestamptz not null default now(),
 primary key(message_id,person)
);

create table if not exists public.galaxy_chat_pins (
 message_id uuid primary key references public.galaxy_chat_messages(id) on delete cascade,
 pinned_by text not null check(pinned_by in ('0','1')),
 pinned_at timestamptz not null default now()
);
create index if not exists galaxy_chat_pins_time_idx on public.galaxy_chat_pins(pinned_at desc);

create table if not exists public.galaxy_chat_favorites (
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 person text not null check(person in ('0','1')),
 saved_at timestamptz not null default now(),
 primary key(message_id,person)
);
create index if not exists galaxy_chat_favorites_person_time_idx on public.galaxy_chat_favorites(person,saved_at desc);

create table if not exists public.galaxy_chat_edits (
 id bigint generated always as identity primary key,
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 editor_person text not null check(editor_person in ('0','1')),
 previous_body text not null check(length(previous_body)<=4000),
 edited_at timestamptz not null default now()
);
create index if not exists galaxy_chat_edits_message_time_idx on public.galaxy_chat_edits(message_id,edited_at desc);

create table if not exists public.galaxy_chat_attachments (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.galaxy_chat_messages(id) on delete cascade,
 kind text not null check(kind in ('photo','video','audio','file')),
 bucket text not null default 'galaxy-chat-media',
 path text not null,
 mime text not null,
 name text not null default '',
 size_bytes bigint not null default 0 check(size_bytes>=0),
 duration_ms bigint check(duration_ms is null or duration_ms>=0),
 width integer check(width is null or width>0),
 height integer check(height is null or height>0),
 thumbnail_path text,
 caption text not null default '' check(length(caption)<=1000),
 created_at timestamptz not null default now(),
 unique(message_id,path)
);
create index if not exists galaxy_chat_attachments_message_idx on public.galaxy_chat_attachments(message_id);

create table if not exists public.galaxy_chat_presence (
 person text primary key check(person in ('0','1')),
 state text not null default 'ONLINE' check(state in ('ONLINE','TYPING','RECORDING_AUDIO','UPLOADING_MEDIA')),
 last_active_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '45 seconds'),
 metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<=2048),
 updated_at timestamptz not null default now()
);
create index if not exists galaxy_chat_presence_expiry_idx on public.galaxy_chat_presence(expires_at);

create table if not exists public.galaxy_chat_metrics (
 id bigint generated always as identity primary key,
 message_id uuid references public.galaxy_chat_messages(id) on delete set null,
 event text not null check(length(event) between 2 and 40),
 send_latency_ms integer check(send_latency_ms is null or send_latency_ms>=0),
 server_latency_ms integer check(server_latency_ms is null or server_latency_ms>=0),
 delivery_latency_ms integer check(delivery_latency_ms is null or delivery_latency_ms>=0),
 retry_count integer not null default 0 check(retry_count between 0 and 100),
 failure_code text check(failure_code is null or length(failure_code)<=80),
 created_at timestamptz not null default now()
);
create index if not exists galaxy_chat_metrics_created_idx on public.galaxy_chat_metrics(created_at desc);
create index if not exists galaxy_chat_metrics_message_idx on public.galaxy_chat_metrics(message_id);

create table if not exists public.galaxy_notifications (
 id uuid primary key default gen_random_uuid(),
 target_person text not null check(target_person in ('0','1')),
 source_person text check(source_person is null or source_person in ('0','1')),
 event_type text not null check(length(event_type) between 2 and 64),
 title text not null check(length(title) between 1 and 120),
 body text not null default '' check(length(body)<=500),
 action text check(action is null or length(action)<=80),
 entity_type text check(entity_type is null or length(entity_type)<=80),
 entity_id text check(entity_id is null or length(entity_id)<=160),
 data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object' and octet_length(data::text)<=8192),
 push_event_id uuid unique references public.galaxy_push_events(id) on delete set null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index if not exists galaxy_notifications_target_created_idx on public.galaxy_notifications(target_person,created_at desc);
create index if not exists galaxy_notifications_target_unread_idx on public.galaxy_notifications(target_person,created_at desc) where read_at is null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('galaxy-chat-media','galaxy-chat-media',false,62914560,null)
on conflict(id) do update set
 public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=null;

alter table public.galaxy_chat_messages enable row level security;
alter table public.galaxy_chat_read_state enable row level security;
alter table public.galaxy_chat_reactions enable row level security;
alter table public.galaxy_chat_hidden enable row level security;
alter table public.galaxy_chat_pins enable row level security;
alter table public.galaxy_chat_favorites enable row level security;
alter table public.galaxy_chat_edits enable row level security;
alter table public.galaxy_chat_attachments enable row level security;
alter table public.galaxy_chat_presence enable row level security;
alter table public.galaxy_chat_metrics enable row level security;
alter table public.galaxy_notifications enable row level security;

revoke all on
 public.galaxy_chat_messages,public.galaxy_chat_read_state,public.galaxy_chat_reactions,
 public.galaxy_chat_hidden,public.galaxy_chat_pins,public.galaxy_chat_favorites,
 public.galaxy_chat_edits,public.galaxy_chat_attachments,public.galaxy_chat_presence,
 public.galaxy_chat_metrics,public.galaxy_notifications
from public,anon,authenticated;

grant select,insert,update,delete on
 public.galaxy_chat_messages,public.galaxy_chat_read_state,public.galaxy_chat_reactions,
 public.galaxy_chat_hidden,public.galaxy_chat_pins,public.galaxy_chat_favorites,
 public.galaxy_chat_edits,public.galaxy_chat_attachments,public.galaxy_chat_presence,
 public.galaxy_chat_metrics,public.galaxy_notifications
to service_role;
grant usage,select on sequence public.galaxy_chat_server_seq to service_role;

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


-- Mega Update 3.0 release hardening indexes.
create index if not exists galaxy_daily_questions_memory_id_idx on public.galaxy_daily_questions(memory_id) where memory_id is not null;
create index if not exists galaxy_push_events_source_device_id_idx on public.galaxy_push_events(source_device_id) where source_device_id is not null;
create index if not exists galaxy_context_events_source_device_id_idx on public.galaxy_context_events(source_device_id) where source_device_id is not null;
create index if not exists galaxy_context_sessions_place_id_idx on public.galaxy_context_sessions(place_id) where place_id is not null;

-- Galaxy Chat Universe 3.5.0
-- Native references bridge Chat with existing Nuestra Galaxia domains.
-- New Chat-native state is limited to polls and checklists.

alter table public.galaxy_chat_messages
 drop constraint if exists galaxy_chat_messages_message_type_check;

alter table public.galaxy_chat_messages
 add constraint galaxy_chat_messages_message_type_check
 check(message_type in (
  'text','photo','video','video_message','audio','file','location','song','link','sticker','gif','card'
 ));

create table if not exists public.galaxy_chat_entity_refs (
 message_id uuid primary key references public.galaxy_chat_messages(id) on delete cascade,
 card_type text not null check(card_type in (
  'MEMORY','PLAN','GOAL','PLACE','SONG','ETA','CHECK_IN','POLL','CHECKLIST','CAPSULE','DAILY_QUESTION','EVENT','STATUS'
 )),
 entity_kind text not null check(length(entity_kind) between 1 and 40),
 entity_id text not null check(length(entity_id) between 1 and 120),
 snapshot jsonb not null default '{}'::jsonb,
 created_by text not null check(created_by in ('0','1')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(jsonb_typeof(snapshot)='object')
);

create index if not exists galaxy_chat_entity_refs_entity_idx
 on public.galaxy_chat_entity_refs(card_type,entity_kind,entity_id);

create table if not exists public.galaxy_chat_polls (
 id uuid primary key default gen_random_uuid(),
 message_id uuid unique references public.galaxy_chat_messages(id) on delete set null,
 created_by text not null check(created_by in ('0','1')),
 question text not null check(length(trim(question)) between 1 and 500),
 allow_multiple boolean not null default false,
 closes_at timestamptz,
 closed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(closes_at is null or closes_at>created_at),
 check(closed_at is null or closed_at>=created_at)
);

create table if not exists public.galaxy_chat_poll_options (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.galaxy_chat_polls(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 240),
 position smallint not null check(position between 0 and 9),
 created_at timestamptz not null default now(),
 unique(poll_id,position),
 unique(poll_id,id)
);

create index if not exists galaxy_chat_poll_options_poll_idx
 on public.galaxy_chat_poll_options(poll_id,position);

create table if not exists public.galaxy_chat_poll_votes (
 poll_id uuid not null,
 option_id uuid not null,
 person text not null check(person in ('0','1')),
 voted_at timestamptz not null default now(),
 primary key(poll_id,option_id,person),
 constraint galaxy_chat_poll_votes_option_fkey
  foreign key(poll_id,option_id)
  references public.galaxy_chat_poll_options(poll_id,id)
  on delete cascade
);

create index if not exists galaxy_chat_poll_votes_person_idx
 on public.galaxy_chat_poll_votes(poll_id,person);

create or replace function public.galaxy_chat_poll_vote_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
 poll_row public.galaxy_chat_polls%rowtype;
begin
 select * into poll_row
 from public.galaxy_chat_polls
 where id=new.poll_id
 for update;

 if not found then
  raise exception 'Encuesta no disponible';
 end if;

 if poll_row.closed_at is not null or (poll_row.closes_at is not null and poll_row.closes_at<=now()) then
  raise exception 'La encuesta está cerrada';
 end if;

 if not poll_row.allow_multiple then
  delete from public.galaxy_chat_poll_votes
  where poll_id=new.poll_id and person=new.person and option_id<>new.option_id;
 end if;

 return new;
end;
$$;

drop trigger if exists galaxy_chat_poll_vote_guard_trigger on public.galaxy_chat_poll_votes;
create trigger galaxy_chat_poll_vote_guard_trigger
 before insert on public.galaxy_chat_poll_votes
 for each row execute function public.galaxy_chat_poll_vote_guard();

create table if not exists public.galaxy_chat_checklists (
 id uuid primary key default gen_random_uuid(),
 message_id uuid unique references public.galaxy_chat_messages(id) on delete set null,
 created_by text not null check(created_by in ('0','1')),
 title text not null check(length(trim(title)) between 1 and 300),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.galaxy_chat_checklist_items (
 id uuid primary key default gen_random_uuid(),
 checklist_id uuid not null references public.galaxy_chat_checklists(id) on delete cascade,
 label text not null check(length(trim(label)) between 1 and 300),
 position smallint not null check(position between 0 and 99),
 checked boolean not null default false,
 updated_by text check(updated_by is null or updated_by in ('0','1')),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(checklist_id,position)
);

create index if not exists galaxy_chat_checklist_items_list_idx
 on public.galaxy_chat_checklist_items(checklist_id,position);

alter table public.galaxy_chat_entity_refs enable row level security;
alter table public.galaxy_chat_polls enable row level security;
alter table public.galaxy_chat_poll_options enable row level security;
alter table public.galaxy_chat_poll_votes enable row level security;
alter table public.galaxy_chat_checklists enable row level security;
alter table public.galaxy_chat_checklist_items enable row level security;

revoke all on table public.galaxy_chat_entity_refs from public,anon,authenticated;
revoke all on table public.galaxy_chat_polls from public,anon,authenticated;
revoke all on table public.galaxy_chat_poll_options from public,anon,authenticated;
revoke all on table public.galaxy_chat_poll_votes from public,anon,authenticated;
revoke all on table public.galaxy_chat_checklists from public,anon,authenticated;
revoke all on table public.galaxy_chat_checklist_items from public,anon,authenticated;

grant select,insert,update,delete on table
 public.galaxy_chat_entity_refs,
 public.galaxy_chat_polls,
 public.galaxy_chat_poll_options,
 public.galaxy_chat_poll_votes,
 public.galaxy_chat_checklists,
 public.galaxy_chat_checklist_items
to service_role;

revoke all on function public.galaxy_chat_poll_vote_guard() from public,anon,authenticated;



-- Phase 0 Privacy Firewall — mirrors migration 20261004232942_qa_phase0_privacy_firewall.sql
begin;

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
  unlocked_for jsonb:=case when jsonb_typeof(capsule->'unlockedFor')='array' then capsule->'unlockedFor' else '[]'::jsonb end;
begin
  if viewer not in ('0','1') then return false; end if;
  if unlock_type='place' then
    return exists(select 1 from jsonb_array_elements_text(unlocked_for) value where value=viewer);
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

create or replace function public.galaxy_capsule_mark_place_unlocks(
  viewer text,
  at_time timestamptz default now()
) returns integer
language plpgsql volatile security definer
set search_path=''
as $$
declare
  loc public.galaxy_locations%rowtype;
  unlocked_count integer:=0;
begin
  if viewer not in ('0','1') then return 0; end if;
  select * into loc from public.galaxy_locations
  where person=viewer and sharing=true and latitude is not null and longitude is not null
    and updated_at>=at_time-interval '4 minutes'
  limit 1;
  if not found then return 0; end if;

  update public.galaxy_items i
  set data=jsonb_set(
    i.data,'{unlockedFor}',
    (case when jsonb_typeof(i.data->'unlockedFor')='array' then i.data->'unlockedFor' else '[]'::jsonb end)||jsonb_build_array(viewer),
    true
  )
  where i.kind='capsule'
    and coalesce(nullif(i.data->>'unlockType',''),nullif(i.data->>'unlock_type',''),'date')='place'
    and jsonb_typeof(i.data->'latitude')='number'
    and jsonb_typeof(i.data->'longitude')='number'
    and (i.data->>'latitude')::double precision between -90 and 90
    and (i.data->>'longitude')::double precision between -180 and 180
    and not exists(
      select 1 from jsonb_array_elements_text(
        case when jsonb_typeof(i.data->'unlockedFor')='array' then i.data->'unlockedFor' else '[]'::jsonb end
      ) value where value=viewer
    )
    and (
      6371000*2*asin(sqrt(least(1,greatest(0,
        power(sin(radians((loc.latitude-(i.data->>'latitude')::double precision)/2)),2)
        +cos(radians((i.data->>'latitude')::double precision))*cos(radians(loc.latitude))
        *power(sin(radians((loc.longitude-(i.data->>'longitude')::double precision)/2)),2)
      ))))
    ) <= greatest(50,least(1000,
      case when jsonb_typeof(i.data->'radius')='number' then coalesce((i.data->>'radius')::double precision,150) else 150 end
    ));
  get diagnostics unlocked_count=row_count;
  return unlocked_count;
end $$;
revoke all on function public.galaxy_capsule_mark_place_unlocks(text,timestamptz) from public,anon,authenticated;
grant execute on function public.galaxy_capsule_mark_place_unlocks(text,timestamptz) to service_role;

create or replace function public.galaxy_capsule_protect_unlock_state()
returns trigger
language plpgsql security invoker
set search_path=''
as $$
begin
  if new.kind='capsule' then
    if tg_op='INSERT' then
      new.data:=new.data-'unlockedFor'-'unlocked_for';
    elsif old.kind='capsule' and current_user<>'postgres' then
      new.data:=new.data-'unlockedFor'-'unlocked_for';
      if jsonb_typeof(old.data->'unlockedFor')='array' then
        new.data:=jsonb_set(new.data,'{unlockedFor}',old.data->'unlockedFor',true);
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.galaxy_capsule_protect_unlock_state() from public,anon,authenticated;

drop trigger if exists capsule_unlock_state_guard on public.galaxy_items;
create trigger capsule_unlock_state_guard
before insert or update on public.galaxy_items
for each row execute function public.galaxy_capsule_protect_unlock_state();

drop policy if exists items_read on public.galaxy_items;
create policy items_read on public.galaxy_items for select to authenticated
using(public.galaxy_person() is not null and (kind<>'capsule' or public.galaxy_capsule_unlocked(data,public.galaxy_person(),now())));

drop policy if exists items_update on public.galaxy_items;
create policy items_update on public.galaxy_items for update to authenticated
using(public.galaxy_person() is not null and (kind<>'capsule' or author=public.galaxy_person()))
with check(public.galaxy_person() is not null and (kind<>'capsule' or author=public.galaxy_person()));
drop policy if exists items_delete on public.galaxy_items;
create policy items_delete on public.galaxy_items for delete to authenticated
using(public.galaxy_person() is not null and (kind<>'capsule' or author=public.galaxy_person()));

create or replace function public.galaxy_capsule_object_access(bucket text,object_name text)
returns boolean
language plpgsql stable security definer
set search_path=''
as $$
declare viewer text:=public.galaxy_person();
begin
  if viewer not in ('0','1') or object_name is null or object_name='' then return false; end if;
  return not exists(
    select 1 from public.galaxy_items i
    where i.kind='capsule'
      and (((bucket='galaxy-photos') and i.data->>'photoPath'=object_name)
        or ((bucket='galaxy-voice') and i.data->>'audioPath'=object_name))
      and not public.galaxy_capsule_unlocked(i.data,viewer,now())
  );
end $$;
revoke all on function public.galaxy_capsule_object_access(text,text) from public,anon;
grant execute on function public.galaxy_capsule_object_access(text,text) to authenticated;

drop policy if exists galaxy_photos_read on storage.objects;
create policy galaxy_photos_read on storage.objects for select to authenticated
using(bucket_id='galaxy-photos' and public.galaxy_person() is not null and public.galaxy_capsule_object_access(bucket_id,name));
drop policy if exists galaxy_voice_read on storage.objects;
create policy galaxy_voice_read on storage.objects for select to authenticated
using(bucket_id='galaxy-voice' and public.galaxy_person() is not null and public.galaxy_capsule_object_access(bucket_id,name));

drop policy if exists locations_read on public.galaxy_locations;
create policy locations_read on public.galaxy_locations for select to authenticated
using(person=public.galaxy_person() or sharing=true);
drop policy if exists trip_points_read on public.galaxy_trip_points;
create policy trip_points_read on public.galaxy_trip_points for select to authenticated
using(person=public.galaxy_person() or exists(select 1 from public.galaxy_locations l where l.person=galaxy_trip_points.person and l.sharing=true));
drop policy if exists location_history_read on public.galaxy_location_history;
create policy location_history_read on public.galaxy_location_history for select to authenticated
using(person=public.galaxy_person() or exists(select 1 from public.galaxy_locations l where l.person=galaxy_location_history.person and l.sharing=true));
drop policy if exists trip_history_read on public.galaxy_trip_history;
create policy trip_history_read on public.galaxy_trip_history for select to authenticated
using(person=public.galaxy_person() or exists(select 1 from public.galaxy_locations l where l.person=galaxy_trip_history.person and l.sharing=true));

-- NG-QA-014: each chat Storage object belongs to one attachment claim only.
create unique index if not exists galaxy_chat_attachments_bucket_path_uidx
on public.galaxy_chat_attachments(bucket,path);

create unique index if not exists galaxy_chat_attachments_bucket_thumbnail_uidx
on public.galaxy_chat_attachments(bucket,thumbnail_path)
where thumbnail_path is not null and thumbnail_path<>'';

create or replace function public.galaxy_chat_attachment_path_guard()
returns trigger
language plpgsql security invoker
set search_path=''
as $chat_path_guard$
declare
  sender text;
  p text;
  claimed text[];
begin
  select m.sender_person into sender
  from public.galaxy_chat_messages m
  where m.id=new.message_id;

  if sender not in ('0','1') then raise exception 'Chat attachment message is invalid'; end if;
  if new.path is null or new.path='' or new.path not like sender||'/%' then raise exception 'Chat attachment path is not owned by sender'; end if;
  if new.thumbnail_path is not null and new.thumbnail_path<>'' and new.thumbnail_path not like sender||'/%' then raise exception 'Chat attachment thumbnail is not owned by sender'; end if;
  if new.thumbnail_path is not null and new.thumbnail_path=new.path then raise exception 'Chat attachment thumbnail cannot reuse primary path'; end if;

  select array_agg(x order by x) into claimed
  from (
    select distinct x
    from unnest(array[new.path,nullif(new.thumbnail_path,'')]) as u(x)
    where x is not null
  ) q;

  foreach p in array claimed loop
    perform pg_advisory_xact_lock(hashtextextended(new.bucket||chr(31)||p,0));
  end loop;

  if exists(
    select 1
    from public.galaxy_chat_attachments a
    where a.id is distinct from new.id
      and a.bucket=new.bucket
      and (a.path=any(claimed) or a.thumbnail_path=any(claimed))
  ) then
    raise exception 'Chat attachment Storage object is already claimed';
  end if;

  return new;
end $chat_path_guard$;
revoke all on function public.galaxy_chat_attachment_path_guard() from public,anon,authenticated;

drop trigger if exists galaxy_chat_attachment_path_guard_trigger on public.galaxy_chat_attachments;
create trigger galaxy_chat_attachment_path_guard_trigger
before insert or update of message_id,bucket,path,thumbnail_path on public.galaxy_chat_attachments
for each row execute function public.galaxy_chat_attachment_path_guard();

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
returns trigger language plpgsql security definer set search_path=''
as $$
declare payload jsonb:=to_jsonb(old); source_kind text:=tg_argv[0]; source_key text;
begin
  if source_kind='item' then source_kind:=payload->>'kind';source_key:=payload->>'id';
  elsif source_kind='bond' then
    if payload->>'type'='voice' then source_kind:='voice-transcript';
    elsif payload->>'type' in ('sharednote','ritual') then source_kind:=payload->>'type';
    else return old; end if;
    source_key:=payload->>'id';
  else source_key:=payload->>tg_argv[1];
  end if;
  if source_kind is null or source_key is null or source_key='' then return old; end if;
  insert into public.galaxy_intelligence_cleanup_queue(source_type,source_id,requested_at,attempts,last_error)
  values(source_kind,source_key,now(),0,null)
  on conflict(source_type,source_id) do update set requested_at=excluded.requested_at,attempts=0,last_error=null;
  return old;
end $$;
revoke all on function public.galaxy_intelligence_enqueue_source_cleanup() from public,anon,authenticated;

drop trigger if exists galaxy_intelligence_cleanup_item on public.galaxy_items;
create trigger galaxy_intelligence_cleanup_item after delete on public.galaxy_items for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('item','id');
drop trigger if exists galaxy_intelligence_cleanup_place on public.galaxy_places;
create trigger galaxy_intelligence_cleanup_place after delete on public.galaxy_places for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('place','id');
drop trigger if exists galaxy_intelligence_cleanup_trip on public.galaxy_trip_history;
create trigger galaxy_intelligence_cleanup_trip after delete on public.galaxy_trip_history for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('trip','id');
drop trigger if exists galaxy_intelligence_cleanup_goal on public.galaxy_goals;
create trigger galaxy_intelligence_cleanup_goal after delete on public.galaxy_goals for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('goal','id');
drop trigger if exists galaxy_intelligence_cleanup_bond on public.galaxy_bond;
create trigger galaxy_intelligence_cleanup_bond after delete on public.galaxy_bond for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('bond','id');
drop trigger if exists galaxy_intelligence_cleanup_voice_transcript on public.galaxy_voice_transcripts;
create trigger galaxy_intelligence_cleanup_voice_transcript after delete on public.galaxy_voice_transcripts for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('voice-transcript','bond_id');
drop trigger if exists galaxy_intelligence_cleanup_photo on public.galaxy_photo_context;
create trigger galaxy_intelligence_cleanup_photo after delete on public.galaxy_photo_context for each row execute function public.galaxy_intelligence_enqueue_source_cleanup('photo','path');

create or replace function public.galaxy_intelligence_reconcile_cleanup(batch_size integer default 100)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare q record; processed integer:=0; failed integer:=0; batch integer:=greatest(1,least(coalesce(batch_size,100),500));
begin
  for q in select source_type,source_id from public.galaxy_intelligence_cleanup_queue order by requested_at limit batch for update skip locked
  loop
    begin
      delete from public.galaxy_intelligence_documents where source_type=q.source_type and source_id=q.source_id;
      delete from public.galaxy_intelligence_cleanup_queue where source_type=q.source_type and source_id=q.source_id;
      processed:=processed+1;
    exception when others then
      update public.galaxy_intelligence_cleanup_queue set attempts=attempts+1,last_error=left(sqlerrm,300),requested_at=now()
      where source_type=q.source_type and source_id=q.source_id;
      failed:=failed+1;
    end;
  end loop;
  return jsonb_build_object('processed',processed,'failed',failed);
end $$;
revoke all on function public.galaxy_intelligence_reconcile_cleanup(integer) from public,anon,authenticated;
grant execute on function public.galaxy_intelligence_reconcile_cleanup(integer) to service_role;

insert into public.galaxy_intelligence_cleanup_queue(source_type,source_id)
select d.source_type,d.source_id from public.galaxy_intelligence_documents d
where
 (d.source_type in ('memory','song','event','plan','note','capsule','wish','journey') and not exists(select 1 from public.galaxy_items i where i.id::text=d.source_id and i.kind=d.source_type))
 or (d.source_type='place' and not exists(select 1 from public.galaxy_places p where p.id::text=d.source_id))
 or (d.source_type='trip' and not exists(select 1 from public.galaxy_trip_history t where t.id::text=d.source_id))
 or (d.source_type='goal' and not exists(select 1 from public.galaxy_goals g where g.id::text=d.source_id))
 or (d.source_type in ('sharednote','ritual') and not exists(select 1 from public.galaxy_bond b where b.id::text=d.source_id and b.type=d.source_type))
 or (d.source_type='voice-transcript' and not exists(select 1 from public.galaxy_voice_transcripts v where v.bond_id::text=d.source_id))
 or (d.source_type='photo' and not exists(select 1 from public.galaxy_photo_context p where p.path=d.source_id))
on conflict(source_type,source_id) do nothing;

commit;

-- Phase 2: Galaxy Chat Correctness
-- NG-QA-008: complete, cursor-based Chat search over the canonical message history.
-- NG-QA-009/010: transactional poll mutation and authoritative winner resolution.
-- NG-QA-011: serialized checklist mutations with monotonic aggregate versioning.


create or replace function public.galaxy_chat_search_page(
  p_person text,
  p_query text default '',
  p_sender text default 'all',
  p_type text default 'all',
  p_date date default null,
  p_before_seq bigint default null,
  p_limit integer default 80
)
returns setof public.galaxy_chat_messages
language sql
stable
security invoker
set search_path = ''
as $search$
  with args as (
    select
      case when p_person in ('0','1') then p_person else null end as person,
      lower(trim(coalesce(p_query,''))) as q,
      case when p_sender in ('all','me','partner') then p_sender else 'all' end as sender_filter,
      case when p_type in (
        'all','messages','photo','video','audio','file','link',
        'memories','plans','music','places','goals','polls','checklists',
        'capsules','events','eta','daily','status'
      ) then p_type else 'all' end as type_filter,
      greatest(1,least(coalesce(p_limit,80),101)) as page_limit
  )
  select m.*
  from public.galaxy_chat_messages m
  cross join args a
  where a.person is not null
    and m.deleted_at is null
    and not exists (
      select 1
      from public.galaxy_chat_hidden h
      where h.message_id=m.id and h.person=a.person
    )
    and coalesce(m.schedule_state,'sent')<>'cancelled'
    and (coalesce(m.schedule_state,'sent')<>'pending' or m.sender_person=a.person)
    and (m.expires_at is null or m.expires_at>now())
    and (p_before_seq is null or p_before_seq<=0 or m.server_seq<p_before_seq)
    and (
      a.sender_filter='all'
      or (a.sender_filter='me' and m.sender_person=a.person)
      or (a.sender_filter='partner' and m.sender_person<>a.person)
    )
    and (
      p_date is null
      or (m.created_at at time zone 'America/Bogota')::date=p_date
    )
    and (
      a.type_filter='all'
      or (a.type_filter='messages' and m.message_type<>'card')
      or (a.type_filter in ('photo','video','audio','file') and m.message_type=a.type_filter)
      or (
        a.type_filter='link'
        and (m.message_type='link' or coalesce(m.link_preview,'{}'::jsonb)<>'{}'::jsonb)
      )
      or (
        a.type_filter in (
          'memories','plans','music','places','goals','polls','checklists',
          'capsules','events','eta','daily','status'
        )
        and exists (
          select 1
          from public.galaxy_chat_entity_refs r
          where r.message_id=m.id
            and r.card_type=case a.type_filter
              when 'memories' then 'MEMORY'
              when 'plans' then 'PLAN'
              when 'music' then 'SONG'
              when 'places' then 'PLACE'
              when 'goals' then 'GOAL'
              when 'polls' then 'POLL'
              when 'checklists' then 'CHECKLIST'
              when 'capsules' then 'CAPSULE'
              when 'events' then 'EVENT'
              when 'eta' then 'ETA'
              when 'daily' then 'DAILY_QUESTION'
              when 'status' then 'STATUS'
            end
        )
      )
    )
    and (
      a.q=''
      or to_tsvector('simple',coalesce(m.body,'')) @@ plainto_tsquery('simple',a.q)
      or strpos(lower(coalesce(m.body,'')),a.q)>0
      or exists (
        select 1
        from public.galaxy_chat_entity_refs r
        where r.message_id=m.id
          and (
            (
              r.entity_kind<>'capsule'
              and strpos(lower(coalesce(r.snapshot::text,'')),a.q)>0
            )
            or (
              r.entity_kind in ('memory','plan','song','event')
              and exists (
                select 1
                from public.galaxy_items i
                where i.id::text=r.entity_id
                  and i.kind=r.entity_kind
                  and strpos(
                    lower(concat_ws(' ',
                      coalesce(i.data->>'title',''),
                      coalesce(i.data->>'body',''),
                      coalesce(i.data->>'artist',''),
                      coalesce(i.data->>'note','')
                    )),
                    a.q
                  )>0
              )
            )
            or (
              r.entity_kind='capsule'
              and exists (
                select 1
                from public.galaxy_items i
                where i.id::text=r.entity_id
                  and i.kind='capsule'
                  and strpos(lower(coalesce(i.data->>'title','')),a.q)>0
              )
            )
            or (
              r.entity_kind='goal'
              and exists (
                select 1
                from public.galaxy_goals g
                where g.id::text=r.entity_id
                  and strpos(lower(concat_ws(' ',coalesce(g.title,''),coalesce(g.description,''))),a.q)>0
              )
            )
            or (
              r.entity_kind='place'
              and exists (
                select 1
                from public.galaxy_places p
                where p.id::text=r.entity_id
                  and strpos(lower(concat_ws(' ',coalesce(p.name,''),coalesce(p.note,''))),a.q)>0
              )
            )
            or (
              r.entity_kind='poll'
              and exists (
                select 1
                from public.galaxy_chat_polls p
                where p.id::text=r.entity_id
                  and strpos(lower(coalesce(p.question,'')),a.q)>0
              )
            )
            or (
              r.entity_kind='checklist'
              and exists (
                select 1
                from public.galaxy_chat_checklists c
                where c.id::text=r.entity_id
                  and (
                    strpos(lower(coalesce(c.title,'')),a.q)>0
                    or exists (
                      select 1
                      from public.galaxy_chat_checklist_items ci
                      where ci.checklist_id=c.id
                        and strpos(lower(coalesce(ci.label,'')),a.q)>0
                    )
                  )
              )
            )
            or (
              r.entity_kind='context_session'
              and exists (
                select 1
                from public.galaxy_context_sessions cs
                where cs.id::text=r.entity_id
                  and strpos(lower(coalesce(cs.label,'')),a.q)>0
              )
            )
            or (
              r.entity_kind='status'
              and exists (
                select 1
                from public.galaxy_locations l
                where l.person=r.entity_id
                  and strpos(lower(coalesce(l.status,'')),a.q)>0
              )
            )
          )
      )
    )
  order by m.server_seq desc
  limit (select page_limit from args);
$search$;

create or replace function public.galaxy_chat_poll_mutate(
  p_poll_id uuid,
  p_person text,
  p_operation text,
  p_option_id uuid default null,
  p_selected boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $poll_mutate$
declare
  poll_row public.galaxy_chat_polls%rowtype;
  affected integer:=0;
  changed boolean:=false;
  effective_closed boolean:=false;
  stamp timestamptz:=clock_timestamp();
begin
  if p_person not in ('0','1') then
    raise exception 'Persona no válida';
  end if;

  select * into poll_row
  from public.galaxy_chat_polls
  where id=p_poll_id
  for update;

  if not found then
    raise exception 'Encuesta no disponible';
  end if;

  effective_closed:=poll_row.closed_at is not null
    or (poll_row.closes_at is not null and poll_row.closes_at<=stamp);

  if p_operation='close' then
    if poll_row.created_by<>p_person then
      raise exception 'Solo quien creó la encuesta puede cerrarla';
    end if;
    if poll_row.closed_at is null then
      update public.galaxy_chat_polls
      set closed_at=stamp,updated_at=stamp
      where id=p_poll_id;
      changed:=true;
      poll_row.closed_at:=stamp;
    end if;
    return jsonb_build_object(
      'changed',changed,
      'closed',true,
      'closedAt',poll_row.closed_at,
      'allowMultiple',poll_row.allow_multiple
    );
  end if;

  if p_operation<>'vote' then
    raise exception 'Operación de encuesta no válida';
  end if;

  if effective_closed then
    raise exception 'La encuesta está cerrada';
  end if;

  if p_option_id is null or not exists (
    select 1
    from public.galaxy_chat_poll_options o
    where o.id=p_option_id and o.poll_id=p_poll_id
  ) then
    raise exception 'Opción no disponible';
  end if;

  if coalesce(p_selected,true) then
    if not poll_row.allow_multiple then
      delete from public.galaxy_chat_poll_votes
      where poll_id=p_poll_id and person=p_person and option_id<>p_option_id;
      get diagnostics affected=row_count;
      changed:=affected>0;
    end if;

    insert into public.galaxy_chat_poll_votes(poll_id,option_id,person,voted_at)
    values(p_poll_id,p_option_id,p_person,stamp)
    on conflict(poll_id,option_id,person) do nothing;
    get diagnostics affected=row_count;
    changed:=changed or affected>0;
  else
    delete from public.galaxy_chat_poll_votes
    where poll_id=p_poll_id and option_id=p_option_id and person=p_person;
    get diagnostics affected=row_count;
    changed:=affected>0;
  end if;

  return jsonb_build_object(
    'changed',changed,
    'closed',false,
    'allowMultiple',poll_row.allow_multiple
  );
end;
$poll_mutate$;

create or replace function public.galaxy_chat_poll_winner(p_poll_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $poll_winner$
declare
  poll_row public.galaxy_chat_polls%rowtype;
  top_votes integer:=0;
  top_count integer:=0;
  winner_row record;
begin
  select * into poll_row
  from public.galaxy_chat_polls
  where id=p_poll_id;

  if not found then
    raise exception 'Encuesta no disponible';
  end if;

  if poll_row.closed_at is null
     and (poll_row.closes_at is null or poll_row.closes_at>now()) then
    raise exception 'La encuesta sigue abierta';
  end if;

  with counts as (
    select o.id,o.label,o.position,count(v.option_id)::integer as votes
    from public.galaxy_chat_poll_options o
    left join public.galaxy_chat_poll_votes v
      on v.poll_id=o.poll_id and v.option_id=o.id
    where o.poll_id=p_poll_id
    group by o.id,o.label,o.position
  )
  select coalesce(max(votes),0) into top_votes from counts;

  if top_votes=0 then
    return jsonb_build_object(
      'pollId',p_poll_id,
      'winner',null,
      'tie',false,
      'topVotes',0,
      'reason','no_votes'
    );
  end if;

  with counts as (
    select o.id,o.label,o.position,count(v.option_id)::integer as votes
    from public.galaxy_chat_poll_options o
    left join public.galaxy_chat_poll_votes v
      on v.poll_id=o.poll_id and v.option_id=o.id
    where o.poll_id=p_poll_id
    group by o.id,o.label,o.position
  )
  select count(*)::integer into top_count
  from counts
  where votes=top_votes;

  if top_count<>1 then
    return jsonb_build_object(
      'pollId',p_poll_id,
      'winner',null,
      'tie',true,
      'topVotes',top_votes,
      'reason','tie'
    );
  end if;

  with counts as (
    select o.id,o.label,o.position,count(v.option_id)::integer as votes
    from public.galaxy_chat_poll_options o
    left join public.galaxy_chat_poll_votes v
      on v.poll_id=o.poll_id and v.option_id=o.id
    where o.poll_id=p_poll_id
    group by o.id,o.label,o.position
  )
  select id,label,position,votes into winner_row
  from counts
  where votes=top_votes
  order by position,id
  limit 1;

  return jsonb_build_object(
    'pollId',p_poll_id,
    'winner',jsonb_build_object(
      'id',winner_row.id,
      'label',winner_row.label,
      'position',winner_row.position,
      'votes',winner_row.votes
    ),
    'tie',false,
    'topVotes',top_votes,
    'reason','winner'
  );
end;
$poll_winner$;

create or replace function public.galaxy_chat_checklist_set(
  p_checklist_id uuid,
  p_item_id uuid,
  p_person text,
  p_checked boolean,
  p_expected_item_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $checklist_set$
declare
  list_row public.galaxy_chat_checklists%rowtype;
  item_row public.galaxy_chat_checklist_items%rowtype;
  next_item_version integer;
  next_list_version integer;
  stamp timestamptz:=clock_timestamp();
begin
  if p_person not in ('0','1') then
    raise exception 'Persona no válida';
  end if;

  select * into list_row
  from public.galaxy_chat_checklists
  where id=p_checklist_id
  for update;

  if not found then
    raise exception 'Checklist no disponible';
  end if;

  select * into item_row
  from public.galaxy_chat_checklist_items
  where id=p_item_id and checklist_id=p_checklist_id
  for update;

  if not found then
    raise exception 'Elemento no disponible';
  end if;

  if item_row.checked=p_checked then
    return jsonb_build_object(
      'changed',false,
      'idempotent',true,
      'itemVersion',item_row.version,
      'checklistVersion',list_row.version
    );
  end if;

  if p_expected_item_version is null
     or p_expected_item_version<>item_row.version then
    raise exception 'La checklist cambió. Actualiza antes de intentarlo otra vez.';
  end if;

  update public.galaxy_chat_checklist_items
  set checked=p_checked,
      updated_by=p_person,
      version=version+1,
      updated_at=stamp
  where id=p_item_id
  returning version into next_item_version;

  update public.galaxy_chat_checklists
  set version=version+1,
      updated_at=stamp
  where id=p_checklist_id
  returning version into next_list_version;

  return jsonb_build_object(
    'changed',true,
    'idempotent',false,
    'itemVersion',next_item_version,
    'checklistVersion',next_list_version
  );
end;
$checklist_set$;

revoke all on function public.galaxy_chat_search_page(text,text,text,text,date,bigint,integer) from public,anon,authenticated;
revoke all on function public.galaxy_chat_poll_mutate(uuid,text,text,uuid,boolean) from public,anon,authenticated;
revoke all on function public.galaxy_chat_poll_winner(uuid) from public,anon,authenticated;
revoke all on function public.galaxy_chat_checklist_set(uuid,uuid,text,boolean,integer) from public,anon,authenticated;

grant execute on function public.galaxy_chat_search_page(text,text,text,text,date,bigint,integer) to service_role;
grant execute on function public.galaxy_chat_poll_mutate(uuid,text,text,uuid,boolean) to service_role;
grant execute on function public.galaxy_chat_poll_winner(uuid) to service_role;
grant execute on function public.galaxy_chat_checklist_set(uuid,uuid,text,boolean,integer) to service_role;
