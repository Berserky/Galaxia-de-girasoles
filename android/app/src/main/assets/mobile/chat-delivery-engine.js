(()=>{
'use strict';

const STATES=Object.freeze({PENDING:'PENDING',SENDING:'SENDING',SENT:'SENT',FAILED:'FAILED'});
const DEFAULTS=Object.freeze({maxQueue:120,maxRetries:8,baseDelayMs:900,maxDelayMs:30000});

function text(value){return String(value==null?'':value);}
function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function clientIdOf(value){return text(value?.client_id||value?.clientId);}
function normalizeState(value){return Object.values(STATES).includes(value)?value:STATES.PENDING;}

function classifyError(error,{online=true}={}){
 const status=number(error?.status||error?.httpStatus,0);
 const message=text(error?.message||error).toLowerCase();
 if(!online)return {kind:'offline',retryable:true,code:'offline'};
 if(status===401)return {kind:'auth',retryable:false,code:'http_401'};
 if(status===403)return {kind:'permission',retryable:false,code:'http_403'};
 if([400,404,409,413,422].includes(status))return {kind:'permanent',retryable:false,code:'http_'+status};
 if([408,425,429].includes(status)||status>=500)return {kind:'temporary',retryable:true,code:status?'http_'+status:'temporary'};
 if(/sin conexi[oó]n|offline|network|timeout|timed out|tiempo de espera|failed to connect|connection|socket|host|dns|503|502|504/.test(message))return {kind:'temporary',retryable:true,code:'network'};
 if(/v[ií]nculo|no autorizado|unauthorized|forbidden|permiso|permission/.test(message))return {kind:'permission',retryable:false,code:'permission'};
 if(/no v[aá]lid|inv[aá]lid|no existe|demasiado|supera|completa|escribe|no disponible/.test(message))return {kind:'permanent',retryable:false,code:'validation'};
 return {kind:'temporary',retryable:true,code:'unknown'};
}

function create(options={}){
 const config={...DEFAULTS,...options};
 const load=typeof options.load==='function'?options.load:()=>[];
 const save=typeof options.save==='function'?options.save:()=>{};
 const send=typeof options.send==='function'?options.send:async()=>{throw new Error('Delivery transport unavailable.');};
 const online=typeof options.online==='function'?options.online:()=>true;
 const onChange=typeof options.onChange==='function'?options.onChange:()=>{};
 const onConfirm=typeof options.onConfirm==='function'?options.onConfirm:()=>{};
 const onMetric=typeof options.onMetric==='function'?options.onMetric:()=>{};
 const now=typeof options.now==='function'?options.now:()=>Date.now();
 const scheduleTimer=typeof options.setTimer==='function'?options.setTimer:(fn,ms)=>setTimeout(fn,ms);
 const cancelTimer=typeof options.clearTimer==='function'?options.clearTimer:id=>clearTimeout(id);
 let flushPromise=null,retryTimer=null,stopped=false;

 function read(){
  let value=[];
  try{value=load()||[];}catch{}
  if(!Array.isArray(value))value=[];
  return value.slice(-config.maxQueue).map(row=>({
   ...row,
   client_id:clientIdOf(row),
   _localState:normalizeState(row?._localState),
   retryCount:Math.max(0,number(row?.retryCount,0)),
   nextAttemptAt:row?.nextAttemptAt==null?null:Math.max(0,number(row.nextAttemptAt,0)),
   retryable:row?.retryable!==false
  })).filter(row=>row.client_id);
 }
 function write(rows){
  const bounded=(rows||[]).slice(-config.maxQueue);
  save(bounded);
  return bounded;
 }
 function notify(type,row,meta={}){
  try{onChange({type,row:row?{...row}:null,...meta});}catch{}
 }
 function metric(event,data={}){
  try{onMetric({event,...data});}catch{}
 }
 function patch(clientId,patchValue,type='patch'){
  const rows=read(),i=rows.findIndex(row=>clientIdOf(row)===text(clientId));
  if(i<0)return null;
  rows[i]={...rows[i],...patchValue,client_id:rows[i].client_id};
  write(rows);notify(type,rows[i]);
  return rows[i];
 }
 function remove(clientId,{reason='remove',notifyChange=true}={}){
  const rows=read(),next=rows.filter(row=>clientIdOf(row)!==text(clientId));
  if(next.length===rows.length)return false;
  write(next);
  if(notifyChange)notify(reason,null,{clientId:text(clientId)});
  plan();
  return true;
 }
 function backoff(retryCount){
  const exponent=Math.max(0,Math.min(12,number(retryCount,1)-1));
  return Math.min(config.maxDelayMs,Math.max(config.baseDelayMs,config.baseDelayMs*(2**exponent)));
 }
 function recover(){
  const rows=read();let changed=false;
  for(let i=0;i<rows.length;i++){
   if(rows[i]._localState===STATES.SENDING){
    rows[i]={...rows[i],_localState:STATES.PENDING,nextAttemptAt:null,retryable:true,failureCode:null};changed=true;
   }
  }
  if(changed)write(rows);
  plan();
  return rows;
 }
 function queue(item){
  const clientId=clientIdOf(item);
  if(!clientId)throw new Error('client_id requerido.');
  const rows=read(),existing=rows.find(row=>clientIdOf(row)===clientId);
  if(existing)return existing;
  const row={
   ...item,client_id:clientId,_localState:STATES.PENDING,retryCount:Math.max(0,number(item?.retryCount,0)),
   nextAttemptAt:null,retryable:true,failureCode:null,local_order:number(item?.local_order,now())
  };
  rows.push(row);write(rows);notify('queued',row);metric('queued',{clientId});
  return row;
 }
 function reconcile(message,{source='realtime'}={}){
  const clientId=clientIdOf(message);
  if(!clientId)return false;
  const rows=read(),exists=rows.some(row=>clientIdOf(row)===clientId);
  if(!exists)return false;
  write(rows.filter(row=>clientIdOf(row)!==clientId));
  notify('reconciled',null,{clientId,source});
  metric('deduplicated',{clientId,source});
  plan();
  return true;
 }
 function due(row,{retryFailed=false}={}){
  if(row._localState===STATES.PENDING)return true;
  if(row._localState!==STATES.FAILED)return false;
  if(retryFailed)return true;
  if(row.retryable===false||number(row.retryCount,0)>=config.maxRetries)return false;
  return row.nextAttemptAt==null||number(row.nextAttemptAt,0)<=now();
 }
 function plan(){
  if(retryTimer!=null){cancelTimer(retryTimer);retryTimer=null;}
  if(stopped||!online())return;
  const waits=read().filter(row=>row._localState===STATES.FAILED&&row.retryable!==false&&number(row.retryCount,0)<config.maxRetries&&row.nextAttemptAt!=null)
   .map(row=>Math.max(0,number(row.nextAttemptAt,0)-now()));
  if(!waits.length)return;
  retryTimer=scheduleTimer(()=>{retryTimer=null;flush().catch(()=>{});},Math.min(...waits));
 }
 async function process(row){
  const clientId=clientIdOf(row),started=now();
  if(!clientId)return;
  const latest=read().find(x=>clientIdOf(x)===clientId);
  if(!latest)return;
  patch(clientId,{_localState:STATES.SENDING,nextAttemptAt:null},latest.retryCount>0?'retrying':'sending');
  metric(latest.retryCount>0?'retry':'sending',{clientId,retryCount:latest.retryCount});
  try{
   const result=await send({...latest,_localState:STATES.SENDING});
   const confirmed=result?.message||null;
   // Reconcile the authoritative row while the optimistic row still exists.
   // Message Engine/outbox merge collapses both by client_id, so there is never
   // a frame where the user's message disappears between local and server state.
   if(confirmed){
    try{onConfirm(confirmed,{clientId,idempotent:result?.idempotent===true,source:'api',wasPending:true});}catch{}
   }
   const wasPending=remove(clientId,{reason:'sent',notifyChange:false});
   notify('sent',confirmed,{clientId,idempotent:result?.idempotent===true,wasPending});
   metric('sent',{clientId,retryCount:latest.retryCount,durationMs:Math.max(0,now()-started),idempotent:result?.idempotent===true});
  }catch(error){
   const currentOnline=!!online(),classification=classifyError(error,{online:currentOnline});
   const retryCount=Math.min(100,number(latest.retryCount,0)+1);
   if(!currentOnline||classification.kind==='offline'){
    patch(clientId,{_localState:STATES.PENDING,retryCount,nextAttemptAt:null,retryable:true,failureCode:classification.code},'offline-pending');
   }else{
    const retryable=classification.retryable&&retryCount<config.maxRetries;
    patch(clientId,{
     _localState:STATES.FAILED,retryCount,retryable,
     nextAttemptAt:retryable?now()+backoff(retryCount):null,
     failureCode:classification.code
    },'failed');
   }
   metric('failed',{clientId,retryCount,failureCode:classification.code,retryable:classification.retryable});
  }
 }
 async function flush({retryFailed=false}={}){
  if(stopped||!online()){plan();return;}
  if(flushPromise){
   await flushPromise;
   if(retryFailed)return flush({retryFailed:true});
   return;
  }
  const run=(async()=>{
   const snapshot=read();
   for(const candidate of snapshot){
    if(stopped||!online())break;
    const current=read().find(row=>clientIdOf(row)===clientIdOf(candidate));
    if(!current||!due(current,{retryFailed}))continue;
    await process(current);
   }
  })();
  flushPromise=run;
  try{await run;}finally{if(flushPromise===run)flushPromise=null;plan();}
 }
 async function retry(clientId){
  const row=patch(clientId,{_localState:STATES.PENDING,retryable:true,nextAttemptAt:null,failureCode:null},'manual-retry');
  if(!row)return false;
  metric('retry',{clientId:text(clientId),retryCount:row.retryCount,manual:true});
  await flush({retryFailed:true});
  return true;
 }
 function kick(){plan();return flush();}
 function snapshot(){
  const rows=read();
  return {
   pending:rows.filter(x=>x._localState===STATES.PENDING).length,
   sending:rows.filter(x=>x._localState===STATES.SENDING).length,
   failed:rows.filter(x=>x._localState===STATES.FAILED).length,
   total:rows.length,online:!!online(),flushing:!!flushPromise
  };
 }
 function stop(){stopped=true;if(retryTimer!=null){cancelTimer(retryTimer);retryTimer=null;}}

 recover();
 return {states:STATES,queue,patch,remove,reconcile,recover,flush,retry,kick,snapshot,stop,backoff,classifyError:(error)=>classifyError(error,{online:!!online()}),rows:read};
}

window.GalaxyDeliveryEngine={create,classifyError,STATES};
})();