-- Phase 2: Galaxy Chat Correctness
-- NG-QA-008: complete, cursor-based Chat search over the canonical message history.
-- NG-QA-009/010: transactional poll mutation and authoritative winner resolution.
-- NG-QA-011: serialized checklist mutations with monotonic aggregate versioning.

begin;

create or replace function public.galaxy_chat_search_page(
  p_person text,
  p_query text default '',
  p_sender text default 'all',
  p_type text default 'all',
  p_date date default null,
  p_before_seq bigint default null,
  p_limit integer default 80
)
returns setof public.galaxy_chat_messages
language sql
stable
security invoker
set search_path = ''
as $search$
  with args as (
    select
      case when p_person in ('0','1') then p_person else null end as person,
      lower(trim(coalesce(p_query,''))) as q,
      case when p_sender in ('all','me','partner') then p_sender else 'all' end as sender_filter,
      case when p_type in (
        'all','messages','photo','video','audio','file','link',
        'memories','plans','music','places','goals','polls','checklists',
        'capsules','events','eta','daily','status'
      ) then p_type else 'all' end as type_filter,
      greatest(1,least(coalesce(p_limit,80),101)) as page_limit
  )
  select m.*
  from public.galaxy_chat_messages m
  cross join args a
  where a.person is not null
    and m.deleted_at is null
    and not exists (
      select 1
      from public.galaxy_chat_hidden h
      where h.message_id=m.id and h.person=a.person
    )
    and coalesce(m.schedule_state,'sent')<>'cancelled'
    and (coalesce(m.schedule_state,'sent')<>'pending' or m.sender_person=a.person)
    and (m.expires_at is null or m.expires_at>now())
    and (p_before_seq is null or p_before_seq<=0 or m.server_seq<p_before_seq)
    and (
      a.sender_filter='all'
      or (a.sender_filter='me' and m.sender_person=a.person)
      or (a.sender_filter='partner' and m.sender_person<>a.person)
    )
    and (
      p_date is null
      or (m.created_at at time zone 'America/Bogota')::date=p_date
    )
    and (
      a.type_filter='all'
      or (a.type_filter='messages' and m.message_type<>'card')
      or (a.type_filter in ('photo','video','audio','file') and m.message_type=a.type_filter)
      or (
        a.type_filter='link'
        and (m.message_type='link' or coalesce(m.link_preview,'{}'::jsonb)<>'{}'::jsonb)
      )
      or (
        a.type_filter in (
          'memories','plans','music','places','goals','polls','checklists',
          'capsules','events','eta','daily','status'
        )
        and exists (
          select 1
          from public.galaxy_chat_entity_refs r
          where r.message_id=m.id
            and r.card_type=case a.type_filter
              when 'memories' then 'MEMORY'
              when 'plans' then 'PLAN'
              when 'music' then 'SONG'
              when 'places' then 'PLACE'
              when 'goals' then 'GOAL'
              when 'polls' then 'POLL'
              when 'checklists' then 'CHECKLIST'
              when 'capsules' then 'CAPSULE'
              when 'events' then 'EVENT'
              when 'eta' then 'ETA'
              when 'daily' then 'DAILY_QUESTION'
              when 'status' then 'STATUS'
            end
        )
      )
    )
    and (
      a.q=''
      or to_tsvector('simple',coalesce(m.body,'')) @@ plainto_tsquery('simple',a.q)
      or strpos(lower(coalesce(m.body,'')),a.q)>0
      or exists (
        select 1
        from public.galaxy_chat_entity_refs r
        where r.message_id=m.id
          and (
            (
              r.entity_kind<>'capsule'
              and strpos(lower(coalesce(r.snapshot::text,'')),a.q)>0
            )
            or (
              r.entity_kind in ('memory','plan','song','event')
              and exists (
                select 1
                from public.galaxy_items i
                where i.id::text=r.entity_id
                  and i.kind=r.entity_kind
                  and strpos(
                    lower(concat_ws(' ',
                      coalesce(i.data->>'title',''),
                      coalesce(i.data->>'body',''),
                      coalesce(i.data->>'artist',''),
                      coalesce(i.data->>'note','')
                    )),
                    a.q
                  )>0
              )
            )
            or (
              r.entity_kind='capsule'
              and exists (
                select 1
                from public.galaxy_items i
                where i.id::text=r.entity_id
                  and i.kind='capsule'
                  and strpos(lower(coalesce(i.data->>'title','')),a.q)>0
              )
            )
            or (
              r.entity_kind='goal'
              and exists (
                select 1
                from public.galaxy_goals g
                where g.id::text=r.entity_id
                  and strpos(lower(concat_ws(' ',coalesce(g.title,''),coalesce(g.description,''))),a.q)>0
              )
            )
            or (
              r.entity_kind='place'
              and exists (
                select 1
                from public.galaxy_places p
                where p.id::text=r.entity_id
                  and strpos(lower(concat_ws(' ',coalesce(p.name,''),coalesce(p.note,''))),a.q)>0
              )
            )
            or (
              r.entity_kind='poll'
              and exists (
                select 1
                from public.galaxy_chat_polls p
                where p.id::text=r.entity_id
                  and strpos(lower(coalesce(p.question,'')),a.q)>0
              )
            )
            or (
              r.entity_kind='checklist'
              and exists (
                select 1
                from public.galaxy_chat_checklists c
                where c.id::text=r.entity_id
                  and (
                    strpos(lower(coalesce(c.title,'')),a.q)>0
                    or exists (
                      select 1
                      from public.galaxy_chat_checklist_items ci
                      where ci.checklist_id=c.id
                        and strpos(lower(coalesce(ci.label,'')),a.q)>0
                    )
                  )
              )
            )
            or (
              r.entity_kind='context_session'
              and exists (
                select 1
                from public.galaxy_context_sessions cs
                where cs.id::text=r.entity_id
                  and strpos(lower(coalesce(cs.label,'')),a.q)>0
              )
            )
            or (
              r.entity_kind='status'
              and exists (
                select 1
                from public.galaxy_locations l
                where l.person=r.entity_id
                  and strpos(lower(coalesce(l.status,'')),a.q)>0
              )
            )
          )
      )
    )
  order by m.server_seq desc
  limit (select page_limit from args);
