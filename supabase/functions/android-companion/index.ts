import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { aggregateInsightRows, evaluateAchievements, isInsightVisibleItem, periodBounds, previousPeriod } from "./insights.ts";
import { QUESTION_DECKS, buildDateRecap, buildSequentialPlan, buildSurpriseExperience, normalizePlanCategory, questionById, roulettePendingPlans, selectQuestion } from "./date-engine.ts";
import { buildGoalDateSuggestions, buildGoalInsightSummary, computeGoalProgress, conversionDraft, normalizeContribution, normalizeGoalInput, reorderStepIds } from "./goals-engine.ts";
import { BUILTIN_GESTURES, computeBondProgress, gestureSnapshot, normalizeCustomGesture, resolveGesture } from "./bond-engine.ts";
import { PUSH_EVENT_TYPES, firebaseAndroidClientConfig, sanitizePushPayload, sendFcmData } from "./push-engine.ts";
import { CONTEXT_EVENTS, buildDateContextRecap, buildEncounterSuggestion, buildTripContextRecap, contextStep, emptyContextState, haversineM, summarizeTrack } from "./context-engine.ts";
import { bookSections, buildIntelligenceDocument, contentHashInput, explainConnection, normalizeSearchText, sanitizeTranscriptSegments, validateNarrative } from "./intelligence-engine.ts";
import { aiProviderConfig, extractJsonObject, generateGroundedResponse, gteSmallEmbedding, transcribeAudioBlob } from "./intelligence-provider.ts";

const url=Deno.env.get("SUPABASE_URL")!;
// FCM HTTP v1 transport lives in push-engine.ts; credentials are server-side only.
const FCM_HTTP_V1="https://fcm.googleapis.com/v1/projects/";
const FCM_OAUTH_TOKEN_URL="https://oauth2.googleapis.com/token";
// Galaxy Intelligence secrets are Edge-only. Never return these values to clients.
const INTELLIGENCE_SECRET_NAMES=["OPENAI_API_KEY","GALAXY_AI_MODEL","GALAXY_TRANSCRIBE_MODEL"];
const INTELLIGENCE_EMBEDDING_MODEL="gte-small";
let service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
try{
  const modern=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
  service=modern.default||service;
}catch{}
if(!service)throw new Error("Missing Supabase server key");

const db=createClient(url,service,{auth:{persistSession:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{"content-type":"application/json","cache-control":"no-store"}
});
const sha=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("");
const dist=(a:any,b:any)=>{const R=6371000,rad=(x:number)=>x*Math.PI/180,dLat=rad(Number(b.latitude)-Number(a.latitude)),dLon=rad(Number(b.longitude)-Number(a.longitude)),h=Math.sin(dLat/2)**2+Math.cos(rad(Number(a.latitude)))*Math.cos(rad(Number(b.latitude)))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
const ok=async(q:PromiseLike<any>)=>{const {data,error}=await q;if(error)throw error;return data;};
const today=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function monthBounds(month:string){
  if(!/^\d{4}-\d{2}$/.test(month))throw new Error("Mes no válido");
  const [yearValue,monthValue]=month.split("-").map(Number);
  if(!Number.isInteger(yearValue)||monthValue<1||monthValue>12)throw new Error("Mes no válido");
  // Bogotá is UTC-05:00 year-round. These instants represent local month boundaries.
  const start=new Date(Date.UTC(yearValue,monthValue-1,1,5,0,0,0));
  const nextYear=monthValue===12?yearValue+1:yearValue;
  const nextMonth=monthValue===12?0:monthValue;
  const end=new Date(Date.UTC(nextYear,nextMonth,1,5,0,0,0));
  return {start:start.toISOString(),end:end.toISOString()};
}

const text=(v:unknown,max:number)=>String(v??"").trim().slice(0,max);
const validDate=(v:unknown)=>{
  if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const parsed=new Date(v+"T12:00:00Z");
  return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===v;
};
const allowedKinds=new Set(["memory","song","event","plan","note","capsule","wish","journey"]);
const questions:Record<string,string[]>={
 comfort:["Un abrazo","Hablar de todo","Un rato de calma","Algo rico"],
 date:["Película en casa","Paseo al aire libre","Cocinar juntos","Descubrir un café"],
 love:["Palabras bonitas","Tiempo juntos","Una sorpresa","Ayuda con algo"],
 travel:["La playa","La montaña","Una ciudad nueva","Una cabaña"],
 morning:["Dormir un poco más","Desayunar juntos","Salir a caminar","Música y café"],
 memory:["Nuestro primer encuentro","Un viaje juntos","Una conversación","Un abrazo especial"]
};

async function device(req:Request){
  const token=req.headers.get("x-device-token")||"";
  if(token.length<40)throw new Error("Dispositivo no vinculado");
  const hash=await sha(token),rows=await ok(db.from("galaxy_devices").select("id,person,name,revoked_at,last_seen_at").eq("token_hash",hash).is("revoked_at",null).limit(1));
  if(!rows?.length)throw new Error("Dispositivo revocado o no válido");
  const d=rows[0],lastSeen=Date.parse(String(d.last_seen_at||""));
  if(!Number.isFinite(lastSeen)||Date.now()-lastSeen>5*60*1000){
    await ok(db.from("galaxy_devices").update({last_seen_at:new Date().toISOString()}).eq("id",d.id));
  }
  return d;
}

async function pair(body:any){
  const code=String(body.code||"").replace(/\s+/g,"").toUpperCase();
  if(code.length<20)return json({error:"Código de vinculación no válido"},400);
  const hash=await sha(code),now=new Date().toISOString(),rows=await ok(db.from("galaxy_device_pair_codes").select("*").eq("code_hash",hash).is("used_at",null).gt("expires_at",now).limit(1));
  if(!rows?.length)return json({error:"El código expiró o ya fue utilizado"},401);
  const row=rows[0],secret=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-",""),tokenHash=await sha(secret),name=text(body.device_name||row.device_name||"Android",80)||"Android";
  const created=await ok(db.from("galaxy_devices").insert({person:row.person,name,token_hash:tokenHash,last_seen_at:now}).select("id,person,name").single());
  await ok(db.from("galaxy_device_pair_codes").update({used_at:now}).eq("code_hash",hash));
  return json({device_token:secret,device:created});
}


async function pairCodeCreate(req:Request,body:any){
  const d=await device(req),caller=String(d.person),target=String(body.target_person??caller);
  if(!["0","1"].includes(target))return json({error:"Perfil no válido"},400);
  if(target!==caller&&caller!=="0")return json({error:"Solo Sebas puede generar un código para el perfil de su pareja."},403);
  const deviceName=text(body.device_name||"Android",80)||"Android",now=new Date().toISOString();
  await ok(db.from("galaxy_device_pair_codes").delete().eq("person",target).lt("expires_at",now));
  await ok(db.from("galaxy_device_pair_codes").delete().eq("person",target).not("used_at","is",null));
  const code=(crypto.randomUUID().replaceAll("-","")+(crypto.randomUUID().replaceAll("-","")).slice(0,8)).toUpperCase();
  await ok(db.from("galaxy_device_pair_codes").insert({
    code_hash:await sha(code),person:target,device_name:deviceName,
    expires_at:new Date(Date.now()+10*60*1000).toISOString()
  }));
  const settings=await ok(db.from("galaxy_settings").select("data").eq("id",1).single());
  const names=Array.isArray(settings?.data?.names)?settings.data.names:["Sebas","Adri"];
  return json({code,target_person:target,profile_name:text(names[Number(target)]||("Perfil "+target),40),expires_minutes:10});
}

async function profileRepair(req:Request,body:any){
  const d=await device(req),current=String(d.person),target=String(body.target_person||"1");
  if(current===target)return json({ok:true,person:current});
  if(current!=="0"||target!=="1")return json({error:"Este cambio de perfil no está permitido."},403);
  await ok(db.from("galaxy_device_place_presence").delete().eq("device_id",d.id));
  const updated=await ok(db.from("galaxy_devices").update({person:target,last_seen_at:new Date().toISOString()}).eq("id",d.id).select("id,person,name").single());
  const settings=await ok(db.from("galaxy_settings").select("data").eq("id",1).single());
  const names=Array.isArray(settings?.data?.names)?settings.data.names:["Sebas","Adri"];
  return json({ok:true,person:String(updated.person),profile_name:text(names[Number(updated.person)]||"Adri",40)});
}

async function deviceRevoke(req:Request,body:any){
  const d=await device(req),targetId=String(body.id||"");
  if(!targetId)return json({error:"Dispositivo no válido."},400);
  if(targetId===String(d.id))return json({error:"Usa “Desvincular este teléfono” para quitar el dispositivo actual."},400);
  const row=(await ok(db.from("galaxy_devices").select("id,person,revoked_at").eq("id",targetId).limit(1)))?.[0];
  if(!row||row.revoked_at)return json({ok:true});
  if(String(d.person)!=="0"&&String(row.person)!==String(d.person))return json({error:"No puedes administrar ese dispositivo."},403);
  await ok(db.from("galaxy_devices").update({revoked_at:new Date().toISOString()}).eq("id",targetId));
  await Promise.all([
    ok(db.from("galaxy_device_place_presence").delete().eq("device_id",targetId)),
    ok(db.from("galaxy_push_tokens").delete().eq("device_id",targetId)),
    ok(db.from("galaxy_push_subscriptions").delete().eq("device_id",targetId))
  ]);
  return json({ok:true});
}

function point(body:any){
  const lat=Number(body.latitude),lon=Number(body.longitude),accuracy=Number(body.accuracy),speed=Number(body.speed),heading=Number(body.heading),motion=["still","walking","vehicle"].includes(body.motion)?body.motion:null;
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)throw new Error("Ubicación no válida");
  return {lat,lon,accuracy:Number.isFinite(accuracy)&&accuracy>=0?accuracy:null,speed:Number.isFinite(speed)&&speed>=0?speed:null,heading:Number.isFinite(heading)&&heading>=0&&heading<=360?heading:null,motion};
}


function clampInt(value:any,min:number,max:number,fallback:number){
 const n=Math.round(Number(value));return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;
}
function freshContextLocation(row:any,now=Date.now()){
 return !!row?.sharing&&Number.isFinite(Number(row.latitude))&&Number.isFinite(Number(row.longitude))
  &&!!row.updated_at&&now-Date.parse(row.updated_at)<=4*60*1000;
}
function contextDedupe(event:any){
 const p=event?.payload||{},type=String(event?.type||"");
 const identity=
  p.sessionId||p.startedAt||
  (p.placeId!=null?(String(p.person||"")+"|"+String(p.placeId)+"|"+String(p.candidateSince||event.occurredAt||"")):"")||
  (p.targetPerson!=null?(String(p.targetPerson)+"|"+String(p.candidateSince||event.occurredAt||"")):"")||
  String(event?.occurredAt||"");
 return (type+"|"+identity).slice(0,240);
}
async function contextSettingsRows(){
 return await ok(db.from("galaxy_context_settings").select("*").order("person"));
}
async function contextOwnSettings(person:string){
 const row=(await ok(db.from("galaxy_context_settings").select("*").eq("person",person).limit(1)))?.[0];
 return row||{person,near_enabled:false,near_distance_m:300,near_cooldown_minutes:60,arrived_safe_enabled:false,date_suggestions:true,memory_suggestions:true,shared_trip_detection:false};
}
async function contextEventByDedupe(key:string){
 return (await ok(db.from("galaxy_context_events").select("*").eq("dedupe_key",key).limit(1)))?.[0]||null;
}
async function persistContextEvent(d:any,event:any){
 const key=contextDedupe(event),payload=event?.payload&&typeof event.payload==="object"?event.payload:{};
 const person=["0","1"].includes(String(payload.person))?String(payload.person):null;
 const target=["0","1"].includes(String(payload.targetPerson))?String(payload.targetPerson):null;
 const inserted=await ok(db.from("galaxy_context_events").upsert({
  event_type:String(event.type),dedupe_key:key,person,partner_person:target,source_device_id:d?.id||null,
  occurred_at:event.occurredAt||new Date().toISOString(),payload
 },{onConflict:"dedupe_key",ignoreDuplicates:true}).select("*"));
 if(inserted?.[0])return {row:inserted[0],isNew:true};
 return {row:await contextEventByDedupe(key),isNew:false};
}
async function contextMaybePush(d:any,eventRow:any,event:any,settings:any[]){
 const payload=event?.payload||{};
 if(event.type==="USER_NEAR_PARTNER"){
  const target=String(payload.targetPerson||"");
  const pref=(settings||[]).find((x:any)=>String(x.person)===target);
  if(!pref?.near_enabled||!["0","1"].includes(target))return;
  await dispatchPushEvent(d,target,"nearby",{title:"Están cerca",body:"Nuestra Galaxia detectó que están a unos "+Math.max(0,Math.round(Number(payload.distanceM)||0))+" m."});
 }
 if(event.type==="DESTINATION_REACHED"){
  const person=String(payload.person||""),pref=(settings||[]).find((x:any)=>String(x.person)===person);
  if(!pref?.arrived_safe_enabled||!["0","1"].includes(person))return;
  const target=person==="0"?"1":"0",sessionId=String(payload.sessionId||"");
  const ref=uuidish(sessionId)?(await ok(db.from("galaxy_chat_entity_refs").select("message_id").eq("entity_kind","context_session").eq("entity_id",sessionId).in("card_type",["ETA","CHECK_IN"]).order("updated_at",{ascending:false}).limit(1)))?.[0]:null;
  await dispatchPushEvent(d,target,"arrived_safe",{
   title:"Llegó bien",body:(payload.label?"Llegó a "+String(payload.label)+".":"Llegó a su destino."),
   ...(ref?.message_id?{action:"chat",entityType:"chat_message",entityId:String(ref.message_id)}:{})
  },{requireSubscription:false});
 }
}
async function contextCreateSuggestions(eventRow:any,event:any,settings:any[]){
 if(event.type!=="ENCOUNTER_ENDED")return;
 const payload=event.payload||{},started=Date.parse(String(payload.startedAt||"")),ended=Date.parse(String(payload.endedAt||event.occurredAt||""));
 const durationS=Number.isFinite(started)&&Number.isFinite(ended)?Math.max(0,Math.round((ended-started)/1000)):0;
 if(!Number.isFinite(started)||!Number.isFinite(ended)||durationS<5*60)return;
 const startedIso=new Date(started).toISOString(),endedIso=new Date(ended).toISOString();
 let place:any=null;
 const recent=(await ok(db.from("galaxy_place_events").select("place_id,happened_at").gte("happened_at",new Date(ended-4*3600000).toISOString()).lte("happened_at",new Date(ended+15*60000).toISOString()).order("happened_at",{ascending:false}).limit(10)))||[];
 if(recent.length)place=(await ok(db.from("galaxy_places").select("id,name,kind").eq("id",recent[0].place_id).limit(1)))?.[0]||null;
 const enabled=(settings||[]).filter((x:any)=>["0","1"].includes(String(x.person)));
 const trip=(await ok(db.from("galaxy_trip_history").select("id,person,started_at,ended_at,distance_m,duration_s,dominant_motion").lte("started_at",endedIso).gte("ended_at",startedIso).order("started_at",{ascending:false}).limit(1)))?.[0]||null;
 for(const pref of enabled){
  const person=String(pref.person);
  if(pref.memory_suggestions!==false){
   const assets=await contextWindowAssets(startedIso,endedIso,person,person);
   const suggestion=buildEncounterSuggestion({
    encounter:{id:eventRow.id,started_at:startedIso,ended_at:endedIso},place,trip,
    photos:assets?.photos||[],songs:assets?.songs||[]
   });
   await ok(db.from("galaxy_context_suggestions").upsert({
    kind:"memory",source_event_id:eventRow.id,person,status:"pending",payload:suggestion
   },{onConflict:"source_event_id,kind,person",ignoreDuplicates:true}));
  }
  if(pref.date_suggestions!==false&&durationS>=2*3600){
   await ok(db.from("galaxy_context_suggestions").upsert({
    kind:"date",source_event_id:eventRow.id,person,status:"pending",
    payload:{question:"¿Esto fue una cita?",requiresConfirmation:true,durationS,place:place?{id:place.id,name:place.name,kind:place.kind}:null,trip:trip?{id:trip.id,distanceM:trip.distance_m,durationS:trip.duration_s}:null}
   },{onConflict:"source_event_id,kind,person",ignoreDuplicates:true}));
  }
 }
}
async function contextLegacySideEffects(d:any,eventRow:any,event:any){
 const p=event.payload||{};
 if(event.type==="ENCOUNTER_STARTED"){
  const open=(await ok(db.from("galaxy_encounters").select("id").is("ended_at",null).limit(1)))?.[0];
  if(!open)await ok(db.from("galaxy_encounters").insert({started_at:p.startedAt||event.occurredAt,distance_m:Math.max(0,Math.round(Number(p.distanceM)||0)),created_by:String(d.person)}));
 }
 if(event.type==="ENCOUNTER_ENDED"){
  const open=(await ok(db.from("galaxy_encounters").select("id,started_at").is("ended_at",null).limit(1)))?.[0];
  if(open)await ok(db.from("galaxy_encounters").update({ended_at:p.endedAt||event.occurredAt}).eq("id",open.id));
 }
 if(event.type==="PLACE_ENTERED"&&p.placeId!=null){
  await ok(db.from("galaxy_place_events").insert({person:String(p.person),place_id:Number(p.placeId),event:"arrived",happened_at:event.occurredAt}));
  if(p.name)await ok(db.from("galaxy_locations").update({status:"Llegué a "+text(p.name,80)}).eq("person",String(p.person)));
 }
 if(event.type==="PLACE_LEFT"&&p.placeId!=null){
  await ok(db.from("galaxy_place_events").insert({person:String(p.person),place_id:Number(p.placeId),event:"left",happened_at:event.occurredAt}));
 }
 if(event.type==="SHARED_TRIP_DETECTED"){
  await ok(db.from("galaxy_shared_trips").upsert({
   source_event_id:eventRow.id,started_at:p.startedAt||event.occurredAt,sample_count:Math.max(0,Number(p.samples)||0),status:"detected",updated_at:new Date().toISOString()
  },{onConflict:"source_event_id",ignoreDuplicates:true}));
 }
 if(event.type==="DESTINATION_REACHED"){
  const sessionId=String(p.sessionId||"");
  if(sessionId){
   const session=(await ok(db.from("galaxy_context_sessions").select("*").eq("id",sessionId).limit(1)))?.[0];
   if(session?.status==="active"){
    const arrivedAt=event.occurredAt||new Date().toISOString();
    await ok(db.from("galaxy_context_sessions").update({status:"arrived",arrived_at:arrivedAt,ended_at:arrivedAt,last_distance_m:Math.max(0,Math.round(Number(p.distanceM)||0)),progress_pct:100,updated_at:arrivedAt}).eq("id",sessionId));
    if(session.auto_finish)await ok(db.from("galaxy_destinations").delete().eq("person",String(session.person)));
   }
  }
 }
}
async function resolveContextDestinations(sessions:any[],locations:any[],places:any[]){
 const out:any[]=[];
 for(const s of sessions||[]){
  let target:any=null;
  if(s.destination_kind==="place")target=(places||[]).find((p:any)=>Number(p.id)===Number(s.place_id));
  else target=(locations||[]).find((l:any)=>String(l.person)===String(s.target_person)&&freshContextLocation(l));
  if(!target)continue;
  out.push({person:String(s.person),sessionId:String(s.id),mode:String(s.mode),label:String(s.label),placeId:s.place_id??null,latitude:Number(target.latitude),longitude:Number(target.longitude),arrivalRadiusM:60});
 }
 return out;
}
async function updateContextSessionProgress(d:any,sessions:any[],locations:any[],places:any[]){
 const person=String(d.person),session=(sessions||[]).find((s:any)=>String(s.person)===person&&s.status==="active");
 if(!session)return;
 const own=(locations||[]).find((l:any)=>String(l.person)===person&&freshContextLocation(l));
 if(!own)return;
 let target:any=null;
 if(session.destination_kind==="place")target=(places||[]).find((p:any)=>Number(p.id)===Number(session.place_id));
 else target=(locations||[]).find((l:any)=>String(l.person)===String(session.target_person)&&freshContextLocation(l));
 if(!target)return;
 const distance=Math.max(0,Math.round(dist(own,target))),etaMin=widgetEtaMinutes(distance,String(own.transport_preference||"auto"),Number.isFinite(Number(own.speed))?Number(own.speed):null),etaS=etaMin==null?null:etaMin*60;
 const initial=Math.max(distance,Number(session.initial_distance_m)||0),progress=initial>0?Math.max(0,Math.min(100,Math.round((1-distance/initial)*100))):0;
 const now=new Date(),lastUpdate=Date.parse(String(session.updated_at||"")),significant=Math.abs(distance-Number(session.last_distance_m??distance))>=25||Math.abs(progress-Number(session.progress_pct||0))>=2;
 if(!Number.isFinite(lastUpdate)||now.getTime()-lastUpdate>=15000||significant){
  const patch:any={last_distance_m:distance,last_eta_s:etaS,progress_pct:progress,updated_at:now.toISOString()};
  if(session.initial_distance_m==null)patch.initial_distance_m=distance;
  const sampleDue=!session.last_eta_sample_at||now.getTime()-Date.parse(session.last_eta_sample_at)>=60000||Math.abs(progress-Number(session.progress_pct||0))>=10;
  if(sampleDue)patch.last_eta_sample_at=now.toISOString();
  await ok(db.from("galaxy_context_sessions").update(patch).eq("id",session.id).eq("status","active"));
  if(sampleDue)await ok(db.from("galaxy_context_eta_history").insert({session_id:session.id,captured_at:now.toISOString(),distance_m:distance,eta_s:etaS,progress_pct:progress}));
 }
}
async function closeSharedTripIfNeeded(previous:any,next:any,at:string){
 if(previous?.shared?.active!==true||next?.shared?.active===true)return;
 const open=(await ok(db.from("galaxy_shared_trips").select("*").eq("status","detected").is("ended_at",null).order("started_at",{ascending:false}).limit(1)))?.[0];
 if(!open)return;
 const ended=new Date(at),started=Date.parse(open.started_at);
 const rows=await ok(db.from("galaxy_location_history").select("latitude,longitude,speed,motion,captured_at").eq("person","0").gte("captured_at",open.started_at).lte("captured_at",ended.toISOString()).order("captured_at",{ascending:true}).limit(5000));
 const summary=summarizeTrack(rows||[]);
 await ok(db.from("galaxy_shared_trips").update({ended_at:ended.toISOString(),duration_s:Number.isFinite(started)?Math.max(summary.durationS,Math.round((ended.getTime()-started)/1000)):summary.durationS,distance_m:summary.distanceM,status:"ended",updated_at:ended.toISOString()}).eq("id",open.id));
}
async function contextTick(d:any){
 const now=new Date(),[locations,stateRow,places,settings,sessions]=await Promise.all([
  ok(db.from("galaxy_locations").select("*").order("person")),
  ok(db.from("galaxy_context_state").select("data").eq("singleton",true).single()),
  ok(db.from("galaxy_places").select("id,owner,name,kind,latitude,longitude").limit(500)),
  contextSettingsRows(),
  ok(db.from("galaxy_context_sessions").select("*").eq("status","active").order("started_at"))
 ]);
 const people=(locations||[]).filter((row:any)=>freshContextLocation(row,now.getTime())).map((row:any)=>({...row,captured_at:row.updated_at}));
 const nearProfiles=Object.fromEntries((settings||[]).filter((x:any)=>x.near_enabled).map((x:any)=>[String(x.person),{enabled:true,distanceM:Number(x.near_distance_m)||300,cooldownS:(Number(x.near_cooldown_minutes)||60)*60}]));
 const destinations=await resolveContextDestinations(sessions||[],locations||[],places||[]);
 const previous=stateRow?.data&&Object.keys(stateRow.data).length?stateRow.data:emptyContextState();
 const result=contextStep(previous,{at:now.toISOString(),people,places:places||[],destinations},{nearProfiles,sharedTripEnabled:(settings||[]).length===2&&(settings||[]).every((x:any)=>x.shared_trip_detection===true)});
 await ok(db.from("galaxy_context_state").upsert({singleton:true,data:result.state,updated_at:now.toISOString()},{onConflict:"singleton"}));
 for(const event of result.events||[]){
  const persisted=await persistContextEvent(d,event),row=persisted?.row;
  if(!row||persisted.isNew!==true)continue;
  await contextLegacySideEffects(d,row,event);
  await contextMaybePush(d,row,event,settings||[]);
  await contextCreateSuggestions(row,event,settings||[]);
 }
 await updateContextSessionProgress(d,sessions||[],locations||[],places||[]);
 await closeSharedTripIfNeeded(previous,result.state,now.toISOString());
 return result.events||[];
}

async function contextSettingsAction(req:Request,body:any){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"get");
 if(operation==="get")return json({settings:await contextOwnSettings(person)});
 if(operation!=="save")return json({error:"Operación de contexto no válida."},400);
 const current=await contextOwnSettings(person),next={
  person,
  near_enabled:Object.hasOwn(body,"nearEnabled")?!!body.nearEnabled:!!current.near_enabled,
  near_distance_m:Object.hasOwn(body,"nearDistanceM")?clampInt(body.nearDistanceM,80,5000,300):Number(current.near_distance_m)||300,
  near_cooldown_minutes:Object.hasOwn(body,"nearCooldownMinutes")?clampInt(body.nearCooldownMinutes,5,1440,60):Number(current.near_cooldown_minutes)||60,
  arrived_safe_enabled:Object.hasOwn(body,"arrivedSafeEnabled")?!!body.arrivedSafeEnabled:!!current.arrived_safe_enabled,
  date_suggestions:Object.hasOwn(body,"dateSuggestions")?!!body.dateSuggestions:current.date_suggestions!==false,
  memory_suggestions:Object.hasOwn(body,"memorySuggestions")?!!body.memorySuggestions:current.memory_suggestions!==false,
  shared_trip_detection:Object.hasOwn(body,"sharedTripDetection")?!!body.sharedTripDetection:current.shared_trip_detection===true,
  updated_at:new Date().toISOString()
 };
 const saved=await ok(db.from("galaxy_context_settings").upsert(next,{onConflict:"person"}).select("*").single());
 await ok(db.from("galaxy_push_subscriptions").upsert([
  {device_id:d.id,event_type:"nearby",enabled:!!saved.near_enabled,updated_at:new Date().toISOString()},
  {device_id:d.id,event_type:"arrived_safe",enabled:!!saved.arrived_safe_enabled,updated_at:new Date().toISOString()}
 ],{onConflict:"device_id,event_type"}));
 return json({settings:saved});
}
async function contextSessionAction(req:Request,body:any){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"state");
 if(operation==="state"){
  const session=(await ok(db.from("galaxy_context_sessions").select("*").eq("person",person).eq("status","active").order("started_at",{ascending:false}).limit(1)))?.[0]||null;
  const eta=session?await ok(db.from("galaxy_context_eta_history").select("captured_at,distance_m,eta_s,progress_pct").eq("session_id",session.id).order("captured_at",{ascending:false}).limit(60)):[];
  return json({session,etaHistory:eta||[]});
 }
 if(operation==="stop"){
  const now=new Date().toISOString(),active=await ok(db.from("galaxy_context_sessions").select("id").eq("person",person).eq("status","active").limit(10));
  await ok(db.from("galaxy_context_sessions").update({status:"cancelled",ended_at:now,updated_at:now}).eq("person",person).eq("status","active"));
  await ok(db.from("galaxy_destinations").delete().eq("person",person));
  const target=person==="0"?"1":"0";
  for(const session of active||[]){
   const refs=await ok(db.from("galaxy_chat_entity_refs").select("message_id").eq("entity_kind","context_session").eq("entity_id",String(session.id)).in("card_type",["ETA","CHECK_IN"]).limit(10));
   for(const ref of refs||[])await chatSignal(d,target,String(ref.message_id));
  }
  return json({ok:true,session:null});
 }
 if(operation!=="start")return json({error:"Operación de sesión no válida."},400);
 const mode=String(body.mode||"accompany");
 if(!["accompany","return_home"].includes(mode))return json({error:"Modo de acompañamiento no válido."},400);
 let destinationKind=String(body.destinationKind||""),targetPerson:string|null=null,placeId:number|null=null,label="";
 if(mode==="return_home"){
  const home=(await ok(db.from("galaxy_places").select("id,name").eq("owner",person).eq("kind","home").order("created_at",{ascending:false}).limit(1)))?.[0];
  if(!home)return json({error:"Guarda primero un lugar tipo Casa."},409);
  destinationKind="place";placeId=Number(home.id);label=text(home.name||"Casa",80)||"Casa";
 }else if(destinationKind==="person"){
  targetPerson=String(body.targetPerson||"");if(!["0","1"].includes(targetPerson)||targetPerson===person)return json({error:"Destino no válido."},400);
  label=text(body.label||"Mi persona",80)||"Mi persona";
 }else if(destinationKind==="place"){
  const place=(await ok(db.from("galaxy_places").select("id,name").eq("id",Number(body.placeId)).limit(1)))?.[0];
  if(!place)return json({error:"Lugar no encontrado."},404);
  placeId=Number(place.id);label=text(body.label||place.name,80)||"Destino";
 }else return json({error:"Destino no válido."},400);
 const now=new Date().toISOString();
 await ok(db.from("galaxy_context_sessions").update({status:"cancelled",ended_at:now,updated_at:now}).eq("person",person).eq("status","active"));
 const locations=await ok(db.from("galaxy_locations").select("*").order("person")),places=await ok(db.from("galaxy_places").select("id,latitude,longitude").limit(500));
 const own=(locations||[]).find((x:any)=>String(x.person)===person&&freshContextLocation(x));
 let target:any=destinationKind==="place"?(places||[]).find((x:any)=>Number(x.id)===Number(placeId)):(locations||[]).find((x:any)=>String(x.person)===targetPerson&&freshContextLocation(x));
 const initial=own&&target?Math.max(0,Math.round(dist(own,target))):null;
 const session=await ok(db.from("galaxy_context_sessions").insert({person,mode,destination_kind:destinationKind,target_person:targetPerson,place_id:placeId,label,status:"active",auto_finish:true,initial_distance_m:initial,last_distance_m:initial,progress_pct:0,started_at:now,updated_at:now}).select("*").single());
 if(destinationKind==="person")await ok(db.from("galaxy_destinations").upsert({person,kind:"person",target_person:targetPerson,place_id:null,label,active:true,updated_at:now},{onConflict:"person"}));
 else await ok(db.from("galaxy_destinations").upsert({person,kind:"place",target_person:null,place_id:placeId,label,active:true,updated_at:now},{onConflict:"person"}));
 return json({ok:true,session});
}
async function contextEventsFeed(req:Request,body:any){
 await device(req);
 const limit=clampInt(body.limit,1,100,40),after=text(body.after||"",40);
 let query=db.from("galaxy_context_events").select("id,event_type,person,partner_person,occurred_at,payload").order("occurred_at",{ascending:false}).limit(limit);
 if(after)query=query.lt("occurred_at",after);
 const rows=await ok(query);
 return json({events:rows||[]});
}
async function contextSuggestionAction(req:Request,body:any){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"list");
 if(operation==="list"){
  const rows=await ok(db.from("galaxy_context_suggestions").select("*").eq("person",person).eq("status","pending").order("created_at",{ascending:false}).limit(30));
  return json({suggestions:rows||[]});
 }
 const id=String(body.id||"");if(!id)return json({error:"Sugerencia no válida."},400);
 const row=(await ok(db.from("galaxy_context_suggestions").select("*").eq("id",id).eq("person",person).limit(1)))?.[0];
 if(!row)return json({error:"La sugerencia ya no existe."},404);
 if(operation==="dismiss"||operation==="accept"){
  const status=operation==="accept"?"accepted":"dismissed",resolved=new Date().toISOString();
  await ok(db.from("galaxy_context_suggestions").update({status,resolved_at:resolved}).eq("id",id).eq("person",person).eq("status","pending"));
  if(operation==="accept"&&row.kind==="memory"){
   const p=row.payload||{};
   const item=await ok(db.from("galaxy_items").insert({kind:"memory",author:String(d.person),data:{title:text(p.title||"Después de vernos",120),body:"Recuerdo sugerido por Galaxy Context Engine.",contextSourceEventId:row.source_event_id,placeId:p.place?.id||null,date:today()}}).select("*").single());
   await recordParticipation(String(d.person));
   return json({ok:true,status,item});
  }
  return json({ok:true,status});
 }
 return json({error:"Operación de sugerencia no válida."},400);
}
async function contextStateAction(req:Request){
 const d=await device(req),person=String(d.person);
 const [settings,sessionRows,suggestions,events]=await Promise.all([
  contextOwnSettings(person),
  ok(db.from("galaxy_context_sessions").select("*").eq("person",person).eq("status","active").order("started_at",{ascending:false}).limit(1)),
  ok(db.from("galaxy_context_suggestions").select("*").eq("person",person).eq("status","pending").order("created_at",{ascending:false}).limit(10)),
  ok(db.from("galaxy_context_events").select("id,event_type,person,partner_person,occurred_at,payload").order("occurred_at",{ascending:false}).limit(20))
 ]);
 const session=sessionRows?.[0]||null;
 const etaHistory=session?await ok(db.from("galaxy_context_eta_history").select("captured_at,distance_m,eta_s,progress_pct").eq("session_id",session.id).order("captured_at",{ascending:false}).limit(30)):[];
 return json({settings,session,etaHistory:etaHistory||[],suggestions:suggestions||[],events:events||[]});
}
async function contextWindowAssets(startIso:string,endIso:string,person:string,viewer:string=person){
 const start=Date.parse(startIso),end=Date.parse(endIso);
 const [track,placeEvents,memories,songs,photos]=await Promise.all([
  ok(db.from("galaxy_location_history").select("person,latitude,longitude,accuracy,speed,heading,motion,captured_at").eq("person",person).gte("captured_at",startIso).lte("captured_at",endIso).order("captured_at",{ascending:true}).limit(5000)),
  ok(db.from("galaxy_place_events").select("place_id,happened_at").eq("person",person).gte("happened_at",startIso).lte("happened_at",endIso).order("happened_at",{ascending:true}).limit(100)),
  ok(db.from("galaxy_items").select("id,data,created").eq("kind","memory").gte("created",new Date(start-12*3600000).toISOString()).lte("created",new Date(end+12*3600000).toISOString()).limit(100)),
  ok(db.from("galaxy_items").select("id,data,created").eq("kind","song").gte("created",new Date(start-24*3600000).toISOString()).lte("created",new Date(end+24*3600000).toISOString()).limit(100)),
  listBucket("galaxy-photos",viewer)
 ]);
 const ids=[...new Set((placeEvents||[]).map((x:any)=>Number(x.place_id)).filter(Number.isFinite))];
 const places=ids.length?await ok(db.from("galaxy_places").select("id,name,kind").in("id",ids)):[];
 const photoRows=(photos||[]).filter((x:any)=>{const t=Date.parse(String(x.created||""));return Number.isFinite(t)&&t>=start-6*3600000&&t<=end+6*3600000;}).slice(0,40);
 return {track:track||[],places:places||[],photos:photoRows,songs:(songs||[]).map((x:any)=>({id:x.id,title:text(x.data?.title||"Canción",160),created:x.created})),memories:memories||[]};
}
async function contextRecapAction(req:Request,body:any){
 const d=await device(req),kind=String(body.kind||""),person=String(body.person??d.person),viewer=String(d.person);
 if(person!==viewer){
  const target=(await ok(db.from("galaxy_locations").select("person,sharing").eq("person",person).limit(1)))?.[0];
  if(!target||target.sharing!==true)return json({error:"Ubicación no disponible."},403);
 }
 if(kind==="date"){
  const event=(await ok(db.from("galaxy_context_events").select("*").eq("id",String(body.sourceEventId||"")).limit(1)))?.[0];
  if(!event||event.event_type!=="ENCOUNTER_ENDED")return json({error:"Encuentro no encontrado."},404);
  const start=String(event.payload?.startedAt||""),end=String(event.payload?.endedAt||event.occurred_at||"");
  if(!start||!end)return json({error:"Encuentro incompleto."},409);
  const assets=await contextWindowAssets(start,end,person,String(d.person));
  return json({recap:buildDateContextRecap({encounter:{started_at:start,ended_at:end},...assets})});
 }
 if(kind==="trip"){
  const trip=(await ok(db.from("galaxy_trip_history").select("*").eq("id",Number(body.tripId)).limit(1)))?.[0];
  if(!trip)return json({error:"Recorrido no encontrado."},404);
  if(String(trip.person)!==person&&person!==String(d.person))return json({error:"Recorrido no disponible."},403);
  const assets=await contextWindowAssets(String(trip.started_at),String(trip.ended_at),String(trip.person),String(d.person));
  const recap=buildTripContextRecap({trip, ...assets});
  if(!recap.distanceM&&Number(trip.distance_m)>0)recap.distanceM=Number(trip.distance_m);
  if(!recap.durationS&&Number(trip.duration_s)>0)recap.durationS=Number(trip.duration_s);
  return json({recap});
 }
 return json({error:"Tipo de recap no válido."},400);
}

