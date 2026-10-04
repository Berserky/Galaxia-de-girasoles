const clean=(value:unknown,max=12000)=>String(value??"").trim().replace(/\s+/g," ").slice(0,max);
const dateOnly=(value:unknown)=>{const v=clean(value,32);return /^\d{4}-\d{2}-\d{2}/.test(v)?v.slice(0,10):null;};
const safeMeta=(value:any)=>{
 const src=value&&typeof value==="object"&&!Array.isArray(value)?value:{},out:any={};
 for(const key of ["kind","category","placeName","placeId","tripId","referenceId","author","person","platform","goalId","questionId","day","mime","sourceKind","relation"]){
  const v=src[key];if(v==null||v==="")continue;
  if(typeof v==="string"||typeof v==="number"||typeof v==="boolean")out[key]=typeof v==="string"?clean(v,200):v;
 }
 return out;
};
const stable=(value:any):string=>{
 if(value==null)return"null";
 if(Array.isArray(value))return"["+value.map(stable).join(",")+"]";
 if(typeof value==="object")return"{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stable(value[k])).join(",")+"}";
 return JSON.stringify(value);
};

export function normalizeSearchText(value:unknown){
 return String(value??"")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9ñ]+/g," ").replace(/\s+/g," ").trim();
}

export function contentHashInput(doc:any={}){
 return stable({
  sourceType:String(doc.sourceType||""),
  sourceId:String(doc.sourceId||""),
  title:clean(doc.title,500),
  content:clean(doc.content,20000),
  occurredOn:dateOnly(doc.occurredOn),
  metadata:safeMeta(doc.metadata)
 });
}

function itemDocument(row:any,ctx:any={}){
 const data=row?.data||{},kind=String(row?.kind||"item"),author=String(row?.author??"");
 const title=clean(data.title||({memory:"Recuerdo",note:"Nota",plan:"Plan",song:"Canción",journey:"Viaje",event:"Fecha",wish:"Deseo",capsule:"Cápsula"} as any)[kind]||"Contenido",300);
 const body=clean(data.body,10000),category=clean(data.category,160),placeName=clean(data.placeName,160),platform=clean(data.platform,80);
 const parts=[body,category,placeName,platform,data.date?String(data.date):""].filter(Boolean);
 if(kind==="song"&&data.dedication)parts.push(clean(data.dedication,2000));
 let ownerPerson:string|null=null,visibleAfter:string|null=null;
 if(kind==="capsule"&&data.date){
  const unlock=dateOnly(data.date);visibleAfter=unlock;
  if(unlock&&unlock>String(ctx.today||"9999-12-31"))ownerPerson=author;
 }
 if(kind==="note"&&data.surprise){
  if(data.unlockType==="date"){
   const unlock=dateOnly(data.unlockDate);visibleAfter=unlock;
   if(unlock&&unlock>String(ctx.today||"9999-12-31"))ownerPerson=author;
  }else if(data.unlockType==="place")ownerPerson=author;
 }
 const meta=safeMeta({...data,kind,author});
 return {sourceType:kind,sourceId:String(row?.id||""),sourceVersion:String(row?.version??""),title,content:parts.join(" · "),occurredOn:dateOnly(data.date||row?.created),metadata:meta,ownerPerson,visibleAfter,searchable:true};
}

