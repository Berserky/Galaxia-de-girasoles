import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
const url=Deno.env.get("SUPABASE_URL")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db=createClient(url,service,{auth:{persistSession:false}});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json"}});
const sha=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("");
const dist=(a:any,b:any)=>{const R=6371000,rad=(x:number)=>x*Math.PI/180,dLat=rad(Number(b.latitude)-Number(a.latitude)),dLon=rad(Number(b.longitude)-Number(a.longitude)),h=Math.sin(dLat/2)**2+Math.cos(rad(Number(a.latitude)))*Math.cos(rad(Number(b.latitude)))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));};
const ok=async(q:PromiseLike<any>)=>{const {data,error}=await q;if(error)throw error;return data;};
async function device(req:Request){const token=req.headers.get("x-device-token")||"";if(token.length<40)throw new Error("Dispositivo no vinculado");const hash=await sha(token),rows=await ok(db.from("galaxy_devices").select("id,person,name,revoked_at").eq("token_hash",hash).is("revoked_at",null).limit(1));if(!rows?.length)throw new Error("Dispositivo revocado o no válido");const d=rows[0];await ok(db.from("galaxy_devices").update({last_seen_at:new Date().toISOString()}).eq("id",d.id));return d;}
async function pair(body:any){const code=String(body.code||"").replace(/\s+/g,"").toUpperCase();if(code.length<20)return json({error:"Código de vinculación no válido"},400);const hash=await sha(code),now=new Date().toISOString(),rows=await ok(db.from("galaxy_device_pair_codes").select("*").eq("code_hash",hash).is("used_at",null).gt("expires_at",now).limit(1));if(!rows?.length)return json({error:"El código expiró o ya fue utilizado"},401);const row=rows[0],secret=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-",""),tokenHash=await sha(secret),name=String(body.device_name||row.device_name||"Android").trim().slice(0,80)||"Android";const created=await ok(db.from("galaxy_devices").insert({person:row.person,name,token_hash:tokenHash,last_seen_at:now}).select("id,person,name").single());await ok(db.from("galaxy_device_pair_codes").update({used_at:now}).eq("code_hash",hash));return json({device_token:secret,device:created});}
function point(body:any){const lat=Number(body.latitude),lon=Number(body.longitude),accuracy=Number(body.accuracy),speed=Number(body.speed),heading=Number(body.heading),motion=["still","walking","vehicle"].includes(body.motion)?body.motion:null;if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)throw new Error("Ubicación no válida");return {lat,lon,accuracy:Number.isFinite(accuracy)&&accuracy>=0?accuracy:null,speed:Number.isFinite(speed)&&speed>=0?speed:null,heading:Number.isFinite(heading)&&heading>=0&&heading<=360?heading:null,motion};}
async function history(req:Request,body:any){const d=await device(req),p=point(body),sample=String(body.sample_id||"");if(!/^[0-9a-f-]{36}$/i.test(sample))throw new Error("Muestra no válida");const row={person:d.person,latitude:p.lat,longitude:p.lon,accuracy:p.accuracy,speed:p.speed,heading:p.heading,motion:p.motion,captured_at:body.captured_at||new Date().toISOString(),source_device_id:d.id,client_sample_id:sample};const {error}=await db.from("galaxy_location_history").insert(row);if(error&&error.code!=="23505")throw error;return json({ok:true});}
async function smartPlaces(d:any,p:any){const places=await ok(db.from("galaxy_places").select("id,name,latitude,longitude,kind").eq("owner",d.person).in("kind",["home","work"])),now=Date.now();for(const place of places||[]){const meters=dist({latitude:p.lat,longitude:p.lon},place),presence=(await ok(db.from("galaxy_device_place_presence").select("*").eq("device_id",d.id).eq("place_id",place.id).limit(1)))?.[0];if(meters<=80){if(!presence){await ok(db.from("galaxy_device_place_presence").insert({device_id:d.id,place_id:place.id,entered_at:new Date().toISOString(),arrived:false}));continue;}if(!presence.arrived&&now-Date.parse(presence.entered_at)>=45000){await ok(db.from("galaxy_place_events").insert({person:d.person,place_id:place.id,event:"arrived"}));await ok(db.from("galaxy_device_place_presence").update({arrived:true}).eq("device_id",d.id).eq("place_id",place.id));await ok(db.from("galaxy_locations").update({status:"Llegué a "+place.name}).eq("person",d.person));}}else if(meters>150&&presence){if(presence.arrived)await ok(db.from("galaxy_place_events").insert({person:d.person,place_id:place.id,event:"left"}));await ok(db.from("galaxy_device_place_presence").delete().eq("device_id",d.id).eq("place_id",place.id));}}}
async function encounter(){const locs=await ok(db.from("galaxy_locations").select("person,latitude,longitude,sharing").eq("sharing",true));if(!locs||locs.length!==2||locs.some((x:any)=>x.latitude==null||x.longitude==null))return;const meters=dist(locs[0],locs[1]),runtime=await ok(db.from("galaxy_encounter_runtime").select("*").eq("singleton",true).single()),open=(await ok(db.from("galaxy_encounters").select("id").is("ended_at",null).limit(1)))?.[0];if(meters<=80){if(!runtime.near_since){await ok(db.from("galaxy_encounter_runtime").update({near_since:new Date().toISOString()}).eq("singleton",true));return;}if(!open&&Date.now()-Date.parse(runtime.near_since)>=60000)await ok(db.from("galaxy_encounters").insert({started_at:runtime.near_since,distance_m:Math.round(meters),created_by:locs[0].person}));}else if(meters>150){if(runtime.near_since)await ok(db.from("galaxy_encounter_runtime").update({near_since:null}).eq("singleton",true));if(open)await ok(db.from("galaxy_encounters").update({ended_at:new Date().toISOString()}).eq("id",open.id));}}
async function location(req:Request,body:any){const d=await device(req),now=new Date().toISOString();if(body.sharing===false){await ok(db.from("galaxy_locations").update({sharing:false,latitude:null,longitude:null,accuracy:null,speed:null,heading:null,motion:null,status:null,updated_at:now}).eq("person",d.person));await ok(db.from("galaxy_device_place_presence").delete().eq("device_id",d.id));await encounter();return json({ok:true});}const p=point(body),existing=(await ok(db.from("galaxy_locations").select("*").eq("person",d.person).limit(1)))?.[0]||{};await ok(db.from("galaxy_locations").upsert({person:d.person,sharing:true,latitude:p.lat,longitude:p.lon,accuracy:p.accuracy,speed:p.speed,heading:p.heading,motion:p.motion,status:existing.status||null,trip_active:!!existing.trip_active,trip_started_at:existing.trip_started_at||null,transport_preference:existing.transport_preference||null,updated_at:now},{onConflict:"person"}));if(body.history===true)await history(req,body);if(existing.trip_active&&body.trip_point===true)await ok(db.from("galaxy_trip_points").insert({person:d.person,latitude:p.lat,longitude:p.lon}));await smartPlaces(d,p);await encounter();return json({ok:true,person:d.person});}
// Pure calendar projection: only the title and date leave this function.
function nextCalendarEvent(items: any[], today: string) {
 const valid = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(value+'T12:00:00Z').getTime()) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
 const events = [];
 for (const item of items) {
  const data = item.data || {};
  if (!valid(data.date)) continue;
  let date = data.date;
  if (data.annual === true && date < today) {
   const monthDay = date.slice(4);
   for (let year = Math.max(Number(today.slice(0,4)), Number(date.slice(0,4))); year <= Number(today.slice(0,4))+8; year++) {
    const candidate = String(year)+monthDay;
    if (valid(candidate) && candidate >= today && candidate >= data.date) { date = candidate; break; }
   }
  }
  if (date >= today) events.push({title:String(data.title || 'Nuestra próxima fecha').slice(0,120),date});
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date))[0] || null;
}
async function moments(req:Request) {
 const d=await device(req);
 if(!['0','1'].includes(String(d.person))) return json({error:'Dispositivo no válido'},401);
 const [settings,events,config,gestures]=await Promise.all([
  ok(db.from('galaxy_settings').select('data').eq('id',1).single()),
  ok(db.from('galaxy_items').select('data').eq('kind','event')),
  ok(db.from('galaxy_bond_config').select('photo_path').eq('id',1).maybeSingle()),
  ok(db.from('galaxy_bond').select('id,author,created,data').eq('type','gesture').neq('author',d.person).gte('created',new Date(Date.now()-7*86400000).toISOString()).order('created',{ascending:false}).limit(30))
 ]);
 const names=(Array.isArray(settings?.data?.names)?settings.data.names:['Nosotros','Dos']).slice(0,2).map((name:unknown)=>String(name).slice(0,40));
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let photoUrl=null;
 if(config?.photo_path){const {data,error}=await db.storage.from('galaxy-photos').createSignedUrl(config.photo_path,300);if(!error)photoUrl=data.signedUrl;}
 return json({names,nextEvent:nextCalendarEvent(events||[],today),photoUrl,gestures:(gestures||[]).filter((g:any)=>['hug','kiss','miss'].includes(g.data?.gesture)).map((g:any)=>({id:g.id,gesture:g.data.gesture,created:g.created,author:g.author}))});
}
async function gesture(req:Request,body:any) {
 const d=await device(req);
 if(!['hug','kiss','miss'].includes(body.gesture))return json({error:'Gesto no válido'},400);
 const {error}=await db.rpc('galaxy_bond_gesture_device',{person_value:String(d.person),gesture_value:body.gesture});
 if(error){if(/límite|limite|espera|rate/i.test(error.message))return json({error:'Espera un momento antes de enviar otro gesto'},429);throw error;}
 return json({ok:true});
}
Deno.serve(async req=>{if(req.method!=="POST")return json({error:"Método no permitido"},405);try{const body=await req.json();if(body.action==="pair")return await pair(body);if(body.action==="moments")return await moments(req);if(body.action==="gesture")return await gesture(req,body);if(body.action==="history")return await history(req,body);if(body.action==="location")return await location(req,body);return json({error:"Acción no válida"},400);}catch(e){const message=e instanceof Error?e.message:'';if(/Dispositivo|vinculado/i.test(message))return json({error:'Dispositivo revocado o no válido'},401);return json({error:'No se pudo completar la solicitud'},503);}});
