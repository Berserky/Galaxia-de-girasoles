begin;

-- Emergency rollback for Phase 1 Data Integrity.
--
-- Operational order:
-- 1) roll android-companion back to the Phase-0 implementation;
-- 2) run this SQL;
-- 3) verify normal app reads/writes and Phase-0 privacy probes.
--
-- Deliberately retained for safety:
-- - galaxy-backups remains a private, policy-less bucket;
-- - __backup/ remains denied by client Storage policies;
-- - galaxy_bond_widget keeps rejecting __backup/ paths.
-- These residual guards prevent a rollback from exposing backup payloads or
-- snapshot aliases that may already exist. They can be cleaned later only after
-- all backup payloads/snapshots have been intentionally deleted.

drop function if exists public.galaxy_backup_restore_v5(jsonb);
drop function if exists public.galaxy_backup_export_v5();

-- Restore the exact Phase-0 trigger behavior if Phase 1 is rolled back.
create or replace function public.galaxy_capsule_protect_unlock_state()
returns trigger
language plpgsql
set search_path=''
as $rollback_capsule$
begin
  if new.kind='capsule' then
    if tg_op='INSERT' then
      new.data:=new.data-'unlockedFor'-'unlocked_for';
    elsif old.kind='capsule' and current_user<>'postgres' then
      new.data:=new.data-'unlockedFor'-'unlocked_for';
      if jsonb_typeof(old.data->'unlockedFor')='array' then
        new.data:=jsonb_set(new.data,'{unlockedFor}',old.data->'unlockedFor',true);
      end if;
    end if;
  end if;
  return new;
end $rollback_capsule$;

create or replace function public.galaxy_goal_version()
returns trigger
language plpgsql
set search_path=''
as $rollback_goal$
begin
 if tg_op='UPDATE' then
  new.id:=old.id;
  new.created_by:=old.created_by;
  new.created_at:=old.created_at;
  new.version:=old.version+1;
 else
  new.version:=coalesce(new.version,1);
 end if;
 new.updated_at:=now();
 if new.status='completed' and new.completed_at is null then new.completed_at:=now(); end if;
 if new.status<>'completed' then new.completed_at:=null; end if;
 return new;
end $rollback_goal$;

drop index if exists public.galaxy_chat_album_items_attachment_id_idx;
drop index if exists public.galaxy_chat_albums_cover_attachment_id_idx;
drop index if exists public.galaxy_chat_live_locations_message_id_idx;

commit;
