-- Phase 1: Data Integrity
-- NG-QA-004 migration replay is repaired in-repository by matching the exact
-- production migration versions/statements before this additive migration.
-- NG-QA-012 evolves the existing backup endpoint with transactional DB snapshot/
-- restore primitives and a private backup payload bucket.
-- NG-QA-018 adds only the three FK indexes reported by Supabase's advisor.

begin;

-- NG-QA-018: exact findings from the production unindexed_foreign_keys advisor.
create index if not exists galaxy_chat_album_items_attachment_id_idx
  on public.galaxy_chat_album_items(attachment_id);
create index if not exists galaxy_chat_albums_cover_attachment_id_idx
  on public.galaxy_chat_albums(cover_attachment_id);
create index if not exists galaxy_chat_live_locations_message_id_idx
  on public.galaxy_chat_live_locations(message_id);

-- Backup descriptors are portable small JSON files. The complete DB payload is
-- held server-side in this private bucket; authenticated clients receive no policy.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('galaxy-backups','galaxy-backups',false,67108864,array['application/json'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Reserve __backup/ inside media buckets for server-side snapshots. This is
-- essential for locked-capsule media: snapshot paths must never become a second
-- client-readable alias for protected content.
drop policy if exists galaxy_photos_read on storage.objects;
create policy galaxy_photos_read on storage.objects for select to authenticated
using(
  bucket_id='galaxy-photos'
  and name not like '__backup/%'
  and public.galaxy_person() is not null
  and public.galaxy_capsule_object_access(bucket_id,name)
);
drop policy if exists galaxy_photos_add on storage.objects;
create policy galaxy_photos_add on storage.objects for insert to authenticated
with check(
  bucket_id='galaxy-photos'
  and name not like '__backup/%'
  and public.galaxy_person() is not null
);
drop policy if exists galaxy_photos_delete on storage.objects;
create policy galaxy_photos_delete on storage.objects for delete to authenticated
using(
  bucket_id='galaxy-photos'
  and name not like '__backup/%'
  and public.galaxy_person() is not null
);

drop policy if exists galaxy_music_read on storage.objects;
create policy galaxy_music_read on storage.objects for select to authenticated
using(
  bucket_id='galaxy-music'
  and name not like '__backup/%'
  and public.galaxy_person() is not null
);
drop policy if exists galaxy_music_add on storage.objects;
create policy galaxy_music_add on storage.objects for insert to authenticated
with check(
  bucket_id='galaxy-music'
  and name not like '__backup/%'
  and public.galaxy_person() is not null
);
drop policy if exists galaxy_music_delete on storage.objects;
create policy galaxy_music_delete on storage.objects for delete to authenticated
using(
  bucket_id='galaxy-music'
  and name not like '__backup/%'
  and public.galaxy_person() is not null
);

drop policy if exists galaxy_voice_read on storage.objects;
create policy galaxy_voice_read on storage.objects for select to authenticated
using(
  bucket_id='galaxy-voice'
  and name not like '__backup/%'
  and public.galaxy_person() is not null
  and public.galaxy_capsule_object_access(bucket_id,name)
);

create or replace function public.galaxy_backup_export_v5()
returns jsonb
language sql
security definer
set search_path=''
as $backup_export$
  select jsonb_build_object(
    'settings',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_settings t),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(t) order by t.created,t.id) from public.galaxy_items t),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(to_jsonb(t) order by t.day,t.person) from public.galaxy_daily t),'[]'::jsonb),
    'home',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_home t),'[]'::jsonb),
    'rewards',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_rewards t),'[]'::jsonb),
    'places',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_places t),'[]'::jsonb),
    'locationHistory',coalesce((
      select jsonb_agg((to_jsonb(t)-'source_device_id')||jsonb_build_object('source_device_id',null) order by t.id)
      from public.galaxy_location_history t
    ),'[]'::jsonb),
    'tripHistory',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_trip_history t),'[]'::jsonb),
    'placeEvents',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_place_events t),'[]'::jsonb),
    'destinations',coalesce((select jsonb_agg(to_jsonb(t) order by t.person) from public.galaxy_destinations t),'[]'::jsonb),
    'encounters',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_encounters t),'[]'::jsonb),
    'bond',coalesce((select jsonb_agg(to_jsonb(t) order by t.created,t.id) from public.galaxy_bond t),'[]'::jsonb),
    'bondConfig',coalesce((select jsonb_agg(to_jsonb(t) order by t.id) from public.galaxy_bond_config t),'[]'::jsonb),
    'bondParticipation',coalesce((select jsonb_agg(to_jsonb(t) order by t.day,t.person) from public.galaxy_bond_participation t),'[]'::jsonb),
    'dailyQuestions',coalesce((select jsonb_agg(to_jsonb(t) order by t.day) from public.galaxy_daily_questions t),'[]'::jsonb),
    'goals',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.galaxy_goals t),'[]'::jsonb),
    'goalParticipants',coalesce((select jsonb_agg(to_jsonb(t) order by t.goal_id,t.person) from public.galaxy_goal_participants t),'[]'::jsonb),
    'goalSteps',coalesce((select jsonb_agg(to_jsonb(t) order by t.goal_id,t.position,t.id) from public.galaxy_goal_steps t),'[]'::jsonb),
    'goalLinks',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.galaxy_goal_links t),'[]'::jsonb),
    'goalContributions',coalesce((select jsonb_agg(to_jsonb(t) order by t.contribution_date,t.id) from public.galaxy_goal_contributions t),'[]'::jsonb),
    'bondGestures',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.galaxy_bond_gestures t),'[]'::jsonb),
    'contextSettings',coalesce((select jsonb_agg(to_jsonb(t) order by t.person) from public.galaxy_context_settings t),'[]'::jsonb),
    'voiceTranscripts',coalesce((select jsonb_agg(to_jsonb(t) order by t.bond_id) from public.galaxy_voice_transcripts t),'[]'::jsonb),
    'photoContext',coalesce((select jsonb_agg(to_jsonb(t) order by t.path) from public.galaxy_photo_context t),'[]'::jsonb),
    'chatMessages',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.server_seq,t.id)
      from public.galaxy_chat_messages t where t.deleted_at is null
    ),'[]'::jsonb),
    'chatReadState',coalesce((
      select jsonb_agg(
        to_jsonb(r)||jsonb_build_object(
          'last_read_message_id',
          case when r.last_read_message_id is null or exists(
            select 1 from public.galaxy_chat_messages m
            where m.id=r.last_read_message_id and m.deleted_at is null
          ) then r.last_read_message_id else null end
        ) order by r.person
      ) from public.galaxy_chat_read_state r
    ),'[]'::jsonb),
    'chatReactions',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.message_id,t.person)
      from public.galaxy_chat_reactions t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatHidden',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.message_id,t.person)
      from public.galaxy_chat_hidden t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatPins',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.message_id)
      from public.galaxy_chat_pins t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatFavorites',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.message_id,t.person)
      from public.galaxy_chat_favorites t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatEdits',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.message_id,t.edited_at,t.id)
      from public.galaxy_chat_edits t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatAttachments',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at,t.id)
      from public.galaxy_chat_attachments t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatPreferences',coalesce((select jsonb_agg(to_jsonb(t) order by t.person) from public.galaxy_chat_preferences t),'[]'::jsonb),
    'chatTranscripts',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.attachment_id)
      from public.galaxy_chat_transcripts t
      join public.galaxy_chat_attachments a on a.id=t.attachment_id
      join public.galaxy_chat_messages m on m.id=a.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatTranslations',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.message_id,t.person,t.target_language)
      from public.galaxy_chat_translations t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatAlbums',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.galaxy_chat_albums t),'[]'::jsonb),
    'chatAlbumItems',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.album_id,t.attachment_id)
      from public.galaxy_chat_album_items t
      join public.galaxy_chat_attachments a on a.id=t.attachment_id
      join public.galaxy_chat_messages m on m.id=a.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatStickers',coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at,t.id) from public.galaxy_chat_stickers t),'[]'::jsonb),
    'chatStickerFavorites',coalesce((select jsonb_agg(to_jsonb(t) order by t.sticker_id,t.person) from public.galaxy_chat_sticker_favorites t),'[]'::jsonb),
    'chatStickerRecents',coalesce((select jsonb_agg(to_jsonb(t) order by t.sticker_id,t.person) from public.galaxy_chat_sticker_recents t),'[]'::jsonb),
    'chatLiveLocations',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.started_at,t.id)
      from public.galaxy_chat_live_locations t
      where t.message_id is null or exists(
        select 1 from public.galaxy_chat_messages m
        where m.id=t.message_id and m.deleted_at is null
      )
    ),'[]'::jsonb),
    'chatEntityRefs',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.message_id)
      from public.galaxy_chat_entity_refs t
      join public.galaxy_chat_messages m on m.id=t.message_id and m.deleted_at is null
    ),'[]'::jsonb),
    'chatPolls',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at,t.id)
      from public.galaxy_chat_polls t
      where t.message_id is null or exists(
        select 1 from public.galaxy_chat_messages m
        where m.id=t.message_id and m.deleted_at is null
      )
    ),'[]'::jsonb),
    'chatPollOptions',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.poll_id,t.position,t.id)
      from public.galaxy_chat_poll_options t
      join public.galaxy_chat_polls p on p.id=t.poll_id
      where p.message_id is null or exists(
        select 1 from public.galaxy_chat_messages m
        where m.id=p.message_id and m.deleted_at is null
      )
    ),'[]'::jsonb),
    'chatPollVotes',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.poll_id,t.option_id,t.person)
      from public.galaxy_chat_poll_votes t
      join public.galaxy_chat_polls p on p.id=t.poll_id
      where p.message_id is null or exists(
        select 1 from public.galaxy_chat_messages m
        where m.id=p.message_id and m.deleted_at is null
      )
    ),'[]'::jsonb),
    'chatChecklists',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at,t.id)
      from public.galaxy_chat_checklists t
      where t.message_id is null or exists(
        select 1 from public.galaxy_chat_messages m
        where m.id=t.message_id and m.deleted_at is null
      )
    ),'[]'::jsonb),
    'chatChecklistItems',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.checklist_id,t.position,t.id)
      from public.galaxy_chat_checklist_items t
      join public.galaxy_chat_checklists c on c.id=t.checklist_id
      where c.message_id is null or exists(
        select 1 from public.galaxy_chat_messages m
        where m.id=c.message_id and m.deleted_at is null
      )
    ),'[]'::jsonb)
  )
