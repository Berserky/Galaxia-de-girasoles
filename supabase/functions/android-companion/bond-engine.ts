export const GESTURE_BEHAVIORS=["message","haptic","message_haptic"];
export const GESTURE_ICONS=["hand","hand-heart","heart","message-circle","sparkles","star","sun","flower-2","smile","music","coffee","map-pin","moon","bell","waves"];

export const BUILTIN_GESTURES=[
 {id:"hug",name:"Abrazo",icon:"hand-heart",text:"Tu pareja te envió un abrazo.",behavior:"message_haptic",builtin:true},
 {id:"kiss",name:"Beso",icon:"heart",text:"Tu pareja te envió un beso.",behavior:"message_haptic",builtin:true},
 {id:"miss",name:"Te extraño",icon:"message-circle",text:"Tu pareja te extraña.",behavior:"message",builtin:true},
 {id:"tap",name:"Toque",icon:"hand",text:"Un toque de tu persona.",behavior:"haptic",builtin:true}
];

const clean=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);

export function bogotaDay(value:unknown){
 const d=value instanceof Date?value:new Date(String(value??""));
 if(!Number.isFinite(d.getTime()))return"";
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
 const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return map.year+"-"+map.month+"-"+map.day;
}

function validDay(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&!Number.isNaN(Date.parse(day+"T12:00:00Z"));}
function dayNumber(day:string){return Math.floor(Date.parse(day+"T12:00:00Z")/86400000);}
function addDays(day:string,n:number){const d=new Date((dayNumber(day)+n)*86400000);return d.toISOString().slice(0,10);}

export function jointParticipationDays(rows:any[]=[]){
 const byDay=new Map<string,Set<string>>();
 for(const row of rows||[]){
  const day=clean(row?.day,10),person=String(row?.person??"");
  if(!validDay(day)||!["0","1"].includes(person))continue;
  const people=byDay.get(day)||new Set<string>();people.add(person);byDay.set(day,people);
 }
 return [...byDay.entries()].filter(([,people])=>people.has("0")&&people.has("1")).map(([day])=>day).sort();
}

export function gardenState(totalDays:unknown){
 const days=Math.max(0,Math.floor(Number(totalDays)||0));
 const stages=[
  {days:0,stage:0,id:"seed",label:"Semilla",icon:"sprout"},
  {days:1,stage:1,id:"sprout",label:"Primer brote",icon:"sprout"},
  {days:7,stage:2,id:"leaves",label:"Hojas nuevas",icon:"leaf"},
  {days:14,stage:3,id:"bud",label:"Primer botón",icon:"flower"},
  {days:30,stage:4,id:"sunflower",label:"Girasol",icon:"flower-2"},
  {days:60,stage:5,id:"path",label:"Sendero",icon:"footprints"},
  {days:100,stage:6,id:"bench",label:"Rincón para dos",icon:"armchair"},
  {days:180,stage:7,id:"lights",label:"Luces del jardín",icon:"sparkles"},
  {days:365,stage:8,id:"galaxy-garden",label:"Jardín de nuestra galaxia",icon:"stars"}
 ];
 let current=stages[0];
 for(const stage of stages)if(days>=stage.days)current=stage;
 const next=stages.find(stage=>stage.days>days)||null;
 const milestones=stages.slice(1).map(stage=>({...stage,unlocked:days>=stage.days}));
 const unlockables=milestones.filter(stage=>stage.unlocked);
 const progressPct=next?Math.max(0,Math.min(100,Math.round((days-current.days)/Math.max(1,next.days-current.days)*100))):100;
 return {totalDays:days,days,stage:current.stage,label:current.label,icon:current.icon,next,progressPct,unlockables,milestones};
}

export function computeBondProgress(rows:any[]=[],now:unknown=new Date()){
 const days=jointParticipationDays(rows);
 const today=bogotaDay(now),totalDays=days.length;
 let recordStreak=0,run=0,previous="";
 for(const day of days){
  if(previous&&dayNumber(day)===dayNumber(previous)+1)run++;else run=1;
  recordStreak=Math.max(recordStreak,run);previous=day;
 }
 let currentStreak=0;
 if(days.length&&today){
  const latest=days[days.length-1];
  if(latest===today||latest===addDays(today,-1)){
   currentStreak=1;
   for(let i=days.length-2;i>=0;i--){
    if(dayNumber(days[i])===dayNumber(days[i+1])-1)currentStreak++;else break;
   }
  }
 }
 return {today,totalDays,currentStreak,recordStreak,jointDays:days,garden:gardenState(totalDays)};
}

export function normalizeCustomGesture(input:any={}){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Gesto no válido.");
 const name=clean(input.name,40),icon=clean(input.icon,40),text=clean(input.text,180),behavior=clean(input.behavior,30);
 if(!name)throw new Error("El gesto necesita un nombre.");
 if(!GESTURE_ICONS.includes(icon))throw new Error("Elige un icono Lucide permitido.");
 if(!text)throw new Error("El gesto necesita un texto.");
 if(!GESTURE_BEHAVIORS.includes(behavior))throw new Error("El comportamiento del gesto no es válido.");
 return {name,icon,text,behavior};
}

export function gestureSnapshot(gesture:any={}){
 const id=clean(gesture.id,80);
 if(!id)throw new Error("Gesto no válido.");
 const normalized=gesture.builtin?gesture:normalizeCustomGesture(gesture);
 return {
  gestureId:id,
  name:clean(normalized.name,40),
  icon:GESTURE_ICONS.includes(String(normalized.icon))?String(normalized.icon):"heart",
  text:clean(normalized.text,180),
  behavior:GESTURE_BEHAVIORS.includes(String(normalized.behavior))?String(normalized.behavior):"message"
 };
}

export function resolveGesture(id:unknown,custom:any[]=[]){
 const key=clean(id,80);
 const builtin=BUILTIN_GESTURES.find(g=>g.id===key);
 if(builtin)return builtin;
 return (custom||[]).find(g=>String(g.id)===key&&g.enabled!==false)||null;
}
