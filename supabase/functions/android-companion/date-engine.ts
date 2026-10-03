const DAY_MS=86400000;
const PLAN_CATEGORIES=new Set(["this-week","when-possible","someday","travel","home"]);

type Question={id:string,text:string,deck:string,tags?:string[]};
type Candidate={id:string,title:string,body:string,minutes:number,budget:number,where:"casa"|"salir",source:string,planCategory:string,tags:string[],distanceM?:number|null,placeId?:number|string|null,done?:boolean};

export const QUESTION_DECKS:Record<string,Question[]>={
 funny:[
  {id:"funny-1",deck:"funny",text:"¿Qué cosa mía te da risa incluso cuando intentas no reírte?"},
  {id:"funny-2",deck:"funny",text:"Si nuestra relación fuera una serie, ¿cómo se llamaría este episodio?"},
  {id:"funny-3",deck:"funny",text:"¿Qué talento completamente inútil deberíamos aprender juntos?"},
  {id:"funny-4",deck:"funny",text:"¿Cuál sería nuestro peor negocio y por qué igual lo intentaríamos?"},
  {id:"funny-5",deck:"funny",text:"¿Qué apodo absurdo nos pondrías como dúo?"}
 ],
 memories:[
  {id:"memory-1",deck:"memories",text:"¿Qué recuerdo nuestro te gustaría volver a vivir exactamente igual?"},
  {id:"memory-2",deck:"memories",text:"¿Qué detalle pequeño recuerdas de una de nuestras primeras salidas?"},
  {id:"memory-3",deck:"memories",text:"¿Cuál ha sido una conversación nuestra que todavía recuerdas?"},
  {id:"memory-4",deck:"memories",text:"¿Qué lugar ya se siente un poquito nuestro?"},
  {id:"memory-5",deck:"memories",text:"¿Qué foto nuestra cuenta una historia que solo nosotros entendemos?"}
 ],
 future:[
  {id:"future-1",deck:"future",text:"¿Qué te gustaría que hiciéramos juntos antes de terminar este año?"},
  {id:"future-2",deck:"future",text:"¿Qué tradición pequeña te gustaría que inventáramos?"},
  {id:"future-3",deck:"future",text:"¿Qué lugar te imaginas conociendo conmigo?"},
  {id:"future-4",deck:"future",text:"¿Qué habilidad te gustaría que aprendiéramos juntos?"},
  {id:"future-5",deck:"future",text:"¿Cómo sería un día normal nuestro que te gustaría vivir más adelante?"}
 ],
 intimate:[
  {id:"intimate-1",deck:"intimate",text:"¿Qué te hace sentir especialmente querido/a por mí?"},
  {id:"intimate-2",deck:"intimate",text:"¿Qué necesitas de mí cuando has tenido un día pesado?"},
  {id:"intimate-3",deck:"intimate",text:"¿Qué parte de nosotros te da más tranquilidad?"},
  {id:"intimate-4",deck:"intimate",text:"¿Hay algo bonito que te cueste decir en voz alta?"},
  {id:"intimate-5",deck:"intimate",text:"¿Qué gesto mío te hace sentir acompañado/a?"}
 ],
 absurd:[
  {id:"absurd-1",deck:"absurd",text:"Si tuviéramos que vivir dentro de una tienda por una semana, ¿cuál escogerías?"},
  {id:"absurd-2",deck:"absurd",text:"Si un alien nos pidiera explicar qué es una cita, ¿qué le mostraríamos?"},
  {id:"absurd-3",deck:"absurd",text:"¿Qué animal sería el peor compañero de apartamento para nosotros?"},
  {id:"absurd-4",deck:"absurd",text:"Si mañana solo pudiéramos hablar con canciones, ¿cuál usarías primero?"},
  {id:"absurd-5",deck:"absurd",text:"¿Qué regla ridícula pondrías en nuestra propia ciudad?"}
 ],
 travel:[
  {id:"travel-1",deck:"travel",text:"¿Qué viaje corto improvisarías conmigo este fin de semana?"},
  {id:"travel-2",deck:"travel",text:"¿Prefieres descubrir un pueblo, una montaña, una playa o una ciudad conmigo?"},
  {id:"travel-3",deck:"travel",text:"¿Qué comida probarías sí o sí durante un viaje nuestro?"},
  {id:"travel-4",deck:"travel",text:"¿Cuál ha sido tu parte favorita de un recorrido que hicimos juntos?"},
  {id:"travel-5",deck:"travel",text:"¿Qué objeto no podría faltar en nuestra maleta compartida?"}
 ],
 "would-you-rather":[
  {id:"rather-1",deck:"would-you-rather",text:"¿Qué prefieres: una cita planeada al detalle o una salida totalmente improvisada?"},
  {id:"rather-2",deck:"would-you-rather",text:"¿Qué prefieres: cocinar juntos en casa o descubrir un lugar nuevo?"},
  {id:"rather-3",deck:"would-you-rather",text:"¿Qué prefieres: volver a nuestro mejor recuerdo o adelantar a una aventura futura?"},
  {id:"rather-4",deck:"would-you-rather",text:"¿Qué prefieres: viaje largo una vez al año o escapadas pequeñas más seguido?"},
  {id:"rather-5",deck:"would-you-rather",text:"¿Qué prefieres: noche de música o noche de películas?"}
 ]
};

