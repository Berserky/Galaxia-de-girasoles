-- Rollback Phase 2: Galaxy Chat Correctness
begin;

drop function if exists public.galaxy_chat_checklist_set(uuid,uuid,text,boolean,integer);
drop function if exists public.galaxy_chat_poll_winner(uuid);
drop function if exists public.galaxy_chat_poll_mutate(uuid,text,text,uuid,boolean);
drop function if exists public.galaxy_chat_search_page(text,text,text,text,date,bigint,integer);

commit;
