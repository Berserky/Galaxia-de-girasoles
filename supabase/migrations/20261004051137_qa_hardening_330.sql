-- QA hardening 3.3.0
-- Least privilege and query-plan cleanup found during the release audit.

revoke all on public.galaxy_daily_questions from public, anon, authenticated;

drop policy if exists destinations_write_own on public.galaxy_destinations;
drop policy if exists destinations_insert_own on public.galaxy_destinations;
drop policy if exists destinations_update_own on public.galaxy_destinations;
drop policy if exists destinations_delete_own on public.galaxy_destinations;

create policy destinations_insert_own
on public.galaxy_destinations
for insert to authenticated
with check(person=public.galaxy_person());

create policy destinations_update_own
on public.galaxy_destinations
for update to authenticated
using(person=public.galaxy_person())
with check(person=public.galaxy_person());

create policy destinations_delete_own
on public.galaxy_destinations
for delete to authenticated
using(person=public.galaxy_person());

create index if not exists galaxy_chat_metrics_message_idx
on public.galaxy_chat_metrics(message_id);
