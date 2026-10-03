import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

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
  const locs=await ok(db.from("galaxy_locations").select("person,latitude,longitude,sharing").eq("sharing",true));
  if(!locs||locs.length!==2||locs.some((x:any)=>x.latitude==null||x.longitude==null))return;
  const meters=dist(locs[0],locs[1]),runtime=await ok(db.from("galaxy_encounter_runtime").select("*").eq("singleton",true).single()),open=(await ok(db.from("galaxy_encounters").select("id").is("ended_at",null).limit(1)))?.[0];
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
  const d=await device(req);
  const [settings,items,daily,locations,bond]=await Promise.all([
    ok(db.from("galaxy_settings").select("id,data,version").eq("id",1).single()),
    ok(db.from("galaxy_items").select("*").order("created",{ascending:false}).limit(500)),
    ok(db.from("galaxy_daily").select("day,person,mood,answer").order("day",{ascending:false}).limit(120)),
    ok(db.from("galaxy_locations").select("*").order("person")),
    bondState(String(d.person))
  ]);
  const day=today();
  const safeItems=(items||[]).map((row:any)=>{
    const copy=structuredClone(row),data=copy.data||{};
    if(copy.kind==="capsule"&&data.date&&data.date>day&&String(copy.author)!==String(d.person))copy.data={title:"Cápsula cerrada",date:data.date,locked:true};
    if(copy.kind==="note"&&data.surprise&&String(copy.author)!==String(d.person)){
      let unlocked=data.unlockType!=="date"||!data.unlockDate||data.unlockDate<=day;
      if(data.unlockType==="place"){
        const own=(locations||[]).find((x:any)=>String(x.person)===String(d.person)&&x.sharing);
        unlocked=!!own&&meters(Number(own.latitude),Number(own.longitude),Number(data.latitude),Number(data.longitude))<=Number(data.radius||150);
      }
      if(!unlocked)copy.data={title:"Sorpresa guardada",surprise:true,unlockType:data.unlockType,unlockDate:data.unlockType==="date"?data.unlockDate:"",locked:true};
    }
    return copy;
  });
  return json({
    person:String(d.person),device:{id:d.id,name:d.name},today:day,settings,items:safeItems,daily:maskedDaily(daily||[],String(d.person)),
    bond,locations,nextEvent:nextCalendarEvent(safeItems.filter((i:any)=>i.kind==="event"),day),
    capabilities:{photos:true,music:true,voice:true,widget:true,backgroundLocation:true,trips:true}
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
    if(!item||!["memory","song","capsule"].includes(item.kind))throw new Error("Referencia no válida");
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
  const [settings,events,config,gestures]=await Promise.all([
    ok(db.from("galaxy_settings").select("data").eq("id",1).single()),
    ok(db.from("galaxy_items").select("id,data").eq("kind","event")),
    ok(db.from("galaxy_bond_config").select("photo_path").eq("id",1).maybeSingle()),
    ok(db.from("galaxy_bond").select("id,author,created,data").eq("type","gesture").neq("author",d.person).gte("created",new Date(Date.now()-7*86400000).toISOString()).order("created",{ascending:false}).limit(30))
  ]);
  const names=(Array.isArray(settings?.data?.names)?settings.data.names:["Nosotros","Dos"]).slice(0,2).map((name:unknown)=>text(name,40));
  let photoUrl=null;if(config?.photo_path)photoUrl=await signed("galaxy-photos",config.photo_path,300);
  return json({names,nextEvent:nextCalendarEvent(events||[],today()),photoUrl,gestures:(gestures||[]).filter((g:any)=>["hug","kiss","miss"].includes(g.data?.gesture)).map((g:any)=>({id:g.id,gesture:g.data.gesture,created:g.created,author:g.author}))});
}

Deno.serve(async req=>{
  if(req.method!=="POST")return json({error:"Método no permitido"},405);
  try{
    if(req.headers.get("x-mobile-action")==="upload")return await upload(req);
    const body=await req.json(),action=String(body.action||"");
    if(action==="pair")return await pair(body);
    if(action==="moments")return await moments(req);
    if(action==="gesture")return await gesture(req,body);
    if(action==="history")return await history(req,body);
    if(action==="location")return await location(req,body);
    if(action==="mobile-state")return await mobileState(req);
    if(action==="item-save")return await itemSave(req,body);
    if(action==="item-delete")return await itemDelete(req,body);
    if(action==="settings-save")return await settingsSave(req,body);
    if(action==="daily-save")return await dailySave(req,body);
    if(action==="bond-save")return await bondSave(req,body);
    if(action==="bond-update")return await bondUpdate(req,body);
    if(action==="bond-guess")return await bondGuess(req,body);
    if(action==="bond-delete")return await bondDelete(req,body);
    if(action==="bond-widget")return await bondWidget(req,body);
    if(action==="map-state")return await mapState(req,body);
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
