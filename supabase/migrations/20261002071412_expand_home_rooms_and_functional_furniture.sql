create or replace function public.galaxy_home_buy(item_key text,cost integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); h public.galaxy_home; n integer;
begin
 if p is null then raise exception 'Acceso no autorizado'; end if;
 if item_key not in ('sofa','plant','lamp','rug','table','tv','fridge','stove','bed','desk','chair','books','shower','mirror','sunflower','frame','catbed','coffee','nightstand','wardrobe','album','recordplayer','wallcalendar','memorybox','planner','telephone') then raise exception 'Objeto no válido'; end if;
 if cost not in (20,25,30,35,40,45,50,60,70,80,90) then raise exception 'Precio no válido'; end if;
 select * into h from public.galaxy_home where id=1 for update;
 if h.coins<cost then raise exception 'No tienen suficientes Monedas Girasol'; end if;
 n:=coalesce((h.inventory->>item_key)::integer,0)+1;
 update public.galaxy_home set coins=coins-cost,inventory=jsonb_set(inventory,array[item_key],to_jsonb(n),true),version=version+1 where id=1;
 return public.galaxy_home_state();
end $$;
create or replace function public.galaxy_home_place(item_key text,room_key text,slot integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text:=public.galaxy_person(); h public.galaxy_home; owned integer; used integer;
begin
 if p is null then raise exception 'Acceso no autorizado'; end if;
 if room_key not in ('living','kitchen','hall','shared','sebas','adri','bath','studio','balcony') or slot not between 0 and 7 then raise exception 'Lugar no válido'; end if;
 select * into h from public.galaxy_home where id=1 for update;
 owned:=coalesce((h.inventory->>item_key)::integer,0);
 select count(*) into used from jsonb_array_elements(h.placed) x where x->>'item'=item_key;
 if owned<=used then raise exception 'Primero compren este objeto en la tienda'; end if;
 h.placed:=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(h.placed) x where not (x->>'room'=room_key and (x->>'slot')::integer=slot));
 h.placed:=h.placed||jsonb_build_array(jsonb_build_object('item',item_key,'room',room_key,'slot',slot,'by',p));
 update public.galaxy_home set placed=h.placed,version=version+1 where id=1;
 return public.galaxy_home_state();
end $$;