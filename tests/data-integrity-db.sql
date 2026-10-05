\set ON_ERROR_STOP on

do $$
declare n integer;
begin
  select count(*) into n from supabase_migrations.schema_migrations;
  if n<>39 then raise exception 'NG-QA-004 expected 39 replayed migrations, got %',n; end if;
  if not exists(select 1 from supabase_migrations.schema_migrations where version='20261004235446' and name='qa_phase1_data_integrity') then
    raise exception 'NG-QA-004 Phase 1 migration missing from replay history';
  end if;

  if to_regclass('public.galaxy_chat_album_items_attachment_id_idx') is null
     or to_regclass('public.galaxy_chat_albums_cover_attachment_id_idx') is null
     or to_regclass('public.galaxy_chat_live_locations_message_id_idx') is null then
    raise exception 'NG-QA-018 required FK index missing';
  end if;

  if not exists(
    select 1 from pg_index i
    where i.indexrelid='public.galaxy_chat_album_items_attachment_id_idx'::regclass
      and i.indisvalid and i.indisready
  ) or not exists(
    select 1 from pg_index i
    where i.indexrelid='public.galaxy_chat_albums_cover_attachment_id_idx'::regclass
      and i.indisvalid and i.indisready
  ) or not exists(
    select 1 from pg_index i
    where i.indexrelid='public.galaxy_chat_live_locations_message_id_idx'::regclass
      and i.indisvalid and i.indisready
  ) then
    raise exception 'NG-QA-018 FK index exists but is not valid/ready';
  end if;

  if not exists(select 1 from storage.buckets where id='galaxy-backups' and public=false and file_size_limit=67108864) then
    raise exception 'NG-QA-012 private backup bucket is not configured';
  end if;
  if exists(
    select 1 from pg_policies
    where schemaname='storage' and tablename='objects'
      and (coalesce(qual,'') ilike '%galaxy-backups%' or coalesce(with_check,'') ilike '%galaxy-backups%')
  ) then
    raise exception 'NG-QA-012 backup payload bucket unexpectedly has client policy';
  end if;

  if has_function_privilege('authenticated','public.galaxy_backup_export_v5()','EXECUTE')
     or has_function_privilege('authenticated','public.galaxy_backup_restore_v5(jsonb)','EXECUTE') then
    raise exception 'NG-QA-012 backup DB primitives exposed to authenticated clients';
  end if;
  if not has_function_privilege('service_role','public.galaxy_backup_export_v5()','EXECUTE')
     or not has_function_privilege('service_role','public.galaxy_backup_restore_v5(jsonb)','EXECUTE') then
    raise exception 'NG-QA-012 service role cannot execute backup DB primitives';
  end if;

  if not exists(
    select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname='galaxy_photos_read' and qual ilike '%__backup/%'
  ) or not exists(
    select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname='galaxy_music_read' and qual ilike '%__backup/%'
  ) or not exists(
    select 1 from pg_policies where schemaname='storage' and tablename='objects'
      and policyname='galaxy_voice_read' and qual ilike '%__backup/%'
  ) then
    raise exception 'NG-QA-012 reserved media snapshots are not hidden from authenticated reads';
  end if;
end $$;

-- Keep query-plan evidence in CI. With seq scans disabled these probes must resolve
-- through the exact advisor-driven covering indexes even on an empty fresh DB.
set enable_seqscan=off;
explain (costs off)
select 1 from public.galaxy_chat_album_items where attachment_id='00000000-0000-4000-8000-000000000001'::uuid;
explain (costs off)
select 1 from public.galaxy_chat_albums where cover_attachment_id='00000000-0000-4000-8000-000000000001'::uuid;
explain (costs off)
select 1 from public.galaxy_chat_live_locations where message_id='00000000-0000-4000-8000-000000000001'::uuid;
reset enable_seqscan;
