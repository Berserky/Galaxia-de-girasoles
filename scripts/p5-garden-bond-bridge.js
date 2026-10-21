/* P5 STAGING BRIDGE (not installed in Android): no network, no demo progression.
 * Future integration must load canonical exported GalaxyGardenV5 before this file.
 */
(function(global){
 'use strict';
 const ALLOWED_THEMES=['daylight','cosmic','halloween','christmas','valentine','friendship','easter'];
 const ALLOWED_SEASONS=['winter','spring','summer','autumn'];
 const ALLOWED_DAYPARTS=['morning','day','sunset','night'];
 const CLIMATE={winter:'invierno',spring:'primavera',summer:'verano',autumn:'otoño',morning:'mañana',day:'día',sunset:'atardecer',night:'noche'};
 const fallBack='<div class="ng-garden-unavailable" role="status">El progreso del jardín no está disponible por ahora.</div>';
 const allowed=(value,values,defaultValue)=>values.includes(value)?value:defaultValue;
 function plan(garden,preferences={}){
  // A missing/malformed preference object must not break the Moments screen.
  const prefs=preferences&&typeof preferences==='object'&&!Array.isArray(preferences)?preferences:{};
  // Reject missing or malformed backend progression, not silently "0 días".
  const n=garden?.stage;
  if(typeof n!=='number'||!Number.isSafeInteger(n)||n<0)return Object.freeze({ready:false,reason:'NO_AUTHENTIC_STAGE'});
  const stage=Math.min(8,n);
  // Match the current mobile theme when a presenter does not supply an override.
  // No storage, network, or user-permission access is needed.
  const appTheme=global.document?.documentElement?.dataset?.theme;
  const selectedTheme=prefs.theme===undefined?appTheme:prefs.theme;
  const theme=allowed(selectedTheme,ALLOWED_THEMES,'daylight');
  const season=allowed(prefs.season,ALLOWED_SEASONS,null);
  const daypart=allowed(prefs.daypart,ALLOWED_DAYPARTS,null);
  const motion=prefs.motion==='reduce'?'reduce':'full';
  return Object.freeze({ready:true,stage,capped:n>8,theme,season,daypart,motion,autoDaypart:daypart===null});
 }
 function create({engine=global.GalaxyGardenV5,host,onFlowerTap,initialEntrance='grow'}={}){
  if(!engine||typeof engine.render!=='function'||typeof engine.attach!=='function'||typeof engine.normalize!=='function')
   throw new Error('P5_BRIDGE_BLOCKED: canonical garden engine is required');
  if(!host||typeof host.querySelector!=='function')throw new Error('P5_BRIDGE_BLOCKED: valid host required');
  const firstEntrance=initialEntrance==='none'?'none':'grow';
  let node=null,stage=null,stop=()=>{},last=null,attachedMode=null,disposed=false;
  const modeOf=state=>String(state.autoDaypart)+':'+String(state.season===null);
  const annotate=()=>{
   if(!node||!last)return;
   const state=engine.normalize({stage:last.stage},{theme:last.theme,season:last.season||undefined,daypart:node.dataset.daypart,motion:last.motion});
   node.setAttribute('aria-label',`Jardín compartido; etapa oficial ${state.officialStage}; ${state.chapterName}; ${CLIMATE[state.season]}, ${CLIMATE[state.daypart]}`);
  };
  function mount(){
   stop();
   stop=engine.attach(node,{autoAmbient:last.autoDaypart||last.season===null,autoSeason:last.season===null,
    onAmbient:()=>{if(last.daypart)node.dataset.daypart=last.daypart;annotate();},
    onFlowerTap:flower=>{
     if(Number.isInteger(flower)&&flower>=1&&flower<=last.stage&&typeof onFlowerTap==='function')onFlowerTap(flower);
    }});
   attachedMode=modeOf(last);
  }
  function update(garden,preferences={}){
   if(disposed)throw new Error('P5_BRIDGE_DISPOSED');
   const state=plan(garden,preferences);
   if(!state.ready){stop();stop=()=>{};node=null;stage=null;last=null;attachedMode=null;host.innerHTML=fallBack;return state;}
   last=state;
   // If host was replaced by a parent render, treat this as a new mount.
   const current=host.querySelector('.ng-garden');
   const replace=!node||current!==node||stage!==state.stage;
   if(replace){
    stop();stop=()=>{};
    const options={theme:state.theme,motion:state.motion,entrance:stage===null?firstEntrance:'none'};
    if(state.season)options.season=state.season;
    if(state.daypart)options.daypart=state.daypart;
    // Explicitly avoid the experimental world parameters. Only official stages render.
    host.innerHTML=engine.render({stage:state.stage},options);
    node=host.querySelector('.ng-garden');
    if(!node)throw new Error('P5_BRIDGE_BLOCKED: renderer did not mount scene');
    stage=state.stage;
    mount();
   }else{
    node.dataset.celebration=state.theme;
    node.dataset.motion=state.motion;
    node.dataset.season=state.season||engine.ambient().season;
    node.dataset.daypart=state.daypart||engine.ambient().daypart;
    if(attachedMode!==modeOf(state))mount();
   }
   annotate();
   return state;
  }
  function dispose(){if(disposed)return;disposed=true;stop();stop=()=>{};node=null;last=null;attachedMode=null;}
  return Object.freeze({update,dispose});
 }
 global.GalaxyGardenBondBridge=Object.freeze({plan,create});
})(typeof window!=='undefined'?window:globalThis);
