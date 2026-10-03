import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';

const url=new URL('../supabase/functions/android-companion/context-engine.ts',import.meta.url);
const exists=existsSync(url);
test('Galaxy Context Engine module exists',()=>assert.equal(exists,true));

let api={};
if(exists){
 const source=readFileSync(url,'utf8');
 const code=stripTypeScriptTypes(source.replace(/\bexport\s+/g,''));
 const context={module:{exports:{}},exports:{},Date,Math,Set,Map,Object,Number,String,Array,JSON,Intl};
 vm.runInNewContext(code+'\n;module.exports={CONTEXT_EVENTS,contextStep,emptyContextState,cleanSample,haversineM,summarizeTrack,buildEncounterSuggestion,buildDateContextRecap,buildTripContextRecap};',context);
 api=context.module.exports;
}

const at=(seconds)=>new Date(Date.parse('2026-10-03T15:00:00Z')+seconds*1000).toISOString();
const p=(person,lat,lon,seconds,{accuracy=8,speed=0,motion='still',heading=90}={})=>({person:String(person),latitude:lat,longitude:lon,captured_at:at(seconds),accuracy,speed,motion,heading});
const frame=(seconds,people,extra={})=>({at:at(seconds),people,...extra});
const run=(frames,config={})=>{
 let state=api.emptyContextState(),events=[];
 for(const f of frames){const out=api.contextStep(state,f,config);state=out.state;events.push(...out.events);}
 return {state,events};
};
const types=r=>r.events.map(e=>e.type);

test('event catalog exposes the shared context vocabulary',()=>{
 for(const type of ['USER_NEAR_PARTNER','ENCOUNTER_STARTED','ENCOUNTER_ENDED','TRIP_STARTED','TRIP_ENDED','PLACE_ENTERED','PLACE_LEFT','DESTINATION_REACHED','LONG_ENCOUNTER','SHARED_TRIP_DETECTED'])
  assert.ok(api.CONTEXT_EVENTS.includes(type),type);
});

test('bad accuracy and impossible coordinates are rejected as GPS noise',()=>{
 assert.equal(api.cleanSample(p(0,4.7,-74,0,{accuracy:180})),null);
 assert.equal(api.cleanSample({...p(0,4.7,-74,0),latitude:120}),null);
 assert.ok(api.cleanSample(p(0,4.7,-74,0,{accuracy:25})));
});

test('near partner needs stable proximity and respects cooldown',()=>{
 const a=4.7000,b=-74.0700;
 const r=run([
  frame(0,[p(0,a,b,0),p(1,a,b+0.0018,0)]),
  frame(20,[p(0,a,b,20),p(1,a,b+0.0018,20)]),
  frame(35,[p(0,a,b,35),p(1,a,b+0.0018,35)]),
  frame(70,[p(0,a,b,70),p(1,a,b+0.0045,70)]),
  frame(120,[p(0,a,b,120),p(1,a,b+0.0018,120)]),
  frame(160,[p(0,a,b,160),p(1,a,b+0.0018,160)])
 ],{nearEnabled:true,nearDistanceM:300,nearCooldownS:3600});
 assert.equal(types(r).filter(x=>x==='USER_NEAR_PARTNER').length,1);
});

test('encounter ignores one noisy jump and starts after stable proximity',()=>{
 const a=4.7000,b=-74.0700;
 const r=run([
  frame(0,[p(0,a,b,0),p(1,a,b+0.00025,0)]),
  frame(25,[p(0,a,b,25),p(1,a,b+0.03,25,{accuracy:140})]),
  frame(35,[p(0,a,b,35),p(1,a,b+0.00022,35)]),
  frame(65,[p(0,a,b,65),p(1,a,b+0.0002,65)]),
  frame(100,[p(0,a,b,100),p(1,a,b+0.0002,100)])
 ]);
 assert.equal(types(r).filter(x=>x==='ENCOUNTER_STARTED').length,1);
});

test('temporary separation does not end encounter but sustained separation does',()=>{
 const a=4.7000,b=-74.0700;
 const r=run([
  frame(0,[p(0,a,b,0),p(1,a,b+0.0002,0)]),
  frame(70,[p(0,a,b,70),p(1,a,b+0.0002,70)]),
  frame(100,[p(0,a,b,100),p(1,a,b+0.0020,100)]),
  frame(120,[p(0,a,b,120),p(1,a,b+0.0002,120)]),
  frame(180,[p(0,a,b,180),p(1,a,b+0.0020,180)]),
  frame(230,[p(0,a,b,230),p(1,a,b+0.0021,230)])
 ]);
 assert.equal(types(r).filter(x=>x==='ENCOUNTER_STARTED').length,1);
 assert.equal(types(r).filter(x=>x==='ENCOUNTER_ENDED').length,1);
});

test('loss of one signal has a grace period before ending an encounter',()=>{
 const a=4.7,b=-74.07;
 const r=run([
  frame(0,[p(0,a,b,0),p(1,a,b+0.0002,0)]),
  frame(70,[p(0,a,b,70),p(1,a,b+0.0002,70)]),
  frame(120,[p(0,a,b,120)]),
  frame(220,[p(0,a,b,220)]),
  frame(310,[p(0,a,b,310)])
 ]);
 assert.equal(types(r).filter(x=>x==='ENCOUNTER_ENDED').length,1);
});

test('long encounter is emitted once after two hours',()=>{
 const a=4.7,b=-74.07;
 const frames=[frame(0,[p(0,a,b,0),p(1,a,b+0.0002,0)]),frame(70,[p(0,a,b,70),p(1,a,b+0.0002,70)]),frame(7300,[p(0,a,b,7300),p(1,a,b+0.0002,7300)]),frame(7400,[p(0,a,b,7400),p(1,a,b+0.0002,7400)])];
 const r=run(frames);
 assert.equal(types(r).filter(x=>x==='LONG_ENCOUNTER').length,1);
});