async function history(req:Request,body:any){
  const d=await device(req),p=point(body),sample=String(body.sample_id||"");
  if(!/^[0-9a-f-]{36}$/i.test(sample))throw new Error("Muestra no válida");
  const row={person:d.person,latitude:p.lat,longitude:p.lon,accuracy:p.accuracy,speed:p.speed,heading:p.heading,motion:p.motion,captured_at:body.captured_at||new Date().toISOString(),source_device_id:d.id,client_sample_id:sample};
  await ok(db.from("galaxy_location_history").upsert(row,{onConflict:"source_device_id,client_sample_id",ignoreDuplicates:true}));
  return json({ok:true});
}

// Place, encounter, proximity and destination transitions are derived only by contextTick().

async function location(req:Request,body:any){
  const d=await device(req),now=new Date().toISOString();
  if(body.sharing===false){
    await ok(db.from("galaxy_locations").update({sharing:false,latitude:null,longitude:null,accuracy:null,speed:null,heading:null,motion:null,status:null,updated_at:now}).eq("person",d.person));
    await ok(db.from("galaxy_device_place_presence").delete().eq("device_id",d.id));
    await contextTick(d);
    return json({ok:true});
  }
  const p=point(body),existing=(await ok(db.from("galaxy_locations").select("*").eq("person",d.person).limit(1)))?.[0]||{};
  await ok(db.from("galaxy_locations").upsert({person:d.person,sharing:true,latitude:p.lat,longitude:p.lon,accuracy:p.accuracy,speed:p.speed,heading:p.heading,motion:p.motion,status:existing.status||null,trip_active:!!existing.trip_active,trip_started_at:existing.trip_started_at||null,transport_preference:existing.transport_preference||null,updated_at:now},{onConflict:"person"}));
  const newlyUnlocked=Number(await ok(db.rpc("galaxy_capsule_mark_place_unlocks",{viewer:String(d.person),at_time:now})))||0;
  if(newlyUnlocked>0)await intelligenceBestEffort("capsule-place-unlock",()=>reconcileIntelligenceCapsules());
  if(body.history===true)await history(req,body);
  if(existing.trip_active&&body.trip_point===true)await ok(db.from("galaxy_trip_points").insert({person:d.person,latitude:p.lat,longitude:p.lon}));
  if(body.trip_point===true)await contextTick(d);
  return json({ok:true,person:d.person});
}

function nextCalendarEvent(items:any[],day:string){
  const events:any[]=[];
  for(const item of items){
    const data=item.data||{};
    if(!validDate(data.date))continue;
    let date=data.date;
    if(data.annual===true&&date<day){
      const md=date.slice(4);
      for(let year=Math.max(Number(day.slice(0,4)),Number(date.slice(0,4)));year<=Number(day.slice(0,4))+8;year++){
        const candidate=String(year)+md;
        if(validDate(candidate)&&candidate>=day&&candidate>=data.date){date=candidate;break;}
      }
    }
    if(date>=day)events.push({title:text(data.title||"Nuestra próxima fecha",120),date});
  }
  return events.sort((a,b)=>a.date.localeCompare(b.date))[0]||null;
}

async function signed(bucket:string,path:string,seconds=900){
  if(!path)return null;
  const {data,error}=await db.storage.from(bucket).createSignedUrl(path,seconds);
  return error?null:data.signedUrl;
}


function fcmCredentials(){
 const raw=Deno.env.get("FCM_SERVICE_ACCOUNT_JSON")||"";
 if(!raw)return null;
 try{
  const value=JSON.parse(raw);
  return value?.project_id&&value?.client_email&&value?.private_key?value:null;
 }catch{return null;}
}
function pushEventEnabledMap(value:any){
 const source=value&&typeof value==="object"&&!Array.isArray(value)?value:{};
 return Object.fromEntries(PUSH_EVENT_TYPES.map(type=>[type,source[type]===true]));
}
async function profileNames(){
 const settings=await ok(db.from("galaxy_settings").select("data").eq("id",1).single());
 const names=Array.isArray(settings?.data?.names)?settings.data.names:["Sebas","Adri"];
 return [text(names[0]||"Sebas",40),text(names[1]||"Adri",40)];
}
async function savePushPreferences(deviceId:string,value:any){
 const enabled=pushEventEnabledMap(value),now=new Date().toISOString();
 await ok(db.from("galaxy_push_subscriptions").upsert(
  PUSH_EVENT_TYPES.map(event_type=>({device_id:deviceId,event_type,enabled:!!enabled[event_type],updated_at:now})),
  {onConflict:"device_id,event_type"}
 ));
 return enabled;
}
async function pushClientConfig(req:Request){
 const d=await device(req);
 const credentials=fcmCredentials();
 if(!credentials)return json({available:false},503);
 try{
  const config=await firebaseAndroidClientConfig(credentials,"com.nuestragalaxia.companion");
  return json({available:true,config,deviceId:String(d.id)});
 }catch(error){
  console.error("push-client-config",error instanceof Error?error.message:"error");
  return json({available:false},503);
 }
}

async function pushTokenRegister(req:Request,body:any){
 const d=await device(req),token=text(body.token,4096);
 if(token.length<20)return json({error:"Token push no válido."},400);
 await ok(db.from("galaxy_push_tokens").delete().eq("token",token).neq("device_id",d.id));
 await ok(db.from("galaxy_push_tokens").upsert({device_id:d.id,token,platform:"android",updated_at:new Date().toISOString()},{onConflict:"device_id"}));
 const subscriptions=await savePushPreferences(String(d.id),body.events||{});
 return json({ok:true,pushConfigured:!!fcmCredentials(),subscriptions});
}
async function pushTokenUnregister(req:Request){
 const d=await device(req);
 await Promise.all([
  ok(db.from("galaxy_push_tokens").delete().eq("device_id",d.id)),
  ok(db.from("galaxy_push_subscriptions").delete().eq("device_id",d.id))
 ]);
 return json({ok:true});
}
async function pushPreferences(req:Request,body:any){
 const d=await device(req),subscriptions=await savePushPreferences(String(d.id),body.events||{});
 return json({ok:true,subscriptions,pushConfigured:!!fcmCredentials()});
}
async function persistNotification(sourceDevice:any,targetPerson:string,eventType:string,payload:any,pushEventId:string){
 if(eventType==="gesture"&&String(payload?.behavior||"")==="haptic")return null;
 return await ok(db.from("galaxy_notifications").insert({
  target_person:targetPerson,
  source_person:["0","1"].includes(String(sourceDevice?.person))?String(sourceDevice.person):null,
  event_type:eventType,
  title:text(payload?.title||"Nuestra Galaxia",120)||"Nuestra Galaxia",
  body:text(payload?.body||"",500),
  action:text(payload?.action||"",80)||null,
  entity_type:text(payload?.entityType||"",80)||null,
  entity_id:text(payload?.entityId||"",160)||null,
  data:{senderName:text(payload?.senderName||"",80)},
  push_event_id:pushEventId
 }).select("*").single());
}
async function notificationSummary(person:string){
 const {count,error}=await db.from("galaxy_notifications").select("id",{count:"exact",head:true}).eq("target_person",person).is("read_at",null);
 if(error)throw error;
 return {unread:Number(count||0)};
}
async function chatSummary(person:string){
 const recent=(await ok(db.from("galaxy_chat_messages").select("id,sender_person,body,message_type,deleted_at,created_at,server_seq,expires_at").eq("schedule_state","sent").is("deleted_at",null).order("server_seq",{ascending:false}).limit(20)))||[];
 const latest=recent.find((row:any)=>!row.expires_at||Date.parse(String(row.expires_at))>Date.now())||null;
 const {count,error}=await db.from("galaxy_chat_messages").select("id",{count:"exact",head:true}).neq("sender_person",person).eq("schedule_state","sent").is("read_at",null).is("deleted_at",null);
 if(error)throw error;
 const partner=person==="0"?"1":"0";
 const partnerPresence=(await ok(db.from("galaxy_chat_presence").select("state,last_active_at,expires_at").eq("person",partner).limit(1)))?.[0]||null;
 return {unread:Number(count||0),lastMessage:latest,partnerLastReadAt:null,partnerPresence};
}

async function dispatchPushEvent(sourceDevice:any,targetPerson:string,eventType:string,payload:any,options:any={}){
 if(!PUSH_EVENT_TYPES.includes(eventType))throw new Error("Tipo de evento push no válido.");
 let prepared=payload&&typeof payload==="object"?{...payload}:{};
 if(eventType==="chat_message"){
  const pref=(await ok(db.from("galaxy_chat_preferences").select("notification_privacy").eq("person",targetPerson).limit(1)))?.[0];
  const privacy=String(pref?.notification_privacy||"full");
  if(privacy==="generic")prepared={...prepared,title:"Nuestra Galaxia",body:"Nuevo mensaje",senderName:"Nuestra Galaxia"};
  else if(privacy==="name")prepared={...prepared,body:"Nuevo mensaje"};
 }
 const sanitized=sanitizePushPayload(eventType,prepared);
 const event=await ok(db.from("galaxy_push_events").insert({
  source_device_id:sourceDevice?.id||null,source_person:String(sourceDevice?.person||"0"),target_person:targetPerson,event_type:eventType,payload:sanitized
 }).select("id").single());
 sanitized.eventId=String(event.id);
 if(options?.persistNotification!==false)await persistNotification(sourceDevice,targetPerson,eventType,sanitized,String(event.id));
 const [devices,tokens,subscriptions]=await Promise.all([
  ok(db.from("galaxy_devices").select("id").eq("person",targetPerson).is("revoked_at",null).limit(20)),
  ok(db.from("galaxy_push_tokens").select("device_id,token").limit(50)),
  ok(db.from("galaxy_push_subscriptions").select("device_id,event_type,enabled").eq("event_type",eventType).eq("enabled",true).limit(50))
 ]);
 const allowed=new Set<string>((subscriptions||[]).map((row:any)=>String(row.device_id)));
 const tokenByDevice=new Map<string,string>((tokens||[]).map((row:any)=>[String(row.device_id),String(row.token)] as [string,string]));
 const credentials=fcmCredentials(),deliveries:any[]=[],requireSubscription=options?.requireSubscription!==false;
 for(const target of devices||[]){
  const deviceId=String(target.id),token=tokenByDevice.get(deviceId);
  if(!token||(requireSubscription&&!allowed.has(deviceId))){
   deliveries.push({event_id:event.id,device_id:deviceId,status:"skipped",error_code:!token?"no-token":"disabled"});
   continue;
  }
  if(!credentials){
   deliveries.push({event_id:event.id,device_id:deviceId,status:"skipped",error_code:"fcm-not-configured"});
   continue;
  }
  try{
   await sendFcmData(credentials,token,eventType,sanitized,eventType==="gesture"?900:3600);
   deliveries.push({event_id:event.id,device_id:deviceId,status:"sent",error_code:null});
  }catch(error:any){
   const code=text(error?.code||"",80),unregistered=/UNREGISTERED|NOT_FOUND/i.test(code)||/UNREGISTERED/i.test(String(error?.message||""));
   deliveries.push({event_id:event.id,device_id:deviceId,status:unregistered?"unregistered":"failed",error_code:code||"fcm-error"});
   if(unregistered)await ok(db.from("galaxy_push_tokens").delete().eq("device_id",deviceId));
  }
 }
 if(deliveries.length)await ok(db.from("galaxy_push_deliveries").upsert(deliveries,{onConflict:"event_id,device_id"}));
 return {eventId:event.id,sent:deliveries.filter(x=>x.status==="sent").length,configured:!!credentials};
}

const CHAT_REACTIONS=new Set(["❤️","😂","🥹","😮","😢","👍"]);
const CHAT_MESSAGE_TYPES=new Set(["text","photo","video","video_message","audio","file","location","song","link","sticker","gif","card"]);
const CHAT_CARD_TYPES=new Set(["MEMORY","PLAN","GOAL","PLACE","SONG","ETA","CHECK_IN","POLL","CHECKLIST","CAPSULE","DAILY_QUESTION","EVENT","STATUS"]);
const CHAT_CARD_ENTITY_KIND:Record<string,string>={
 MEMORY:"memory",PLAN:"plan",GOAL:"goal",PLACE:"place",SONG:"song",ETA:"context_session",CHECK_IN:"context_session",
 POLL:"poll",CHECKLIST:"checklist",CAPSULE:"capsule",DAILY_QUESTION:"daily_question",EVENT:"event",STATUS:"status"
};
const CHAT_PRESENCE_STATES=new Set(["ONLINE","TYPING","RECORDING_AUDIO","UPLOADING_MEDIA"]);
const CHAT_EDIT_MINUTES=Math.max(1,Math.min(1440,Number(Deno.env.get("GALAXY_CHAT_EDIT_WINDOW_MINUTES")||15)));
const CHAT_DELETE_MINUTES=Math.max(1,Math.min(10080,Number(Deno.env.get("GALAXY_CHAT_DELETE_WINDOW_MINUTES")||120)));

