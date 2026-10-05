-- Mega Update 3.0 release hardening: cover foreign keys used by cleanup/joins.
create index if not exists galaxy_daily_questions_memory_id_idx on public.galaxy_daily_questions(memory_id) where memory_id is not null;
create index if not exists galaxy_push_events_source_device_id_idx on public.galaxy_push_events(source_device_id) where source_device_id is not null;
create index if not exists galaxy_context_events_source_device_id_idx on public.galaxy_context_events(source_device_id) where source_device_id is not null;
create index if not exists galaxy_context_sessions_place_id_idx on public.galaxy_context_sessions(place_id) where place_id is not null;
