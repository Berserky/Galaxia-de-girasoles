export const GOAL_CATEGORIES=["travel","home","learning","experience","project","wellbeing","other"];
export const GOAL_STATUSES=["active","paused","completed","archived"];

const MAX_MONEY=1_000_000_000_000;
const clean=(value:unknown,max=10000)=>String(value??"").trim().slice(0,max);
const validDay=(value:unknown)=>{
 const v=clean(value,10);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const d=new Date(v+"T12:00:00Z");
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;
};
const money=(value:unknown,label:string)=>{
 const n=Number(value);
 if(!Number.isFinite(n)||n<=0||n>MAX_MONEY||!Number.isInteger(n))throw new Error(label+" debe ser un monto positivo válido.");
 return n;
};
const normalizeCategory=(value:unknown)=>{
 const raw=clean(value,50).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 if(["travel","viaje","escapada"].includes(raw))return"travel";
 if(["home","casa","hogar"].includes(raw))return"home";
 if(["learning","aprendizaje","estudio","aprender"].includes(raw))return"learning";
 if(["experience","experiencia","aventura"].includes(raw))return"experience";
 if(["project","proyecto"].includes(raw))return"project";
 if(["wellbeing","bienestar","salud"].includes(raw))return"wellbeing";
 return GOAL_CATEGORIES.includes(raw)?raw:"other";
};
const people=(values:any)=>{
 const list=Array.isArray(values)?values.map(String).filter(x=>x==="0"||x==="1"):[];
 return [...new Set(list)].sort();
};
const forbiddenBankField=(input:any)=>{
 if(!input||typeof input!=="object")return"";
 return Object.keys(input).find(key=>/bank|account|routing|plaid|stripe|financial[_-]?institution|iban|swift/i.test(key))||"";
};

export function normalizeGoalInput(input:any={}){
 if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("Objetivo no válido.");
 const forbidden=forbiddenBankField(input);
 if(forbidden)throw new Error("No se permiten campos bancarios en Galaxy Goals.");
 const kind=input.kind==="savings"?"savings":"goal";
 const title=clean(input.title,160),description=clean(input.description??input.body,4000);
 if(!title)throw new Error("El objetivo necesita un título.");
 const participants=people(input.participants);
 if(!participants.length)throw new Error("El objetivo necesita al menos un participante.");
 const status=GOAL_STATUSES.includes(String(input.status))?String(input.status):"active";
 const targetDate=clean(input.targetDate??input.target_date,10);
 if(targetDate&&!validDay(targetDate))throw new Error("Fecha objetivo no válida.");
 const targetAmount=kind==="savings"?money(input.targetAmount??input.target_amount,"El monto objetivo"):null;
 return {
  kind,title,description,category:normalizeCategory(input.category),
  target_date:targetDate||null,status,target_amount:targetAmount,participants
 };
}

export function normalizeContribution(input:any={},person:unknown){
 const contributor=String(person);
 if(!["0","1"].includes(contributor))throw new Error("Participante no válido.");
 if(forbiddenBankField(input))throw new Error("No se permiten datos bancarios en los aportes.");
 const amount=money(input.amount,"El aporte");
 const day=clean(input.date??input.contribution_date,10);
 if(!validDay(day))throw new Error("La fecha del aporte no es válida.");
 return {amount,contribution_date:day,note:clean(input.note,300)||null,contributor};
}

function rowsForGoal(rows:any[],goalId:unknown){
 const id=String(goalId??"");
 return (rows||[]).filter(row=>!row?.goal_id||String(row.goal_id)===id);
}
function contributionDay(row:any){return clean(row?.contribution_date||String(row?.created_at||"").slice(0,10),10);}
function completedDay(row:any){return clean(String(row?.completed_at||"").slice(0,10),10);}

export function computeGoalProgress(goal:any={},steps:any[]=[],contributions:any[]=[]){
 const ownSteps=rowsForGoal(steps,goal.id).slice().sort((a,b)=>Number(a.position||0)-Number(b.position||0));
 const ownContributions=rowsForGoal(contributions,goal.id).slice().sort((a,b)=>contributionDay(a).localeCompare(contributionDay(b))||String(a.id||"").localeCompare(String(b.id||"")));
 const stepsTotal=ownSteps.length,stepsCompleted=ownSteps.filter(step=>!!step.completed_at).length;
 const stepProgressPct=stepsTotal?Math.round(stepsCompleted/stepsTotal*100):(goal.status==="completed"?100:0);
 let accumulatedAmount=0,achievedAt:string|null=null;
 const target=Math.max(0,Number(goal.target_amount)||0);
 for(const row of ownContributions){
  accumulatedAmount+=Math.max(0,Number(row.amount)||0);
  if(!achievedAt&&target>0&&accumulatedAmount>=target)achievedAt=contributionDay(row)||null;
 }
 const moneyProgressPct=target>0?Math.min(100,Math.round(accumulatedAmount/target*100)):0;
 const savings=goal.kind==="savings";
 const progressPct=savings?moneyProgressPct:stepProgressPct;
 return {
  stepsTotal,stepsCompleted,stepProgressPct,
  accumulatedAmount,moneyProgressPct,
  progressPct,
  achieved:savings&&target>0&&accumulatedAmount>=target,
  achievedAt
 };
}

