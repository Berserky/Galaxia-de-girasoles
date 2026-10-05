revoke all on table public.galaxy_locations from anon;
revoke all on table public.galaxy_places from anon;
revoke all on table public.galaxy_trip_points from anon;

revoke truncate,references,trigger on table public.galaxy_settings from authenticated;
revoke truncate,references,trigger on table public.galaxy_items from authenticated;
revoke truncate,references,trigger on table public.galaxy_locations from authenticated;
revoke truncate,references,trigger on table public.galaxy_places from authenticated;
revoke truncate,references,trigger,update on table public.galaxy_trip_points from authenticated;

revoke delete,insert on table public.galaxy_settings from authenticated;
grant select,update on table public.galaxy_settings to authenticated;

grant select,insert,update on table public.galaxy_locations to authenticated;
grant select,insert,update,delete on table public.galaxy_places to authenticated;
grant select,insert,delete on table public.galaxy_trip_points to authenticated;