import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const url=new URL('../supabase/functions/android-companion/intelligence-engine.ts',import.meta.url);
const exists=existsSync(url);
test('Galaxy Intelligence pure engine exists',()=>assert.equal(exists,true));

let api={};
if(exists){
 const source=readFileSync(url,'utf8');
 const code=stripTypeScriptTypes(source.replace(/\bexport\s+/g,''));
 const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON,crypto:{subtle:{}}};
 vm.runInNewContext(code+'\n;module.exports={normalizeSearchText,buildIntelligenceDocument,mergeHybridRanks,explainConnection,validateNarrative,bookSections,sanitizeTranscriptSegments,contentHashInput};',context);
 api=context.module.exports;
}

test('search normalization removes accents but preserves names and numbers',()=>{
 assert.equal(api.normalizeSearchText('  ÚTICA 2.0 — Sebastián  '),'utica 2 0 sebastian');
 assert.equal(api.normalizeSearchText('Pesca & Café'),'pesca cafe');
});

test('item projection indexes searchable history without raw coordinates',()=>{
 const doc=api.buildIntelligenceDocument('item',{
  id:'m1',kind:'memory',author:'0',version:3,created:'2026-08-03T12:00:00Z',
  data:{title:'Pesca en Útica',body:'Fuimos con una rueda de nailon.',date:'2026-06-15',placeName:'Útica',latitude:4.7,longitude:-74.5}
 },{today:'2026-10-03'});
 assert.equal(doc.sourceType,'memory');
 assert.equal(doc.sourceId,'m1');
 assert.ok(doc.content.includes('rueda de nailon'));
 assert.equal(JSON.stringify(doc).includes('4.7'),false);
 assert.equal(JSON.stringify(doc).includes('-74.5'),false);
});

test('future capsule remains owner-only until its date',()=>{
 const doc=api.buildIntelligenceDocument('item',{
  id:'c1',kind:'capsule',author:'0',version:1,created:'2026-10-01T12:00:00Z',
  data:{title:'Sorpresa',body:'Secreto',date:'2026-12-01'}
 },{today:'2026-10-03'});
 assert.equal(doc.ownerPerson,'0');
 assert.equal(doc.visibleAfter,'2026-12-01');
});

test('place-unlock surprise never exposes hidden coordinates or semantic text to partner',()=>{
 const doc=api.buildIntelligenceDocument('item',{
  id:'n1',kind:'note',author:'1',version:1,created:'2026-10-01T12:00:00Z',
  data:{title:'Sorpresa guardada',body:'Mensaje secreto',surprise:true,unlockType:'place',latitude:4.61,longitude:-74.08,radius:150}
 },{today:'2026-10-03'});
 assert.equal(doc.ownerPerson,'1');
 assert.equal(doc.visibleAfter,null);
 assert.equal(JSON.stringify(doc).includes('4.61'),false);
 assert.equal(JSON.stringify(doc).includes('-74.08'),false);
});

test('place projection never embeds coordinates',()=>{
 const doc=api.buildIntelligenceDocument('place',{id:7,name:'Nuestro parque',kind:'memory',note:'Donde pintamos',latitude:4.7,longitude:-74.1,created_at:'2026-06-01T00:00:00Z'});
 assert.equal(doc.sourceType,'place');
 assert.equal(doc.title,'Nuestro parque');
 assert.equal(JSON.stringify(doc).includes('-74.1'),false);
});

test('trip projection keeps semantic summary but not GPS points',()=>{
 const doc=api.buildIntelligenceDocument('trip',{id:11,person:'0',started_at:'2026-06-01T10:00:00Z',ended_at:'2026-06-01T12:00:00Z',distance_m:35000,duration_s:7200,dominant_motion:'vehicle',max_speed:15,latitude:4.7});
 assert.equal(doc.sourceType,'trip');
 assert.ok(doc.content.includes('35'));
 assert.ok(doc.content.includes('vehicle'));
 assert.equal(JSON.stringify(doc).includes('latitude'),false);
});