export function reorderStepIds(steps:any[]=[],orderedIds:any[]=[]){
 const current=(steps||[]).map(step=>String(step.id));
 const next=(orderedIds||[]).map(String);
 if(current.length!==next.length||new Set(next).size!==next.length)throw new Error("La lista de pasos no coincide con el objetivo.");
 const expected=new Set(current);
 if(next.some(id=>!expected.has(id)))throw new Error("La lista de pasos no coincide con el objetivo.");
 return next;
}

export function conversionDraft(item:any={},options:any={}){
 if(!item||!["plan","wish"].includes(String(item.kind)))throw new Error("Solo un plan o deseo puede convertirse en objetivo.");
 const data=item.data||{},participants=people(options.participants?.length?options.participants:["0","1"]);
 const sourceKind=String(item.kind);
 return {
  kind:"goal",
  title:clean(data.title,160)|| (sourceKind==="plan"?"Plan convertido":"Deseo convertido"),
  description:clean(data.body,4000),
  category:normalizeCategory(data.planCategory||data.category),
  target_date:validDay(data.date)?String(data.date):null,
  status:data.done===true?"completed":"active",
  target_amount:null,
  participants:participants.length?participants:["0","1"],
  source:{itemId:String(item.id||""),kind:sourceKind,keepOriginal:options.keepOriginal!==false}
 };
}

export function buildGoalDateSuggestions(goals:any[]=[]){
 return (goals||[])
  .filter(goal=>goal&&goal.status==="active"&&normalizeCategory(goal.category)==="travel")
  .map(goal=>({
    id:"goal:"+String(goal.id),goalId:String(goal.id),source:"goal",
    title:"Avanzar: "+clean(goal.title,160),
    body:clean(goal.description,1000)||"Dar un paso juntos hacia este objetivo de viaje.",
    minutes:120,budget:0,where:"salir",planCategory:"travel",
    tags:["goal","travel"],progressPct:Math.max(0,Math.min(100,Number(goal.progressPct)||0))
  }));
}

function periodContains(day:string,period:any){
 if(!validDay(day))return false;
 const start=clean(period?.startDay,10),end=clean(period?.endDay,10);
 return validDay(start)&&validDay(end)&&day>=start&&day<=end;
}

export function buildGoalInsightSummary(goals:any[]=[],steps:any[]=[],contributions:any[]=[],period:any={}){
 let completed=0,savingsAchieved=0,contributionAmount=0;
 const activeProgress:number[]=[];
 const monthly:Record<string,{goals_completed:number,savings_achieved:number,goal_contribution_amount:number}>={};
 if(period?.kind==="year"&&validDay(period.startDay)){
  const year=String(period.startDay).slice(0,4);
  for(let month=1;month<=12;month++){
   const key=year+"-"+String(month).padStart(2,"0");
   monthly[key]={goals_completed:0,savings_achieved:0,goal_contribution_amount:0};
  }
 }
 for(const goal of goals||[]){
  const progress=computeGoalProgress(goal,steps,contributions);
  if(["active","paused"].includes(String(goal.status)))activeProgress.push(progress.progressPct);
  const done=completedDay(goal);
  if(periodContains(done,period)){
   completed++;
   const bucket=monthly[done.slice(0,7)];if(bucket)bucket.goals_completed++;
  }
  if(progress.achievedAt&&periodContains(progress.achievedAt,period)){
   savingsAchieved++;
   const bucket=monthly[progress.achievedAt.slice(0,7)];if(bucket)bucket.savings_achieved++;
  }
 }
 for(const row of contributions||[]){
  const day=contributionDay(row);
  if(!periodContains(day,period))continue;
  const amount=Math.max(0,Number(row.amount)||0);contributionAmount+=amount;
  const bucket=monthly[day.slice(0,7)];if(bucket)bucket.goal_contribution_amount+=amount;
 }
 const activeProgressPct=activeProgress.length?Math.round(activeProgress.reduce((a,b)=>a+b,0)/activeProgress.length):0;
 return {completed,savingsAchieved,contributionAmount,activeProgressPct,series:monthly};
}
