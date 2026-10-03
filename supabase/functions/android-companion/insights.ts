const DAY_MS=86400000;
const MOOD_PAIRS=new Set(["feliz|tranquilo","abrazo|sensible","abrazo|cansado"]);

function pad(value:number){return String(value).padStart(2,"0");}
function validDay(value:unknown){
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split("-").map(Number),date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
function validMonth(value:unknown){return typeof value==="string"&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value);}
function dayFromDate(date:Date){return date.getUTCFullYear()+"-"+pad(date.getUTCMonth()+1)+"-"+pad(date.getUTCDate());}
function dateFromDay(day:string){if(!validDay(day))return null;const [y,m,d]=day.split("-").map(Number);return new Date(Date.UTC(y,m-1,d));}
function addDays(day:string,delta:number){const date=dateFromDay(day);if(!date)return"";date.setUTCDate(date.getUTCDate()+delta);return dayFromDate(date);}
function diffDays(a:string,b:string){const x=dateFromDay(a),y=dateFromDay(b);return x&&y?Math.round((y.getTime()-x.getTime())/DAY_MS):0;}
function daysInMonth(year:number,month:number){return new Date(Date.UTC(year,month,0)).getUTCDate();}
function clampDay(year:number,month:number,day:number){return year+"-"+pad(month)+"-"+pad(Math.min(Math.max(1,day),daysInMonth(year,month)));}
function addMonths(day:string,delta:number){
  if(!validDay(day))return"";
  const [y,m,d]=day.split("-").map(Number),total=y*12+(m-1)+delta,ny=Math.floor(total/12),nm=(total%12+12)%12+1;
  return clampDay(ny,nm,d);
}
function weekStart(day:string){const date=dateFromDay(day);if(!date)return"";const dow=date.getUTCDay()||7;return addDays(day,-(dow-1));}
function bogotaDay(value:unknown){
  const date=value instanceof Date?value:new Date(String(value||""));
  if(!Number.isFinite(date.getTime()))return"";
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||"";
  return get("year")+"-"+get("month")+"-"+get("day");
}
function toBogotaIso(day:string){
  if(!validDay(day))return"";
  return new Date(day+"T00:00:00-05:00").toISOString();
}
function anniversaryFor(startDate:string,month:string){
  if(!validDay(startDate)||!validMonth(month))return"";
  const [year,number]=month.split("-").map(Number),day=Number(startDate.slice(8,10));
  return clampDay(year,number,day);
}

export function periodBounds(kind:string,key:unknown,today:string,startDate=""){
  if(!validDay(today))return null;
  let startDay="",endDay="",normalizedKey="";
  if(kind==="week"){
    const requested=validDay(key)?String(key):today;
    startDay=weekStart(requested);
    if(startDay>weekStart(today))return null;
    endDay=addDays(startDay,7);normalizedKey=startDay;
  }else if(kind==="month"){
    const requested=validMonth(key)?String(key):today.slice(0,7);
    if(requested>today.slice(0,7))return null;
    startDay=requested+"-01";endDay=addMonths(startDay,1);normalizedKey=requested;
  }else if(kind==="year"){
    const requested=/^\d{4}$/.test(String(key||""))?String(key):today.slice(0,4);
    if(requested>today.slice(0,4))return null;
    startDay=requested+"-01-01";endDay=(Number(requested)+1)+"-01-01";normalizedKey=requested;
  }else if(kind==="anniversary"){
    if(!validDay(startDate))return null;
    const current=anniversaryFor(startDate,today.slice(0,7));
    if(!current||today!==current)return null;
    const previousMonth=addMonths(current,-1).slice(0,7);
    startDay=anniversaryFor(startDate,previousMonth);
    endDay=current;
    normalizedKey=current;
  }else if(kind==="range"&&key&&typeof key==="object"){
    const range=key as {startDay?:string;endDay?:string};
    if(!validDay(range.startDay)||!validDay(range.endDay)||String(range.startDay)>=String(range.endDay)||String(range.startDay)>today)return null;
    startDay=String(range.startDay);endDay=String(range.endDay);normalizedKey=startDay+".."+endDay;
  }else return null;
  const current=today>=startDay&&today<endDay;
  return {
    kind,key:normalizedKey,startDay,endDay,start:toBogotaIso(startDay),end:toBogotaIso(endDay),
    current,partial:current&&addDays(today,1)<endDay,today
  };
}