function chatSafeObject(value:any,maxBytes=8192){
 if(!value||typeof value!=="object"||Array.isArray(value))return {};
 try{
  const raw=JSON.stringify(value);
  return new TextEncoder().encode(raw).length<=maxBytes?JSON.parse(raw):{};
 }catch{return {};}
}
function chatStatus(row:any){
 if(row?.schedule_state==="pending")return "SCHEDULED";
 if(row?.schedule_state==="cancelled")return "CANCELLED";
 if(row?.read_at)return "READ";
 if(row?.delivered_at)return "DELIVERED";
 if(row?.sent_at)return "SENT";
 return "SENDING";
}
function chatPublicUrl(value:any){
 try{
  const u=new URL(String(value||""));
  if(u.protocol!=="https:")return null;
  const host=u.hostname.toLowerCase().replace(/\.$/,"");
  if(!host||host==="localhost"||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".localhost"))return null;
  if(/^(0|10|127|169\.254|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(host))return null;
  if(host==="metadata.google.internal"||host==="metadata.google.com"||host==="100.100.100.200")return null;
  u.username="";u.password="";
  return u;
 }catch{return null;}
}
async function chatLinkPreview(body:string){
 const match=String(body||"").match(/https:\/\/[^\s<>"']+/i);
 if(!match)return {};
 const u=chatPublicUrl(match[0]);if(!u)return {};
 const host=u.hostname.toLowerCase(),base={url:u.toString(),domain:host,title:host,description:"Enlace compartido",image:"",provider:"web"};
 try{
  let endpoint="";
  if(host==="youtu.be"||host.endsWith(".youtube.com"))endpoint="https://www.youtube.com/oembed?format=json&url="+encodeURIComponent(u.toString());
  else if(host==="open.spotify.com")endpoint="https://open.spotify.com/oembed?url="+encodeURIComponent(u.toString());
  if(!endpoint)return base;
  const response=await fetch(endpoint,{headers:{accept:"application/json"},signal:AbortSignal.timeout(3500),redirect:"error"});
  if(!response.ok)return base;
  const data=await response.json();
  return {...base,title:text(data?.title||host,160),description:text(data?.author_name||"Enlace compartido",240),image:chatPublicUrl(data?.thumbnail_url)?.toString()||"",provider:host.includes("spotify")?"spotify":"youtube"};
 }catch{return base;}
}
async function chatSignal(source:any,target:string,entityId:string,event="chat_sync"){
 try{
  await dispatchPushEvent(source,target,event,{action:"chat",entityType:"chat_message",entityId},{persistNotification:false,requireSubscription:false});
 }catch{}
}
function chatNormalizeEntityRef(value:any){
 const cardType=String(value?.cardType||value?.card_type||"").toUpperCase();
 const entityKind=String(value?.entityKind||value?.entity_kind||"").toLowerCase();
 const entityId=text(value?.entityId||value?.entity_id||"",120);
 if(!CHAT_CARD_TYPES.has(cardType)||CHAT_CARD_ENTITY_KIND[cardType]!==entityKind||!entityId)return null;
 if(["memory","plan","song","capsule","event","goal","context_session","poll","checklist"].includes(entityKind)&&!uuidish(entityId))return null;
 if(entityKind==="place"&&(!/^\d+$/.test(entityId)||Number(entityId)<=0))return null;
 if(entityKind==="daily_question"&&!validDate(entityId))return null;
 if(entityKind==="status"&&!["0","1"].includes(entityId))return null;
 return {cardType,entityKind,entityId};
}
function chatCapsuleUnlockAt(data:any){
 const direct=String(data?.unlockAt||data?.unlock_at||"");
 if(direct&&Number.isFinite(Date.parse(direct)))return new Date(direct).toISOString();
 const date=String(data?.unlockDate||data?.unlock_date||data?.date||"");
 if(!validDate(date))return null;
 const rawTime=String(data?.unlockTime||data?.unlock_time||"");
 const time=/^\d{2}:\d{2}$/.test(rawTime)?rawTime:"00:00";
 const iso=date+"T"+time+":00-05:00";
 return Number.isFinite(Date.parse(iso))?new Date(iso).toISOString():null;
}
function chatCapsuleAccess(data:any,person:string,locations:any[]=[],now=Date.now()){
 const unlockType=String(data?.unlockType||data?.unlock_type||"date")==="place"?"place":"date";
 if(unlockType==="place"){
  const unlockedFor=Array.isArray(data?.unlockedFor)?data.unlockedFor.map(String):[];
  return {locked:!unlockedFor.includes(String(person)),unlockType,unlockAt:null};
 }
 const unlockAt=chatCapsuleUnlockAt(data);
 return {locked:!!unlockAt&&Date.parse(unlockAt)>now,unlockType,unlockAt};
}
function privacyVisibleLocations(rows:any[],person:string){
 return (rows||[]).map((row:any)=>{
  if(String(row.person)===person||row.sharing===true)return row;
  return {
   person:String(row.person),sharing:false,latitude:null,longitude:null,accuracy:null,speed:null,heading:null,motion:null,
   transport_preference:null,status:null,trip_active:false,trip_started_at:null,updated_at:row.updated_at
  };
 });
}
function privacyVisibleTripRows(rows:any[],person:string,locations:any[]){
 const allowed=new Set<string>([person,...(locations||[]).filter((x:any)=>x.sharing===true).map((x:any)=>String(x.person))]);
 return (rows||[]).filter((row:any)=>allowed.has(String(row.person)));
}
async function capsulePrivacyContext(person:string){
 const [capsules,locations]=await Promise.all([
  ok(db.from("galaxy_items").select("id,data,author").eq("kind","capsule").limit(1000)),
  ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,updated_at").eq("person",person).limit(1))
 ]);
 return {capsules:capsules||[],locations:locations||[]};
}
function capsuleObjectVisible(bucket:string,path:string,person:string,context:any){
 if(!path||!["galaxy-photos","galaxy-voice"].includes(bucket))return true;
 for(const row of context?.capsules||[]){
  const data=row?.data||{};
  const linked=(bucket==="galaxy-photos"&&String(data.photoPath||"")===path)||(bucket==="galaxy-voice"&&String(data.audioPath||"")===path);
  if(linked&&chatCapsuleAccess(data,person,context?.locations||[]).locked)return false;
 }
 return true;
}
async function signedForPerson(bucket:string,path:string,person:string,seconds=900,context:any=null){
 const privacy=context||await capsulePrivacyContext(person);
 if(!capsuleObjectVisible(bucket,path,person,privacy))return null;
 return await signed(bucket,path,seconds);
}

async function privacyItemResponse(row:any,person:string){
 if(!row||row.kind!=="capsule")return row;
 const copy=structuredClone(row),data=copy.data||{};
 const locations=await ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,updated_at").eq("person",person).limit(1));
 const access=chatCapsuleAccess(data,person,locations||[]);
 if(access.locked){
  copy.data={
   title:text(data.title||"Cápsula cerrada",160)||"Cápsula cerrada",
   date:access.unlockType==="date"&&validDate(data.date)?data.date:"",
   unlockDate:access.unlockType==="date"&&validDate(data.unlockDate)?data.unlockDate:"",
   unlockTime:access.unlockType==="date"&&/^\d{2}:\d{2}$/.test(String(data.unlockTime||""))?String(data.unlockTime):"",
   unlockAt:access.unlockAt,unlockType:access.unlockType,locked:true
  };
  return copy;
 }
 if(data.photoPath)copy.data.photoUrl=await signed("galaxy-photos",String(data.photoPath),900);
 if(data.audioPath)copy.data.audioUrl=await signed("galaxy-voice",String(data.audioPath),900);
 if(data.songId){
  const song=(await ok(db.from("galaxy_items").select("id,data").eq("kind","song").eq("id",String(data.songId)).limit(1)))?.[0];
  if(song)copy.data.song={id:String(song.id),title:text(song.data?.title||"Canción",160),artist:text(song.data?.artist||"",160),source:text(song.data?.source||"",80),url:/^https:\/\//i.test(String(song.data?.url||""))?String(song.data.url):""};
 }
 return copy;
}
function intelligenceCapsuleAudience(data:any){
 const allowed=["0","1"].filter((person)=>!chatCapsuleAccess(data,person,[]).locked);
 return {locked:allowed.length===0,ownerPerson:allowed.length===1?allowed[0]:null,allowed};
}
async function intelligenceCapsuleDependencyPrivacy(bucket:string,path:string){
 if(!path)return {locked:false,ownerPerson:null};
 const capsules=await ok(db.from("galaxy_items").select("data").eq("kind","capsule").limit(1000));
 let linked=false;
 const allowed=new Set<string>(["0","1"]);
 for(const row of capsules||[]){
  const data=row?.data||{};
  const matches=(bucket==="galaxy-photos"&&String(data.photoPath||"")===path)||(bucket==="galaxy-voice"&&String(data.audioPath||"")===path);
  if(!matches)continue;
  linked=true;
  const audience=intelligenceCapsuleAudience(data);
  for(const person of [...allowed])if(!audience.allowed.includes(person))allowed.delete(person);
 }
 return {locked:linked&&allowed.size===0,ownerPerson:linked&&allowed.size===1?[...allowed][0]:null};
}

function chatCardUnavailable(ref:any){
 return {available:false,type:String(ref?.card_type||"").toUpperCase(),entityKind:String(ref?.entity_kind||""),entityId:String(ref?.entity_id||""),message:"Este contenido ya no está disponible."};
}
function chatItemCard(type:string,row:any,capsuleAccess:any=null){
 const data=row?.data||{},base={available:true,type,entityKind:String(row.kind),entityId:String(row.id),author:String(row.author),createdAt:row.created};
 const fallback:Record<string,string>={MEMORY:"Recuerdo",PLAN:"Plan",SONG:"Canción",CAPSULE:"Cápsula",EVENT:"Evento"};
 const title=text(data.title||data.name||fallback[type]||"Contenido",240);
 if(type==="CAPSULE"){
  const access=capsuleAccess||chatCapsuleAccess(data,String(row.author),[]);
  if(access.locked)return {...base,title,locked:true,unlockType:access.unlockType,unlockAt:access.unlockAt};
 }
 const safe:any={...base,title,locked:false};
 if(data.body)safe.body=text(data.body,1200);
 if(data.date)safe.date=String(data.date).slice(0,10);
 if(data.time)safe.time=text(data.time,12);
 if(data.artist)safe.artist=text(data.artist,160);
 if(data.platform||data.source)safe.source=text(data.platform||data.source,80);
 if(data.url&&/^https:\/\//i.test(String(data.url)))safe.url=text(data.url,1000);
 if(data.cover&&/^https:\/\//i.test(String(data.cover)))safe.cover=text(data.cover,1000);
 if(data.placeName)safe.placeName=text(data.placeName,160);
 if(data.category)safe.category=text(data.category,100);
 if(type==="CAPSULE"){
  safe.unlockAt=chatCapsuleUnlockAt(data);
  safe.hasPhoto=!!(data.photo||data.photoPath||data.media);
  safe.hasAudio=!!(data.audio||data.audioPath);
  safe.hasSong=!!(data.song||data.songId);
 }
 return safe;
}
async function chatPollCard(id:string,person:string){
 const poll=(await ok(db.from("galaxy_chat_polls").select("*").eq("id",id).limit(1)))?.[0];
 if(!poll)return null;
 const [options,votes]=await Promise.all([
  ok(db.from("galaxy_chat_poll_options").select("id,label,position").eq("poll_id",id).order("position")),
  ok(db.from("galaxy_chat_poll_votes").select("option_id,person,voted_at").eq("poll_id",id))
 ]);
 const totalPeople=new Set((votes||[]).map((v:any)=>String(v.person))).size,totalVotes=(votes||[]).length;
 const closed=!!poll.closed_at||(poll.closes_at&&Date.parse(String(poll.closes_at))<=Date.now());
 const normalized=(options||[]).map((option:any)=>{
  const optionVotes=(votes||[]).filter((v:any)=>String(v.option_id)===String(option.id));
  return {id:String(option.id),label:text(option.label,240),position:Number(option.position),votes:optionVotes.length,percent:totalVotes?Math.round(optionVotes.length*100/totalVotes):0,selected:optionVotes.some((v:any)=>String(v.person)===person)};
 });
 const topVotes=normalized.reduce((max:number,o:any)=>Math.max(max,Number(o.votes||0)),0);
 const leaders=topVotes>0?normalized.filter((o:any)=>Number(o.votes||0)===topVotes):[];
 const tie=closed&&leaders.length>1,winner=closed&&leaders.length===1?{id:leaders[0].id,label:leaders[0].label,position:leaders[0].position,votes:leaders[0].votes}:null;
 return {
  available:true,type:"POLL",entityKind:"poll",entityId:id,title:text(poll.question,500),question:text(poll.question,500),
  allowMultiple:!!poll.allow_multiple,closesAt:poll.closes_at,closedAt:poll.closed_at,closed,createdBy:String(poll.created_by),
  totalPeople,totalVotes,topVotes,winner,tie,noVotes:closed&&topVotes===0,options:normalized
 };
}

async function chatChecklistCard(id:string){
 const list=(await ok(db.from("galaxy_chat_checklists").select("*").eq("id",id).limit(1)))?.[0];
 if(!list)return null;
 const items=await ok(db.from("galaxy_chat_checklist_items").select("*").eq("checklist_id",id).order("position"));
 const done=(items||[]).filter((x:any)=>x.checked).length;
 return {available:true,type:"CHECKLIST",entityKind:"checklist",entityId:id,title:text(list.title,300),createdBy:String(list.created_by),version:Number(list.version),done,total:(items||[]).length,items:(items||[]).map((x:any)=>({id:String(x.id),label:text(x.label,300),position:Number(x.position),checked:!!x.checked,updatedBy:x.updated_by==null?null:String(x.updated_by),updatedAt:x.updated_at,version:Number(x.version)}))};
}
async function chatHydrateEntityRef(ref:any,person:string){
 if(!ref)return null;
 const type=String(ref.card_type||"").toUpperCase(),kind=String(ref.entity_kind||""),id=String(ref.entity_id||"");
 try{
  if(["memory","plan","song","capsule","event"].includes(kind)){
   const row=(await ok(db.from("galaxy_items").select("id,kind,data,author,created").eq("id",id).eq("kind",kind).limit(1)))?.[0];
   if(!row)return chatCardUnavailable(ref);
   if(kind==="capsule"){
    const locations=await ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,updated_at").eq("person",person).limit(1)),access=chatCapsuleAccess(row.data||{},person,locations||[]);
    const card:any=chatItemCard(type,row,access);
    if(access.locked)return card;
    if(row.data?.photoPath)try{card.photoUrl=await signed("galaxy-photos",String(row.data.photoPath),900);}catch{}
    if(row.data?.audioPath)try{card.audioUrl=await signed("galaxy-voice",String(row.data.audioPath),900);}catch{}
    if(row.data?.songId){
      const song=(await ok(db.from("galaxy_items").select("id,data").eq("id",String(row.data.songId)).eq("kind","song").limit(1)))?.[0];
      if(song)card.song={id:String(song.id),title:text(song.data?.title||"Canción",160),artist:text(song.data?.artist||"",160),source:text(song.data?.source||"",80),url:/^https:\/\//i.test(String(song.data?.url||""))?String(song.data.url):""};
    }
    return card;
   }
   return chatItemCard(type,row);
  }
  if(kind==="goal"){
   const row=(await ok(db.from("galaxy_goals").select("id,kind,title,description,category,target_date,status,target_amount,created_by,version,completed_at,created_at,updated_at").eq("id",id).limit(1)))?.[0];
   return row?{available:true,type:"GOAL",entityKind:"goal",entityId:id,title:text(row.title,300),body:text(row.description,1200),category:text(row.category,100),targetDate:row.target_date,status:row.status,targetAmount:row.target_amount,createdBy:String(row.created_by),version:Number(row.version),updatedAt:row.updated_at}:chatCardUnavailable(ref);
  }
  if(kind==="place"){
   const row=(await ok(db.from("galaxy_places").select("id,owner,name,kind,latitude,longitude,note,created_at").eq("id",Number(id)).limit(1)))?.[0];
   return row?{available:true,type:"PLACE",entityKind:"place",entityId:id,title:text(row.name,160),placeKind:text(row.kind,40),note:text(row.note,400),latitude:Number(row.latitude),longitude:Number(row.longitude),owner:String(row.owner),createdAt:row.created_at}:chatCardUnavailable(ref);
  }
  if(kind==="daily_question"){
   const row=(await ok(db.from("galaxy_daily_questions").select("*").eq("day",id).limit(1)))?.[0];
   if(!row)return chatCardUnavailable(ref);
   const q=questionById(String(row.question_id));
   if(!q)return chatCardUnavailable(ref);
   const answers=await ok(db.from("galaxy_daily").select("person,answer").eq("day",id).order("person"));
   const mine=(answers||[]).find((x:any)=>String(x.person)===person),partner=(answers||[]).find((x:any)=>String(x.person)!==person);
   const both=!!text(mine?.answer,3000)&&!!text(partner?.answer,3000);
   return {available:true,type:"DAILY_QUESTION",entityKind:"daily_question",entityId:id,title:text(q.text,600),questionId:q.id,deck:q.deck,day:id,favorite:!!row.favorite,answeredByMe:!!text(mine?.answer,3000),answeredByPartner:!!text(partner?.answer,3000),myAnswer:text(mine?.answer,3000),partnerAnswer:both?text(partner?.answer,3000):"",revealed:both};
  }
  if(kind==="context_session"){
   const session=(await ok(db.from("galaxy_context_sessions").select("*").eq("id",id).limit(1)))?.[0];
   if(!session)return chatCardUnavailable(ref);
   const [eta,loc]=await Promise.all([
    ok(db.from("galaxy_context_eta_history").select("captured_at,distance_m,eta_s,progress_pct").eq("session_id",id).order("captured_at",{ascending:false}).limit(1)).then((x:any)=>x?.[0]||null),
    ok(db.from("galaxy_locations").select("person,transport_preference,updated_at").eq("person",String(session.person)).limit(1)).then((x:any)=>x?.[0]||null)
   ]);
   const raw=String(session.status||"active"),distanceM=Number(eta?.distance_m??session.last_distance_m);
   const visual=raw==="arrived"?"LLEGÓ":raw==="cancelled"?"CANCELADO":raw==="finished"||raw==="completed"?"FINALIZADO":Number.isFinite(distanceM)&&distanceM<=300?"CERCA":"EN CAMINO";
   return {available:true,type:type==="CHECK_IN"?"CHECK_IN":"ETA",entityKind:"context_session",entityId:id,title:text(session.label||"Acompáñame",120),person:String(session.person),destinationKind:session.destination_kind,targetPerson:session.target_person,placeId:session.place_id,transport:text(loc?.transport_preference||"auto",40),status:raw,visualStatus:visual,distanceM:Number.isFinite(distanceM)?distanceM:null,etaSeconds:eta?.eta_s??session.last_eta_s,progressPct:eta?.progress_pct??session.progress_pct,startedAt:session.started_at,arrivedAt:session.arrived_at,endedAt:session.ended_at,updatedAt:eta?.captured_at||session.updated_at};
  }
  if(kind==="poll"){const card=await chatPollCard(id,person);return card||chatCardUnavailable(ref);}
  if(kind==="checklist"){const card=await chatChecklistCard(id);return card||chatCardUnavailable(ref);}
  if(kind==="status"){
   const row=(await ok(db.from("galaxy_locations").select("person,status,updated_at").eq("person",id).limit(1)))?.[0];
   return row?{available:true,type:"STATUS",entityKind:"status",entityId:id,title:text(row.status||"Sin estado",160),person:id,updatedAt:row.updated_at}:chatCardUnavailable(ref);
  }
 }catch(error){console.warn("chat-card-hydrate",type,kind,error instanceof Error?error.message:"error");}
 return chatCardUnavailable(ref);
}
function chatCardPushBody(ref:any){
 const type=String(ref?.card_type||"").toUpperCase();
 const labels:Record<string,string>={MEMORY:"compartió un recuerdo",PLAN:"compartió un plan",GOAL:"compartió un objetivo",PLACE:"compartió un lugar",SONG:"compartió una canción",ETA:"compartió su trayecto",CHECK_IN:"compartió un check-in",POLL:"creó una encuesta",CHECKLIST:"compartió una checklist",CAPSULE:"compartió una cápsula",DAILY_QUESTION:"compartió la pregunta del día",EVENT:"compartió un evento",STATUS:"compartió un estado"};
 return labels[type]||"compartió algo de Nuestra Galaxia";
}
async function chatPartnerPresence(person:string){
 const partner=person==="0"?"1":"0";
 const [row,pref]=await Promise.all([
  ok(db.from("galaxy_chat_presence").select("state,last_active_at,expires_at,metadata,updated_at").eq("person",partner).limit(1)).then((x:any)=>x?.[0]||null),
  ok(db.from("galaxy_chat_preferences").select("show_last_seen,show_typing").eq("person",partner).limit(1)).then((x:any)=>x?.[0]||null)
 ]);
 if(!row)return {state:"LAST_ACTIVE",lastActiveAt:null,online:false};
 const fresh=Date.parse(String(row.expires_at||""))>Date.now();
 const typingVisible=pref?.show_typing!==false;
 const lastSeenVisible=pref?.show_last_seen!==false;
 if(!lastSeenVisible&&!typingVisible)return {state:"PRIVATE",lastActiveAt:null,online:false};
 if(fresh){
  const state=(row.state==="TYPING"&&!typingVisible)?"ONLINE":row.state;
  return {state,lastActiveAt:lastSeenVisible?row.last_active_at:null,online:true,metadata:row.metadata||{}};
 }
 return {state:lastSeenVisible?"LAST_ACTIVE":"PRIVATE",lastActiveAt:lastSeenVisible?row.last_active_at:null,online:false};
}
async function chatHydrate(rows:any[],person:string){
 const list=(rows||[]).filter(Boolean),ids=list.map((r:any)=>String(r.id)),activeIds=list.filter((r:any)=>!r.deleted_at).map((r:any)=>String(r.id));
 if(!ids.length)return [];
 const stickerIds=[...new Set(list.map((r:any)=>String(r?.attachment?.stickerId||"")).filter(uuidish))];
 const liveIds=[...new Set(list.map((r:any)=>String(r?.attachment?.liveSessionId||"")).filter(uuidish))];
 const [reactions,pins,favorites,attachments,stickers,liveSessions,locations,entityRefs]=await Promise.all([
  ok(db.from("galaxy_chat_reactions").select("message_id,person,emoji,updated_at").in("message_id",ids)),
  ok(db.from("galaxy_chat_pins").select("message_id,pinned_by,pinned_at").in("message_id",ids)),
  ok(db.from("galaxy_chat_favorites").select("message_id,person,saved_at").eq("person",person).in("message_id",ids)),
  activeIds.length?ok(db.from("galaxy_chat_attachments").select("*").in("message_id",activeIds).order("created_at",{ascending:true})):Promise.resolve([]),
  stickerIds.length?ok(db.from("galaxy_chat_stickers").select("*").in("id",stickerIds)):Promise.resolve([]),
  liveIds.length?ok(db.from("galaxy_chat_live_locations").select("*").in("id",liveIds)):Promise.resolve([]),
  liveIds.length?ok(db.from("galaxy_locations").select("person,latitude,longitude,accuracy,sharing,updated_at").order("person")):Promise.resolve([]),
  ok(db.from("galaxy_chat_entity_refs").select("*").in("message_id",ids))
 ]);
 const replyIds=[...new Set(list.map((x:any)=>x.reply_to).filter(Boolean).map(String))];
 const replies=replyIds.length?await ok(db.from("galaxy_chat_messages").select("id,sender_person,body,message_type,deleted_at,server_seq").in("id",replyIds)):[];
 const replyMap=new Map((replies||[]).map((x:any)=>[String(x.id),{...x,body:x.deleted_at?"":x.body}]));
 const reactionMap=new Map<string,any[]>();
 for(const x of reactions||[]){const k=String(x.message_id),v=reactionMap.get(k)||[];v.push({person:String(x.person),emoji:String(x.emoji)});reactionMap.set(k,v);}
 const pinMap=new Map((pins||[]).map((x:any)=>[String(x.message_id),x]));
 const favSet=new Set((favorites||[]).map((x:any)=>String(x.message_id)));
 const attachmentMap=new Map<string,any[]>();
 const hydratedAttachments=await Promise.all((attachments||[]).map(async(a:any)=>{
  const bucket=String(a.bucket||"galaxy-chat-media"),path=String(a.path||"");
  const [url,thumbnailUrl]=await Promise.all([
   signed(bucket,path,1800),
   a.thumbnail_path?signed(bucket,String(a.thumbnail_path),1800):Promise.resolve(null)
  ]);
  return {...a,url,thumbnailUrl};
 }));
 for(const a of hydratedAttachments){
  const safe={id:a.id,kind:a.kind,mime:a.mime,name:a.name,sizeBytes:a.size_bytes,durationMs:a.duration_ms,width:a.width,height:a.height,caption:a.caption,url:a.url,thumbnailUrl:a.thumbnailUrl,waveform:a.waveform||[],mediaQuality:a.media_quality||"optimized"};
  const k=String(a.message_id),v=attachmentMap.get(k)||[];v.push(safe);attachmentMap.set(k,v);
 }
 const stickerMap=new Map<string,any>();
 for(const x of stickers||[]){
  const id=String(x.id),url=await signed(String(x.bucket),String(x.path),1800);
  stickerMap.set(id,{id,name:x.name,url,createdBy:x.created_by});
 }
 const sessionMap=new Map<string,any>((liveSessions||[]).map((x:any)=>[String(x.id),x] as [string,any]));
 const locationMap=new Map<string,any>((locations||[]).map((x:any)=>[String(x.person),x] as [string,any]));
 const refMap=new Map((entityRefs||[]).map((x:any)=>[String(x.message_id),x]));
 const cardEntries=await Promise.all([...refMap.entries()].map(async([messageId,ref]:any)=>[messageId,await chatHydrateEntityRef(ref,person)] as [string,any]));
 const cardMap=new Map<string,any>(cardEntries);
 const now=Date.now();
 return list.map((row:any)=>{
  const deleted=!!row.deleted_at,stickerId=deleted?"":String(row?.attachment?.stickerId||""),liveId=deleted?"":String(row?.attachment?.liveSessionId||"");
  const session=sessionMap.get(liveId);
  const current=session?locationMap.get(String(session.sender_person)):null;
  const active=!!session&&!session.stopped_at&&(!session.ends_at||Date.parse(String(session.ends_at))>now);
  const liveLocation=session?{
   id:liveId,active,startedAt:session.started_at,endsAt:session.ends_at,stoppedAt:session.stopped_at,
   ...(active&&current?.sharing&&Number.isFinite(Number(current.latitude))&&Number.isFinite(Number(current.longitude))?{
    latitude:Number(current.latitude),longitude:Number(current.longitude),accuracy:Number(current.accuracy||0),updatedAt:current.updated_at
   }:{})
  }:null;
  return {
   ...row,
   body:row.deleted_at?"":row.body,
   status:chatStatus(row),
   reply:row.reply_to?replyMap.get(String(row.reply_to))||null:null,
   reactions:reactionMap.get(String(row.id))||[],
   pin:pinMap.get(String(row.id))||null,
   favorite:favSet.has(String(row.id)),
   hasViewOnce:!!row.view_once,
   sticker:deleted?null:(stickerMap.get(stickerId)||null),
   liveLocation:deleted?null:liveLocation,
   card:deleted?null:(cardMap.get(String(row.id))||null),
   attachments:deleted||((row.view_once&&String(row.sender_person)!==person))?[]:(attachmentMap.get(String(row.id))||[])
  };
 });
}

async function chatVisibleRows(person:string,query:any){
 const hidden=await ok(db.from("galaxy_chat_hidden").select("message_id").eq("person",person).limit(1000));
 const blocked=new Set((hidden||[]).map((x:any)=>String(x.message_id)));
 const rows=await ok(query);
 const now=Date.now();
 return (rows||[]).filter((x:any)=>{
  if(blocked.has(String(x.id)))return false;
  if(x.deleted_at)return false;
  if(String(x.schedule_state||"sent")==="cancelled")return false;
  if(String(x.schedule_state||"sent")==="pending"&&String(x.sender_person)!==person)return false;
  if(x.expires_at&&Date.parse(String(x.expires_at))<=now)return false;
  return true;
 });
}

async function chatState(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0",limit=clampInt(body.limit,20,100,60),beforeSeq=Number(body.beforeSeq||0),aroundId=text(body.aroundId||"",80);
 await chatReconcileDeletedMedia();
 let query:any;
 if(aroundId){
  const anchor=(await ok(db.from("galaxy_chat_messages").select("server_seq").eq("id",aroundId).is("deleted_at",null).limit(1)))?.[0];
  if(!anchor)return json({error:"Mensaje no encontrado."},404);
  const seq=Number(anchor.server_seq);
  query=db.from("galaxy_chat_messages").select("*").gte("server_seq",Math.max(1,seq-35)).lte("server_seq",seq+35).order("server_seq",{ascending:true}).limit(100);
 }else{
  query=db.from("galaxy_chat_messages").select("*").order("server_seq",{ascending:false}).limit(Math.min(200,limit+50));
  if(Number.isFinite(beforeSeq)&&beforeSeq>0)query=query.lt("server_seq",beforeSeq);
 }
 let rows=await chatVisibleRows(person,query);
 if(!aroundId)rows=rows.slice(0,limit).reverse();
 const incoming=rows.filter((x:any)=>String(x.sender_person)!==person&&String(x.schedule_state||"sent")==="sent"&&!x.delivered_at&&!x.deleted_at).map((x:any)=>String(x.id));
 const deliveredAt=new Date().toISOString();
 if(incoming.length){
  await ok(db.from("galaxy_chat_messages").update({delivered_at:deliveredAt}).in("id",incoming).is("delivered_at",null));
  rows=rows.map((x:any)=>incoming.includes(String(x.id))?{...x,delivered_at:deliveredAt}:x);
  await chatSignal(d,target,String(incoming[incoming.length-1]||""));
 }
 const messages=await chatHydrate(rows,person);
 const {count,error}=await db.from("galaxy_chat_messages").select("id",{count:"exact",head:true}).neq("sender_person",person).is("read_at",null).is("deleted_at",null);
 if(error)throw error;
 const nextBeforeSeq=!aroundId&&messages.length>=limit?Math.min(...messages.map((x:any)=>Number(x.server_seq||Number.MAX_SAFE_INTEGER))):null;
 const pins=await ok(db.from("galaxy_chat_pins").select("message_id,pinned_by,pinned_at").order("pinned_at",{ascending:false}).limit(100));
 return json({messages,unread:Number(count||0),nextBeforeSeq,partnerPresence:await chatPartnerPresence(person),pinnedIds:(pins||[]).map((x:any)=>String(x.message_id))});
}
async function chatAttachmentClaimProblem(files:any[],person:string,messageId:string=""){
 const claims=new Map<string,Set<string>>();
 for(const input of files||[]){
  const bucket=["galaxy-chat-media","galaxy-voice"].includes(String(input?.bucket))?String(input.bucket):"galaxy-chat-media";
  const path=text(input?.path,400),thumbnail=text(input?.thumbnailPath||"",400);
  if(!path||!path.startsWith(person+"/"))return {status:403,error:"El archivo no pertenece a este perfil."};
  if(thumbnail&&!thumbnail.startsWith(person+"/"))return {status:403,error:"La miniatura no pertenece a este perfil."};
  const set=claims.get(bucket)||new Set<string>();
  for(const candidate of [path,thumbnail].filter(Boolean)){
   if(set.has(candidate))return {status:409,error:"El archivo ya está asociado dentro de este mensaje."};
   set.add(candidate);
  }
  claims.set(bucket,set);
 }
 for(const [bucket,set] of claims){
  const paths=[...set];
  if(!paths.length)continue;
  let primary:any=db.from("galaxy_chat_attachments").select("id,message_id").eq("bucket",bucket).in("path",paths).limit(1);
  let thumbs:any=db.from("galaxy_chat_attachments").select("id,message_id").eq("bucket",bucket).in("thumbnail_path",paths).limit(1);
  if(messageId){primary=primary.neq("message_id",messageId);thumbs=thumbs.neq("message_id",messageId);}
  const [primaryRows,thumbnailRows]=await Promise.all([ok(primary),ok(thumbs)]);
  if(primaryRows?.length||thumbnailRows?.length)return {status:409,error:"El archivo ya está asociado a otro mensaje."};
 }
 return null;
}

async function chatSend(req:Request,body:any){
 const started=Date.now(),d=await device(req),person=String(d.person),target=person==="0"?"1":"0",clientId=String(body.clientId||"");
 if(!uuidish(clientId))return json({error:"Identificador de mensaje no válido."},400);
 const messageType=CHAT_MESSAGE_TYPES.has(String(body.messageType||"text"))?String(body.messageType||"text"):"text";
 const message=text(body.body,4000),attachmentMeta=chatSafeObject(body.attachment,4096);
 const files=Array.isArray(body.attachments)?body.attachments.slice(0,10):[];
 const entityRef=messageType==="card"?chatNormalizeEntityRef(body.entityRef):null;
 if(messageType==="card"&&!entityRef)return json({error:"Referencia de Nuestra Galaxia no válida."},400);
 if(!message&&messageType==="text"&&!files.length)return json({error:"Escribe un mensaje."},400);
 if(entityRef){
  const preview=await chatHydrateEntityRef({card_type:entityRef.cardType,entity_kind:entityRef.entityKind,entity_id:entityRef.entityId},person);
  if(!preview?.available)return json({error:"Este contenido ya no está disponible."},404);
 }
 if(messageType==="sticker"){
  const stickerId=String(attachmentMeta.stickerId||"");
  if(!uuidish(stickerId)||(await ok(db.from("galaxy_chat_stickers").select("id").eq("id",stickerId).limit(1)))?.length!==1)return json({error:"Sticker no disponible."},404);
 }
 if(messageType==="location"){
  if(String(attachmentMeta.mode||"static")==="live"){
   const liveId=String(attachmentMeta.liveSessionId||"");
   const session=uuidish(liveId)?(await ok(db.from("galaxy_chat_live_locations").select("id,sender_person,stopped_at,ends_at").eq("id",liveId).limit(1)))?.[0]:null;
   if(!session||String(session.sender_person)!==person||session.stopped_at||(session.ends_at&&Date.parse(String(session.ends_at))<=Date.now()))return json({error:"La ubicación en vivo ya no está disponible."},409);
  }else{
   const lat=Number(attachmentMeta.latitude),lon=Number(attachmentMeta.longitude);
   if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)return json({error:"Ubicación no válida."},400);
  }
 }
 const recent=await ok(db.from("galaxy_chat_messages").select("id").eq("sender_person",person).gt("server_received_at",new Date(Date.now()-60000).toISOString()).limit(100));
 if((recent||[]).length>=60)return json({error:"Espera un momento antes de enviar más mensajes."},429);
 let replyTo:string|null=null;
 if(body.replyTo){
  const reply=(await ok(db.from("galaxy_chat_messages").select("id").eq("id",String(body.replyTo)).limit(1)))?.[0];
  if(!reply)return json({error:"El mensaje al que respondes ya no existe."},404);
  replyTo=String(reply.id);
 }
 let row=(await ok(db.from("galaxy_chat_messages").select("*").eq("sender_person",person).eq("client_id",clientId).limit(1)))?.[0],isNew=false;
 const attachmentClaimProblem=await chatAttachmentClaimProblem(files,person,row?String(row.id):"");
 if(attachmentClaimProblem)return json({error:attachmentClaimProblem.error},attachmentClaimProblem.status);
 let scheduled=String(row?.schedule_state||"")==="pending";
 if(!row){
  const now=new Date().toISOString(),clientRaw=String(body.clientCreatedAt||"");
  const clientCreatedAt=Number.isFinite(Date.parse(clientRaw))&&Math.abs(Date.now()-Date.parse(clientRaw))<7*86400000?new Date(clientRaw).toISOString():now;
  const scheduleRaw=String(body.scheduledAt||"");
  const scheduleMs=Date.parse(scheduleRaw);
  scheduled=Number.isFinite(scheduleMs)&&scheduleMs>Date.now()+15000;
  const scheduledAt=scheduled?new Date(scheduleMs).toISOString():null;
  const ttlSeconds=Number(body.ttlSeconds||0);
  const baseMs=scheduled?scheduleMs:Date.now();
  const expiresAt=Number.isFinite(ttlSeconds)&&ttlSeconds>=3600&&ttlSeconds<=31536000?new Date(baseMs+ttlSeconds*1000).toISOString():null;
  const effect=["hearts","confetti","stars","kiss","sunflowers","galaxy"].includes(String(body.effect||""))?String(body.effect):null;
  const preview=message?await chatLinkPreview(message):{};
  row=await ok(db.from("galaxy_chat_messages").insert({
   client_id:clientId,sender_person:person,body:message,reply_to:replyTo,message_type:messageType,attachment:attachmentMeta,link_preview:preview,
   client_created_at:clientCreatedAt,server_received_at:now,sent_at:scheduled?null:now,
   scheduled_at:scheduledAt,schedule_state:scheduled?"pending":"sent",silent:body.silent===true,
   expires_at:expiresAt,view_once:body.viewOnce===true,effect
  }).select("*").single());
  isNew=true;
  await ok(db.from("galaxy_chat_metrics").insert({message_id:row.id,event:scheduled?"scheduled":"sent",send_latency_ms:Math.max(0,Date.now()-Date.parse(clientCreatedAt)),server_latency_ms:Date.now()-started,retry_count:clampInt(body.retryCount,0,100,0)}));
 }
 const attachmentRows:any[]=[];
 for(const input of files){
  const kind=["photo","video","audio","file"].includes(String(input?.kind))?String(input.kind):"file";
  const path=text(input?.path,400),bucket=["galaxy-chat-media","galaxy-voice"].includes(String(input?.bucket))?String(input.bucket):"galaxy-chat-media";
  if(!path.startsWith(person+"/"))continue;
  const waveform=Array.isArray(input?.waveform)?input.waveform.slice(0,256).map((v:any)=>Math.max(0,Math.min(1,Number(v)||0))):[];
  const quality=["optimized","hd","original"].includes(String(input?.mediaQuality))?String(input.mediaQuality):"optimized";
  attachmentRows.push({
   message_id:row.id,kind,bucket,path,mime:text(input?.mime||"application/octet-stream",120),name:text(input?.name||"archivo",240),
   size_bytes:Math.max(0,Number(input?.size||input?.sizeBytes||0)),duration_ms:Number.isFinite(Number(input?.durationMs))?Math.max(0,Number(input.durationMs)):null,
   width:Number.isFinite(Number(input?.width))?Math.max(1,Number(input.width)):null,height:Number.isFinite(Number(input?.height))?Math.max(1,Number(input.height)):null,
   thumbnail_path:text(input?.thumbnailPath||"",400)||null,caption:text(input?.caption||"",1000),waveform,media_quality:quality
  });
 }
 if(attachmentRows.length)await ok(db.from("galaxy_chat_attachments").upsert(attachmentRows,{onConflict:"message_id,path",ignoreDuplicates:true}));
 if(entityRef)await ok(db.from("galaxy_chat_entity_refs").upsert({message_id:row.id,card_type:entityRef.cardType,entity_kind:entityRef.entityKind,entity_id:entityRef.entityId,snapshot:{label:text(body?.entityRef?.label||"",120)},created_by:person,updated_at:new Date().toISOString()},{onConflict:"message_id"}));
 if(isNew&&messageType==="location"&&String(attachmentMeta.mode||"")==="live"&&uuidish(attachmentMeta.liveSessionId))await ok(db.from("galaxy_chat_live_locations").update({message_id:row.id}).eq("id",String(attachmentMeta.liveSessionId)).eq("sender_person",person));
 if(isNew&&messageType==="sticker"&&uuidish(attachmentMeta.stickerId))await ok(db.from("galaxy_chat_sticker_recents").upsert({sticker_id:String(attachmentMeta.stickerId),person,last_used_at:new Date().toISOString()},{onConflict:"sticker_id,person"}));
 if(!scheduled)await ok(db.from("galaxy_chat_read_state").upsert({person,last_read_at:row.created_at,last_read_message_id:row.id,updated_at:new Date().toISOString()},{onConflict:"person"}));
 let push:any={sent:0,configured:false,scheduled};
 if(isNew&&!scheduled){
  const names=await profileNames(),senderName=names[Number(person)]||"Tu persona";
  const pushBody=entityRef?(senderName+" "+chatCardPushBody({card_type:entityRef.cardType})):message||({photo:"Foto",video:"Video",video_message:"Videomensaje",audio:"Nota de voz",file:"Archivo",location:"Ubicación",song:"Canción",link:"Enlace",sticker:"Sticker",gif:"GIF"}[messageType]||"Mensaje");
  push=await dispatchPushEvent(d,target,"chat_message",{title:senderName,body:pushBody,action:"chat",senderName,entityType:"chat_message",entityId:String(row.id),silent:row.silent===true});
 }
 const hydrated=(await chatHydrate([row],person))[0];
 return json({message:hydrated,push,idempotent:!isNew,scheduled},isNew?201:200);
}
async function chatCreateNativeCardMessage(d:any,clientId:string,ref:{cardType:string,entityKind:string,entityId:string}){
 const person=String(d.person),target=person==="0"?"1":"0";
 if(!uuidish(clientId))throw new Error("Identificador de mensaje no válido.");
 let row=(await ok(db.from("galaxy_chat_messages").select("*").eq("sender_person",person).eq("client_id",clientId).limit(1)))?.[0],created=false;
 if(!row){
  const now=new Date().toISOString();
  row=await ok(db.from("galaxy_chat_messages").insert({
   client_id:clientId,sender_person:person,body:"",message_type:"card",attachment:{},link_preview:{},
   client_created_at:now,server_received_at:now,sent_at:now,schedule_state:"sent",silent:false
  }).select("*").single());
  created=true;
 }
 await ok(db.from("galaxy_chat_entity_refs").upsert({message_id:row.id,card_type:ref.cardType,entity_kind:ref.entityKind,entity_id:ref.entityId,snapshot:{},created_by:person,updated_at:new Date().toISOString()},{onConflict:"message_id"}));
 await ok(db.from("galaxy_chat_read_state").upsert({person,last_read_at:row.created_at,last_read_message_id:row.id,updated_at:new Date().toISOString()},{onConflict:"person"}));
 if(created){
  const names=await profileNames(),senderName=names[Number(person)]||"Tu persona";
  await dispatchPushEvent(d,target,"chat_message",{title:senderName,body:senderName+" "+chatCardPushBody({card_type:ref.cardType}),action:"chat",senderName,entityType:"chat_message",entityId:String(row.id)});
  await ok(db.from("galaxy_chat_metrics").insert({message_id:row.id,event:"sent",send_latency_ms:0,server_latency_ms:0,retry_count:0}));
 }
 return {message:(await chatHydrate([row],person))[0],created};
}
async function chatPoll(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0",operation=String(body.operation||"state");
 if(operation==="create"){
  const pollId=String(body.pollId||""),clientId=String(body.clientId||""),question=text(body.question,500);
  const labels=(Array.isArray(body.options)?body.options:[]).map((x:any)=>text(x,240)).filter(Boolean).slice(0,10);
  if(!uuidish(pollId)||!uuidish(clientId)||!question||labels.length<2||new Set(labels.map((x:string)=>x.toLocaleLowerCase("es"))).size!==labels.length)return json({error:"Completa la encuesta con 2 a 10 opciones distintas."},400);
  let closesAt:null|string=null;
  if(body.closesAt){
   const ms=Date.parse(String(body.closesAt));if(!Number.isFinite(ms)||ms<=Date.now()+60000)return json({error:"El cierre debe ser una fecha futura."},400);
   closesAt=new Date(ms).toISOString();
  }
  let poll=(await ok(db.from("galaxy_chat_polls").select("*").eq("id",pollId).limit(1)))?.[0];
  if(poll&&String(poll.created_by)!==person)return json({error:"Encuesta no disponible."},403);
  if(!poll){
   poll=await ok(db.from("galaxy_chat_polls").insert({id:pollId,created_by:person,question,allow_multiple:body.allowMultiple===true,closes_at:closesAt}).select("*").single());
   await ok(db.from("galaxy_chat_poll_options").insert(labels.map((label:string,position:number)=>({poll_id:pollId,label,position}))));
  }
  const shell=await chatCreateNativeCardMessage(d,clientId,{cardType:"POLL",entityKind:"poll",entityId:pollId});
  if(!poll.message_id)await ok(db.from("galaxy_chat_polls").update({message_id:shell.message.id,updated_at:new Date().toISOString()}).eq("id",pollId).is("message_id",null));
  return json({message:shell.message,poll:await chatPollCard(pollId,person),idempotent:!shell.created},shell.created?201:200);
 }
 const pollId=String(body.pollId||body.id||"");
 if(!uuidish(pollId))return json({error:"Encuesta no válida."},400);
 const poll=(await ok(db.from("galaxy_chat_polls").select("*").eq("id",pollId).limit(1)))?.[0];
 if(!poll)return json({error:"Encuesta no disponible."},404);
 if(operation==="state")return json({poll:await chatPollCard(pollId,person)});
 if(operation==="winner"){
  try{
   const result=await ok(db.rpc("galaxy_chat_poll_winner",{p_poll_id:pollId}));
   if(result?.tie)return json({error:"La encuesta terminó en empate; no existe un ganador único.",...result},409);
   if(!result?.winner)return json({error:"La encuesta cerró sin votos; no existe un ganador.",...result},409);
   return json(result);
  }catch(error){
   const message=String((error as any)?.message||"");
   if(message.includes("sigue abierta"))return json({error:"Cierra la encuesta antes de convertir su ganador en Plan."},409);
   throw error;
  }
 }
 if(operation==="close"){
  try{
   const mutation=await ok(db.rpc("galaxy_chat_poll_mutate",{p_poll_id:pollId,p_person:person,p_operation:"close",p_option_id:null,p_selected:true}));
   if(mutation?.changed&&poll.message_id)await chatSignal(d,target,String(poll.message_id));
   return json({poll:await chatPollCard(pollId,person),idempotent:!mutation?.changed});
  }catch(error){
   const message=String((error as any)?.message||"");
   if(message.includes("Solo quien creó"))return json({error:"Solo quien creó la encuesta puede cerrarla."},403);
   throw error;
  }
 }
 if(operation==="vote"){
  const optionId=String(body.optionId||"");
  if(!uuidish(optionId))return json({error:"Opción no válida."},400);
  let mutation:any;
  try{
   mutation=await ok(db.rpc("galaxy_chat_poll_mutate",{p_poll_id:pollId,p_person:person,p_operation:"vote",p_option_id:optionId,p_selected:body.selected!==false}));
  }catch(error){
   const message=String((error as any)?.message||"");
   if(message.includes("cerrada"))return json({error:"La encuesta está cerrada."},409);
   if(message.includes("Opción no disponible"))return json({error:"Opción no disponible."},404);
   throw error;
  }
  const card=await chatPollCard(pollId,person);
  if(mutation?.changed&&poll.message_id){
   const names=await profileNames(),senderName=names[Number(person)]||"Tu persona";
   await dispatchPushEvent(d,target,"chat_message",{title:senderName,body:senderName+" votó en "+text(poll.question,120),action:"chat",senderName,entityType:"chat_message",entityId:String(poll.message_id)});
   await chatSignal(d,target,String(poll.message_id));
  }
  return json({poll:card,idempotent:!mutation?.changed});
 }
 return json({error:"Operación de encuesta no válida."},400);
}

async function chatChecklist(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0",operation=String(body.operation||"state");
 if(operation==="create"){
  const checklistId=String(body.checklistId||""),clientId=String(body.clientId||""),title=text(body.title,300);
  const labels=(Array.isArray(body.items)?body.items:[]).map((x:any)=>text(x,300)).filter(Boolean).slice(0,50);
  if(!uuidish(checklistId)||!uuidish(clientId)||!title||!labels.length)return json({error:"Ponle un título y al menos un elemento a la checklist."},400);
  let list=(await ok(db.from("galaxy_chat_checklists").select("*").eq("id",checklistId).limit(1)))?.[0];
  if(list&&String(list.created_by)!==person)return json({error:"Checklist no disponible."},403);
  if(!list){
   list=await ok(db.from("galaxy_chat_checklists").insert({id:checklistId,created_by:person,title}).select("*").single());
   await ok(db.from("galaxy_chat_checklist_items").insert(labels.map((label:string,position:number)=>({checklist_id:checklistId,label,position,checked:false,updated_by:person}))));
  }
  const shell=await chatCreateNativeCardMessage(d,clientId,{cardType:"CHECKLIST",entityKind:"checklist",entityId:checklistId});
  if(!list.message_id)await ok(db.from("galaxy_chat_checklists").update({message_id:shell.message.id,updated_at:new Date().toISOString()}).eq("id",checklistId).is("message_id",null));
  return json({message:shell.message,checklist:await chatChecklistCard(checklistId),idempotent:!shell.created},shell.created?201:200);
 }
 const checklistId=String(body.checklistId||body.id||"");
 if(!uuidish(checklistId))return json({error:"Checklist no válida."},400);
 const list=(await ok(db.from("galaxy_chat_checklists").select("*").eq("id",checklistId).limit(1)))?.[0];
 if(!list)return json({error:"Checklist no disponible."},404);
 if(operation==="state")return json({checklist:await chatChecklistCard(checklistId)});
 if(operation==="set"){
  const itemId=String(body.itemId||""),checked=body.checked===true,expected=Number(body.expectedVersion);
  if(!uuidish(itemId))return json({error:"Elemento no válido."},400);
  if(!Number.isInteger(expected)||expected<1)return json({error:"Versión de checklist no válida."},400);
  const item=(await ok(db.from("galaxy_chat_checklist_items").select("id,label").eq("id",itemId).eq("checklist_id",checklistId).limit(1)))?.[0];
  if(!item)return json({error:"Elemento no disponible."},404);
  let mutation:any;
  try{
   mutation=await ok(db.rpc("galaxy_chat_checklist_set",{p_checklist_id:checklistId,p_item_id:itemId,p_person:person,p_checked:checked,p_expected_item_version:expected}));
  }catch(error){
   const message=String((error as any)?.message||"");
   if(message.includes("cambió"))return json({error:"La checklist cambió. Actualiza antes de intentarlo otra vez."},409);
   if(message.includes("no disponible"))return json({error:message.includes("Elemento")?"Elemento no disponible.":"Checklist no disponible."},404);
   throw error;
  }
  if(mutation?.changed&&list.message_id){
   const names=await profileNames(),senderName=names[Number(person)]||"Tu persona";
   await dispatchPushEvent(d,target,"chat_message",{title:senderName,body:senderName+(checked?" completó ":" reabrió ")+text(item.label,120),action:"chat",senderName,entityType:"chat_message",entityId:String(list.message_id)});
   await chatSignal(d,target,String(list.message_id));
  }
  return json({checklist:await chatChecklistCard(checklistId),idempotent:!mutation?.changed});
 }
 return json({error:"Operación de checklist no válida."},400);
}

async function chatRead(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0";
 let row:any=null;
 if(body.messageId)row=(await ok(db.from("galaxy_chat_messages").select("id,created_at,server_seq").eq("id",String(body.messageId)).limit(1)))?.[0];
 if(!row)row=(await ok(db.from("galaxy_chat_messages").select("id,created_at,server_seq").order("server_seq",{ascending:false}).limit(1)))?.[0];
 if(!row)return json({ok:true});
 const now=new Date().toISOString(),seq=Number(row.server_seq);
 const pref=(await ok(db.from("galaxy_chat_preferences").select("show_read").eq("person",person).limit(1)))?.[0];
 await ok(db.from("galaxy_chat_messages").update({delivered_at:now}).neq("sender_person",person).eq("schedule_state","sent").lte("server_seq",seq).is("delivered_at",null));
 if(pref?.show_read!==false)await ok(db.from("galaxy_chat_messages").update({read_at:now}).neq("sender_person",person).eq("schedule_state","sent").lte("server_seq",seq).is("read_at",null));
 await ok(db.from("galaxy_chat_read_state").upsert({person,last_read_at:now,last_read_message_id:row.id,updated_at:now},{onConflict:"person"}));
 await ok(db.from("galaxy_notifications").update({read_at:now}).eq("target_person",person).eq("event_type","chat_message").is("read_at",null));
 await chatSignal(d,target,String(row.id));
 return json({ok:true,lastReadAt:now,serverSeq:seq});
}
async function chatEdit(req:Request,body:any){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0",id=String(body.id||""),next=text(body.body,4000);
 if(!next)return json({error:"Escribe el mensaje editado."},400);
 const row=(await ok(db.from("galaxy_chat_messages").select("*").eq("id",id).limit(1)))?.[0];
 if(!row)return json({error:"Mensaje no encontrado."},404);
 if(String(row.sender_person)!==person)return json({error:"Solo puedes editar tus propios mensajes."},403);
 if(row.deleted_at)return json({error:"No puedes editar un mensaje eliminado."},409);
 if(String(row.message_type)!=="text")return json({error:"Esta versión solo edita mensajes de texto."},409);
 if(Date.now()-Date.parse(row.created_at)>CHAT_EDIT_MINUTES*60000)return json({error:"La ventana de edición ya terminó."},409);
 if(next===String(row.body))return json({message:(await chatHydrate([row],person))[0]});
 await ok(db.from("galaxy_chat_edits").insert({message_id:id,editor_person:person,previous_body:String(row.body||"")}));
 const editedAt=new Date().toISOString(),preview=await chatLinkPreview(next);
 const updated=await ok(db.from("galaxy_chat_messages").update({body:next,edited_at:editedAt,link_preview:preview}).eq("id",id).select("*").single());
 await chatSignal(d,target,id);
 return json({message:(await chatHydrate([updated],person))[0]});
}
async function chatDeleteAttachments(messageId:string){
 const attachments=await ok(db.from("galaxy_chat_attachments").select("id,bucket,path,thumbnail_path").eq("message_id",messageId).limit(50));
 for(const a of attachments||[]){
  const bucket=String(a.bucket||"galaxy-chat-media"),paths=[String(a.path||""),String(a.thumbnail_path||"")].filter(Boolean);
  await ok(db.from("galaxy_chat_stickers").delete().eq("bucket",bucket).in("path",paths));
  for(const path of paths){
   const {count,error}=await db.from("galaxy_chat_attachments").select("id",{count:"exact",head:true}).eq("bucket",bucket)
    .or("path.eq."+path+",thumbnail_path.eq."+path).neq("message_id",messageId);
   if(error)throw error;
   if(Number(count||0)===0){
    const {error:removeError}=await db.storage.from(bucket).remove([path]);
    if(removeError)throw removeError;
   }
  }
 }
 await Promise.all([
  ok(db.from("galaxy_chat_pins").delete().eq("message_id",messageId)),
  ok(db.from("galaxy_chat_favorites").delete().eq("message_id",messageId)),
  ok(db.from("galaxy_chat_attachments").delete().eq("message_id",messageId))
 ]);
}

async function chatReconcileDeletedMedia(limit=100){
 const rows=await ok(db.from("galaxy_chat_messages").select("id").not("deleted_at","is",null).order("deleted_at",{ascending:true}).limit(Math.max(1,Math.min(500,limit))));
 for(const row of rows||[]){
  const exists=(await ok(db.from("galaxy_chat_attachments").select("id").eq("message_id",String(row.id)).limit(1)))?.length;
  if(exists)await chatDeleteAttachments(String(row.id));
 }
 return true;
}

async function chatDelete(req:Request,body:any){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0",id=String(body.id||""),scope=String(body.scope||"both");
 const row=(await ok(db.from("galaxy_chat_messages").select("*").eq("id",id).limit(1)))?.[0];
 if(!row)return json({ok:true});
 if(scope==="me"){
  await ok(db.from("galaxy_chat_hidden").upsert({message_id:id,person},{onConflict:"message_id,person"}));
  return json({ok:true,scope:"me"});
 }
 if(String(row.sender_person)!==person)return json({error:"Solo puedes eliminar tus propios mensajes."},403);
 if(Date.now()-Date.parse(row.created_at)>CHAT_DELETE_MINUTES*60000)return json({error:"La ventana para eliminar para ambos ya terminó."},409);
 await chatDeleteAttachments(id);
 if(!row.deleted_at){
  await ok(db.from("galaxy_chat_messages").update({deleted_at:new Date().toISOString(),body:"Mensaje eliminado",attachment:{},link_preview:{}}).eq("id",id));
 }
 await chatSignal(d,target,id);
 return json({ok:true,scope:"both"});
}
async function chatReact(req:Request,body:any){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0",id=String(body.id||""),emoji=String(body.emoji||"");
 const row=(await ok(db.from("galaxy_chat_messages").select("id,deleted_at").eq("id",id).limit(1)))?.[0];
 if(!row)return json({error:"Mensaje no encontrado."},404);
 if(row.deleted_at)return json({error:"No puedes reaccionar a un mensaje eliminado."},409);
 if(!emoji)await ok(db.from("galaxy_chat_reactions").delete().eq("message_id",id).eq("person",person));
 else{
  if(!CHAT_REACTIONS.has(emoji))return json({error:"Reacción no válida."},400);
  await ok(db.from("galaxy_chat_reactions").upsert({message_id:id,person,emoji,updated_at:new Date().toISOString()},{onConflict:"message_id,person"}));
 }
 await chatSignal(d,target,id);
 return json({ok:true,reactions:(await ok(db.from("galaxy_chat_reactions").select("person,emoji").eq("message_id",id)))||[]});
}
async function chatPin(req:Request,body:any){
 const d=await device(req),person=String(d.person),target=person==="0"?"1":"0",id=String(body.id||""),pinned=body.pinned!==false;
 const row=(await ok(db.from("galaxy_chat_messages").select("id,deleted_at").eq("id",id).limit(1)))?.[0];
 if(!row||row.deleted_at)return json({error:"Mensaje no encontrado."},404);
 if(pinned)await ok(db.from("galaxy_chat_pins").upsert({message_id:id,pinned_by:person,pinned_at:new Date().toISOString()},{onConflict:"message_id"}));
 else await ok(db.from("galaxy_chat_pins").delete().eq("message_id",id));
 await chatSignal(d,target,id);
 return json({ok:true,pinned});
}
async function chatFavorite(req:Request,body:any){
 const d=await device(req),person=String(d.person),id=String(body.id||""),saved=body.saved!==false;
 const row=(await ok(db.from("galaxy_chat_messages").select("id,deleted_at").eq("id",id).limit(1)))?.[0];
 if(!row||row.deleted_at)return json({error:"Mensaje no encontrado."},404);
 if(saved)await ok(db.from("galaxy_chat_favorites").upsert({message_id:id,person},{onConflict:"message_id,person"}));
 else await ok(db.from("galaxy_chat_favorites").delete().eq("message_id",id).eq("person",person));
 return json({ok:true,saved});
}
async function chatCollection(req:Request,body:any,kind:"pins"|"saved"){
 const d=await device(req),person=String(d.person);
 const links=kind==="pins"
  ?await ok(db.from("galaxy_chat_pins").select("message_id").order("pinned_at",{ascending:false}).limit(200))
  :await ok(db.from("galaxy_chat_favorites").select("message_id").eq("person",person).order("saved_at",{ascending:false}).limit(200));
 const ids=(links||[]).map((x:any)=>String(x.message_id));if(!ids.length)return json({messages:[]});
 const rows=await chatVisibleRows(person,db.from("galaxy_chat_messages").select("*").in("id",ids).limit(200));
 const byId=new Map(rows.map((x:any)=>[String(x.id),x]));
 return json({messages:await chatHydrate(ids.map((id:string)=>byId.get(id)).filter((x:any)=>Boolean(x)),person)});
}
async function chatSearch(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),q=text(body.query||"",160),sender=String(body.sender||"all"),type=String(body.type||"all"),date=String(body.date||"");
 const limit=clampInt(body.limit,10,80,40),beforeSeq=Number(body.beforeSeq||0);
 const rowsRaw=await ok(db.rpc("galaxy_chat_search_page",{
  p_person:person,p_query:q,p_sender:sender,p_type:type,p_date:/^\d{4}-\d{2}-\d{2}$/.test(date)?date:null,
  p_before_seq:Number.isFinite(beforeSeq)&&beforeSeq>0?beforeSeq:null,p_limit:limit+1
 }));
 const rows=Array.isArray(rowsRaw)?rowsRaw:[],hasMore=rows.length>limit,page=rows.slice(0,limit);
 const messages=await chatHydrate(page,person);
 const nextBeforeSeq=hasMore&&page.length?Math.min(...page.map((x:any)=>Number(x.server_seq||Number.MAX_SAFE_INTEGER))):null;
 return json({messages,nextBeforeSeq});
}

async function chatPresence(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),state=String(body.state||"ONLINE"),now=new Date();
 if(state==="OFFLINE"){
  const current=(await ok(db.from("galaxy_chat_presence").select("last_active_at").eq("person",person).limit(1)))?.[0];
  await ok(db.from("galaxy_chat_presence").upsert({person,state:"ONLINE",last_active_at:now.toISOString(),expires_at:now.toISOString(),metadata:{},updated_at:now.toISOString()},{onConflict:"person"}));
  await chatSignal(d,person==="0"?"1":"0","","chat_sync");
  return json({ok:true,partner:await chatPartnerPresence(person),lastActiveAt:current?.last_active_at||now.toISOString()});
 }
 if(!CHAT_PRESENCE_STATES.has(state))return json({error:"Estado de presencia no válido."},400);
 const ttl=state==="TYPING"?8:state==="ONLINE"?45:30,expires=new Date(now.getTime()+ttl*1000).toISOString();
 await ok(db.from("galaxy_chat_presence").upsert({person,state,last_active_at:now.toISOString(),expires_at:expires,metadata:chatSafeObject(body.metadata,1024),updated_at:now.toISOString()},{onConflict:"person"}));
 await chatSignal(d,person==="0"?"1":"0","", "chat_sync");
 return json({ok:true,state,expiresAt:expires,partner:await chatPartnerPresence(person)});
}

async function chatScheduleUpdate(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),id=String(body.id||"");
 const row=(await ok(db.from("galaxy_chat_messages").select("*").eq("id",id).limit(1)))?.[0];
 if(!row)return json({error:"Mensaje programado no encontrado."},404);
 if(String(row.sender_person)!==person)return json({error:"Solo puedes cambiar tus mensajes programados."},403);
 if(String(row.schedule_state)!=="pending")return json({error:"Este mensaje ya no está pendiente."},409);
 if(body.cancel===true){
  const updated=await ok(db.from("galaxy_chat_messages").update({schedule_state:"cancelled",deleted_at:new Date().toISOString()}).eq("id",id).eq("schedule_state","pending").select("*").single());
  return json({ok:true,message:(await chatHydrate([updated],person))[0]});
 }
 const when=Date.parse(String(body.scheduledAt||row.scheduled_at||""));
 if(!Number.isFinite(when)||when<=Date.now()+15000)return json({error:"Elige una fecha futura válida."},400);
 const updated=await ok(db.from("galaxy_chat_messages").update({scheduled_at:new Date(when).toISOString(),silent:body.silent===undefined?row.silent:body.silent===true}).eq("id",id).eq("schedule_state","pending").select("*").single());
 return json({ok:true,message:(await chatHydrate([updated],person))[0]});
}
async function chatPreferences(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"get");
 if(operation==="get"){
  const row=(await ok(db.from("galaxy_chat_preferences").select("*").eq("person",person).limit(1)))?.[0]||null;
  return json({preferences:row||{person,partner_nickname:null,theme:"galaxy",notification_privacy:"full",show_read:true,show_last_seen:true,show_typing:true,default_ttl_seconds:null}});
 }
 const patch:any={person,updated_at:new Date().toISOString()};
 if(body.partnerNickname!==undefined)patch.partner_nickname=text(body.partnerNickname,40)||null;
 if(["galaxy","sunflowers","night","cyberpunk","romantic","minimal"].includes(String(body.theme)))patch.theme=String(body.theme);
 if(["full","name","generic"].includes(String(body.notificationPrivacy)))patch.notification_privacy=String(body.notificationPrivacy);
 for(const [src,dst] of [["showRead","show_read"],["showLastSeen","show_last_seen"],["showTyping","show_typing"]] as const)if(body[src]!==undefined)patch[dst]=body[src]===true;
 if(body.defaultTtlSeconds!==undefined){
  const ttl=Number(body.defaultTtlSeconds||0);patch.default_ttl_seconds=ttl>=3600&&ttl<=31536000?Math.round(ttl):null;
 }
 const saved=await ok(db.from("galaxy_chat_preferences").upsert(patch,{onConflict:"person"}).select("*").single());
 await chatSignal(d,person==="0"?"1":"0","");
 return json({preferences:saved});
}
async function chatOpenOnce(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),id=String(body.id||"");
 const row=(await ok(db.from("galaxy_chat_messages").select("*").eq("id",id).limit(1)))?.[0];
 if(!row||!row.view_once)return json({error:"Contenido de una sola visualización no disponible."},404);
 if(String(row.sender_person)===person)return json({error:"El contenido de una sola visualización solo lo abre quien lo recibe."},409);
 if(row.opened_at)return json({error:"Este contenido ya fue abierto."},410);
 if(row.deleted_at||String(row.schedule_state)!=="sent")return json({error:"Este contenido ya no está disponible."},410);
 const attachments=await ok(db.from("galaxy_chat_attachments").select("*").eq("message_id",id).limit(10));
 if(!(attachments||[]).length)return json({error:"El archivo ya no está disponible."},410);
 const openedAt=new Date(),expiresAt=new Date(openedAt.getTime()+120000);
 const claimed=await ok(db.from("galaxy_chat_messages").update({opened_at:openedAt.toISOString(),expires_at:expiresAt.toISOString()}).eq("id",id).is("opened_at",null).select("id").maybeSingle());
 if(!claimed)return json({error:"Este contenido ya fue abierto."},410);
 const media=await Promise.all((attachments||[]).map(async(a:any)=>({id:a.id,kind:a.kind,mime:a.mime,name:a.name,url:await signed(String(a.bucket),String(a.path),120),durationMs:a.duration_ms,width:a.width,height:a.height})));
 await chatSignal(d,person==="0"?"1":"0",id);
 return json({media,expiresAt:expiresAt.toISOString()});
}
async function chatTranscript(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),attachmentId=String(body.attachmentId||"");
 const existing=(await ok(db.from("galaxy_chat_transcripts").select("*").eq("attachment_id",attachmentId).limit(1)))?.[0];
 if(existing)return json({transcript:existing});
 const attachment=(await ok(db.from("galaxy_chat_attachments").select("*,galaxy_chat_messages!inner(id,sender_person,deleted_at)").eq("id",attachmentId).limit(1)))?.[0];
 if(!attachment||attachment.kind!=="audio"||attachment.galaxy_chat_messages?.deleted_at)return json({error:"Audio no disponible."},404);
 await intelligenceUsage(person,"transcribe",8);
 const {data:blob,error}=await db.storage.from(String(attachment.bucket)).download(String(attachment.path));
 if(error||!blob)return json({error:"No pude abrir el audio."},503);
 try{
  const result=await transcribeAudioBlob(blob,String(attachment.name||"audio.m4a"),String(attachment.mime||"audio/mp4"));
  const saved=await ok(db.from("galaxy_chat_transcripts").insert({attachment_id:attachmentId,requested_by:person,transcript:text(result.text,30000),segments:sanitizeTranscriptSegments(result.segments),provider:result.provider,model:result.model}).select("*").single());
  return json({transcript:saved});
 }catch{return json({error:"No se pudo transcribir este audio."},503);}
}
async function chatTranslate(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),id=String(body.id||""),targetLanguage=text(body.targetLanguage||"es",24),persist=body.persist===true;
 const row=(await ok(db.from("galaxy_chat_messages").select("id,body,deleted_at").eq("id",id).limit(1)))?.[0];
 if(!row||row.deleted_at||!String(row.body||"").trim())return json({error:"Mensaje no disponible para traducir."},404);
 if(persist){
  const cached=(await ok(db.from("galaxy_chat_translations").select("*").eq("message_id",id).eq("person",person).eq("target_language",targetLanguage).limit(1)))?.[0];
  if(cached)return json({translation:cached,persisted:true});
 }
 if(!aiProviderConfig().configured)return json({error:"La traducción requiere el proveedor de IA configurado."},503);
 await intelligenceUsage(person,"ask",30);
 try{
  const translated=text(await generateGroundedResponse("Traduce fielmente el texto al idioma solicitado. Devuelve únicamente la traducción, sin explicaciones ni contenido adicional.","IDIOMA: "+targetLanguage+"\nTEXTO:\n"+String(row.body),800),8000);
  const result={message_id:id,person,target_language:targetLanguage,translated_text:translated,provider:"openai-compatible",model:aiProviderConfig().model||"configured"};
  if(!persist)return json({translation:result,persisted:false});
  const saved=await ok(db.from("galaxy_chat_translations").upsert(result,{onConflict:"message_id,person,target_language"}).select("*").single());
  return json({translation:saved,persisted:true});
 }catch{return json({error:"No se pudo traducir el mensaje."},503);}
}
async function chatExpireRow(row:any){
 const id=String(row.id);
 const attachments=await ok(db.from("galaxy_chat_attachments").select("id,bucket,path").eq("message_id",id).limit(30));
 for(const a of attachments||[]){
  const bucket=String(a.bucket),path=String(a.path);
  const [{count:otherCount,error:otherError},{count:stickerCount,error:stickerError}]=await Promise.all([
   db.from("galaxy_chat_attachments").select("id",{count:"exact",head:true}).eq("bucket",bucket).eq("path",path).neq("message_id",id),
   db.from("galaxy_chat_stickers").select("id",{count:"exact",head:true}).eq("bucket",bucket).eq("path",path)
  ]);
  if(otherError)throw otherError;if(stickerError)throw stickerError;
  if(Number(otherCount||0)===0&&Number(stickerCount||0)===0)try{await db.storage.from(bucket).remove([path]);}catch{}
 }
 await ok(db.from("galaxy_notifications").delete().eq("event_type","chat_message").eq("entity_id",id));
 await ok(db.from("galaxy_chat_messages").delete().eq("id",id));
}