test('place enter and leave use hold times and hysteresis',()=>{
 const place={id:7,owner:'0',name:'Casa',kind:'home',latitude:4.7,longitude:-74.07};
 const r=run([
  frame(0,[p(0,4.7,-74.0702,0)],{places:[place]}),
  frame(50,[p(0,4.7,-74.07015,50)],{places:[place]}),
  frame(80,[p(0,4.7,-74.07015,80)],{places:[place]}),
  frame(100,[p(0,4.7,-74.072,100)],{places:[place]}),
  frame(150,[p(0,4.7,-74.072,150)],{places:[place]})
 ]);
 assert.equal(types(r).filter(x=>x==='PLACE_ENTERED').length,1);
 assert.equal(types(r).filter(x=>x==='PLACE_LEFT').length,1);
});

test('destination arrival requires a stable dwell inside arrival radius',()=>{
 const dest={person:'0',sessionId:'s1',mode:'return_home',label:'Casa',latitude:4.7,longitude:-74.07};
 const r=run([
  frame(0,[p(0,4.7007,-74.07,0)],{destinations:[dest]}),
  frame(20,[p(0,4.7002,-74.07,20)],{destinations:[dest]}),
  frame(55,[p(0,4.70015,-74.07,55)],{destinations:[dest]})
 ]);
 const arrival=r.events.find(e=>e.type==='DESTINATION_REACHED');
 assert.ok(arrival);
 assert.equal(arrival.payload.sessionId,'s1');
 assert.equal(arrival.payload.mode,'return_home');
});

test('walking, motorcycle and transit movement can start and stop trips without duplicate events',()=>{
 for(const [motion,speed] of [['walking',1.6],['vehicle',10],['vehicle',6]]){
  const r=run([
   frame(0,[p(0,4.7,-74.07,0,{motion,speed})]),
   frame(200,[p(0,4.7005,-74.07,200,{motion,speed})]),
   frame(260,[p(0,4.701,-74.07,260,{motion,speed})]),
   frame(300,[p(0,4.701,-74.07,300,{motion:'still',speed:0})]),
   frame(620,[p(0,4.701,-74.07,620,{motion:'still',speed:0})])
  ]);
  assert.equal(types(r).filter(x=>x==='TRIP_STARTED').length,1,motion+' start');
  assert.equal(types(r).filter(x=>x==='TRIP_ENDED').length,1,motion+' end');
 }
});

test('coherent nearby movement becomes a shared trip',()=>{
 const frames=[];
 for(let s=0;s<=720;s+=60){
  const lat=4.70+s*0.000002;
  frames.push(frame(s,[p(0,lat,-74.07,s,{motion:'vehicle',speed:8,heading:10}),p(1,lat,-74.0697,s,{motion:'vehicle',speed:8.5,heading:15})]));
 }
 const r=run(frames);
 assert.equal(types(r).filter(x=>x==='SHARED_TRIP_DETECTED').length,1);
});

test('same zone is not a shared trip when one person is stationary or headings conflict',()=>{
 const frames=[];
 for(let s=0;s<=720;s+=60){
  frames.push(frame(s,[p(0,4.70+s*0.000002,-74.07,s,{motion:'vehicle',speed:8,heading:0}),p(1,4.70,-74.0697,s,{motion:'still',speed:0,heading:180})]));
 }
 assert.equal(types(run(frames)).includes('SHARED_TRIP_DETECTED'),false);
});

test('track summary ignores implausible jumps and estimates walking distance',()=>{
 const samples=[
  p(0,4.7000,-74.0700,0,{motion:'walking',speed:1.4}),
  p(0,4.7005,-74.0700,60,{motion:'walking',speed:1.4}),
  p(0,4.9000,-74.0700,65,{motion:'vehicle',speed:70,accuracy:8}),
  p(0,4.7010,-74.0700,120,{motion:'walking',speed:1.4})
 ];
 const s=api.summarizeTrack(samples);
 assert.ok(s.distanceM>80&&s.distanceM<160,String(s.distanceM));
 assert.ok(s.walkingM>80&&s.walkingM<160,String(s.walkingM));
 assert.equal(s.durationS,120);
});

test('suggested memory and recaps are descriptive and keep human confirmation',()=>{
 const suggestion=api.buildEncounterSuggestion({encounter:{id:'e1',started_at:at(0),ended_at:at(7200)},place:{id:3,name:'Parque'},photos:[{path:'a.jpg'}],songs:[{title:'Canción'}]});
 assert.equal(suggestion.kind,'memory');
 assert.equal(suggestion.requiresConfirmation,true);
 assert.equal(suggestion.place.name,'Parque');
 const date=api.buildDateContextRecap({encounter:{started_at:at(0),ended_at:at(7200)},track:[p(0,4.7,-74.07,0,{motion:'walking'}),p(0,4.701,-74.07,600,{motion:'walking'})],places:[{name:'Parque'}],photos:[{path:'a.jpg'}],songs:[{title:'Canción'}],memories:[{id:'m1'}]});
 assert.ok(date.durationS>=7200);assert.ok(date.distanceM>0);assert.equal(date.photos.length,1);
 const trip=api.buildTripContextRecap({trip:{started_at:at(0),ended_at:at(3600)},track:[p(0,4.7,-74.07,0,{motion:'vehicle'}),p(0,4.71,-74.07,3600,{motion:'vehicle'})],places:[{name:'Casa'}],memories:[{id:'m2'}]});
 assert.ok(trip.map.points.length>=2);assert.ok(trip.distanceM>0);assert.equal(trip.memories.length,1);
});
