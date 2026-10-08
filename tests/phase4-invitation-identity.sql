-- NG-FNC-007/008/009: real SQL negative cases for invitation and identity.
-- Runs ONLY against ephemeral Supabase CI. Transaction rolls back all test records.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id,email,email_confirmed_at) values
 ('e5000000-0000-4000-8000-000000000001','ng4-invite-owner@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000002','ng4-invite-partner@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000003','ng4-invite-outsider@example.invalid',now()),
 ('e5000000-0000-4000-8000-000000000004','ng4-invite-unverified@example.invalid',null);

-- Baseline is the current single-pair tenant model, NOT two independent pairs.
delete from public.galaxy_members where person='1';
insert into public.galaxy_members(person,email) values('0','ng4-invite-owner@example.invalid')
on conflict(person) do update set email=excluded.email;
delete from public.galaxy_invitation;

set local role authenticated;
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000001',true);
do $qa$
begin
 if public.galaxy_person() is distinct from '0' then raise exception 'Owner identity not established'; end if;
end $qa$;
select set_config('test.ng_invite_old',public.galaxy_invite(),true) is not null as invite_created;

-- The owner must never claim a guest link and impersonate profile 1.
do $qa$
begin
 begin
  perform public.galaxy_claim(current_setting('test.ng_invite_old'));
  raise exception 'TEST_OWNER_REDEEM_SUCCEEDED';
 exception when others then
  if sqlerrm='TEST_OWNER_REDEEM_SUCCEEDED' then raise; end if;
  if position('ya pertenece al espacio' in sqlerrm)=0 then
    raise exception 'Unexpected owner-redeem error: %',sqlerrm;
  end if;
 end;
 if public.galaxy_person() is distinct from '0' then raise exception 'Owner identity changed on claim'; end if;
end $qa$;

-- Expired token is rejected, even if its digest matches.
reset role;
update public.galaxy_invitation set expires=now()-interval '1 minute' where id=1;
set local role authenticated;
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000002',true);
do $qa$
begin
 begin
  perform public.galaxy_claim(current_setting('test.ng_invite_old'));
  raise exception 'TEST_EXPIRED_TOKEN_ACCEPTED';
 exception when others then
  if sqlerrm='TEST_EXPIRED_TOKEN_ACCEPTED' then raise; end if;
  if position('invitación no es válida o expiró' in sqlerrm)=0 then
    raise exception 'Unexpected expired-token error: %',sqlerrm;
  end if;
 end;
 if public.galaxy_person() is not null then raise exception 'Expired invite granted profile'; end if;
end $qa$;

-- Issuing a newer invitation revokes the previous digest (single-use).
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000001',true);
select set_config('test.ng_invite_revoked',public.galaxy_invite(),true) is not null as revoked_candidate_created;
select set_config('test.ng_invite_valid',public.galaxy_invite(),true) is not null as latest_invite_created;

select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000002',true);
do $qa$
begin
 begin
  perform public.galaxy_claim(current_setting('test.ng_invite_revoked'));
  raise exception 'TEST_REPLACED_TOKEN_ACCEPTED';
 exception when others then
  if sqlerrm='TEST_REPLACED_TOKEN_ACCEPTED' then raise; end if;
  if position('invitación no es válida o expiró' in sqlerrm)=0 then raise exception 'Wrong revoked-token error: %',sqlerrm; end if;
 end;
 begin
  perform public.galaxy_claim(repeat('z',72));
  raise exception 'TEST_WRONG_TOKEN_ACCEPTED';
 exception when others then
  if sqlerrm='TEST_WRONG_TOKEN_ACCEPTED' then raise; end if;
  if position('invitación no es válida o expiró' in sqlerrm)=0 then raise exception 'Wrong token error: %',sqlerrm; end if;
 end;
 if public.galaxy_person() is not null then raise exception 'Invalid invite granted profile'; end if;
end $qa$;

-- An unverified account with the valid token must still be denied.
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000004',true);
do $qa$
begin
 begin
  perform public.galaxy_claim(current_setting('test.ng_invite_valid'));
  raise exception 'TEST_UNVERIFIED_TOKEN_ACCEPTED';
 exception when others then
  if sqlerrm='TEST_UNVERIFIED_TOKEN_ACCEPTED' then raise; end if;
  if position('correo verificado' in sqlerrm)=0 then raise exception 'Unexpected unverified error: %',sqlerrm; end if;
 end;
 if public.galaxy_person() is not null then raise exception 'Unverified account granted profile'; end if;
end $qa$;

-- Correct invite grants ONLY person 1; person 0 remains mapped to owner.
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000002',true);
select public.galaxy_claim(current_setting('test.ng_invite_valid'));
do $qa$
begin
 if public.galaxy_person() is distinct from '1' then raise exception 'Invite mapped partner to wrong profile'; end if;
end $qa$;

select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000001',true);
do $qa$
begin
 if public.galaxy_person() is distinct from '0' then raise exception 'Owner profile changed after claim'; end if;
 begin
  perform public.galaxy_invite();
  raise exception 'TEST_DUPLICATE_INVITE_SUCCEEDED';
 exception when others then
  if sqlerrm='TEST_DUPLICATE_INVITE_SUCCEEDED' then raise; end if;
  if position('ya está registrada' in sqlerrm)=0 then raise exception 'Unexpected duplicate-invite error: %',sqlerrm; end if;
 end;
end $qa$;

-- A third party cannot redeem already-used guest tokens or become profile 0.
select set_config('request.jwt.claim.sub','e5000000-0000-4000-8000-000000000003',true);
do $qa$
begin
 if public.galaxy_person() is not null then raise exception 'Outsider already mapped to private couple'; end if;
 begin
  perform public.galaxy_claim(current_setting('test.ng_invite_valid'));
  raise exception 'TEST_REPLAY_INVITE_ACCEPTED';
 exception when others then
  if sqlerrm='TEST_REPLAY_INVITE_ACCEPTED' then raise; end if;
  if position('invitación no es válida o expiró' in sqlerrm)=0 then raise exception 'Unexpected replay error: %',sqlerrm; end if;
 end;
 begin
  perform public.galaxy_invite();
  raise exception 'TEST_OUTSIDER_ISSUED_INVITE';
 exception when others then
  if sqlerrm='TEST_OUTSIDER_ISSUED_INVITE' then raise; end if;
  if position('Solo el administrador puede invitar' in sqlerrm)=0 then raise exception 'Unexpected outsider-invite error: %',sqlerrm; end if;
 end;
 if public.galaxy_person() is not null then raise exception 'Outsider gained profile after replay'; end if;
end $qa$;

rollback;
