/* P5 STAGING lifecycle controller — NOT loaded in Android.
 * Glue for the synchronous Moments presenter after authorized runtime integration.
 * No backend writes, timers, network, storage, Android, or demo-world controls.
 *
 * Usage in an authorized app integration (NOT applied here):
 *   const gardenLifecycle=window.GalaxyMomentsGardenLifecycle.create();
 *   after momentsView() has been inserted:
 *     gardenLifecycle.update({host:document.querySelector('[data-p5-garden-host]'),cloud,sessionKey});
 *   sessionKey must come from an authenticated pairing identity, never a demo/clock value.
 *   before leaving Moments / unpairing: gardenLifecycle.leave();
 *   after changing paired identity: gardenLifecycle.reset();
 */
(function(global){
 'use strict';
 const unavailable=Object.freeze({ready:false,reason:'NO_GARDEN_HOST'});
 // Do NOT use momentsView()'s fallback {stage:0}: when Bond has not loaded,
 // fabricating a seed would incorrectly portray unauthenticated progress.
 function authenticGarden(cloud){
  const garden=cloud?.bond?.garden;
  return garden&&typeof garden==='object'&&!Array.isArray(garden)?garden:null;
 }
 function create({bridge=global.GalaxyGardenBondBridge,onFlowerTap}={}){
  if(!bridge||typeof bridge.create!=='function'||typeof bridge.plan!=='function')
   throw new Error('P5_LIFECYCLE_BLOCKED: canonical Bond bridge required');
  let controller=null,currentHost=null,everEntered=false,disposed=false,activeSessionKey=null;
  function leave(){
   controller?.dispose();
   controller=null;currentHost=null;
  }
  function reset(){
   const oldHost=currentHost;
   leave();everEntered=false;activeSessionKey=null;
   // Do not leave the prior couple's flowers on-screen when unpairing or
   // switching sessions. Only clear a host that still contains our scene.
   if(oldHost?.querySelector?.('.ng-garden'))
    oldHost.innerHTML='<div class="ng-garden-unavailable" role="status">El progreso del jardín no está disponible por ahora.</div>';
  }
  function update({host,cloud,preferences,sessionKey}={}){
   if(disposed)throw new Error('P5_LIFECYCLE_DISPOSED');
   // Optional for a legacy presenter. Once bound to an authenticated session,
   // however, neither a different session nor a missing/invalid key may reuse
   // observers, a flower view or the first-entrance animation flag.
   const supplied=typeof sessionKey==='string'&&sessionKey.length>0;
   if(sessionKey!==undefined&&!supplied){reset();return Object.freeze({ready:false,reason:'INVALID_SESSION_IDENTITY'});}
   if(activeSessionKey!==null&&!supplied){reset();return Object.freeze({ready:false,reason:'SESSION_IDENTITY_REQUIRED'});}
   if(supplied&&activeSessionKey!==sessionKey){
    if(activeSessionKey!==null||everEntered||controller)reset();
    activeSessionKey=sessionKey;
   }
   if(!host||typeof host.querySelector!=='function'){
    leave();return unavailable;
   }
   if(host!==currentHost||!controller){
    leave();
    controller=bridge.create({host,onFlowerTap,initialEntrance:everEntered?'none':'grow'});
    currentHost=host;
   }
   const state=controller.update(authenticGarden(cloud),preferences);
   if(state.ready)everEntered=true;
   return state;
  }
  function dispose(){
   if(disposed)return;
   reset();disposed=true;
  }
  return Object.freeze({update,leave,reset,dispose});
 }
 global.GalaxyMomentsGardenLifecycle=Object.freeze({authenticGarden,create});
})(typeof window!=='undefined'?window:globalThis);
