import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const url=new URL('../supabase/functions/android-companion/goals-engine.ts',import.meta.url);
const exists=existsSync(url);
test('Galaxy Goals pure engine exists',()=>assert.equal(exists,true));

let api={};
if(exists){
 const source=readFileSync(url,'utf8');
 const code=stripTypeScriptTypes(source.replace(/\bexport\s+/g,''));
 const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON};
 vm.runInNewContext(code+'\n;module.exports={GOAL_CATEGORIES,GOAL_STATUSES,normalizeGoalInput,normalizeContribution,computeGoalProgress,reorderStepIds,conversionDraft,buildGoalDateSuggestions,buildGoalInsightSummary};',context);
 api=context.module.exports;
}

const generalGoal=(overrides={})=>({
 id:'g1',kind:'goal',title:'Viaje a Útica',description:'Volver juntos',category:'travel',
 target_date:'2027-03-01',status:'active',target_amount:null,created_at:'2026-09-01T12:00:00Z',
 completed_at:null,...overrides
});
const savingsGoal=(overrides={})=>generalGoal({id:'g2',kind:'savings',title:'Útica 2.0',target_amount:800000,...overrides});
const steps=[
 {id:'s1',goal_id:'g1',title:'Elegir fecha',position:0,completed_at:'2026-10-01T12:00:00Z'},
 {id:'s2',goal_id:'g1',title:'Reservar',position:1,completed_at:null},
 {id:'s3',goal_id:'g1',title:'Preparar maleta',position:2,completed_at:null}
];
const contributions=[
 {id:'c1',goal_id:'g2',amount:300000,contribution_date:'2026-09-20',created_at:'2026-09-20T10:00:00Z'},
 {id:'c2',goal_id:'g2',amount:150000,contribution_date:'2026-10-02',created_at:'2026-10-02T10:00:00Z'}
];

test('goal catalogs expose maintainable categories and statuses',()=>{
 assert.ok(api.GOAL_CATEGORIES.includes('travel'));
 assert.ok(api.GOAL_CATEGORIES.includes('home'));
 assert.deepEqual(Array.from(api.GOAL_STATUSES),['active','paused','completed','archived']);
});

test('normalizes a shared goal without storing derived progress',()=>{
 const g=api.normalizeGoalInput({title:' Aprender algo juntos ',description:' paso a paso ',category:'learning',targetDate:'2027-01-20',status:'active',participants:['1','0','1']});
 assert.equal(g.kind,'goal');
 assert.equal(g.title,'Aprender algo juntos');
 assert.equal(g.description,'paso a paso');
 assert.equal(g.target_date,'2027-01-20');
 assert.deepEqual(Array.from(g.participants),['0','1']);
 assert.equal(Object.hasOwn(g,'progress'),false);
 assert.equal(Object.hasOwn(g,'progressPct'),false);
});

test('savings goals require a positive manual target amount',()=>{
 assert.equal(api.normalizeGoalInput({kind:'savings',title:'Viaje',targetAmount:800000,participants:['0','1']}).target_amount,800000);
 for(const amount of [0,-1,NaN,Infinity,'abc'])assert.throws(()=>api.normalizeGoalInput({kind:'savings',title:'Viaje',targetAmount:amount,participants:['0']}),/monto|objetivo/i);
});

test('general goals cannot smuggle banking data',()=>{
 assert.throws(()=>api.normalizeGoalInput({title:'Meta',participants:['0'],bankAccount:'123'}),/banc|campo/i);
 assert.throws(()=>api.normalizeGoalInput({title:'Meta',participants:['0'],accountNumber:'123'}),/banc|campo/i);
});

test('manual contributions reject invalid amounts and normalize date/note',()=>{
 const c=api.normalizeContribution({amount:125000,date:'2026-10-03',note:' Aporte de octubre '},'0');
 assert.equal(c.amount,125000);
 assert.equal(c.contribution_date,'2026-10-03');
 assert.equal(c.note,'Aporte de octubre');
 assert.equal(c.contributor,'0');
 for(const amount of [0,-5000,NaN,Infinity,'x'])assert.throws(()=>api.normalizeContribution({amount,date:'2026-10-03'},'0'),/aporte|monto/i);
});

test('step progress is calculated from completed steps',()=>{
 const p=api.computeGoalProgress(generalGoal(),steps,[]);
 assert.equal(p.stepsTotal,3);
 assert.equal(p.stepsCompleted,1);
 assert.equal(p.stepProgressPct,33);
 assert.equal(p.progressPct,33);
 assert.equal(p.accumulatedAmount,0);
});

