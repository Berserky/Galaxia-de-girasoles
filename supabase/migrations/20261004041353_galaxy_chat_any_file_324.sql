-- Galaxy Chat 3.2.4: the private chat bucket accepts any MIME type.
-- Uploads remain authenticated by the device-token Edge Function and capped server-side.
update storage.buckets
set allowed_mime_types=null
where id='galaxy-chat-media';
