import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { aggregateInsightRows, evaluateAchievements, isInsightVisibleItem, periodBounds, previousPeriod } from "./insights.ts";
import { QUESTION_DECKS, buildDateRecap, buildSequentialPlan, buildSurpriseExperience, normalizePlanCategory, questionById, roulettePendingPlans, selectQuestion } from "./date-engine.ts";
import { buildGoalDateSuggestions, buildGoalInsightSummary, computeGoalProgress, conversionDraft, normalizeContribution, normalizeGoalInput, reorderStepIds } from "./goals-engine.ts";
import { BUILTIN_GESTURES, computeBondProgress, gestureSnapshot, normalizeCustomGesture, resolveGesture } from "./bond-engine.ts";
import { PUSH_EVENT_TYPES, sanitizePushPayload, sendFcmData } from "./push-engine.ts";
import { CONTEXT_EVENTS, buildDateContextRecap, buildEncounterSuggestion, buildTripContextRecap, contextStep, emptyContextState, haversineM, summarizeTrack } from "./context-engine.ts";

const url=Deno.env.get("SUPABASE_URL")!;
// FCM HTTP v1 transport lives in push-engine.ts; credentials are server-side only.
const FCM_HTTP_V1="https://fcm.googleapis.com/v1/projects/";
const FCM_OAUTH_TOKEN_URL="https://oauth2.googleapis.com/token";
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
  const hash=await sha(token),rows=await ok(db.from("galaxy_devices").select("id,person,name,revoked_at").eq("token_hash",hash).is("revoked_at",null).limit(1));
  if(!rows?.length)throw new Error("Dispositivo revocado o no válido");
  const d=rows[0];
  await ok(db.from("galaxy_devices").update({last_seen_at:new Date().toISOString()}).eq("id",d.id));
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
 return row||{person,near_enabled:false,near_distance_m:300,near_cooldown_minutes:60,arrived_safe_enabled:false,date_suggestions:true,memory_suggestions:true,shared_trip_detection:true};
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
 return inserted?.[0]||await contextEventByDedupe(key);
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
  const target=person==="0"?"1":"0";
  await dispatchPushEvent(d,target,"arrived_safe",{title:"Llegó bien",body:(payload.label?"Llegó a "+String(payload.label)+".":"Llegó a su destino.")});
 }
}
async function contextCreateSuggestions(eventRow:any,event:any,settings:any[]){
 if(event.type!=="ENCOUNTER_ENDED")return;
 const payload=event.payload||{},started=Date.parse(String(payload.startedAt||"")),ended=Date.parse(String(payload.endedAt||event.occurredAt||""));
 const durationS=Number.isFinite(started)&&Number.isFinite(ended)?Math.max(0,Math.round((ended-started)/1000)):0;
 const allowMemory=(settings||[]).some((x:any)=>x.memory_suggestions!==false);
 const allowDate=(settings||[]).some((x:any)=>x.date_suggestions!==false);
 let place:any=null;
 if(Number.isFinite(ended)){
  const recent=(await ok(db.from("galaxy_place_events").select("place_id,happened_at").gte("happened_at",new Date(ended-4*3600000).toISOString()).lte("happened_at",new Date(ended+15*60000).toISOString()).order("happened_at",{ascending:false}).limit(10)))||[];
  if(recent.length)place=(await ok(db.from("galaxy_places").select("id,name,kind").eq("id",recent[0].place_id).limit(1)))?.[0]||null;
 }
 if(allowMemory&&durationS>=5*60){
  const suggestion=buildEncounterSuggestion({encounter:{id:eventRow.id,started_at:payload.startedAt,ended_at:payload.endedAt||event.occurredAt},place,photos:[],songs:[]});
  await ok(db.from("galaxy_context_suggestions").upsert({kind:"memory",source_event_id:eventRow.id,person:null,status:"pending",payload:suggestion},{onConflict:"source_event_id,kind",ignoreDuplicates:true}));
 }
 if(allowDate&&durationS>=2*3600){
  await ok(db.from("galaxy_context_suggestions").upsert({
   kind:"date",source_event_id:eventRow.id,person:null,status:"pending",
   payload:{question:"¿Esto fue una cita?",requiresConfirmation:true,durationS,place:place?{id:place.id,name:place.name,kind:place.kind}:null}
  },{onConflict:"source_event_id,kind",ignoreDuplicates:true}));
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
 const result=contextStep(previous,{at:now.toISOString(),people,places:places||[],destinations},{nearProfiles});
 await ok(db.from("galaxy_context_state").upsert({singleton:true,data:result.state,updated_at:now.toISOString()},{onConflict:"singleton"}));
 for(const event of result.events||[]){
  const row=await persistContextEvent(d,event);
  if(!row)continue;
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
  shared_trip_detection:Object.hasOwn(body,"sharedTripDetection")?!!body.sharedTripDetection:current.shared_trip_detection!==false,
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
  const now=new Date().toISOString();
  await ok(db.from("galaxy_context_sessions").update({status:"cancelled",ended_at:now,updated_at:now}).eq("person",person).eq("status","active"));
  await ok(db.from("galaxy_destinations").delete().eq("person",person));
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
 const d=await device(req),operation=String(body.operation||"list");
 if(operation==="list"){
  const rows=await ok(db.from("galaxy_context_suggestions").select("*").eq("status","pending").order("created_at",{ascending:false}).limit(30));
  return json({suggestions:rows||[]});
 }
 const id=String(body.id||"");if(!id)return json({error:"Sugerencia no válida."},400);
 const row=(await ok(db.from("galaxy_context_suggestions").select("*").eq("id",id).limit(1)))?.[0];
 if(!row)return json({error:"La sugerencia ya no existe."},404);
 if(operation==="dismiss"||operation==="accept"){
  const status=operation==="accept"?"accepted":"dismissed",resolved=new Date().toISOString();
  await ok(db.from("galaxy_context_suggestions").update({status,resolved_at:resolved,person:String(d.person)}).eq("id",id).eq("status","pending"));
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
  ok(db.from("galaxy_context_suggestions").select("*").eq("status","pending").order("created_at",{ascending:false}).limit(10)),
  ok(db.from("galaxy_context_events").select("id,event_type,person,partner_person,occurred_at,payload").order("occurred_at",{ascending:false}).limit(20))
 ]);
 const session=sessionRows?.[0]||null;
 const etaHistory=session?await ok(db.from("galaxy_context_eta_history").select("captured_at,distance_m,eta_s,progress_pct").eq("session_id",session.id).order("captured_at",{ascending:false}).limit(30)):[];
 return json({settings,session,etaHistory:etaHistory||[],suggestions:suggestions||[],events:events||[]});
}
async function contextWindowAssets(startIso:string,endIso:string,person:string){
 const start=Date.parse(startIso),end=Date.parse(endIso);
 const [track,placeEvents,memories,songs,photos]=await Promise.all([
  ok(db.from("galaxy_location_history").select("person,latitude,longitude,accuracy,speed,heading,motion,captured_at").eq("person",person).gte("captured_at",startIso).lte("captured_at",endIso).order("captured_at",{ascending:true}).limit(5000)),
  ok(db.from("galaxy_place_events").select("place_id,happened_at").eq("person",person).gte("happened_at",startIso).lte("happened_at",endIso).order("happened_at",{ascending:true}).limit(100)),
  ok(db.from("galaxy_items").select("id,data,created").eq("kind","memory").gte("created",new Date(start-12*3600000).toISOString()).lte("created",new Date(end+12*3600000).toISOString()).limit(100)),
  ok(db.from("galaxy_items").select("id,data,created").eq("kind","song").gte("created",new Date(start-24*3600000).toISOString()).lte("created",new Date(end+24*3600000).toISOString()).limit(100)),
  listBucket("galaxy-photos")
 ]);
 const ids=[...new Set((placeEvents||[]).map((x:any)=>Number(x.place_id)).filter(Number.isFinite))];
 const places=ids.length?await ok(db.from("galaxy_places").select("id,name,kind").in("id",ids)):[];
 const photoRows=(photos||[]).filter((x:any)=>{const t=Date.parse(String(x.created||""));return Number.isFinite(t)&&t>=start-6*3600000&&t<=end+6*3600000;}).slice(0,40);
 return {track:track||[],places:places||[],photos:photoRows,songs:(songs||[]).map((x:any)=>({id:x.id,title:text(x.data?.title||"Canción",160),created:x.created})),memories:memories||[]};
}
async function contextRecapAction(req:Request,body:any){
 const d=await device(req),kind=String(body.kind||""),person=String(body.person??d.person);
 if(kind==="date"){
  const event=(await ok(db.from("galaxy_context_events").select("*").eq("id",String(body.sourceEventId||"")).limit(1)))?.[0];
  if(!event||event.event_type!=="ENCOUNTER_ENDED")return json({error:"Encuentro no encontrado."},404);
  const start=String(event.payload?.startedAt||""),end=String(event.payload?.endedAt||event.occurred_at||"");
  if(!start||!end)return json({error:"Encuentro incompleto."},409);
  const assets=await contextWindowAssets(start,end,person);
  return json({recap:buildDateContextRecap({encounter:{started_at:start,ended_at:end},...assets})});
 }
 if(kind==="trip"){
  const trip=(await ok(db.from("galaxy_trip_history").select("*").eq("id",Number(body.tripId)).limit(1)))?.[0];
  if(!trip)return json({error:"Recorrido no encontrado."},404);
  if(String(trip.person)!==person&&person!==String(d.person))return json({error:"Recorrido no disponible."},403);
  const assets=await contextWindowAssets(String(trip.started_at),String(trip.ended_at),String(trip.person));
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
  const {error}=await db.from("galaxy_location_history").insert(row);
  if(error&&error.code!=="23505")throw error;
  return json({ok:true});
}

async function smartPlaces(d:any,p:any){
  const places=await ok(db.from("galaxy_places").select("id,name,latitude,longitude,kind").eq("owner",d.person).in("kind",["home","work"])),now=Date.now();
  for(const place of places||[]){
    const meters=dist({latitude:p.lat,longitude:p.lon},place),presence=(await ok(db.from("galaxy_device_place_presence").select("*").eq("device_id",d.id).eq("place_id",place.id).limit(1)))?.[0];
    if(meters<=80){
      if(!presence){await ok(db.from("galaxy_device_place_presence").insert({device_id:d.id,place_id:place.id,entered_at:new Date().toISOString(),arrived:false}));continue;}
      if(!presence.arrived&&now-Date.parse(presence.entered_at)>=45000){
        await ok(db.from("galaxy_place_events").insert({person:d.person,place_id:place.id,event:"arrived"}));
        await ok(db.from("galaxy_device_place_presence").update({arrived:true}).eq("device_id",d.id).eq("place_id",place.id));
        await ok(db.from("galaxy_locations").update({status:"Llegué a "+place.name}).eq("person",d.person));
      }
    }else if(meters>150&&presence){
      if(presence.arrived)await ok(db.from("galaxy_place_events").insert({person:d.person,place_id:place.id,event:"left"}));
      await ok(db.from("galaxy_device_place_presence").delete().eq("device_id",d.id).eq("place_id",place.id));
    }
  }
}

async function encounter(){
  const [locs,runtime,openRows]=await Promise.all([
    ok(db.from("galaxy_locations").select("person,latitude,longitude,sharing,updated_at").eq("sharing",true)),
    ok(db.from("galaxy_encounter_runtime").select("*").eq("singleton",true).single()),
    ok(db.from("galaxy_encounters").select("id,started_at").is("ended_at",null).limit(1))
  ]);
  const open=openRows?.[0];
  if(!locs||locs.length!==2||locs.some((x:any)=>x.latitude==null||x.longitude==null)){
    if(runtime.near_since)await ok(db.from("galaxy_encounter_runtime").update({near_since:null}).eq("singleton",true));
    if(open)await ok(db.from("galaxy_encounters").update({ended_at:new Date().toISOString()}).eq("id",open.id));
    return;
  }
  const meters=dist(locs[0],locs[1]);
  if(meters<=80){
    if(!runtime.near_since){await ok(db.from("galaxy_encounter_runtime").update({near_since:new Date().toISOString()}).eq("singleton",true));return;}
    if(!open&&Date.now()-Date.parse(runtime.near_since)>=60000)await ok(db.from("galaxy_encounters").insert({started_at:runtime.near_since,distance_m:Math.round(meters),created_by:locs[0].person}));
  }else if(meters>150){
    if(runtime.near_since)await ok(db.from("galaxy_encounter_runtime").update({near_since:null}).eq("singleton",true));
    if(open)await ok(db.from("galaxy_encounters").update({ended_at:new Date().toISOString()}).eq("id",open.id));
  }
}

async function location(req:Request,body:any){
  const d=await device(req),now=new Date().toISOString();
  if(body.sharing===false){
    await ok(db.from("galaxy_locations").update({sharing:false,latitude:null,longitude:null,accuracy:null,speed:null,heading:null,motion:null,status:null,updated_at:now}).eq("person",d.person));
    await ok(db.from("galaxy_device_place_presence").delete().eq("device_id",d.id));
    await encounter();
    return json({ok:true});
  }
  const p=point(body),existing=(await ok(db.from("galaxy_locations").select("*").eq("person",d.person).limit(1)))?.[0]||{};
  await ok(db.from("galaxy_locations").upsert({person:d.person,sharing:true,latitude:p.lat,longitude:p.lon,accuracy:p.accuracy,speed:p.speed,heading:p.heading,motion:p.motion,status:existing.status||null,trip_active:!!existing.trip_active,trip_started_at:existing.trip_started_at||null,transport_preference:existing.transport_preference||null,updated_at:now},{onConflict:"person"}));
  if(body.history===true)await history(req,body);
  if(existing.trip_active&&body.trip_point===true)await ok(db.from("galaxy_trip_points").insert({person:d.person,latitude:p.lat,longitude:p.lon}));
  await smartPlaces(d,p);await encounter();
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
async function savePushPreferences(deviceId:string,value:any){
 const enabled=pushEventEnabledMap(value),now=new Date().toISOString();
 await ok(db.from("galaxy_push_subscriptions").upsert(
  PUSH_EVENT_TYPES.map(event_type=>({device_id:deviceId,event_type,enabled:!!enabled[event_type],updated_at:now})),
  {onConflict:"device_id,event_type"}
 ));
 return enabled;
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
async function dispatchPushEvent(sourceDevice:any,targetPerson:string,eventType:string,payload:any){
 if(!PUSH_EVENT_TYPES.includes(eventType))throw new Error("Tipo de evento push no válido.");
 const sanitized=sanitizePushPayload(eventType,payload);
 const event=await ok(db.from("galaxy_push_events").insert({
  source_device_id:sourceDevice?.id||null,source_person:String(sourceDevice?.person||"0"),target_person:targetPerson,event_type:eventType,payload:sanitized
 }).select("id").single());
 sanitized.eventId=String(event.id);
 const [devices,tokens,subscriptions]=await Promise.all([
  ok(db.from("galaxy_devices").select("id").eq("person",targetPerson).is("revoked_at",null).limit(20)),
  ok(db.from("galaxy_push_tokens").select("device_id,token").limit(50)),
  ok(db.from("galaxy_push_subscriptions").select("device_id,event_type,enabled").eq("event_type",eventType).eq("enabled",true).limit(50))
 ]);
 const allowed=new Set((subscriptions||[]).map((row:any)=>String(row.device_id)));
 const tokenByDevice=new Map((tokens||[]).map((row:any)=>[String(row.device_id),String(row.token)]));
 const credentials=fcmCredentials(),deliveries:any[]=[];
 for(const target of devices||[]){
  const deviceId=String(target.id),token=tokenByDevice.get(deviceId);
  if(!token||!allowed.has(deviceId)){
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
  const [entries,participation,config,customGestures]=await Promise.all([
    ok(db.from("galaxy_bond").select("*").order("created",{ascending:false}).limit(200)),
    ok(db.from("galaxy_bond_participation").select("day,person")),
    ok(db.from("galaxy_bond_config").select("photo_path").eq("id",1).maybeSingle()),
    ok(db.from("galaxy_bond_gestures").select("*").eq("enabled",true).order("created_at",{ascending:true}).limit(50))
  ]);
  const progress=computeBondProgress(participation||[],new Date());
  const visible=await Promise.all((entries||[]).map(async(row:any)=>{
    const copy=structuredClone(row);
    if(copy.type==="game"&&copy.author!==person&&!Object.hasOwn(copy.data||{},"guess"))delete copy.data.answer;
    if(copy.type==="voice"&&copy.data?.audioPath){
      let reveal=true;
      const ref=copy.data?.referenceId;
      if(ref){
        const target=(await ok(db.from("galaxy_items").select("kind,data,author").eq("id",String(ref)).limit(1)))?.[0];
        if(target&&String(target.author)!==person){
          if(target.kind==="capsule"&&target.data?.date&&target.data.date>today())reveal=false;
          if(target.kind==="note"&&target.data?.surprise){
            if(target.data.unlockType==="date"&&target.data.unlockDate>today())reveal=false;
            if(target.data.unlockType==="place"){
              const loc=(await ok(db.from("galaxy_locations").select("*").eq("person",person).limit(1)))?.[0];
              reveal=!!loc?.sharing&&meters(Number(loc.latitude),Number(loc.longitude),Number(target.data.latitude),Number(target.data.longitude))<=Number(target.data.radius||150);
            }
          }
        }
      }
      if(reveal)copy.data.audioUrl=await signed("galaxy-voice",copy.data.audioPath,900);else{delete copy.data.audioPath;copy.data.locked=true;}
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
  const safeItems=(items||[]).map((row:any)=>{
    const copy=structuredClone(row),data=copy.data||{};
    if(copy.kind==="capsule"&&data.date&&data.date>day&&String(copy.author)!==person)copy.data={title:"Cápsula cerrada",date:data.date,locked:true};
    if(copy.kind==="note"&&data.surprise&&String(copy.author)!==person){
      let unlocked=data.unlockType!=="date"||!data.unlockDate||data.unlockDate<=day;
      if(data.unlockType==="place"){
        const own=(locations||[]).find((x:any)=>String(x.person)===person&&x.sharing);
        unlocked=!!own&&meters(Number(own.latitude),Number(own.longitude),Number(data.latitude),Number(data.longitude))<=Number(data.radius||150);
      }
      if(!unlocked)copy.data={title:"Sorpresa guardada",surprise:true,unlockType:data.unlockType,unlockDate:data.unlockType==="date"?data.unlockDate:"",placeName:data.unlockType==="place"?text(data.placeName,80):"",locked:true};
    }
    return copy;
  });
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
  return json({
    person,device:{id:d.id,name:d.name},today:day,settings,items:safeItems,daily:maskedDaily(daily||[],person),
    bond,locations,places,presence:safePresence,devices,nextEvent:nextCalendarEvent(safeItems.filter((i:any)=>i.kind==="event"),day),
    capabilities:{photos:true,music:true,voice:true,widget:true,backgroundLocation:true,trips:true,backup:true,presence:true,profileManagement:true}
  });
}

function cleanItem(kind:string,data:any){
  if(!allowedKinds.has(kind))throw new Error("Tipo de contenido no válido");
  if(!data||typeof data!=="object"||Array.isArray(data)||JSON.stringify(data).length>12000)throw new Error("Contenido no válido");
  const out:any={...data};
  if("title" in out)out.title=text(out.title,160);
  if("body" in out)out.body=text(out.body,10000);
  if("category" in out)out.category=text(out.category,80);
  if("date" in out&&out.date!==""&&!validDate(out.date))throw new Error("Fecha no válida");
  if("annual" in out)out.annual=!!out.annual;
  if("done" in out)out.done=!!out.done;
  return out;
}

async function itemSave(req:Request,body:any){
  const d=await device(req),kind=String(body.kind||""),data=cleanItem(kind,body.data);
  if(body.id){
    const row=(await ok(db.from("galaxy_items").select("*").eq("id",String(body.id)).limit(1)))?.[0];
    if(!row)return json({error:"El contenido ya no existe"},404);
    if(Number(body.version)!==Number(row.version))return json({error:"Este contenido cambió. Actualiza antes de guardar otra vez."},409);
    const updated=await ok(db.from("galaxy_items").update({data}).eq("id",row.id).eq("version",row.version).select("*").single());
    return json({item:updated});
  }
  const created=await ok(db.from("galaxy_items").insert({kind,data,author:String(d.person)}).select("*").single());
  await recordParticipation(String(d.person));
  return json({item:created},201);
}

async function itemDelete(req:Request,body:any){
  await device(req);
  const row=(await ok(db.from("galaxy_items").select("id,version").eq("id",String(body.id||"")).limit(1)))?.[0];
  if(!row)return json({error:"El contenido ya no existe"},404);
  if(Number(body.version)!==Number(row.version))return json({error:"Este contenido cambió. Actualiza antes de borrarlo."},409);
  await ok(db.from("galaxy_items").delete().eq("id",row.id).eq("version",row.version));
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
  const d=await device(req),field=String(body.field||""),value=text(body.value,3000),day=today();
  if(field==="mood"){
    if(!["feliz","tranquilo","cansado","sensible","abrazo"].includes(value))return json({error:"Elige una emoción válida."},400);
    await ok(db.from("galaxy_daily").upsert({day,person:String(d.person),mood:value},{onConflict:"day,person"}));
  }else if(field==="answer"){
    if(!value)return json({error:"Escribe una respuesta."},400);
    await ok(db.from("galaxy_daily").upsert({day,person:String(d.person),answer:value},{onConflict:"day,person"}));
  }else return json({error:"Campo no válido."},400);
  await recordParticipation(String(d.person));
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
  const item:any=itemMap.get(String(row.item_id));
  return {...row,item:item?{id:item.id,kind:item.kind,title:text(item.data?.title||item.kind,160),body:text(item.data?.body||"",500)}:null};
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
async function convertItemToGoal(req:Request,body:any){
 const d=await device(req),id=String(body.itemId||""),item=(await ok(db.from("galaxy_items").select("*").eq("id",id).limit(1)))?.[0];
 if(!item||!["plan","wish"].includes(String(item.kind)))return json({error:"Solo un plan o deseo puede convertirse en objetivo."},400);
 const keepOriginal=body.keepOriginal!==false,draft=conversionDraft(item,{keepOriginal,participants:Array.isArray(body.participants)?body.participants:["0","1"]});
 const normalized={...draft,...(body.goal&&typeof body.goal==="object"?body.goal:{}),participants:draft.participants,kind:String(body.goal?.kind||draft.kind)};
 const goal=await createGoalRecord(String(d.person),normalized,{itemId:item.id,relation:item.kind==="plan"?"source-plan":"source-wish"});
 if(!keepOriginal)await ok(db.from("galaxy_items").delete().eq("id",item.id));
 await recordParticipation(String(d.person));
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
  return json({goal:await goalResponse(id)});
 }
 if(operation==="delete"){
  const removed=await ok(db.from("galaxy_goals").delete().eq("id",id).eq("version",expectedVersion).select("id").maybeSingle());
  if(!removed)return json({error:"Este objetivo cambió en otro dispositivo. Actualiza antes de eliminar."},409);
  return json({ok:true});
 }
 if(operation==="step-add"){
  const title=text(body.title,300);if(!title)return json({error:"Escribe el paso."},400);
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  const rows=await ok(db.from("galaxy_goal_steps").select("position").eq("goal_id",id).order("position",{ascending:false}).limit(1));
  const position=(rows?.length?Number(rows[0].position)+1:0);
  await ok(db.from("galaxy_goal_steps").insert({goal_id:id,title,position}));
  await recordParticipation(person);return json({goal:await goalResponse(id)});
 }
 if(operation==="step-toggle"){
  const stepId=String(body.stepId||""),step=(await ok(db.from("galaxy_goal_steps").select("*").eq("id",stepId).eq("goal_id",id).limit(1)))?.[0];
  if(!step)return json({error:"El paso ya no existe."},404);
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  const complete=body.completed!==false;
  await ok(db.from("galaxy_goal_steps").update({completed_at:complete?new Date().toISOString():null,completed_by:complete?person:null}).eq("id",stepId).eq("goal_id",id));
  await recordParticipation(person);return json({goal:await goalResponse(id)});
 }
 if(operation==="step-reorder"){
  const rows=await ok(db.from("galaxy_goal_steps").select("*").eq("goal_id",id).order("position"));
  let ordered:string[];try{ordered=reorderStepIds(rows||[],body.stepIds||[]);}catch(e){return json({error:e instanceof Error?e.message:"Orden no válido."},400);}
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  for(let position=0;position<ordered.length;position++)await ok(db.from("galaxy_goal_steps").update({position}).eq("id",ordered[position]).eq("goal_id",id));
  return json({goal:await goalResponse(id)});
 }
 if(operation==="contribution-add"){
  if(existing.kind!=="savings")return json({error:"Los aportes manuales solo aplican a metas de ahorro."},400);
  let contribution;try{contribution=normalizeContribution(body.contribution||body,person);}catch(e){return json({error:e instanceof Error?e.message:"Aporte no válido."},400);}
  const claimed=await touchGoalVersion(id,expectedVersion);if(!claimed)return json({error:"Este objetivo cambió en otro dispositivo."},409);
  await ok(db.from("galaxy_goal_contributions").insert({goal_id:id,...contribution}));
  await recordParticipation(person);return json({goal:await goalResponse(id)});
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

async function backupExport(req:Request){
  await device(req);
  const [settings,items,daily,bond,bondGestures,places,goals,goalParticipants,goalSteps,goalLinks,goalContributions]=await Promise.all([
    ok(db.from("galaxy_settings").select("data").eq("id",1).single()),
    ok(db.from("galaxy_items").select("id,kind,data,author,created").order("created",{ascending:true}).limit(2000)),
    ok(db.from("galaxy_daily").select("day,person,mood,answer").order("day",{ascending:true}).limit(1000)),
    ok(db.from("galaxy_bond").select("id,type,author,data,created").order("created",{ascending:true}).limit(2000)),
    ok(db.from("galaxy_bond_gestures").select("*").order("created_at",{ascending:true}).limit(100)),
    ok(db.from("galaxy_places").select("id,owner,name,kind,latitude,longitude,note,created_at").order("created_at",{ascending:true}).limit(500)),
    ok(db.from("galaxy_goals").select("*").order("created_at",{ascending:true}).limit(1000)),
    ok(db.from("galaxy_goal_participants").select("*").limit(2000)),
    ok(db.from("galaxy_goal_steps").select("*").order("position",{ascending:true}).limit(5000)),
    ok(db.from("galaxy_goal_links").select("*").order("created_at",{ascending:true}).limit(5000)),
    ok(db.from("galaxy_goal_contributions").select("*").order("contribution_date",{ascending:true}).limit(10000))
  ]);
  return json({format:"nuestra-galaxia-backup",version:2,exportedAt:new Date().toISOString(),settings:settings?.data||{},items:items||[],daily:daily||[],bond:bond||[],bondGestures:bondGestures||[],places:places||[],goals:goals||[],goalParticipants:goalParticipants||[],goalSteps:goalSteps||[],goalLinks:goalLinks||[],goalContributions:goalContributions||[]});
}

function uuidish(v:unknown){return /^[0-9a-f-]{36}$/i.test(String(v||""));}

async function backupRestore(req:Request,body:any){
  await device(req);
  const backup=body?.backup;
  if(!backup||backup.format!=="nuestra-galaxia-backup"||![1,2].includes(Number(backup.version)))return json({error:"La copia no pertenece a Nuestra Galaxia."},400);
  const items=Array.isArray(backup.items)?backup.items.slice(0,2000):[];
  const daily=Array.isArray(backup.daily)?backup.daily.slice(0,1000):[];
  const bond=Array.isArray(backup.bond)?backup.bond.slice(0,2000):[];
  const bondGestures=Array.isArray(backup.bondGestures)?backup.bondGestures.slice(0,100):[];
  const places=Array.isArray(backup.places)?backup.places.slice(0,500):[];
  const goals=Array.isArray(backup.goals)?backup.goals.slice(0,1000):[];
  const goalParticipants=Array.isArray(backup.goalParticipants)?backup.goalParticipants.slice(0,2000):[];
  const goalSteps=Array.isArray(backup.goalSteps)?backup.goalSteps.slice(0,5000):[];
  const goalLinks=Array.isArray(backup.goalLinks)?backup.goalLinks.slice(0,5000):[];
  const goalContributions=Array.isArray(backup.goalContributions)?backup.goalContributions.slice(0,10000):[];
  let restoredItems=0,restoredDaily=0,restoredBond=0,restoredBondGestures=0,restoredPlaces=0,restoredGoals=0,restoredGoalParticipants=0,restoredGoalSteps=0,restoredGoalLinks=0,restoredGoalContributions=0;

  if(backup.settings&&typeof backup.settings==="object"&&!Array.isArray(backup.settings)){
    const current=await ok(db.from("galaxy_settings").select("data").eq("id",1).single());
    const names=Array.isArray(backup.settings.names)?backup.settings.names.slice(0,2).map((x:any)=>text(x,40)):[];
    const startDate=text(backup.settings.startDate,10),albumUrl=text(backup.settings.albumUrl,500);
    const data={...(current?.data||{}),...(names.length===2?{names}:{}),...(startDate&&validDate(startDate)?{startDate}:{}),albumUrl};
    await ok(db.from("galaxy_settings").update({data}).eq("id",1));
  }

  for(const row of places){
    const id=Number(row?.id),owner=String(row?.owner||""),name=text(row?.name,80),kind=String(row?.kind||"memory"),latitude=Number(row?.latitude),longitude=Number(row?.longitude);
    if(!Number.isFinite(id)||!["0","1"].includes(owner)||!name||!["home","work","memory","adventure"].includes(kind)||!Number.isFinite(latitude)||!Number.isFinite(longitude))continue;
    await ok(db.from("galaxy_places").upsert({id,owner,name,kind,latitude,longitude,note:text(row?.note,300)||null},{onConflict:"id",ignoreDuplicates:true}));
    restoredPlaces++;
  }

  for(const row of items){
    const id=String(row?.id||""),kind=String(row?.kind||""),author=String(row?.author||"");
    if(!uuidish(id)||!allowedKinds.has(kind)||!["0","1"].includes(author))continue;
    let data;try{data=cleanItem(kind,row.data);}catch{continue;}
    await ok(db.from("galaxy_items").upsert({id,kind,data,author,created:row.created||new Date().toISOString()},{onConflict:"id",ignoreDuplicates:true}));
    restoredItems++;
  }

  for(const row of goals){
    const id=String(row?.id||""),createdBy=String(row?.created_by||"");
    if(!uuidish(id)||!["0","1"].includes(createdBy))continue;
    let normalized;try{normalized=normalizeGoalInput({...row,targetAmount:row.target_amount,targetDate:row.target_date,participants:["0"]});}catch{continue;}
    await ok(db.from("galaxy_goals").upsert({
      id,kind:normalized.kind,title:normalized.title,description:normalized.description,category:normalized.category,
      target_date:normalized.target_date,status:normalized.status,target_amount:normalized.target_amount,created_by:createdBy,
      completed_at:row.completed_at||null,created_at:row.created_at||new Date().toISOString(),updated_at:row.updated_at||row.created_at||new Date().toISOString()
    },{onConflict:"id",ignoreDuplicates:true}));
    restoredGoals++;
  }

  for(const row of goalParticipants){
    const goalId=String(row?.goal_id||""),person=String(row?.person||"");
    if(!uuidish(goalId)||!["0","1"].includes(person))continue;
    await ok(db.from("galaxy_goal_participants").upsert({goal_id:goalId,person},{onConflict:"goal_id,person",ignoreDuplicates:true}));
    restoredGoalParticipants++;
  }

  for(const row of goalSteps){
    const id=String(row?.id||""),goalId=String(row?.goal_id||""),title=text(row?.title,300),position=Number(row?.position);
    if(!uuidish(id)||!uuidish(goalId)||!title||!Number.isInteger(position)||position<0)continue;
    const completedBy=row.completed_by==null?null:String(row.completed_by);
    if(completedBy!==null&&!["0","1"].includes(completedBy))continue;
    await ok(db.from("galaxy_goal_steps").upsert({id,goal_id:goalId,title,position,completed_at:row.completed_at||null,completed_by:completedBy,created_at:row.created_at||new Date().toISOString()},{onConflict:"id",ignoreDuplicates:true}));
    restoredGoalSteps++;
  }

  for(const row of goalContributions){
    const id=String(row?.id||""),goalId=String(row?.goal_id||""),contributor=String(row?.contributor||"");
    if(!uuidish(id)||!uuidish(goalId)||!["0","1"].includes(contributor))continue;
    let value;try{value=normalizeContribution({amount:row.amount,date:row.contribution_date,note:row.note},contributor);}catch{continue;}
    await ok(db.from("galaxy_goal_contributions").upsert({id,goal_id:goalId,...value,created_at:row.created_at||new Date().toISOString()},{onConflict:"id",ignoreDuplicates:true}));
    restoredGoalContributions++;
  }

  for(const row of goalLinks){
    const id=String(row?.id||""),goalId=String(row?.goal_id||""),itemId=String(row?.item_id||""),relation=String(row?.relation||"");
    if(!uuidish(id)||!uuidish(goalId)||!uuidish(itemId)||!["note","memory","plan","source-plan","source-wish"].includes(relation))continue;
    await ok(db.from("galaxy_goal_links").upsert({id,goal_id:goalId,item_id:itemId,relation,created_at:row.created_at||new Date().toISOString()},{onConflict:"id",ignoreDuplicates:true}));
    restoredGoalLinks++;
  }

  for(const row of bondGestures){
    const id=String(row?.id||""),createdBy=String(row?.created_by||"");
    if(!uuidish(id)||!["0","1"].includes(createdBy))continue;
    let value;try{value=normalizeCustomGesture(row);}catch{continue;}
    await ok(db.from("galaxy_bond_gestures").upsert({
      id,...value,created_by:createdBy,enabled:row.enabled!==false,
      created_at:row.created_at||new Date().toISOString(),updated_at:row.updated_at||row.created_at||new Date().toISOString()
    },{onConflict:"id",ignoreDuplicates:true}));
    restoredBondGestures++;
  }

  for(const row of daily){
    const day=String(row?.day||""),person=String(row?.person||""),mood=text(row?.mood,30),answer=text(row?.answer,3000);
    if(!validDate(day)||!["0","1"].includes(person))continue;
    const value:any={day,person};
    if(["feliz","tranquilo","cansado","sensible","abrazo"].includes(mood))value.mood=mood;
    if(answer)value.answer=answer;
    if(Object.keys(value).length>2){await ok(db.from("galaxy_daily").upsert(value,{onConflict:"day,person",ignoreDuplicates:true}));restoredDaily++;}
  }

  for(const row of bond){
    const id=String(row?.id||""),type=String(row?.type||""),author=String(row?.author||"");
    if(!uuidish(id)||!["0","1"].includes(author))continue;
    let data;try{data=validateBond(type,row.data);}catch{continue;}
    await ok(db.from("galaxy_bond").upsert({id,type,author,data,created:row.created||new Date().toISOString()},{onConflict:"id",ignoreDuplicates:true}));
    restoredBond++;
  }
  return json({ok:true,restored:{items:restoredItems,daily:restoredDaily,bond:restoredBond,bondGestures:restoredBondGestures,places:restoredPlaces,goals:restoredGoals,goalParticipants:restoredGoalParticipants,goalSteps:restoredGoalSteps,goalLinks:restoredGoalLinks,goalContributions:restoredGoalContributions},restoredGoals});
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
  const test=await signed("galaxy-voice",payload.audioPath,60);
  if(!test)throw new Error("Audio no encontrado");
  if(payload.referenceId){
    const item=(await ok(db.from("galaxy_items").select("kind,data").eq("id",payload.referenceId).limit(1)))?.[0];
    if(!item||!["memory","song","capsule","journey","note"].includes(item.kind)||item.kind==="note"&&!item.data?.surprise)throw new Error("Referencia no válida");
    if(item.kind==="capsule"&&String(item.data?.date||"")>today())throw new Error("La cápsula aún está cerrada");
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
  return json({ok:true});
}

async function bondWidget(req:Request,body:any){
  await device(req);
  const path=text(body.photoPath,300);
  if(path&&!(await signed("galaxy-photos",path,60)))return json({error:"Elige una foto válida del álbum."},400);
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
async function listInsightPhotoMetadata(){
  const found:any[]=[];
  for(const prefix of ["","0","1"]){
    const {data,error}=await db.storage.from("galaxy-photos").list(prefix,{limit:100,sortBy:{column:"created_at",order:"desc"}});
    if(error)continue;
    for(const file of data||[]){
      if(!file.id||file.name===".emptyFolderPlaceholder")continue;
      const path=prefix?prefix+"/"+file.name:file.name;
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
    listInsightPhotoMetadata()
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
    ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude"))
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
  await device(req);
  const [locations,places,tripPoints,destinations]=await Promise.all([
    ok(db.from("galaxy_locations").select("*").order("person")),
    ok(db.from("galaxy_places").select("*").order("created_at",{ascending:false}).limit(100)),
    ok(db.from("galaxy_trip_points").select("*").order("created_at",{ascending:false}).limit(500)),
    ok(db.from("galaxy_destinations").select("*"))
  ]);
  const base={locations,places,tripPoints,destinations};
  if(body.detail!==true)return json(base);
  const [trips,events,encounters]=await Promise.all([
    ok(db.from("galaxy_trip_history").select("*").order("started_at",{ascending:false}).limit(40)),
    ok(db.from("galaxy_place_events").select("*").order("happened_at",{ascending:false}).limit(40)),
    ok(db.from("galaxy_encounters").select("*").order("started_at",{ascending:false}).limit(40))
  ]);
  return json({...base,trips,events,encounters});
}

async function placeSave(req:Request,body:any){
  const d=await device(req),person=String(d.person),name=text(body.name,80),kind=String(body.kind||"memory"),latitude=Number(body.latitude),longitude=Number(body.longitude),note=text(body.note,300);
  if(!["home","work","memory","adventure"].includes(kind)||!name||!Number.isFinite(latitude)||latitude<-90||latitude>90||!Number.isFinite(longitude)||longitude<-180||longitude>180)return json({error:"Lugar no válido."},400);
  if(body.id){
    const row=(await ok(db.from("galaxy_places").select("*").eq("id",Number(body.id)).limit(1)))?.[0];
    if(!row||row.owner!==person)return json({error:"No puedes editar este lugar."},403);
    const place=await ok(db.from("galaxy_places").update({name,kind,latitude,longitude,note:note||null}).eq("id",row.id).select("*").single());
    return json({place});
  }
  const place=await ok(db.from("galaxy_places").insert({owner:person,name,kind,latitude,longitude,note:note||null}).select("*").single());
  return json({place},201);
}

async function placeDelete(req:Request,body:any){
  const d=await device(req),person=String(d.person),row=(await ok(db.from("galaxy_places").select("id,owner").eq("id",Number(body.id)).limit(1)))?.[0];
  if(!row||row.owner!==person)return json({error:"No puedes borrar este lugar."},403);
  await ok(db.from("galaxy_places").delete().eq("id",row.id));
  return json({ok:true});
}

async function setStatus(req:Request,body:any){
  const d=await device(req),status=text(body.status,40);
  await ok(db.from("galaxy_locations").update({status:status||null}).eq("person",String(d.person)));
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
    return json({ok:true,trip_active:false,trip});
  }
  return json({error:"Operación de recorrido no válida."},400);
}

async function listBucket(bucket:string){
  const found:any[]=[];
  for(const prefix of ["","0","1"]){
    const {data,error}=await db.storage.from(bucket).list(prefix,{limit:100,sortBy:{column:"created_at",order:"desc"}});
    if(error)continue;
    for(const file of data||[]){
      if(!file.id||file.name===".emptyFolderPlaceholder")continue;
      const path=prefix?prefix+"/"+file.name:file.name,url=await signed(bucket,path,1800);
      if(url)found.push({path,name:file.name,originalName:file.metadata?.originalName||file.metadata?.original_name||file.name,mime:file.metadata?.mimetype||"",size:file.metadata?.size||0,created:file.created_at||file.updated_at||null,url});
    }
  }
  return found;
}

async function mediaList(req:Request,body:any){
  await device(req);
  const kind=String(body.kind||"photo");
  if(kind==="photo")return json({items:await listBucket("galaxy-photos")});
  if(kind==="music")return json({items:await listBucket("galaxy-music")});
  if(kind==="voice")return json({items:await listBucket("galaxy-voice")});
  return json({error:"Multimedia no válida."},400);
}

async function mediaDelete(req:Request,body:any){
  const d=await device(req),kind=String(body.kind||""),path=text(body.path,400);
  const bucket=kind==="photo"?"galaxy-photos":kind==="music"?"galaxy-music":kind==="voice"?"galaxy-voice":"";
  if(!bucket||!path)return json({error:"Archivo no válido."},400);
  if(kind==="voice"&&!path.startsWith(String(d.person)+"/"))return json({error:"Solo puedes borrar tus audios."},403);
  await ok(db.storage.from(bucket).remove([path]));
  if(kind==="photo")await ok(db.from("galaxy_bond_config").update({photo_path:""}).eq("photo_path",path));
  return json({ok:true});
}

function uploadRules(kind:string){
  if(kind==="photo")return {bucket:"galaxy-photos",limit:12*1024*1024,mimes:new Set(["image/jpeg","image/png","image/webp"]),ext:{"image/jpeg":"jpg","image/png":"png","image/webp":"webp"} as Record<string,string>};
  if(kind==="music")return {bucket:"galaxy-music",limit:20*1024*1024,mimes:new Set(["audio/mpeg"]),ext:{"audio/mpeg":"mp3"} as Record<string,string>};
  if(kind==="voice")return {bucket:"galaxy-voice",limit:5*1024*1024,mimes:new Set(["audio/mpeg","audio/ogg","audio/webm","audio/mp4"]),ext:{"audio/mpeg":"mp3","audio/ogg":"ogg","audio/webm":"webm","audio/mp4":"m4a"} as Record<string,string>};
  return null;
}

async function upload(req:Request){
  const d=await device(req),kind=String(req.headers.get("x-media-kind")||""),rules=uploadRules(kind);
  if(!rules)return json({error:"Tipo de archivo no válido."},400);
  const mime=String(req.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
  if(!rules.mimes.has(mime))return json({error:"Formato de archivo no permitido."},415);
  const declared=Number(req.headers.get("content-length")||0);
  if(declared>rules.limit)return json({error:"El archivo supera el límite permitido."},413);
  const bytes=new Uint8Array(await req.arrayBuffer());
  if(bytes.length<1||bytes.length>rules.limit)return json({error:"El archivo supera el límite permitido."},413);
  let originalName="archivo";
  try{originalName=decodeURIComponent(String(req.headers.get("x-file-name")||"archivo")).slice(0,300)||"archivo";}catch{}
  const path=String(d.person)+"/"+crypto.randomUUID()+"."+rules.ext[mime];
  const {error}=await db.storage.from(rules.bucket).upload(path,bytes,{contentType:mime,upsert:false,cacheControl:"3600",metadata:{originalName}});
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
  let photoUrl=null;if(config?.photo_path)photoUrl=await signed("galaxy-photos",config.photo_path,300);
  const person=String(d.person),partner=person==="0"?"1":"0";
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
    const body=await req.json(),action=String(body.action||"");
    if(action==="pair")return await pair(body);
    if(action==="pair-code-create")return await pairCodeCreate(req,body);
    if(action==="profile-repair")return await profileRepair(req,body);
    if(action==="device-revoke")return await deviceRevoke(req,body);
    if(action==="push-token-register")return await pushTokenRegister(req,body);
    if(action==="push-token-unregister")return await pushTokenUnregister(req);
    if(action==="push-preferences")return await pushPreferences(req,body);
    if(action==="moments")return await moments(req);
    if(action==="gesture")return await gesture(req,body);
    if(action==="history")return await history(req,body);
    if(action==="location")return await location(req,body);
    if(action==="mobile-state")return await mobileState(req);
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
    const message=e instanceof Error?e.message:"";
    console.error("android-companion",message);
    if(/Dispositivo|vinculado|revocado/i.test(message))return json({error:"Dispositivo revocado o no válido"},401);
    if(/límite|limite|espera/i.test(message))return json({error:message||"Espera un momento"},429);
    if(/no válido|no válida|Completa|Elige|Escribe|Ponle|Fecha|contenido/i.test(message))return json({error:message},400);
    return json({error:"No se pudo completar la solicitud"},503);
  }
});
