import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const edge=readFileSync(new URL('../supabase/functions/android-companion/index.ts',import.meta.url),'utf8');
const schema=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
const app=readFileSync(new URL('../android/app/src/main/assets/mobile/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../android/app/src/main/assets/mobile/app.css',import.meta.url),'utf8');
const main=readFileSync(new URL('../android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../android/app/src/main/java/com/nuestragalaxia/companion/GalaxyBridge.java',import.meta.url),'utf8');
const qa=readFileSync(new URL('../scripts/qa-android-mobile.mjs',import.meta.url),'utf8');

test('daily question assignment is stable, minimal and separate from answers',()=>{
 assert.ok(schema.includes('create table if not exists public.galaxy_daily_questions'));
 for(const column of ['question_id text','deck text','favorite boolean','memory_id uuid'])
  assert.ok(schema.includes(column),column);
 assert.equal(/galaxy_daily_questions[\s\S]{0,800}answer text/.test(schema),false,'assignment table must not copy answers');
 assert.ok(edge.includes('async function ensureDailyQuestion('));
 assert.ok(edge.includes('galaxy_daily_questions'));
});

test('Date Engine is one allowlisted end-to-end action with reusable operations',()=>{
 assert.ok(edge.includes('from "./date-engine.ts"'));
 assert.ok(edge.includes('async function dateEngine('));
 assert.ok(edge.includes('action==="date-engine"'));
 assert.ok(main.includes('"date-engine"'));
 for(const op of ['context','question','favorite','favorite-memory','surprise','roulette','planner','date-recap-save'])
  assert.ok(edge.includes('operation==="'+op+'"')||edge.includes('case "'+op+'"'),op);
});

test('daily response privacy remains reveal-after-both',()=>{
 const start=edge.indexOf('function maskedDaily(');
 const end=edge.indexOf('async function mobileState(',start);
 const block=edge.slice(start,end);
 assert.ok(block.includes('both'));
 assert.ok(block.includes('row.answer=null'));
 assert.equal(block.includes('galaxy_daily_questions'),false,'question metadata must not bypass answer masking');
});

test('favorite-memory requires both answers and links exactly one memory',()=>{
 const start=edge.indexOf('async function favoriteQuestionMemory(');
 const end=edge.indexOf('async function',start+30);
 const block=edge.slice(start,end);
 assert.ok(block.includes('answers.length!==2')||block.includes('answers.length<2'));
 assert.ok(block.includes('memory_id'));
 assert.ok(block.includes('source'));
 assert.ok(block.includes('daily-question'));
 assert.ok(block.includes('questionId'));
});

test('Date Mode recap save is idempotent by session id and stores references',()=>{
 const start=edge.indexOf('async function saveDateRecap(');
 const end=edge.indexOf('async function',start+30);
 const block=edge.slice(start,end);
 assert.ok(block.includes('sessionId'));
 assert.ok(block.includes('dateMode'));
 assert.ok(block.includes('existing'));
 assert.ok(block.includes('item'));
});

test('home uses contextual daily question and exposes favorites/decks',()=>{
 assert.ok(app.includes('function loadDateContext('));
 assert.ok(app.includes('function dailyQuestionCard('));
 assert.ok(app.includes('date-question-favorite'));
 assert.ok(app.includes('date-question-memory'));
 assert.ok(app.includes('date-question-decks'));
 assert.ok(app.includes("api('date-engine'"));
});

test('Date Mode exposes music questions camera plan elapsed location and save',()=>{
 assert.ok(app.includes('function openDateMode('));
 for(const token of ['date-mode-music','date-mode-question','date-mode-camera','date-mode-plan','date-mode-location','date-mode-save'])
  assert.ok(app.includes(token),token);
 assert.ok(app.includes('dateModeElapsed'));
 assert.ok(app.includes('photoPaths'));
 assert.ok(app.includes('questionIds'));
});

test('surprise roulette planner share the Date Engine instead of local random ideas',()=>{
 assert.ok(app.includes('function openSurprise2('));
 assert.ok(app.includes('function openPlanRoulette('));
 assert.ok(app.includes('function openDatePlanner('));
 assert.equal(app.includes('Math.floor(Math.random()*surpriseIdeas.length)'),false);
 assert.ok(app.includes("operation:'surprise'"));
 assert.ok(app.includes("operation:'roulette'"));
 assert.ok(app.includes("operation:'planner'"));
});

test('plan editor adds canonical categories while old free-text category remains',()=>{
 assert.ok(app.includes('name="planCategory"'));
 for(const value of ['this-week','when-possible','someday','travel','home'])assert.ok(app.includes('value="'+value+'"'),value);
 assert.ok(app.includes("category:fd.get('category')")||app.includes("category:String(fd.get('category')"));
 assert.ok(app.includes("planCategory:fd.get('planCategory')")||app.includes("planCategory:String(fd.get('planCategory')"));
});

test('Android exposes a native camera path for Date Mode photos',()=>{
 assert.ok(bridge.includes('capturePhoto'));
 assert.ok(main.includes('void capturePhoto('));
 assert.ok(main.includes('MediaStore.ACTION_IMAGE_CAPTURE'));
 assert.ok(main.includes('FileProvider.getUriForFile'));
});

test('roulette motion respects reduced motion',()=>{
 assert.ok(css.includes('.plan-roulette'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 const reduced=css.slice(css.lastIndexOf('@media(prefers-reduced-motion:reduce)'));
 assert.ok(reduced.includes('.plan-roulette'));
});

test('mobile QA protects Galaxy Date 3.0 contracts',()=>{
 assert.ok(qa.includes('Galaxy Date'));
 assert.ok(qa.includes('date-engine'));
 assert.ok(qa.includes('openDateMode'));
});