const LEGACY_QUESTIONS=[
 "¿Qué fue lo más bonito de tu día?",
 "¿Qué te gustaría que hiciéramos juntos esta semana?",
 "¿Qué recuerdo nuestro te hizo sonreír últimamente?",
 "¿Qué necesitas de mí hoy?",
 "¿Qué lugar te gustaría conocer conmigo?",
 "¿Qué detalle pequeño te hace sentir querido/a?",
 "¿Cuál canción te recuerda a nosotros?",
 "¿Qué comida te gustaría que preparáramos juntos?",
 "¿Qué plan sencillo haría especial un día normal?",
 "¿Qué admiras de nosotros como pareja?",
 "¿Qué te gustaría repetir de estos meses juntos?",
 "¿Qué cosa nueva quisieras enseñarme?",
 "¿Qué te da tranquilidad cuando estamos juntos?",
 "¿Qué foto nuestra te gusta más y por qué?",
 "¿Qué aventura improvisada te gustaría tener?",
 "¿Qué sueño personal quieres que yo acompañe?",
 "¿Qué palabra describe cómo te sientes con nosotros hoy?",
 "¿Qué momento cotidiano quisieras recordar dentro de años?",
 "¿Qué película o serie deberíamos ver juntos?",
 "¿Qué lugar de Bogotá convertirías en nuestro lugar?",
 "¿Qué te gustaría recibir más: abrazos, palabras, tiempo o sorpresas?",
 "¿Qué cosa graciosa de mí te da ternura?",
 "¿Qué hábito bonito podríamos construir juntos?",
 "¿Qué te gustaría celebrar aunque parezca pequeño?",
 "¿Qué aprendiste de mí recientemente?",
 "¿Cómo sería un domingo perfecto juntos?",
 "¿Qué te gustaría que nunca dejáramos de hacer?",
 "¿Qué plan harías conmigo con cero presupuesto?",
 "¿Qué quieres agradecerme hoy?",
 "¿Qué quieres que vivamos antes de terminar este año?"
].map((text,index)=>({id:"legacy-"+String(index+1),deck:index%3===0?"intimate":index%3===1?"future":"memories",text}));

