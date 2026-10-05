alter table public.galaxy_locations
 add column if not exists motion text check(motion is null or motion in ('still','walking','vehicle')),
 add column if not exists transport_preference text check(transport_preference is null or transport_preference in ('motorcycle','transit'));
update public.galaxy_locations set transport_preference=case person when '0' then 'motorcycle' when '1' then 'transit' end where transport_preference is null;