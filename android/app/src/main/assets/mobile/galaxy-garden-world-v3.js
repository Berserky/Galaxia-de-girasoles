/* V3: CSS garden. An authenticated backend bloomTotal extends official stage 8;
   previewBloomTotal remains strictly demo-only and never grants progress. */
(function(global){
'use strict';
const THEMES=['daylight','cosmic','christmas','halloween','valentine','friendship','easter'];
const SEASONS=['winter','spring','summer','autumn'];
const DAYPARTS=['morning','day','sunset','night'];
const CHAPTERS=Object.freeze([
 {id:'garden',start:0,end:8,capacity:8,name:'Jardín íntimo',scale:'Cerca'},
 {id:'meadow',start:8,end:22,capacity:14,name:'Pradera compartida',scale:'Pradera'},
 {id:'valley',start:22,end:42,capacity:20,name:'Valle vivo',scale:'Valle'},
 {id:'region',start:42,end:74,capacity:32,name:'Región de girasoles',scale:'Región'},
 {id:'planet',start:74,end:122,capacity:48,name:'Nuestro planeta',scale:'Planeta'},
 {id:'constellation',start:122,end:186,capacity:64,name:'Más allá del planeta',scale:'Órbita'}
]);
const MAX_DEMO=186;
const LABELS={winter:'invierno',spring:'primavera',summer:'verano',autumn:'otoño',morning:'mañana',day:'día',sunset:'atardecer',night:'noche'};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function wholeNumber(value){if(value==null||typeof value==='boolean'||String(value).trim()==='')return null;const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;}
function stageOf(garden){return Math.min(8,wholeNumber(garden?.stage)??0)};
function ambient(date=new Date()){
 const d=Object.prototype.toString.call(date)==='[object Date]'&&Number.isFinite(date.getTime())?date:new Date();
 const h=d.getHours(),m=d.getMonth();
 return {daypart:h>=5&&h<11?'morning':h>=11&&h<17?'day':h>=17&&h<20?'sunset':'night',season:m===11||m<=1?'winter':m<=4?'spring':m<=7?'summer':'autumn'};
}
function chapterFor(total){return CHAPTERS.find((c,i)=>total<=(i===0?c.end:c.end) )||CHAPTERS[CHAPTERS.length-1]}
function normalize(garden={},options={}){
 const officialStage=stageOf(garden),simulated=options.demo===true;
 const verified=typeof garden?.bloomTotal==='number'&&Number.isSafeInteger(garden.bloomTotal) ? garden.bloomTotal : null;
 const authorized=officialStage===8&&verified!==null&&verified>=8&&verified<=MAX_DEMO?verified:officialStage;
 const total=simulated?Math.min(MAX_DEMO,wholeNumber(options.previewBloomTotal)??officialStage):authorized;
 const chapter=chapterFor(total),first=chapter.id==='garden'?0:chapter.start;
 const base=ambient(options.date);
 return {officialStage,total,simulated,chapter:chapter.id,chapterName:chapter.name,scale:chapter.scale,
  capacity:chapter.capacity,sectorProgress:total-first,chapterStart:first,season:SEASONS.includes(options.season)?options.season:base.season,
  daypart:DAYPARTS.includes(options.daypart)?options.daypart:base.daypart,
  theme:THEMES.includes(options.theme)?options.theme:'daylight',motion:options.motion==='reduce'?'reduce':'full'};
}
 const FLOWERS=[
  {x:49,height:192,scale:1.12,rotate:-4,hue:0},
  {x:21,height:157,scale:.89,rotate:-8,hue:-6},
  {x:77,height:174,scale:1.01,rotate:7,hue:5},
  {x:7,height:129,scale:.73,rotate:-12,hue:8},
  {x:93,height:140,scale:.81,rotate:8,hue:-4},
  {x:36,height:132,scale:.72,rotate:-6,hue:10},
  {x:65,height:139,scale:.77,rotate:8,hue:2},
  {x:14,height:135,scale:.70,rotate:6,hue:-10},
  {x:87,height:148,scale:.75,rotate:-6,hue:12},
  {x:45,height:162,scale:.79,rotate:3,hue:-14},
  {x:59,height:145,scale:.70,rotate:-4,hue:16},
  {x:29,height:141,scale:.77,rotate:6,hue:9},
 ];

// The first 8 retain stable identities and original relative positions in every larger terrain.
const gardenPlants=[
 {x:50,y:4,size:1.12,h:192,lean:-4}, {x:20,y:4,size:.89,h:157,lean:-8},
 {x:79,y:4,size:1.01,h:174,lean:7}, {x:8,y:3,size:.73,h:129,lean:-12},
 {x:92,y:3,size:.81,h:140,lean:8}, {x:36,y:4,size:.72,h:132,lean:-6},
 {x:65,y:4,size:.77,h:139,lean:8}, {x:14,y:4,size:.70,h:75,lean:6}
];
function seeded(i,salt=0){let v=(Math.imul(i+1,1664525)+Math.imul(salt+1,1013904223))>>>0;v^=v>>>16;v=Math.imul(v,2246822519)>>>0;return (v>>>0)/4294967296}
function locationAt(i,chapter){
 const factor=({garden:1,meadow:1.7,valley:2.4,region:3.3,planet:4.1,constellation:4.1})[chapter]||1;
 if(i<8){const p=gardenPlants[i];return {x:50+(p.x-50)/factor,y:p.y+3,size:p.size,h:p.h,lean:p.lean}}
 // Additional blooms grow in concentric sectors; no random shifting on rerender.
 const ring=i<22?1:i<42?2:3,angle=(i*2.399963229728653)+(ring*.28),spread=ring===1?21:ring===2?31:42;
 let x=50+Math.cos(angle)*spread*(.82+seeded(i,7)*.25),y=8+Math.abs(Math.sin(angle))*19+seeded(i,5)*8;
 if(i>=22)y=9+Math.abs(Math.sin(angle))*28;
 return {x:Math.min(94,Math.max(6,x)),y,size:.42+seeded(i,4)*.35,h:108+Math.floor(seeded(i,9)*55),lean:-9+seeded(i,3)*18};
}
function plantMarkup(i,s,small=false){
 const p=locationAt(i,s.chapter),sprout=s.total===1&&i===0;
 const interactive=s.chapter==='garden'||(s.chapter==='meadow'&&i<8);
 if(small)return `<span class="ng-mini-bloom" data-bloom-id="${i+1}" style="--x:${p.x.toFixed(2)}%;--y:${p.y.toFixed(2)}%;--s:${(.8+seeded(i,8)*1.3).toFixed(2)};--delay:${(i%9)*-.42}s" aria-hidden="true"></span>`;
 const petals=Array.from({length:24},(_,k)=>`<i class="ng-petal" style="--i:${k}"></i>`).join('');
 return `<${interactive?'button':'span'} class="ng-plant ${sprout?'ng-plant--sprout':''}" ${i<8?`data-origin-flower="${i+1}"`:''} ${interactive?`type="button" data-flower="${i+1}" aria-label="${sprout?'Brote':'Girasol'} ${i+1} de nuestro jardín"`:'aria-hidden="true"'} style="--x:${p.x.toFixed(2)}%;--y:${p.y.toFixed(2)}%;--ph:${sprout?80:p.h}px;--size:${(sprout?.60:p.size).toFixed(3)};--lean:${p.lean.toFixed(2)}deg;--hue:${(-10+seeded(i,1)*20).toFixed(1)}deg;--delay:${(i*-.55).toFixed(2)}s;--z:${6-i%3}">
  <span class="ng-plant-sway"><span class="ng-stem"></span><span class="ng-leaf ng-leaf--left"></span><span class="ng-leaf ng-leaf--right"></span><span class="ng-flower"><span class="ng-petals">${petals}</span><span class="ng-disc"><span class="ng-disc-heart"></span></span></span><span class="ng-bud"></span></span></${interactive?'button':'span'}>`;
}
function flowersMarkup(s){
 if(s.chapter==='planet'||s.chapter==='constellation')return '';
 const full=Math.min(s.total,22),extras=Math.max(0,s.total-full);
 return `<div class="ng-plant-world">${Array.from({length:full},(_,i)=>plantMarkup(i,s)).join('')}${Array.from({length:extras},(_,i)=>plantMarkup(i+full,s,true)).join('')}</div>`;
}
function skyDecoration(){
 const lights=Array.from({length:13},(_,i)=>`<i style="--x:${5+i*7.5}%;--d:${(i%5)*-.4}s;--c:${['#ffecad','#ffb6b7','#c0efe6','#e7d3ff'][i%4]}"></i>`).join('');
 const bats=Array.from({length:6},(_,i)=>`<i style="--x:${10+(i*29)%78}%;--y:${12+(i*11)%25}%;--s:${(.6+(i%3)*.15).toFixed(2)};--d:${(i%4)*-.7}s"></i>`).join('');
 const hearts=Array.from({length:12},(_,i)=>`<i style="--x:${7+(i*31)%86}%;--y:${8+(i*17)%32}%;--d:${(i%6)*-.8}s"></i>`).join('');
 const fireworks=Array.from({length:4},(_,k)=>`<span class="ng-firework" style="--x:${[21,78,49,88][k]}%;--y:${[23,18,12,36][k]}%;--delay:${k*1.1}s;--c:${['#ffe59e','#bfe8df','#f5aed9','#cdb7ff'][k]}">${Array.from({length:12},(_,i)=>`<i style="--ray:${i}"></i>`).join('')}</span>`).join('');
 const eggs=Array.from({length:7},(_,i)=>`<i class="ng-easter-egg" style="--x:${8+(i*19)%86}%;--y:${9+(i*13)%30}%;--d:${(i%4)*-.5}s"></i>`).join('');
 return `<div class="ng-decorations" aria-hidden="true">
  <div class="ng-decor-ng-xmas"><div class="ng-xmas-lights">${lights}</div><div class="ng-santa-flight"><span class="ng-deer" style="--x:5%;--s:.9"></span><span class="ng-deer" style="--x:26%;--s:.8"></span><span class="ng-santa-rope"></span><span class="ng-sleigh"></span><span class="ng-santa-head"></span></div></div>
  <div class="ng-decor-ng-halloween"><div class="ng-bats">${bats}</div></div>
  <div class="ng-decor-ng-valentine"><div class="ng-hearts">${hearts}</div></div>
  <div class="ng-decor-ng-friendship">${fireworks}</div>
  <div class="ng-decor-ng-cosmic"><span class="ng-cosmic-planet"></span></div>
  <div class="ng-decor-ng-easter">${eggs}</div>
 </div>`;
}
function globeMarkup(s){
 const count=Math.min(s.total,122);
 let bits='';for(let i=0;i<count;i++){
  // The original eight keep their own deterministic coordinates and identity
  // on the globe AND in orbit. Never replace them with anonymous random dots.
  const origin=i<8,plant=origin?gardenPlants[i]:null;
  const xx=origin?50+(plant.x-50)*.60:10+seeded(i,11)*80;
  const yy=origin?46+(plant.x-50)*.19+((i%3)-1)*7:9+seeded(i,12)*82;
  const dx=(xx-50)/50,dy=(yy-50)/50;
  if(!origin&&dx*dx+dy*dy>.93)continue;
  bits+=`<i class="ng-planet-flower" ${origin&&(s.chapter==='planet'||s.chapter==='constellation')?`data-origin-flower="${i+1}"`:''} style="--x:${xx.toFixed(2)}%;--y:${yy.toFixed(2)}%;--op:${origin?1:(.55+seeded(i,13)*.45).toFixed(2)}"></i>`;
 }
 return `<div class="ng-planet-wrap" aria-hidden="true"><div class="ng-planet">${bits}</div><span class="ng-planet-label">${s.chapter==='planet'?'Nuestro planeta':'El universo continúa'}</span></div>`;
}
function render(garden={},options={}){
 const s=normalize(garden,options);
 const entrance=options.entrance==='none'?'none':'grow';
 const stars=Array.from({length:21},(_,i)=>`<i style="--n:${i};--dx:${(i*37)%98}%;--dy:${(i*23+11)%80}%;--duration:${(3.5+(i%6)*.65).toFixed(2)}s"></i>`).join('');
 const grass=Array.from({length:33},(_,i)=>`<i style="--gx:${(i*73)%100}%;--gh:${11+(i*13)%29}px;--ga:${-24+(i*11)%52}deg;--go:${(i%5)*-.41}s"></i>`).join('');
 const wild=Array.from({length:16},(_,i)=>`<span class="ng-wildflower" style="--wx:${(i*47+13)%98}%;--wy:${4+(i*11)%25}px;--ws:${.52+(i%4)*.16};--wd:${(i%6)*-.65}s"><i></i></span>`).join('');
 const label=`Jardín compartido; ${s.simulated?'simulación de':'etapa oficial'} ${s.total}; ${s.chapterName}; ${LABELS[s.season]}, ${LABELS[s.daypart]}`;
 return `<div class="bond-garden-scene living-garden-scene ng-garden" data-stage="${s.total}" data-official-stage="${s.officialStage}" data-demo="${s.simulated}" data-chapter="${s.chapter}" data-daypart="${s.daypart}" data-season="${s.season}" data-celebration="${s.theme}" data-motion="${s.motion}" data-entrance="${entrance}" role="group" aria-label="${escapeHTML(label)}">
  <div class="ng-sky" aria-hidden="true"><span class="ng-aurora"></span><span class="ng-sun"></span><span class="ng-moon"></span><span class="ng-starfield">${stars}</span><span class="ng-cloud ng-cloud--a"></span><span class="ng-cloud ng-cloud--b"></span></div>
  ${skyDecoration()}
  <div class="ng-world" aria-hidden="true"><div class="ng-mountain ng-mountain--far"></div><div class="ng-mountain ng-mountain--near"></div><div class="ng-mist"></div><div class="ng-hill ng-hill--back"></div><div class="ng-hill ng-hill--front"></div></div>
  <div class="ng-terrain" aria-hidden="true"><span class="ng-contour ng-contour--back"></span><span class="ng-contour ng-contour--front"></span><span class="ng-garden-center"></span><span class="ng-river"></span><span class="ng-path"></span><span class="ng-map-lines"></span></div>
  <div class="ng-meadow" aria-hidden="true"><span class="ng-meadow-glow"></span><div class="ng-grass">${grass}</div><div class="ng-wildflowers">${wild}</div><div class="ng-seeds">${[18,34,51,68,83].map((x,i)=>`<span style="--sx:${x}%;--sd:${i*.3}s"></span>`).join('')}</div></div>
  <div class="ng-plant-field">${flowersMarkup(s)}</div>
  ${globeMarkup(s)}
  <div class="ng-weather" aria-hidden="true">${stars}</div>
  <div class="ng-glass-sign" aria-hidden="true"><span class="ng-sign-star">✧</span><span>${escapeHTML(s.chapterName)}</span></div>
  <div class="ng-ground-shadow" aria-hidden="true"></div>
 </div>`;
}
 function attach(root,options={}){
  if(!root||typeof root.addEventListener!=='function')return()=>{};
  const reduced=()=>root.dataset.motion==='reduce'||(global.matchMedia&&global.matchMedia('(prefers-reduced-motion: reduce)').matches);
  // Scene-local, low-frequency ambient refresh. Avoid running a permanent frame loop.
  let ambientTimer=null,observer=null,visible=true,disposed=false;
  const doc=global.document;
  function updateVisibility(){
   const hidden=(doc&&doc.hidden)||!visible;
   root.dataset.paused=hidden?'true':'false';
   if(hidden&&ambientTimer!==null){global.clearTimeout(ambientTimer);ambientTimer=null;}
   if(!hidden&&options.autoAmbient)refreshAmbient();
  }
  function refreshAmbient(){
   if(disposed||!options.autoAmbient||!root.isConnected)return;
   const state=ambient();root.dataset.daypart=state.daypart;if(options.autoSeason!==false)root.dataset.season=state.season;options.onAmbient?.(state);
   if(ambientTimer!==null)global.clearTimeout(ambientTimer);
   if((doc&&doc.hidden)||!visible)return;
   const now=new Date(),next=[];
   for(const hour of [5,11,17,20]){
    const boundary=new Date(now.getTime());boundary.setHours(hour,0,0,0);
    if(boundary>now)next.push(boundary.getTime()-now.getTime());
   }
   const midnight=new Date(now.getTime());midnight.setHours(24,0,0,0);
   next.push(midnight.getTime()-now.getTime());
   const delay=Math.max(1000,Math.min(86400000,...next)+1000);
   ambientTimer=global.setTimeout(refreshAmbient,delay);
  }
  function onVisibility(){updateVisibility();}
  // Always pause offscreen, even when a manual daypart is selected.
  // Automatic clock refresh is independent from the visibility observer.
  if(doc?.addEventListener){
   doc.addEventListener('visibilitychange',onVisibility);
   global.addEventListener?.('pageshow',onVisibility);
   if(typeof global.IntersectionObserver==='function'){
    observer=new global.IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting!==false;updateVisibility();},{threshold:.05});
    observer.observe(root);
   }
   updateVisibility();
  }
  function onClick(event){
    const b=event.target?.closest?.('[data-flower]');
    if(!b||!root.contains(b))return;
    if(!reduced()&&typeof b.animate==='function'){
      b.animate([{filter:'brightness(1)'},{filter:'brightness(1.18)'},{filter:'brightness(1)'}],{duration:460,easing:'ease-out'});
      const bloom=b.querySelector('.ng-flower');
      bloom?.animate?.([{transform:'translateY(0) scale(1)'},{transform:'translateY(-8px) scale(1.07)'},{transform:'translateY(0) scale(1)'}],{duration:700,easing:'cubic-bezier(.22,.8,.26,1)'});
    }
    if(options.onFlowerTap)options.onFlowerTap(Number(b.dataset.flower));
  }
  function onPointer(event){
    if(reduced()||event.pointerType==='touch')return;
    const r=root.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;
    root.style.setProperty('--parallax-x',Math.max(-1,Math.min(1,x)).toFixed(3));
    root.style.setProperty('--parallax-y',Math.max(-1,Math.min(1,y)).toFixed(3));
  }
  function onExit(){root.style.setProperty('--parallax-x','0');root.style.setProperty('--parallax-y','0');}
  root.addEventListener('click',onClick);
  root.addEventListener('pointermove',onPointer,{passive:true});
  root.addEventListener('pointerleave',onExit);
  return ()=>{disposed=true;if(ambientTimer!==null)global.clearTimeout(ambientTimer);
    observer?.disconnect();doc?.removeEventListener?.('visibilitychange',onVisibility);
    global.removeEventListener?.('pageshow',onVisibility);
    root.removeEventListener('click',onClick);root.removeEventListener('pointermove',onPointer);root.removeEventListener('pointerleave',onExit);};
 }

 global.GalaxyGardenV5=Object.freeze({render,attach,stageOf,normalize,ambient,chapterFor,CHAPTERS,SEASONS,THEMES,DAYPARTS});
})(typeof window!=='undefined'?window:globalThis);
