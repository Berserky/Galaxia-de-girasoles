-- NG-AUD-005: authenticated users without galaxy membership must not be
-- authorized by the capsule object helper (SQL NULL / NOT IN semantics).
-- Forward-only, no data changes. See issue #131.
create or replace function public.galaxy_capsule_object_access(bucket text, object_name text)
returns boolean language plpgsql stable security definer
set search_path to ''
as $function$
declare viewer text := public.galaxy_person();
begin
  if viewer is null or viewer not in ('0','1') or object_name is null or object_name='' then
    return false;
  end if;
  return not exists (
    select 1
    from public.galaxy_items i
    where i.kind='capsule'
      and (
        (bucket='galaxy-photos' and i.data->>'photoPath'=object_name)
        or (bucket='galaxy-voice' and i.data->>'audioPath'=object_name)
      )
      and not public.galaxy_capsule_unlocked(i.data,viewer,now())
  );
end
$function$;
revoke all on function public.galaxy_capsule_object_access(text,text) from public,anon;
grant execute on function public.galaxy_capsule_object_access(text,text) to authenticated;