async function chatProcessDue(req:Request){
 const token=String(req.headers.get("x-galaxy-cron-token")||"");
 const runtime=(await ok(db.from("galaxy_chat_runtime").select("cron_token").eq("id",1).limit(1)))?.[0];
 if(!runtime||token!==String(runtime.cron_token))return json({error:"No autorizado"},401);
 const now=new Date().toISOString();
 const expired=await ok(db.from("galaxy_chat_messages").select("*").lte("expires_at",now).is("deleted_at",null).limit(100));
 for(const row of expired||[])await chatExpireRow(row);
 const due=await ok(db.from("galaxy_chat_messages").select("*").eq("schedule_state","pending").lte("scheduled_at",now).is("deleted_at",null).order("scheduled_at",{ascending:true}).limit(50));
 let sent=0;
 for(const row of due||[]){
  const claimed=await ok(db.from("galaxy_chat_messages").update({schedule_state:"processing"}).eq("id",String(row.id)).eq("schedule_state","pending").select("*").maybeSingle());
  if(!claimed)continue;
  const sentAt=new Date().toISOString();
  const updated=await ok(db.from("galaxy_chat_messages").update({schedule_state:"sent",sent_at:sentAt,server_received_at:sentAt}).eq("id",String(row.id)).select("*").single());
  const sender=String(updated.sender_person),target=sender==="0"?"1":"0",names=await profileNames(),senderName=names[Number(sender)]||"Tu persona";
  const ref=String(updated.message_type)==="card"?(await ok(db.from("galaxy_chat_entity_refs").select("card_type").eq("message_id",String(updated.id)).limit(1)))?.[0]:null;
  const pushBody=ref?senderName+" "+chatCardPushBody(ref):String(updated.body||"").trim()||({photo:"Foto",video:"Video",video_message:"Videomensaje",audio:"Nota de voz",file:"Archivo",location:"Ubicación",song:"Canción",sticker:"Sticker",gif:"GIF"}[String(updated.message_type)]||"Mensaje");
  await dispatchPushEvent({person:sender,id:null},target,"chat_message",{title:senderName,body:pushBody,action:"chat",senderName,entityType:"chat_message",entityId:String(updated.id),silent:updated.silent===true});
  sent++;
 }
 return json({ok:true,sent,expired:(expired||[]).length});
}


async function chatTranscriptDelete(req:Request,body:any={}){
 await device(req);
 const attachmentId=String(body.attachmentId||"");
 if(!uuidish(attachmentId))return json({error:"Audio no válido."},400);
 await ok(db.from("galaxy_chat_transcripts").delete().eq("attachment_id",attachmentId));
 return json({ok:true});
}

async function chatShared(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),category=String(body.category||"media"),query=text(body.query||"",120).toLocaleLowerCase("es");
 let rows:any[]=[];
 if(category==="pins"||category==="saved"){
  const links=category==="pins"
   ?await ok(db.from("galaxy_chat_pins").select("message_id").order("pinned_at",{ascending:false}).limit(300))
   :await ok(db.from("galaxy_chat_favorites").select("message_id").eq("person",person).order("saved_at",{ascending:false}).limit(300));
  const ids=(links||[]).map((x:any)=>String(x.message_id));
  if(ids.length)rows=await chatVisibleRows(person,db.from("galaxy_chat_messages").select("*").in("id",ids).order("server_seq",{ascending:false}).limit(300));
 }else if(category==="media"||category==="files"){
  let aq:any=db.from("galaxy_chat_attachments").select("message_id,kind,name,mime").order("created_at",{ascending:false}).limit(400);
  aq=category==="files"?aq.eq("kind","file"):aq.in("kind",["photo","video"]);
  const ars=await ok(aq),ids=[...new Set((ars||[]).filter((x:any)=>!query||String(x.name||"").toLocaleLowerCase("es").includes(query)).map((x:any)=>String(x.message_id)))];
  if(ids.length)rows=await chatVisibleRows(person,db.from("galaxy_chat_messages").select("*").in("id",ids).order("server_seq",{ascending:false}).limit(300));
 }else{
  let mq:any=db.from("galaxy_chat_messages").select("*").order("server_seq",{ascending:false}).limit(500);
  if(category==="links")mq=mq.eq("message_type","link");
  if(category==="music")mq=mq.eq("message_type","song");
  if(category==="locations")mq=mq.eq("message_type","location");
  rows=await chatVisibleRows(person,mq);
 }
 if(query)rows=rows.filter((x:any)=>String(x.body||"").toLocaleLowerCase("es").includes(query)||JSON.stringify(x.attachment||{}).toLocaleLowerCase("es").includes(query));
 rows=rows.slice(0,120);
 return json({category,messages:await chatHydrate(rows,person)});
}

async function chatAlbums(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"list");
 if(operation==="list"){
  const albums=await ok(db.from("galaxy_chat_albums").select("*").order("album_date",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(200));
  const ids=(albums||[]).map((x:any)=>String(x.id));
  const items=ids.length?await ok(db.from("galaxy_chat_album_items").select("*").in("album_id",ids).order("added_at",{ascending:true})):[]; 
  const attachmentIds=[...new Set((items||[]).map((x:any)=>String(x.attachment_id)))];
  const attachments=attachmentIds.length?await ok(db.from("galaxy_chat_attachments").select("*,galaxy_chat_messages!inner(id,deleted_at)").in("id",attachmentIds).is("galaxy_chat_messages.deleted_at",null)):[];
  const mediaMap=new Map<string,any>();
  for(const a of attachments||[])mediaMap.set(String(a.id),{id:a.id,kind:a.kind,name:a.name,mime:a.mime,message_id:a.message_id,url:await signed(String(a.bucket),String(a.path),1800),thumbnailUrl:a.thumbnail_path?await signed(String(a.bucket),String(a.thumbnail_path),1800):null});
  return json({albums:(albums||[]).map((a:any)=>({...a,items:(items||[]).filter((x:any)=>String(x.album_id)===String(a.id)).map((x:any)=>mediaMap.get(String(x.attachment_id))).filter(Boolean)}))});
 }
 if(operation==="create"){
  const name=text(body.name,80),albumDate=validDate(body.albumDate)?String(body.albumDate):null,cover=uuidish(body.coverAttachmentId)?String(body.coverAttachmentId):null;
  if(!name)return json({error:"Ponle un nombre al álbum."},400);
  const album=await ok(db.from("galaxy_chat_albums").insert({name,album_date:albumDate,cover_attachment_id:cover,created_by:person}).select("*").single());
  return json({album});
 }
 const id=String(body.id||"");if(!uuidish(id))return json({error:"Álbum no válido."},400);
 const album=(await ok(db.from("galaxy_chat_albums").select("id,cover_attachment_id").eq("id",id).limit(1)))?.[0];
 if(!album)return json({error:"Álbum no encontrado."},404);
 if(operation==="add"){
  const attachmentIds=(Array.isArray(body.attachmentIds)?body.attachmentIds:[]).map(String).filter(uuidish).slice(0,80);
  if(!attachmentIds.length)return json({error:"Elige fotos o videos."},400);
  const valid=await ok(db.from("galaxy_chat_attachments").select("id,kind").in("id",attachmentIds).in("kind",["photo","video"]));
  const rows=(valid||[]).map((a:any)=>({album_id:id,attachment_id:a.id,added_by:person}));
  if(rows.length){
   await ok(db.from("galaxy_chat_album_items").upsert(rows,{onConflict:"album_id,attachment_id",ignoreDuplicates:true}));
   if(!album.cover_attachment_id)await ok(db.from("galaxy_chat_albums").update({cover_attachment_id:rows[0].attachment_id,updated_at:new Date().toISOString()}).eq("id",id).is("cover_attachment_id",null));
  }
  return json({ok:true,added:rows.length});
 }
 if(operation==="remove"){
  const attachmentId=String(body.attachmentId||"");if(!uuidish(attachmentId))return json({error:"Archivo no válido."},400);
  await ok(db.from("galaxy_chat_album_items").delete().eq("album_id",id).eq("attachment_id",attachmentId));
  return json({ok:true});
 }
 if(operation==="delete"){await ok(db.from("galaxy_chat_albums").delete().eq("id",id));return json({ok:true});}
 return json({error:"Operación de álbum no válida."},400);
}

async function chatStickers(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"list");
 if(operation==="list"){
  const [stickers,favorites,recents]=await Promise.all([
   ok(db.from("galaxy_chat_stickers").select("*").order("created_at",{ascending:false}).limit(400)),
   ok(db.from("galaxy_chat_sticker_favorites").select("sticker_id").eq("person",person).limit(400)),
   ok(db.from("galaxy_chat_sticker_recents").select("sticker_id,last_used_at").eq("person",person).order("last_used_at",{ascending:false}).limit(80))
  ]);
  const fav=new Set((favorites||[]).map((x:any)=>String(x.sticker_id))),recentMap=new Map((recents||[]).map((x:any)=>[String(x.sticker_id),x.last_used_at]));
  const hydrated=await Promise.all((stickers||[]).map(async(x:any)=>({id:x.id,name:x.name,url:await signed(String(x.bucket),String(x.path),1800),favorite:fav.has(String(x.id)),lastUsedAt:recentMap.get(String(x.id))||null,createdBy:x.created_by})));
  hydrated.sort((a:any,b:any)=>Number(!!b.favorite)-Number(!!a.favorite)||String(b.lastUsedAt||"").localeCompare(String(a.lastUsedAt||""))||String(b.id).localeCompare(String(a.id)));
  return json({stickers:hydrated});
 }
 if(operation==="create"){
  const attachmentId=String(body.attachmentId||""),name=text(body.name||"Sticker",80)||"Sticker";
  const a=(await ok(db.from("galaxy_chat_attachments").select("id,kind,bucket,path,mime").eq("id",attachmentId).limit(1)))?.[0];
  if(!a||!["photo"].includes(String(a.kind))||!String(a.mime||"").startsWith("image/"))return json({error:"Elige una imagen del chat."},400);
  const sticker=await ok(db.from("galaxy_chat_stickers").upsert({created_by:person,bucket:a.bucket,path:a.path,name},{onConflict:"bucket,path"}).select("*").single());
  return json({sticker:{...sticker,url:await signed(String(sticker.bucket),String(sticker.path),1800)}});
 }
 const id=String(body.id||"");if(!uuidish(id))return json({error:"Sticker no válido."},400);
 const exists=(await ok(db.from("galaxy_chat_stickers").select("id,created_by").eq("id",id).limit(1)))?.[0];
 if(!exists)return json({error:"Sticker no encontrado."},404);
 if(operation==="favorite"){
  if(body.favorite===false)await ok(db.from("galaxy_chat_sticker_favorites").delete().eq("sticker_id",id).eq("person",person));
  else await ok(db.from("galaxy_chat_sticker_favorites").upsert({sticker_id:id,person,saved_at:new Date().toISOString()},{onConflict:"sticker_id,person"}));
  return json({ok:true});
 }
 if(operation==="used"){
  await ok(db.from("galaxy_chat_sticker_recents").upsert({sticker_id:id,person,last_used_at:new Date().toISOString()},{onConflict:"sticker_id,person"}));
  return json({ok:true});
 }
 if(operation==="delete"){
  if(String(exists.created_by)!==person)return json({error:"Solo puedes borrar stickers creados por ti."},403);
  await ok(db.from("galaxy_chat_stickers").delete().eq("id",id));
  return json({ok:true});
 }
 return json({error:"Operación de sticker no válida."},400);
}

async function chatLiveLocation(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"state");
 if(operation==="start"){
  const duration=body.durationSeconds==null?null:Number(body.durationSeconds);
  if(duration!==null&&![900,3600,28800].includes(duration))return json({error:"Duración de ubicación no válida."},400);
  const loc=(await ok(db.from("galaxy_locations").select("sharing,latitude,longitude,accuracy,updated_at").eq("person",person).limit(1)))?.[0];
  if(!loc?.sharing||!Number.isFinite(Number(loc.latitude))||!Number.isFinite(Number(loc.longitude)))return json({error:"Activa Compartir ubicación para iniciar una ubicación en vivo."},409);
  const now=new Date(),endsAt=duration?new Date(now.getTime()+duration*1000).toISOString():null;
  await ok(db.from("galaxy_chat_live_locations").update({stopped_at:now.toISOString()}).eq("sender_person",person).is("stopped_at",null));
  const session=await ok(db.from("galaxy_chat_live_locations").insert({sender_person:person,duration_seconds:duration,started_at:now.toISOString(),ends_at:endsAt}).select("*").single());
  return json({session,latitude:Number(loc.latitude),longitude:Number(loc.longitude),accuracy:Number(loc.accuracy||0)});
 }
 if(operation==="stop"){
  const id=String(body.id||"");let q:any=db.from("galaxy_chat_live_locations").update({stopped_at:new Date().toISOString()}).eq("sender_person",person).is("stopped_at",null);
  if(uuidish(id))q=q.eq("id",id);
  await ok(q);
  return json({ok:true});
 }
 const id=String(body.id||"");
 let q:any=db.from("galaxy_chat_live_locations").select("*").order("started_at",{ascending:false}).limit(1);
 if(uuidish(id))q=q.eq("id",id);else q=q.eq("sender_person",person);
 const session=(await ok(q))?.[0]||null;
 if(!session)return json({session:null});
 const active=!session.stopped_at&&(!session.ends_at||Date.parse(String(session.ends_at))>Date.now());
 const loc=(await ok(db.from("galaxy_locations").select("sharing,latitude,longitude,accuracy,updated_at").eq("person",String(session.sender_person)).limit(1)))?.[0];
 return json({session:{...session,active},location:active&&loc?.sharing?loc:null});
}

async function chatGifImport(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),raw=text(body.url,1200),title=text(body.title||"GIF",120)||"GIF";
 const u=chatPublicUrl(raw);if(!u||!(u.hostname==="giphy.com"||u.hostname.endsWith(".giphy.com")))return json({error:"GIF no válido."},400);
 let response:Response;
 try{response=await fetch(u,{redirect:"error",signal:AbortSignal.timeout(12000),headers:{accept:"image/gif,image/webp"}});}catch{return json({error:"No se pudo descargar el GIF."},503);}
 if(!response.ok)return json({error:"No se pudo descargar el GIF."},503);
 const mime=String(response.headers.get("content-type")||"").split(";")[0].toLowerCase();
 if(!["image/gif","image/webp"].includes(mime))return json({error:"Formato GIF no permitido."},415);
 const declared=Number(response.headers.get("content-length")||0);if(declared>10*1024*1024)return json({error:"El GIF supera 10 MB."},413);
 const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length<1||bytes.length>10*1024*1024)return json({error:"El GIF supera 10 MB."},413);
 const ext=mime==="image/gif"?"gif":"webp",path=person+"/gif-"+crypto.randomUUID()+"."+ext;
 const {error}=await db.storage.from("galaxy-chat-media").upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"3600",metadata:{originalName:title+"."+ext,provider:"giphy"}});
 if(error)throw error;
 return json({item:{kind:"photo",path,bucket:"galaxy-chat-media",mime,name:title+"."+ext,size:bytes.length,url:await signed("galaxy-chat-media",path,1800),gif:true}});
}

async function chatMetric(req:Request,body:any={}){
 await device(req);
 const allowed=new Set(["queued","sending","sent","delivered","read","failed","retry","realtime_connected","realtime_fallback"]);
 const event=String(body.event||"");if(!allowed.has(event))return json({error:"Métrica no válida."},400);
 const id=uuidish(String(body.messageId||""))?String(body.messageId):null;
 await ok(db.from("galaxy_chat_metrics").insert({
  message_id:id,event,
  send_latency_ms:Number.isFinite(Number(body.sendLatencyMs))?Math.max(0,Math.round(Number(body.sendLatencyMs))):null,
  server_latency_ms:Number.isFinite(Number(body.serverLatencyMs))?Math.max(0,Math.round(Number(body.serverLatencyMs))):null,
  delivery_latency_ms:Number.isFinite(Number(body.deliveryLatencyMs))?Math.max(0,Math.round(Number(body.deliveryLatencyMs))):null,
  retry_count:clampInt(body.retryCount,0,100,0),failure_code:text(body.failureCode||"",80)||null
 }));
 return json({ok:true});
}

async function notificationsList(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),limit=clampInt(body.limit,20,100,60);
 const rows=await ok(db.from("galaxy_notifications").select("*").eq("target_person",person).order("created_at",{ascending:false}).limit(limit));
 const summary=await notificationSummary(person);
 return json({notifications:rows||[],unread:summary.unread});
}
async function notificationsRead(req:Request,body:any={}){
 const d=await device(req),person=String(d.person),now=new Date().toISOString();
 if(body.id)await ok(db.from("galaxy_notifications").update({read_at:now}).eq("id",String(body.id)).eq("target_person",person));
 else await ok(db.from("galaxy_notifications").update({read_at:now}).eq("target_person",person).is("read_at",null));
 return json({ok:true,...await notificationSummary(person)});
}

async function bondGestureCatalog(req:Request){
 await device(req);
 const custom=await ok(db.from("galaxy_bond_gestures").select("*").eq("enabled",true).order("created_at",{ascending:true}).limit(50));
 return json({builtins:BUILTIN_GESTURES,custom:custom||[]});
}
async function bondGestureSave(req:Request,body:any){
 const d=await device(req);
 let value;try{value=normalizeCustomGesture(body.gesture||body);}catch(e){return json({error:e instanceof Error?e.message:"Gesto no válido."},400);}
 if(body.id){
  const row=(await ok(db.from("galaxy_bond_gestures").select("*").eq("id",String(body.id)).limit(1)))?.[0];
  if(!row)return json({error:"El gesto ya no existe."},404);
  if(String(row.created_by)!==String(d.person))return json({error:"Solo quien creó este gesto puede editarlo."},403);
  if(Number(body.version)!==Number(row.version))return json({error:"Este gesto cambió en otro dispositivo."},409);
  const updated=await ok(db.from("galaxy_bond_gestures").update({...value}).eq("id",row.id).eq("version",row.version).select("*").single());
  return json({gesture:updated});
 }
 const created=await ok(db.from("galaxy_bond_gestures").insert({...value,created_by:String(d.person)}).select("*").single());
 return json({gesture:created},201);
}
async function bondGestureDelete(req:Request,body:any){
 const d=await device(req),row=(await ok(db.from("galaxy_bond_gestures").select("*").eq("id",String(body.id||"")).limit(1)))?.[0];
 if(!row)return json({ok:true});
 if(String(row.created_by)!==String(d.person))return json({error:"Solo quien creó este gesto puede eliminarlo."},403);
 if(Number(body.version)!==Number(row.version))return json({error:"Este gesto cambió en otro dispositivo."},409);
 await ok(db.from("galaxy_bond_gestures").delete().eq("id",row.id).eq("version",row.version));
 return json({ok:true});
}
async function bondSendGesture(req:Request,body:any){
 const d=await device(req),person=String(d.person),id=String(body.gestureId||body.gesture||"");
 const builtin=resolveGesture(id,[]);
 if(!builtin&&!uuidish(id))return json({error:"Gesto no válido."},400);
 const custom=builtin?[]:await ok(db.from("galaxy_bond_gestures").select("*").eq("enabled",true).limit(50));
 const definition=builtin||resolveGesture(id,custom||[]);
 if(!definition)return json({error:"Gesto no válido."},400);
 const recent=await ok(db.from("galaxy_bond").select("id").eq("author",person).eq("type","gesture").gt("created",new Date(Date.now()-60000).toISOString()).limit(20));
 if((recent?.length||0)>=20)return json({error:"Espera un momento antes de enviar otro gesto"},429);
 const snapshot=gestureSnapshot(definition);
 const row=await ok(db.from("galaxy_bond").insert({type:"gesture",author:person,data:{gesture:snapshot.gestureId,...snapshot}}).select("*").single());
 await recordParticipation(person);
 const target=person==="0"?"1":"0";
 const push=await dispatchPushEvent(d,target,"gesture",{
  title:"Un gesto para ti",body:snapshot.text,icon:snapshot.icon,behavior:snapshot.behavior,gestureId:String(row.id)
 });
 return json({entry:row,push},201);
}

async function bondState(person:string){
  const [entries,participation,config,customGestures,transcripts]=await Promise.all([
    ok(db.from("galaxy_bond").select("*").order("created",{ascending:false}).limit(200)),
    ok(db.from("galaxy_bond_participation").select("day,person")),
    ok(db.from("galaxy_bond_config").select("photo_path").eq("id",1).maybeSingle()),
    ok(db.from("galaxy_bond_gestures").select("*").eq("enabled",true).order("created_at",{ascending:true}).limit(50)),
    ok(db.from("galaxy_voice_transcripts").select("bond_id,transcript,segments,created_at,updated_at").limit(200))
  ]);
  const transcriptMap=new Map((transcripts||[]).map((row:any)=>[String(row.bond_id),row]));
  const progress=computeBondProgress(participation||[],new Date());
  const visible=await Promise.all((entries||[]).map(async(row:any)=>{
    const copy=structuredClone(row);
    if(copy.type==="game"&&copy.author!==person&&!Object.hasOwn(copy.data||{},"guess"))delete copy.data.answer;
    if(copy.type==="voice"&&copy.data?.audioPath){
      let reveal=true;
      const ref=copy.data?.referenceId;
      if(ref){
        const target=(await ok(db.from("galaxy_items").select("kind,data,author").eq("id",String(ref)).limit(1)))?.[0];
        if(target?.kind==="capsule"){
          const locs=await ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,updated_at").eq("person",person).limit(1));
          reveal=!chatCapsuleAccess(target.data||{},person,locs||[]).locked;
        }else if(target&&String(target.author)!==person&&target.kind==="note"&&target.data?.surprise){
          if(target.data.unlockType==="date"&&target.data.unlockDate>today())reveal=false;
          if(target.data.unlockType==="place"){
            const loc=(await ok(db.from("galaxy_locations").select("*").eq("person",person).limit(1)))?.[0];
            reveal=!!loc?.sharing&&meters(Number(loc.latitude),Number(loc.longitude),Number(target.data.latitude),Number(target.data.longitude))<=Number(target.data.radius||150);
          }
        }
      }
      if(reveal){
        copy.data.audioUrl=await signed("galaxy-voice",copy.data.audioPath,900);
        const transcript:any=transcriptMap.get(String(copy.id));
        if(transcript)copy.data.transcript={text:transcript.transcript,segments:transcript.segments||[],createdAt:transcript.created_at,updatedAt:transcript.updated_at};
      }else{delete copy.data.audioPath;delete copy.data.transcript;copy.data.locked=true;}
    }
    return copy;
  }));
  return {entries:visible,garden:{...progress.garden,currentStreak:progress.currentStreak,recordStreak:progress.recordStreak},currentStreak:progress.currentStreak,recordStreak:progress.recordStreak,totalDays:progress.totalDays,gestures:{builtins:BUILTIN_GESTURES,custom:customGestures||[]},widget:{photoPath:config?.photo_path||""}};
}

function maskedDaily(rows:any[],person:string){
  const byDay=new Map<string,any[]>();
  for(const row of rows||[]){if(!byDay.has(row.day))byDay.set(row.day,[]);byDay.get(row.day)!.push({...row});}
  const out:any[]=[];
  for(const [day,list] of byDay){
    const both=list.filter(x=>text(x.answer,3000)).length===2;
    for(const row of list){
      const answered=!!text(row.answer,3000);
      row.answered=answered;
      if(row.person!==person&&!both)row.answer=null;
      out.push(row);
    }
  }
  return out.sort((a,b)=>String(b.day).localeCompare(String(a.day)));
}

