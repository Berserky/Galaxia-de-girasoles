import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/insights.js'),'utf8');
const html=readFileSync(resolve(root,'android/app/src/main/assets/mobile/index.html'),'utf8');
const appSource=readFileSync(resolve(root,'android/app/src/main/assets/mobile/app.js'),'utf8');
const css=readFileSync(resolve(root,'android/app/src/main/assets/mobile/app.css'),'utf8');
const context={module:{exports:{}},exports:{},globalThis:{},Intl,Date,Math};
vm.runInNewContext(source,context);
const {periodFor,shiftPeriod,anniversaryDay,relationshipClock,compareMetrics,compatibleMood}=context.module.exports;

test('week period uses Monday-Sunday and crosses year in Bogota calendar',()=>{
  const period=periodFor('week','2026-12-31','2027-01-03');
  assert.equal(period.startDay,'2026-12-28');
  assert.equal(period.endDay,'2027-01-04');
  assert.equal(period.key,'2026-12-28');
  assert.equal(period.kind,'week');
});

test('month and year periods honor leap February and reject future periods',()=>{
  const feb=periodFor('month','2028-02','2028-02-15');
  assert.equal(feb.startDay,'2028-02-01');
  assert.equal(feb.endDay,'2028-03-01');
  const year=periodFor('year','2028','2028-06-01');
  assert.equal(year.startDay,'2028-01-01');
  assert.equal(year.endDay,'2029-01-01');
  assert.equal(periodFor('month','2028-07','2028-06-01'),null);
  assert.equal(periodFor('year','2029','2028-06-01'),null);
});

test('period shifting is stable across month and year boundaries',()=>{
  assert.equal(shiftPeriod(periodFor('week','2027-01-01','2027-01-05'),-1).key,'2026-12-21');
  assert.equal(shiftPeriod(periodFor('month','2026-01','2026-01-20'),-1).key,'2025-12');
  assert.equal(shiftPeriod(periodFor('year','2026','2026-10-03'),-1).key,'2025');
});

test('anniversary clamps day 31 to the last valid day of short months',()=>{
  assert.equal(anniversaryDay('2026-01-31','2026-02'),'2026-02-28');
  assert.equal(anniversaryDay('2024-01-31','2028-02'),'2028-02-29');
  assert.equal(anniversaryDay('2026-01-30','2026-04'),'2026-04-30');
});

test('relationship clock uses real calendar months instead of 30-day approximations',()=>{
  const clock=relationshipClock('2025-01-31','2026-03-03T10:00:00-05:00');
  assert.deepEqual(
    {years:clock.years,months:clock.months,days:clock.days,totalDays:clock.totalDays},
    {years:1,months:1,days:3,totalDays:396}
  );
  assert.ok(clock.totalHours>=9510&&clock.totalHours<=9520);
});

test('relationship clock rejects invalid or future starts',()=>{
  assert.equal(relationshipClock('','2026-03-03T10:00:00-05:00'),null);
  assert.equal(relationshipClock('2027-01-01','2026-03-03T10:00:00-05:00'),null);
});

test('metric comparison returns numeric deltas without judging them',()=>{
  const delta=compareMetrics({memories:8,distance_m:10000,mood_days:4},{memories:5,distance_m:12000,mood_days:4});
  assert.equal(delta.memories,3);
  assert.equal(delta.distance_m,-2000);
  assert.equal(delta.mood_days,0);
});

test('mood compatibility is deterministic and distinguishes exact matches',()=>{
  assert.equal(compatibleMood('feliz','feliz'),'exact');
  assert.equal(compatibleMood('feliz','tranquilo'),'compatible');
  assert.equal(compatibleMood('sensible','abrazo'),'compatible');
  assert.equal(compatibleMood('feliz','cansado'),null);
  assert.equal(compatibleMood(null,'feliz'),null);
});


test('Android loads the insights domain before the main application',()=>{
  const insights=html.indexOf('src="./insights.js"');
  const app=html.indexOf('src="./app.js"');
  assert.ok(insights>=0,'insights.js must be loaded by the WebView');
  assert.ok(app>insights,'insights.js must load before app.js');
});


test('home exposes week month and year through one reusable insights experience',()=>{
 assert.ok(appSource.includes('function insightsTeaser()'));
 assert.ok(appSource.includes('function openInsights('));
 assert.ok(appSource.includes('function insightsSummaryMarkup('));
 for(const action of ['insights-week-open','insights-month-open','insights-year-open','insights-period'])
  assert.ok(appSource.includes('data-action="'+action+'"')||appSource.includes("a==='"+action+"'"),action+' must be wired');
 assert.ok(appSource.includes("api('insights-summary'"),'UI must consume the generic insights endpoint');
 assert.equal(appSource.includes("api('monthly-summary'"),false,'month UI must not use the legacy monthly endpoint');
});

test('relationship clock and anniversary experience use configured start date without persistence',()=>{
 assert.ok(appSource.includes('function relationshipClockCard()'));
 assert.ok(appSource.includes('GalaxyInsights?.relationshipClock'));
 assert.ok(appSource.includes('function anniversaryInsightsBanner()'));
 assert.ok(appSource.includes("openInsights('anniversary'"));
 const anniversaryBlock=appSource.slice(appSource.indexOf('function anniversaryInsightsBanner()'),appSource.indexOf('function livingMomentCard()'));
 assert.equal(/item-save|insert|saveItem/.test(anniversaryBlock),false,'anniversary experience must stay derived');
});

test('Wrapped is rendered from annual series in capture-friendly cards and respects reduced motion',()=>{
 assert.ok(appSource.includes('function wrappedCards('));
 assert.ok(appSource.includes('summary.series'));
 assert.ok(css.includes('.wrapped-card'));
 assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
 const reduced=css.slice(css.lastIndexOf('@media(prefers-reduced-motion:reduce)'));
 assert.ok(reduced.includes('.wrapped-card'),'Wrapped animation must be disabled for reduced motion');
});

test('emotional calendar is accessible and trends stay descriptive',()=>{
 assert.ok(appSource.includes('function emotionalHeatmap('));
 assert.ok(appSource.includes('aria-label='));
 assert.ok(appSource.includes('function emotionalTrends('));
 const start=appSource.indexOf('function emotionalTrends('),end=appSource.indexOf('function achievementGrid(',start);
 const trends=appSource.slice(start,end).toLowerCase();
 for(const clinical of ['diagnóstico','trastorno','depresión','ansiedad clínica','salud mental'])
  assert.equal(trends.includes(clinical),false,'emotional trends must not diagnose: '+clinical);
});

test('achievements render from backend-derived catalog without creating a parallel store',()=>{
 assert.ok(appSource.includes('function achievementGrid('));
 assert.ok(appSource.includes('summary.achievements'));
 assert.ok(css.includes('.achievement-card'));
 assert.equal(appSource.includes('achievement-save'),false);
});
