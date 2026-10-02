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
 when 'gesture' then allowed:=array['gesture'];required:=allowed;
 when 'game' then allowed:=array['questionId','answer'];required:=allowed;
 when 'ritual' then allowed:=array['week','gratitude','need','plan'];required:=allowed;
 when 'sharednote' then allowed:=array['title','body'];required:=array['title'];
 when 'voice' then allowed:=array['title','body','audioPath','mime','referenceId'];required:=array['title','audioPath','mime'];
 else raise exception 'Tipo no válido'; end case;
 for key in select jsonb_object_keys(payload) loop
  if not key=any(allowed) or jsonb_typeof(payload->key)<>'string' then raise exception 'Campo no válido'; end if;
  val:=payload->>key;lim:=case key when 'title' then 120 when 'body' then case when entry_type='sharednote' then 10000 else 2000 end when 'gratitude' then 2000 when 'need' then 2000 when 'plan' then 2000 when 'audioPath' then 100 when 'referenceId' then 100 when 'week' then 10 else 100 end;
  if length(val)>lim then raise exception 'Contenido demasiado largo'; end if;
  payload:=jsonb_set(payload,array[key],to_jsonb(trim(val)));
 end loop;
 foreach key in array required loop
  if not payload?key or coalesce(length(trim(payload->>key)),0)=0 then raise exception 'Completa el contenido'; end if;
 end loop;
 if entry_type='gesture' and (payload->>'gesture') not in ('hug','kiss','miss') then raise exception 'Gesto no válido'; end if;
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
