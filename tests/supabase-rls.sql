-- Integración transaccional; todos los datos de prueba se deshacen con ROLLBACK.
begin;
insert into auth.users(id,email,email_confirmed_at) values
 ('a0000000-0000-4000-8000-000000000001','owner@example.invalid',now()),
 ('a0000000-0000-4000-8000-000000000002','partner@example.invalid',now()),
 ('a0000000-0000-4000-8000-000000000003','outsider@example.invalid',now());
update public.galaxy_members set email='owner@example.invalid' where person='0';
set local role authenticated;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
do $$ begin
 if public.galaxy_person() is not null then raise exception 'Outsider admitted'; end if;
 if exists(select 1 from public.galaxy_settings) then raise exception 'Settings exposed'; end if;
 if exists(select 1 from public.galaxy_daily_read()) then raise exception 'Answers exposed'; end if;
 begin perform public.galaxy_invite(); raise exception 'Outsider invitation allowed';
 exception when raise_exception then if sqlerrm='Outsider invitation allowed' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
select set_config('test.invitation',public.galaxy_invite(),true) is not null as invitation_generated;
select public.galaxy_daily_save('answer','Owner private answer');
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
do $$ begin
 begin perform public.galaxy_claim(null); raise exception 'Null invitation accepted';
 exception when raise_exception then if sqlerrm='Null invitation accepted' then raise; end if; end;
end $$;
select public.galaxy_claim(current_setting('test.invitation'));
do $$ begin
 if public.galaxy_person() is distinct from '1' then raise exception 'Partner claim failed'; end if;
 if exists(select 1 from public.galaxy_daily_read() where person='0' and answer is not null) then raise exception 'Answer revealed early'; end if;
end $$;
select public.galaxy_daily_save('answer','Partner private answer');
do $$ begin
 if (select count(*) from public.galaxy_daily_read() where day=(now() at time zone 'America/Bogota')::date and answer is not null)<>2 then raise exception 'Answers not revealed'; end if;
 begin perform public.galaxy_invite(); raise exception 'Partner can invite';
 exception when raise_exception then if sqlerrm='Partner can invite' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
do $$ begin
 begin perform public.galaxy_claim(current_setting('test.invitation')); raise exception 'Invitation reused';
 exception when raise_exception then if sqlerrm='Invitation reused' then raise; end if; end;
 if exists(select 1 from storage.objects where bucket_id='galaxy-photos') then raise exception 'Photos exposed'; end if;
end $$;
rollback;
