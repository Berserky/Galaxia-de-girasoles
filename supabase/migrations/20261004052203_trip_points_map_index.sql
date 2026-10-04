-- QA performance hardening: map-state reads the most recent trip points every refresh.
create index if not exists galaxy_trip_points_created_idx
on public.galaxy_trip_points(created_at desc);
