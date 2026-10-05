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

drop index if exists public.galaxy_chat_album_items_attachment_id_idx;
drop index if exists public.galaxy_chat_albums_cover_attachment_id_idx;
drop index if exists public.galaxy_chat_live_locations_message_id_idx;

commit;
