import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(path,'utf8').replace(/^\uFEFF/,'');
const csv=read('docs/branch-audit-2026-10-08.csv').trim().split(/\r?\n/).slice(1).map(row=>{
  const values=[...row.matchAll(/"([^"]*)"/g)].map(match=>match[1]);
  return{name:values[0],sha:values[1],status:values[4]};
});
const ledger=read('docs/recovery/NG-4.1.1-ARCHIVE-80-LEDGER.md');
const inventory=read('docs/recovery/NG-4.1.1-LEGACY-INVENTORY.md');
const decisions=read('docs/recovery/NG-4.1.1-RECOVERY-DECISIONS.md');
const comparison=read('docs/recovery/NG-4.1.1-LEGACY-COMPARISON.md');
const implementation=read('docs/recovery/NG-4.1.1-RECOVERY-IMPLEMENTATION.md');
const backlog=read('docs/recovery/NG-4.1.1-RECOVERY-BACKLOG.md');
test('NG-F2-001: all 80 archived refs match historical recorded SHAs',()=>{
 const uniq=csv.filter(x=>x.status==='unique');
 assert.equal(uniq.length,80);
 const rows=ledger.split('\n').filter(x=>x.startsWith('| `archive/2026-10-08/'));
 assert.equal(rows.length,80);
 for(const entry of uniq){
  const row=rows.find(x=>x.startsWith('| `archive/2026-10-08/'+entry.name+'` |'));
  assert.ok(row,'missing archive record '+entry.name);
  assert.ok(row.includes('`'+entry.sha.slice(0,9)+'`'),'SHA mismatch for '+entry.name);
 }
});
test('NG-F2-002: 28 documented candidates have stable IDs in all decision artifacts',()=>{
 const expected=Array.from({length:28},(_,i)=>'NG-LEG-'+String(i+1).padStart(3,'0'));
 for(const [name,text] of [['inventory',inventory],['comparison',comparison],['decisions',decisions]]){
  for(const id of expected)assert.ok(text.includes(id),name+' missing '+id);
  const actual=new Set([...text.matchAll(/NG-LEG-\d{3}/g)].map(x=>x[0]));
  assert.deepEqual([...actual].sort(),expected,name+' unexpected IDs');
 }
});
test('NG-F2-003: gates and deferred recoveries remain explicit',()=>{
 assert.match(decisions,/CERO recuperaciones autorizadas/);
 assert.match(implementation,/Recuperaciones implementadas:\*\* 0/);
 assert.match(backlog,/Fase 4/);
 assert.match(ledger,/NO CERTIFICACI[ÓO]N FUNCIONAL/);
 assert.match(implementation,/no se realizaron cambios ni E2E nuevos/i);
});
