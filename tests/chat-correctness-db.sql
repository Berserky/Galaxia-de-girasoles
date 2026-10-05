\set ON_ERROR_STOP on
begin;

do $privileges$
begin
  if has_function_privilege('authenticated','public.galaxy_chat_search_page(text,text,text,text,date,bigint,integer)','EXECUTE')
     or has_function_privilege('authenticated','public.galaxy_chat_poll_mutate(uuid,text,text,uuid,boolean)','EXECUTE')
     or has_function_privilege('authenticated','public.galaxy_chat_poll_winner(uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.galaxy_chat_checklist_set(uuid,uuid,text,boolean,integer)','EXECUTE') then
    raise exception 'Phase 2 RPCs must remain backend-only';
  end if;
  if not has_function_privilege('service_role','public.galaxy_chat_search_page(text,text,text,text,date,bigint,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.galaxy_chat_poll_mutate(uuid,text,text,uuid,boolean)','EXECUTE')
     or not has_function_privilege('service_role','public.galaxy_chat_poll_winner(uuid)','EXECUTE')
     or not has_function_privilege('service_role','public.galaxy_chat_checklist_set(uuid,uuid,text,boolean,integer)','EXECUTE') then
    raise exception 'service_role cannot execute Phase 2 RPCs';
  end if;
end
$privileges$;

insert into public.galaxy_chat_messages(
  client_id,sender_person,body,message_type,created_at,client_created_at,server_received_at,sent_at
)
select
  gen_random_uuid(),
  case when g%2=0 then '0' else '1' end,
  case
    when g=1 then 'phase2-bulk phase2-old-marker'
    when g=2501 then 'phase2-bulk phase2-sender-marker'
    else 'phase2-bulk message '||g
  end,
  'text',
  '2026-09-01T12:00:00Z'::timestamptz+(g||' seconds')::interval,
  '2026-09-01T12:00:00Z'::timestamptz+(g||' seconds')::interval,
  '2026-09-01T12:00:00Z'::timestamptz+(g||' seconds')::interval,
  '2026-09-01T12:00:00Z'::timestamptz+(g||' seconds')::interval
from generate_series(1,5205) g;

insert into public.galaxy_chat_messages(
 client_id,sender_person,body,message_type,created_at,client_created_at,server_received_at,sent_at
) values (
 gen_random_uuid(),'0','phase2-date-marker','text',
 '2026-08-15T15:00:00Z','2026-08-15T15:00:00Z','2026-08-15T15:00:00Z','2026-08-15T15:00:00Z'
),(
 gen_random_uuid(),'1','phase2-photo-marker','photo',
 '2026-08-16T15:00:00Z','2026-08-16T15:00:00Z','2026-08-16T15:00:00Z','2026-08-16T15:00:00Z'
);

do $search_depth$
declare
  cursor_seq bigint:=null;
  page_count integer;
  page_min bigint;
  total integer:=0;
  loops integer:=0;
begin
  loop
    select count(*)::integer,min(server_seq)
      into page_count,page_min
    from public.galaxy_chat_search_page('0','phase2-bulk','all','all',null,cursor_seq,80);
    total:=total+page_count;
    loops:=loops+1;
    exit when page_count<80;
    if page_min is null or page_min=cursor_seq then
      raise exception 'NG-QA-008 search cursor did not advance';
    end if;
    cursor_seq:=page_min;
    if loops>100 then raise exception 'NG-QA-008 search pagination looped'; end if;
  end loop;
  if total<>5205 then
    raise exception 'NG-QA-008 expected 5205 paged messages, got %',total;
  end if;
  if loops<66 then
    raise exception 'NG-QA-008 did not traverse the >5000 message history';
  end if;
end
$search_depth$;

do $search_filters$
declare n integer;
begin
  select count(*) into n from public.galaxy_chat_search_page('0','phase2-old-marker','all','all',null,null,40);
  if n<>1 then raise exception 'NG-QA-008 old message search failed: %',n; end if;

  select count(*) into n from public.galaxy_chat_search_page('0','phase2-date-marker','all','all','2026-08-15',null,40);
  if n<>1 then raise exception 'NG-QA-008 date search failed: %',n; end if;

  select count(*) into n from public.galaxy_chat_search_page('0','phase2-sender-marker','partner','messages',null,null,40);
  if n<>1 then raise exception 'NG-QA-008 sender filter failed: %',n; end if;

  select count(*) into n from public.galaxy_chat_search_page('0','phase2-photo-marker','all','photo',null,null,40);
  if n<>1 then raise exception 'NG-QA-008 type filter failed: %',n; end if;