export function buildIntelligenceDocument(type:string,row:any,ctx:any={}){
 let doc:any;
 if(type==="item")doc=itemDocument(row,ctx);
 else if(type==="place"){
  doc={sourceType:"place",sourceId:String(row?.id||""),sourceVersion:String(row?.updated_at||row?.created_at||""),title:clean(row?.name||"Lugar",300),content:[clean(row?.kind,80),clean(row?.note,1000)].filter(Boolean).join(" · "),occurredOn:dateOnly(row?.created_at),metadata:safeMeta({kind:row?.kind,author:row?.owner}),ownerPerson:null,visibleAfter:null,searchable:true};
 }else if(type==="trip"){
  const km=Math.max(0,Number(row?.distance_m)||0)/1000,hours=Math.max(0,Number(row?.duration_s)||0)/3600;
  doc={sourceType:"trip",sourceId:String(row?.id||""),sourceVersion:String(row?.ended_at||row?.started_at||""),title:"Recorrido",content:[km?km.toFixed(1)+" km":"",hours?hours.toFixed(1)+" horas":"",clean(row?.dominant_motion,80),row?.max_speed!=null?"velocidad máxima "+Math.round(Number(row.max_speed)*3.6)+" km/h":""].filter(Boolean).join(" · "),occurredOn:dateOnly(row?.started_at),metadata:safeMeta({person:row?.person}),ownerPerson:null,visibleAfter:null,searchable:true};
 }else if(type==="daily-answer"){
  doc={sourceType:"answer",sourceId:String(row?.day||"")+":"+String(row?.person??""),sourceVersion:String(row?.updated_at||row?.day||""),title:"Respuesta del día",content:clean(row?.answer,5000),occurredOn:dateOnly(row?.day),metadata:safeMeta({day:row?.day,person:row?.person,questionId:row?.question_id}),ownerPerson:row?.ownerOnly?String(row.person):null,visibleAfter:null,searchable:!!row?.answer};
 }else if(type==="goal"){
  doc={sourceType:"goal",sourceId:String(row?.id||""),sourceVersion:String(row?.version??row?.updated_at??""),title:clean(row?.title||"Objetivo",300),content:[clean(row?.description,5000),clean(row?.category,100),clean(row?.status,80),row?.target_date?String(row.target_date):""].filter(Boolean).join(" · "),occurredOn:dateOnly(row?.target_date||row?.created_at),metadata:safeMeta({category:row?.category,goalId:row?.id}),ownerPerson:null,visibleAfter:null,searchable:true};
 }else if(type==="bond"){
  const d=row?.data||{};
  doc={sourceType:String(row?.type||"bond"),sourceId:String(row?.id||""),sourceVersion:String(row?.version??row?.created??""),title:clean(d.title||({sharednote:"Nota compartida",ritual:"Ritual"} as any)[row?.type]||"Momento",300),content:[clean(d.body,10000),clean(d.gratitude,3000),clean(d.need,3000),clean(d.plan,3000)].filter(Boolean).join(" · "),occurredOn:dateOnly(d.week||row?.created),metadata:safeMeta({author:row?.author,referenceId:d.referenceId}),ownerPerson:null,visibleAfter:null,searchable:["sharednote","ritual"].includes(String(row?.type))};
 }else if(type==="voice-transcript"){
  doc={sourceType:"voice-transcript",sourceId:String(row?.bondId||row?.bond_id||""),sourceVersion:String(row?.updated_at||row?.created_at||""),title:clean(row?.title||"Mensaje de voz",300),content:clean(row?.text,15000),occurredOn:dateOnly(row?.created_at),metadata:safeMeta({author:row?.author,mime:row?.mime,referenceId:row?.referenceId}),ownerPerson:row?.ownerPerson??null,visibleAfter:dateOnly(row?.visibleAfter),searchable:!!clean(row?.text,15000)};
 }else if(type==="photo-context"){
  doc={sourceType:"photo",sourceId:String(row?.path||""),sourceVersion:String(row?.updated_at||row?.created_at||""),title:clean(row?.caption||"Foto",300),content:[clean(row?.caption,3000),clean(row?.context,5000)].filter(Boolean).join(" · "),occurredOn:dateOnly(row?.taken_on||row?.created_at),metadata:safeMeta({author:row?.author,placeName:row?.place_name}),ownerPerson:null,visibleAfter:null,searchable:!!(row?.caption||row?.context)};
 }else throw new Error("Fuente de inteligencia no válida.");
 return {...doc,contentHash:contentHashInput(doc)};
}

