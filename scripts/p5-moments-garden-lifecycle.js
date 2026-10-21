/* P5 STAGING lifecycle controller — NOT loaded in Android.
 * Glue for the synchronous Moments presenter after authorized runtime integration.
 * No backend writes, timers, network, storage, Android, or demo-world controls.
 *
 * Usage in an authorized app integration (NOT applied here):
 *   const gardenLifecycle=window.GalaxyMomentsGardenLifecycle.create();
 *   after momentsView() has been inserted:
 *     gardenLifecycle.update({host:document.querySelector('[data-p5-garden-host]'),cloud});
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
  let controller=null,currentHost=null,everEntered=false,disposed=false;
  function leave(){
   controller?.dispose();
   controller=null;currentHost=null;
  }
  function reset(){
   leave();everEntered=false;
  }
  function update({host,cloud,preferences}={}){
   if(disposed)throw new Error('P5_LIFECYCLE_DISPOSED');
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
