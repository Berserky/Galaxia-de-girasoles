import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const engineUrl=new URL('../supabase/functions/android-companion/date-engine.ts',import.meta.url);
const exists=existsSync(engineUrl);
test('Galaxy Date pure engine exists',()=>assert.equal(exists,true));

let api={};
if(exists){
 const source=readFileSync(engineUrl,'utf8');
 const code=stripTypeScriptTypes(source.replace(/\bexport\s+/g,''));
 const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON};
 vm.runInNewContext(code+'\n;module.exports={QUESTION_DECKS,normalizeConstraints,normalizePlanCategory,selectQuestion,roulettePendingPlans,buildCandidates,scoreCandidates,buildSurpriseExperience,buildSequentialPlan,buildDateRecap,questionById};',context);
 api=context.module.exports;
}

const ctx=(overrides={})=>({
 today:'2026-10-03',
 startDate:'2026-05-01',
 nowHour:14,
 recentQuestionIds:['funny-1','memory-1'],
 memories:[{id:'m1',date:'2026-09-20',title:'Café'}],
 journeys:[{id:'j1',date:'2026-09-12',title:'Útica'}],
 pendingPlans:[
  {id:'p1',title:'Café pendiente',body:'Ir a un café',planCategory:'this-week',done:false,budget:40000,minutes:90,where:'salir'},
  {id:'p2',title:'Película',body:'Ver algo juntos',planCategory:'home',done:false,budget:10000,minutes:120,where:'casa'}
 ],
 completedPlans:[{id:'done1',title:'Picnic',done:true}],
 places:[{id:7,name:'Parque',kind:'adventure',distanceM:1800,visits:3}],
 frequentPlaces:[{id:7,name:'Parque',confidence:.8,visits:3}],
 location:{available:true,latitude:4.6,longitude:-74.1},
 transport:'motorcycle',
 ...overrides
});

test('question decks expose every requested category',()=>{
 const decks=api.QUESTION_DECKS||{};
 for(const key of ['funny','memories','future','intimate','absurd','travel','would-you-rather'])
  assert.ok(Array.isArray(decks[key])&&decks[key].length>=4,key);
});

test('contextual question avoids recent repetition deterministically',()=>{
 const a=api.selectQuestion(ctx(),{seed:'same'});
 const b=api.selectQuestion(ctx(),{seed:'same'});
 assert.equal(a.id,b.id);
 assert.equal(['funny-1','memory-1'].includes(a.id),false);
});

test('anniversary context prefers a relevant contextual deck without leaking answers',()=>{
 const result=api.selectQuestion(ctx({today:'2026-10-01'}),{seed:'anniversary'});
 assert.ok(['memories','future','intimate'].includes(result.deck));
 assert.equal(Object.hasOwn(result,'answers'),false);
});

test('constraints normalize zero budget, short time and transport safely',()=>{
 const c=api.normalizeConstraints({budget:0,minutes:30,where:'casa',transport:'transit'});
 assert.equal(c.budget,0);
 assert.equal(c.minutes,30);
 assert.equal(c.where,'casa');
 assert.equal(c.transport,'transit');
});

test('constraints accept high budgets and several hours without artificial caps',()=>{
 const c=api.normalizeConstraints({budget:500000,minutes:360,where:'salir',transport:'motorcycle'});
 assert.equal(c.budget,500000);
 assert.equal(c.minutes,360);
});

test('legacy plan categories map without mutating old content',()=>{
 assert.equal(api.normalizePlanCategory({category:'Viaje'}),'travel');
 assert.equal(api.normalizePlanCategory({category:'En casa'}),'home');
 assert.equal(api.normalizePlanCategory({category:'Esta semana'}),'this-week');
 assert.equal(api.normalizePlanCategory({category:'Algún día'}),'someday');
 assert.equal(api.normalizePlanCategory({category:'Cualquier cosa'}),'when-possible');
});

