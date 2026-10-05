
create schema if not exists phase0_backup_20261004_2326z;

create table phase0_backup_20261004_2326z.galaxy_items as table public.galaxy_items;
create table phase0_backup_20261004_2326z.galaxy_locations as table public.galaxy_locations;
create table phase0_backup_20261004_2326z.galaxy_trip_points as table public.galaxy_trip_points;
create table phase0_backup_20261004_2326z.galaxy_location_history as table public.galaxy_location_history;
create table phase0_backup_20261004_2326z.galaxy_trip_history as table public.galaxy_trip_history;
create table phase0_backup_20261004_2326z.galaxy_places as table public.galaxy_places;
create table phase0_backup_20261004_2326z.galaxy_goals as table public.galaxy_goals;
create table phase0_backup_20261004_2326z.galaxy_bond as table public.galaxy_bond;
create table phase0_backup_20261004_2326z.galaxy_voice_transcripts as table public.galaxy_voice_transcripts;
create table phase0_backup_20261004_2326z.galaxy_photo_context as table public.galaxy_photo_context;
create table phase0_backup_20261004_2326z.galaxy_intelligence_documents as table public.galaxy_intelligence_documents;
create table phase0_backup_20261004_2326z.galaxy_chat_messages as table public.galaxy_chat_messages;
create table phase0_backup_20261004_2326z.galaxy_chat_attachments as table public.galaxy_chat_attachments;
create table phase0_backup_20261004_2326z.galaxy_chat_pins as table public.galaxy_chat_pins;
create table phase0_backup_20261004_2326z.galaxy_chat_favorites as table public.galaxy_chat_favorites;
create table phase0_backup_20261004_2326z.storage_objects as
select * from storage.objects
where bucket_id in ('galaxy-photos','galaxy-voice','galaxy-chat-media');

create table phase0_backup_20261004_2326z.policies as
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename in (
  'galaxy_items','galaxy_locations','galaxy_trip_points','galaxy_location_history',
  'galaxy_trip_history','galaxy_intelligence_documents','galaxy_chat_messages',
  'galaxy_chat_attachments','galaxy_chat_pins','galaxy_chat_favorites'
))
or (schemaname='storage' and tablename='objects');

create table phase0_backup_20261004_2326z.manifest(
  created_at timestamptz not null default now(),
  main_version text not null,
  note text not null
);
insert into phase0_backup_20261004_2326z.manifest(main_version,note)
values(
  'Galaxy Chat Universe 3.5.0 / versionCode 34',
  'Pre-Phase-0 logical snapshot. Storage object metadata is copied; binary object bodies remain in Storage and are not duplicated by this logical snapshot.'
);

revoke all on schema phase0_backup_20261004_2326z from public,anon,authenticated;
