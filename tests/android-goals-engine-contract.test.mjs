import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';

const schema=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/android-companion/index.ts',import.meta.url),'utf8');
const insights=readFileSync(new URL('../supabase/functions/android-companion/insights.ts',import.meta.url),'utf8');
const dateEngine=readFileSync(new URL('../supabase/functions/android-companion/date-engine.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../android/app/src/main/assets/mobile/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../android/app/src/main/assets/mobile/app.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/qa-android-mobile.mjs',import.meta.url),'utf8');
const enginePath=new URL('../supabase/functions/android-companion/goals-engine.ts',import.meta.url);

test('Goals Engine is separate from plans and wishes',()=>{
 assert.equal(existsSync(enginePath),true);
 assert.ok(edge.includes('from "./goals-engine.ts"'));
 assert.equal(edge.includes('allowedKinds=new Set(["memory","song","event","plan","note","capsule","wish","journey","goal"])'),false);
 assert.ok(edge.includes('action==="goals-engine"'));
 assert.ok(main.includes('"goals-engine"'));
});

test('Goals uses relational tables instead of one giant JSON item',()=>{
 for(const table of ['galaxy_goals','galaxy_goal_participants','galaxy_goal_steps','galaxy_goal_links','galaxy_goal_contributions'])
  assert.ok(schema.includes('create table if not exists public.'+table),table);
 assert.ok(schema.includes('target_amount bigint'));
 assert.ok(schema.includes('goal_id uuid not null references public.galaxy_goals(id) on delete cascade'));
 assert.ok(schema.includes('item_id uuid not null references public.galaxy_items(id) on delete cascade'));
 assert.equal(/galaxy_goals[\s\S]{0,1200}data jsonb/.test(schema),false);
});

test('Goals schema is migration-safe and private from direct app roles',()=>{
 for(const table of ['galaxy_goals','galaxy_goal_participants','galaxy_goal_steps','galaxy_goal_links','galaxy_goal_contributions']){
  assert.ok(schema.includes('alter table public.'+table+' enable row level security'),table+' RLS');
 }
 assert.ok(schema.includes('revoke all on public.galaxy_goals,public.galaxy_goal_participants,public.galaxy_goal_steps,public.galaxy_goal_links,public.galaxy_goal_contributions from public,anon,authenticated'));
 assert.ok(schema.includes('grant select,insert,update,delete on public.galaxy_goals'));
 assert.equal(/drop table\s+public\.galaxy_goal/i.test(schema),false);
});

test('Goals backend exposes CRUD steps contributions links conversion and optimistic concurrency',()=>{
 for(const op of ['list','create','update','delete','step-add','step-toggle','step-reorder','contribution-add','contribution-delete','link-add','link-delete','convert-item'])
  assert.ok(edge.includes('operation==="'+op+'"')||edge.includes('case "'+op+'"'),op);
 assert.ok(edge.includes('async function goalsEngine('));
 assert.ok(edge.includes('expectedVersion'));
 assert.ok(edge.includes('.eq("version",expectedVersion)'));
 assert.ok(edge.includes('409'));
});

test('Goals backend never contains bank integrations or account credentials',()=>{
 const goalsBlock=edge.slice(edge.indexOf('async function goalsEngine('),edge.indexOf('async function insightsSummary(')>0?edge.indexOf('async function insightsSummary('):edge.length);
 assert.equal(/plaid|stripe|open banking|account_number|routing_number|bank_token|bank_account/i.test(goalsBlock),false);
});

test('Goals conversion validates source kind and preserves source by default',()=>{
 assert.ok(edge.includes('async function convertItemToGoal('));
 assert.ok(edge.includes('["plan","wish"]'));
 assert.ok(edge.includes('keepOriginal'));
 assert.ok(edge.includes('source-plan'));
 assert.ok(edge.includes('source-wish'));
});

test('Goals mobile UI has dedicated rendered view, goal/savings forms, steps, links and manual contribution history',()=>{
 assert.ok(app.includes("if(view==='goals'){app.innerHTML=header()+goalsView()"),'Goals debe estar cableado en render(), no solo existir como estado interno');
 assert.ok(app.includes("if(a==='goals-open'){go('goals');await loadGoals(true);return;}"),'El acceso visible debe navegar y cargar Goals');
 assert.ok(app.includes('function goalsView('));
 assert.ok(app.includes('function openGoalForm('));
 assert.ok(app.includes('function openGoalDetail('));
 assert.ok(app.includes('goal-step-add'));
 assert.ok(app.includes('goal-step-up'));
 assert.ok(app.includes('goal-step-down'));
 assert.ok(app.includes('goal-contribution-add'));
 assert.ok(app.includes('Aportes manuales'));
 assert.ok(app.includes('Sin conexión bancaria'));
 assert.ok(app.includes('goal-link-add'));
});

test('plans and wishes can open conversion without losing their existing editors',()=>{
 assert.ok(app.includes('goal-convert-item'));
 assert.ok(app.includes("['plan','wish'].includes(i.kind)"));
 assert.ok(app.includes('keepOriginal'));
 assert.ok(app.includes('item-edit'));
});

test('Goals integrates with Insights through a summary contract',()=>{
 assert.ok(edge.includes('buildGoalInsightSummary'));
 assert.ok(edge.includes('goalInsights'));
 assert.ok(insights.includes('goalsCompleted'));
 assert.ok(insights.includes('savingsAchieved'));
 assert.ok(insights.includes('goal_contribution_amount'));
});

test('Goals integrates with Date Engine through generic suggestions only',()=>{
 assert.ok(edge.includes('buildGoalDateSuggestions'));
 assert.ok(edge.includes('goalSuggestions'));
 assert.ok(dateEngine.includes('context.goalSuggestions'));
 assert.equal(dateEngine.includes('goals-engine'),false);
 assert.equal(dateEngine.includes('galaxy_goals'),false);
});

test('Goals backup includes relational goal data in transactional v5 restore',()=>{
 for(const key of ['goals','goalParticipants','goalSteps','goalLinks','goalContributions'])assert.ok(edge.includes(key),key);
 assert.ok(edge.includes('galaxy_backup_restore_v5'));
 assert.ok(edge.includes('verified:restored?.verified===true'));
});

test('Goals UI uses theme tokens and reduced motion',()=>{
 assert.ok(css.includes('/* Mega Update 3.0 · Galaxy Goals Engine */'));
 assert.ok(css.includes('.goal-card'));
 assert.ok(css.includes('var(--surface)'));
 assert.ok(css.includes('var(--accent)'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
});

test('mobile QA protects Goals Engine contracts',()=>{
 assert.ok(qa.includes('Galaxy Goals'));
 assert.ok(qa.includes('goals-engine'));
 assert.ok(qa.includes('galaxy_goals'));
});
