begin;

-- Emergency rollback for 20261004212500_qa_phase0_privacy_firewall.sql.
-- WARNING: this intentionally restores the pre-Phase-0 privacy model and is
-- only for operational rollback if the hotfix itself causes a production outage.

drop trigger if exists galaxy_intelligence_cleanup_item on public.galaxy_items;
drop trigger if exists galaxy_intelligence_cleanup_place on public.galaxy_places;
drop trigger if exists galaxy_intelligence_cleanup_trip on public.galaxy_trip_history;
drop trigger if exists galaxy_intelligence_cleanup_goal on public.galaxy_goals;
drop trigger if exists galaxy_intelligence_cleanup_bond on public.galaxy_bond;
drop trigger if exists galaxy_intelligence_cleanup_voice_transcript on public.galaxy_voice_transcripts;
drop trigger if exists galaxy_intelligence_cleanup_photo on public.galaxy_photo_context;

drop function if exists public.galaxy_intelligence_reconcile_cleanup(integer);
drop function if exists public.galaxy_intelligence_enqueue_source_cleanup();
drop table if exists public.galaxy_intelligence_cleanup_queue;

drop policy if exists items_read on public.galaxy_items;
drop policy if exists items_update on public.galaxy_items;
drop policy if exists items_delete on public.galaxy_items;
create policy items_read on public.galaxy_items for select to authenticated
using(public.galaxy_person() is not null);
create policy items_update on public.galaxy_items for update to authenticated
using(public.galaxy_person() is not null)
with check(public.galaxy_person() is not null);
create policy items_delete on public.galaxy_items for delete to authenticated
using(public.galaxy_person() is not null);

drop policy if exists galaxy_photos_read on storage.objects;
create policy galaxy_photos_read on storage.objects for select to authenticated
using(bucket_id='galaxy-photos' and public.galaxy_person() is not null);

drop policy if exists galaxy_voice_read on storage.objects;
create policy galaxy_voice_read on storage.objects for select to authenticated
using(bucket_id='galaxy-voice' and public.galaxy_person() is not null);

drop policy if exists locations_read on public.galaxy_locations;
create policy locations_read on public.galaxy_locations for select to authenticated
using(public.galaxy_person() is not null);

drop policy if exists trip_points_read on public.galaxy_trip_points;
create policy trip_points_read on public.galaxy_trip_points for select to authenticated
using(public.galaxy_person() is not null);

drop policy if exists location_history_read on public.galaxy_location_history;
create policy location_history_read on public.galaxy_location_history for select to authenticated
using(public.galaxy_person() is not null);

drop policy if exists trip_history_read on public.galaxy_trip_history;
create policy trip_history_read on public.galaxy_trip_history for select to authenticated
using(public.galaxy_person() is not null);

drop function if exists public.galaxy_capsule_object_access(text,text);
drop function if exists public.galaxy_capsule_mark_place_unlocks(text,timestamptz);
drop function if exists public.galaxy_capsule_unlocked(jsonb,text,timestamptz);

commit;
