-- Run as postgres after migration. All fixtures and changes roll back.
-- Assertions inspect only their own generated fixture IDs and emit no private data.
begin;
do $$
declare one uuid:=gen_random_uuid(); two uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); quiz uuid; note uuid; result jsonb; failed boolean;
begin
 insert into auth.users(id,email,email_confirmed_at) values(one,'bond-probe-one-'||one||'@example.invalid',now()),(two,'bond-probe-two-'||two||'@example.invalid',now()),(outsider,'bond-probe-out-'||outsider||'@example.invalid',now());
 update public.galaxy_members set email='bond-probe-one-'||one||'@example.invalid' where person='0';
 insert into public.galaxy_members(person,email) values('0','bond-probe-one-'||one||'@example.invalid') on conflict(person) do nothing;
 update public.galaxy_members set email='bond-probe-two-'||two||'@example.invalid' where person='1';
 insert into public.galaxy_members(person,email) values('1','bond-probe-two-'||two||'@example.invalid') on conflict(person) do nothing;
 if has_table_privilege('authenticated','public.galaxy_bond','SELECT') or has_table_privilege('anon','public.galaxy_bond','SELECT') then raise exception 'FAIL direct bond table grants';end if;
 if has_function_privilege('authenticated','public.galaxy_bond_gesture_device(text,text)','EXECUTE') or has_function_privilege('anon','public.galaxy_bond_read()','EXECUTE') then raise exception 'FAIL RPC role grants';end if;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',one::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',one,'role','authenticated')::text,true);
 result:=public.galaxy_bond_save('game','{"questionId":"comfort","answer":"Un abrazo"}'::jsonb);quiz:=(result->>'id')::uuid;
 result:=public.galaxy_bond_save('sharednote','{"title":"Fixture","body":"First"}'::jsonb);note:=(result->>'id')::uuid;
 failed:=false;begin perform public.galaxy_bond_guess(quiz,'Un abrazo');exception when others then failed:=true;end;if not failed then raise exception 'FAIL own guess accepted';end if;
 failed:=false;begin perform public.galaxy_bond_save('game','{"questionId":"comfort","answer":"Un abrazo","guess":"Un abrazo"}');exception when others then failed:=true;end;if not failed then raise exception 'FAIL client-controlled guess accepted';end if;
 failed:=false;begin perform public.galaxy_bond_save('voice','{"title":"Fixture","body":"","audioPath":"1/00000000-0000-0000-0000-000000000000.mp3","mime":"audio/mpeg"}');exception when others then failed:=true;end;if not failed then raise exception 'FAIL foreign voice accepted';end if;
 failed:=false;begin perform public.galaxy_bond_save('voice','{"title":"Fixture","body":"","audioPath":"0/00000000-0000-0000-0000-000000000000.mp3","mime":"audio/mpeg"}');exception when others then failed:=true;end;if not failed then raise exception 'FAIL absent voice object accepted';end if;
 perform set_config('request.jwt.claim.sub',two::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',two,'role','authenticated')::text,true);
 select entry into result from jsonb_array_elements(public.galaxy_bond_read()->'entries') entry where entry->>'id'=quiz::text;
 if result->'data'?'answer' then raise exception 'FAIL hidden answer leaked';end if;
 failed:=false;begin execute 'select data from public.galaxy_bond limit 1';exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'FAIL direct table read accepted';end if;
 result:=public.galaxy_bond_guess(quiz,'Un abrazo');if result->'data'->>'answer'<>'Un abrazo' or result->'data'->>'correct'<>'true' then raise exception 'FAIL guess reveal';end if;
 failed:=false;begin perform public.galaxy_bond_guess(quiz,'Algo rico');exception when others then failed:=true;end;if not failed then raise exception 'FAIL repeated guess accepted';end if;
 result:=public.galaxy_bond_update(note,1,'{"title":"Fixture","body":"Together"}');if result->>'version'<>'2' then raise exception 'FAIL version increment';end if;
 failed:=false;begin perform public.galaxy_bond_update(note,1,'{"title":"Fixture","body":"Lost update"}');exception when others then failed:=true;end;if not failed then raise exception 'FAIL stale update accepted';end if;
 failed:=false;begin perform public.galaxy_bond_delete(quiz,2);exception when others then failed:=true;end;if not failed then raise exception 'FAIL foreign deletion accepted';end if;
 failed:=false;begin perform public.galaxy_bond_widget('https://example.invalid/fixture.jpg');exception when others then failed:=true;end;if not failed then raise exception 'FAIL external widget photo accepted';end if;
 perform set_config('request.jwt.claim.sub',outsider::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 failed:=false;begin perform public.galaxy_bond_read();exception when others then failed:=true;end;if not failed then raise exception 'FAIL outsider read accepted';end if;
 failed:=false;begin perform public.galaxy_bond_save('gesture','{"gesture":"hug"}');exception when others then failed:=true;end;if not failed then raise exception 'FAIL outsider write accepted';end if;
 execute 'reset role';execute 'set local role anon';
 failed:=false;begin perform public.galaxy_bond_read();exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'FAIL anonymous RPC accepted';end if;
 execute 'reset role';
end $$;
rollback;
