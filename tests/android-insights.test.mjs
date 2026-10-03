import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=readFileSync(resolve(root,'android/app/src/main/assets/mobile/insights.js'),'utf8');
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
  assert.deepEqual(delta,{memories:3,distance_m:-2000,mood_days:0});
});

test('mood compatibility is deterministic and distinguishes exact matches',()=>{
  assert.equal(compatibleMood('feliz','feliz'),'exact');
  assert.equal(compatibleMood('feliz','tranquilo'),'compatible');
  assert.equal(compatibleMood('sensible','abrazo'),'compatible');
  assert.equal(compatibleMood('feliz','cansado'),null);
  assert.equal(compatibleMood(null,'feliz'),null);
});
