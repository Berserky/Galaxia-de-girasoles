
create or replace function public.galaxy_device_pair_start_for(
  target_person text,
  device_name text default 'Android'
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  caller_person text := public.galaxy_person();
  token text;
begin
  if caller_person is null then
    raise exception 'No autorizado';
  end if;

  if target_person not in ('0','1') then
    raise exception 'Perfil no válido';
  end if;

  if target_person <> caller_person and caller_person <> '0' then
    raise exception 'Solo el administrador puede vincular el teléfono de su pareja';
  end if;

  if length(trim(device_name)) < 1 or length(device_name) > 80 then
    raise exception 'Nombre de dispositivo no válido';
  end if;

  delete from public.galaxy_device_pair_codes
  where person = target_person
    and (expires_at < now() or used_at is not null);

  token := upper(
    replace(gen_random_uuid()::text,'-','') ||
    substr(replace(gen_random_uuid()::text,'-',''),1,8)
  );

  insert into public.galaxy_device_pair_codes(code_hash,person,device_name,expires_at)
  values(
    encode(extensions.digest(token,'sha256'),'hex'),
    target_person,
    trim(device_name),
    now() + interval '10 minutes'
  );

  return token;
end
$function$;

revoke all on function public.galaxy_device_pair_start_for(text,text) from public, anon;
grant execute on function public.galaxy_device_pair_start_for(text,text) to authenticated;
