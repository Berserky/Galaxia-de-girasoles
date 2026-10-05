create table public.galaxy_home (
 id integer primary key check(id=1),
 coins integer not null default 180 check(coins>=0),
 inventory jsonb not null default '{}'::jsonb check(jsonb_typeof(inventory)='object'),
 placed jsonb not null default '[]'::jsonb check(jsonb_typeof(placed)='array'),
 version integer not null default 1
);
insert into public.galaxy_home(id,coins) values(1,180);
alter table public.galaxy_home enable row level security;
revoke all on public.galaxy_home from anon,authenticated;

create table public.galaxy_rewards(
 id bigint generated always as identity primary key,
 person text not null check(person in ('0','1')),
 reward_key text not null,
 day date not null default ((now() at time zone 'America/Bogota')::date),
 coins integer not null check(coins between 1 and 100),
 created timestamptz not null default now(),
 unique(person,reward_key,day)
);
alter table public.galaxy_rewards enable row level security;
revoke all on public.galaxy_rewards from anon,authenticated;

create function public.galaxy_home_state() returns jsonb language sql stable security definer set search_path='' as $$
 select case when public.galaxy_person() is null then null else
 jsonb_build_object('coins',h.coins,'inventory',h.inventory,'placed',h.placed,'version',h.version,
 'recent',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (select person,reward_key,coins,created from public.galaxy_rewards order by created desc limit 12)x))
 end from public.galaxy_home h where h.id=1
$$;

create function public.galaxy_reward(reward_key text, amount integer) returns integer language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); d date:=(now() at time zone 'America/Bogota')::date; gained integer:=0;
begin
 if p is null then raise exception 'Acceso no autorizado'; end if;
 if reward_key not in ('daily_mood','daily_answer','photo','memory','plan_done','event') then raise exception 'Actividad no válida'; end if;
 if amount<1 or amount>25 then raise exception 'Recompensa no válida'; end if;
 begin insert into public.galaxy_rewards(person,reward_key,day,coins) values(p,reward_key,d,amount); gained:=amount;
 exception when unique_violation then gained:=0; end;
 if gained>0 then update public.galaxy_home set coins=coins+gained,version=version+1 where id=1; end if;
 return gained;
end $$;

create function public.galaxy_home_buy(item_key text,cost integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); h public.galaxy_home; n integer;
begin
 if p is null then raise exception 'Acceso no autorizado'; end if;
 if item_key not in ('sofa','plant','lamp','rug','table','tv','fridge','stove','bed','desk','chair','books','shower','mirror','sunflower','frame','catbed','coffee','nightstand','wardrobe') then raise exception 'Objeto no válido'; end if;
 if cost not in (20,25,30,35,40,45,50,60,70,80,90) then raise exception 'Precio no válido'; end if;
 select * into h from public.galaxy_home where id=1 for update;
 if h.coins<cost then raise exception 'No tienen suficientes Monedas Girasol'; end if;
 n:=coalesce((h.inventory->>item_key)::integer,0)+1;
 update public.galaxy_home set coins=coins-cost,inventory=jsonb_set(inventory,array[item_key],to_jsonb(n),true),version=version+1 where id=1;
 return public.galaxy_home_state();
end $$;

create function public.galaxy_home_place(item_key text,room_key text,slot integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); h public.galaxy_home; owned integer; used integer;
begin
 if p is null then raise exception 'Acceso no autorizado'; end if;
 if room_key not in ('living','kitchen','shared','sebas','adri','bath') or slot not between 0 and 7 then raise exception 'Lugar no válido'; end if;
 select * into h from public.galaxy_home where id=1 for update;
 owned:=coalesce((h.inventory->>item_key)::integer,0);
 select count(*) into used from jsonb_array_elements(h.placed) x where x->>'item'=item_key;
 if owned<=used then raise exception 'Primero compren este objeto en la tienda'; end if;
 h.placed:=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(h.placed) x where not (x->>'room'=room_key and (x->>'slot')::integer=slot));
 h.placed:=h.placed||jsonb_build_array(jsonb_build_object('item',item_key,'room',room_key,'slot',slot,'by',p));
 update public.galaxy_home set placed=h.placed,version=version+1 where id=1;
 return public.galaxy_home_state();
end $$;

revoke all on function public.galaxy_home_state(),public.galaxy_reward(text,integer),public.galaxy_home_buy(text,integer),public.galaxy_home_place(text,text,integer) from public,anon;
grant execute on function public.galaxy_home_state(),public.galaxy_reward(text,integer),public.galaxy_home_buy(text,integer),public.galaxy_home_place(text,text,integer) to authenticated;