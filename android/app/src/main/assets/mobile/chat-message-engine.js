(()=>{
'use strict';

const DEFAULTS={pageSize:60,maxCache:420,windowSize:84,windowStep:28,estimatedHeight:92};

function finiteSeq(message){
 const n=Number(message?.server_seq||0);
 return Number.isFinite(n)&&n>0?n:0;
}
function messageKey(message){
 const id=String(message?.id||'');
 if(id)return 'id:'+id;
 const client=String(message?.client_id||'');
 if(client)return 'client:'+client;
 return 'anon:'+String(message?.client_created_at||message?.created_at||'')+':'+String(message?.local_order||0);
}
function compareMessages(a,b){
 const sa=finiteSeq(a),sb=finiteSeq(b);
 if(sa&&sb&&sa!==sb)return sa-sb;
 if(sa&&!sb)return -1;
 if(!sa&&sb)return 1;
 const la=Number(a?.local_order||0),lb=Number(b?.local_order||0);
 if(la!==lb)return la-lb;
 const ta=String(a?.client_created_at||a?.created_at||''),tb=String(b?.client_created_at||b?.created_at||'');
 if(ta!==tb)return ta.localeCompare(tb);
 return messageKey(a).localeCompare(messageKey(b));
}
function mergeMessages(base=[],incoming=[]){
 const byId=new Map(),byClient=new Map();
 for(const row of [...base,...incoming]){
  if(!row)continue;
  const id=String(row.id||''),client=String(row.client_id||'');
  let previous=null;
  if(id&&byId.has(id))previous=byId.get(id);
  else if(client&&byClient.has(client))previous=byClient.get(client);
  const next=previous?{...previous,...row}:row;
  if(previous){
   const oldId=String(previous.id||''),oldClient=String(previous.client_id||'');
   if(oldId)byId.delete(oldId);
   if(oldClient)byClient.delete(oldClient);
  }
  if(id)byId.set(id,next);
  if(client)byClient.set(client,next);
  if(!id&&!client)byId.set(messageKey(next),next);
 }
 const unique=new Map();
 for(const row of [...byId.values(),...byClient.values()])unique.set(messageKey(row),row);
 return [...unique.values()].sort(compareMessages);
}
function minSeq(messages=[]){
 const values=messages.map(finiteSeq).filter(Boolean);
 return values.length?Math.min(...values):0;
}
function maxSeq(messages=[]){
 const values=messages.map(finiteSeq).filter(Boolean);
 return values.length?Math.max(...values):0;
}

function create(options={}){
 const config={...DEFAULTS,...options};
 const heights=new Map();
 let average=Math.max(48,Number(config.estimatedHeight)||92);
 let start=0,end=0,lastTotal=0;

 function clampWindow(total){
  const size=Math.max(12,Number(config.windowSize)||84);
  if(total<=size){start=0;end=total;lastTotal=total;return;}
  start=Math.max(0,Math.min(start,total-size));
  end=Math.min(total,Math.max(start+size,end||start+size));
  if(end-start<size){start=Math.max(0,end-size);}
  lastTotal=total;
 }
 function resetWindow(total,{align='end',focusIndex=-1}={}){
  const size=Math.max(12,Number(config.windowSize)||84);
  if(total<=size){start=0;end=total;lastTotal=total;return {start,end};}
  if(Number.isInteger(focusIndex)&&focusIndex>=0){
   start=Math.max(0,Math.min(total-size,focusIndex-Math.floor(size/2)));
  }else start=align==='start'?0:Math.max(0,total-size);
  end=Math.min(total,start+size);lastTotal=total;
  return {start,end};
 }
 function ensureWindow(total){
  if(total!==lastTotal){
   if(lastTotal===0||end===0)resetWindow(total,{align:'end'});
   else{
    const delta=total-lastTotal;
    if(delta>0&&end>=lastTotal-2){start+=delta;end+=delta;}
    clampWindow(total);
   }
  }else clampWindow(total);
  return {start,end};
 }
 function focus(total,index){
  if(index<0)return ensureWindow(total);
  return resetWindow(total,{focusIndex:index});
 }
 function shift(total,direction){
  ensureWindow(total);
  const step=Math.max(8,Number(config.windowStep)||28);
  if(direction<0&&start>0){
   start=Math.max(0,start-step);end=Math.min(total,start+Math.max(12,Number(config.windowSize)||84));
  }else if(direction>0&&end<total){
   end=Math.min(total,end+step);start=Math.max(0,end-Math.max(12,Number(config.windowSize)||84));
  }
  lastTotal=total;
  return {start,end};
 }
 function measure(key,height){
  const h=Number(height);
  if(!key||!Number.isFinite(h)||h<12||h>6000)return false;
  heights.set(String(key),h);
  if(heights.size>Number(config.maxCache||420)*2){
   const keep=new Set([...heights.keys()].slice(-Number(config.maxCache||420)));
   for(const k of heights.keys())if(!keep.has(k))heights.delete(k);
  }
  average=Math.max(36,Math.min(420,average*.88+h*.12));
  return true;
 }
 function estimate(messages,from,to){
  let px=0;
  for(let i=Math.max(0,from);i<Math.min(messages.length,to);i++){
   px+=heights.get(messageKey(messages[i]))||average;
  }
  return Math.max(0,Math.round(px));
 }
 function range(messages=[]){
  ensureWindow(messages.length);
  return {
   start,end,
   messages:messages.slice(start,end),
   topPx:estimate(messages,0,start),
   bottomPx:estimate(messages,end,messages.length),
   averageHeight:Number(average.toFixed(2))
  };
 }
 function applyPage(current,result,{direction='latest',focusId=''}={}){
  const existing=current?.messages||[],incoming=result?.messages||[];
  let messages;
  if(direction==='latest'||direction==='around')messages=[...incoming].sort(compareMessages);
  else messages=mergeMessages(existing,incoming);
  const hasBefore=Object.prototype.hasOwnProperty.call(result||{},'nextBeforeSeq');
  const hasAfter=Object.prototype.hasOwnProperty.call(result||{},'nextAfterSeq');
  let nextBeforeSeq=current?.nextBeforeSeq??null,nextAfterSeq=current?.nextAfterSeq??null;
  if(direction==='latest'||direction==='around'){
   nextBeforeSeq=hasBefore?result.nextBeforeSeq:null;
   nextAfterSeq=hasAfter?result.nextAfterSeq:null;
  }else if(direction==='older'){
   if(hasBefore)nextBeforeSeq=result.nextBeforeSeq;
  }else if(direction==='newer'){
   if(hasAfter)nextAfterSeq=result.nextAfterSeq;
  }else{
   if(nextBeforeSeq==null&&hasBefore)nextBeforeSeq=result.nextBeforeSeq;
   if(nextAfterSeq==null&&hasAfter)nextAfterSeq=result.nextAfterSeq;
  }
  const maxCache=Math.max(Number(config.pageSize||60)*3,Number(config.maxCache||420));
  if(messages.length>maxCache){
   if(direction==='older'){
    messages=messages.slice(0,maxCache);
    nextAfterSeq=maxSeq(messages)||nextAfterSeq;
   }else if(direction==='around'&&focusId){
    const index=Math.max(0,messages.findIndex(m=>String(m.id)===String(focusId)));
    const half=Math.floor(maxCache/2),from=Math.max(0,Math.min(messages.length-maxCache,index-half));
    messages=messages.slice(from,from+maxCache);
    nextBeforeSeq=minSeq(messages)||nextBeforeSeq;
    nextAfterSeq=maxSeq(messages)||nextAfterSeq;
   }else{
    messages=messages.slice(-maxCache);
    nextBeforeSeq=minSeq(messages)||nextBeforeSeq;
   }
  }
  return {
   ...(current||{}),...(result||{}),messages,
   nextBeforeSeq:nextBeforeSeq||null,nextAfterSeq:nextAfterSeq||null
  };
 }
 function applySingle(current,message){
  if(!message)return current;
  let messages=mergeMessages(current?.messages||[],[message]);
  const maxCache=Math.max(Number(config.pageSize||60)*3,Number(config.maxCache||420));
  if(messages.length>maxCache){
   const index=messages.findIndex(row=>messageKey(row)===messageKey(message)||String(row.client_id||'')===String(message.client_id||''));
   messages=index>=0&&index<Math.floor(messages.length/2)?messages.slice(0,maxCache):messages.slice(-maxCache);
  }
  return {...(current||{}),messages};
 }
 function report(messages=[]){
  const r=range(messages);
  return {loaded:messages.length,rendered:r.messages.length,start:r.start,end:r.end,topPx:r.topPx,bottomPx:r.bottomPx,averageHeight:r.averageHeight,heightSamples:heights.size};
 }

 return {
  config:Object.freeze({...config}),messageKey,compareMessages,mergeMessages,minSeq,maxSeq,
  resetWindow,ensureWindow,focus,shift,measure,range,applyPage,applySingle,report
 };
}

window.GalaxyMessageEngine={create,compareMessages,mergeMessages,messageKey,minSeq,maxSeq};
})();