(()=>{
'use strict';
function create(options={}){
 const now=options.now||(()=>performance.now());
 let nativeReduced=false;
 const reduced=options.reduced||(()=>nativeReduced||!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
 const slow=options.slow||(()=>navigator.deviceMemory>0&&navigator.deviceMemory<=2);
 const pending=new Map(),active=new Set(),elementAnimations=new WeakMap(),tokens=new Map();
 let burstAt=-Infinity,burstCount=0,slowUntil=0,frameRaf=0,previousFrame=0,badFrames=0;
 const constrained=()=>slow()||now()<slowUntil;
 const permitted=()=>{const limited=constrained();const root=document.documentElement;if(root&&root.getAttribute('data-chat-motion-slow')!==String(limited)){root.setAttribute('data-chat-motion-slow',String(limited));tokens.clear();}return document.visibilityState==='visible'&&!limited;};
 function token(name,fallback){
  if(tokens.has(name))return tokens.get(name);
  try{const value=getComputedStyle(document.documentElement).getPropertyValue('--chat-motion-'+name).trim()||fallback;tokens.set(name,value);return value;}catch{return fallback;}
 }
 function duration(name='normal'){
  const raw=token('duration-'+name,{fast:'100ms',normal:'160ms',slow:'220ms'}[name]||'160ms');
  return Math.min(300,Math.max(0,parseFloat(raw)*(raw.endsWith('ms')?1:1000)));
 }
 function offer(ids,{atBottom=false}={}){
  const stamp=now();
  for(const [id,expires] of pending)if(expires<stamp)pending.delete(id);
  if(stamp-burstAt>160){burstAt=stamp;burstCount=0;}
  burstCount+=ids.length;
  window.GalaxyChatPerf?.note?.('motion-offer',{count:ids.length,allowed:atBottom&&permitted()&&burstCount<=3});
  if(!atBottom||!permitted()||burstCount>3){pending.clear();if(burstCount>3)cancel();return;}
  for(const id of ids)pending.set(String(id),stamp+500);
 }
 function consume(id,visible){
  const key=String(id),expires=pending.get(key);pending.delete(key);
  return !!(visible&&expires>=now()&&permitted());
 }
 function animate(el,kind='enter'){
  if(!el?.animate||!permitted())return null;
  elementAnimations.get(el)?.cancel();
  const value=token;
  const fade=reduced(),distance=value('distance','6px'),scale=value('scale-feedback','0.97'),opacity=Number(value('opacity','.75'));
  const frames=kind==='fade'?[{opacity},{opacity:1}]:kind==='feedback'?(fade?[{opacity},{opacity:1}]:[{transform:'scale('+scale+')'},{transform:'scale(1)'}]):
   kind==='exit'?(fade?[{opacity:1},{opacity:0}]:[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY('+distance+')'}]):
   (fade?[{opacity},{opacity:1}]:[{opacity,transform:'translateY('+distance+')'},{opacity:1,transform:'translateY(0)'}]);
  const started=now();
  const animation=el.animate(frames,{duration:duration(kind==='feedback'||kind==='fade'?'fast':kind==='sheet'?'slow':'normal'),easing:token('easing-'+(kind==='exit'?'exit':'enter'),'cubic-bezier(.2,.8,.2,1)')});
  elementAnimations.set(el,animation);
  active.add(animation);animation.finished.then(()=>{active.delete(animation);window.GalaxyChatPerf?.note?.('motion-duration',{ms:now()-started});},()=>active.delete(animation));
  if(!frameRaf&&typeof requestAnimationFrame==='function'){
   previousFrame=0;badFrames=0;
   const tick=t=>{frameRaf=0;if(previousFrame)frame(t-previousFrame);previousFrame=t;if(active.size)frameRaf=requestAnimationFrame(tick);};
   frameRaf=requestAnimationFrame(tick);
  }
  return animation;
 }
 function entries(container){
  if(!container||!pending.size)return;
  const box=container.getBoundingClientRect();
  window.GalaxyChatPerf?.note?.('motion-window',{pending:pending.size,height:box.bottom-box.top});
  let count=0;
  for(const row of container.querySelectorAll('.chat-message')){
   const id=row.dataset.clientId||row.dataset.chatId;
   if(!pending.has(String(id)))continue;
   const rect=row.getBoundingClientRect();
   if(consume(id,rect.bottom>box.top&&rect.top<box.bottom)){animate(row.querySelector('.chat-bubble'),'enter');count++;}
  }
  // Unmounted/offscreen events expire now, never on a subsequent virtualization mount.
  pending.clear();
  if(count)window.GalaxyChatPerf?.note?.('motion-entry',{count});
 }
 function depart(el){
  if(!el||!permitted()||reduced())return;
  const rect=el.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const ghost=el.cloneNode(true);ghost.removeAttribute('id');ghost.setAttribute('aria-hidden','true');ghost.inert=true;
  for(const child of ghost.querySelectorAll('[id],[data-action]')){child.removeAttribute('id');child.removeAttribute('data-action');}
  ghost.classList.add('chat-motion-ghost');
  Object.assign(ghost.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',pointerEvents:'none',zIndex:'1300'});
  document.body.appendChild(ghost);
  const animation=animate(ghost,'exit');
  if(animation)animation.finished.then(()=>ghost.remove(),()=>ghost.remove());else ghost.remove();
 }
 function cancel(){for(const animation of active)animation.cancel();active.clear();if(frameRaf)cancelAnimationFrame(frameRaf);frameRaf=0;}
 function suspend(){pending.clear();tokens.clear();cancel();}
 function frame(ms){if(ms>33)badFrames++;else badFrames=Math.max(0,badFrames-1);if(badFrames>=3){slowUntil=now()+5000;permitted();suspend();}}
 function setNativeReduced(value){tokens.clear();nativeReduced=!!value;document.documentElement?.setAttribute('data-chat-motion-reduced',String(nativeReduced));if(nativeReduced)suspend();}
 return {offer,consume,animate,entries,depart,duration,suspend,frame,reduced,constrained,setNativeReduced};
}
const runtime=create();
window.GalaxyChatMotion=Object.freeze({create,...runtime});
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState!=='visible')runtime.suspend();});
window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change',()=>runtime.suspend());
})();
