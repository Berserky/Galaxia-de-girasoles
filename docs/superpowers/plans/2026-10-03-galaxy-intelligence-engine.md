# Galaxy Intelligence Engine — Mega Update 3.0

Branch: `aegiron/mega-update-3.0`
Production and remote Supabase: untouched.

## Search architecture

Classic local search remains available and is never removed.

Backend hybrid search:
1. normalized exact title/content match (highest priority);
2. PostgreSQL full-text rank;
3. pgvector semantic similarity;
4. reciprocal-rank fusion with an explicit exact-match boost.

Embeddings use Supabase Edge built-in `gte-small` (384 dimensions), so semantic search does not need a second vector database or an external embedding API.

## Intelligence documents

A relational `galaxy_intelligence_documents` table stores only a searchable projection:
- source_type/source_id/version;
- title/content/date;
- sanitized metadata;
- normalized full-text vector;
- 384d embedding;
- content hash / embedding status.

Raw coordinates are never projected. Place documents contain name/kind/note only; trip documents contain dates/distance/duration/motion only.

Privacy is represented in dedicated columns:
- owner_person;
- visible_after;
- searchable.

Locked surprise-place content is owner-only. Future date content becomes searchable for the partner only after the unlock date. Daily answers are indexed only when both answers exist.

## Incremental indexing

All existing Edge mutation paths enqueue/sync the affected projection:
- galaxy_items create/update/delete;
- daily answer updates;
- places create/update/delete;
- completed trip history;
- goals create/update/delete;
- Bond shared notes / voice;
- voice transcript create/delete;
- optional photo context create/delete.

Unchanged content hashes are not re-embedded.
A bounded `rebuild` operation exists for migration/recovery.

## Provider

Embeddings: Supabase built-in `gte-small`.

Optional generative/transcription provider:
- secret: `OPENAI_API_KEY` (Edge environment only);
- `GALAXY_AI_MODEL` controls narrative/Q&A generation;
- `GALAXY_TRANSCRIBE_MODEL` controls transcription;
- no provider key or service secret is returned to Android/WebView.

If the provider is unavailable or errors:
- hybrid search still works;
- Q&A returns grounded search results/fallback;
- narrator explicitly reports that generation is unavailable rather than inventing;
- original audio is untouched.

## Voice 2.0

`galaxy_voice_transcripts` stores transcript separately from galaxy_bond/audio:
- transcript text;
- optional timestamp segments;
- provider/model/status;
- created/updated timestamps.

Deleting transcript deletes only transcript + semantic projection, never the audio object or galaxy_bond voice row.

## Connections

Connections are explainable:
- explicit source links/references;
- shared place/date/period;
- semantic similarity.

Every connection returns `reasons[]`.

## Narrator and book

Narrator accepts 5–10 retrieved memory-like sources only.
Generated output must reference valid source IDs; invalid citations make the response fail closed.

Book v1 is an internal structured view:
- Inicio
- Primeras veces
- Citas
- Viajes
- Lugares
- Música
- Fotos
- Frases
- Estadísticas
- Capítulos narrativos

The data contract is designed for future PDF export, but no PDF is produced in Galaxy 6.

## Limits

Paid AI calls have server-side daily limits and bounded input/output.
Only the minimal retrieved snippets are sent to the provider.