$backup_export$;

revoke all on function public.galaxy_backup_export_v5() from public,anon,authenticated;
grant execute on function public.galaxy_backup_export_v5() to service_role;

create or replace function public.galaxy_backup_restore_v5(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $backup_restore$
declare
  spec jsonb;
  section_name text;
  table_name text;
  rows jsonb;
  declared bigint;
  actual bigint;
  mismatches bigint;
  seq record;
  seq_name text;
  max_value bigint;
begin
  if payload is null or jsonb_typeof(payload)<>'object'
     or payload->>'format'<>'nuestra-galaxia-backup-payload'
     or (payload->>'version')::integer<>5
     or jsonb_typeof(payload->'sections')<>'object'
     or jsonb_typeof(payload->'manifest')<>'object'
     or jsonb_typeof(payload#>'{manifest,counts}')<>'object' then
    raise exception 'Backup v5 inválido o malformado';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('nuestra-galaxia-backup-restore-v5',0));

  -- Seeded state must be replaced exactly, not silently kept. These deletes
  -- and inserts are inside this RPC transaction, so any later verification error
  -- restores their previous state automatically.
  rows:=payload#>'{sections,settings}';
  if jsonb_typeof(rows)<>'array' then raise exception 'Sección settings inválida'; end if;
  if coalesce((payload#>>'{manifest,counts,settings}')::bigint,-1)<>jsonb_array_length(rows) then
    raise exception 'Conteo settings no coincide con manifiesto';
  end if;
  delete from public.galaxy_settings;
  insert into public.galaxy_settings
  select * from jsonb_populate_recordset(null::public.galaxy_settings,rows);

  rows:=payload#>'{sections,bondConfig}';
  if jsonb_typeof(rows)<>'array' then raise exception 'Sección bondConfig inválida'; end if;
  if coalesce((payload#>>'{manifest,counts,bondConfig}')::bigint,-1)<>jsonb_array_length(rows) then
    raise exception 'Conteo bondConfig no coincide con manifiesto';
  end if;
  delete from public.galaxy_bond_config;
  insert into public.galaxy_bond_config
  select * from jsonb_populate_recordset(null::public.galaxy_bond_config,rows);

  rows:=payload#>'{sections,home}';
  if jsonb_typeof(rows)<>'array' then raise exception 'Sección home inválida'; end if;
  if coalesce((payload#>>'{manifest,counts,home}')::bigint,-1)<>jsonb_array_length(rows) then
    raise exception 'Conteo home no coincide con manifiesto';
  end if;
  delete from public.galaxy_home;
  insert into public.galaxy_home
  select * from jsonb_populate_recordset(null::public.galaxy_home,rows);

  rows:=payload#>'{sections,contextSettings}';
  if jsonb_typeof(rows)<>'array' then raise exception 'Sección contextSettings inválida'; end if;
  if coalesce((payload#>>'{manifest,counts,contextSettings}')::bigint,-1)<>jsonb_array_length(rows) then
    raise exception 'Conteo contextSettings no coincide con manifiesto';
  end if;
  delete from public.galaxy_context_settings;
  insert into public.galaxy_context_settings
  select * from jsonb_populate_recordset(null::public.galaxy_context_settings,rows);

  -- Every remaining section is restored in this same database transaction.
  -- ON CONFLICT DO NOTHING is followed by an exact typed deep-compare. A
  -- conflicting different row therefore raises and rolls the whole DB restore back.
  for spec in
    select value from jsonb_array_elements(
      '[
        {"s":"rewards","t":"galaxy_rewards"},
        {"s":"items","t":"galaxy_items"},
        {"s":"daily","t":"galaxy_daily"},
        {"s":"places","t":"galaxy_places"},
        {"s":"locationHistory","t":"galaxy_location_history"},
        {"s":"tripHistory","t":"galaxy_trip_history"},
        {"s":"placeEvents","t":"galaxy_place_events"},
        {"s":"destinations","t":"galaxy_destinations"},
        {"s":"encounters","t":"galaxy_encounters"},
        {"s":"bond","t":"galaxy_bond"},
        {"s":"bondParticipation","t":"galaxy_bond_participation"},
        {"s":"dailyQuestions","t":"galaxy_daily_questions"},
        {"s":"goals","t":"galaxy_goals"},
        {"s":"goalParticipants","t":"galaxy_goal_participants"},
        {"s":"goalSteps","t":"galaxy_goal_steps"},
        {"s":"goalLinks","t":"galaxy_goal_links"},
        {"s":"goalContributions","t":"galaxy_goal_contributions"},
        {"s":"bondGestures","t":"galaxy_bond_gestures"},
        {"s":"voiceTranscripts","t":"galaxy_voice_transcripts"},
        {"s":"photoContext","t":"galaxy_photo_context"},
        {"s":"chatMessages","t":"galaxy_chat_messages"},
        {"s":"chatReadState","t":"galaxy_chat_read_state"},
        {"s":"chatReactions","t":"galaxy_chat_reactions"},
        {"s":"chatHidden","t":"galaxy_chat_hidden"},
        {"s":"chatPins","t":"galaxy_chat_pins"},
        {"s":"chatFavorites","t":"galaxy_chat_favorites"},
        {"s":"chatEdits","t":"galaxy_chat_edits"},
        {"s":"chatAttachments","t":"galaxy_chat_attachments"},
        {"s":"chatPreferences","t":"galaxy_chat_preferences"},
        {"s":"chatTranscripts","t":"galaxy_chat_transcripts"},
        {"s":"chatTranslations","t":"galaxy_chat_translations"},
        {"s":"chatAlbums","t":"galaxy_chat_albums"},
        {"s":"chatAlbumItems","t":"galaxy_chat_album_items"},
        {"s":"chatStickers","t":"galaxy_chat_stickers"},
        {"s":"chatStickerFavorites","t":"galaxy_chat_sticker_favorites"},
        {"s":"chatStickerRecents","t":"galaxy_chat_sticker_recents"},
        {"s":"chatLiveLocations","t":"galaxy_chat_live_locations"},
        {"s":"chatEntityRefs","t":"galaxy_chat_entity_refs"},
        {"s":"chatPolls","t":"galaxy_chat_polls"},
        {"s":"chatPollOptions","t":"galaxy_chat_poll_options"},
        {"s":"chatPollVotes","t":"galaxy_chat_poll_votes"},
        {"s":"chatChecklists","t":"galaxy_chat_checklists"},
        {"s":"chatChecklistItems","t":"galaxy_chat_checklist_items"}
      ]'::jsonb
    )
  loop
    section_name:=spec->>'s';
    table_name:=spec->>'t';
    rows:=payload->'sections'->section_name;
    if jsonb_typeof(rows)<>'array' then
      raise exception 'Sección % inválida',section_name;
    end if;
    declared:=coalesce((payload->'manifest'->'counts'->>section_name)::bigint,-1);
    actual:=jsonb_array_length(rows);
    if declared<>actual then
      raise exception 'Conteo % no coincide con manifiesto: % != %',section_name,declared,actual;
    end if;
    if actual>0 then
      execute format(
        'insert into public.%1$I overriding system value select * from jsonb_populate_recordset(null::public.%1$I,$1) on conflict do nothing',
        table_name
      ) using rows;
      execute format(
        'select count(*) from jsonb_populate_recordset(null::public.%1$I,$1) e where not exists (select 1 from public.%1$I t where to_jsonb(t)=to_jsonb(e))',
        table_name
      ) into mismatches using rows;
      if mismatches<>0 then
        raise exception 'Restore % no verificable: % fila(s) difieren',section_name,mismatches;
      end if;
    end if;
  end loop;

  -- Verify seeded state after exact replacement.
  for spec in
    select value from jsonb_array_elements(
      '[
        {"s":"settings","t":"galaxy_settings"},
        {"s":"bondConfig","t":"galaxy_bond_config"},
        {"s":"home","t":"galaxy_home"},
        {"s":"contextSettings","t":"galaxy_context_settings"}
      ]'::jsonb
    )
  loop
    section_name:=spec->>'s';
    table_name:=spec->>'t';
    rows:=payload->'sections'->section_name;
    execute format(
      'select count(*) from jsonb_populate_recordset(null::public.%1$I,$1) e where not exists (select 1 from public.%1$I t where to_jsonb(t)=to_jsonb(e))',
      table_name
    ) into mismatches using rows;
    if mismatches<>0 then raise exception 'Restore % no verificable',section_name; end if;
  end loop;

  -- Advance owned numeric sequences only after every row passed deep verification.
  -- No validation that can fail is intentionally placed after this block.
  for seq in
    select c.relname as table_name,a.attname as column_name,
           pg_get_serial_sequence(format('public.%I',c.relname),a.attname) as sequence_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace and n.nspname='public'
    join pg_attribute a on a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
    where c.relname in (
      'galaxy_rewards','galaxy_places','galaxy_location_history','galaxy_trip_history','galaxy_place_events','galaxy_encounters','galaxy_chat_edits'
    )
  loop
    if seq.sequence_name is not null then
      execute format('select max(%I)::bigint from public.%I',seq.column_name,seq.table_name) into max_value;
      if max_value is not null then perform setval(seq.sequence_name,max_value,true); end if;
    end if;
  end loop;
  select max(server_seq) into max_value from public.galaxy_chat_messages;
  if max_value is not null then perform setval('public.galaxy_chat_server_seq',max_value,true); end if;

  return jsonb_build_object(
    'ok',true,
    'verified',true,
    'counts',payload#>'{manifest,counts}'
  );
end
$backup_restore$;

revoke all on function public.galaxy_backup_restore_v5(jsonb) from public,anon,authenticated;
grant execute on function public.galaxy_backup_restore_v5(jsonb) to service_role;

commit;