end
$search_filters$;

insert into public.galaxy_chat_messages(
 id,client_id,sender_person,body,message_type,created_at,client_created_at,server_received_at,sent_at
) values (
 '92000000-0000-4000-8000-000000000001',gen_random_uuid(),'0','','card',
 '2026-08-17T15:00:00Z','2026-08-17T15:00:00Z','2026-08-17T15:00:00Z','2026-08-17T15:00:00Z'
);
insert into public.galaxy_chat_polls(id,message_id,created_by,question,allow_multiple)
values('92000000-0000-4000-8000-000000000002','92000000-0000-4000-8000-000000000001','0','phase2-card-marker destination?',false);
insert into public.galaxy_chat_poll_options(id,poll_id,label,position) values
 ('92000000-0000-4000-8000-000000000003','92000000-0000-4000-8000-000000000002','A',0),
 ('92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000002','B',1);
insert into public.galaxy_chat_entity_refs(message_id,card_type,entity_kind,entity_id,created_by)
values('92000000-0000-4000-8000-000000000001','POLL','poll','92000000-0000-4000-8000-000000000002','0');

do $card_search$
declare n integer;
begin
  select count(*) into n from public.galaxy_chat_search_page('0','phase2-card-marker','all','polls',null,null,40);
  if n<>1 then raise exception 'NG-QA-008 card search failed: %',n; end if;
end
$card_search$;

-- Single-choice vote, change, identical retry and remove.
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000002','0','vote','92000000-0000-4000-8000-000000000003',true);
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000002','0','vote','92000000-0000-4000-8000-000000000004',true);

do $single_vote$
declare n integer; mutation jsonb;
begin
  select count(*) into n from public.galaxy_chat_poll_votes
  where poll_id='92000000-0000-4000-8000-000000000002' and person='0';
  if n<>1 then raise exception 'NG-QA-009 single vote produced % options',n; end if;
  if not exists(select 1 from public.galaxy_chat_poll_votes where poll_id='92000000-0000-4000-8000-000000000002' and option_id='92000000-0000-4000-8000-000000000004' and person='0') then
    raise exception 'NG-QA-009 single vote change did not keep the selected option';
  end if;
  mutation:=public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000002','0','vote','92000000-0000-4000-8000-000000000004',true);
  if coalesce((mutation->>'changed')::boolean,true) then raise exception 'NG-QA-009 identical vote retry was not idempotent'; end if;
end
$single_vote$;

select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000002','0','vote','92000000-0000-4000-8000-000000000004',false);

do $single_remove$
begin
  if exists(select 1 from public.galaxy_chat_poll_votes where poll_id='92000000-0000-4000-8000-000000000002' and person='0') then
    raise exception 'NG-QA-009 vote removal failed';
  end if;
end
$single_remove$;

-- Multiple-choice semantics.
insert into public.galaxy_chat_polls(id,created_by,question,allow_multiple)
values('92000000-0000-4000-8000-000000000010','0','multiple?',true);
insert into public.galaxy_chat_poll_options(id,poll_id,label,position) values
 ('92000000-0000-4000-8000-000000000011','92000000-0000-4000-8000-000000000010','M1',0),
 ('92000000-0000-4000-8000-000000000012','92000000-0000-4000-8000-000000000010','M2',1);
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000010','0','vote','92000000-0000-4000-8000-000000000011',true);
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000010','0','vote','92000000-0000-4000-8000-000000000012',true);

do $multiple_vote$
declare n integer;
begin
  select count(*) into n from public.galaxy_chat_poll_votes where poll_id='92000000-0000-4000-8000-000000000010' and person='0';
  if n<>2 then raise exception 'NG-QA-009 multiple vote expected 2 options, got %',n; end if;
end
$multiple_vote$;

select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000010','0','vote','92000000-0000-4000-8000-000000000011',false);

