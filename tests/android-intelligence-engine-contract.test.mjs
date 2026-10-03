import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const schema=read('supabase/schema.sql');
const edge=read('supabase/functions/android-companion/index.ts');
const app=read('android/app/src/main/assets/mobile/app.js');
const search=read('android/app/src/main/assets/mobile/search.js');
const css=read('android/app/src/main/assets/mobile/app.css');
const main=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const qa=read('scripts/qa-android-mobile.mjs');
const enginePath=new URL('../supabase/functions/android-companion/intelligence-engine.ts',import.meta.url);

test('Intelligence uses pgvector and one Postgres search index',()=>{
 assert.ok(existsSync(enginePath));
 assert.ok(schema.includes('create extension if not exists vector'));
 assert.ok(schema.includes('extensions.vector(384)'));
 assert.ok(schema.includes('using hnsw'));
 assert.ok(schema.includes('galaxy_intelligence_documents'));
 assert.equal(/pinecone|weaviate|qdrant|milvus/i.test(schema+edge),false);
});

test('hybrid SQL prioritizes exact then full text and semantic vector similarity',()=>{
 assert.ok(schema.includes('galaxy_intelligence_hybrid_search'));
 assert.ok(schema.includes('ts_rank_cd'));
 assert.ok(schema.includes('<=>'));
 assert.ok(schema.includes('exact_rank'));
 assert.ok(schema.includes('semantic_rank'));
 assert.ok(schema.includes('fulltext_rank'));
});

test('Intelligence documents have privacy columns and never require exact coordinates',()=>{
 for(const column of ['owner_person','visible_after','searchable','content_hash','embedding_status'])assert.ok(schema.includes(column),column);
 const block=schema.slice(schema.indexOf('create table if not exists public.galaxy_intelligence_documents'),schema.indexOf('create table if not exists public.galaxy_voice_transcripts'));
 assert.equal(/latitude|longitude|coordinate/i.test(block),false);
});

test('voice transcripts are independent and cascade only from voice row',()=>{
 assert.ok(schema.includes('create table if not exists public.galaxy_voice_transcripts'));
 assert.ok(schema.includes('bond_id uuid'));
 assert.ok(schema.includes('references public.galaxy_bond(id) on delete cascade'));
 assert.ok(edge.includes('intelligence-transcribe'));
 assert.ok(edge.includes('intelligence-transcript-delete'));
 const deleteBlock=edge.slice(edge.indexOf('async function intelligenceTranscriptDelete'),edge.indexOf('async function intelligenceBook'));
 assert.equal(deleteBlock.includes('storage.from("galaxy-voice").remove'),false);
 assert.equal(deleteBlock.includes('galaxy_bond").delete'),false);
});

test('incremental indexing hooks create update and delete paths',()=>{
 assert.ok(edge.includes('syncIntelligenceItem(updated)'));
 assert.ok(edge.includes('syncIntelligenceItem(created)'));
 assert.ok(edge.includes('deleteIntelligenceSource("item"'));
 assert.ok(edge.includes('syncIntelligenceDaily'));
 assert.ok(edge.includes('syncIntelligencePlace'));
 assert.ok(edge.includes('syncIntelligenceGoal'));
 assert.ok(edge.includes('syncIntelligenceBond'));
 assert.ok(edge.includes('syncIntelligenceTrip'));
 assert.ok(edge.includes('operation==="rebuild"'));
});

test('embedding generation uses Supabase gte-small and gracefully degrades',()=>{
 assert.ok(edge.includes('gte-small'));
 assert.ok(edge.includes('embedding_status'));
 assert.ok(edge.includes('embedding-error'));
 assert.ok(edge.includes('fallback'));
});

test('generative and transcription secrets are backend-only and usage limited',()=>{
 assert.ok(edge.includes('OPENAI_API_KEY'));
 assert.ok(edge.includes('GALAXY_AI_MODEL'));
 assert.ok(edge.includes('GALAXY_TRANSCRIBE_MODEL'));
 assert.ok(edge.includes('galaxy_intelligence_usage'));
 assert.equal(app.includes('OPENAI_API_KEY'),false);
 assert.equal(main.includes('OPENAI_API_KEY'),false);
});

test('semantic Q&A, connections, narrator and book actions exist end-to-end',()=>{
 for(const action of ['intelligence-search','intelligence-ask','intelligence-connections','intelligence-narrate','intelligence-book','intelligence-transcribe','intelligence-transcript-delete','intelligence-index'])
  assert.ok(edge.includes('action==="'+action+'"'),action);
 for(const action of ['intelligence-search','intelligence-ask','intelligence-connections','intelligence-narrate','intelligence-book','intelligence-transcribe','intelligence-transcript-delete','intelligence-index'])
  assert.ok(main.includes('"'+action+'"'),action);
});

test('classic search remains present and UI explicitly falls back to it',()=>{
 assert.ok(search.includes('function searchUniverse('));
 assert.ok(app.includes('GalaxySearch.searchUniverse'));
 assert.ok(app.includes('fallback'));
 assert.ok(app.includes('Nuestra IA 2.0'));
});

test('UI exposes Intelligence as first-class navigation plus semantic tools',()=>{
 assert.ok(app.includes("['ai','IA']"),'Galaxy Intelligence debe ser visible en navegación principal');
 assert.ok(app.includes("if(view==='ai'){app.innerHTML=header()+intelligenceHubView()"),'La pestaña IA debe renderizar una vista propia');
 assert.ok(app.includes('function intelligenceHubView('),'Falta hub visible de Galaxy Intelligence');
 for(const marker of ['Nuestra IA 2.0','IA de conexiones','IA narradora','Libro de Nuestra Galaxia','Transcribir','Eliminar transcripción'])
  assert.ok(app.includes(marker),marker);
 assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Intelligence Engine */'));
});

test('book includes requested chapters and does not require PDF',()=>{
 for(const marker of ['Inicio','Primeras veces','Citas','Viajes','Lugares','Música','Fotos','Frases','Estadísticas','Capítulos narrativos'])
  assert.ok(app.includes(marker)||edge.includes(marker),marker);
 assert.equal(edge.includes('pdf-lib'),false);
});

test('locked partner content is filtered before retrieval/provider context',()=>{
 assert.ok(schema.includes('visible_after'));
 assert.ok(schema.includes('owner_person'));
 assert.ok(edge.includes('intelligenceVisible'));
 assert.ok(edge.includes('minimalContext'));
});

test('mobile QA guards Galaxy Intelligence Engine',()=>{
 assert.ok(qa.includes('Galaxy Intelligence Engine'));
 assert.ok(qa.includes('pgvector'));
 assert.ok(qa.includes('intelligence-search'));
 assert.ok(qa.includes('intelligence-engine.ts'));
});
