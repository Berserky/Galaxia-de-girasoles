\set ON_ERROR_STOP on

-- NG-QA-004: canonical application-schema fingerprint captured from production
-- after Phase 0 and before the additive Phase 1 migration.
do $$
declare
  got record;
begin
  with
  rels as (
    select md5(coalesce(string_agg(
      n.nspname||'.'||c.relname||':'||c.relkind::text||':'||c.relrowsecurity::text||':'||c.relforcerowsecurity::text,
      E'\n' order by n.nspname,c.relname
    ),'')) h
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p','v','m','S')
  ),
  cols as (
    select md5(coalesce(string_agg(
      table_schema||'.'||table_name||'.'||column_name||':'||data_type||':'||udt_name||':'||is_nullable||':'||
      coalesce(column_default,'')||':'||is_identity||':'||coalesce(identity_generation,''),
      E'\n' order by table_schema,table_name,ordinal_position
    ),'')) h
    from information_schema.columns where table_schema='public'
  ),
  cons as (
    select md5(coalesce(string_agg(
      conrelid::regclass::text||':'||conname||':'||contype::text||':'||pg_get_constraintdef(oid,true),
      E'\n' order by conrelid::regclass::text,conname
    ),'')) h
    from pg_constraint where connamespace='public'::regnamespace
  ),
  idx as (
    select md5(coalesce(string_agg(pg_get_indexdef(i.indexrelid),E'\n' order by i.indexrelid::regclass::text),'')) h
    from pg_index i join pg_class t on t.oid=i.indrelid join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public'
  ),
  funcs as (
    select md5(coalesce(string_agg(pg_get_functiondef(p.oid),E'\n' order by p.proname,pg_get_function_identity_arguments(p.oid)),'')) h
    from pg_proc p where p.pronamespace='public'::regnamespace
  ),
  pols as (
    select md5(coalesce(string_agg(
      schemaname||'.'||tablename||':'||policyname||':'||permissive||':'||roles::text||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''),
      E'\n' order by schemaname,tablename,policyname
    ),'')) h
    from pg_policies where schemaname in ('public','storage')
  ),
  trgs as (
    select md5(coalesce(string_agg(pg_get_triggerdef(t.oid,true),E'\n' order by t.tgrelid::regclass::text,t.tgname),'')) h
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal
  ),
  buckets as (
    select md5(coalesce(string_agg(
      id||':'||name||':'||public::text||':'||coalesce(file_size_limit::text,'')||':'||coalesce(allowed_mime_types::text,''),
      E'\n' order by id
    ),'')) h
    from storage.buckets where id like 'galaxy-%'
  )
  select rels.h rels,cols.h cols,cons.h constraints,idx.h indexes,funcs.h functions,
         pols.h policies,trgs.h triggers,buckets.h buckets,
         md5(concat_ws('|',rels.h,cols.h,cons.h,idx.h,funcs.h,pols.h,trgs.h,buckets.h)) overall
    into got
  from rels,cols,cons,idx,funcs,pols,trgs,buckets;

  if got.rels<>'9de4872cdacee209d30226bc1e641189'
     or got.cols<>'42929171d34bf0436fca01a7e8effdfe'
     or got.constraints<>'b3642ae529d56adb5424a8792986f24f'
     or got.indexes<>'16007d6bf19d6d6fa463e95330323cfe'
     or got.functions<>'6cc0a9162c7a95e0b28e1c02bb75e708'
     or got.policies<>'49d1e533322e0f95e94aaef7fbff26f1'
     or got.triggers<>'018eff650c9e910786731d170a7a8bc8'
     or got.buckets<>'f9f42d7d1b2912d407e013d1238460b3'
     or got.overall<>'96ff423c96fb7b6acb2fb0234d32940d' then
    raise exception 'NG-QA-004 schema parity mismatch. got=%',row_to_json(got);
  end if;
  raise notice 'NG-QA-004 schema parity OK: %',got.overall;
end $$;