-- Winner and tie are only resolved after effective close.
insert into public.galaxy_chat_polls(id,created_by,question,allow_multiple)
values
 ('92000000-0000-4000-8000-000000000020','0','winner?',false),
 ('92000000-0000-4000-8000-000000000030','0','tie?',false);
insert into public.galaxy_chat_poll_options(id,poll_id,label,position) values
 ('92000000-0000-4000-8000-000000000021','92000000-0000-4000-8000-000000000020','Winner A',0),
 ('92000000-0000-4000-8000-000000000022','92000000-0000-4000-8000-000000000020','Winner B',1),
 ('92000000-0000-4000-8000-000000000031','92000000-0000-4000-8000-000000000030','Tie A',0),
 ('92000000-0000-4000-8000-000000000032','92000000-0000-4000-8000-000000000030','Tie B',1);

select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000020','0','vote','92000000-0000-4000-8000-000000000021',true);
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000020','1','vote','92000000-0000-4000-8000-000000000021',true);
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000020','0','close',null,true);

select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000030','0','vote','92000000-0000-4000-8000-000000000031',true);
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000030','1','vote','92000000-0000-4000-8000-000000000032',true);
select public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000030','0','close',null,true);

do $winner_resolution$
declare w jsonb; t jsonb; rejected boolean:=false;
begin
  w:=public.galaxy_chat_poll_winner('92000000-0000-4000-8000-000000000020');
  if w#>>'{winner,label}'<>'Winner A' or (w->>'tie')::boolean then
    raise exception 'NG-QA-010 authoritative winner is wrong: %',w;
  end if;

  t:=public.galaxy_chat_poll_winner('92000000-0000-4000-8000-000000000030');
  if not (t->>'tie')::boolean or t->'winner' is not null then
    raise exception 'NG-QA-010 tie is not explicit: %',t;
  end if;

  begin
    perform public.galaxy_chat_poll_mutate('92000000-0000-4000-8000-000000000020','1','vote','92000000-0000-4000-8000-000000000022',true);
  exception when others then
    if sqlerrm like '%cerrada%' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'NG-QA-009 accepted a vote after effective close'; end if;
end
$winner_resolution$;

-- Checklist aggregate version must increment exactly once for each real mutation.
insert into public.galaxy_chat_checklists(id,created_by,title)
values('92000000-0000-4000-8000-000000000040','0','phase2 checklist');
insert into public.galaxy_chat_checklist_items(id,checklist_id,label,position,checked,updated_by) values
 ('92000000-0000-4000-8000-000000000041','92000000-0000-4000-8000-000000000040','One',0,false,'0'),
 ('92000000-0000-4000-8000-000000000042','92000000-0000-4000-8000-000000000040','Two',1,false,'0');

select public.galaxy_chat_checklist_set('92000000-0000-4000-8000-000000000040','92000000-0000-4000-8000-000000000041','0',true,1);
select public.galaxy_chat_checklist_set('92000000-0000-4000-8000-000000000040','92000000-0000-4000-8000-000000000041','0',true,1);
select public.galaxy_chat_checklist_set('92000000-0000-4000-8000-000000000040','92000000-0000-4000-8000-000000000042','1',true,1);

do $checklist_versions$
declare list_version integer; item1 integer; item2 integer; rejected boolean:=false;
begin
  select version into list_version from public.galaxy_chat_checklists where id='92000000-0000-4000-8000-000000000040';
  select version into item1 from public.galaxy_chat_checklist_items where id='92000000-0000-4000-8000-000000000041';
  select version into item2 from public.galaxy_chat_checklist_items where id='92000000-0000-4000-8000-000000000042';
  if list_version<>3 or item1<>2 or item2<>2 then
    raise exception 'NG-QA-011 bad versions list %, item1 %, item2 %',list_version,item1,item2;
  end if;
  begin
    perform public.galaxy_chat_checklist_set('92000000-0000-4000-8000-000000000040','92000000-0000-4000-8000-000000000041','1',false,1);
  exception when others then
    if sqlerrm like '%cambió%' then rejected:=true; else raise; end if;
  end;
  if not rejected then raise exception 'NG-QA-011 accepted a stale conflicting checklist mutation'; end if;
end
$checklist_versions$;

rollback;