export function mergeHybridRanks(input:any={},limit=20){
 const byId=new Map<string,any>();
 const apply=(rows:any[],channel:string,weight:number)=>{
  let rank=0;
  for(const raw of rows||[]){
   const id=String(raw?.id??raw?.sourceId??"");if(!id)continue;rank++;
   const row=byId.get(id)||{...raw,id,score:0,channels:[]};
   const base=Number(raw?.score);const rr=1/(50+rank);
   row.score+=weight*(Number.isFinite(base)?Math.max(0,base):0)+rr;
   if(!row.channels.includes(channel))row.channels.push(channel);
   byId.set(id,row);
  }
 };
 apply(input.semantic||[],"semantic",1);
 apply(input.fulltext||[],"fulltext",2.5);
 apply(input.exact||[],"exact",100);
 return [...byId.values()].sort((a,b)=>b.score-a.score||String(a.id).localeCompare(String(b.id))).slice(0,Math.max(1,Number(limit)||20));
}

export function explainConnection(a:any,b:any,semanticSimilarity=0){
 const reasons:string[]=[];
 const am=a?.metadata||{},bm=b?.metadata||{};
 const placeA=clean(am.placeName,160),placeB=clean(bm.placeName,160);
 if(placeA&&placeB&&normalizeSearchText(placeA)===normalizeSearchText(placeB))reasons.push("Comparten el lugar "+placeA+".");
 const tripA=String(am.tripId||""),tripB=String(bm.tripId||"");
 if(tripA&&tripB&&tripA===tripB)reasons.push("Están vinculados al mismo viaje o recorrido.");
 const da=dateOnly(a?.occurredOn),db=dateOnly(b?.occurredOn);
 if(da&&db){
  const diff=Math.abs(Date.parse(da+"T12:00:00Z")-Date.parse(db+"T12:00:00Z"))/86400000;
  if(diff<=2)reasons.push("Ocurrieron en fechas muy cercanas.");
 }
 if(Number(semanticSimilarity)>=.55)reasons.push("Su contenido tiene similitud semántica ("+Math.round(Number(semanticSimilarity)*100)+"%).");
 if(!reasons.length)reasons.push("Comparten términos o contexto recuperado por la búsqueda híbrida.");
 return reasons;
}

export function validateNarrative(value:any,allowedSources:any[]=[]){
 const allowed=new Set((allowedSources||[]).map(x=>String(x.sourceId??x.id??"")).filter(Boolean));
 if(allowed.size<5||allowed.size>10)throw new Error("La narración necesita entre 5 y 10 fuentes.");
 const title=clean(value?.title,200),paragraphs=Array.isArray(value?.paragraphs)?value.paragraphs:[];
 if(!title||!paragraphs.length||paragraphs.length>12)throw new Error("Narración no válida.");
 const used=new Set<string>(),out:any[]=[];
 for(const p of paragraphs){
  const text=clean(p?.text,2200),ids=[...new Set<string>((Array.isArray(p?.sourceIds)?p.sourceIds:[]).map((id:any)=>String(id)))];
  if(!text||!ids.length)throw new Error("Cada párrafo necesita texto y fuentes.");
  for(const id of ids){if(!allowed.has(id))throw new Error("La narración citó una fuente desconocida.");used.add(id);}
  out.push({text,sourceIds:ids});
 }
 return {title,paragraphs:out,sourceIds:[...used]};
}

export function bookSections(){
 return [
  {id:"beginning",title:"Inicio"},{id:"firsts",title:"Primeras veces"},{id:"dates",title:"Citas"},
  {id:"trips",title:"Viajes"},{id:"places",title:"Lugares"},{id:"music",title:"Música"},
  {id:"photos",title:"Fotos"},{id:"quotes",title:"Frases"},{id:"stats",title:"Estadísticas"},
  {id:"narrative",title:"Capítulos narrativos"}
 ];
}

export function sanitizeTranscriptSegments(rows:any[]=[]){
 return (Array.isArray(rows)?rows:[]).slice(0,1000).map((row:any)=>{
  const start=Math.max(0,Math.min(86400,Number(row?.start)||0)),end=Math.max(start,Math.min(86400,Number(row?.end)||start));
  return {start,end,text:clean(row?.text,500)};
 }).filter((x:any)=>x.text).sort((a:any,b:any)=>a.start-b.start||a.end-b.end);
}
