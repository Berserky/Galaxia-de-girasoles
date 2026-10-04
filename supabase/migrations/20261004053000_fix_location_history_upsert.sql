-- GPS history idempotency must use a full unique index so PostgREST
-- can target (source_device_id, client_sample_id) with ON CONFLICT.
drop index if exists public.galaxy_location_history_device_sample_uidx;
create unique index galaxy_location_history_device_sample_uidx
on public.galaxy_location_history(source_device_id,client_sample_id);
