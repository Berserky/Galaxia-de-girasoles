create table if not exists public.galaxy_home_catalog(item_key text primary key,price integer not null check(price>=0));
revoke all on public.galaxy_home_catalog from anon,authenticated;
insert into public.galaxy_home_catalog(item_key,price) values
('sofa',70),('plant',25),('lamp',30),('rug',40),('table',45),('tv',80),('fridge',80),('stove',70),('bed',90),('desk',60),('chair',30),('books',25),('shower',60),('mirror',35),('sunflower',20),('frame',35),('catbed',40),('coffee',45),('nightstand',35),('wardrobe',70),('album',50),('recordplayer',60),('wallcalendar',45),('memorybox',50),('planner',45),('telephone',40),
('ruground',40),('floorlamp',35),('tablelamp',25),('smallplant',20),('bookcase',75),('tvcabinet',60),('vintagetv',55),('toilet',55),('bathroomsink',50),('bathtub',80),('kitchensink',60),('kitchencabinet',50),('microwave',40),('laptop',55),('monitor',50),('speaker',35)
on conflict(item_key) do update set price=excluded.price;
create or replace function public.galaxy_home_buy(item_key text,cost integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person();h public.galaxy_home;n integer;real_cost integer;
begin
 if p is null then raise exception 'Acceso no autorizado'; end if;
 select price into real_cost from public.galaxy_home_catalog where galaxy_home_catalog.item_key=galaxy_home_buy.item_key;
 if real_cost is null then raise exception 'Objeto no válido'; end if;
 select * into h from public.galaxy_home where id=1 for update;
 if h.coins<real_cost then raise exception 'No tienen suficientes Monedas Girasol'; end if;
 n:=coalesce((h.inventory->>item_key)::integer,0)+1;
 update public.galaxy_home set coins=coins-real_cost,inventory=jsonb_set(inventory,array[item_key],to_jsonb(n),true),version=version+1 where id=1;
 return public.galaxy_home_state();
end $$;