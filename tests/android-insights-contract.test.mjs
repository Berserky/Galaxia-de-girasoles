import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const source=readFileSync(new URL('../supabase/functions/android-companion/insights.ts',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/android-companion/index.ts',import.meta.url),'utf8');
const main=readFileSync(new URL('../android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/qa-android-mobile.mjs',import.meta.url),'utf8');
const code=stripTypeScriptTypes(source.replace(/\bexport\s+/g,''));
const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String};
vm.runInNewContext(code+`
;module.exports={periodBounds,previousPeriod,clipIntervalSeconds,isInsightVisibleItem,aggregateInsightRows,evaluateAchievements};
`,context);
const {periodBounds,previousPeriod,clipIntervalSeconds,isInsightVisibleItem,aggregateInsightRows,evaluateAchievements}=context.module.exports;

test('backend week bounds cross years using Bogota midnight',()=>{
 const p=periodBounds('week','2026-12-31','2027-01-03');
 assert.equal(p.startDay,'2026-12-28');
 assert.equal(p.endDay,'2027-01-04');
 assert.equal(p.start,'2026-12-28T05:00:00.000Z');
 assert.equal(p.end,'2027-01-04T05:00:00.000Z');
});

test('anniversary bounds clamp day 31 and cover the previous anniversary month',()=>{
 const p=periodBounds('anniversary','', '2026-02-28','2025-01-31');
 assert.equal(p.startDay,'2026-01-31');
 assert.equal(p.endDay,'2026-02-28');
 assert.equal(p.kind,'anniversary');
 assert.equal(periodBounds('anniversary','', '2026-02-27','2025-01-31'),null);
});

test('current partial period compares against an equally long previous slice',()=>{
 const current=periodBounds('month','2026-10','2026-10-03');
 const previous=previousPeriod(current,'2026-10-03');
 assert.equal(previous.startDay,'2026-09-01');
 assert.equal(previous.endDay,'2026-09-04');
});

test('open encounters are clipped to now and to requested range',()=>{
 const seconds=clipIntervalSeconds(
  '2026-10-02T23:00:00-05:00',null,
  '2026-10-03T05:00:00.000Z','2026-10-04T05:00:00.000Z',
  Date.parse('2026-10-03T10:00:00-05:00')
 );
 assert.equal(seconds,36000);
 assert.equal(clipIntervalSeconds('2026-09-01T00:00:00Z','2026-09-01T01:00:00Z','2026-10-03T05:00:00Z','2026-10-04T05:00:00Z',Date.now()),0);
});

test('insights never expose capsules, including capsules authored by the caller',()=>{
 assert.equal(isInsightVisibleItem({kind:'capsule',author:'0',data:{date:'2026-01-01',body:'own-secret'}},'0','2026-10-03'),false);
 assert.equal(isInsightVisibleItem({kind:'capsule',author:'1',data:{date:'2026-01-01',body:'partner-secret'}},'0','2026-10-03'),false);
});

test('insights never expose unopened partner capsules or surprise notes',()=>{
 assert.equal(isInsightVisibleItem({kind:'capsule',author:'1',data:{date:'2026-12-01'}},'0','2026-10-03'),false);
 assert.equal(isInsightVisibleItem({kind:'note',author:'1',data:{surprise:true,unlockType:'date',unlockDate:'2026-01-01'}},'0','2026-10-03'),false);
 assert.equal(isInsightVisibleItem({kind:'memory',author:'1',data:{date:'2026-10-01'}},'0','2026-10-03'),true);
});

test('range aggregation combines content mobility places moods questions and bond without coordinates',()=>{
 const period=periodBounds('week','2026-09-28','2026-10-03');
 const result=aggregateInsightRows({
  period,nowMs:Date.parse('2026-10-03T12:00:00-05:00'),
  items:[
   {id:'m1',kind:'memory',author:'0',created:'2026-10-01T12:00:00Z',data:{title:'Café',date:'2026-10-01'}},
   {id:'p1',kind:'plan',author:'1',created:'2026-10-02T12:00:00Z',data:{title:'Plan',date:'2026-10-02',done:true}},
   {id:'s1',kind:'song',author:'0',created:'2026-10-02T15:00:00Z',data:{title:'Canción'}}
  ],
  trips:[{person:'0',started_at:'2026-10-01T10:00:00Z',ended_at:'2026-10-01T11:00:00Z',distance_m:4200,duration_s:3600}],
  encounters:[{id:1,started_at:'2026-10-02T15:00:00Z',ended_at:'2026-10-02T17:00:00Z'}],
  daily:[
   {day:'2026-10-01',person:'0',mood:'feliz',answer:'A'},
   {day:'2026-10-01',person:'1',mood:'tranquilo',answer:'B'},
   {day:'2026-10-02',person:'0',mood:'sensible',answer:null},
   {day:'2026-10-02',person:'1',mood:'abrazo',answer:null}
  ],
  bond:[
   {type:'gesture',author:'0',created:'2026-10-01T10:00:00Z'},
   {type:'voice',author:'1',created:'2026-10-02T10:00:00Z'}
  ],
  participation:[{day:'2026-10-01',person:'0'},{day:'2026-10-01',person:'1'}],
  placeEvents:[
   {place_id:7,event:'arrived',happened_at:'2026-10-01T15:00:00Z'},
   {place_id:7,event:'left',happened_at:'2026-10-01T17:00:00Z'}
  ],
  places:[{id:7,name:'Nuestro café',latitude:4.1,longitude:-74.1}],
  photos:[{path:'0/a.jpg',name:'a.jpg',created:'2026-10-01T16:00:00Z',url:'https://private.test/a'}]
 });
 assert.equal(result.counts.memories,1);
 assert.equal(result.counts.plansDone,1);
 assert.equal(result.counts.songs,1);
 assert.equal(result.trips.distance_m,4200);
 assert.equal(result.encounters.together_seconds,7200);
 assert.equal(result.connection.mood_days,2);
 assert.equal(result.connection.answer_days,1);
 assert.equal(result.connection.exact_mood_days,0);
 assert.equal(result.connection.compatible_mood_days,2);
 assert.equal(result.places.visits[0].name,'Nuestro café');
 assert.equal(Object.hasOwn(result.places.visits[0],'latitude'),false);
 assert.equal(result.photos.length,1);
 assert.equal(result.bond.gestures,1);
 assert.equal(result.bond.voices,1);
});

test('achievements are declarative and unlock at thresholds without persistence',()=>{
 const rows=evaluateAchievements({
  memories:25,encounters:10,distance_m:100000,journeys:1,joint_days:30,
  startDate:'2025-10-01',today:'2026-10-03'
 });
 const byId=id=>rows.find(x=>x.id===id);
 assert.equal(byId('memories-25').unlocked,true);
 assert.equal(byId('encounters-10').unlocked,true);
 assert.equal(byId('distance-100').unlocked,true);
 assert.equal(byId('journey-first').unlocked,true);
 assert.equal(byId('participation-30').unlocked,true);
 assert.equal(byId('anniversary-12').unlocked,true);
 assert.equal(byId('memories-50').unlocked,false);
});


test('insights summary is wired end-to-end and monthly stays a compatibility adapter',()=>{
 assert.ok(edge.includes('from "./insights.ts"'),'Edge Function must consume the shared insights core');
 assert.ok(edge.includes('async function buildInsights('),'Edge Function needs one reusable backend aggregator');
 assert.ok(edge.includes('async function insightsSummary('),'Generic insights action is missing');
 assert.ok(edge.includes('if(action==="insights-summary")return await insightsSummary(req,body);'),'Dispatcher must expose insights-summary');
 assert.ok(edge.includes('async function monthlySummary(req:Request,body:any)')&&edge.includes('buildInsights(req,{kind:"month"'),'monthly-summary must delegate to the common engine');
 assert.ok(main.includes('"insights-summary"'),'Android bridge must allow insights-summary');
 assert.ok(qa.includes("mainActions.has('insights-summary')")&&qa.includes("edgeActions.has('insights-summary')"),'QA contract must protect the new action');
});

test('annual insights are aggregated server-side in one request',()=>{
 const start=edge.indexOf('async function insightsSummary(');
 const block=edge.slice(start,edge.indexOf('async function monthlySummary(',start));
 assert.ok(block.includes('kind'), 'insights-summary must accept period kind');
 assert.equal((block.match(/monthlySummary\(/g)||[]).length,0,'year summary must not call monthly summary twelve times');
 assert.ok(source.includes('period.kind==="year"')&&source.includes('series'),'pure core must emit annual monthly series');
});


test('empty periods return a stable zeroed contract',()=>{
 const period=periodBounds('month','2026-08','2026-10-03');
 const result=aggregateInsightRows({period,items:[],trips:[],encounters:[],daily:[],bond:[],participation:[],placeEvents:[],places:[],photos:[],nowMs:Date.parse('2026-10-03T12:00:00-05:00')});
 assert.equal(result.counts.saved,0);
 assert.equal(result.counts.memories,0);
 assert.equal(result.trips.count,0);
 assert.equal(result.trips.distance_m,0);
 assert.equal(result.encounters.count,0);
 assert.equal(result.encounters.together_seconds,0);
 assert.equal(result.connection.mood_days,0);
 assert.equal(result.connection.answer_days,0);
 assert.equal(result.highlights.length,0);
 assert.equal(result.photos.length,0);
 assert.equal(result.places.visits.length,0);
});

test('incomplete mood data never becomes a false couple coincidence',()=>{
 const period=periodBounds('week','2026-09-28','2026-10-03');
 const result=aggregateInsightRows({
  period,items:[],trips:[],encounters:[],bond:[],participation:[],placeEvents:[],places:[],photos:[],
  daily:[
   {day:'2026-10-01',person:'0',mood:'feliz',answer:'Solo una respuesta'},
   {day:'2026-10-02',person:'0',mood:'tranquilo',answer:null},
   {day:'2026-10-02',person:'1',mood:null,answer:'Respuesta sin mood'}
  ],
  nowMs:Date.parse('2026-10-03T12:00:00-05:00')
 });
 assert.equal(result.connection.mood_days,0);
 assert.equal(result.connection.exact_mood_days,0);
 assert.equal(result.connection.compatible_mood_days,0);
 assert.equal(result.connection.answer_days,0);
});

test('exact moods count as exact, not as merely compatible',()=>{
 const period=periodBounds('week','2026-09-28','2026-10-03');
 const result=aggregateInsightRows({
  period,items:[],trips:[],encounters:[],bond:[],participation:[],placeEvents:[],places:[],photos:[],
  daily:[
   {day:'2026-10-01',person:'0',mood:'feliz',answer:null},
   {day:'2026-10-01',person:'1',mood:'feliz',answer:null}
  ],
  nowMs:Date.parse('2026-10-03T12:00:00-05:00')
 });
 assert.equal(result.connection.mood_days,1);
 assert.equal(result.connection.exact_mood_days,1);
 assert.equal(result.connection.compatible_mood_days,0);
});


test('legacy history keeps its Bogota day helper after the Insights extraction',()=>{
 assert.ok(edge.includes('function bogotaDay('),'today-history and encounter stats still depend on bogotaDay');
 assert.ok((edge.match(/bogotaDay\(/g)||[]).length>1,'bogotaDay must still serve legacy consumers');
});

test('Insights filters photo metadata before signing private URLs',()=>{
 assert.ok(edge.includes('async function listInsightPhotoMetadata('),'Insights needs a metadata-only photo listing');
 assert.ok(edge.includes('async function signInsightPhotos('),'Insights must sign only selected photo candidates');
 const start=edge.indexOf('async function buildInsights(');
 const end=edge.indexOf('async function insightsSummary(',start);
 const block=edge.slice(start,end);
 assert.equal(block.includes('listBucket("galaxy-photos")'),false,'Insights must not sign every photo before period filtering');
 assert.ok(block.includes('listInsightPhotoMetadata('));
 assert.ok(block.includes('signInsightPhotos('));
});
