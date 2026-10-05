(()=>{
'use strict';
const KEY='galaxy.chat.perf';
const MAX=400;
let enabled=false,seq=0,openAt=0;
let events=[],apiCalls=[],renders=[],loads=[],frames={samples:0,janky:0,worstMs:0,fps:0},longTasks={count:0,totalMs:0,maxMs:0};
let optimistic=new Map(),confirm=new Map(),frameRun=null,lastScrollIntent=0;
const now=()=>performance.now();
const safeAction=value=>String(value||'').replace(/[^a-z0-9-]/gi,'').slice(0,48);
const push=(type,data={})=>{
 if(!enabled)return;
 events.push({t:Number(now().toFixed(2)),type,...data});
 if(events.length>MAX)events.splice(0,events.length-MAX);
};
const chatEl=()=>document.querySelector('#chatMessages');
const snapshot=()=>{
 const el=chatEl();
 return {
  scrollTop:Math.round(el?.scrollTop||0),
  scrollHeight:Math.round(el?.scrollHeight||0),
  clientHeight:Math.round(el?.clientHeight||0),
  messages:document.querySelectorAll('.chat-message').length,
  nodes:el?.querySelectorAll('*').length||0,
  images:el?.querySelectorAll('img').length||0,
  videos:el?.querySelectorAll('video').length||0,
  audios:el?.querySelectorAll('audio').length||0
 };
};
function readEnabled(){try{return localStorage.getItem(KEY)==='1';}catch{return false;}}
function reset(){
 seq=0;openAt=0;events=[];apiCalls=[];renders=[];loads=[];frames={samples:0,janky:0,worstMs:0,fps:0};
 longTasks={count:0,totalMs:0,maxMs:0};optimistic.clear();confirm.clear();frameRun=null;
}
function enable(value=true){
 enabled=!!value;
 try{localStorage.setItem(KEY,enabled?'1':'0');}catch{}
 if(!enabled)reset();
 return enabled;
}
function beginOpen(kind='warm'){if(!enabled)return null;openAt=now();push('open-start',{kind:safeAction(kind)});return openAt;}
function apiStart(action){
 if(!enabled||!String(action||'').startsWith('chat-'))return null;
 return {id:++seq,action:safeAction(action),at:now()};
}
function apiEnd(token,ok=true){
 if(!enabled||!token)return;
 const ms=now()-token.at;
 apiCalls.push({action:token.action,ms:Number(ms.toFixed(2)),ok:!!ok});
 if(apiCalls.length>MAX)apiCalls.shift();
 push('api',{action:token.action,ms:Number(ms.toFixed(2)),ok:!!ok});
}
function renderStart(reason='chat'){
 if(!enabled)return null;
 const before=snapshot(),token={id:++seq,reason:safeAction(reason),at:now(),before};
 return token;
}
function renderEnd(token){
 if(!enabled||!token)return;
 const syncMs=now()-token.at;
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  const after=snapshot(),totalMs=now()-token.at;
  const wasHistory=token.before.scrollTop>Math.max(180,token.before.clientHeight*.45) &&
    token.before.scrollHeight-token.before.scrollTop-token.before.clientHeight>110;
  const jumped=wasHistory&&after.scrollTop<45&&Date.now()-lastScrollIntent>120;
  const row={reason:token.reason,syncMs:Number(syncMs.toFixed(2)),settledMs:Number(totalMs.toFixed(2)),before:token.before,after,jumped};
  renders.push(row);if(renders.length>MAX)renders.shift();
  if(jumped)push('scroll-jump',{from:token.before.scrollTop,to:after.scrollTop,reason:token.reason});
  if(openAt){
   push('first-visible',{ms:Number((totalMs+(token.at-openAt)).toFixed(2))});
   openAt=0;
  }
 }));
}
function loadStart(kind='state'){if(!enabled)return null;return {id:++seq,kind:safeAction(kind),at:now()};}
function loadEnd(token,extra={}){
 if(!enabled||!token)return;
 const row={kind:token.kind,ms:Number((now()-token.at).toFixed(2)),messages:Number(extra.messages||0),older:!!extra.older};
 loads.push(row);if(loads.length>MAX)loads.shift();push('load',row);
}
function optimisticStart(clientId){if(!enabled||!clientId)return;optimistic.set(String(clientId),now());}
function optimisticVisible(clientId){
 if(!enabled||!clientId)return;
 const key=String(clientId),at=optimistic.get(key);if(at==null)return;
 push('send-visual',{ms:Number((now()-at).toFixed(2))});
}
function confirmed(clientId){
 if(!enabled||!clientId)return;
 const key=String(clientId),at=optimistic.get(key);if(at==null)return;
 const ms=now()-at;confirm.set(key,ms);push('send-confirmed',{ms:Number(ms.toFixed(2))});optimistic.delete(key);
}
function sampleFrames(){
 if(!enabled||frameRun)return;
 const start=now();let previous=start,count=0,janky=0,worst=0;
 const tick=t=>{
  const delta=t-previous;previous=t;if(count>0){if(delta>34)janky++;worst=Math.max(worst,delta);}count++;
  if(t-start<900){frameRun=requestAnimationFrame(tick);return;}
  const seconds=(t-start)/1000;
  frames={samples:count,janky,worstMs:Number(worst.toFixed(2)),fps:Number((count/seconds).toFixed(1))};frameRun=null;
 };
 frameRun=requestAnimationFrame(tick);
}
document.addEventListener('scroll',e=>{
 if(e.target?.id==='chatMessages'){lastScrollIntent=Date.now();sampleFrames();}
},true);
try{
 if('PerformanceObserver'in window){
  const observer=new PerformanceObserver(list=>{
   if(!enabled)return;
   for(const entry of list.getEntries()){
    longTasks.count++;longTasks.totalMs+=entry.duration;longTasks.maxMs=Math.max(longTasks.maxMs,entry.duration);
   }
  });
  observer.observe({type:'longtask',buffered:true});
 }
}catch{}
enabled=readEnabled();
window.GalaxyChatPerf={
 enable,enabled:()=>enabled,reset,beginOpen,apiStart,apiEnd,renderStart,renderEnd,loadStart,loadEnd,
 optimisticStart,optimisticVisible,confirmed,snapshot,
 note:(type,data={})=>push(safeAction(type),Object.fromEntries(Object.entries(data).filter(([,v])=>typeof v==='number'||typeof v==='boolean'))),
 report:()=>({
  enabled,generatedAt:new Date().toISOString(),
  events:[...events],apiCalls:[...apiCalls],renders:[...renders],loads:[...loads],frames:{...frames},
  longTasks:{count:longTasks.count,totalMs:Number(longTasks.totalMs.toFixed(2)),maxMs:Number(longTasks.maxMs.toFixed(2))},
  dom:snapshot()
 })
};
})();