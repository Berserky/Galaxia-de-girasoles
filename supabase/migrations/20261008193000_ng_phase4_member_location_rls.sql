-- NG-AUD-004 / Fase 4: prevent any authenticated outsider from reading shared GPS.
-- One private couple only: 0 and 1. Existing sharing semantics for members remain unchanged.
-- Additive forward-only migration; no deletes, no data writes and no production execution here.
begin;

drop policy if exists locations_read on public.galaxy_locations;
create policy locations_read on public.galaxy_locations
for select to authenticated
using (
  (select public.galaxy_person()) is not null
  and (person = (select public.galaxy_person()) or sharing = true)
);

drop policy if exists trip_points_read on public.galaxy_trip_points;
create policy trip_points_read on public.galaxy_trip_points
for select to authenticated
using (
  (select public.galaxy_person()) is not null
  and (person = (select public.galaxy_person()) or exists (select 1 from public.galaxy_locations l where l.person = galaxy_trip_points.person and l.sharing = true))
);

drop policy if exists location_history_read on public.galaxy_location_history;
create policy location_history_read on public.galaxy_location_history
for select to authenticated
using (
  (select public.galaxy_person()) is not null
  and (person = (select public.galaxy_person()) or exists (select 1 from public.galaxy_locations l where l.person = galaxy_location_history.person and l.sharing = true))
);

drop policy if exists trip_history_read on public.galaxy_trip_history;
create policy trip_history_read on public.galaxy_trip_history
for select to authenticated
using (
  (select public.galaxy_person()) is not null
  and (person = (select public.galaxy_person()) or exists (select 1 from public.galaxy_locations l where l.person = galaxy_trip_history.person and l.sharing = true))
);

commit;