const BUILTIN_CANDIDATES:Candidate[]=[
 {id:"idea-coffee-walk",title:"Café y caminata",body:"Elegir un café y caminar sin afán.",minutes:90,budget:45000,where:"salir",source:"builtin",planCategory:"when-possible",tags:["walk","coffee"]},
 {id:"idea-movie",title:"Noche de película",body:"Elegir una película y preparar algo rico.",minutes:150,budget:25000,where:"casa",source:"builtin",planCategory:"home",tags:["home","music"]},
 {id:"idea-cook",title:"Cocinar juntos",body:"Preparar una receta que ninguno haya hecho.",minutes:120,budget:55000,where:"casa",source:"builtin",planCategory:"home",tags:["home","food"]},
 {id:"idea-photos",title:"Fotos de nosotros",body:"Caminar y tomar cinco fotos que cuenten el día.",minutes:90,budget:0,where:"salir",source:"builtin",planCategory:"when-possible",tags:["walk","photos"]},
 {id:"idea-picnic",title:"Picnic sencillo",body:"Algo de comer, una manta y un parque.",minutes:150,budget:40000,where:"salir",source:"builtin",planCategory:"when-possible",tags:["park","food"]},
 {id:"idea-questions-dessert",title:"Preguntas y postre",body:"Responder preguntas juntos con algo rico.",minutes:60,budget:30000,where:"casa",source:"builtin",planCategory:"home",tags:["home","questions"]},
 {id:"idea-route",title:"Ruta sin destino",body:"Salir y decidir cada giro por turnos.",minutes:120,budget:30000,where:"salir",source:"builtin",planCategory:"when-possible",tags:["route"]},
 {id:"idea-album",title:"Álbum del mes",body:"Elegir fotos del mes y escribir una frase para cada una.",minutes:60,budget:0,where:"casa",source:"builtin",planCategory:"home",tags:["home","photos"]},
 {id:"idea-music",title:"Una hora de nuestra música",body:"Elegir canciones y hablar de lo que les recuerdan.",minutes:45,budget:0,where:"casa",source:"builtin",planCategory:"home",tags:["home","music"]},
 {id:"idea-neighborhood",title:"Paseo de 30 minutos",body:"Caminar cerca y escoger algo que nunca habían mirado.",minutes:30,budget:0,where:"salir",source:"builtin",planCategory:"this-week",tags:["walk"]}
];

function hash(value:string){
 let h=2166136261;
 for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}
 return h>>>0;
}
function stableIndex(seed:string,length:number){return length?hash(seed)%length:0;}
function cleanText(value:unknown){return String(value??"").trim();}
function normalizeWhere(value:unknown):"casa"|"salir"|"cualquiera"{
 const v=cleanText(value).toLowerCase();
 return v==="casa"?"casa":v==="salir"?"salir":"cualquiera";
}
function validDay(value:unknown){return /^\d{4}-\d{2}-\d{2}$/.test(cleanText(value));}
function monthlyAnniversary(context:any){
 if(!validDay(context?.today)||!validDay(context?.startDate))return false;
 return String(context.today).slice(8,10)===String(context.startDate).slice(8,10);
}
function recentActivityDeck(context:any){
 if((context?.journeys||[]).length)return "travel";
 if((context?.memories||[]).length)return "memories";
 return "";
}

export function normalizeConstraints(input:any={}){
 const budgetRaw=Number(input.budget),minutesRaw=Number(input.minutes),distanceRaw=Number(input.maxDistanceM);
 return {
  budget:Number.isFinite(budgetRaw)?Math.max(0,Math.round(budgetRaw)):null,
  minutes:Number.isFinite(minutesRaw)?Math.max(15,Math.round(minutesRaw)):120,
  where:normalizeWhere(input.where),
  transport:["motorcycle","transit","walking","vehicle","auto"].includes(cleanText(input.transport))?cleanText(input.transport):"auto",
  maxDistanceM:Number.isFinite(distanceRaw)?Math.max(0,Math.round(distanceRaw)):null,
  hour:Number.isFinite(Number(input.hour))?Math.max(0,Math.min(23,Math.floor(Number(input.hour)))):null,
  category:cleanText(input.category)||""
 };
}

