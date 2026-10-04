alter table public.galaxy_location_history
 add column if not exists source_device_id uuid references public.galaxy_devices(id) on delete set null,
 add column if not exists client_sample_id uuid;
create unique index if not exists galaxy_location_history_device_sample_uidx
 on public.galaxy_location_history(source_device_id,client_sample_id)
 where source_device_id is not null and client_sample_id is not null;