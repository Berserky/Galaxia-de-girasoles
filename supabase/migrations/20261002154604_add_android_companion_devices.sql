create extension if not exists pgcrypto;

create table public.galaxy_devices (
 id uuid primary key default gen_random_uuid(),
 person text not null check(person in ('0','1')),
 name text not null check(length(name) between 1 and 80),
 token_hash text not null unique check(length(token_hash)=64),
 created_at timestamptz not null default now(),
 last_seen_at timestamptz,
 revoked_at timestamptz
);
create index galaxy_devices_person_idx on public.galaxy_devices(person,created_at desc);
alter table public.galaxy_devices enable row level security;
create policy devices_read_own on public.galaxy_devices for select to authenticated using(person=public.galaxy_person());
create policy devices_delete_own on public.galaxy_devices for delete to authenticated using(person=public.galaxy_person());
revoke all on public.galaxy_devices from anon,authenticated;
grant select,delete on public.galaxy_devices to authenticated;

create table public.galaxy_device_pair_codes (
 code_hash text primary key check(length(code_hash)=64),
 person text not null check(person in ('0','1')),
 device_name text not null check(length(device_name) between 1 and 80),
 expires_at timestamptz not null,
 used_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.galaxy_device_pair_codes enable row level security;
revoke all on public.galaxy_device_pair_codes from anon,authenticated;

create or replace function public.galaxy_device_pair_start(device_name text default 'Android')
returns text language plpgsql security definer set search_path='' as $$
declare
 p text := public.galaxy_person();
 token text;
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

create table public.galaxy_device_place_presence (
 device_id uuid not null references public.galaxy_devices(id) on delete cascade,
 place_id bigint not null references public.galaxy_places(id) on delete cascade,
 entered_at timestamptz not null default now(),
 arrived boolean not null default false,
 primary key(device_id,place_id)
);
alter table public.galaxy_device_place_presence enable row level security;
revoke all on public.galaxy_device_place_presence from anon,authenticated;

create table public.galaxy_encounter_runtime (
 singleton boolean primary key default true check(singleton),
 near_since timestamptz
);
insert into public.galaxy_encounter_runtime(singleton,near_since) values(true,null) on conflict do nothing;
alter table public.galaxy_encounter_runtime enable row level security;
revoke all on public.galaxy_encounter_runtime from anon,authenticated;