export function normalizePlanCategory(data:any={}){
 const explicit=cleanText(data.planCategory);
 if(PLAN_CATEGORIES.has(explicit))return explicit;
 const legacy=cleanText(data.category).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(/viaje|escapada|travel/.test(legacy))return "travel";
 if(/casa|hogar|home/.test(legacy))return "home";
 if(/esta semana|semana|pronto/.test(legacy))return "this-week";
 if(/algun dia|algún día|someday/.test(legacy))return "someday";
 return "when-possible";
}

function allQuestions(){
 return [...LEGACY_QUESTIONS,...Object.values(QUESTION_DECKS).flat()];
}
function contextualDecks(context:any){
 if(monthlyAnniversary(context))return ["memories","future","intimate"];
 const activity=recentActivityDeck(context);
 if(activity)return [activity,activity==="travel"?"memories":"future","funny","intimate"];
 const day=validDay(context?.today)?new Date(String(context.today)+"T12:00:00Z").getUTCDay():0;
 if(day===5||day===6)return ["funny","would-you-rather","travel","absurd"];
 return ["future","intimate","funny","memories","would-you-rather","absurd","travel"];
}

export function selectQuestion(context:any={},options:any={}){
 const requested=cleanText(options.deck);
 const recent=new Set((context.recentQuestionIds||[]).map(String));
 let pool:Question[]=[];
 if(requested&&QUESTION_DECKS[requested])pool=QUESTION_DECKS[requested].slice();
 else{
  const decks=contextualDecks(context);
  for(const deck of decks)pool.push(...(QUESTION_DECKS[deck]||[]));
  pool.push(...LEGACY_QUESTIONS);
 }
 let candidates=pool.filter(q=>!recent.has(q.id));
 if(!candidates.length)candidates=pool.length?pool:allQuestions();
 const preferred=contextualDecks(context);
 candidates.sort((a,b)=>{
  const pa=preferred.indexOf(a.deck),pb=preferred.indexOf(b.deck);
  const aa=pa<0?99:pa,bb=pb<0?99:pb;
  return aa-bb||a.id.localeCompare(b.id);
 });
 const topRank=candidates.length?Math.min(candidates.length,requested?candidates.length:Math.max(4,Math.ceil(candidates.length*.45))):0;
 const shortlist=candidates.slice(0,topRank||candidates.length);
 const seed=cleanText(options.seed)||[context.today,context.startDate,(context.memories||[]).length,(context.journeys||[]).length].join("|");
 return shortlist[stableIndex(seed,shortlist.length)]||allQuestions()[0];
}

function numberOr(value:unknown,fallback:number){
 const n=Number(value);return Number.isFinite(n)?n:fallback;
}
function candidateFromPlan(plan:any):Candidate{
 const data=plan?.data&&typeof plan.data==="object"?plan.data:plan||{};
 return {
  id:String(plan.id||data.id||"plan-"+hash(JSON.stringify(data))),
  title:cleanText(data.title)||"Plan pendiente",
  body:cleanText(data.body),
  minutes:Math.max(15,numberOr(data.minutes,120)),
  budget:Math.max(0,numberOr(data.budget,0)),
  where:normalizeWhere(data.where)==="casa"?"casa":"salir",
  source:"pending",
  planCategory:normalizePlanCategory(data),
  tags:["saved-plan"],
  distanceM:Number.isFinite(Number(data.distanceM))?Math.max(0,Number(data.distanceM)):null,
  placeId:data.placeId??null,
  done:data.done===true
 };
}
function candidateFromPlace(place:any,index:number):Candidate{
 return {
  id:"place-"+String(place.id??index),
  title:"Volver a "+(cleanText(place.name)||"un lugar de ustedes"),
  body:cleanText(place.note)||"Hacer un plan sencillo alrededor de este lugar.",
  minutes:90,budget:25000,where:"salir",source:"place",planCategory:"when-possible",tags:["place"],
  distanceM:Number.isFinite(Number(place.distanceM))?Math.max(0,Number(place.distanceM)):null,
  placeId:place.id??null,done:false
 };
}

