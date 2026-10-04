create index if not exists galaxy_destinations_place_id_idx on public.galaxy_destinations(place_id);
create index if not exists galaxy_device_place_presence_place_id_idx on public.galaxy_device_place_presence(place_id);
create index if not exists galaxy_place_events_place_id_idx on public.galaxy_place_events(place_id);