async function mobileState(req:Request){
  const d=await device(req),person=String(d.person);
  const [settings,items,daily,locations,bond,places,presence]=await Promise.all([
    ok(db.from("galaxy_settings").select("id,data,version").eq("id",1).single()),
    ok(db.from("galaxy_items").select("*").order("created",{ascending:false}).limit(500)),
    ok(db.from("galaxy_daily").select("day,person,mood,answer").order("day",{ascending:false}).limit(120)),
    ok(db.from("galaxy_locations").select("*").order("person")),
    bondState(person),
    ok(db.from("galaxy_places").select("*").order("created_at",{ascending:false}).limit(100)),
    ok(db.from("galaxy_presence").select("*").order("person"))
  ]);
  const day=today();
  const safeItems=await Promise.all((items||[]).map(async(row:any)=>{
    const copy=structuredClone(row),data=copy.data||{};
    if(copy.kind==="capsule"){
      const access=chatCapsuleAccess(data,person,locations||[]);
      if(access.locked)copy.data={title:text(data.title||"Cápsula cerrada",160)||"Cápsula cerrada",date:access.unlockType==="date"&&validDate(data.date)?data.date:"",unlockDate:access.unlockType==="date"&&validDate(data.unlockDate)?data.unlockDate:"",unlockTime:access.unlockType==="date"&&/^\d{2}:\d{2}$/.test(String(data.unlockTime||""))?String(data.unlockTime):"",unlockAt:access.unlockAt,unlockType:access.unlockType,locked:true};
      else{
        if(data.photoPath)try{copy.data.photoUrl=await signed("galaxy-photos",String(data.photoPath),900);}catch{}
        if(data.audioPath)try{copy.data.audioUrl=await signed("galaxy-voice",String(data.audioPath),900);}catch{}
        if(data.songId){
          const song=(items||[]).find((x:any)=>x.kind==="song"&&String(x.id)===String(data.songId));
          if(song)copy.data.song={id:String(song.id),title:text(song.data?.title||"Canción",160),artist:text(song.data?.artist||"",160),source:text(song.data?.source||"",80),url:/^https:\/\//i.test(String(song.data?.url||""))?String(song.data.url):""};
        }
      }
    }
    if(copy.kind==="note"&&data.surprise&&String(copy.author)!==person){
      let unlocked=data.unlockType!=="date"||!data.unlockDate||data.unlockDate<=day;
      if(data.unlockType==="place"){
        const own=(locations||[]).find((x:any)=>String(x.person)===person&&x.sharing);
        unlocked=!!own&&meters(Number(own.latitude),Number(own.longitude),Number(data.latitude),Number(data.longitude))<=Number(data.radius||150);
      }
      if(!unlocked)copy.data={title:"Sorpresa guardada",surprise:true,unlockType:data.unlockType,unlockDate:data.unlockType==="date"?data.unlockDate:"",placeName:data.unlockType==="place"?text(data.placeName,80):"",locked:true};
    }
    return copy;
  }));
  const albumMemoryItems=safeItems.filter((row:any)=>row.kind==="memory"&&row.data?.source?.type==="chat-album"&&Array.isArray(row.data?.source?.attachmentIds));
  const albumAttachmentIds=[...new Set(albumMemoryItems.flatMap((row:any)=>row.data.source.attachmentIds.map((id:any)=>String(id)).filter(uuidish)))].slice(0,120);
  if(albumAttachmentIds.length){
    const attachments=await ok(db.from("galaxy_chat_attachments").select("id,bucket,path,kind,mime,name").in("id",albumAttachmentIds).limit(120));
    const mediaMap=new Map<string,any>();
    for(const attachment of attachments||[]){
      if(!["photo","video"].includes(String(attachment.kind)))continue;
      try{
        mediaMap.set(String(attachment.id),{
          id:String(attachment.id),kind:String(attachment.kind),mime:text(attachment.mime||"",100),
          name:text(attachment.name||"",180),url:await signed(String(attachment.bucket||"galaxy-chat-media"),String(attachment.path),900)
        });
      }catch{}
    }
    for(const row of albumMemoryItems){
      const media=(row.data.source.attachmentIds||[]).map((id:any)=>mediaMap.get(String(id))).filter(Boolean).slice(0,12);
      if(media.length)row.data.sourceMedia=media;
    }
  }
  const safePresence=(presence||[]).map((row:any)=>{
    if(String(row.person)===person)return row;
    return {
      person:String(row.person),share_battery:!!row.share_battery,share_song:!!row.share_song,updated_at:row.updated_at,
      battery:row.share_battery?row.battery:null,song_title:row.share_song?row.song_title:null
    };
  });
  let devicesQuery=db.from("galaxy_devices").select("id,person,name,created_at,last_seen_at").is("revoked_at",null).order("created_at",{ascending:false}).limit(30);
  if(person!=="0")devicesQuery=devicesQuery.eq("person",person);
  const devices=await ok(devicesQuery);
  const [chat,notifications]=await Promise.all([chatSummary(person),notificationSummary(person)]);
  return json({
    person,device:{id:d.id,name:d.name},today:day,settings,items:safeItems,daily:maskedDaily(daily||[],person),
    bond,locations:privacyVisibleLocations(locations||[],person),places,presence:safePresence,devices,chat,notifications,nextEvent:nextCalendarEvent(safeItems.filter((i:any)=>i.kind==="event"),day),
    capabilities:{photos:true,music:true,voice:true,widget:true,backgroundLocation:true,trips:true,backup:true,presence:true,profileManagement:true,intelligence:true,transcription:true,book:true,chat:true,notifications:true}
  });
}


function intelligenceVisible(row:any,person:string,day=today()){
 if(!row||row.searchable===false)return false;
 if(row.owner_person&&String(row.owner_person)!==String(person)){
  if(!row.visible_after||String(row.visible_after)>day)return false;
 }
 return true;
}
function minimalContext(rows:any[]){
 return (rows||[]).slice(0,10).map((row:any,index:number)=>({
  ref:"S"+(index+1),sourceType:String(row.source_type||row.sourceType||""),sourceId:String(row.source_id||row.sourceId||""),
  title:text(row.title||"Momento",180),date:row.occurred_on||row.occurredOn||null,
  snippet:text(row.content||"",900)
 }));
}
async function intelligenceUsage(person:string,operation:"ask"|"narrate"|"transcribe",limit:number){
 const day=today(),row=(await ok(db.from("galaxy_intelligence_usage").select("*").eq("day",day).eq("person",person).eq("operation",operation).limit(1)))?.[0];
 const count=Number(row?.count)||0;
 if(count>=limit)throw new Error("Límite diario de IA alcanzado. Intenta mañana.");
 await ok(db.from("galaxy_intelligence_usage").upsert({day,person,operation,count:count+1,updated_at:new Date().toISOString()},{onConflict:"day,person,operation"}));
 return count+1;
}
async function syncIntelligenceDocument(doc:any){
 if(!doc?.sourceType||!doc?.sourceId)return {status:"ignored"};
 if(doc.searchable===false||(!text(doc.title,500)&&!text(doc.content,20000))){
  await ok(db.from("galaxy_intelligence_documents").delete().eq("source_type",String(doc.sourceType)).eq("source_id",String(doc.sourceId)));
  return {status:"deleted"};
 }
 const hash=await sha(contentHashInput(doc));
 const existing=(await ok(db.from("galaxy_intelligence_documents").select("id,content_hash,embedding_status").eq("source_type",String(doc.sourceType)).eq("source_id",String(doc.sourceId)).limit(1)))?.[0];
 if(existing&&existing.content_hash===hash&&existing.embedding_status==="ready")return {status:"unchanged",id:existing.id};
 const base={
  source_type:String(doc.sourceType),source_id:String(doc.sourceId),source_version:text(doc.sourceVersion||"",160),
  title:text(doc.title,500),content:text(doc.content,20000),occurred_on:doc.occurredOn||null,
  metadata:doc.metadata&&typeof doc.metadata==="object"?doc.metadata:{},
  owner_person:["0","1"].includes(String(doc.ownerPerson))?String(doc.ownerPerson):null,
  visible_after:doc.visibleAfter||null,searchable:doc.searchable!==false,
  content_hash:hash,embedding:null,embedding_model:INTELLIGENCE_EMBEDDING_MODEL,embedding_status:"pending",embedding_error:null,updated_at:new Date().toISOString()
 };
 const saved=await ok(db.from("galaxy_intelligence_documents").upsert(base,{onConflict:"source_type,source_id"}).select("id").single());
 try{
  const vector=await gteSmallEmbedding((base.title+"\n"+base.content).slice(0,12000));
  if(!vector)throw new Error("embedding-error: contenido vacío");
  await ok(db.from("galaxy_intelligence_documents").update({embedding:vector,embedding_status:"ready",embedding_error:null,updated_at:new Date().toISOString()}).eq("id",saved.id).eq("content_hash",hash));
  return {status:"ready",id:saved.id};
 }catch(error){
  const message=text(error instanceof Error?error.message:"embedding-error",300);
  await ok(db.from("galaxy_intelligence_documents").update({embedding:null,embedding_status:"error",embedding_error:message,updated_at:new Date().toISOString()}).eq("id",saved.id).eq("content_hash",hash));
  return {status:"embedding-error",id:saved.id,fallback:true};
 }
}
async function reconcileIntelligenceCleanup(){
 try{return await ok(db.rpc("galaxy_intelligence_reconcile_cleanup",{batch_size:100}));}
 catch(error){console.warn("intelligence-cleanup","reconcile",error instanceof Error?error.message:"error");return null;}
}
async function deleteIntelligenceSource(type:string,id:string){
 const sourceId=String(id||"");if(!sourceId)return;
 if(type!=="item"){
  await ok(db.from("galaxy_intelligence_cleanup_queue").upsert({source_type:type,source_id:sourceId,requested_at:new Date().toISOString(),attempts:0,last_error:null},{onConflict:"source_type,source_id"}));
 }
 await reconcileIntelligenceCleanup();
}
async function syncIntelligenceItem(row:any){if(row)await syncIntelligenceDocument(buildIntelligenceDocument("item",row,{today:today(),now:new Date().toISOString()}));}
async function syncIntelligencePlace(row:any){if(row)await syncIntelligenceDocument(buildIntelligenceDocument("place",row,{today:today()}));}
async function syncIntelligenceTrip(row:any){if(row)await syncIntelligenceDocument(buildIntelligenceDocument("trip",row,{today:today()}));}
async function syncIntelligenceGoal(idOrRow:any){
 let goal=typeof idOrRow==="object"?idOrRow:(await ok(db.from("galaxy_goals").select("*").eq("id",String(idOrRow)).limit(1)))?.[0];
 if(!goal)return;
 const steps=await ok(db.from("galaxy_goal_steps").select("title,completed_at,position").eq("goal_id",goal.id).order("position"));
 goal={...goal,description:[goal.description,...(steps||[]).map((s:any)=>text(s.title,300))].filter(Boolean).join(" · ")};
 await syncIntelligenceDocument(buildIntelligenceDocument("goal",goal,{today:today()}));
}
async function syncIntelligenceBond(row:any){
 if(!row)return;
 if(["sharednote","ritual"].includes(String(row.type)))await syncIntelligenceDocument(buildIntelligenceDocument("bond",row,{today:today()}));
}
async function syncIntelligenceDaily(day:string){
 const rows=await ok(db.from("galaxy_daily").select("day,person,answer").eq("day",day).order("person"));
 await ok(db.from("galaxy_intelligence_documents").delete().eq("source_type","answer").like("source_id",day+":%"));
 const answered=(rows||[]).filter((x:any)=>text(x.answer,3000));
 if(answered.length!==2)return;
 const question=(await ok(db.from("galaxy_daily_questions").select("question_id").eq("day",day).limit(1)))?.[0];
 for(const row of answered)await syncIntelligenceDocument(buildIntelligenceDocument("daily-answer",{...row,question_id:question?.question_id,ownerOnly:false},{today:today()}));
}
async function intelligenceVoicePrivacy(voice:any){
 const data=voice?.data||{},author=String(voice?.author||""),ref=String(data.referenceId||"");
 if(!ref)return {ownerPerson:null,visibleAfter:null,locked:false};
 const target=(await ok(db.from("galaxy_items").select("kind,data,author").eq("id",ref).limit(1)))?.[0];
 if(!target)return {ownerPerson:null,visibleAfter:null,locked:false};
 if(target.kind==="capsule"){
  const audience=intelligenceCapsuleAudience(target.data||{});
  return {ownerPerson:audience.ownerPerson,visibleAfter:null,locked:audience.locked};
 }
 if(target.kind==="note"&&target.data?.surprise){
  if(target.data.unlockType==="date")return {ownerPerson:author,visibleAfter:String(target.data.unlockDate||"")||null,locked:false};
  if(target.data.unlockType==="place")return {ownerPerson:author,visibleAfter:null,locked:false};
 }
 return {ownerPerson:null,visibleAfter:null,locked:false};
}
async function syncIntelligenceVoiceTranscript(bondId:string){
 const [voice,transcript]=await Promise.all([
  ok(db.from("galaxy_bond").select("*").eq("id",bondId).eq("type","voice").limit(1)),
  ok(db.from("galaxy_voice_transcripts").select("*").eq("bond_id",bondId).limit(1))
 ]);
 const row=voice?.[0],tr=transcript?.[0];
 if(!row||!tr){await deleteIntelligenceSource("voice-transcript",bondId);return;}
 const privacy=await intelligenceVoicePrivacy(row),data=row.data||{};
 if(privacy.locked){await deleteIntelligenceSource("voice-transcript",bondId);return;}
 await syncIntelligenceDocument(buildIntelligenceDocument("voice-transcript",{
  bondId,author:row.author,title:data.title||"Mensaje de voz",text:tr.transcript,segments:tr.segments,
  created_at:row.created,mime:data.mime,referenceId:data.referenceId,...privacy
 },{today:today()}));
}
async function syncIntelligencePhotoContext(path:string){
 const row=(await ok(db.from("galaxy_photo_context").select("*").eq("path",path).limit(1)))?.[0];
 if(!row){await deleteIntelligenceSource("photo",path);return;}
 const privacy=await intelligenceCapsuleDependencyPrivacy("galaxy-photos",path);
 if(privacy.locked){await deleteIntelligenceSource("photo",path);return;}
 await syncIntelligenceDocument(buildIntelligenceDocument("photo-context",{...row,ownerPerson:privacy.ownerPerson},{today:today()}));
}
async function reconcileIntelligenceCapsules(){
 const capsules=await ok(db.from("galaxy_items").select("*").eq("kind","capsule").limit(1000));
 for(const row of capsules||[])await syncIntelligenceItem(row);
 const voices=await ok(db.from("galaxy_bond").select("id,data").eq("type","voice").limit(500));
 for(const voice of voices||[])if(voice?.data?.referenceId)await syncIntelligenceVoiceTranscript(String(voice.id));
 const photos=await ok(db.from("galaxy_photo_context").select("path").limit(1000));
 for(const photo of photos||[])await syncIntelligencePhotoContext(String(photo.path));
}
async function classicIntelligenceFallback(person:string,query:string,limit=20){
 const q=normalizeSearchText(query);if(!q)return[];
 const rows=await ok(db.from("galaxy_intelligence_documents").select("id,source_type,source_id,title,content,occurred_on,metadata,owner_person,visible_after,searchable").limit(1000));
 return (rows||[]).filter((r:any)=>intelligenceVisible(r,person)&&normalizeSearchText((r.title||"")+" "+(r.content||"")).includes(q))
  .sort((a:any,b:any)=>String(b.occurred_on||"").localeCompare(String(a.occurred_on||""))).slice(0,limit)
  .map((r:any,index:number)=>({...r,final_score:100-index,exact_rank:index+1,fulltext_rank:null,semantic_rank:null}));
}
async function intelligenceSearchRows(person:string,query:string,limit=20){
 await reconcileIntelligenceCleanup();
 await reconcileIntelligenceCapsules();
 const q=text(query,500);if(!q)return {results:[],mode:"empty",embeddingStatus:"skipped"};
 let vector:any=null,embeddingStatus="ready";
 try{vector=await gteSmallEmbedding(q);}catch{embeddingStatus="fallback";}
 try{
  const rows=await ok(db.rpc("galaxy_intelligence_hybrid_search",{query_text:q,query_embedding:vector,query_person:person,match_count:Math.max(1,Math.min(50,limit))}));
  return {results:(rows||[]).filter((r:any)=>intelligenceVisible(r,person)),mode:vector?"hybrid":"keyword-fallback",embeddingStatus};
 }catch{
  return {results:await classicIntelligenceFallback(person,q,limit),mode:"classic-fallback",embeddingStatus:"fallback"};
 }
}
async function intelligenceSearch(req:Request,body:any){
 const d=await device(req),query=text(body.query,500),limit=Math.max(1,Math.min(40,Number(body.limit)||20));
 const result=await intelligenceSearchRows(String(d.person),query,limit);
 return json({...result,query,results:result.results.map((r:any)=>({
  id:r.id,sourceType:r.source_type,sourceId:r.source_id,title:r.title,snippet:text(r.content,500),date:r.occurred_on,
  metadata:r.metadata||{},score:Number(r.final_score)||0,exact:!!r.exact_rank,fulltext:!!r.fulltext_rank,semantic:!!r.semantic_rank
 }))});
}
function deterministicGroundedAnswer(question:string,rows:any[]){
 const plain=normalizeSearchText(question),dated=(rows||[]).filter((x:any)=>x.occurred_on).sort((a:any,b:any)=>String(b.occurred_on).localeCompare(String(a.occurred_on)));
 if(/ultima vez|cuando estuvimos|mas reciente/.test(plain)&&dated.length){
  const r=dated[0];return {title:"La coincidencia más reciente",answer:(r.title||"Momento")+" · "+r.occurred_on+".",grounded:true};
 }
 return null;
}
async function intelligenceAsk(req:Request,body:any){
 const d=await device(req),person=String(d.person),question=text(body.question,600);
 if(!question)return json({error:"Escribe una pregunta."},400);
 const search=await intelligenceSearchRows(person,question,10),rows=search.results||[],sources=minimalContext(rows);
 if(!rows.length)return json({answer:"No encontré contenido de ustedes que respalde una respuesta.",sources:[],mode:"zero-results",grounded:true});
 const deterministic=deterministicGroundedAnswer(question,rows);
 if(deterministic)return json({...deterministic,sources,mode:search.mode});
 const cfg=aiProviderConfig();
 if(!cfg.configured)return json({answer:"Encontré momentos relacionados, pero la narración de IA no está configurada. Te muestro las fuentes sin inventar una respuesta.",sources,mode:"fallback",grounded:true,providerAvailable:false});
 await intelligenceUsage(person,"ask",30);
 try{
  const context=JSON.stringify(sources);
  const answer=await generateGroundedResponse(
   "Responde en español únicamente con hechos presentes en las FUENTES. No infieras hechos nuevos. Si las fuentes no bastan, dilo. Cita las fuentes con [S1], [S2], etc. Nunca menciones coordenadas ni datos no presentes.",
   "PREGUNTA:\n"+question+"\n\nFUENTES:\n"+context,700);
  return json({answer,sources,mode:"ai-grounded",grounded:true,providerAvailable:true});
 }catch{
  return json({answer:"La IA generativa falló, así que no voy a completar huecos. Estas son las coincidencias verificables.",sources,mode:"provider-fallback",grounded:true,providerAvailable:false});
 }
}
async function intelligenceConnections(req:Request,body:any){
 const d=await device(req),person=String(d.person),sourceType=text(body.sourceType,40),sourceId=text(body.sourceId,300);
 await reconcileIntelligenceCleanup();
 await reconcileIntelligenceCapsules();
 const source=(await ok(db.from("galaxy_intelligence_documents").select("*").eq("source_type",sourceType).eq("source_id",sourceId).limit(1)))?.[0];
 if(!source||!intelligenceVisible(source,person))return json({error:"Fuente no disponible."},404);
 const related=await intelligenceSearchRows(person,(source.title+" "+source.content).slice(0,800),12);
 const rows=(related.results||[]).filter((r:any)=>String(r.id)!==String(source.id)).slice(0,8);
 return json({source:{sourceType:source.source_type,sourceId:source.source_id,title:source.title},connections:rows.map((r:any)=>({
  sourceType:r.source_type,sourceId:r.source_id,title:r.title,date:r.occurred_on,
  reasons:explainConnection({sourceType:source.source_type,title:source.title,occurredOn:source.occurred_on,metadata:source.metadata},{sourceType:r.source_type,title:r.title,occurredOn:r.occurred_on,metadata:r.metadata},Number(r.semantic_score)||0)
 }))});
}
async function intelligenceNarrate(req:Request,body:any){
 const d=await device(req),person=String(d.person),requested=Array.isArray(body.sourceIds)?body.sourceIds.map(String).slice(0,10):[];
 await reconcileIntelligenceCleanup();
 await reconcileIntelligenceCapsules();
 let query=db.from("galaxy_intelligence_documents").select("*").in("source_type",["memory","journey","trip"]).order("occurred_on",{ascending:true}).limit(10);
 if(requested.length)query=query.in("source_id",requested);
 const rows=(await ok(query)||[]).filter((r:any)=>intelligenceVisible(r,person)).slice(0,10);
 if(rows.length<5)return json({error:"Se necesitan entre 5 y 10 recuerdos disponibles para narrar un capítulo."},409);
 const cfg=aiProviderConfig(),sources=rows.map((r:any)=>({sourceId:String(r.source_id),title:text(r.title,180),date:r.occurred_on,content:text(r.content,1200)}));
 if(!cfg.configured)return json({available:false,error:"La IA narradora no está configurada.",sources});
 await intelligenceUsage(person,"narrate",10);
 try{
  const raw=await generateGroundedResponse(
   "Escribe un capítulo en español usando EXCLUSIVAMENTE las fuentes entregadas. No inventes hechos, lugares, diálogos ni emociones. Devuelve solo JSON con {title,paragraphs:[{text,sourceIds:[...]}]}. Cada párrafo debe citar al menos una fuente por su sourceId.",
   JSON.stringify({sources}),1400);
  const narrative=validateNarrative(extractJsonObject(raw),sources);
  return json({available:true,narrative,sources:sources.map((x:any)=>({sourceId:x.sourceId,title:x.title,date:x.date}))});
 }catch{
  return json({available:false,error:"La narración no pudo validarse contra las fuentes. No se guardó contenido inventado.",sources:sources.map((x:any)=>({sourceId:x.sourceId,title:x.title,date:x.date}))});
 }
}
async function intelligenceTranscriptDelete(req:Request,body:any){
 const d=await device(req),person=String(d.person),bondId=String(body.bondId||"");
 const voice=(await ok(db.from("galaxy_bond").select("id,author,type").eq("id",bondId).eq("type","voice").limit(1)))?.[0];
 if(!voice)return json({error:"Audio no encontrado."},404);
 if(String(voice.author)!==person)return json({error:"Solo quien grabó el audio puede eliminar su transcripción."},403);
 await ok(db.from("galaxy_voice_transcripts").delete().eq("bond_id",bondId));
 await deleteIntelligenceSource("voice-transcript",bondId);
 return json({ok:true,audioPreserved:true});
}
async function intelligenceTranscribe(req:Request,body:any){
 const d=await device(req),person=String(d.person),bondId=String(body.bondId||"");
 const voice=(await ok(db.from("galaxy_bond").select("*").eq("id",bondId).eq("type","voice").limit(1)))?.[0];
 if(!voice)return json({error:"Audio no encontrado."},404);
 if(String(voice.author)!==person)return json({error:"Solo quien grabó el audio puede activar su transcripción."},403);
 const path=text(voice.data?.audioPath,200),mime=text(voice.data?.mime||"audio/mp4",80);
 if(!path)return json({error:"El audio original no está disponible."},409);
 await intelligenceUsage(person,"transcribe",8);
 const {data:blob,error}=await db.storage.from("galaxy-voice").download(path);
 if(error||!blob)return json({error:"No pude abrir el audio original."},503);
 try{
  const result=await transcribeAudioBlob(blob,path.split("/").pop()||"voice.m4a",mime);
  const segments=sanitizeTranscriptSegments(result.segments);
  const saved=await ok(db.from("galaxy_voice_transcripts").upsert({bond_id:bondId,transcript:text(result.text,30000),segments,provider:result.provider,model:result.model,status:"ready",last_error:null,updated_at:new Date().toISOString()},{onConflict:"bond_id"}).select("*").single());
  await syncIntelligenceVoiceTranscript(bondId);
  return json({transcript:{bondId,text:saved.transcript,segments:saved.segments,createdAt:saved.created_at,updatedAt:saved.updated_at},audioPreserved:true});
 }catch{
  return json({error:"La transcripción falló. El audio original se conserva intacto."},503);
 }
}
async function intelligenceBook(req:Request,body:any){
 const d=await device(req),person=String(d.person);
 await reconcileIntelligenceCleanup();
 await reconcileIntelligenceCapsules();
 const rows=(await ok(db.from("galaxy_intelligence_documents").select("source_type,source_id,title,content,occurred_on,metadata,owner_person,visible_after,searchable").order("occurred_on",{ascending:true}).limit(1000))||[]).filter((r:any)=>intelligenceVisible(r,person));
 const sections=bookSections().map(section=>({id:section.id,title:section.title,items:[] as any[]}));
 const byId=Object.fromEntries(sections.map((x:any)=>[x.id,x]));
 const push=(id:string,row:any)=>byId[id]?.items.push({sourceType:row.source_type,sourceId:row.source_id,title:row.title,date:row.occurred_on,snippet:text(row.content,360)});
 for(const row of rows){
  if(row.source_type==="memory"){push("beginning",row);push("firsts",row);}
  if(["event","answer"].includes(row.source_type))push("dates",row);
  if(["journey","trip"].includes(row.source_type))push("trips",row);
  if(row.source_type==="place")push("places",row);
  if(row.source_type==="song")push("music",row);
  if(row.source_type==="photo")push("photos",row);
  if(["answer","sharednote","voice-transcript"].includes(row.source_type))push("quotes",row);
 }
 for(const s of sections)s.items=s.items.slice(0,20);
 const stats={documents:rows.length,memories:rows.filter((x:any)=>x.source_type==="memory").length,trips:rows.filter((x:any)=>["journey","trip"].includes(x.source_type)).length,places:rows.filter((x:any)=>x.source_type==="place").length,songs:rows.filter((x:any)=>x.source_type==="song").length,photos:rows.filter((x:any)=>x.source_type==="photo").length};
 byId.stats.items=[{sourceType:"stats",sourceId:"current",title:"Estadísticas de nuestra historia",date:today(),snippet:Object.entries(stats).map(([k,v])=>k+": "+v).join(" · ")}];
 byId.narrative.items=[];
 return json({title:"Libro de Nuestra Galaxia",version:1,sections,stats,narratorAvailable:aiProviderConfig().configured,pdfReadyContract:true});
}
async function intelligenceIndexAction(req:Request,body:any){
 const d=await device(req),operation=String(body.operation||"status");
 if(operation==="status"){
  const rows=await ok(db.from("galaxy_intelligence_documents").select("embedding_status"));
  const counts:any={total:0,ready:0,pending:0,error:0};for(const r of rows||[]){counts.total++;counts[r.embedding_status]=(counts[r.embedding_status]||0)+1;}
  return json({counts,embeddingModel:INTELLIGENCE_EMBEDDING_MODEL,providerConfigured:aiProviderConfig().configured});
 }
 if(operation==="photo-context-save"){
  const path=text(body.path,300),caption=text(body.caption,3000),context=text(body.context,5000),takenOn=text(body.takenOn,10);
  if(!path)return json({error:"Foto no válida."},400);
  await ok(db.from("galaxy_photo_context").upsert({path,author:String(d.person),caption:caption||null,context:context||null,taken_on:validDate(takenOn)?takenOn:null,updated_at:new Date().toISOString()},{onConflict:"path"}));
  await syncIntelligencePhotoContext(path);return json({ok:true});
 }
 if(operation==="photo-context-delete"){
  const path=text(body.path,300);await ok(db.from("galaxy_photo_context").delete().eq("path",path));await deleteIntelligenceSource("photo",path);return json({ok:true});
 }
 if(operation==="rebuild"){
  const limit=Math.max(1,Math.min(25,Number(body.limit)||15)),offset=Math.max(0,Number(body.offset)||0);
 const sources:any[]=[];
 const [items,places,trips,goals,bond,photoContexts]=await Promise.all([
  ok(db.from("galaxy_items").select("*").order("created").range(offset,offset+limit-1)),
  offset===0?ok(db.from("galaxy_places").select("*").order("created_at").limit(limit)):Promise.resolve([]),
  offset===0?ok(db.from("galaxy_trip_history").select("*").order("started_at").limit(limit)):Promise.resolve([]),
  offset===0?ok(db.from("galaxy_goals").select("*").order("created_at").limit(limit)):Promise.resolve([]),
  offset===0?ok(db.from("galaxy_bond").select("*").in("type",["sharednote","ritual"]).order("created").limit(limit)):Promise.resolve([]),
  offset===0?ok(db.from("galaxy_photo_context").select("*").order("created_at").limit(limit)):Promise.resolve([])
 ]);
 for(const row of items||[])sources.push(buildIntelligenceDocument("item",row,{today:today(),now:new Date().toISOString()}));
 for(const row of places||[])sources.push(buildIntelligenceDocument("place",row,{today:today()}));
 for(const row of trips||[])sources.push(buildIntelligenceDocument("trip",row,{today:today()}));
 for(const row of goals||[])sources.push(buildIntelligenceDocument("goal",row,{today:today()}));
 for(const row of bond||[])sources.push(buildIntelligenceDocument("bond",row,{today:today()}));
 for(const row of photoContexts||[])sources.push(buildIntelligenceDocument("photo-context",row,{today:today()}));
 let ready=0,errors=0;for(const doc of sources){const result=await syncIntelligenceDocument(doc);if(result.status==="ready"||result.status==="unchanged")ready++;if(result.status==="embedding-error")errors++;}
 if(offset===0){
  const days=await ok(db.from("galaxy_daily").select("day").not("answer","is",null).order("day",{ascending:false}).limit(120));
  for(const day of [...new Set<string>((days||[]).map((x:any)=>String(x.day)))])await syncIntelligenceDaily(day);
  const transcripts=await ok(db.from("galaxy_voice_transcripts").select("bond_id").limit(limit));for(const tr of transcripts||[])await syncIntelligenceVoiceTranscript(String(tr.bond_id));
 }
  return json({ok:true,processed:sources.length,ready,errors,nextOffset:(items||[]).length===limit?offset+limit:null});
 }
 return json({error:"Operación de índice no válida."},400);
}

async function intelligenceBestEffort(label:string,work:()=>Promise<any>){try{return await work();}catch(error){console.warn("intelligence-index",label,error instanceof Error?error.message:"error");return null;}}

function cleanItem(kind:string,data:any){
  if(!allowedKinds.has(kind))throw new Error("Tipo de contenido no válido");
  if(!data||typeof data!=="object"||Array.isArray(data)||JSON.stringify(data).length>12000)throw new Error("Contenido no válido");
  const out:any={...data};
  if("title" in out)out.title=text(out.title,160);
  if("body" in out)out.body=text(out.body,10000);
  if("category" in out)out.category=text(out.category,80);
  if("date" in out&&out.date!==""&&!validDate(out.date))throw new Error("Fecha no válida");
  if(kind==="capsule"){
    delete out.unlockedFor;
    delete out.unlocked_for;
    out.unlockType=String(out.unlockType||"date")==="place"?"place":"date";
    if(out.unlockType==="place"){
      const lat=Number(out.latitude),lon=Number(out.longitude),placeId=Number(out.placeId),radius=Math.max(50,Math.min(1000,Number(out.radius)||150));
      if(!Number.isFinite(lat)||lat < -90||lat > 90||!Number.isFinite(lon)||lon < -180||lon > 180||!Number.isInteger(placeId)||placeId<=0)throw new Error("Lugar de desbloqueo no válido");
      out.latitude=lat;out.longitude=lon;out.placeId=placeId;out.placeName=text(out.placeName||"Lugar",80)||"Lugar";out.radius=radius;
      out.unlockDate="";out.unlockTime="";delete out.unlockAt;
    }else{
      const unlockDate=String(out.unlockDate||out.date||""),unlockTime=String(out.unlockTime||"00:00");
      if(!validDate(unlockDate))throw new Error("Fecha de desbloqueo no válida");
      if(!/^\d{2}:\d{2}$/.test(unlockTime))throw new Error("Hora de desbloqueo no válida");
      const ms=out.unlockAt?Date.parse(String(out.unlockAt)):Date.parse(unlockDate+"T"+unlockTime+":00-05:00");
      if(!Number.isFinite(ms))throw new Error("Momento de desbloqueo no válido");
      out.unlockAt=new Date(ms).toISOString();out.unlockDate=unlockDate;out.unlockTime=unlockTime;
    }
  }
  if(kind==="event"&&out.time){
    out.time=String(out.time);
    if(!/^\d{2}:\d{2}$/.test(out.time))throw new Error("Hora del evento no válida");
  }
  if(kind==="capsule"){
    if(out.photoPath)out.photoPath=text(out.photoPath,400);
    if(out.audioPath){out.audioPath=text(out.audioPath,400);out.audioMime=text(out.audioMime||"audio/mp4",100);}
    if(out.songId){out.songId=String(out.songId);if(!uuidish(out.songId))throw new Error("Canción de cápsula no válida");}
  }
  if("annual" in out)out.annual=!!out.annual;
  if("done" in out)out.done=!!out.done;
  return out;
}
async function validateCapsuleReferences(data:any){
  if(data?.photoPath){
    const row=(await ok(db.schema("storage").from("objects").select("name").eq("bucket_id","galaxy-photos").eq("name",String(data.photoPath)).limit(1)))?.[0];
    if(!row)throw new Error("La foto de la cápsula ya no está disponible");
  }
  if(data?.audioPath){
    const row=(await ok(db.schema("storage").from("objects").select("name").eq("bucket_id","galaxy-voice").eq("name",String(data.audioPath)).limit(1)))?.[0];
    if(!row)throw new Error("El audio de la cápsula ya no está disponible");
  }
  if(data?.songId){
    const row=(await ok(db.from("galaxy_items").select("id").eq("id",String(data.songId)).eq("kind","song").limit(1)))?.[0];
    if(!row)throw new Error("La canción de la cápsula ya no está disponible");
  }
}

async function itemSave(req:Request,body:any){
  const d=await device(req),person=String(d.person),kind=String(body.kind||""),data=cleanItem(kind,body.data);
  if(kind==="capsule")await validateCapsuleReferences(data);
  if(body.id){
    const row=(await ok(db.from("galaxy_items").select("*").eq("id",String(body.id)).limit(1)))?.[0];
    if(!row)return json({error:"El contenido ya no existe"},404);
    if(String(row.kind)!==kind)return json({error:"No puedes cambiar el tipo de contenido."},409);
    if(String(row.kind)==="capsule"&&String(row.author)!==person)return json({error:"Solo quien creó la cápsula puede modificarla."},403);
    if(String(row.kind)==="capsule"&&Array.isArray(row.data?.unlockedFor))data.unlockedFor=row.data.unlockedFor.map(String).filter((x:string)=>x==="0"||x==="1");
    if(Number(body.version)!==Number(row.version))return json({error:"Este contenido cambió. Actualiza antes de guardar otra vez."},409);
    const updated=await ok(db.from("galaxy_items").update({data}).eq("id",row.id).eq("version",row.version).select("*").single());
    await intelligenceBestEffort("item-update",()=>syncIntelligenceItem(updated));
    return json({item:await privacyItemResponse(updated,person)});
  }
  const created=await ok(db.from("galaxy_items").insert({kind,data,author:String(d.person)}).select("*").single());
  await recordParticipation(person);
  await intelligenceBestEffort("item-create",()=>syncIntelligenceItem(created));
  if(kind==="memory"||kind==="plan"){
    const names=await profileNames(),target=person==="0"?"1":"0",name=names[Number(person)]||"Tu persona";
    await dispatchPushEvent(d,target,kind==="memory"?"memory_shared":"plan_update",{
      title:kind==="memory"?name+" guardó un recuerdo":name+" agregó un plan",
      body:text(data.title||data.body||(kind==="memory"?"Nuevo recuerdo":"Nuevo plan"),180),
      action:"memories",senderName:name,entityType:kind,entityId:String(created.id)
    });
  }
  return json({item:await privacyItemResponse(created,person)},201);
}

async function itemDelete(req:Request,body:any){
  const d=await device(req),person=String(d.person);
  const row=(await ok(db.from("galaxy_items").select("id,version,kind,author").eq("id",String(body.id||"")).limit(1)))?.[0];
  if(!row)return json({error:"El contenido ya no existe"},404);
  if(String(row.kind)==="capsule"&&String(row.author)!==person)return json({error:"Solo quien creó la cápsula puede borrarla."},403);
  if(Number(body.version)!==Number(row.version))return json({error:"Este contenido cambió. Actualiza antes de borrarlo."},409);
  await ok(db.from("galaxy_items").delete().eq("id",row.id).eq("version",row.version));
  await intelligenceBestEffort("item-delete",()=>reconcileIntelligenceCleanup());
  return json({ok:true});
}

async function settingsSave(req:Request,body:any){
  await device(req);
  const row=await ok(db.from("galaxy_settings").select("*").eq("id",1).single());
  if(Number(body.version)!==Number(row.version))return json({error:"Los ajustes cambiaron en otro dispositivo."},409);
  const old=row.data||{},names=Array.isArray(body.data?.names)?body.data.names.map((x:any)=>text(x,40)):[];
  if(names.length!==2||names.some((x:string)=>!x))return json({error:"Escribe los dos nombres."},400);
  const startDate=text(body.data?.startDate,10),albumUrl=text(body.data?.albumUrl,500);
  if(startDate&&!validDate(startDate))return json({error:"Fecha de inicio no válida."},400);
  const data={...old,names,startDate,albumUrl};
  const updated=await ok(db.from("galaxy_settings").update({data}).eq("id",1).eq("version",row.version).select("*").single());
  return json({settings:updated});
}

async function dailySave(req:Request,body:any){
  const d=await device(req),person=String(d.person),field=String(body.field||""),value=text(body.value,3000),day=today();
  const previous=(await ok(db.from("galaxy_daily").select("mood,answer").eq("day",day).eq("person",person).limit(1)))?.[0]||{};
  if(field==="mood"){
    if(!["feliz","tranquilo","cansado","sensible","abrazo"].includes(value))return json({error:"Elige una emoción válida."},400);
    await ok(db.from("galaxy_daily").upsert({day,person,mood:value},{onConflict:"day,person"}));
  }else if(field==="answer"){
    if(!value)return json({error:"Escribe una respuesta."},400);
    await ok(db.from("galaxy_daily").upsert({day,person,answer:value},{onConflict:"day,person"}));
  }else return json({error:"Campo no válido."},400);
  await recordParticipation(person);
  if(field==="answer")await intelligenceBestEffort("daily-answer",()=>syncIntelligenceDaily(day));
  if(String(previous?.[field]||"")!==value){
    const names=await profileNames(),target=person==="0"?"1":"0",name=names[Number(person)]||"Tu persona";
    if(field==="mood"){
      const labels:any={feliz:"feliz",tranquilo:"en calma",cansado:"sin energía",sensible:"sensible",abrazo:"con ganas de un abrazo"};
      await dispatchPushEvent(d,target,"mood_changed",{title:name+" actualizó cómo se siente",body:"Ahora está "+(labels[value]||value)+".",action:"home",senderName:name,entityType:"mood",entityId:day});
    }else{
      await dispatchPushEvent(d,target,"daily_answer",{title:name+" respondió la pregunta del día",body:"Hay una nueva respuesta para compartir.",action:"home",senderName:name,entityType:"daily",entityId:day});
    }
  }
  return json({ok:true});
}



async function loadGoalData(){
 const [goals,goalParticipants,goalSteps,goalLinks,goalContributions,items]=await Promise.all([
  ok(db.from("galaxy_goals").select("*").order("updated_at",{ascending:false}).limit(1000)),
  ok(db.from("galaxy_goal_participants").select("*").limit(2000)),
  ok(db.from("galaxy_goal_steps").select("*").order("position",{ascending:true}).limit(5000)),
  ok(db.from("galaxy_goal_links").select("*").order("created_at",{ascending:true}).limit(5000)),
  ok(db.from("galaxy_goal_contributions").select("*").order("contribution_date",{ascending:false}).limit(10000)),
  ok(db.from("galaxy_items").select("id,kind,data,version,author,created").order("created",{ascending:false}).limit(5000))
 ]);
 return {goals:goals||[],goalParticipants:goalParticipants||[],goalSteps:goalSteps||[],goalLinks:goalLinks||[],goalContributions:goalContributions||[],items:items||[]};
}
function goalView(goal:any,data:any){
 const id=String(goal.id),steps=(data.goalSteps||[]).filter((row:any)=>String(row.goal_id)===id).sort((a:any,b:any)=>Number(a.position)-Number(b.position));
 const contributions=(data.goalContributions||[]).filter((row:any)=>String(row.goal_id)===id).sort((a:any,b:any)=>String(b.contribution_date).localeCompare(String(a.contribution_date))||String(b.created_at).localeCompare(String(a.created_at)));
 const participants=(data.goalParticipants||[]).filter((row:any)=>String(row.goal_id)===id).map((row:any)=>String(row.person)).sort();
 const itemMap=new Map((data.items||[]).map((item:any)=>[String(item.id),item]));
 const links=(data.goalLinks||[]).filter((row:any)=>String(row.goal_id)===id).map((row:any)=>{
  const item:any=itemMap.get(String(row.item_id)),relation=String(row.relation||"");
  const expected=relation==="note"?"note":relation==="memory"?"memory":relation==="plan"||relation==="source-plan"?"plan":relation==="source-wish"?"wish":"";
  const validItem=!!item&&!!expected&&String(item.kind)===expected;
  return {...row,item:validItem?{id:item.id,kind:item.kind,title:text(item.data?.title||item.kind,160),body:text(item.data?.body||"",500)}:null};
 });
 return {...goal,participants,steps,contributions,links,...computeGoalProgress(goal,steps,contributions)};
}
function allGoalViews(data:any){return (data.goals||[]).map((goal:any)=>goalView(goal,data));}
async function currentGoal(id:string){
 const row=(await ok(db.from("galaxy_goals").select("*").eq("id",id).limit(1)))?.[0];
 return row||null;
}
async function touchGoalVersion(id:string,expectedVersion:number){
 if(!Number.isInteger(expectedVersion)||expectedVersion<1)return null;
 return await ok(db.from("galaxy_goals").update({updated_at:new Date().toISOString()}).eq("id",id).eq("version",expectedVersion).select("*").maybeSingle());
}
async function createGoalRecord(person:string,input:any,source:any=null){
 const normalized=normalizeGoalInput(input),created=await ok(db.from("galaxy_goals").insert({
  kind:normalized.kind,title:normalized.title,description:normalized.description,category:normalized.category,
  target_date:normalized.target_date,status:normalized.status,target_amount:normalized.target_amount,created_by:person
 }).select("*").single());
 try{
  await ok(db.from("galaxy_goal_participants").insert(normalized.participants.map((p:string)=>({goal_id:created.id,person:p}))));
  if(source?.itemId&&source?.relation)await ok(db.from("galaxy_goal_links").insert({goal_id:created.id,item_id:String(source.itemId),relation:String(source.relation)}));
 }catch(error){
  await ok(db.from("galaxy_goals").delete().eq("id",created.id));
  throw error;
 }
 return created;
}
async function goalResponse(id:string){
 const data=await loadGoalData(),goal=(data.goals||[]).find((row:any)=>String(row.id)===String(id));
 return goal?goalView(goal,data):null;
}
async function notifyGoalUpdate(d:any,goal:any,copy:string){
 if(!goal)return;
 const person=String(d.person),target=person==="0"?"1":"0",names=await profileNames(),name=names[Number(person)]||"Tu persona";
 await dispatchPushEvent(d,target,"goal_update",{title:name+" actualizó un objetivo",body:text(copy||goal.title||"Nuestros objetivos",180),action:"goals",senderName:name,entityType:"goal",entityId:String(goal.id)});
}
async function convertItemToGoal(req:Request,body:any){
 const d=await device(req),id=String(body.itemId||""),item=(await ok(db.from("galaxy_items").select("*").eq("id",id).limit(1)))?.[0];
 if(!item||!["plan","wish"].includes(String(item.kind)))return json({error:"Solo un plan o deseo puede convertirse en objetivo."},400);
 const keepOriginal=body.keepOriginal!==false,draft=conversionDraft(item,{keepOriginal,participants:Array.isArray(body.participants)?body.participants:["0","1"]});
 const normalized={...draft,...(body.goal&&typeof body.goal==="object"?body.goal:{}),participants:draft.participants,kind:String(body.goal?.kind||draft.kind)};
 const goal=await createGoalRecord(String(d.person),normalized,{itemId:item.id,relation:item.kind==="plan"?"source-plan":"source-wish"});
 if(!keepOriginal){await ok(db.from("galaxy_items").delete().eq("id",item.id));await intelligenceBestEffort("converted-item-delete",()=>deleteIntelligenceSource("item",String(item.id)));}
 await recordParticipation(String(d.person));
 await intelligenceBestEffort("goal-convert",()=>syncIntelligenceGoal(goal));
 return json({goal:await goalResponse(String(goal.id)),sourcePreserved:keepOriginal},201);
}
async function goalsEngine(req:Request,body:any){
 const d=await device(req),person=String(d.person),operation=String(body.operation||"list");
 if(operation==="list"){
  const data=await loadGoalData();
  return json({goals:allGoalViews(data)});
 }
 if(operation==="create"){
  const goal=await createGoalRecord(person,body.goal||body);
  await recordParticipation(person);
  await intelligenceBestEffort("goal-create",()=>syncIntelligenceGoal(goal));
  await notifyGoalUpdate(d,goal,"Nuevo objetivo: "+String(goal.title||""));
  return json({goal:await goalResponse(String(goal.id))},201);
 }
 if(operation==="convert-item")return await convertItemToGoal(req,body);
 const id=String(body.goalId||body.id||"");
 const existing=await currentGoal(id);
 if(!existing)return json({error:"El objetivo ya no existe."},404);
 const expectedVersion=Number(body.expectedVersion);
 if(operation==="update"){
  let normalized;try{normalized=normalizeGoalInput({...existing,...(body.goal||{}),participants:Array.isArray(body.goal?.participants)?body.goal.participants:body.participants});}catch(e){return json({error:e instanceof Error?e.message:"Objetivo no válido."},400);}
  const updated=await ok(db.from("galaxy_goals").update({
   kind:normalized.kind,title:normalized.title,description:normalized.description,category:normalized.category,
   target_date:normalized.target_date,status:normalized.status,target_amount:normalized.target_amount
  }).eq("id",id).eq("version",expectedVersion).select("*").maybeSingle());
  if(!updated)return json({error:"Este objetivo cambió en otro dispositivo. Actualiza antes de guardar."},409);
  await ok(db.from("galaxy_goal_participants").delete().eq("goal_id",id));
  await ok(db.from("galaxy_goal_participants").insert(normalized.participants.map((p:string)=>({goal_id:id,person:p}))));
  await recordParticipation(person);
  await intelligenceBestEffort("goal-update",()=>syncIntelligenceGoal(updated));
  await notifyGoalUpdate(d,updated,"Actualizó "+String(updated.title||"un objetivo")+".");
  return json({goal:await goalResponse(id)});
 }
 if(operation==="delete"){
  const removed=await ok(db.from("galaxy_goals").delete().eq("id",id).eq("version",expectedVersion).select("id").maybeSingle());
  if(!removed)return json({error:"Este objetivo cambió en otro dispositivo. Actualiza antes de eliminar."},409);
  await intelligenceBestEffort("goal-delete",()=>deleteIntelligenceSource("goal",id));
  return json({ok:true});
 }
 if(operation==="step-add"){
  const title=text(body.title,300);if(!title)return json({error:"Escribe el paso."},400);
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  const rows=await ok(db.from("galaxy_goal_steps").select("position").eq("goal_id",id).order("position",{ascending:false}).limit(1));
  const position=(rows?.length?Number(rows[0].position)+1:0);
  await ok(db.from("galaxy_goal_steps").insert({goal_id:id,title,position}));
  await recordParticipation(person);await intelligenceBestEffort("goal-step-add",()=>syncIntelligenceGoal(id));return json({goal:await goalResponse(id)});
 }
 if(operation==="step-toggle"){
  const stepId=String(body.stepId||""),step=(await ok(db.from("galaxy_goal_steps").select("*").eq("id",stepId).eq("goal_id",id).limit(1)))?.[0];
  if(!step)return json({error:"El paso ya no existe."},404);
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  const complete=body.completed!==false;
  await ok(db.from("galaxy_goal_steps").update({completed_at:complete?new Date().toISOString():null,completed_by:complete?person:null}).eq("id",stepId).eq("goal_id",id));
  await recordParticipation(person);await intelligenceBestEffort("goal-step-toggle",()=>syncIntelligenceGoal(id));
  if(complete)await notifyGoalUpdate(d,existing,"Completó un paso de "+String(existing.title||"un objetivo")+".");
  return json({goal:await goalResponse(id)});
 }
 if(operation==="step-reorder"){
  const rows=await ok(db.from("galaxy_goal_steps").select("*").eq("goal_id",id).order("position"));
  let ordered:string[];try{ordered=reorderStepIds(rows||[],body.stepIds||[]);}catch(e){return json({error:e instanceof Error?e.message:"Orden no válido."},400);}
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  for(let position=0;position<ordered.length;position++)await ok(db.from("galaxy_goal_steps").update({position}).eq("id",ordered[position]).eq("goal_id",id));
  await intelligenceBestEffort("goal-step-reorder",()=>syncIntelligenceGoal(id));
  return json({goal:await goalResponse(id)});
 }
 if(operation==="contribution-add"){
  if(existing.kind!=="savings")return json({error:"Los aportes manuales solo aplican a metas de ahorro."},400);
  let contribution;try{contribution=normalizeContribution(body.contribution||body,person);}catch(e){return json({error:e instanceof Error?e.message:"Aporte no válido."},400);}
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  await ok(db.from("galaxy_goal_contributions").insert({goal_id:id,...contribution}));
  await recordParticipation(person);
  await notifyGoalUpdate(d,existing,"Registró un aporte en "+String(existing.title||"una meta de ahorro")+".");
  return json({goal:await goalResponse(id)});
 }
 if(operation==="contribution-delete"){
  if(existing.kind!=="savings")return json({error:"Este objetivo no es una meta de ahorro."},400);
  const contributionId=String(body.contributionId||""),row=(await ok(db.from("galaxy_goal_contributions").select("id").eq("id",contributionId).eq("goal_id",id).limit(1)))?.[0];
  if(!row)return json({error:"El aporte ya no existe."},404);
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  await ok(db.from("galaxy_goal_contributions").delete().eq("id",contributionId).eq("goal_id",id));
  return json({goal:await goalResponse(id)});
 }
 if(operation==="link-add"){
  const itemId=String(body.itemId||""),relation=String(body.relation||""),item=(await ok(db.from("galaxy_items").select("id,kind").eq("id",itemId).limit(1)))?.[0];
  const expectedKind=relation==="note"?"note":relation==="memory"?"memory":relation==="plan"?"plan":"";
  if(!item||!expectedKind||item.kind!==expectedKind)return json({error:"El contenido relacionado no coincide con el tipo elegido."},400);
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  await ok(db.from("galaxy_goal_links").upsert({goal_id:id,item_id:itemId,relation},{onConflict:"goal_id,item_id,relation",ignoreDuplicates:true}));
  return json({goal:await goalResponse(id)});
 }
 if(operation==="link-delete"){
  const linkId=String(body.linkId||""),row=(await ok(db.from("galaxy_goal_links").select("id").eq("id",linkId).eq("goal_id",id).limit(1)))?.[0];
  if(!row)return json({error:"La relación ya no existe."},404);
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  await ok(db.from("galaxy_goal_links").delete().eq("id",linkId).eq("goal_id",id));
  return json({goal:await goalResponse(id)});
 }
 return json({error:"Operación de Goals Engine no válida."},400);
}

function datePlanView(row:any){
 const data=row?.data||{};
 return {
  id:String(row?.id||""),title:text(data.title||"Plan",160),body:text(data.body||"",1200),
  category:text(data.category||"",80),planCategory:normalizePlanCategory(data),done:data.done===true,
  budget:Number.isFinite(Number(data.budget))?Math.max(0,Number(data.budget)):0,
  minutes:Number.isFinite(Number(data.minutes))?Math.max(15,Number(data.minutes)):120,
  where:data.where==="casa"?"casa":"salir",placeId:data.placeId??null
 };
}
function dateQuestionContextKind(context:any){
 const start=String(context?.startDate||""),day=String(context?.today||"");
 if(start&&day&&start.slice(8,10)===day.slice(8,10))return "anniversary";
 if((context?.journeys||[]).length)return "travel";
 if((context?.memories||[]).length)return "memory";
 return "daily";
}
async function goalSuggestionsForDate(){
 const [goals,steps,contributions]=await Promise.all([
  ok(db.from("galaxy_goals").select("*").in("status",["active","paused"]).limit(500)),
  ok(db.from("galaxy_goal_steps").select("*").limit(3000)),
  ok(db.from("galaxy_goal_contributions").select("*").limit(5000))
 ]);
 const views=(goals||[]).map((goal:any)=>({...goal,...computeGoalProgress(goal,steps||[],contributions||[])}));
 return buildGoalDateSuggestions(views);
}
async function buildDateContext(req:Request,knownDevice:any=null){
 const d=knownDevice||await device(req),person=String(d.person),day=today(),since=new Date(Date.now()-90*86400000).toISOString();
 const [settings,items,locations,places,trips,encounters,questionRows,placeEvents,goalSuggestions]=await Promise.all([
  ok(db.from("galaxy_settings").select("data").eq("id",1).single()),
  ok(db.from("galaxy_items").select("id,kind,data,author,created").order("created",{ascending:false}).limit(1000)),
  ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,transport_preference,updated_at").order("person")),
  ok(db.from("galaxy_places").select("id,name,kind,latitude,longitude,note,owner,created_at").order("created_at",{ascending:false}).limit(200)),
  ok(db.from("galaxy_trip_history").select("id,person,started_at,ended_at,distance_m,duration_s,dominant_motion").order("started_at",{ascending:false}).limit(250)),
  ok(db.from("galaxy_encounters").select("id,started_at,ended_at").order("started_at",{ascending:false}).limit(250)),
  ok(db.from("galaxy_daily_questions").select("day,question_id,deck,context_kind,favorite,memory_id").order("day",{ascending:false}).limit(40)),
  ok(db.from("galaxy_place_events").select("place_id,event,happened_at").eq("event","arrived").gte("happened_at",since).order("happened_at",{ascending:false}).limit(1000)),
  goalSuggestionsForDate()
 ]);
 const allItems=items||[],plans=allItems.filter((row:any)=>row.kind==="plan").map(datePlanView);
 const own=(locations||[]).find((row:any)=>String(row.person)===person&&row.sharing&&row.latitude!=null&&row.longitude!=null);
 const visitCounts=new Map<string,number>();
 for(const event of placeEvents||[]){const id=String(event.place_id);visitCounts.set(id,(visitCounts.get(id)||0)+1);}
 const placeViews=(places||[]).map((place:any)=>{
  const distanceM=own?Math.round(dist(own,place)):null;
  return {id:place.id,name:text(place.name,100),kind:text(place.kind,40),note:text(place.note,300),distanceM,visits:visitCounts.get(String(place.id))||0};
 });
 const startDate=validDate(settings?.data?.startDate)?String(settings.data.startDate):"";
 const hour=Number(new Intl.DateTimeFormat("en-US",{timeZone:"America/Bogota",hour:"2-digit",hourCycle:"h23"}).format(new Date()));
 return {
  today:day,startDate,nowHour:Number.isFinite(hour)?hour:12,person,
  recentQuestionIds:(questionRows||[]).map((row:any)=>String(row.question_id)).filter(Boolean).slice(0,14),
  memories:allItems.filter((row:any)=>row.kind==="memory").slice(0,80).map((row:any)=>({id:row.id,date:row.data?.date||bogotaDay(row.created),title:text(row.data?.title,160)})),
  journeys:allItems.filter((row:any)=>row.kind==="journey").slice(0,50).map((row:any)=>({id:row.id,date:row.data?.date||bogotaDay(row.created),title:text(row.data?.title,160)})),
  pendingPlans:plans.filter((plan:any)=>!plan.done),completedPlans:plans.filter((plan:any)=>plan.done),
  places:placeViews,frequentPlaces:placeViews.filter((place:any)=>Number(place.visits)>=2),
  trips:trips||[],encounters:encounters||[],
  location:own?{available:true,latitude:Number(own.latitude),longitude:Number(own.longitude)}:{available:false},
  transport:text(own?.transport_preference||"auto",24)||"auto",
  goalSuggestions:goalSuggestions||[],
  questionRows:questionRows||[]
 };
}
async function ensureDailyQuestion(req:Request,context:any=null,knownDevice:any=null){
 const ctx=context||await buildDateContext(req,knownDevice),day=String(ctx.today);
 let row=await ok(db.from("galaxy_daily_questions").select("*").eq("day",day).maybeSingle());
 if(!row){
  const selected=selectQuestion(ctx,{seed:"daily|"+day});
  await ok(db.from("galaxy_daily_questions").upsert({
   day,question_id:selected.id,deck:selected.deck,context_kind:dateQuestionContextKind(ctx),favorite:false
  },{onConflict:"day",ignoreDuplicates:true}));
  row=await ok(db.from("galaxy_daily_questions").select("*").eq("day",day).single());
 }
 let question=questionById(row.question_id);
 if(!question){
  question=selectQuestion(ctx,{seed:"repair|"+day});
  row=await ok(db.from("galaxy_daily_questions").update({question_id:question.id,deck:question.deck}).eq("day",day).select("*").single());
 }
 return {row,question,context:ctx};
}
async function favoriteQuestionMemory(req:Request,body:any){
 const d=await device(req),day=validDate(body.day)?String(body.day):today();
 const assignment=await ok(db.from("galaxy_daily_questions").select("*").eq("day",day).maybeSingle());
 if(!assignment)return json({error:"Esta pregunta todavía no tiene una asignación guardada."},404);
 if(assignment.memory_id){
  const item=await ok(db.from("galaxy_items").select("*").eq("id",assignment.memory_id).maybeSingle());
  if(item)return json({item,existing:true});
 }
 const rows=await ok(db.from("galaxy_daily").select("day,person,answer").eq("day",day).order("person"));
 const answers=(rows||[]).filter((row:any)=>text(row.answer,3000)).map((row:any)=>({person:String(row.person),answer:text(row.answer,3000)}));
 if(answers.length!==2)return json({error:"El recuerdo puede crearse cuando ambos hayan respondido."},409);
 const question=questionById(assignment.question_id);
 if(!question)return json({error:"La pregunta ya no está disponible."},409);
 const data=cleanItem("memory",{
  title:question.text,
  body:"",
  category:"Pregunta favorita",date:day,
  source:{type:"daily-question",day,questionId:question.id,deck:question.deck}
 });
 const item=await ok(db.from("galaxy_items").insert({kind:"memory",data,author:String(d.person)}).select("*").single());
 await ok(db.from("galaxy_daily_questions").update({favorite:true,memory_id:item.id}).eq("day",day));
 await recordParticipation(String(d.person));
 return json({item,existing:false});
}
async function saveDateRecap(req:Request,body:any){
 const d=await device(req),recap=buildDateRecap(body.session||body,{today:today()}),sessionId=text(recap?.dateMode?.sessionId,100);
 if(!sessionId)return json({error:"La sesión de Modo Cita no es válida."},400);
 const recent=await ok(db.from("galaxy_items").select("*").eq("kind","memory").order("created",{ascending:false}).limit(500));
 const existing=(recent||[]).find((item:any)=>String(item?.data?.dateMode?.sessionId||"")===sessionId);
 if(existing)return json({item:existing,existing:true});
 const data=cleanItem("memory",recap);
 const item=await ok(db.from("galaxy_items").insert({kind:"memory",data,author:String(d.person)}).select("*").single());
 await recordParticipation(String(d.person));
 return json({item,existing:false});
}
async function dateEngine(req:Request,body:any){
 const operation=String(body.operation||"context"),d=await device(req);
 if(operation==="favorite-memory")return await favoriteQuestionMemory(req,body);
 if(operation==="date-recap-save")return await saveDateRecap(req,body);
 const context=await buildDateContext(req,d);
 if(operation==="context"){
  const assigned=await ensureDailyQuestion(req,context,d);
  return json({
   today:context.today,
   question:{...assigned.question,favorite:!!assigned.row.favorite,memoryId:assigned.row.memory_id||null,contextKind:assigned.row.context_kind},
   decks:Object.keys(QUESTION_DECKS).map(id=>({id,count:QUESTION_DECKS[id].length})),
   pendingPlans:context.pendingPlans,
   categories:["this-week","when-possible","someday","travel","home"],
   locationAvailable:!!context.location?.available,transport:context.transport,
   places:context.places.map((place:any)=>({id:place.id,name:place.name,kind:place.kind,distanceM:place.distanceM,visits:place.visits}))
  });
 }
 if(operation==="question"){
  const question=selectQuestion(context,{deck:String(body.deck||""),seed:String(body.seed||context.today+"|"+body.deck)});
  return json({question});
 }
 if(operation==="favorite"){
  const assigned=await ensureDailyQuestion(req,context,d),favorite=body.favorite!==false;
  const row=await ok(db.from("galaxy_daily_questions").update({favorite}).eq("day",assigned.row.day).select("*").single());
  return json({question:{...assigned.question,favorite:!!row.favorite,memoryId:row.memory_id||null,contextKind:row.context_kind}});
 }
 if(operation==="surprise"){
  return json({experience:buildSurpriseExperience(context,{...(body.constraints||{}),seed:body.seed||context.today+"|surprise"})});
 }
 if(operation==="roulette"){
  return json({plan:roulettePendingPlans(context.pendingPlans,{category:String(body.category||""),seed:String(body.seed||context.today+"|roulette")})});
 }
 if(operation==="planner"){
  return json({experience:buildSequentialPlan(context,{...(body.constraints||{}),seed:body.seed||context.today+"|planner"})});
 }
 return json({error:"Operación de Date Engine no válida."},400);
}

async function presenceSet(req:Request,body:any){
  const d=await device(req),person=String(d.person),current=(await ok(db.from("galaxy_presence").select("*").eq("person",person).limit(1)))?.[0]||{};
  const patch:any={person,updated_at:new Date().toISOString()};
  if(Object.hasOwn(body,"shareBattery"))patch.share_battery=!!body.shareBattery;
  if(Object.hasOwn(body,"shareSong")||Object.hasOwn(body,"shareListening"))patch.share_song=!!(Object.hasOwn(body,"shareSong")?body.shareSong:body.shareListening);
  if(Object.hasOwn(body,"battery")){
    const battery=Number(body.battery);
    if(Number.isFinite(battery))patch.battery=Math.max(0,Math.min(100,Math.round(battery)));
  }
  if(Object.hasOwn(body,"songTitle")||Object.hasOwn(body,"listening"))patch.song_title=text(Object.hasOwn(body,"songTitle")?body.songTitle:body.listening,160)||null;
  const saved=await ok(db.from("galaxy_presence").upsert({...current,...patch},{onConflict:"person"}).select("*").single());
  return json({ok:true,presence:saved});
}

const BACKUP_VERSION=5;
const BACKUP_SCHEMA_VERSION="20261005011401";
const BACKUP_PAYLOAD_BUCKET="galaxy-backups";
const BACKUP_PAGE_SIZE=1000;
const BACKUP_MAX_ROWS_PER_SECTION=100000;
const BACKUP_MAX_MEDIA_OBJECTS=10000;
const BACKUP_MAX_PAYLOAD_BYTES=60*1024*1024;
const BACKUP_MEDIA_BUCKETS=["galaxy-photos","galaxy-music","galaxy-voice","galaxy-chat-media"] as const;
const BACKUP_SECTION_NAMES=[
 "settings","items","daily","home","rewards","places","locationHistory","tripHistory","placeEvents","destinations","encounters",
 "bond","bondConfig","bondParticipation","dailyQuestions","goals","goalParticipants","goalSteps","goalLinks","goalContributions",
 "bondGestures","contextSettings","voiceTranscripts","photoContext","chatMessages","chatReadState","chatReactions","chatHidden",
 "chatPins","chatFavorites","chatEdits","chatAttachments","chatPreferences","chatTranscripts","chatTranslations","chatAlbums",
 "chatAlbumItems","chatStickers","chatStickerFavorites","chatStickerRecents","chatLiveLocations","chatEntityRefs","chatPolls",
 "chatPollOptions","chatPollVotes","chatChecklists","chatChecklistItems"
] as const;

function backupObjectSize(file:any){return Math.max(0,Number(file?.metadata?.size??file?.metadata?.contentLength??0)||0);}
function backupObjectMime(file:any){return text(file?.metadata?.mimetype||file?.metadata?.contentType||"",160);}
function backupObjectFingerprint(rows:any[]){
 return JSON.stringify((rows||[]).map((x:any)=>[
  String(x.bucket||""),String(x.path||""),Number(x.size)||0,String(x.mime||""),String(x.updatedAt||"")
 ]).sort((a:any,b:any)=>String(a[0]+"\n"+a[1]).localeCompare(String(b[0]+"\n"+b[1]))));
}
async function backupSha256(bytes:Uint8Array){
 const input=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer;
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",input));
 return [...digest].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function backupStorageObjects(bucket:string,prefix="",includeReserved=false){
 const found:any[]=[],queue=[prefix],seen=new Set<string>();
 while(queue.length){
  const dir=queue.shift()||"";
  if(seen.has(dir))continue;seen.add(dir);
  let offset=0;
  for(;;){
   const {data,error}=await db.storage.from(bucket).list(dir,{limit:BACKUP_PAGE_SIZE,offset,sortBy:{column:"name",order:"asc"}});
   if(error)throw new Error("No se pudo enumerar Storage "+bucket+": "+String(error.message||error));
   const page=data||[];
   for(const file of page){
    if(!file?.name||file.name===".emptyFolderPlaceholder")continue;
    const objectPath=dir?dir+"/"+file.name:file.name;
    if(!includeReserved&&(objectPath==="__backup"||objectPath.startsWith("__backup/")))continue;
    if(file.id){
     found.push({
      bucket,path:objectPath,size:backupObjectSize(file),mime:backupObjectMime(file),
      updatedAt:String(file.updated_at||file.created_at||"")
     });
     if(found.length>BACKUP_MAX_MEDIA_OBJECTS)throw new Error("Storage supera el límite explícito de "+BACKUP_MAX_MEDIA_OBJECTS+" objetos por bucket.");
    }else if(includeReserved||!objectPath.startsWith("__backup")){
     queue.push(objectPath);
    }
   }
   if(page.length<BACKUP_PAGE_SIZE)break;
   offset+=page.length;
  }
 }
 found.sort((x:any,y:any)=>String(x.path).localeCompare(String(y.path)));
 return found;
}
async function backupAllOriginalMedia(){
 const all:any[]=[];
 for(const bucket of BACKUP_MEDIA_BUCKETS){
  const rows=await backupStorageObjects(bucket);
  all.push(...rows);
  if(all.length>BACKUP_MAX_MEDIA_OBJECTS)throw new Error("La multimedia supera el límite explícito de "+BACKUP_MAX_MEDIA_OBJECTS+" objetos.");
 }
 return all;
}
function backupCounts(sections:any){
 if(!sections||typeof sections!=="object"||Array.isArray(sections))throw new Error("Snapshot de datos inválido.");
 const counts:Record<string,number>={};
 for(const name of BACKUP_SECTION_NAMES){
  const rows=sections[name];
  if(!Array.isArray(rows))throw new Error("Falta la sección de backup "+name+".");
  if(rows.length>BACKUP_MAX_ROWS_PER_SECTION)throw new Error("La sección "+name+" supera el límite explícito de "+BACKUP_MAX_ROWS_PER_SECTION+" filas.");
  counts[name]=rows.length;
 }
 const unknown=Object.keys(sections).filter(k=>!(BACKUP_SECTION_NAMES as readonly string[]).includes(k));
 if(unknown.length)throw new Error("El snapshot contiene secciones no reconocidas: "+unknown.join(", "));
 return counts;
}
function backupAssertMediaReferences(sections:any,media:any[]){
 const available=new Set((media||[]).map((x:any)=>String(x.bucket)+"\n"+String(x.path)));
 const requirePath=(bucket:any,path:any,label:string)=>{
  const b=String(bucket||""),p=String(path||"");
  if(!p)return;
  if(!(BACKUP_MEDIA_BUCKETS as readonly string[]).includes(b)||p.startsWith("__backup/")||!available.has(b+"\n"+p)){
   throw new Error("Referencia multimedia inválida en "+label+": "+b+"/"+p);
  }
 };
 for(const row of sections.items||[]){
  requirePath("galaxy-photos",row?.data?.photoPath,"items.photoPath");
  requirePath("galaxy-voice",row?.data?.audioPath,"items.audioPath");
 }
 for(const row of sections.bond||[])if(row?.type==="voice")requirePath("galaxy-voice",row?.data?.audioPath,"bond.audioPath");
 for(const row of sections.bondConfig||[])requirePath("galaxy-photos",row?.photo_path,"bondConfig.photo_path");
 for(const row of sections.photoContext||[])requirePath("galaxy-photos",row?.path,"photoContext.path");
 for(const row of sections.chatAttachments||[]){
  const bucket=String(row?.bucket||"galaxy-chat-media");
  requirePath(bucket,row?.path,"chatAttachments.path");
  requirePath(bucket,row?.thumbnail_path,"chatAttachments.thumbnail_path");
 }
 for(const row of sections.chatStickers||[])requirePath(row?.bucket||"galaxy-chat-media",row?.path,"chatStickers.path");
}
async function backupRemoveObjects(entries:any[]){
 let complete=true;
 const groups=new Map<string,string[]>();
 for(const entry of entries||[]){
  const bucket=String(entry?.bucket||""),path=String(entry?.path||entry?.snapshotPath||"");
  if(!bucket||!path)continue;
  if(!groups.has(bucket))groups.set(bucket,[]);
  groups.get(bucket)!.push(path);
 }
 for(const [bucket,paths] of groups){
  for(let i=0;i<paths.length;i+=100){
   const {error}=await db.storage.from(bucket).remove(paths.slice(i,i+100));
   if(error)complete=false;
  }
 }
 return complete;
}
async function backupCopySnapshots(backupId:string,originals:any[]){
 const copied:any[]=[];
 try{
  for(const object of originals){
   const snapshotPath="__backup/"+backupId+"/"+String(object.path);
   const {error}=await db.storage.from(String(object.bucket)).copy(String(object.path),snapshotPath);
   if(error)throw new Error("No se pudo preservar "+object.bucket+"/"+object.path+": "+String(error.message||error));
   copied.push({...object,snapshotPath});
  }
  for(const bucket of BACKUP_MEDIA_BUCKETS){
   const expected=copied.filter(x=>x.bucket===bucket);
   if(!expected.length)continue;
   const snapshots=await backupStorageObjects(bucket,"__backup/"+backupId,true);
   const byPath=new Map(snapshots.map((x:any)=>[String(x.path),x]));
   for(const row of expected){
    const snap=byPath.get(String(row.snapshotPath));
    if(!snap||Number(snap.size)!==Number(row.size)||String(snap.mime||"")!==String(row.mime||"")){
     throw new Error("Snapshot multimedia no verificable para "+row.bucket+"/"+row.path+".");
    }
   }
  }
  return copied;
 }catch(e){
  await backupRemoveObjects(copied.map((x:any)=>({bucket:x.bucket,path:x.snapshotPath})));
  throw e;
 }
}
function backupPayloadDescriptor(backup:any){
 return backup&&typeof backup==="object"&&!Array.isArray(backup)?backup:null;
}
function backupErrorMessage(error:any){
 if(error instanceof Error)return error.message;
 if(error&&typeof error==="object"){
  const parts=[error.message,error.details,error.hint,error.code].map((x:any)=>String(x||"").trim()).filter(Boolean);
  if(parts.length)return parts.join(" | ");
  try{return JSON.stringify(error);}catch{}
 }
 return String(error||"Error desconocido");
}
async function backupPrivacySnapshot(sections:any,person:string){
 const safe=structuredClone(sections);
 const privacyLocations=await ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,updated_at").order("person"));
 const originalCapsules=(sections?.items||[]).filter((row:any)=>row?.kind==="capsule");
 const hiddenCapsules=new Set(
  originalCapsules
   .filter((row:any)=>chatCapsuleAccess(row?.data||{},person,privacyLocations||[]).locked)
   .map((row:any)=>String(row.id))
 );
 safe.items=await Promise.all((safe.items||[]).map(async(row:any)=>{
  if(row?.kind!=="capsule")return row;
  const sanitized=await privacyItemResponse(row,person);
  if(sanitized?.data){
   delete sanitized.data.photoUrl;
   delete sanitized.data.audioUrl;
   delete sanitized.data.song;
  }
  return sanitized;
 }));
 const hiddenBondIds=new Set(
  (safe.bond||[])
   .filter((row:any)=>row?.type==="voice"&&hiddenCapsules.has(String(row?.data?.referenceId||"")))
   .map((row:any)=>String(row.id))
 );
 safe.bond=(safe.bond||[]).filter((row:any)=>!hiddenBondIds.has(String(row?.id)));
 safe.voiceTranscripts=(safe.voiceTranscripts||[]).filter((row:any)=>!hiddenBondIds.has(String(row?.bond_id)));
 const capsuleContext={
  capsules:originalCapsules,
  locations:(privacyLocations||[]).filter((row:any)=>String(row?.person)===person)
 };
 safe.photoContext=(safe.photoContext||[]).filter((row:any)=>
  capsuleObjectVisible("galaxy-photos",String(row?.path||""),person,capsuleContext)
 );
 return {sections:safe,capsuleContext};
}
function backupVisibleMedia(rows:any[],person:string,capsuleContext:any){
 return (rows||[]).filter((row:any)=>{
  const bucket=String(row?.bucket||"");
  if(bucket!=="galaxy-photos"&&bucket!=="galaxy-voice")return true;
  return capsuleObjectVisible(bucket,String(row?.path||""),person,capsuleContext);
 });
}
async function backupExport(req:Request){
 const d=await device(req),person=String(d.person),backupId=crypto.randomUUID(),exportedAt=new Date().toISOString();
 await chatReconcileDeletedMedia();
 let snapshots:any[]=[];
 let payloadPath="";
 try{
  const rawSections=await ok(db.rpc("galaxy_backup_export_v5"));
  const privacy=await backupPrivacySnapshot(rawSections,person);
  const sections=privacy.sections;
  const counts=backupCounts(sections);
  const beforeAll=await backupAllOriginalMedia();
  const before=backupVisibleMedia(beforeAll,person,privacy.capsuleContext);
  backupAssertMediaReferences(sections,before);
  snapshots=await backupCopySnapshots(backupId,before);
  const afterAll=await backupAllOriginalMedia();
  if(backupObjectFingerprint(beforeAll)!==backupObjectFingerprint(afterAll))throw new Error("Storage cambió durante el backup; vuelve a intentarlo para obtener un snapshot consistente.");
  const mediaBytes=snapshots.reduce((sum:number,x:any)=>sum+(Number(x.size)||0),0);
  const manifest={
   schemaVersion:BACKUP_SCHEMA_VERSION,
   counts,
   limits:{
    maxRowsPerSection:BACKUP_MAX_ROWS_PER_SECTION,
    maxMediaObjects:BACKUP_MAX_MEDIA_OBJECTS,
    maxPayloadBytes:BACKUP_MAX_PAYLOAD_BYTES,
    storageListPageSize:BACKUP_PAGE_SIZE
   },
   media:{
    strategy:"same-project-storage-snapshot-v1",
    count:snapshots.length,
    bytes:mediaBytes,
    buckets:Object.fromEntries(BACKUP_MEDIA_BUCKETS.map(bucket=>[bucket,snapshots.filter(x=>x.bucket===bucket).length])),
    failureDomain:"same-supabase-project",
    guarantee:"Los binarios se duplican y verifican en Storage del mismo proyecto. Este backup resiste borrado lógico o accidental dentro de la app, pero no la pérdida total del proyecto Supabase."
   },
   consistency:"single-postgres-snapshot + stable-storage-set-verified",
   restoreMode:"empty-or-compatible",
   exclusions:[
    "auth users and membership/invitation credentials",
    "device tokens/pair codes/push credentials and delivery logs",
    "current presence/live GPS/trip runtime",
    "derived Intelligence indexes/usage/cleanup queue",
    "derived Context runtime/events/suggestions/ETA",
    "chat presence/metrics/runtime and notification delivery state",
    "static home catalog",
    "deleted-for-both chat tombstones and their deleted media"
   ]
  };
  const payload={
   format:"nuestra-galaxia-backup-payload",version:BACKUP_VERSION,backupId,exportedAt,
   manifest,sections,media:snapshots
  };
  const raw=JSON.stringify(payload),bytes=new TextEncoder().encode(raw);
  if(bytes.length>BACKUP_MAX_PAYLOAD_BYTES)throw new Error("El payload supera el límite explícito de "+BACKUP_MAX_PAYLOAD_BYTES+" bytes; no se generó una copia truncada.");
  const sha256=await backupSha256(bytes);
  payloadPath=person+"/"+backupId+".json";
  const {error}=await db.storage.from(BACKUP_PAYLOAD_BUCKET).upload(payloadPath,bytes,{contentType:"application/json",cacheControl:"0",upsert:false});
  if(error)throw new Error("No se pudo guardar el payload íntegro del backup: "+String(error.message||error));
  return json({
   format:"nuestra-galaxia-backup",version:BACKUP_VERSION,backupId,exportedAt,
   manifest:{
    ...manifest,
    payload:{bucket:BACKUP_PAYLOAD_BUCKET,path:payloadPath,sizeBytes:bytes.length,sha256,algorithm:"SHA-256"}
   }
  });
 }catch(e){
  if(payloadPath)await backupRemoveObjects([{bucket:BACKUP_PAYLOAD_BUCKET,path:payloadPath}]);
  if(snapshots.length)await backupRemoveObjects(snapshots.map((x:any)=>({bucket:x.bucket,path:x.snapshotPath})));
  const message=backupErrorMessage(e);
  console.error("backup-export",{backupId,message});
  return json({error:"No se pudo crear un backup verificable.",detail:text(message,500),code:"BACKUP_EXPORT_FAILED"},409);
 }
}

function uuidish(v:unknown){return /^[0-9a-f-]{36}$/i.test(String(v||""));}

function backupValidatePayload(payload:any,descriptor:any){
 if(!payload||typeof payload!=="object"||Array.isArray(payload)
    ||payload.format!=="nuestra-galaxia-backup-payload"||Number(payload.version)!==BACKUP_VERSION
    ||String(payload.backupId||"")!==String(descriptor.backupId||"")
    ||payload?.manifest?.schemaVersion!==BACKUP_SCHEMA_VERSION)throw new Error("Payload v5 inválido o incompatible.");
 const counts=backupCounts(payload.sections);
 const declared=payload?.manifest?.counts;
 if(!declared||typeof declared!=="object"||Array.isArray(declared))throw new Error("El manifiesto de conteos no existe.");
 for(const name of BACKUP_SECTION_NAMES)if(Number(declared[name])!==counts[name])throw new Error("Conteo corrupto en "+name+".");
 if(!Array.isArray(payload.media)||payload.media.length>BACKUP_MAX_MEDIA_OBJECTS)throw new Error("Manifiesto multimedia inválido.");
 if(Number(payload?.manifest?.media?.count)!==payload.media.length)throw new Error("Conteo multimedia corrupto.");
 const mediaBytes=payload.media.reduce((sum:number,x:any)=>sum+(Number(x?.size)||0),0);
 if(Number(payload?.manifest?.media?.bytes)!==mediaBytes)throw new Error("Tamaño multimedia corrupto.");
 for(const row of payload.media){
  const bucket=String(row?.bucket||""),path=String(row?.path||""),snapshotPath=String(row?.snapshotPath||"");
  if(!(BACKUP_MEDIA_BUCKETS as readonly string[]).includes(bucket)||!path||path.startsWith("__backup/")
     ||snapshotPath!=="__backup/"+String(payload.backupId)+"/"+path||Number(row?.size)<0){
   throw new Error("Entrada multimedia malformada.");
  }
 }
 backupAssertMediaReferences(payload.sections,payload.media);
 return counts;
}
async function backupLoadPayload(descriptor:any){
 const pointer=descriptor?.manifest?.payload;
 if(!pointer||pointer.bucket!==BACKUP_PAYLOAD_BUCKET||typeof pointer.path!=="string"
    ||!pointer.path.endsWith("/"+String(descriptor.backupId)+".json")
    ||!Number.isInteger(Number(pointer.sizeBytes))||Number(pointer.sizeBytes)<1||Number(pointer.sizeBytes)>BACKUP_MAX_PAYLOAD_BYTES
    ||!/^[0-9a-f]{64}$/i.test(String(pointer.sha256||"")))throw new Error("Puntero de payload inválido.");
 const {data,error}=await db.storage.from(BACKUP_PAYLOAD_BUCKET).download(pointer.path);
 if(error||!data)throw new Error("El payload del backup ya no está disponible.");
 const bytes=new Uint8Array(await data.arrayBuffer());
 if(bytes.length!==Number(pointer.sizeBytes))throw new Error("El tamaño del payload no coincide con el manifiesto.");
 const digest=await backupSha256(bytes);
 if(digest.toLowerCase()!==String(pointer.sha256).toLowerCase())throw new Error("El hash SHA-256 del payload no coincide.");
 let payload:any;
 try{payload=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error("El payload JSON está corrupto.");}
 backupValidatePayload(payload,descriptor);
 return payload;
}
async function backupVerifySnapshots(payload:any){
 const verified=new Map<string,any>();
 for(const bucket of BACKUP_MEDIA_BUCKETS){
  const expected=payload.media.filter((x:any)=>x.bucket===bucket);
  if(!expected.length)continue;
  const rows=await backupStorageObjects(bucket,"__backup/"+String(payload.backupId),true);
  for(const row of rows)verified.set(bucket+"\n"+row.path,row);
  for(const media of expected){
   const row=verified.get(bucket+"\n"+media.snapshotPath);
   if(!row||Number(row.size)!==Number(media.size)||String(row.mime||"")!==String(media.mime||"")){
    throw new Error("Falta o difiere el snapshot de "+bucket+"/"+media.path+".");
   }
  }
 }
}
async function backupRestoreMedia(payload:any){
 const current=await backupAllOriginalMedia();
 const currentByPath=new Map(current.map((x:any)=>[x.bucket+"\n"+x.path,x]));
 const created:any[]=[];
 for(const media of payload.media){
  const key=String(media.bucket)+"\n"+String(media.path),existing=currentByPath.get(key);
  if(existing){
   if(Number(existing.size)!==Number(media.size)||String(existing.mime||"")!==String(media.mime||"")){
    throw Object.assign(new Error("El destino ya contiene una multimedia distinta en "+media.bucket+"/"+media.path+"."),{created});
   }
   continue;
  }
  const {error}=await db.storage.from(String(media.bucket)).copy(String(media.snapshotPath),String(media.path));
  if(error)throw Object.assign(new Error("No se pudo restaurar "+media.bucket+"/"+media.path+": "+String(error.message||error)),{created});
  created.push({bucket:media.bucket,path:media.path});
 }
 return created;
}
async function backupRestore(req:Request,body:any){
 await device(req);
 const backup=backupPayloadDescriptor(body?.backup);
 if(!backup||backup.format!=="nuestra-galaxia-backup")return json({error:"La copia no pertenece a Nuestra Galaxia.",code:"BACKUP_FORMAT_INVALID"},400);
 const version=Number(backup.version);
 if(version!==BACKUP_VERSION){
  if([1,2,3,4].includes(version))return json({error:"Este backup usa un formato anterior sin garantías de integridad. Crea una copia v5 antes de restaurar.",code:"BACKUP_LEGACY_UNSAFE"},409);
  return json({error:"Versión de backup no compatible.",code:"BACKUP_VERSION_UNSUPPORTED"},400);
 }
 if(!uuidish(backup.backupId)||backup?.manifest?.schemaVersion!==BACKUP_SCHEMA_VERSION)return json({error:"Manifiesto v5 malformado o incompatible.",code:"BACKUP_MANIFEST_INVALID"},400);
 let created:any[]=[];
 try{
  const payload=await backupLoadPayload(backup);
  await backupVerifySnapshots(payload);
  try{created=await backupRestoreMedia(payload);}
  catch(e:any){created=Array.isArray(e?.created)?e.created:created;throw e;}
  const {data:restored,error:restoreError}=await db.rpc("galaxy_backup_restore_v5",{payload});
  if(restoreError)throw new Error("DB restore: "+backupErrorMessage(restoreError));
  return json({ok:true,verified:restored?.verified===true,restored:restored?.counts||payload.manifest.counts,media:{verified:payload.media.length,created:created.length}});
 }catch(e){
  const cleanupComplete=await backupRemoveObjects(created);
  const message=backupErrorMessage(e);
  console.error("backup-restore",{backupId:String(backup.backupId||""),message,cleanupComplete});
  return json({
   error:"La restauración no pudo verificarse y no se reportó como exitosa.",
   detail:text(message,500),code:"BACKUP_RESTORE_FAILED",mediaRollbackComplete:cleanupComplete
  },409);
 }
}

async function recordParticipation(person:string){
  await ok(db.from("galaxy_bond_participation").upsert({day:today(),person},{onConflict:"day,person"}));
}

function validateBond(type:string,data:any){
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Datos no válidos");
  if(type==="gesture"){
    const gesture=String(data.gesture||data.gestureId||"");
    const builtin=resolveGesture(gesture,[]);
    if(builtin){
      if(!data.name&&!data.text&&!data.icon&&!data.behavior)return {gesture};
      const snapshot=gestureSnapshot(builtin);return {gesture,...snapshot};
    }
    if(!uuidish(gesture))throw new Error("Gesto no válido");
    const normalized=normalizeCustomGesture(data),snapshot=gestureSnapshot({id:gesture,...normalized});
    return {gesture,...snapshot};
  }
  if(type==="game"){
    const questionId=String(data.questionId||""),answer=text(data.answer,100);
    if(!questions[questionId]?.includes(answer))throw new Error("Respuesta no válida");
    return {questionId,answer};
  }
  if(type==="ritual"){
    const week=text(data.week,10),gratitude=text(data.gratitude,2000),need=text(data.need,2000),plan=text(data.plan,2000);
    if(!validDate(week)||new Date(week+"T12:00:00Z").getUTCDay()!==1||!gratitude||!need||!plan)throw new Error("Completa el ritual de la semana");
    return {week,gratitude,need,plan};
  }
  if(type==="sharednote"){
    const title=text(data.title,120),body=text(data.body,10000);
    if(!title)throw new Error("Ponle un título a la nota");
    return {title,body};
  }
  if(type==="voice"){
    const title=text(data.title,120),body=text(data.body,2000),audioPath=text(data.audioPath,120),mime=text(data.mime,80),referenceId=text(data.referenceId,100);
    if(!title||!/^[01]\/[0-9a-f-]{36}\.(mp3|ogg|webm|m4a)$/i.test(audioPath)||!["audio/mpeg","audio/ogg","audio/webm","audio/mp4"].includes(mime))throw new Error("Audio no válido");
    return {...(referenceId?{referenceId}:{}),title,body,audioPath,mime};
  }
  throw new Error("Tipo de momento no válido");
}

async function validateVoice(person:string,payload:any){
  if(!payload.audioPath.startsWith(person+"/"))throw new Error("El audio no pertenece a tu perfil");
  const test=await signedForPerson("galaxy-voice",payload.audioPath,person,60);
  if(!test)throw new Error("Audio no disponible");
  if(payload.referenceId){
    const item=(await ok(db.from("galaxy_items").select("kind,data").eq("id",payload.referenceId).limit(1)))?.[0];
    if(!item||!["memory","song","capsule","journey","note"].includes(item.kind)||item.kind==="note"&&!item.data?.surprise)throw new Error("Referencia no válida");
    if(item.kind==="capsule"){const unlockAt=chatCapsuleUnlockAt(item.data);if(unlockAt&&Date.parse(unlockAt)>Date.now())throw new Error("La cápsula aún está cerrada");}
  }
}

async function bondSave(req:Request,body:any){
  const d=await device(req),person=String(d.person),type=String(body.type||""),payload=validateBond(type,body.data);
  if(type==="gesture"){
    const recent=await ok(db.from("galaxy_bond").select("id").eq("author",person).eq("type","gesture").gt("created",new Date(Date.now()-60000).toISOString()).limit(20));
    if((recent?.length||0)>=20)return json({error:"Espera un momento antes de enviar otro gesto"},429);
  }
  if(type==="ritual"){
    const existing=await ok(db.from("galaxy_bond").select("id").eq("type","ritual").eq("author",person).filter("data->>week","eq",payload.week).limit(1));
    if(existing?.length)return json({error:"Ya guardaste el ritual de esta semana."},409);
  }
  if(type==="voice")await validateVoice(person,payload);
  const row=await ok(db.from("galaxy_bond").insert({type,author:person,data:payload}).select("*").single());
  await recordParticipation(person);
  await intelligenceBestEffort("bond-create",()=>syncIntelligenceBond(row));
  return json({entry:row},201);
}

async function bondUpdate(req:Request,body:any){
  const d=await device(req),person=String(d.person),row=(await ok(db.from("galaxy_bond").select("*").eq("id",String(body.id||"")).limit(1)))?.[0];
  if(!row)return json({error:"El momento ya no existe."},404);
  if(Number(body.version)!==Number(row.version))return json({error:"Cambió en otro dispositivo. Actualiza antes de guardar."},409);
  if(row.type!=="sharednote"&&!(row.type==="ritual"&&row.author===person))return json({error:"No puedes editar este momento."},403);
  const payload=validateBond(row.type,body.data);
  if(row.type==="ritual"&&payload.week!==row.data?.week)return json({error:"La semana no se puede cambiar."},400);
  const updated=await ok(db.from("galaxy_bond").update({data:payload,version:row.version+1}).eq("id",row.id).eq("version",row.version).select("*").single());
  await recordParticipation(person);
  await intelligenceBestEffort("bond-update",()=>syncIntelligenceBond(updated));
  return json({entry:updated});
}

async function bondGuess(req:Request,body:any){
  const d=await device(req),person=String(d.person),row=(await ok(db.from("galaxy_bond").select("*").eq("id",String(body.id||"")).limit(1)))?.[0];
  if(!row)return json({error:"El momento ya no existe."},404);
  if(row.type!=="game"||row.author===person)return json({error:"Solo tu pareja puede adivinar esta respuesta."},403);
  if(Object.hasOwn(row.data||{},"guess"))return json({error:"La respuesta ya fue adivinada."},409);
  const guess=text(body.guess,100),opts=questions[row.data?.questionId]||[];
  if(!opts.includes(guess))return json({error:"Elige una respuesta válida."},400);
  const data={...row.data,guess,correct:guess===row.data.answer};
  const updated=await ok(db.from("galaxy_bond").update({data,version:row.version+1}).eq("id",row.id).eq("version",row.version).select("*").single());
  await recordParticipation(person);
  return json({entry:updated});
}

async function bondDelete(req:Request,body:any){
  const d=await device(req),person=String(d.person),row=(await ok(db.from("galaxy_bond").select("*").eq("id",String(body.id||"")).limit(1)))?.[0];
  if(!row)return json({error:"El momento ya no existe."},404);
  if(row.type!=="sharednote"&&row.author!==person)return json({error:"Solo su autor puede eliminar este momento."},403);
  if(Number(body.version)!==Number(row.version))return json({error:"Cambió en otro dispositivo. Actualiza antes de borrar."},409);
  await ok(db.from("galaxy_bond").delete().eq("id",row.id).eq("version",row.version));
  if(["sharednote","ritual"].includes(String(row.type)))await intelligenceBestEffort("bond-delete",()=>deleteIntelligenceSource(String(row.type),String(row.id)));
  if(row.type==="voice")await intelligenceBestEffort("voice-delete-index",()=>deleteIntelligenceSource("voice-transcript",String(row.id)));
  return json({ok:true});
}

async function bondWidget(req:Request,body:any){
  const d=await device(req),person=String(d.person);
  const path=text(body.photoPath,300);
  if(path&&!(await signedForPerson("galaxy-photos",path,person,60)))return json({error:"Elige una foto válida del álbum."},400);
  await ok(db.from("galaxy_bond_config").update({photo_path:path}).eq("id",1));
  return json({photoPath:path});
}

async function gesture(req:Request,body:any){
  return bondSendGesture(req,{gestureId:body.gesture});
}

function meters(lat1:number,lon1:number,lat2:number,lon2:number){if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return Infinity;const R=6371000,p=Math.PI/180,dLat=(lat2-lat1)*p,dLon=(lon2-lon1)*p,a=Math.sin(dLat/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(a));}

function bogotaDay(value:unknown){
  const date=new Date(String(value||""));
  if(!Number.isFinite(date.getTime()))return"";
  return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(date);
}

function insightMetricSnapshot(summary:any){
  return {
    memories:Number(summary?.counts?.memories||0),
    plansDone:Number(summary?.counts?.plansDone||0),
    events:Number(summary?.counts?.events||0),
    songs:Number(summary?.counts?.songs||0),
    distance_m:Number(summary?.trips?.distance_m||0),
    together_seconds:Number(summary?.encounters?.together_seconds||0),
    mood_days:Number(summary?.connection?.mood_days||0),
    answer_days:Number(summary?.connection?.answer_days||0),
    exact_mood_days:Number(summary?.connection?.exact_mood_days||0),
    compatible_mood_days:Number(summary?.connection?.compatible_mood_days||0),
    gestures:Number(summary?.bond?.gestures||0)
  };
}
function insightDeltas(current:any,previous:any){
  const a=insightMetricSnapshot(current),b=insightMetricSnapshot(previous),out:Record<string,number>={};
  for(const key of Object.keys(a))out[key]=Number(a[key as keyof typeof a]||0)-Number(b[key as keyof typeof b]||0);
  return out;
}
function jointParticipationDays(rows:any[]){
  const days=new Map<string,Set<string>>();
  for(const row of rows||[]){const day=String(row.day||"");if(!day)continue;const people=days.get(day)||new Set<string>();people.add(String(row.person));days.set(day,people);}
  return [...days.values()].filter(people=>people.has("0")&&people.has("1")).length;
}
async function listInsightPhotoMetadata(person:string){
  const found:any[]=[],privacy=await capsulePrivacyContext(person);
  for(const prefix of ["","0","1"]){
    const {data,error}=await db.storage.from("galaxy-photos").list(prefix,{limit:100,sortBy:{column:"created_at",order:"desc"}});
    if(error)continue;
    for(const file of data||[]){
      if(!file.id||file.name===".emptyFolderPlaceholder")continue;
      const path=prefix?prefix+"/"+file.name:file.name;
      if(!capsuleObjectVisible("galaxy-photos",path,person,privacy))continue;
      found.push({
        path,
        name:file.name,
        originalName:file.metadata?.originalName||file.metadata?.original_name||file.name,
        mime:file.metadata?.mimetype||"",
        size:file.metadata?.size||0,
        created:file.created_at||file.updated_at||null
      });
    }
  }
  return found;
}
async function signInsightPhotos(rows:any[]){
  const signedRows:any[]=[];
  for(const row of rows||[]){
    if(!row?.path)continue;
    const url=await signed("galaxy-photos",String(row.path),1800);
    if(url)signedRows.push({...row,url});
  }
  return signedRows;
}

async function goalInsightRows(){
 const [goals,steps,contributions]=await Promise.all([
  ok(db.from("galaxy_goals").select("*").limit(2000)),
  ok(db.from("galaxy_goal_steps").select("*").limit(10000)),
  ok(db.from("galaxy_goal_contributions").select("*").limit(20000))
 ]);
 return {goals:goals||[],steps:steps||[],contributions:contributions||[]};
}
async function buildInsights(req:Request,options:any){
  const d=await device(req),person=String(d.person),day=today();
  const settings=await ok(db.from("galaxy_settings").select("data").eq("id",1).single());
  const startDate=validDate(settings?.data?.startDate)?String(settings.data.startDate):"";
  const period=periodBounds(String(options?.kind||""),options?.key,day,startDate);
  if(!period)throw new Error("Periodo de insights no válido.");
  const previous=previousPeriod(period,day);
  const rangeStart=previous&&previous.start<period.start?previous.start:period.start;
  const rangeStartDay=previous&&previous.startDay<period.startDay?previous.startDay:period.startDay;
  const rangeEnd=period.end,rangeEndDay=period.endDay;
  const [items,trips,encounters,daily,bond,participation,allBondGestures,placeEvents,places,photos]=await Promise.all([
    ok(db.from("galaxy_items").select("id,kind,data,author,created").order("created",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_trip_history").select("id,person,started_at,ended_at,distance_m,duration_s,dominant_motion").order("started_at",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_encounters").select("id,started_at,ended_at,distance_m").order("started_at",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_daily").select("day,person,mood,answer").gte("day",rangeStartDay).lt("day",rangeEndDay).order("day",{ascending:true}).limit(5000)),
    ok(db.from("galaxy_bond").select("id,type,author,created").gte("created",rangeStart).lt("created",rangeEnd).order("created",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_bond_participation").select("day,person").order("day",{ascending:true}).limit(10000)),
    ok(db.from("galaxy_bond").select("id").eq("type","gesture").limit(10000)),
    ok(db.from("galaxy_place_events").select("id,person,place_id,event,happened_at").gte("happened_at",rangeStart).lt("happened_at",rangeEnd).order("happened_at",{ascending:true}).limit(5000)),
    ok(db.from("galaxy_places").select("id,name").limit(1000)),
    listInsightPhotoMetadata(person)
  ]);
  const goalRows=await goalInsightRows();
  const currentGoalInsights=buildGoalInsightSummary(goalRows.goals,goalRows.steps,goalRows.contributions,period);
  const priorGoalInsights=previous?buildGoalInsightSummary(goalRows.goals,goalRows.steps,goalRows.contributions,previous):null;
  const nowMs=Date.now(),source={items:items||[],trips:trips||[],encounters:encounters||[],daily:daily||[],bond:bond||[],participation:participation||[],placeEvents:placeEvents||[],places:places||[],photos:photos||[],person,nowMs};
  const current=aggregateInsightRows({...source,period,goalInsights:currentGoalInsights});
  current.photos=await signInsightPhotos(current.photos||[]);
  const prior=previous?aggregateInsightRows({...source,period:previous,goalInsights:priorGoalInsights}):null;
  const visibleAll=(items||[]).filter((row:any)=>isInsightVisibleItem(row,person,day));
  const bondProgress=computeBondProgress(participation||[],new Date());
  const achievements=evaluateAchievements({
    memories:visibleAll.filter((row:any)=>row.kind==="memory").length,
    encounters:(encounters||[]).length,
    distance_m:(trips||[]).reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.distance_m)||0),0),
    journeys:visibleAll.filter((row:any)=>row.kind==="journey").length,
    joint_days:bondProgress.totalDays,
    current_streak:bondProgress.currentStreak,
    record_streak:bondProgress.recordStreak,
    gestures:(allBondGestures||[]).length,
    startDate,today:day
  });
  return {
    ...current,
    achievements,
    comparison:prior?{period:previous,deltas:insightDeltas(current,prior),summary:insightMetricSnapshot(prior),moods:prior.moods}:null,
    relationship:{startDate}
  };
}
async function insightsSummary(req:Request,body:any){
  const kind=String(body.kind||"month");
  if(!["week","month","year","anniversary","range"].includes(kind))return json({error:"Periodo de insights no válido."},400);
  const key=kind==="range"?{startDay:String(body.startDay||""),endDay:String(body.endDay||"")}:body.key;
  return json(await buildInsights(req,{kind,key}));
}
async function monthlySummary(req:Request,body:any){
  const month=String(body.month||today().slice(0,7));
  const summary=await buildInsights(req,{kind:"month",key:month});
  return json({...summary,month});
}

function sameHistoryDay(value:string,day:string){
  return validDate(value)&&value<day&&value.slice(5)===day.slice(5);
}
async function todayHistory(req:Request,body:any){
  const d=await device(req),person=String(d.person),day=String(body.day||today()),current=today();
  if(!validDate(day)||day>current)return json({error:"Fecha no válida."},400);
  const [items,trips,encounters,bond,daily,placeEvents,places,locations]=await Promise.all([
    ok(db.from("galaxy_items").select("id,kind,data,author,created").order("created",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_trip_history").select("id,person,started_at,ended_at,distance_m,duration_s,dominant_motion").order("started_at",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_encounters").select("id,started_at,ended_at,distance_m").order("started_at",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_bond").select("id,type,author,data,created").order("created",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_daily").select("day,person,mood,answer").order("day",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_place_events").select("id,person,place_id,event,happened_at").order("happened_at",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_places").select("id,name").limit(1000)),
    ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,updated_at"))
  ]);
  const buckets=new Map<string,any>();
  const bucket=(year:string)=>{
    if(!buckets.has(year))buckets.set(year,{
      year,items:[],places:new Set<string>(),
      stats:{trips:0,distance_m:0,encounters:0,together_seconds:0,gestures:0,voices:0,shared_notes:0,rituals:0,arrivals:0,mood_together:false,answer_together:false}
    });
    return buckets.get(year);
  };
  const placeNames=new Map((places||[]).map((p:any)=>[String(p.id),text(p.name,80)]));
  const own=(locations||[]).find((x:any)=>String(x.person)===person&&x.sharing);
  for(const row of items||[]){
    const data=row.data||{},explicit=validDate(data.date)?String(data.date):(validDate(data.unlockDate)?String(data.unlockDate):"");
    const eventDay=explicit||bogotaDay(row.created);
    if(!sameHistoryDay(eventDay,day))continue;
    if(row.kind==="capsule"&&chatCapsuleAccess(data,person,locations||[]).locked)continue;
    if(row.kind==="note"&&data.surprise&&String(row.author)!==person){
      let unlocked=data.unlockType==="date"&&(!data.unlockDate||String(data.unlockDate)<=day);
      if(data.unlockType==="place"&&own)unlocked=meters(Number(own.latitude),Number(own.longitude),Number(data.latitude),Number(data.longitude))<=Number(data.radius||150);
      if(!unlocked)continue;
    }
    const b=bucket(eventDay.slice(0,4)),kind=String(row.kind||"memory");
    b.items.push({
      id:String(row.id),kind,author:String(row.author),date:eventDay,origin:explicit?"dated":"saved",
      title:text(data.title||({memory:"Recuerdo",plan:"Plan",event:"Fecha",journey:"Viaje",song:"Canción",note:"Nota",capsule:"Cápsula",wish:"Deseo"} as any)[kind]||"Historia",160),
      body:text(data.body||"",1200),category:text(data.category||"",80),placeName:text(data.placeName||"",100),done:data.done===true
    });
  }
  for(const row of trips||[]){
    const eventDay=bogotaDay(row.started_at);if(!sameHistoryDay(eventDay,day))continue;
    const b=bucket(eventDay.slice(0,4));b.stats.trips++;b.stats.distance_m+=Math.max(0,Number(row.distance_m||0));
  }
  for(const row of encounters||[]){
    const eventDay=bogotaDay(row.started_at);if(!sameHistoryDay(eventDay,day))continue;
    const b=bucket(eventDay.slice(0,4));b.stats.encounters++;
    const start=Date.parse(row.started_at),end=row.ended_at?Date.parse(row.ended_at):start;
    if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)b.stats.together_seconds+=(end-start)/1000;
  }
  for(const row of bond||[]){
    const eventDay=bogotaDay(row.created);if(!sameHistoryDay(eventDay,day))continue;
    const b=bucket(eventDay.slice(0,4));
    if(row.type==="gesture")b.stats.gestures++;
    if(row.type==="voice")b.stats.voices++;
    if(row.type==="sharednote")b.stats.shared_notes++;
    if(row.type==="ritual")b.stats.rituals++;
  }
  const dailyDays=new Map<string,any[]>();
  for(const row of daily||[]){if(!sameHistoryDay(String(row.day||""),day))continue;const rows=dailyDays.get(row.day)||[];rows.push(row);dailyDays.set(row.day,rows);}
  for(const [historyDay,rows] of dailyDays){
    const b=bucket(historyDay.slice(0,4));
    const moods=new Set(rows.filter((x:any)=>x.mood).map((x:any)=>String(x.person)));
    const answers=new Set(rows.filter((x:any)=>x.answer).map((x:any)=>String(x.person)));
    b.stats.mood_together=moods.has("0")&&moods.has("1");
    b.stats.answer_together=answers.has("0")&&answers.has("1");
  }
  for(const row of placeEvents||[]){
    if(row.event!=="arrived")continue;
    const eventDay=bogotaDay(row.happened_at);if(!sameHistoryDay(eventDay,day))continue;
    const b=bucket(eventDay.slice(0,4));b.stats.arrivals++;
    const name=placeNames.get(String(row.place_id));if(name)b.places.add(name);
  }
  const groups=[...buckets.values()].map((b:any)=>({
    year:b.year,
    items:b.items.sort((a:any,b:any)=>String(b.date).localeCompare(String(a.date))).slice(0,50),
    places:[...b.places].slice(0,6),
    stats:{...b.stats,distance_m:Math.round(b.stats.distance_m),together_seconds:Math.round(b.stats.together_seconds)}
  })).sort((a:any,b:any)=>String(b.year).localeCompare(String(a.year)));
  return json({
    day,
    groups,
    totals:{
      years:groups.length,
      items:groups.reduce((n:number,g:any)=>n+g.items.length,0),
      trips:groups.reduce((n:number,g:any)=>n+g.stats.trips,0),
      encounters:groups.reduce((n:number,g:any)=>n+g.stats.encounters,0)
    }
  });
}

async function encounterStats(req:Request){
  await device(req);
  const generated=new Date(),generatedMs=generated.getTime(),currentMonth=today().slice(0,7),bounds=monthBounds(currentMonth);
  const [rows,locations]=await Promise.all([
    ok(db.from("galaxy_encounters").select("id,started_at,ended_at,distance_m,created_by").order("started_at",{ascending:false}).limit(10000)),
    ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,updated_at").order("person"))
  ]);
  const locs=locations||[],mutualReady=locs.length===2&&locs.every((x:any)=>x.sharing&&x.latitude!=null&&x.longitude!=null);
  const updates=locs.map((x:any)=>Date.parse(x.updated_at||"")).filter((n:number)=>Number.isFinite(n));
  const lastMutual=updates.length===2?Math.min(...updates):NaN;
  const fresh=mutualReady&&Number.isFinite(lastMutual)&&generatedMs-lastMutual<=10*60*1000;
  const monthStart=Date.parse(bounds.start),monthEnd=Date.parse(bounds.end);
  let totalSeconds=0,monthSeconds=0,monthCount=0,longest:any=null,longestSeconds=0,validCount=0;
  const recent:any[]=[];
  for(const row of rows||[]){
    const start=Date.parse(row.started_at||"");if(!Number.isFinite(start))continue;
    let end=row.ended_at?Date.parse(row.ended_at):NaN;
    const isOpen=!row.ended_at;
    if(!Number.isFinite(end)){
      if(isOpen&&fresh)end=generatedMs;
      else if(isOpen&&Number.isFinite(lastMutual))end=Math.max(start,Math.min(generatedMs,lastMutual));
      else end=start;
    }
    if(end<start)end=start;
    const seconds=Math.max(0,Math.round((end-start)/1000));
    totalSeconds+=seconds;validCount++;
    if(seconds>longestSeconds){longestSeconds=seconds;longest={id:row.id,started_at:row.started_at,ended_at:row.ended_at,duration_seconds:seconds};}
    if(bogotaDay(row.started_at).startsWith(currentMonth))monthCount++;
    const overlapStart=Math.max(start,monthStart),overlapEnd=Math.min(end,monthEnd);
    if(overlapEnd>overlapStart)monthSeconds+=Math.round((overlapEnd-overlapStart)/1000);
    if(recent.length<8)recent.push({id:row.id,started_at:row.started_at,ended_at:row.ended_at,distance_m:row.distance_m,duration_seconds:seconds,active:isOpen&&fresh});
  }
  const open=(rows||[]).find((x:any)=>!x.ended_at),active=open&&fresh?{
    id:open.id,started_at:open.started_at,distance_m:open.distance_m,
    current_distance_m:mutualReady?Math.round(dist(locs[0],locs[1])):null,
    elapsed_seconds:Math.max(0,Math.round((generatedMs-Date.parse(open.started_at))/1000))
  }:null;
  return json({
    generated_at:generated.toISOString(),
    total_count:validCount,
    completed_count:(rows||[]).filter((x:any)=>!!x.ended_at).length,
    total_seconds:Math.round(totalSeconds),
    average_seconds:validCount?Math.round(totalSeconds/validCount):0,
    longest,
    current_month:{month:currentMonth,count:monthCount,seconds:Math.round(monthSeconds)},
    active,
    recent
  });
}

function frequentPlaceCandidates(rows:any[],places:any[],now=Date.now()){
  const samples=(rows||[]).map((r:any)=>({...r,_t:Date.parse(r.captured_at||"")})).filter((r:any)=>
    Number.isFinite(r._t)&&Number.isFinite(Number(r.latitude))&&Number.isFinite(Number(r.longitude))&&
    (r.accuracy==null||Number(r.accuracy)<=120)&&
    (r.motion==="still"||Math.max(0,Number(r.speed||0))<=0.8)
  ).sort((a:any,b:any)=>a._t-b._t);
  const stays:any[]=[];
  let current:any=null;
  const close=()=>{
    if(!current)return;
    const duration=Math.max(0,current.last-current.start);
    if(current.count>=4&&duration>=8*60*1000)stays.push({
      latitude:current.lat/current.count,longitude:current.lon/current.count,
      started_at:new Date(current.start).toISOString(),ended_at:new Date(current.last).toISOString(),
      duration_ms:duration,day:bogotaDay(new Date(current.start).toISOString())
    });
    current=null;
  };
  for(const row of samples){
    if(!current){current={start:row._t,last:row._t,lat:Number(row.latitude),lon:Number(row.longitude),count:1};continue;}
    const center={latitude:current.lat/current.count,longitude:current.lon/current.count};
    const gap=row._t-current.last,metersAway=dist(center,row);
    if(gap>20*60*1000||metersAway>120){close();current={start:row._t,last:row._t,lat:Number(row.latitude),lon:Number(row.longitude),count:1};continue;}
    current.last=row._t;current.lat+=Number(row.latitude);current.lon+=Number(row.longitude);current.count++;
  }
  close();
  const clusters:any[]=[];
  for(const stay of stays){
    let best:any=null,bestMeters=Infinity;
    for(const cluster of clusters){
      const metersAway=dist(stay,cluster);
      if(metersAway<=160&&metersAway<bestMeters){best=cluster;bestMeters=metersAway;}
    }
    if(!best){
      best={latitude:stay.latitude,longitude:stay.longitude,weight:stay.duration_ms,visits:0,days:new Set<string>(),dwell_ms:0,first_visit:stay.started_at,last_visit:stay.ended_at};
      clusters.push(best);
    }
    const weight=Math.max(1,stay.duration_ms),sum=best.weight+weight;
    best.latitude=(best.latitude*best.weight+stay.latitude*weight)/sum;
    best.longitude=(best.longitude*best.weight+stay.longitude*weight)/sum;
    best.weight=sum;best.visits++;best.days.add(stay.day);best.dwell_ms+=stay.duration_ms;
    if(stay.started_at<best.first_visit)best.first_visit=stay.started_at;
    if(stay.ended_at>best.last_visit)best.last_visit=stay.ended_at;
  }
  const ownPlaces=places||[];
  return clusters.map((cluster:any)=>{
    const days=cluster.days.size,dwellMinutes=Math.round(cluster.dwell_ms/60000),lastMs=Date.parse(cluster.last_visit);
    const nearSaved=ownPlaces.some((p:any)=>dist(cluster,p)<=180);
    const recentDays=Number.isFinite(lastMs)?Math.max(0,(now-lastMs)/86400000):999;
    const score=days*12+cluster.visits*3+Math.min(20,dwellMinutes/30)+Math.max(0,12-recentDays);
    return {
      latitude:Number(cluster.latitude.toFixed(6)),longitude:Number(cluster.longitude.toFixed(6)),
      days,visits:cluster.visits,dwell_minutes:dwellMinutes,
      first_visit:cluster.first_visit,last_visit:cluster.last_visit,
      score:Number(score.toFixed(2)),near_saved:nearSaved
    };
  }).filter((x:any)=>!x.near_saved&&x.days>=3&&x.visits>=3&&x.dwell_minutes>=45&&Date.parse(x.last_visit)>=now-21*86400000)
    .sort((a:any,b:any)=>b.score-a.score||Date.parse(b.last_visit)-Date.parse(a.last_visit)).slice(0,5)
    .map(({near_saved,...x}:any)=>x);
}
async function frequentPlaces(req:Request){
  const d=await device(req),person=String(d.person),since=new Date(Date.now()-45*86400000).toISOString();
  const [rows,places]=await Promise.all([
    ok(db.from("galaxy_location_history").select("latitude,longitude,accuracy,speed,motion,captured_at").eq("person",person).gte("captured_at",since).order("captured_at",{ascending:false}).limit(12000)),
    ok(db.from("galaxy_places").select("id,latitude,longitude").eq("owner",person).limit(500))
  ]);
  const suggestions=frequentPlaceCandidates((rows||[]).slice().reverse(),places||[]);
  return json({suggestions,window_days:45,min_days:3,min_dwell_minutes:45});
}

const gpsExportSets:Record<string,{table:string,columns:string}>={
  history:{table:"galaxy_location_history",columns:"id,person,latitude,longitude,accuracy,speed,heading,motion,captured_at,source_device_id,client_sample_id"},
  trips:{table:"galaxy_trip_history",columns:"id,person,started_at,ended_at,distance_m,duration_s,max_speed,dominant_motion,created_at"},
  tripPoints:{table:"galaxy_trip_points",columns:"id,person,latitude,longitude,created_at"},
  placeEvents:{table:"galaxy_place_events",columns:"id,person,place_id,event,happened_at"}
};
async function gpsHistoryExport(req:Request,body:any){
  const d=await device(req),person=String(d.person),dataset=String(body.dataset||""),cfg=gpsExportSets[dataset];
  if(!cfg)return json({error:"Conjunto GPS no válido."},400);
  const after=Math.max(0,Number(body.after||0)),requested=Math.max(1,Math.min(1000,Number(body.limit||1000)));
  if(!Number.isFinite(after))return json({error:"Cursor GPS no válido."},400);
  let snapshot=Math.max(0,Number(body.snapshot||0));
  if(!snapshot){
    const latest=(await ok(db.from(cfg.table).select("id").eq("person",person).order("id",{ascending:false}).limit(1)))?.[0];
    snapshot=Math.max(0,Number(latest?.id||0));
  }
  if(!snapshot)return json({dataset,rows:[],next:null,done:true,snapshot:0});
  let query=db.from(cfg.table).select(cfg.columns).eq("person",person).gt("id",after).lte("id",snapshot).order("id",{ascending:true}).limit(requested);
  const rows=await ok(query),last=rows?.length?Number(rows[rows.length-1].id):after;
  return json({dataset,rows:rows||[],next:rows?.length?last:null,done:!rows?.length||last>=snapshot||rows.length<requested,snapshot});
}
async function exactCount(table:string,person:string){
  const {count,error}=await db.from(table).select("id",{count:"exact",head:true}).eq("person",person);
  if(error)throw error;return Number(count||0);
}
async function gpsHistoryDelete(req:Request){
  const d=await device(req),person=String(d.person),loc=(await ok(db.from("galaxy_locations").select("trip_active,trip_started_at").eq("person",person).limit(1)))?.[0]||{};
  if(loc.trip_active)return json({error:"Termina el recorrido activo antes de borrar tu historial GPS."},409);
  const [history,trips,tripPoints,placeEvents]=await Promise.all([
    exactCount("galaxy_location_history",person),
    exactCount("galaxy_trip_history",person),
    exactCount("galaxy_trip_points",person),
    exactCount("galaxy_place_events",person)
  ]);
  await Promise.all([
    ok(db.from("galaxy_location_history").delete().eq("person",person)),
    ok(db.from("galaxy_trip_history").delete().eq("person",person)),
    ok(db.from("galaxy_trip_points").delete().eq("person",person)),
    ok(db.from("galaxy_place_events").delete().eq("person",person))
  ]);
  return json({ok:true,person,deleted:{history,trips,tripPoints,placeEvents,total:history+trips+tripPoints+placeEvents},deleted_at:new Date().toISOString()});
}

async function mapState(req:Request,body:any){
  const d=await device(req),person=String(d.person);
  const [locations,places,tripPoints,destinations,contextSettings,sessionRows]=await Promise.all([
    ok(db.from("galaxy_locations").select("*").order("person")),
    ok(db.from("galaxy_places").select("*").order("created_at",{ascending:false}).limit(100)),
    ok(db.from("galaxy_trip_points").select("*").order("created_at",{ascending:false}).limit(500)),
    ok(db.from("galaxy_destinations").select("*")),
    contextOwnSettings(person),
    ok(db.from("galaxy_context_sessions").select("*").eq("person",person).eq("status","active").order("started_at",{ascending:false}).limit(1))
  ]);
  const session=sessionRows?.[0]||null;
  const visibleLocations=privacyVisibleLocations(locations||[],person);
  const visibleTripPoints=privacyVisibleTripRows(tripPoints||[],person,locations||[]);
  const base={locations:visibleLocations,places,tripPoints:visibleTripPoints,destinations,context:{settings:contextSettings,session}};
  if(body.detail!==true)return json(base);
  const [trips,events,encounters,suggestions,etaHistory,contextEvents]=await Promise.all([
    ok(db.from("galaxy_trip_history").select("*").order("started_at",{ascending:false}).limit(40)),
    ok(db.from("galaxy_place_events").select("*").order("happened_at",{ascending:false}).limit(40)),
    ok(db.from("galaxy_encounters").select("*").order("started_at",{ascending:false}).limit(40)),
    ok(db.from("galaxy_context_suggestions").select("*").eq("person",person).eq("status","pending").order("created_at",{ascending:false}).limit(10)),
    session?ok(db.from("galaxy_context_eta_history").select("captured_at,distance_m,eta_s,progress_pct").eq("session_id",session.id).order("captured_at",{ascending:false}).limit(30)):Promise.resolve([]),
    ok(db.from("galaxy_context_events").select("id,event_type,person,partner_person,occurred_at,payload").order("occurred_at",{ascending:false}).limit(30))
  ]);
  const visibleTrips=privacyVisibleTripRows(trips||[],person,locations||[]);
  return json({...base,trips:visibleTrips,events,encounters,context:{settings:contextSettings,session,suggestions:suggestions||[],etaHistory:etaHistory||[],events:contextEvents||[]}});
}

async function placeSave(req:Request,body:any){
  const d=await device(req),person=String(d.person),name=text(body.name,80),kind=String(body.kind||"memory"),latitude=Number(body.latitude),longitude=Number(body.longitude),note=text(body.note,300);
  if(!["home","work","memory","adventure"].includes(kind)||!name||!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)return json({error:"Lugar no válido."},400);
  if(body.id){
    const row=(await ok(db.from("galaxy_places").select("*").eq("id",Number(body.id)).limit(1)))?.[0];
    if(!row||row.owner!==person)return json({error:"No puedes editar este lugar."},403);
    const place=await ok(db.from("galaxy_places").update({name,kind,latitude,longitude,note:note||null}).eq("id",row.id).select("*").single());
    await intelligenceBestEffort("place-update",()=>syncIntelligencePlace(place));
    return json({place});
  }
  const place=await ok(db.from("galaxy_places").insert({owner:person,name,kind,latitude,longitude,note:note||null}).select("*").single());
  await intelligenceBestEffort("place-create",()=>syncIntelligencePlace(place));
  return json({place},201);
}

async function placeDelete(req:Request,body:any){
  const d=await device(req),person=String(d.person),row=(await ok(db.from("galaxy_places").select("id,owner").eq("id",Number(body.id)).limit(1)))?.[0];
  if(!row||row.owner!==person)return json({error:"No puedes borrar este lugar."},403);
  await ok(db.from("galaxy_places").delete().eq("id",row.id));
  await intelligenceBestEffort("place-delete",()=>reconcileIntelligenceCleanup());
  return json({ok:true});
}

async function setStatus(req:Request,body:any){
  const d=await device(req),person=String(d.person),status=text(body.status,40);
  const current=(await ok(db.from("galaxy_locations").select("status").eq("person",person).limit(1)))?.[0]?.status||"";
  await ok(db.from("galaxy_locations").update({status:status||null}).eq("person",person));
  if(String(current||"")!==status){
    const names=await profileNames(),target=person==="0"?"1":"0",name=names[Number(person)]||"Tu persona";
    await dispatchPushEvent(d,target,"status_changed",{title:name+" cambió su estado",body:status||"Quitó su estado actual.",action:"home",senderName:name,entityType:"status",entityId:person});
  }
  return json({ok:true,status});
}

async function transportSet(req:Request,body:any){
  const d=await device(req),person=String(d.person),raw=String(body.preference||"");
  if(!["","motorcycle","transit"].includes(raw))return json({error:"Preferencia de transporte no válida."},400);
  const preference=raw||null;
  await ok(db.from("galaxy_locations").upsert({person,transport_preference:preference,updated_at:new Date().toISOString()},{onConflict:"person"}));
  return json({ok:true,transport_preference:preference});
}

async function destinationSave(req:Request,body:any){
  const d=await device(req),person=String(d.person),kind=String(body.kind||""),label=text(body.label,80);
  if(kind==="none"){
    await ok(db.from("galaxy_destinations").delete().eq("person",person));
    return json({ok:true});
  }
  if(kind==="person"){
    const target=String(body.target_person||"");
    if(!["0","1"].includes(target)||target===person)return json({error:"Destino no válido."},400);
    await ok(db.from("galaxy_destinations").upsert({person,kind:"person",target_person:target,place_id:null,label:label||"Mi persona",active:true,updated_at:new Date().toISOString()},{onConflict:"person"}));
  }else if(kind==="place"){
    const place=(await ok(db.from("galaxy_places").select("id,name").eq("id",Number(body.place_id)).limit(1)))?.[0];
    if(!place)return json({error:"Lugar no encontrado."},404);
    await ok(db.from("galaxy_destinations").upsert({person,kind:"place",target_person:null,place_id:place.id,label:label||place.name,active:true,updated_at:new Date().toISOString()},{onConflict:"person"}));
  }else return json({error:"Destino no válido."},400);
  return json({ok:true});
}

function dominant(rows:any[]){
  const counts=new Map<string,number>();
  for(const r of rows){if(r.motion)counts.set(r.motion,(counts.get(r.motion)||0)+1);}
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
}

async function tripAction(req:Request,body:any){
  const d=await device(req),person=String(d.person),loc=(await ok(db.from("galaxy_locations").select("*").eq("person",person).limit(1)))?.[0]||{};
  if(body.operation==="start"){
    const started=new Date().toISOString();
    await ok(db.from("galaxy_trip_points").delete().eq("person",person));
    await ok(db.from("galaxy_locations").upsert({person,trip_active:true,trip_started_at:started,transport_preference:loc.transport_preference||null,sharing:!!loc.sharing,updated_at:new Date().toISOString()},{onConflict:"person"}));
    return json({ok:true,trip_active:true,trip_started_at:started});
  }
  if(body.operation==="stop"){
    if(!loc.trip_active||!loc.trip_started_at)return json({ok:true,trip_active:false});
    const rows=await ok(db.from("galaxy_location_history").select("latitude,longitude,speed,motion,captured_at").eq("person",person).gte("captured_at",loc.trip_started_at).order("captured_at",{ascending:true}).limit(5000));
    let meters=0,maxSpeed=0;
    for(let i=1;i<(rows||[]).length;i++)meters+=dist(rows[i-1],rows[i]);
    for(const r of rows||[])maxSpeed=Math.max(maxSpeed,Number(r.speed)||0);
    const ended=new Date(),duration=Math.max(0,Math.round((ended.getTime()-Date.parse(loc.trip_started_at))/1000));
    const trip=await ok(db.from("galaxy_trip_history").insert({person,started_at:loc.trip_started_at,ended_at:ended.toISOString(),distance_m:Math.round(meters),duration_s:duration,max_speed:maxSpeed||null,dominant_motion:dominant(rows||[])}).select("*").single());
    await ok(db.from("galaxy_locations").update({trip_active:false,trip_started_at:null,updated_at:ended.toISOString()}).eq("person",person));
    await ok(db.from("galaxy_trip_points").delete().eq("person",person));
    await intelligenceBestEffort("trip-complete",()=>syncIntelligenceTrip(trip));
    return json({ok:true,trip_active:false,trip});
  }
  return json({error:"Operación de recorrido no válida."},400);
}

async function listBucket(bucket:string,person:string|null=null){
  const found:any[]=[],privacy=person?await capsulePrivacyContext(person):null;
  for(const prefix of ["","0","1"]){
    const {data,error}=await db.storage.from(bucket).list(prefix,{limit:100,sortBy:{column:"created_at",order:"desc"}});
    if(error)continue;
    for(const file of data||[]){
      if(!file.id||file.name===".emptyFolderPlaceholder")continue;
      const path=prefix?prefix+"/"+file.name:file.name;
      if(person&&privacy&&!capsuleObjectVisible(bucket,path,person,privacy))continue;
      const url=await signed(bucket,path,1800);
      if(url)found.push({path,name:file.name,originalName:file.metadata?.originalName||file.metadata?.original_name||file.name,mime:file.metadata?.mimetype||"",size:file.metadata?.size||0,created:file.created_at||file.updated_at||null,url});
    }
  }
  return found;
}

async function mediaList(req:Request,body:any){
  const d=await device(req),person=String(d.person);
  const kind=String(body.kind||"photo");
  if(kind==="photo")return json({items:await listBucket("galaxy-photos",person)});
  if(kind==="music")return json({items:await listBucket("galaxy-music",person)});
  if(kind==="voice")return json({items:await listBucket("galaxy-voice",person)});
  return json({error:"Multimedia no válida."},400);
}

async function mediaDelete(req:Request,body:any){
  const d=await device(req),kind=String(body.kind||""),path=text(body.path,400);
  const bucket=kind==="photo"?"galaxy-photos":kind==="music"?"galaxy-music":kind==="voice"?"galaxy-voice":"";
  if(!bucket||!path||path.startsWith("__backup/"))return json({error:"Archivo no válido."},400);
  if(kind==="voice"&&!path.startsWith(String(d.person)+"/"))return json({error:"Solo puedes borrar tus audios."},403);
  await ok(db.storage.from(bucket).remove([path]));
  if(kind==="photo"){await ok(db.from("galaxy_bond_config").update({photo_path:""}).eq("photo_path",path));await ok(db.from("galaxy_photo_context").delete().eq("path",path));await intelligenceBestEffort("photo-delete",()=>deleteIntelligenceSource("photo",path));}
  return json({ok:true});
}

function uploadRules(kind:string){
  const image={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"} as Record<string,string>;
  const audio={"audio/mpeg":"mp3","audio/ogg":"ogg","audio/webm":"webm","audio/mp4":"m4a"} as Record<string,string>;
  if(kind==="photo")return {bucket:"galaxy-photos",limit:12*1024*1024,mimes:new Set(Object.keys(image)),ext:image,pathKind:"photo"};
  if(kind==="music")return {bucket:"galaxy-music",limit:20*1024*1024,mimes:new Set(["audio/mpeg"]),ext:{"audio/mpeg":"mp3"} as Record<string,string>,pathKind:"music"};
  if(kind==="voice")return {bucket:"galaxy-voice",limit:5*1024*1024,mimes:new Set(Object.keys(audio)),ext:audio,pathKind:"voice"};
  if(kind==="chat-photo")return {bucket:"galaxy-chat-media",limit:15*1024*1024,mimes:new Set(Object.keys(image)),ext:image,pathKind:"photo"};
  if(kind==="chat-gif")return {bucket:"galaxy-chat-media",limit:10*1024*1024,mimes:new Set(["image/gif","image/webp"]),ext:{"image/gif":"gif","image/webp":"webp"} as Record<string,string>,pathKind:"gif"};
  if(kind==="chat-video")return {bucket:"galaxy-chat-media",limit:60*1024*1024,mimes:new Set(["video/mp4","video/webm"]),ext:{"video/mp4":"mp4","video/webm":"webm"} as Record<string,string>,pathKind:"video"};
  if(kind==="chat-audio")return {bucket:"galaxy-chat-media",limit:15*1024*1024,mimes:new Set(Object.keys(audio)),ext:audio,pathKind:"audio"};
  if(kind==="chat-file")return {bucket:"galaxy-chat-media",limit:30*1024*1024,mimes:null,ext:null,pathKind:"file",allowAnyMime:true};
  return null;
}

async function upload(req:Request){
  const d=await device(req),kind=String(req.headers.get("x-media-kind")||""),rules=uploadRules(kind);
  if(!rules)return json({error:"Tipo de archivo no válido."},400);
  const mime=String(req.headers.get("content-type")||"application/octet-stream").split(";")[0].trim().toLowerCase()||"application/octet-stream";
  if(rules.mimes&&!rules.mimes.has(mime))return json({error:"Formato de archivo no permitido."},415);
  const declared=Number(req.headers.get("content-length")||0);
  if(declared>rules.limit)return json({error:"El archivo supera el límite permitido."},413);
  const bytes=new Uint8Array(await req.arrayBuffer());
  if(bytes.length<1||bytes.length>rules.limit)return json({error:"El archivo supera el límite permitido."},413);
  let originalName="archivo";
  try{originalName=decodeURIComponent(String(req.headers.get("x-file-name")||"archivo")).slice(0,300)||"archivo";}catch{}
  const originalExt=originalName.includes(".")?String(originalName.split(".").pop()||"").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,12):"";
  const extension=rules.ext?.[mime]||originalExt||"bin";
  const path=String(d.person)+"/"+String(rules.pathKind||kind).replace(/[^a-z0-9_-]/gi,"")+"-"+crypto.randomUUID()+"."+extension;
  const cacheControl=kind.startsWith("chat-")?"0":"3600";
  const {error}=await db.storage.from(rules.bucket).upload(path,bytes,{contentType:mime,upsert:false,cacheControl,metadata:{originalName}});
  if(error)throw error;
  const signedUrl=await signed(rules.bucket,path,3600);
  return json({path,mime,url:signedUrl,name:originalName,size:bytes.length},201);
}

function nextPendingPlan(items:any[],day:string){
 const rows=(items||[]).filter((item:any)=>item?.data?.done!==true).map((item:any)=>({
  title:text(item?.data?.title||"Próximo plan",120),
  date:validDate(item?.data?.date)?String(item.data.date):null,
  created:String(item?.created||"")
 })).filter((row:any)=>!row.date||row.date>=day);
 rows.sort((a:any,b:any)=>{
  if(a.date&&b.date)return a.date.localeCompare(b.date);
  if(a.date)return-1;if(b.date)return 1;
  return a.created.localeCompare(b.created);
 });
 return rows[0]||null;
}
function widgetEtaMinutes(distanceM:number,transport:string,speed:number|null){
 if(!Number.isFinite(distanceM)||distanceM<0)return null;
 const fallbacks:Record<string,number>={walking:1.35,motorcycle:8.3,transit:5,vehicle:7.5,auto:6};
 const observed=Number(speed),metersPerSecond=Number.isFinite(observed)&&observed>0.8?observed:(fallbacks[transport]||fallbacks.auto);
 return Math.max(1,Math.round((distanceM*1.15)/metersPerSecond/60));
}
async function moments(req:Request){
  const d=await device(req);
  if(!["0","1"].includes(String(d.person)))return json({error:"Dispositivo no válido"},401);
  const [settings,events,plans,config,gestures,daily,locations,presence,participation]=await Promise.all([
    ok(db.from("galaxy_settings").select("data").eq("id",1).single()),
    ok(db.from("galaxy_items").select("id,data").eq("kind","event")),
    ok(db.from("galaxy_items").select("id,data,created").eq("kind","plan").order("created",{ascending:false}).limit(100)),
    ok(db.from("galaxy_bond_config").select("photo_path").eq("id",1).maybeSingle()),
    ok(db.from("galaxy_bond").select("id,author,created,data").eq("type","gesture").neq("author",d.person).gte("created",new Date(Date.now()-7*86400000).toISOString()).order("created",{ascending:false}).limit(30)),
    ok(db.from("galaxy_daily").select("person,mood").eq("day",today())),
    ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,motion,status,speed,transport_preference,updated_at").order("person")),
    ok(db.from("galaxy_presence").select("*").order("person")),
    ok(db.from("galaxy_bond_participation").select("day,person"))
  ]);
  const names=(Array.isArray(settings?.data?.names)?settings.data.names:["Nosotros","Dos"]).slice(0,2).map((name:unknown)=>text(name,40));
  const person=String(d.person),partner=person==="0"?"1":"0";
  let photoUrl=null;if(config?.photo_path)photoUrl=await signedForPerson("galaxy-photos",String(config.photo_path),person,300);
  const mood=(daily||[]).find((x:any)=>String(x.person)===partner)?.mood||null;
  const loc=(locations||[]).find((x:any)=>String(x.person)===partner),own=(locations||[]).find((x:any)=>String(x.person)===person);
  const p=(presence||[]).find((x:any)=>String(x.person)===partner),legacy=settings?.data?.presence?.[partner]||{};
  const battery=p?(p.share_battery?p.battery:null):(legacy.shareBattery===true?legacy.battery:null);
  const listening=p?(p.share_song?text(p.song_title,160):""):(legacy.shareListening===true?text(legacy.listening,160):"");
  const nowMs=Date.now(),fresh=(row:any)=>!!row?.updated_at&&nowMs-Date.parse(row.updated_at)<=15*60*1000;
  const bothSharing=!!own?.sharing&&!!loc?.sharing&&fresh(own)&&fresh(loc)&&[own?.latitude,own?.longitude,loc?.latitude,loc?.longitude].every((v:any)=>Number.isFinite(Number(v)));
  const distanceM=bothSharing?Math.round(dist(own,loc)):null;
  const transport=text(own?.transport_preference||"auto",24)||"auto";
  const etaMinutes=distanceM==null?null:widgetEtaMinutes(distanceM,transport,Number.isFinite(Number(own?.speed))?Number(own.speed):null);
  const progress=computeBondProgress(participation||[],new Date());
  const garden={...progress.garden,currentStreak:progress.currentStreak,recordStreak:progress.recordStreak};
  const now={mood,sharing:!!loc?.sharing,motion:loc?.sharing?loc?.motion:null,status:loc?.sharing?loc?.status:null,battery,listening,updatedAt:p?.updated_at||loc?.updated_at||legacy.updatedAt||null};
  const visibleGestures=(gestures||[]).filter((g:any)=>!!(g?.data?.gesture||g?.data?.gestureId)).map((g:any)=>({
    id:g.id,gesture:g.data?.gesture||g.data?.gestureId,created:g.created,author:g.author,
    name:text(g.data?.name||"",40),icon:text(g.data?.icon||"",40),text:text(g.data?.text||"",180),behavior:text(g.data?.behavior||"message",30)
  }));
  return json({
    names,nextEvent:nextCalendarEvent(events||[],today()),nextPlan:nextPendingPlan(plans||[],today()),
    photoUrl,now,distanceM,etaMinutes,garden,gestures:visibleGestures
  });
}
Deno.serve(async req=>{
  if(req.method!=="POST")return json({error:"Método no permitido"},405);
  try{
    if(req.headers.get("x-mobile-action")==="upload")return await upload(req);
    const declaredBody=Number(req.headers.get("content-length")||0);
    if(declaredBody>3*1024*1024)return json({error:"Solicitud demasiado grande"},413);
    const rawBody=await req.text();
    if(new TextEncoder().encode(rawBody).length>3*1024*1024)return json({error:"Solicitud demasiado grande"},413);
    let body:any;
    try{body=JSON.parse(rawBody||"{}");}catch{return json({error:"JSON no válido"},400);}
    const action=String(body.action||"");
    if(action==="chat-process-due")return await chatProcessDue(req);
    if(action==="pair")return await pair(body);
    if(action==="pair-code-create")return await pairCodeCreate(req,body);
    if(action==="profile-repair")return await profileRepair(req,body);
    if(action==="device-revoke")return await deviceRevoke(req,body);
    if(action==="push-client-config")return await pushClientConfig(req);
    if(action==="push-token-register")return await pushTokenRegister(req,body);
    if(action==="push-token-unregister")return await pushTokenUnregister(req);
    if(action==="push-preferences")return await pushPreferences(req,body);
    if(action==="moments")return await moments(req);
    if(action==="gesture")return await gesture(req,body);
    if(action==="history")return await history(req,body);
    if(action==="location")return await location(req,body);
    if(action==="mobile-state")return await mobileState(req);
    if(action==="chat-state")return await chatState(req,body);
    if(action==="chat-send")return await chatSend(req,body);
    if(action==="chat-poll")return await chatPoll(req,body);
    if(action==="chat-checklist")return await chatChecklist(req,body);
    if(action==="chat-read")return await chatRead(req,body);
    if(action==="chat-edit")return await chatEdit(req,body);
    if(action==="chat-delete")return await chatDelete(req,body);
    if(action==="chat-react")return await chatReact(req,body);
    if(action==="chat-pin")return await chatPin(req,body);
    if(action==="chat-favorite")return await chatFavorite(req,body);
    if(action==="chat-pins")return await chatCollection(req,body,"pins");
    if(action==="chat-saved")return await chatCollection(req,body,"saved");
    if(action==="chat-search")return await chatSearch(req,body);
    if(action==="chat-presence")return await chatPresence(req,body);
    if(action==="chat-metric")return await chatMetric(req,body);
    if(action==="chat-schedule-update")return await chatScheduleUpdate(req,body);
    if(action==="chat-preferences")return await chatPreferences(req,body);
    if(action==="chat-open-once")return await chatOpenOnce(req,body);
    if(action==="chat-transcript")return await chatTranscript(req,body);
    if(action==="chat-translate")return await chatTranslate(req,body);
    if(action==="chat-transcript-delete")return await chatTranscriptDelete(req,body);
    if(action==="chat-shared")return await chatShared(req,body);
    if(action==="chat-albums")return await chatAlbums(req,body);
    if(action==="chat-stickers")return await chatStickers(req,body);
    if(action==="chat-live-location")return await chatLiveLocation(req,body);
    if(action==="chat-gif-import")return await chatGifImport(req,body);
    if(action==="notifications-list")return await notificationsList(req,body);
    if(action==="notifications-read")return await notificationsRead(req,body);
    if(action==="item-save")return await itemSave(req,body);
    if(action==="item-delete")return await itemDelete(req,body);
    if(action==="settings-save")return await settingsSave(req,body);
    if(action==="daily-save")return await dailySave(req,body);
    if(action==="presence-set")return await presenceSet(req,body);
    if(action==="backup-export")return await backupExport(req);
    if(action==="backup-restore")return await backupRestore(req,body);
    if(action==="backup-import")return await backupRestore(req,body);
    if(action==="bond-send-gesture")return await bondSendGesture(req,body);
    if(action==="bond-gesture-list")return await bondGestureCatalog(req);
    if(action==="bond-gesture-save")return await bondGestureSave(req,body);
    if(action==="bond-gesture-delete")return await bondGestureDelete(req,body);
    if(action==="bond-save")return await bondSave(req,body);
    if(action==="bond-update")return await bondUpdate(req,body);
    if(action==="bond-guess")return await bondGuess(req,body);
    if(action==="bond-delete")return await bondDelete(req,body);
    if(action==="bond-widget")return await bondWidget(req,body);
    if(action==="map-state")return await mapState(req,body);
    if(action==="context-state")return await contextStateAction(req);
    if(action==="context-settings")return await contextSettingsAction(req,body);
    if(action==="context-session")return await contextSessionAction(req,body);
    if(action==="context-events")return await contextEventsFeed(req,body);
    if(action==="context-suggestion")return await contextSuggestionAction(req,body);
    if(action==="context-recap")return await contextRecapAction(req,body);
    if(action==="intelligence-search")return await intelligenceSearch(req,body);
    if(action==="intelligence-ask")return await intelligenceAsk(req,body);
    if(action==="intelligence-connections")return await intelligenceConnections(req,body);
    if(action==="intelligence-narrate")return await intelligenceNarrate(req,body);
    if(action==="intelligence-book")return await intelligenceBook(req,body);
    if(action==="intelligence-transcribe")return await intelligenceTranscribe(req,body);
    if(action==="intelligence-transcript-delete")return await intelligenceTranscriptDelete(req,body);
    if(action==="intelligence-index")return await intelligenceIndexAction(req,body);
    if(action==="goals-engine")return await goalsEngine(req,body);
    if(action==="date-engine")return await dateEngine(req,body);
    if(action==="insights-summary")return await insightsSummary(req,body);
    if(action==="monthly-summary")return await monthlySummary(req,body);
    if(action==="today-history")return await todayHistory(req,body);
    if(action==="encounter-stats")return await encounterStats(req);
    if(action==="frequent-places")return await frequentPlaces(req);
    if(action==="gps-history-export")return await gpsHistoryExport(req,body);
    if(action==="gps-history-delete")return await gpsHistoryDelete(req);
    if(action==="place-save")return await placeSave(req,body);
    if(action==="place-delete")return await placeDelete(req,body);
    if(action==="status-set")return await setStatus(req,body);
    if(action==="transport-set")return await transportSet(req,body);
    if(action==="destination-save")return await destinationSave(req,body);
    if(action==="trip")return await tripAction(req,body);
    if(action==="media-list")return await mediaList(req,body);
    if(action==="media-delete")return await mediaDelete(req,body);
    return json({error:"Acción no válida"},400);
  }catch(e){
    const err:any=e;
    const message=e instanceof Error?e.message:String(err?.message||"");
    console.error("android-companion",{
      name:e instanceof Error?e.name:String(err?.name||""),
      message,
      code:String(err?.code||"").slice(0,80),
      details:String(err?.details||"").slice(0,600),
      hint:String(err?.hint||"").slice(0,600)
    });
    if(/Dispositivo|vinculado|revocado/i.test(message))return json({error:"Dispositivo revocado o no válido"},401);
    if(/límite|limite|espera/i.test(message))return json({error:message||"Espera un momento"},429);
    if(/no válido|no válida|Completa|Elige|Escribe|Ponle|Fecha|contenido/i.test(message))return json({error:message},400);
    return json({error:"No se pudo completar la solicitud"},503);
  }
});