export function previousPeriod(period:any,today:string){
  if(!period||!validDay(period.startDay)||!validDay(period.endDay)||!validDay(today))return null;
  const fullSpan=Math.max(1,diffDays(period.startDay,period.endDay));
  const elapsed=period.current?Math.min(fullSpan,Math.max(1,diffDays(period.startDay,addDays(today,1)))):fullSpan;
  let startDay="";
  if(period.kind==="week")startDay=addDays(period.startDay,-7);
  else if(period.kind==="month")startDay=addMonths(period.startDay,-1);
  else if(period.kind==="year")startDay=(Number(period.startDay.slice(0,4))-1)+"-01-01";
  else startDay=addDays(period.startDay,-fullSpan);
  const naturalEnd=period.kind==="week"?addDays(startDay,7):period.kind==="month"?addMonths(startDay,1):period.kind==="year"?(Number(startDay.slice(0,4))+1)+"-01-01":addDays(startDay,fullSpan);
  const endDay=period.current?addDays(startDay,elapsed):naturalEnd;
  return {kind:period.kind,key:startDay,startDay,endDay,start:toBogotaIso(startDay),end:toBogotaIso(endDay),current:false,partial:period.current&&elapsed<fullSpan,today};
}

export function clipIntervalSeconds(startValue:unknown,endValue:unknown,rangeStart:string,rangeEnd:string,nowMs:number){
  const start=Math.max(Date.parse(String(startValue||"")),Date.parse(rangeStart));
  const rawEnd=endValue?Date.parse(String(endValue)):nowMs;
  const end=Math.min(rawEnd,Date.parse(rangeEnd),nowMs);
  return Number.isFinite(start)&&Number.isFinite(end)&&end>start?Math.round((end-start)/1000):0;
}

export function isInsightVisibleItem(item:any,person:string,today:string){
  if(!item||String(item.author)===String(person))return true;
  const data=item.data||{};
  if(item.kind==="capsule"&&validDay(data.date)&&String(data.date)>today)return false;
  if(item.kind==="note"&&data.surprise===true)return false;
  return true;
}

function effectiveDay(row:any){
  const explicit=row?.data?.date;
  return validDay(explicit)?String(explicit):bogotaDay(row?.created);
}
function inside(day:string,period:any){return validDay(day)&&day>=period.startDay&&day<period.endDay;}
function compatibleMood(a:unknown,b:unknown){
  if(!a||!b)return null;
  const left=String(a),right=String(b);
  if(left===right)return"exact";
  return MOOD_PAIRS.has([left,right].sort().join("|"))?"compatible":null;
}
function safeTitle(value:unknown){return String(value||"").trim().slice(0,160);}
function elapsedMonths(startDate:string,today:string){
  if(!validDay(startDate)||!validDay(today)||startDate>today)return 0;
  const [sy,sm,sd]=startDate.split("-").map(Number),[ty,tm,td]=today.split("-").map(Number);
  let months=(ty-sy)*12+(tm-sm);
  if(td<Math.min(sd,daysInMonth(ty,tm)))months--;
  return Math.max(0,months);
}

const ACHIEVEMENTS=[
  ["memories-10","10 recuerdos","Una historia que ya empieza a llenar la galaxia.","images","memories",10],
  ["memories-25","25 recuerdos","Veinticinco momentos guardados juntos.","images","memories",25],
  ["memories-50","50 recuerdos","Cincuenta pedacitos de historia.","images","memories",50],
  ["memories-100","100 recuerdos","Cien momentos que ya son parte de ustedes.","images","memories",100],
  ["encounters-10","10 encuentros","Diez veces que la galaxia los vio coincidir.","heart-handshake","encounters",10],
  ["encounters-50","50 encuentros","Cincuenta encuentros registrados.","heart-handshake","encounters",50],
  ["encounters-100","100 encuentros","Cien encuentros compartidos.","heart-handshake","encounters",100],
  ["distance-100","100 km juntos","Cien kilómetros que ya cuentan historia.","route","distance_m",100000],
  ["distance-500","500 km juntos","Quinientos kilómetros de caminos compartidos.","route","distance_m",500000],
  ["distance-1000","1.000 km juntos","Mil kilómetros en la misma galaxia.","route","distance_m",1000000],
  ["journey-first","Primer viaje","El primer viaje guardado en Nuestra Galaxia.","map","journeys",1],
  ["participation-30","30 días juntos","Treinta días con participación de ambos.","sprout","joint_days",30],
  ["anniversary-1","Primer mes","El primer mes de esta historia.","calendar-heart","months",1],
  ["anniversary-6","Seis meses","Medio año construyendo recuerdos.","calendar-heart","months",6],
  ["anniversary-12","Un año","Doce meses de historia compartida.","calendar-heart","months",12],
  ["anniversary-24","Dos años","Veinticuatro meses de camino compartido.","calendar-heart","months",24]
] as const;

