-- Simula un documento huérfano existente antes de instalar Phase 0.
insert into public.galaxy_intelligence_documents(
 source_type,source_id,source_version,title,content,metadata,searchable,content_hash,embedding_status
) values(
 'place','999999999','legacy','Huérfano previo','No debe sobrevivir a reconciliación','{}'::jsonb,true,'qa-preexisting-orphan','pending'
)
on conflict(source_type,source_id) do update set content_hash=excluded.content_hash;
