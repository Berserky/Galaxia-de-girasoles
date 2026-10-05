(()=>{
'use strict';

const DEFAULTS={
 bottomTolerance:110,
 memoryKey:'galaxy.chat.scroll.position.v1',
 memoryTtlMs:10*60*1000,
 resizeQuietMs:120
};

function create(options={}){
 const config={...DEFAULTS,...options};
 let programmaticDepth=0,programmaticRaf=0,resizeRaf=0,viewportRaf=0,lastUserScrollAt=0;
 let liveAnchor=null,liveBottom=true,bound=null,viewportToken=null;

 const now=()=>Date.now();
 const reduceMotion=()=>{try{return !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;}catch{return false;}};
 const rows=el=>el?[...el.querySelectorAll('.chat-message')]:[];
 const rowId=row=>String(row?.dataset?.chatId||row?.dataset?.id||'');
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

 function emit(reason,from,to){
  try{window.GalaxyChatPerf?.programmaticScroll?.(reason,Math.round(to-from));}catch{}
 }

 function write(el,value,reason='restore'){
  if(!el||!Number.isFinite(Number(value)))return false;
  const max=Math.max(0,el.scrollHeight-el.clientHeight),from=Number(el.scrollTop||0),to=clamp(Number(value),0,max);
  if(Math.abs(to-from)<.5)return false;
  programmaticDepth++;
  el.scrollTop=to;
  emit(reason,from,to);
  cancelAnimationFrame(programmaticRaf);
  programmaticRaf=requestAnimationFrame(()=>{programmaticDepth=Math.max(0,programmaticDepth-1);sync(el);});
  return true;
 }

 function isAtBottom(el,tolerance=config.bottomTolerance){
  if(!el)return true;
  return el.scrollHeight-el.scrollTop-el.clientHeight<=Math.max(0,Number(tolerance)||0);
 }

 function captureAnchor(el){
  if(!el)return null;
  const box=el.getBoundingClientRect();
  const visible=rows(el).filter(row=>{const rect=row.getBoundingClientRect();return rect.bottom>box.top+2&&rect.top<box.bottom-2;}).slice(0,3);
  if(!visible.length)return null;
  const anchors=visible.map(row=>({messageId:rowId(row),viewportOffset:row.getBoundingClientRect().top-box.top})).filter(x=>x.messageId);
  if(!anchors.length)return null;
  return {...anchors[0],fallbacks:anchors.slice(1)};
 }

 function captureState(el,context='chat'){
  return {anchor:captureAnchor(el),atBottom:isAtBottom(el),context:String(context||'chat'),capturedAt:now()};
 }

 function restoreAnchor(el,anchor,reason='anchor'){
  if(!el||!anchor?.messageId)return false;
  const candidates=[anchor,...(Array.isArray(anchor.fallbacks)?anchor.fallbacks:[])];
  let selected=null,row=null;
  for(const candidate of candidates){
   row=rows(el).find(node=>rowId(node)===String(candidate?.messageId||''));
   if(row){selected=candidate;break;}
  }
  if(!row||!selected)return false;
  const box=el.getBoundingClientRect();
  const delta=row.getBoundingClientRect().top-box.top-Number(selected.viewportOffset||0);
  if(!Number.isFinite(delta)||Math.abs(delta)<.5)return true;
  write(el,el.scrollTop+delta,reason);
  return true;
 }

 function toBottom(el,{smooth=false,reason='bottom'}={}){
  if(!el)return false;
  const target=Math.max(0,el.scrollHeight-el.clientHeight);
  if(smooth&&!reduceMotion()&&typeof el.scrollTo==='function'){
   const from=Number(el.scrollTop||0);programmaticDepth++;
   el.scrollTo({top:target,behavior:'smooth'});emit(reason,from,target);
   clearTimeout(toBottom.timer);toBottom.timer=setTimeout(()=>{programmaticDepth=Math.max(0,programmaticDepth-1);sync(el);},260);
   return true;
  }
  return write(el,target,reason);
 }

 function toMessage(el,messageId,{block='center',smooth=false,reason='message'}={}){
  if(!el||!messageId)return false;
  const row=rows(el).find(node=>rowId(node)===String(messageId));
  if(!row)return false;
  const box=el.getBoundingClientRect(),rect=row.getBoundingClientRect();
  let delta=rect.top-box.top;
  if(block==='center')delta-=Math.max(0,(el.clientHeight-rect.height)/2);
  else if(block==='end')delta-=Math.max(0,el.clientHeight-rect.height);
  const target=el.scrollTop+delta;
  if(smooth&&!reduceMotion()&&typeof el.scrollTo==='function'){
   const max=Math.max(0,el.scrollHeight-el.clientHeight),to=clamp(target,0,max),from=Number(el.scrollTop||0);
   programmaticDepth++;el.scrollTo({top:to,behavior:'smooth'});emit(reason,from,to);
   clearTimeout(toMessage.timer);toMessage.timer=setTimeout(()=>{programmaticDepth=Math.max(0,programmaticDepth-1);sync(el);},260);
   return true;
  }
  return write(el,target,reason);
 }

 function restoreState(el,state,{reason='restore',fallbackBottom=false}={}){
  if(!el||!state)return false;
  if(state.atBottom&&fallbackBottom)return toBottom(el,{reason});
  return restoreAnchor(el,state.anchor,reason)||(state.atBottom?toBottom(el,{reason}):false);
 }

 function sync(el=bound){
  if(!el)return;
  liveBottom=isAtBottom(el);
  liveAnchor=captureAnchor(el);
 }

 function onScroll(el){
  if(!el)return;
  if(programmaticDepth===0)lastUserScrollAt=now();
  sync(el);
 }

 function stabilize(el=bound,reason='resize'){
  if(!el)return;
  cancelAnimationFrame(resizeRaf);
  const anchor=liveAnchor,bottom=liveBottom;
  resizeRaf=requestAnimationFrame(()=>{
   if(!el.isConnected)return;
   if(programmaticDepth===0&&now()-lastUserScrollAt<config.resizeQuietMs){sync(el);return;}
   if(bottom)toBottom(el,{reason});
   else if(anchor)restoreAnchor(el,anchor,reason);
   sync(el);
  });
 }

 function bind(el){
  bound=el||null;
  if(bound)sync(bound);
  return bound;
 }

 function rememberState(state,context=state?.context||'chat'){
  if(!state)return null;
  const safe={anchor:state.anchor?{messageId:String(state.anchor.messageId||''),viewportOffset:Math.round(Number(state.anchor.viewportOffset||0)*100)/100,fallbacks:(state.anchor.fallbacks||[]).slice(0,2).map(x=>({messageId:String(x.messageId||''),viewportOffset:Math.round(Number(x.viewportOffset||0)*100)/100})).filter(x=>x.messageId)}:null,atBottom:!!state.atBottom,context:String(context||'chat'),savedAt:now()};
  if(safe.anchor&&!safe.anchor.messageId)safe.anchor=null;
  try{sessionStorage.setItem(config.memoryKey,JSON.stringify(safe));}catch{}
  return safe;
 }

 function remember(el=bound,context='chat'){
  if(!el)return null;
  return rememberState(captureState(el,context),context);
 }

 function recalled(context='chat'){
  try{
   const raw=sessionStorage.getItem(config.memoryKey);if(!raw)return null;
   const state=JSON.parse(raw);
   if(!state||now()-Number(state.savedAt||0)>config.memoryTtlMs){sessionStorage.removeItem(config.memoryKey);return null;}
   if(context&&state.context&&String(state.context)!==String(context))return null;
   return state;
  }catch{return null;}
 }

 function restoreMemory(el=bound,context='chat'){
  const state=recalled(context);if(!state||!el)return false;
  return restoreState(el,state,{reason:'navigation-restore',fallbackBottom:true});
 }

 function clearMemory(){try{sessionStorage.removeItem(config.memoryKey);}catch{}}

 function beforeViewportChange(el=bound){
  if(!viewportToken)viewportToken=el?captureState(el,'viewport'):null;
  return viewportToken;
 }

 function afterViewportChange(el=bound){
  if(!el||!viewportToken)return false;
  cancelAnimationFrame(viewportRaf);
  viewportRaf=requestAnimationFrame(()=>{
   viewportRaf=0;const token=viewportToken;viewportToken=null;
   if(el.isConnected&&token)restoreState(el,token,{reason:'viewport-resize',fallbackBottom:true});
  });
  return true;
 }

 function isProgrammatic(){return programmaticDepth>0;}

 return {
  config:Object.freeze({...config}),bind,isAtBottom,captureAnchor,captureState,restoreAnchor,restoreState,
  toBottom,toMessage,onScroll,stabilize,sync,remember,rememberState,recalled,restoreMemory,clearMemory,
  beforeViewportChange,afterViewportChange,isProgrammatic
 };
}

window.GalaxyScrollEngine={create};
})();