create or replace function public.galaxy_claim(token text) returns void language plpgsql security definer set search_path='' as $$
declare invitation public.galaxy_invitation; mail text;
begin
 select lower(email) into mail from auth.users where id=auth.uid() and email_confirmed_at is not null;
 if mail is null then raise exception 'Entra con un correo verificado'; end if;
 if public.galaxy_person() is not null then raise exception 'Esta cuenta ya pertenece al espacio'; end if;
 select * into invitation from public.galaxy_invitation where id=1 for update;
 if token is null or length(token)<>72 or invitation.digest is null or invitation.expires<now() or invitation.digest is distinct from encode(sha256(convert_to(token,'UTF8')),'hex') then raise exception 'La invitación no es válida o expiró'; end if;
 insert into public.galaxy_members(person,email) values('1',mail);
 delete from public.galaxy_invitation where id=1;
end $$;