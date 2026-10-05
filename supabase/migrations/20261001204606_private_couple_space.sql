-- Ejecutar una vez en el editor SQL de un proyecto Supabase FREE.
begin;
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
 if invitation.digest is null or invitation.expires<now() or invitation.digest<>encode(sha256(convert_to(token,'UTF8')),'hex') then raise exception 'La invitación no es válida o expiró'; end if;
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
 kind text not null check(kind in ('memory','song','event','plan','note')),
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
commit;