test('manual savings progress is derived from contribution history',()=>{
 const p=api.computeGoalProgress(savingsGoal(),[],contributions);
 assert.equal(p.accumulatedAmount,450000);
 assert.equal(p.moneyProgressPct,56);
 assert.equal(p.progressPct,56);
 assert.equal(p.achieved,false);
});

test('savings goal reports achieved at the first contribution that reaches target',()=>{
 const rows=contributions.concat({id:'c3',goal_id:'g2',amount:400000,contribution_date:'2026-10-20',created_at:'2026-10-20T10:00:00Z'});
 const p=api.computeGoalProgress(savingsGoal(),[],rows);
 assert.equal(p.accumulatedAmount,850000);
 assert.equal(p.moneyProgressPct,100);
 assert.equal(p.achieved,true);
 assert.equal(p.achievedAt,'2026-10-20');
});

test('step reorder accepts the same exact set only',()=>{
 assert.deepEqual(Array.from(api.reorderStepIds(steps,['s3','s1','s2'])),['s3','s1','s2']);
 assert.throws(()=>api.reorderStepIds(steps,['s1','s2']),/pasos/i);
 assert.throws(()=>api.reorderStepIds(steps,['s1','s1','s3']),/pasos/i);
 assert.throws(()=>api.reorderStepIds(steps,['s1','s2','unknown']),/pasos/i);
});

test('plan conversion creates a goal draft and preserves source by default',()=>{
 const draft=api.conversionDraft({id:'p1',kind:'plan',data:{title:'Viaje pendiente',body:'Ir a Útica',category:'Viaje',planCategory:'travel',date:'2027-02-01'}},{participants:['0','1']});
 assert.equal(draft.title,'Viaje pendiente');
 assert.equal(draft.description,'Ir a Útica');
 assert.equal(draft.category,'travel');
 assert.equal(draft.target_date,'2027-02-01');
 assert.equal(draft.source.itemId,'p1');
 assert.equal(draft.source.kind,'plan');
 assert.equal(draft.source.keepOriginal,true);
});

test('wish conversion supports explicit source removal without mutating source data',()=>{
 const source={id:'w1',kind:'wish',data:{title:'Aprender fotografía',body:'Juntos'}};
 const snapshot=JSON.stringify(source);
 const draft=api.conversionDraft(source,{keepOriginal:false,participants:['1']});
 assert.equal(draft.source.kind,'wish');
 assert.equal(draft.source.keepOriginal,false);
 assert.equal(JSON.stringify(source),snapshot);
});

test('conversion rejects unrelated item kinds',()=>{
 assert.throws(()=>api.conversionDraft({id:'m1',kind:'memory',data:{title:'Recuerdo'}},{}),/plan|deseo/i);
});

test('Date adapter emits generic suggestions only for active travel goals',()=>{
 const suggestions=api.buildGoalDateSuggestions([
  {...generalGoal(),progressPct:40},
  {...generalGoal({id:'g3',title:'Casa nueva',category:'home'}),progressPct:20},
  {...generalGoal({id:'g4',status:'completed'}),progressPct:100}
 ]);
 assert.equal(suggestions.length,1);
 assert.equal(suggestions[0].goalId,'g1');
 assert.equal(suggestions[0].source,'goal');
 assert.equal(suggestions[0].planCategory,'travel');
 assert.equal(Object.hasOwn(suggestions[0],'goal'),false);
});

test('Insights adapter counts completed goals, achieved savings and manual contributions inside period',()=>{
 const goals=[
  generalGoal({id:'a',completed_at:'2026-10-05T10:00:00Z',status:'completed'}),
  savingsGoal({id:'b',target_amount:500000}),
  generalGoal({id:'c',completed_at:'2026-09-10T10:00:00Z',status:'completed'})
 ];
 const rows=[
  {id:'x1',goal_id:'b',amount:300000,contribution_date:'2026-09-28'},
  {id:'x2',goal_id:'b',amount:250000,contribution_date:'2026-10-12'}
 ];
 const summary=api.buildGoalInsightSummary(goals,[],rows,{kind:'month',startDay:'2026-10-01',endDay:'2026-10-31'});
 assert.equal(summary.completed,1);
 assert.equal(summary.savingsAchieved,1);
 assert.equal(summary.contributionAmount,250000);
 assert.ok(summary.activeProgressPct>=0&&summary.activeProgressPct<=100);
});
