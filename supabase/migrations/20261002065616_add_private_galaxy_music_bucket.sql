insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('galaxy-music','galaxy-music',false,20971520,array['audio/mpeg'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=array['audio/mpeg'];
create policy galaxy_music_read on storage.objects for select to authenticated
 using(bucket_id='galaxy-music' and public.galaxy_person() is not null);
create policy galaxy_music_add on storage.objects for insert to authenticated
 with check(bucket_id='galaxy-music' and public.galaxy_person() is not null);
create policy galaxy_music_delete on storage.objects for delete to authenticated
 using(bucket_id='galaxy-music' and public.galaxy_person() is not null);