export function evaluateAchievements(input:any){
  const values={
    memories:Math.max(0,Number(input?.memories)||0),
    encounters:Math.max(0,Number(input?.encounters)||0),
    distance_m:Math.max(0,Number(input?.distance_m)||0),
    journeys:Math.max(0,Number(input?.journeys)||0),
    joint_days:Math.max(0,Number(input?.joint_days)||0),
    months:elapsedMonths(String(input?.startDate||""),String(input?.today||""))
  } as Record<string,number>;
  return ACHIEVEMENTS.map(([id,title,description,icon,metric,threshold])=>{
    const value=values[metric]||0;
    return {id,title,description,icon,metric,threshold,value,unlocked:value>=threshold,progress:Math.min(1,threshold?value/threshold:0)};
  });
}

export function aggregateInsightRows(input:any){
  const period=input.period;
  const nowMs=Number.isFinite(Number(input.nowMs))?Number(input.nowMs):Date.now();
  const visibleItems=(input.items||[]).filter((row:any)=>isInsightVisibleItem(row,String(input.person??"0"),period.today||period.endDay)).filter((row:any)=>inside(effectiveDay(row),period));
  const counts={
    saved:visibleItems.length,
    memories:visibleItems.filter((x:any)=>x.kind==="memory").length,
    plansDone:visibleItems.filter((x:any)=>x.kind==="plan"&&x.data?.done===true).length,
    events:visibleItems.filter((x:any)=>x.kind==="event").length,
    songs:visibleItems.filter((x:any)=>x.kind==="song").length,
    notes:visibleItems.filter((x:any)=>x.kind==="note").length,
    journeys:visibleItems.filter((x:any)=>x.kind==="journey").length,
    wishesDone:visibleItems.filter((x:any)=>x.kind==="wish"&&x.data?.done===true).length
  };
  const trips=(input.trips||[]).filter((row:any)=>clipIntervalSeconds(row.started_at,row.ended_at,period.start,period.end,nowMs)>0||inside(bogotaDay(row.started_at),period));
  const byPerson:Record<string,number>={};let distanceM=0,durationS=0;
  for(const row of trips){
    const distance=Math.max(0,Number(row.distance_m)||0),duration=Math.max(0,Number(row.duration_s)||0),person=String(row.person);
    distanceM+=distance;durationS+=duration;byPerson[person]=(byPerson[person]||0)+distance;
  }
  const encounterDurations=(input.encounters||[]).map((row:any)=>clipIntervalSeconds(row.started_at,row.ended_at,period.start,period.end,nowMs)).filter((seconds:number)=>seconds>0);
  const togetherSeconds=encounterDurations.reduce((a:number,b:number)=>a+b,0);
  const daily=(input.daily||[]).filter((row:any)=>inside(String(row.day||""),period));
  const days=new Map<string,any[]>();
  for(const row of daily){const list=days.get(String(row.day))||[];list.push(row);days.set(String(row.day),list);}
  let moodDays=0,answerDays=0,exactMoodDays=0,compatibleMoodDays=0;
  const moodDistribution:Record<string,Record<string,number>>={"0":{},"1":{}};
  const calendar:any[]=[];
  for(const [day,rows] of days){
    const byPerson=new Map(rows.map((row:any)=>[String(row.person),row]));
    const a:any=byPerson.get("0"),b:any=byPerson.get("1");
    for(const row of rows){
      if(row.mood){
        const p=String(row.person);if(!moodDistribution[p])moodDistribution[p]={};
        moodDistribution[p][row.mood]=(moodDistribution[p][row.mood]||0)+1;
      }
    }
    if(a?.mood&&b?.mood){
      moodDays++;
      const match=compatibleMood(a.mood,b.mood);
      if(match==="exact")exactMoodDays++;
      if(match==="compatible")compatibleMoodDays++;
    }
    if(a?.answer&&b?.answer)answerDays++;
    calendar.push({day,people:rows.map((row:any)=>({person:String(row.person),mood:row.mood||null,answered:!!row.answer}))});
  }
  const bond=(input.bond||[]).filter((row:any)=>inside(bogotaDay(row.created),period));
  const placeNames=new Map((input.places||[]).map((p:any)=>[String(p.id),safeTitle(p.name)]));
  const visitCounts=new Map<string,number>();
  for(const event of input.placeEvents||[]){
    if(event.event!=="arrived"||!inside(bogotaDay(event.happened_at),period))continue;
    const id=String(event.place_id);visitCounts.set(id,(visitCounts.get(id)||0)+1);
  }
  const visits=[...visitCounts.entries()].map(([id,count])=>({id,name:placeNames.get(id)||"Lugar guardado",count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,"es")).slice(0,12);
  const photos=(input.photos||[]).filter((row:any)=>inside(bogotaDay(row.created),period)).slice(0,12).map((row:any)=>({
    path:String(row.path||""),name:safeTitle(row.originalName||row.name||"Foto"),created:row.created||null,url:row.url||null
  }));
  const highlights=visibleItems.filter((x:any)=>["memory","plan","event","journey"].includes(x.kind)&&!(x.kind==="plan"&&!x.data?.done)).sort((a:any,b:any)=>effectiveDay(b).localeCompare(effectiveDay(a))).slice(0,10).map((x:any)=>({
    id:String(x.id),kind:String(x.kind),title:safeTitle(x.data?.title||"Parte de nuestra historia"),date:effectiveDay(x)
  }));
  const jointDays=new Map<string,Set<string>>();
  for(const row of input.participation||[]){
    if(!inside(String(row.day||""),period))continue;
    const set=jointDays.get(String(row.day))||new Set<string>();set.add(String(row.person));jointDays.set(String(row.day),set);
  }
  const jointCount=[...jointDays.values()].filter(set=>set.has("0")&&set.has("1")).length;
  const series:Record<string,any>={};
  if(period.kind==="year"){
    for(let month=1;month<=12;month++){
      const key=period.startDay.slice(0,4)+"-"+pad(month);
      series[key]={memories:0,plansDone:0,events:0,songs:0,distance_m:0,together_seconds:0,mood_days:0};
    }
    for(const item of visibleItems){const bucket=series[effectiveDay(item).slice(0,7)];if(!bucket)continue;if(item.kind==="memory")bucket.memories++;if(item.kind==="plan"&&item.data?.done)bucket.plansDone++;if(item.kind==="event")bucket.events++;if(item.kind==="song")bucket.songs++;}
    for(const trip of trips){const bucket=series[bogotaDay(trip.started_at).slice(0,7)];if(bucket)bucket.distance_m+=Math.max(0,Number(trip.distance_m)||0);}
    for(const row of input.encounters||[]){const bucket=series[bogotaDay(row.started_at).slice(0,7)];if(bucket)bucket.together_seconds+=clipIntervalSeconds(row.started_at,row.ended_at,period.start,period.end,nowMs);}
    for(const [day,rows] of days){const people=new Set(rows.filter((x:any)=>x.mood).map((x:any)=>String(x.person)));if(people.has("0")&&people.has("1")&&series[day.slice(0,7)])series[day.slice(0,7)].mood_days++;}
  }
  return {
    period,counts,
    trips:{count:trips.length,distance_m:Math.round(distanceM),duration_s:Math.round(durationS),by_person_m:Object.fromEntries(Object.entries(byPerson).map(([k,v])=>[k,Math.round(v)]))},
    encounters:{count:encounterDurations.length,together_seconds:Math.round(togetherSeconds),average_seconds:encounterDurations.length?Math.round(togetherSeconds/encounterDurations.length):0,longest_seconds:encounterDurations.length?Math.max(...encounterDurations):0},
    places:{visits},
    connection:{mood_days:moodDays,answer_days:answerDays,exact_mood_days:exactMoodDays,compatible_mood_days:compatibleMoodDays,joint_days:jointCount},
    moods:{distribution:moodDistribution,calendar},
    questions:{answered_together_days:answerDays},
    bond:{gestures:bond.filter((x:any)=>x.type==="gesture").length,voices:bond.filter((x:any)=>x.type==="voice").length,rituals:bond.filter((x:any)=>x.type==="ritual").length,shared_notes:bond.filter((x:any)=>x.type==="sharednote").length},
    highlights,photos,series
  };
}