test('candidate scoring works without GPS or frequent places',()=>{
 const c=api.normalizeConstraints({budget:50000,minutes:120,where:'salir'});
 const context=ctx({location:{available:false},places:[],frequentPlaces:[]});
 const candidates=api.buildCandidates(context,c);
 const ranked=api.scoreCandidates(candidates,c,context,{seed:'nogps'});
 assert.ok(ranked.length>0);
 assert.ok(Number.isFinite(ranked[0].score));
});

test('motorcycle and transit produce valid ranked experiences',()=>{
 const constraints=api.normalizeConstraints({budget:80000,minutes:120,where:'salir',maxDistanceM:10000});
 const motoCtx=ctx({transport:'motorcycle'}),transitCtx=ctx({transport:'transit'});
 const moto=api.scoreCandidates(api.buildCandidates(motoCtx,constraints),constraints,motoCtx,{seed:'transport'});
 const transit=api.scoreCandidates(api.buildCandidates(transitCtx,constraints),constraints,transitCtx,{seed:'transport'});
 assert.ok(moto.length>0&&transit.length>0);
 assert.ok(moto.some(x=>x.source==='pending'));
});

test('roulette uses only pending plans, optional category and deterministic seed',()=>{
 const plans=ctx().pendingPlans.concat([{id:'x',title:'Hecho',done:true,planCategory:'home'}]);
 const a=api.roulettePendingPlans(plans,{category:'home',seed:'42'});
 const b=api.roulettePendingPlans(plans,{category:'home',seed:'42'});
 assert.equal(a.id,'p2');
 assert.equal(a.id,b.id);
 assert.notEqual(a.id,'x');
});

test('roulette returns null cleanly when there are no pending plans',()=>{
 assert.equal(api.roulettePendingPlans([],{seed:'empty'}),null);
});

test('Surprise Date 2.0 respects budget time and home/out constraints',()=>{
 const experience=api.buildSurpriseExperience(ctx(),{budget:0,minutes:60,where:'casa',seed:'zero'});
 assert.ok(experience);
 assert.equal(experience.candidate.where,'casa');
 assert.ok(experience.candidate.budget<=0);
 assert.ok(experience.candidate.minutes<=60);
});

test('Surprise Date penalizes recently completed repetitions',()=>{
 const context=ctx({completedPlans:[{title:'Café y caminata',done:true}]});
 const experience=api.buildSurpriseExperience(context,{budget:100000,minutes:180,where:'salir',seed:'repeat'});
 assert.notEqual(experience.candidate.title,'Café y caminata');
});

test('sequential planner stays within total time and budget',()=>{
 const plan=api.buildSequentialPlan(ctx(),{budget:100000,minutes:180,where:'salir',seed:'planner'});
 assert.ok(plan.steps.length>=1);
 assert.ok(plan.totalBudget<=100000);
 assert.ok(plan.totalMinutes<=180);
 assert.equal(new Set(plan.steps.map(x=>x.id)).size,plan.steps.length);
});

test('Date Mode recap stores references instead of copying source plan/photo/song bodies',()=>{
 const recap=api.buildDateRecap({
  sessionId:'session-1',startedAt:'2026-10-03T19:00:00-05:00',endedAt:'2026-10-03T22:00:00-05:00',
  planId:'p1',songId:'s1',photoPaths:['0/a.jpg','1/b.jpg'],questionIds:['future-2'],placeId:7,
  locationEnabled:true
 },{today:'2026-10-03'});
 assert.equal(recap.date,'2026-10-03');
 assert.equal(recap.category,'Modo Cita');
 assert.equal(recap.dateMode.planId,'p1');
 assert.deepEqual(Array.from(recap.dateMode.photoPaths),['0/a.jpg','1/b.jpg']);
 assert.equal(Object.hasOwn(recap.dateMode,'planBody'),false);
 assert.equal(Object.hasOwn(recap.dateMode,'photoData'),false);
});


test('assigned question ids resolve back to the exact catalog entry',()=>{
 const selected=api.selectQuestion(ctx(),{seed:'stable-id'});
 const resolved=api.questionById(selected.id);
 assert.equal(resolved.id,selected.id);
 assert.equal(resolved.text,selected.text);
 assert.equal(resolved.deck,selected.deck);
});