export function buildCandidates(context:any={},constraintsInput:any={}){
 const constraints=normalizeConstraints(constraintsInput);
 const out:Candidate[]=BUILTIN_CANDIDATES.map(x=>({...x,tags:x.tags.slice()}));
 for(const plan of context.pendingPlans||[]){
  const c=candidateFromPlan(plan);if(!c.done)out.push(c);
 }
 const seenPlaces=new Set<string>();
 for(const place of [...(context.frequentPlaces||[]),...(context.places||[])]){
  const key=String((place.id??place.name)||"");if(!key||seenPlaces.has(key))continue;seenPlaces.add(key);
  out.push(candidateFromPlace(place,out.length));
 }
 return out.filter(c=>{
  if(constraints.where!=="cualquiera"&&c.where!==constraints.where)return false;
  if(constraints.budget!==null&&c.budget>constraints.budget)return false;
  if(c.minutes>constraints.minutes)return false;
  if(constraints.maxDistanceM!==null&&c.distanceM!=null&&c.distanceM>constraints.maxDistanceM)return false;
  return true;
 });
}

function titleKey(value:unknown){return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function travelMinutes(distanceM:number,transport:string){
 const km=Math.max(0,distanceM)/1000;
 const speed=transport==="motorcycle"?24:transport==="transit"?14:transport==="walking"?4.5:transport==="vehicle"?20:16;
 return km/speed*60;
}

export function scoreCandidates(candidates:Candidate[],constraintsInput:any,context:any={},options:any={}){
 const constraints=normalizeConstraints({...constraintsInput,transport:constraintsInput?.transport||context.transport});
 const doneTitles=new Set((context.completedPlans||[]).map((p:any)=>titleKey(p?.data?.title||p.title)));
 const pendingIds=new Set((context.pendingPlans||[]).filter((p:any)=>!(p?.data?.done??p.done)).map((p:any)=>String(p.id)));
 const frequentIds=new Set((context.frequentPlaces||[]).map((p:any)=>String(p.id)));
 const seed=cleanText(options.seed)||cleanText(constraintsInput?.seed)||context.today||"date";
 const ranked=(candidates||[]).map((candidate,index)=>{
  let score=50;
  if(candidate.source==="pending"||pendingIds.has(candidate.id))score+=18;
  if(candidate.source==="place"&&candidate.placeId!=null&&frequentIds.has(String(candidate.placeId)))score+=12;
  if(doneTitles.has(titleKey(candidate.title)))score-=120;
  if(constraints.budget!==null){
   const spare=constraints.budget-candidate.budget;
   score+=spare>=0?Math.max(0,10-Math.floor(spare/25000)):-200;
  }
  const timeSpare=constraints.minutes-candidate.minutes;
  score+=timeSpare>=0?Math.max(0,12-Math.floor(timeSpare/30)):-200;
  if(constraints.where!=="cualquiera"&&candidate.where===constraints.where)score+=8;
  if(candidate.distanceM!=null&&context.location?.available!==false){
   const travel=travelMinutes(candidate.distanceM,constraints.transport);
   score+=travel<=20?8:travel<=45?3:-8;
   if(constraints.maxDistanceM!==null&&candidate.distanceM>constraints.maxDistanceM)score-=200;
  }
  if(constraints.hour!=null){
   if(constraints.hour>=20&&candidate.where==="casa")score+=4;
   if(constraints.hour<11&&candidate.tags.includes("coffee"))score+=4;
  }
  const jitter=(hash(seed+"|"+candidate.id+"|"+index)%1000)/1000;
  return {...candidate,score:score+jitter};
 }).filter(x=>x.score>-100);
 return ranked.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}

export function roulettePendingPlans(plans:any[],options:any={}){
 const category=cleanText(options.category);
 const pool=(plans||[]).filter((p:any)=>!(p?.data?.done??p.done)).filter((p:any)=>!category||normalizePlanCategory(p?.data||p)===category);
 if(!pool.length)return null;
 const ordered=pool.slice().sort((a:any,b:any)=>String(a.id||a?.data?.title||"").localeCompare(String(b.id||b?.data?.title||"")));
 return ordered[stableIndex(cleanText(options.seed)||"roulette",ordered.length)]||null;
}

export function buildSurpriseExperience(context:any={},input:any={}){
 const constraints=normalizeConstraints({...input,transport:input.transport||context.transport,hour:input.hour??context.nowHour});
 const ranked=scoreCandidates(buildCandidates(context,constraints),constraints,context,{seed:input.seed});
 const candidate=ranked[0]||null;
 if(!candidate)return null;
 return {kind:"surprise",constraints,candidate,reasons:[
  candidate.source==="pending"?"Ya estaba guardado entre sus planes":"Encaja con el tiempo disponible",
  candidate.budget===0?"No necesita presupuesto":"Cabe dentro del presupuesto",
  candidate.source==="place"?"Aprovecha un lugar de ustedes":candidate.where==="casa"?"Se puede hacer en casa":"Es un plan para salir"
 ]};
}

export function buildSequentialPlan(context:any={},input:any={}){
 const constraints=normalizeConstraints({...input,transport:input.transport||context.transport,hour:input.hour??context.nowHour});
 const ranked=scoreCandidates(buildCandidates(context,constraints),constraints,context,{seed:input.seed});
 const steps:any[]=[];let usedBudget=0,usedMinutes=0;
 for(const candidate of ranked){
  if(steps.some(x=>x.id===candidate.id))continue;
  const transition=steps.length?10:0;
  if(usedBudget+candidate.budget>Number(constraints.budget??Infinity))continue;
  if(usedMinutes+transition+candidate.minutes>constraints.minutes)continue;
  steps.push(candidate);usedBudget+=candidate.budget;usedMinutes+=transition+candidate.minutes;
  if(steps.length>=4)break;
 }
 return {kind:"planner",constraints,steps,totalBudget:Math.round(usedBudget),totalMinutes:Math.round(usedMinutes),remainingBudget:constraints.budget==null?null:Math.max(0,constraints.budget-usedBudget),remainingMinutes:Math.max(0,constraints.minutes-usedMinutes)};
}

export function buildDateRecap(session:any={},context:any={}){
 const today=validDay(context.today)?String(context.today):new Date().toISOString().slice(0,10);
 const startedAt=cleanText(session.startedAt),endedAt=cleanText(session.endedAt);
 const started=Date.parse(startedAt),ended=Date.parse(endedAt);
 const elapsedSeconds=Number.isFinite(started)&&Number.isFinite(ended)&&ended>=started?Math.round((ended-started)/1000):Math.max(0,Number(session.elapsedSeconds)||0);
 const unique=(values:any[])=>[...new Set((values||[]).map(x=>cleanText(x)).filter(Boolean))].slice(0,30);
 return {
  title:cleanText(session.title)||"Nuestra cita · "+today,
  body:"Una noche guardada desde Modo Cita.",
  category:"Modo Cita",date:today,
  dateMode:{
   sessionId:cleanText(session.sessionId),
   startedAt:startedAt||null,endedAt:endedAt||null,elapsedSeconds,
   planId:cleanText(session.planId)||null,
   songId:cleanText(session.songId)||null,
   photoPaths:unique(session.photoPaths),
   questionIds:unique(session.questionIds),
   placeId:session.locationEnabled===true?(session.placeId??null):null,
   locationEnabled:session.locationEnabled===true
  }
 };
}