$search$;

create or replace function public.galaxy_chat_poll_mutate(
  p_poll_id uuid,
  p_person text,
  p_operation text,
  p_option_id uuid default null,
  p_selected boolean default true
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $poll_mutate$
declare
  poll_row public.galaxy_chat_polls%rowtype;
  affected integer:=0;
  changed boolean:=false;
  effective_closed boolean:=false;
  stamp timestamptz:=clock_timestamp();
begin
  if p_person not in ('0','1') then
    raise exception 'Persona no válida';
  end if;

  select * into poll_row
  from public.galaxy_chat_polls
  where id=p_poll_id
  for update;

  if not found then
    raise exception 'Encuesta no disponible';
  end if;

  effective_closed:=poll_row.closed_at is not null
    or (poll_row.closes_at is not null and poll_row.closes_at<=stamp);

  if p_operation='close' then
    if poll_row.created_by<>p_person then
      raise exception 'Solo quien creó la encuesta puede cerrarla';
    end if;
    if poll_row.closed_at is null then
      update public.galaxy_chat_polls
      set closed_at=stamp,updated_at=stamp
      where id=p_poll_id;
      changed:=true;
      poll_row.closed_at:=stamp;
    end if;
    return jsonb_build_object(
      'changed',changed,
      'closed',true,
      'closedAt',poll_row.closed_at,
      'allowMultiple',poll_row.allow_multiple
    );
  end if;

  if p_operation<>'vote' then
    raise exception 'Operación de encuesta no válida';
  end if;

  if effective_closed then
    raise exception 'La encuesta está cerrada';
  end if;

  if p_option_id is null or not exists (
    select 1
    from public.galaxy_chat_poll_options o
    where o.id=p_option_id and o.poll_id=p_poll_id
  ) then
    raise exception 'Opción no disponible';
  end if;

  if coalesce(p_selected,true) then
    if not poll_row.allow_multiple then
      delete from public.galaxy_chat_poll_votes
      where poll_id=p_poll_id and person=p_person and option_id<>p_option_id;
      get diagnostics affected=row_count;
      changed:=affected>0;
    end if;

    insert into public.galaxy_chat_poll_votes(poll_id,option_id,person,voted_at)
    values(p_poll_id,p_option_id,p_person,stamp)
    on conflict(poll_id,option_id,person) do nothing;
    get diagnostics affected=row_count;
    changed:=changed or affected>0;
  else
    delete from public.galaxy_chat_poll_votes
    where poll_id=p_poll_id and option_id=p_option_id and person=p_person;
    get diagnostics affected=row_count;
    changed:=affected>0;
  end if;

  return jsonb_build_object(
    'changed',changed,
    'closed',false,
    'allowMultiple',poll_row.allow_multiple
  );
end;
$poll_mutate$;

create or replace function public.galaxy_chat_poll_winner(p_poll_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $poll_winner$
declare
  poll_row public.galaxy_chat_polls%rowtype;
  top_votes integer:=0;
  top_count integer:=0;
  winner_row record;
begin
  select * into poll_row
  from public.galaxy_chat_polls
  where id=p_poll_id;

  if not found then
    raise exception 'Encuesta no disponible';
  end if;

  if poll_row.closed_at is null
     and (poll_row.closes_at is null or poll_row.closes_at>now()) then
    raise exception 'La encuesta sigue abierta';
  end if;

  with counts as (
    select o.id,o.label,o.position,count(v.option_id)::integer as votes
    from public.galaxy_chat_poll_options o
    left join public.galaxy_chat_poll_votes v
      on v.poll_id=o.poll_id and v.option_id=o.id
    where o.poll_id=p_poll_id
    group by o.id,o.label,o.position
  )
  select coalesce(max(votes),0) into top_votes from counts;

  if top_votes=0 then
    return jsonb_build_object(
      'pollId',p_poll_id,
      'winner',null,
      'tie',false,
      'topVotes',0,
      'reason','no_votes'
    );
  end if;

  with counts as (
    select o.id,o.label,o.position,count(v.option_id)::integer as votes
    from public.galaxy_chat_poll_options o
    left join public.galaxy_chat_poll_votes v
      on v.poll_id=o.poll_id and v.option_id=o.id
    where o.poll_id=p_poll_id
    group by o.id,o.label,o.position
  )
  select count(*)::integer into top_count
  from counts
  where votes=top_votes;

  if top_count<>1 then
    return jsonb_build_object(
      'pollId',p_poll_id,
      'winner',null,
      'tie',true,
      'topVotes',top_votes,
      'reason','tie'
    );
  end if;

  with counts as (
    select o.id,o.label,o.position,count(v.option_id)::integer as votes
    from public.galaxy_chat_poll_options o
    left join public.galaxy_chat_poll_votes v
      on v.poll_id=o.poll_id and v.option_id=o.id
    where o.poll_id=p_poll_id
    group by o.id,o.label,o.position
  )
  select id,label,position,votes into winner_row
  from counts
  where votes=top_votes
  order by position,id
  limit 1;

  return jsonb_build_object(
    'pollId',p_poll_id,
    'winner',jsonb_build_object(
      'id',winner_row.id,
      'label',winner_row.label,
      'position',winner_row.position,
      'votes',winner_row.votes
    ),
    'tie',false,
    'topVotes',top_votes,
    'reason','winner'
  );
end;
$poll_winner$;

create or replace function public.galaxy_chat_checklist_set(
  p_checklist_id uuid,
  p_item_id uuid,
  p_person text,
  p_checked boolean,
  p_expected_item_version integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $checklist_set$
declare
  list_row public.galaxy_chat_checklists%rowtype;
  item_row public.galaxy_chat_checklist_items%rowtype;
  next_item_version integer;
  next_list_version integer;
  stamp timestamptz:=clock_timestamp();
begin
  if p_person not in ('0','1') then
    raise exception 'Persona no válida';
  end if;

  select * into list_row
  from public.galaxy_chat_checklists
  where id=p_checklist_id
  for update;

  if not found then
    raise exception 'Checklist no disponible';
  end if;

  select * into item_row
  from public.galaxy_chat_checklist_items
  where id=p_item_id and checklist_id=p_checklist_id
  for update;

  if not found then
    raise exception 'Elemento no disponible';
  end if;

  if item_row.checked=p_checked then
    return jsonb_build_object(
      'changed',false,
      'idempotent',true,
      'itemVersion',item_row.version,
      'checklistVersion',list_row.version
    );
  end if;

  if p_expected_item_version is null
     or p_expected_item_version<>item_row.version then
    raise exception 'La checklist cambió. Actualiza antes de intentarlo otra vez.';
  end if;

  update public.galaxy_chat_checklist_items
  set checked=p_checked,
      updated_by=p_person,
      version=version+1,
      updated_at=stamp
  where id=p_item_id
  returning version into next_item_version;

  update public.galaxy_chat_checklists
  set version=version+1,
      updated_at=stamp
  where id=p_checklist_id
  returning version into next_list_version;

  return jsonb_build_object(
    'changed',true,
    'idempotent',false,
    'itemVersion',next_item_version,
    'checklistVersion',next_list_version
  );
end;
$checklist_set$;

revoke all on function public.galaxy_chat_search_page(text,text,text,text,date,bigint,integer) from public,anon,authenticated;
revoke all on function public.galaxy_chat_poll_mutate(uuid,text,text,uuid,boolean) from public,anon,authenticated;
revoke all on function public.galaxy_chat_poll_winner(uuid) from public,anon,authenticated;
revoke all on function public.galaxy_chat_checklist_set(uuid,uuid,text,boolean,integer) from public,anon,authenticated;

grant execute on function public.galaxy_chat_search_page(text,text,text,text,date,bigint,integer) to service_role;
grant execute on function public.galaxy_chat_poll_mutate(uuid,text,text,uuid,boolean) to service_role;
grant execute on function public.galaxy_chat_poll_winner(uuid) to service_role;
grant execute on function public.galaxy_chat_checklist_set(uuid,uuid,text,boolean,integer) to service_role;

commit;
