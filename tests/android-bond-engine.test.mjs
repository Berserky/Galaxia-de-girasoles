import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const url=new URL('../supabase/functions/android-companion/bond-engine.ts',import.meta.url);
const exists=existsSync(url);
test('Galaxy Bond 2.0 pure engine exists',()=>assert.equal(exists,true));

let api={};
if(exists){
 const source=readFileSync(url,'utf8');
 const code=stripTypeScriptTypes(source.replace(/\bexport\s+/g,''));
 const context={module:{exports:{}},exports:{},Intl,Date,Math,Set,Map,Object,Number,String,Array,JSON};
 vm.runInNewContext(code+'\n;module.exports={BUILTIN_GESTURES,GESTURE_BEHAVIORS,GESTURE_ICONS,bogotaDay,jointParticipationDays,computeBondProgress,gardenState,normalizeCustomGesture,gestureSnapshot};',context);
 api=context.module.exports;
}

const both=days=>days.flatMap(day=>[{day,person:'0'},{day,person:'1'}]);

test('joint days preserve accumulated participation and ignore duplicates',()=>{
 const rows=[...both(['2026-09-29','2026-09-30','2026-10-01']),{day:'2026-10-01',person:'0'},{day:'2026-10-02',person:'0'}];
 assert.deepEqual(Array.from(api.jointParticipationDays(rows)),['2026-09-29','2026-09-30','2026-10-01']);
 const stats=api.computeBondProgress(rows,'2026-10-02T15:00:00Z');
 assert.equal(stats.totalDays,3);
});

test('Bogota day changes at 05:00 UTC and not at UTC midnight',()=>{
 assert.equal(api.bogotaDay('2026-10-04T04:59:59Z'),'2026-10-03');
 assert.equal(api.bogotaDay('2026-10-04T05:00:00Z'),'2026-10-04');
});

test('current streak remains active just after Bogota midnight when yesterday was joint',()=>{
 const rows=both(['2026-10-01','2026-10-02','2026-10-03']);
 const before=api.computeBondProgress(rows,'2026-10-04T04:59:59Z');
 assert.equal(before.today,'2026-10-03');
 assert.equal(before.currentStreak,3);
 const after=api.computeBondProgress(rows,'2026-10-04T05:00:01Z');
 assert.equal(after.today,'2026-10-04');
 assert.equal(after.currentStreak,3);
});

test('missing yesterday resets current streak but preserves total and record',()=>{
 const rows=both(['2026-09-25','2026-09-26','2026-09-27','2026-10-01']);
 const stats=api.computeBondProgress(rows,'2026-10-03T16:00:00Z');
 assert.equal(stats.totalDays,4);
 assert.equal(stats.currentStreak,0);
 assert.equal(stats.recordStreak,3);
});

test('historical record is the longest consecutive run',()=>{
 const rows=both(['2026-08-01','2026-08-02','2026-08-04','2026-08-05','2026-08-06','2026-09-01']);
 const stats=api.computeBondProgress(rows,'2026-09-01T18:00:00Z');
 assert.equal(stats.recordStreak,3);
 assert.equal(stats.currentStreak,1);
});

test('garden preserves legacy thresholds and adds visual unlockables',()=>{
 const expectations=[[0,0],[1,1],[7,2],[14,3],[30,4],[60,5],[100,6],[180,7],[365,8]];
 for(const [days,stage] of expectations)assert.equal(api.gardenState(days).stage,stage,String(days));
 const g=api.gardenState(100);
 assert.equal(g.totalDays,100);
 assert.ok(g.unlockables.length>=6);
 assert.ok(g.unlockables.every(x=>x.unlocked===true));
});

test('built-in gestures keep legacy ids and add a haptic tap',()=>{
 const ids=api.BUILTIN_GESTURES.map(x=>x.id);
 for(const id of ['hug','kiss','miss','tap'])assert.ok(ids.includes(id));
 const tap=api.BUILTIN_GESTURES.find(x=>x.id==='tap');
 assert.ok(['haptic','message_haptic'].includes(tap.behavior));
});

test('custom gestures use an allowlisted Lucide icon and allowed behavior',()=>{
 const g=api.normalizeCustomGesture({name:' Choque de puños ',icon:'hand',text:' Estoy contigo ',behavior:'message_haptic'});
 assert.equal(g.name,'Choque de puños');
 assert.equal(g.icon,'hand');
 assert.equal(g.text,'Estoy contigo');
 assert.equal(g.behavior,'message_haptic');
 assert.ok(api.GESTURE_ICONS.includes(g.icon));
 assert.ok(api.GESTURE_BEHAVIORS.includes(g.behavior));
});

test('custom gestures reject unknown icons, behavior and empty text',()=>{
 assert.throws(()=>api.normalizeCustomGesture({name:'X',icon:'banana',text:'Hola',behavior:'message'}),/icono/i);
 assert.throws(()=>api.normalizeCustomGesture({name:'X',icon:'heart',text:'Hola',behavior:'explode'}),/comportamiento/i);
 assert.throws(()=>api.normalizeCustomGesture({name:'X',icon:'heart',text:'',behavior:'message'}),/texto/i);
});

test('gesture snapshots remain usable after a custom preset is later deleted',()=>{
 const custom={id:'11111111-1111-4111-8111-111111111111',name:'Aquí estoy',icon:'heart',text:'Pensé en ti',behavior:'message'};
 const snap=api.gestureSnapshot(custom);
 assert.deepEqual(Object.keys(snap).sort(),['behavior','gestureId','icon','name','text'].sort());
 assert.equal(snap.gestureId,custom.id);
 assert.equal(snap.text,'Pensé en ti');
});
