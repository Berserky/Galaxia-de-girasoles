import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";
import { aggregateInsightRows, evaluateAchievements, isInsightVisibleItem, periodBounds, previousPeriod } from "./insights.ts";
import { QUESTION_DECKS, buildDateRecap, buildSequentialPlan, buildSurpriseExperience, normalizePlanCategory, questionById, roulettePendingPlans, selectQuestion } from "./date-engine.ts";

const url=Deno.env.get("SUPABASE_URL")!;
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
  await ok(db.from("galaxy_device_place_presence").delete().eq("device_id",targetId));
  return json({ok:true});
}

function point(body:any){
  const lat=Number(body.latitude),lon=Number(body.longitude),accuracy=Number(body.accuracy),speed=Number(body.speed),heading=Number(body.heading),motion=["still","walking","vehicle"].includes(body.motion)?body.motion:null;
  if(!Number.isFinite(lat)||lat<-90||lat>90||!Number.isFinite(lon)||lon<-180||lon>180)throw new Error("Ubicación no válida");
  return {lat,lon,accuracy:Number.isFinite(accuracy)&&accuracy>=0?accuracy:null,speed:Number.isFinite(speed)&&speed>=0?speed:null,heading:Number.isFinite(heading)&&heading>=0&&heading<=360?heading:null,motion};
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

async function bondState(person:string){
  const [entries,participation,config]=await Promise.all([
    ok(db.from("galaxy_bond").select("*").order("created",{ascending:false}).limit(200)),
    ok(db.from("galaxy_bond_participation").select("day,person")),
    ok(db.from("galaxy_bond_config").select("photo_path").eq("id",1).maybeSingle())
  ]);
  const days=new Map<string,Set<string>>();
  for(const row of participation||[]){if(!days.has(row.day))days.set(row.day,new Set());days.get(row.day)!.add(row.person);}
  const earned=[...days.values()].filter(s=>s.has("0")&&s.has("1")).length;
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
  return {entries:visible,garden:{days:earned,stage:earned>=30?4:earned>=14?3:earned>=7?2:earned>=1?1:0},widget:{photoPath:config?.photo_path||""}};
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
async function buildDateContext(req:Request,knownDevice:any=null){
 const d=knownDevice||await device(req),person=String(d.person),day=today(),since=new Date(Date.now()-90*86400000).toISOString();
 const [settings,items,locations,places,trips,encounters,questionRows,placeEvents]=await Promise.all([
  ok(db.from("galaxy_settings").select("data").eq("id",1).single()),
  ok(db.from("galaxy_items").select("id,kind,data,author,created").order("created",{ascending:false}).limit(1000)),
  ok(db.from("galaxy_locations").select("person,sharing,latitude,longitude,transport_preference,updated_at").order("person")),
  ok(db.from("galaxy_places").select("id,name,kind,latitude,longitude,note,owner,created_at").order("created_at",{ascending:false}).limit(200)),
  ok(db.from("galaxy_trip_history").select("id,person,started_at,ended_at,distance_m,duration_s,dominant_motion").order("started_at",{ascending:false}).limit(250)),
  ok(db.from("galaxy_encounters").select("id,started_at,ended_at").order("started_at",{ascending:false}).limit(250)),
  ok(db.from("galaxy_daily_questions").select("day,question_id,deck,context_kind,favorite,memory_id").order("day",{ascending:false}).limit(40)),
  ok(db.from("galaxy_place_events").select("place_id,event,happened_at").eq("event","arrived").gte("happened_at",since).order("happened_at",{ascending:false}).limit(1000))
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
  const [settings,items,daily,bond,places]=await Promise.all([
    ok(db.from("galaxy_settings").select("data").eq("id",1).single()),
    ok(db.from("galaxy_items").select("id,kind,data,author,created").order("created",{ascending:true}).limit(2000)),
    ok(db.from("galaxy_daily").select("day,person,mood,answer").order("day",{ascending:true}).limit(1000)),
    ok(db.from("galaxy_bond").select("id,type,author,data,created").order("created",{ascending:true}).limit(2000)),
    ok(db.from("galaxy_places").select("id,owner,name,kind,latitude,longitude,note,created_at").order("created_at",{ascending:true}).limit(500))
  ]);
  return json({format:"nuestra-galaxia-backup",version:1,exportedAt:new Date().toISOString(),settings:settings?.data||{},items:items||[],daily:daily||[],bond:bond||[],places:places||[]});
}

function uuidish(v:unknown){return /^[0-9a-f-]{36}$/i.test(String(v||""));}

async function backupRestore(req:Request,body:any){
  await device(req);
  const backup=body?.backup;
  if(!backup||backup.format!=="nuestra-galaxia-backup"||Number(backup.version)!==1)return json({error:"La copia no pertenece a Nuestra Galaxia."},400);
  const items=Array.isArray(backup.items)?backup.items.slice(0,2000):[];
  const daily=Array.isArray(backup.daily)?backup.daily.slice(0,1000):[];
  const bond=Array.isArray(backup.bond)?backup.bond.slice(0,2000):[];
  const places=Array.isArray(backup.places)?backup.places.slice(0,500):[];
  let restoredItems=0,restoredDaily=0,restoredBond=0,restoredPlaces=0;

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
  return json({ok:true,restored:{items:restoredItems,daily:restoredDaily,bond:restoredBond,places:restoredPlaces}});
}

async function recordParticipation(person:string){
  await ok(db.from("galaxy_bond_participation").upsert({day:today(),person},{onConflict:"day,person"}));
}

function validateBond(type:string,data:any){
  if(!data||typeof data!=="object"||Array.isArray(data))throw new Error("Datos no válidos");
  if(type==="gesture"){
    const gesture=String(data.gesture||"");
    if(!["hug","kiss","miss"].includes(gesture))throw new Error("Gesto no válido");
    return {gesture};
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
  return bondSave(req,{type:"gesture",data:{gesture:body.gesture}});
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
  const [items,trips,encounters,daily,bond,participation,placeEvents,places,photos]=await Promise.all([
    ok(db.from("galaxy_items").select("id,kind,data,author,created").order("created",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_trip_history").select("id,person,started_at,ended_at,distance_m,duration_s,dominant_motion").order("started_at",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_encounters").select("id,started_at,ended_at,distance_m").order("started_at",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_daily").select("day,person,mood,answer").gte("day",rangeStartDay).lt("day",rangeEndDay).order("day",{ascending:true}).limit(5000)),
    ok(db.from("galaxy_bond").select("id,type,author,created").gte("created",rangeStart).lt("created",rangeEnd).order("created",{ascending:false}).limit(5000)),
    ok(db.from("galaxy_bond_participation").select("day,person").order("day",{ascending:true}).limit(10000)),
    ok(db.from("galaxy_place_events").select("id,person,place_id,event,happened_at").gte("happened_at",rangeStart).lt("happened_at",rangeEnd).order("happened_at",{ascending:true}).limit(5000)),
    ok(db.from("galaxy_places").select("id,name").limit(1000)),
    listInsightPhotoMetadata()
  ]);
  const nowMs=Date.now(),source={items:items||[],trips:trips||[],encounters:encounters||[],daily:daily||[],bond:bond||[],participation:participation||[],placeEvents:placeEvents||[],places:places||[],photos:photos||[],person,nowMs};
  const current=aggregateInsightRows({...source,period});
  current.photos=await signInsightPhotos(current.photos||[]);
  const prior=previous?aggregateInsightRows({...source,period:previous}):null;
  const visibleAll=(items||[]).filter((row:any)=>isInsightVisibleItem(row,person,day));
  const achievements=evaluateAchievements({
    memories:visibleAll.filter((row:any)=>row.kind==="memory").length,
    encounters:(encounters||[]).length,
    distance_m:(trips||[]).reduce((sum:number,row:any)=>sum+Math.max(0,Number(row.distance_m)||0),0),
    journeys:visibleAll.filter((row:any)=>row.kind==="journey").length,
    joint_days:jointParticipationDays(participation||[]),
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

async function moments(req:Request){
  const d=await device(req);
  if(!["0","1"].includes(String(d.person)))return json({error:"Dispositivo no válido"},401);
  const [settings,events,config,gestures,daily,locations,presence,songs]=await Promise.all([
    ok(db.from("galaxy_settings").select("data").eq("id",1).single()),
    ok(db.from("galaxy_items").select("id,data").eq("kind","event")),
    ok(db.from("galaxy_bond_config").select("photo_path").eq("id",1).maybeSingle()),
    ok(db.from("galaxy_bond").select("id,author,created,data").eq("type","gesture").neq("author",d.person).gte("created",new Date(Date.now()-7*86400000).toISOString()).order("created",{ascending:false}).limit(30)),
    ok(db.from("galaxy_daily").select("person,mood").eq("day",today())),
    ok(db.from("galaxy_locations").select("person,sharing,motion,status").order("person")),
    ok(db.from("galaxy_presence").select("*").order("person")),
    ok(db.from("galaxy_items").select("data,created").eq("kind","song").order("created",{ascending:false}).limit(1))
  ]);
  const names=(Array.isArray(settings?.data?.names)?settings.data.names:["Nosotros","Dos"]).slice(0,2).map((name:unknown)=>text(name,40));
  let photoUrl=null;if(config?.photo_path)photoUrl=await signed("galaxy-photos",config.photo_path,300);
  const partner=String(d.person)==="0"?"1":"0",mood=(daily||[]).find((x:any)=>String(x.person)===partner)?.mood||null,loc=(locations||[]).find((x:any)=>String(x.person)===partner),p=(presence||[]).find((x:any)=>String(x.person)===partner),legacy=settings?.data?.presence?.[partner]||{};
  const battery=p?(p.share_battery?p.battery:null):(legacy.shareBattery===true?legacy.battery:null);
  const listening=p?(p.share_song?text(p.song_title,160):""):(legacy.shareListening===true?text(legacy.listening,160):"");
  const now={mood,sharing:!!loc?.sharing,motion:loc?.sharing?loc?.motion:null,status:loc?.sharing?loc?.status:null,battery,listening,updatedAt:p?.updated_at||loc?.updated_at||legacy.updatedAt||null,latestSong:songs?.[0]?.data?.title||null};
  return json({names,nextEvent:nextCalendarEvent(events||[],today()),photoUrl,now,gestures:(gestures||[]).filter((g:any)=>["hug","kiss","miss"].includes(g.data?.gesture)).map((g:any)=>({id:g.id,gesture:g.data.gesture,created:g.created,author:g.author}))});
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
    if(action==="bond-save")return await bondSave(req,body);
    if(action==="bond-update")return await bondUpdate(req,body);
    if(action==="bond-guess")return await bondGuess(req,body);
    if(action==="bond-delete")return await bondDelete(req,body);
    if(action==="bond-widget")return await bondWidget(req,body);
    if(action==="map-state")return await mapState(req,body);
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
