export const CONTEXT_EVENTS=[
 "USER_NEAR_PARTNER","ENCOUNTER_STARTED","ENCOUNTER_ENDED","TRIP_STARTED","TRIP_ENDED",
 "PLACE_ENTERED","PLACE_LEFT","DESTINATION_REACHED","LONG_ENCOUNTER","SHARED_TRIP_DETECTED"
];

const EVENT_SET=new Set(CONTEXT_EVENTS);
const toMs=(value:unknown)=>{const n=Date.parse(String(value||""));return Number.isFinite(n)?n:0;};
const iso=(ms:number)=>new Date(ms).toISOString();
const finite=(value:unknown)=>Number.isFinite(Number(value));
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));

export function haversineM(a:any,b:any){
 const lat1=Number(a?.latitude??a?.lat),lon1=Number(a?.longitude??a?.lon),lat2=Number(b?.latitude??b?.lat),lon2=Number(b?.longitude??b?.lon);
 if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return Infinity;
 const r=6371000,p=Math.PI/180,dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p;
 const x=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;
 return 2*r*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

export function cleanSample(sample:any,options:any={}){
 if(!sample||typeof sample!=="object")return null;
 const latitude=Number(sample.latitude??sample.lat),longitude=Number(sample.longitude??sample.lon),accuracy=Number(sample.accuracy);
 if(!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)return null;
 const maxAccuracy=Math.max(20,Number(options.maxAccuracyM)||100);
 if(Number.isFinite(accuracy)&&accuracy>maxAccuracy)return null;
 const captured=String(sample.captured_at||sample.capturedAt||sample.updated_at||sample.updatedAt||"");
 if(captured&&!toMs(captured))return null;
 const speed=Number(sample.speed),heading=Number(sample.heading);
 return {
  person:String(sample.person??""),
  latitude,longitude,
  accuracy:Number.isFinite(accuracy)?Math.max(0,accuracy):null,
  speed:Number.isFinite(speed)&&speed>=0&&speed<80?speed:0,
  heading:Number.isFinite(heading)&&heading>=0&&heading<=360?heading:null,
  motion:["still","walking","vehicle"].includes(String(sample.motion))?String(sample.motion):"still",
  captured_at:captured||new Date().toISOString()
 };
}

function cleanTrack(samples:any[],options:any={}){
 const rows:any[]=(samples||[]).map(x=>cleanSample(x,options)).filter((x:any)=>x!==null).sort((a:any,b:any)=>toMs(a.captured_at)-toMs(b.captured_at));
 const accepted:any[]=[];
 const maxImplied=Math.max(15,Number(options.maxImpliedSpeedMs)||65);
 for(const row of rows){
  const last=accepted[accepted.length-1];
  if(last){
   const dt=(toMs(row.captured_at)-toMs(last.captured_at))/1000;
   if(dt<=0)continue;
   const implied=haversineM(last,row)/dt;
   if(implied>maxImplied)continue;
  }
  accepted.push(row);
 }
 return accepted;
}

export function summarizeTrack(samples:any[],options:any={}){
 const rows=cleanTrack(samples,options);
 let distanceM=0,walkingM=0;
 for(let i=1;i<rows.length;i++){
  const meters=haversineM(rows[i-1],rows[i]);
  if(!Number.isFinite(meters))continue;
  distanceM+=meters;
  if(rows[i-1].motion==="walking"&&rows[i].motion==="walking")walkingM+=meters;
 }
 const durationS=rows.length>1?Math.max(0,Math.round((toMs(rows[rows.length-1].captured_at)-toMs(rows[0].captured_at))/1000)):0;
 return {distanceM:Math.round(distanceM),walkingM:Math.round(walkingM),durationS,points:rows};
}

export function emptyContextState(){
 return {
  version:1,
  near:{candidateSince:null,farSince:null,inside:false,lastEmittedAt:null},
  nearProfiles:{},
  encounter:{nearSince:null,farSince:null,active:false,startedAt:null,lastBothSeenAt:null,longEmitted:false},
  people:{},
  places:{},
  destinations:{},
  shared:{candidateSince:null,lastGoodAt:null,samples:0,active:false,startedAt:null}
 };
}

function emit(events:any[],type:string,atMs:number,payload:any={}){
 if(!EVENT_SET.has(type))return;
 events.push({type,occurredAt:iso(atMs),payload});
}
function personState(state:any,person:string){
 if(!state.people[person])state.people[person]={movingSince:null,stillSince:null,tripActive:false,tripStartedAt:null};
 return state.people[person];
}
function headingDiff(a:any,b:any){
 if(!finite(a)||!finite(b))return null;
 const d=Math.abs(Number(a)-Number(b))%360;return Math.min(d,360-d);
}
function coherentShared(a:any,b:any,distance:number){
 if(!a||!b||distance>100)return false;
 if(a.motion==="still"||b.motion==="still")return false;
 if((a.speed||0)<0.8||(b.speed||0)<0.8)return false;
 const hd=headingDiff(a.heading,b.heading);
 if(hd!=null&&hd>65)return false;
 if(Math.abs(Number(a.speed||0)-Number(b.speed||0))>5)return false;
 return true;
}

export function contextStep(previous:any,frame:any,config:any={}){
 const state=previous?clone(previous):emptyContextState(),events:any[]=[];
 state.version=1;state.people=state.people||{};state.places=state.places||{};state.destinations=state.destinations||{};
 state.near=state.near||emptyContextState().near;state.nearProfiles=state.nearProfiles||{};state.encounter=state.encounter||emptyContextState().encounter;state.shared=state.shared||emptyContextState().shared;
 const atMs=toMs(frame?.at)||Date.now();
 const people=(frame?.people||[]).map((x:any)=>cleanSample(x,config)).filter(Boolean);
 const byPerson=new Map(people.map((x:any)=>[String(x.person),x]));
 const both=byPerson.get("0")&&byPerson.get("1")?[byPerson.get("0"),byPerson.get("1")]:null;

 // Individual derived trip transitions.
 for(const sample of people as any[]){
  const ps=personState(state,String(sample.person));
  const moving=sample.motion!=="still"&&Number(sample.speed)>=0.8;
  if(moving){
   ps.stillSince=null;
   if(!ps.movingSince)ps.movingSince=iso(atMs);
   if(!ps.tripActive&&atMs-toMs(ps.movingSince)>=Math.max(60,Number(config.tripStartHoldS)||180)*1000){
    ps.tripActive=true;ps.tripStartedAt=ps.movingSince;
    emit(events,"TRIP_STARTED",atMs,{person:String(sample.person),startedAt:ps.tripStartedAt,motion:sample.motion});
   }
  }else{
   ps.movingSince=null;
   if(!ps.stillSince)ps.stillSince=iso(atMs);
   if(ps.tripActive&&atMs-toMs(ps.stillSince)>=Math.max(60,Number(config.tripEndHoldS)||300)*1000){
    emit(events,"TRIP_ENDED",atMs,{person:String(sample.person),startedAt:ps.tripStartedAt,endedAt:iso(atMs)});
    ps.tripActive=false;ps.tripStartedAt=null;
   }
  }
 }

 if(both){
  const [a,b]=both as any[],distance=haversineM(a,b);
  state.encounter.lastBothSeenAt=iso(atMs);

  // USER_NEAR_PARTNER: independent opt-in/cooldown per recipient.
  const profiles=config.nearProfiles&&typeof config.nearProfiles==="object"
   ?Object.entries(config.nearProfiles)
   :[["*",{enabled:config.nearEnabled===true,distanceM:config.nearDistanceM,cooldownS:config.nearCooldownS}]];
  for(const [profileId,profileValue] of profiles as any[]){
   const profile:any=profileValue||{};
   if(profile.enabled!==true)continue;
   const nearDistance=Math.max(80,Math.min(5000,Number(profile.distanceM)||300));
   const nearKey=String(profileId),ns=nearKey==="*"?state.near:(state.nearProfiles[nearKey]||{candidateSince:null,farSince:null,inside:false,lastEmittedAt:null});
   if(distance<=nearDistance){
    ns.farSince=null;
    if(!ns.candidateSince)ns.candidateSince=iso(atMs);
    const stable=atMs-toMs(ns.candidateSince)>=Math.max(10,Number(profile.holdS??config.nearHoldS)||30)*1000;
    const cooldown=Math.max(60,Number(profile.cooldownS)||3600)*1000;
    if(stable&&!ns.inside&&(!ns.lastEmittedAt||atMs-toMs(ns.lastEmittedAt)>=cooldown)){
     emit(events,"USER_NEAR_PARTNER",atMs,{targetPerson:nearKey==="*"?null:nearKey,distanceM:Math.round(distance),thresholdM:nearDistance,candidateSince:ns.candidateSince});
     ns.inside=true;ns.lastEmittedAt=iso(atMs);
    }
   }else if(distance>nearDistance*1.5){
    ns.candidateSince=null;
    if(!ns.farSince)ns.farSince=iso(atMs);
    if(atMs-toMs(ns.farSince)>=15000)ns.inside=false;
   }
   if(nearKey!=="*")state.nearProfiles[nearKey]=ns;
  }

  // Encounter state machine. 80m entry / 150m exit.
  if(distance<=80){
   state.encounter.farSince=null;
   if(!state.encounter.nearSince)state.encounter.nearSince=iso(atMs);
   if(!state.encounter.active&&atMs-toMs(state.encounter.nearSince)>=Math.max(30,Number(config.encounterHoldS)||60)*1000){
    state.encounter.active=true;state.encounter.startedAt=state.encounter.nearSince;state.encounter.longEmitted=false;
    emit(events,"ENCOUNTER_STARTED",atMs,{startedAt:state.encounter.startedAt,distanceM:Math.round(distance)});
   }
  }else if(distance>150){
   state.encounter.nearSince=null;
   if(state.encounter.active){
    if(!state.encounter.farSince)state.encounter.farSince=iso(atMs);
    if(atMs-toMs(state.encounter.farSince)>=Math.max(20,Number(config.encounterExitHoldS)||45)*1000){
     emit(events,"ENCOUNTER_ENDED",atMs,{startedAt:state.encounter.startedAt,endedAt:iso(atMs),distanceM:Math.round(distance)});
     state.encounter.active=false;state.encounter.startedAt=null;state.encounter.farSince=null;state.encounter.longEmitted=false;
    }
   }
  }
  if(state.encounter.active&&!state.encounter.longEmitted&&atMs-toMs(state.encounter.startedAt)>=Math.max(1800,Number(config.longEncounterS)||7200)*1000){
   emit(events,"LONG_ENCOUNTER",atMs,{startedAt:state.encounter.startedAt,durationS:Math.round((atMs-toMs(state.encounter.startedAt))/1000)});
   state.encounter.longEmitted=true;
  }

  // Shared trip candidate: nearby, both moving, coherent headings/speed, minimum samples + duration.
  if(config.sharedTripEnabled!==false&&coherentShared(a,b,distance)){
   if(!state.shared.candidateSince){state.shared.candidateSince=iso(atMs);state.shared.samples=1;}else state.shared.samples=Number(state.shared.samples||0)+1;
   state.shared.lastGoodAt=iso(atMs);
   const minS=Math.max(300,Number(config.sharedTripHoldS)||600),minSamples=Math.max(6,Number(config.sharedTripSamples)||8);
   if(!state.shared.active&&state.shared.samples>=minSamples&&atMs-toMs(state.shared.candidateSince)>=minS*1000){
    state.shared.active=true;state.shared.startedAt=state.shared.candidateSince;
    emit(events,"SHARED_TRIP_DETECTED",atMs,{startedAt:state.shared.startedAt,distanceM:Math.round(distance),samples:state.shared.samples});
   }
  }else{
   if(state.shared.lastGoodAt&&atMs-toMs(state.shared.lastGoodAt)>90000){
    state.shared.candidateSince=null;state.shared.samples=0;
    if(state.shared.active){state.shared.active=false;state.shared.startedAt=null;}
   }
  }
 }else{
  // Missing partner data should not instantly end a valid encounter.
  if(state.encounter.active&&state.encounter.lastBothSeenAt&&atMs-toMs(state.encounter.lastBothSeenAt)>=Math.max(120,Number(config.signalLossGraceS)||180)*1000){
   emit(events,"ENCOUNTER_ENDED",atMs,{startedAt:state.encounter.startedAt,endedAt:iso(atMs),reason:"signal_lost"});
   state.encounter.active=false;state.encounter.startedAt=null;state.encounter.nearSince=null;state.encounter.farSince=null;state.encounter.longEmitted=false;
  }
 }

 // Saved place transitions.
 for(const place of frame?.places||[]){
  const person=String(place.owner??place.person??""),sample=byPerson.get(person) as any;
  if(!sample||!finite(place.latitude)||!finite(place.longitude))continue;
  const key=person+":"+String(place.id),ps=state.places[key]||{insideSince:null,outsideSince:null,entered:false};
  const distance=haversineM(sample,place);
  if(distance<=Math.max(30,Number(config.placeEnterM)||80)){
   ps.outsideSince=null;
   if(!ps.insideSince)ps.insideSince=iso(atMs);
   if(!ps.entered&&atMs-toMs(ps.insideSince)>=Math.max(20,Number(config.placeEnterHoldS)||45)*1000){
    ps.entered=true;emit(events,"PLACE_ENTERED",atMs,{person,placeId:place.id,name:String(place.name||""),kind:String(place.kind||""),distanceM:Math.round(distance)});
   }
  }else if(distance>Math.max(100,Number(config.placeExitM)||150)){
   ps.insideSince=null;
   if(ps.entered){
    if(!ps.outsideSince)ps.outsideSince=iso(atMs);
    if(atMs-toMs(ps.outsideSince)>=Math.max(20,Number(config.placeExitHoldS)||45)*1000){
     ps.entered=false;ps.outsideSince=null;emit(events,"PLACE_LEFT",atMs,{person,placeId:place.id,name:String(place.name||""),kind:String(place.kind||""),distanceM:Math.round(distance)});
    }
   }
  }
  state.places[key]=ps;
 }

 // Active destinations / Acompáñame sessions.
 const activeDestinationKeys=new Set<string>();
 for(const destination of frame?.destinations||[]){
  const person=String(destination.person??""),sample=byPerson.get(person) as any;
  if(!sample||!finite(destination.latitude)||!finite(destination.longitude))continue;
  const key=person+":"+String(destination.sessionId||destination.id||destination.label||"destination");
  activeDestinationKeys.add(key);
  const ds=state.destinations[key]||{insideSince:null,reached:false};
  const distance=haversineM(sample,destination),radius=Math.max(25,Number(destination.arrivalRadiusM)||Number(config.destinationM)||60);
  if(distance<=radius){
   if(!ds.insideSince)ds.insideSince=iso(atMs);
   if(!ds.reached&&atMs-toMs(ds.insideSince)>=Math.max(10,Number(config.destinationHoldS)||30)*1000){
    ds.reached=true;
    emit(events,"DESTINATION_REACHED",atMs,{
     person,sessionId:String(destination.sessionId||""),mode:String(destination.mode||"accompany"),
     label:String(destination.label||"Destino"),placeId:destination.placeId??null,distanceM:Math.round(distance)
    });
   }
  }else if(distance>radius*1.8&&!ds.reached)ds.insideSince=null;
  state.destinations[key]=ds;
 }
 for(const key of Object.keys(state.destinations))if(!activeDestinationKeys.has(key))delete state.destinations[key];

 return {state,events};
}

export function buildEncounterSuggestion(input:any={}){
 const encounter=input.encounter||{},place=input.place||null,photos=(input.photos||[]).slice(0,12),songs=(input.songs||[]).slice(0,8);
 const start=toMs(encounter.started_at||encounter.startedAt),end=toMs(encounter.ended_at||encounter.endedAt)||Date.now();
 return {
  kind:"memory",requiresConfirmation:true,source:"encounter",
  encounterId:encounter.id||null,
  title:place?.name?"Después de vernos en "+String(place.name):"Después de vernos",
  durationS:start?Math.max(0,Math.round((end-start)/1000)):0,
  place:place?{id:place.id??null,name:String(place.name||""),kind:String(place.kind||"")}:null,
  trip:input.trip||null,photos,songs
 };
}

function recapBase(input:any){
 const encounter=input.encounter||{},trip=input.trip||{},start=toMs(encounter.started_at||encounter.startedAt||trip.started_at||trip.startedAt),end=toMs(encounter.ended_at||encounter.endedAt||trip.ended_at||trip.endedAt)||Date.now();
 const track=summarizeTrack(input.track||[]);
 const mapPoints=track.points.map((x:any)=>({latitude:x.latitude,longitude:x.longitude,capturedAt:x.captured_at}));
 return {
  startedAt:start?iso(start):null,endedAt:end?iso(end):null,
  durationS:start?Math.max(track.durationS,Math.round((end-start)/1000)):track.durationS,
  distanceM:track.distanceM,walkingM:track.walkingM,
  places:(input.places||[]).slice(0,20).map((x:any)=>({id:x.id??null,name:String(x.name||""),kind:String(x.kind||"")})),
  photos:(input.photos||[]).slice(0,40),songs:(input.songs||[]).slice(0,20),memories:(input.memories||[]).slice(0,40),
  map:{points:mapPoints}
 };
}
export function buildDateContextRecap(input:any={}){return {kind:"date",...recapBase(input),requiresConfirmation:true};}
export function buildTripContextRecap(input:any={}){return {kind:"trip",...recapBase(input)};}