test('voice transcript projection is separate from original audio',()=>{
 const doc=api.buildIntelligenceDocument('voice-transcript',{bondId:'b1',author:'1',title:'Te pienso',text:'Nos vemos en Útica',segments:[{start:0,end:3,text:'Nos vemos'}],created_at:'2026-09-01T00:00:00Z'});
 assert.equal(doc.sourceType,'voice-transcript');
 assert.equal(doc.sourceId,'b1');
 assert.ok(doc.content.includes('Nos vemos en Útica'));
 assert.equal(JSON.stringify(doc).includes('audioPath'),false);
});

test('exact matches always outrank weaker full text and semantic matches',()=>{
 const rows=api.mergeHybridRanks({
  exact:[{id:'exact',score:1}],
  fulltext:[{id:'semantic',score:.9},{id:'exact',score:.4}],
  semantic:[{id:'semantic',score:.99},{id:'other',score:.96}]
 },10);
 assert.equal(rows[0].id,'exact');
 assert.ok(rows[0].score>rows[1].score);
});

test('hybrid merge deduplicates the same source deterministically',()=>{
 const rows=api.mergeHybridRanks({exact:[],fulltext:[{id:'a',score:.8},{id:'a',score:.7}],semantic:[{id:'a',score:.9},{id:'b',score:.7}]},10);
 assert.deepEqual(Array.from(rows.map(x=>x.id)),['a','b']);
});

test('connection explanation uses explicit reasons, never opaque similarity only',()=>{
 const a={sourceType:'song',title:'Canción X',occurredOn:'2026-06-10',metadata:{placeName:'Útica',tripId:'t1'}};
 const b={sourceType:'memory',title:'Viaje a Útica',occurredOn:'2026-06-11',metadata:{placeName:'Útica',tripId:'t1'}};
 const reasons=api.explainConnection(a,b,.84);
 assert.ok(reasons.some(x=>/Útica/i.test(x)));
 assert.ok(reasons.some(x=>/viaje|recorrido/i.test(x)));
 assert.ok(reasons.some(x=>/semánt/i.test(x)));
});

test('narrative validation rejects invented/unknown source ids',()=>{
 const allowed=[{sourceId:'m1'},{sourceId:'m2'},{sourceId:'m3'}];
 assert.throws(()=>api.validateNarrative({title:'Capítulo',paragraphs:[{text:'Algo',sourceIds:['m1','fake']}]},allowed),/fuente/i);
});

test('narrative validation accepts 5-10-source grounded paragraphs',()=>{
 const allowed=Array.from({length:5},(_,i)=>({sourceId:'m'+(i+1)}));
 const out=api.validateNarrative({title:'Un capítulo',paragraphs:[{text:'Fuimos aprendiendo juntos.',sourceIds:['m1','m2']},{text:'Después llegaron nuevos momentos.',sourceIds:['m3','m4','m5']}]},allowed);
 assert.equal(out.paragraphs.length,2);
 assert.deepEqual(Array.from(out.sourceIds),['m1','m2','m3','m4','m5']);
});

test('book v1 has the requested internal sections and future-export-safe ids',()=>{
 const sections=api.bookSections();
 for(const id of ['beginning','firsts','dates','trips','places','music','photos','quotes','stats','narrative'])assert.ok(sections.some(x=>x.id===id),id);
 assert.ok(sections.every(x=>/^[a-z-]+$/.test(x.id)));
});

test('transcript segments are bounded, ordered and optional',()=>{
 const out=api.sanitizeTranscriptSegments([{start:3,end:5,text:'dos'},{start:0,end:2,text:'uno'},{start:-5,end:999999,text:' x '.repeat(500)}]);
 assert.equal(out[0].start,0);
 assert.ok(out[0].end<=86400);
 assert.ok(out.every(x=>x.text.length<=500));
});

test('content hash input is stable and changes after edits',()=>{
 const a=api.contentHashInput({sourceType:'memory',sourceId:'m1',title:'A',content:'B',occurredOn:'2026-01-01',metadata:{x:1}});
 const b=api.contentHashInput({sourceType:'memory',sourceId:'m1',title:'A',content:'B',occurredOn:'2026-01-01',metadata:{x:1}});
 const edited=api.contentHashInput({sourceType:'memory',sourceId:'m1',title:'A',content:'C',occurredOn:'2026-01-01',metadata:{x:1}});
 assert.equal(a,b);assert.notEqual(a,edited);
});
