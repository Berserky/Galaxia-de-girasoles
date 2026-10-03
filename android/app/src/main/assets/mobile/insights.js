(function(root){
 const DAY_MS=86400000;
 const MOOD_PAIRS=new Set(['feliz|tranquilo','abrazo|sensible','abrazo|cansado']);

 const pad=value=>String(value).padStart(2,'0');
 function validDay(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return false;
  const [y,m,d]=String(value).split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
 }
 function validMonth(value){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||'')))return false;
  return true;
 }
 function validYear(value){return /^\d{4}$/.test(String(value||''));}
 function dayFromDate(date){return date.getUTCFullYear()+'-'+pad(date.getUTCMonth()+1)+'-'+pad(date.getUTCDate());}
 function dateFromDay(day){if(!validDay(day))return null;const [y,m,d]=day.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));}
 function addDays(day,delta){const date=dateFromDay(day);if(!date)return'';date.setUTCDate(date.getUTCDate()+Number(delta||0));return dayFromDate(date);}
 function diffDays(start,end){const a=dateFromDay(start),b=dateFromDay(end);return a&&b?Math.round((b-a)/DAY_MS):0;}
 function daysInMonth(year,month){return new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();}
 function clampDay(year,month,day){const d=Math.min(Math.max(1,Number(day)||1),daysInMonth(year,month));return Number(year)+'-'+pad(month)+'-'+pad(d);}
 function addYearsDay(day,years){if(!validDay(day))return'';const [y,m,d]=day.split('-').map(Number);return clampDay(y+Number(years||0),m,d);}
 function addMonthsDay(day,months){if(!validDay(day))return'';const [y,m,d]=day.split('-').map(Number),total=y*12+(m-1)+Number(months||0),ny=Math.floor(total/12),nm=(total%12+12)%12+1;return clampDay(ny,nm,d);}
 function bogotaDay(value){
  const date=value instanceof Date?value:new Date(value);
  if(!Number.isFinite(date.getTime()))return'';
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=type=>parts.find(part=>part.type===type)?.value||'';
  return get('year')+'-'+get('month')+'-'+get('day');
 }
 function weekStart(day){
  const date=dateFromDay(day);if(!date)return'';
  const dow=date.getUTCDay()||7;
  return addDays(day,-(dow-1));
 }
 function periodLabel(kind,startDay,endDay){
  const start=dateFromDay(startDay),last=dateFromDay(addDays(endDay,-1));
  if(!start||!last)return'';
  if(kind==='week'){
   const a=new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',timeZone:'UTC'}).format(start);
   const b=new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(last);
   return a+' – '+b;
  }
  if(kind==='month')return new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}).format(start);
  if(kind==='year')return String(start.getUTCFullYear());
  return startDay+' – '+addDays(endDay,-1);
 }
 function periodFor(kind,key,today){
  const current=validDay(today)?String(today):bogotaDay(new Date());
  if(!validDay(current))return null;
  let startDay='',endDay='',normalizedKey='';
  if(kind==='week'){
   const requested=validDay(key)?String(key):current;
   startDay=weekStart(requested);
   const currentStart=weekStart(current);
   if(startDay>currentStart)return null;
   endDay=addDays(startDay,7);
   normalizedKey=startDay;
  }else if(kind==='month'){
   const requested=validMonth(key)?String(key):current.slice(0,7);
   if(!validMonth(requested)||requested>current.slice(0,7))return null;
   startDay=requested+'-01';
   endDay=addMonthsDay(startDay,1);
   normalizedKey=requested;
  }else if(kind==='year'){
   const requested=validYear(key)?String(key):current.slice(0,4);
   if(!validYear(requested)||requested>current.slice(0,4))return null;
   startDay=requested+'-01-01';
   endDay=(Number(requested)+1)+'-01-01';
   normalizedKey=requested;
  }else if(kind==='range'&&key&&typeof key==='object'){
   if(!validDay(key.startDay)||!validDay(key.endDay)||key.startDay>=key.endDay||key.startDay>current)return null;
   startDay=String(key.startDay);endDay=String(key.endDay);normalizedKey=startDay+'..'+endDay;
  }else return null;
  return {
   kind,key:normalizedKey,startDay,endDay,today:current,
   start:startDay+'T05:00:00.000Z',end:endDay+'T05:00:00.000Z',
   label:periodLabel(kind,startDay,endDay),
   current:current>=startDay&&current<endDay,
   partial:current>=startDay&&current<endDay&&addDays(current,1)<endDay
  };
 }
 function shiftPeriod(period,delta){
  if(!period||!Number.isInteger(Number(delta)))return null;
  const amount=Number(delta),today=period.today;
  if(period.kind==='week')return periodFor('week',addDays(period.startDay,amount*7),today);
  if(period.kind==='month'){
   const shifted=addMonthsDay(period.startDay,amount);
   return shifted?periodFor('month',shifted.slice(0,7),today):null;
  }
  if(period.kind==='year')return periodFor('year',String(Number(period.key)+amount),today);
  if(period.kind==='range'){
   const span=diffDays(period.startDay,period.endDay);
   return periodFor('range',{startDay:addDays(period.startDay,span*amount),endDay:addDays(period.endDay,span*amount)},today);
  }
  return null;
 }
 function anniversaryDay(startDate,month){
  if(!validDay(startDate)||!validMonth(month))return'';
  const day=Number(startDate.slice(8,10)),[year,number]=month.split('-').map(Number);
  return clampDay(year,number,day);
 }
 function relationshipClock(startDate,nowIso){
  if(!validDay(startDate))return null;
  const now=new Date(nowIso||Date.now());
  if(!Number.isFinite(now.getTime()))return null;
  const current=bogotaDay(now);
  if(!validDay(current)||startDate>current)return null;
  const startYear=Number(startDate.slice(0,4)),currentYear=Number(current.slice(0,4));
  let years=currentYear-startYear,yearAnchor=addYearsDay(startDate,years);
  if(yearAnchor>current){years--;yearAnchor=addYearsDay(startDate,years);}
  let months=0;
  for(let next=1;next<=11;next++){
   const candidate=addMonthsDay(yearAnchor,next);
   if(candidate&&candidate<=current)months=next;else break;
  }
  const monthAnchor=addMonthsDay(yearAnchor,months),days=Math.max(0,diffDays(monthAnchor,current));
  const totalDays=Math.max(0,diffDays(startDate,current));
  const started=Date.parse(startDate+'T00:00:00-05:00');
  const totalHours=Number.isFinite(started)?Math.max(0,Math.floor((now.getTime()-started)/3600000)):totalDays*24;
  return {years,months,days,totalDays,totalHours,startDate,currentDay:current};
 }
 function compareMetrics(current,previous){
  const out={},keys=new Set([...Object.keys(current||{}),...Object.keys(previous||{})]);
  for(const key of keys){
   const a=Number(current?.[key]),b=Number(previous?.[key]);
   if(Number.isFinite(a)||Number.isFinite(b))out[key]=(Number.isFinite(a)?a:0)-(Number.isFinite(b)?b:0);
  }
  return out;
 }
 function compatibleMood(a,b){
  if(!a||!b)return null;
  const left=String(a),right=String(b);
  if(left===right)return'exact';
  return MOOD_PAIRS.has([left,right].sort().join('|'))?'compatible':null;
 }

 const api={validDay,validMonth,validYear,bogotaDay,periodFor,shiftPeriod,anniversaryDay,relationshipClock,compareMetrics,compatibleMood,addDays,diffDays,periodLabel};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyInsights=api;
})(typeof globalThis!=='undefined'?globalThis:this);
