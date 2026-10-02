import test from 'node:test';
import assert from 'node:assert/strict';
test('bond domain has finite questions, Bogotá Mondays and inclusive date filters',async()=>{
 const d=await import('../app/public/bond-domain.js');
 assert.equal(d.weekStart(new Date('2026-10-05T02:00:00Z')),'2026-09-28');
 assert.ok(d.gameQuestions.length>=5);
 for(const q of d.gameQuestions)assert.ok(q.id&&q.question&&q.options.length>=3);
 assert.equal(d.pickDate({minutes:1,budget:0,where:'casa'},()=>0),null);
 const idea=d.pickDate({minutes:30,budget:0,where:'casa'},()=>0);
 assert.ok(idea.minutes<=30&&idea.budget===0&&idea.where==='casa');
 assert.equal(d.gardenProgress(0).stage,0);
 assert.ok(d.gardenProgress(30).stage>d.gardenProgress(0).stage);
});
