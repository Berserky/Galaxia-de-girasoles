(()=>{
'use strict';
const STATES=Object.freeze(['idle','requesting_permission','recording_hold','recording_locked','paused','preview','preparing','sending','cancelled','failed']);
function create({now=()=>Date.now(),maxDurationMs=300000}={}){
 let state='idle',startedAt=0,pausedAt=0,pausedTotal=0,durationMs=0,error='',waveform=[];
 const snapshot=()=>({state,startedAt,pausedAt,pausedTotal,durationMs,error,waveform:[...waveform],maxDurationMs,recording:['recording_hold','recording_locked','paused'].includes(state),ready:state==='preview'});
 const transition=(next,patch={})=>{if(!STATES.includes(next))throw Error('Invalid voice state: '+next);state=next;Object.assign(api,patch);return snapshot();};
 function requestPermission(){state='requesting_permission';error='';return snapshot();}
 function startHold(){state='recording_hold';startedAt=now();pausedAt=0;pausedTotal=0;durationMs=0;error='';waveform=[];return snapshot();}
 function lock(){if(state==='recording_hold')state='recording_locked';return snapshot();}
 function pause(){if(!['recording_hold','recording_locked'].includes(state))return snapshot();pausedAt=now();state='paused';return snapshot();}
 function resume(){if(state!=='paused')return snapshot();pausedTotal+=Math.max(0,now()-pausedAt);pausedAt=0;state='recording_locked';return snapshot();}
 function elapsed(){if(startedAt<=0)return durationMs;const end=pausedAt||now();return Math.min(maxDurationMs,Math.max(durationMs,end-startedAt-pausedTotal));}
 function sample(amplitude){const value=Math.max(0,Math.min(1,Number(amplitude)||0));waveform.push(value);if(waveform.length>48)waveform.shift();durationMs=elapsed();return snapshot();}
 function preview(ms=elapsed()){durationMs=Math.max(0,Number(ms)||0);state='preview';pausedAt=0;return snapshot();}
 function preparing(){state='preparing';return snapshot();}
 function sending(){state='sending';return snapshot();}
 function cancel(){state='cancelled';durationMs=0;waveform=[];return snapshot();}
 function fail(message=''){state='failed';error=String(message||'');return snapshot();}
 function reset(){state='idle';startedAt=0;pausedAt=0;pausedTotal=0;durationMs=0;error='';waveform=[];return snapshot();}
 const api={snapshot,requestPermission,startHold,lock,pause,resume,elapsed,sample,preview,preparing,sending,cancel,fail,reset,transition};
 return api;
}
window.GalaxyChatVoice=Object.freeze({create,STATES});
})();