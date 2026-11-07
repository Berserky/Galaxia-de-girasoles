/* V5 P5E: accessible playback controls over the existing browser audio engine.
 * No server calls, storage, fabricated waveform, timestamps or duration.
 * Events are delegated so transient WebView renders cannot orphan handlers. */
(function(global){
 'use strict';
 const hasDuration=audio=>Number.isFinite(audio?.duration)&&audio.duration>0;
 function formatTime(seconds){
  if(!Number.isFinite(seconds)||seconds<0)return '--:--';
  const value=Math.floor(seconds);
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
 }
 function update(audio,message){
  const player=audio?.closest?.('.living-voice-player');
  if(!player)return;
  const ready=hasDuration(audio),duration=ready?audio.duration:null;
  const current=Number.isFinite(audio.currentTime)?Math.max(0,audio.currentTime):0;
  const range=player.querySelector('.living-voice-seek');
  if(range){
   range.disabled=!ready;
   range.max=ready?String(Math.floor(duration*1000)):'100';
   range.value=ready?String(Math.min(Math.floor(duration*1000),Math.floor(current*1000))):'0';
   range.setAttribute('aria-valuetext',ready?formatTime(current)+' de '+formatTime(duration):'Duración todavía no disponible');
  }
  const clock=player.querySelector('.living-voice-time');
  if(clock)clock.textContent=formatTime(current)+' / '+(ready?formatTime(duration):'--:--');
  const playing=!audio.paused&&!audio.ended;
  const toggle=player.querySelector('.living-voice-toggle');
  if(toggle){
   toggle.dataset.playing=playing?'true':'false';
   toggle.setAttribute('aria-label',playing?'Pausar mensaje de voz':'Reproducir mensaje de voz');
   toggle.setAttribute('aria-pressed',String(playing));
  }
  const status=player.querySelector('.living-voice-status');
  if(status){
   if(message)status.textContent=message;
   else if(audio.error)status.textContent='No se pudo cargar este audio.';
   else if(audio.ended)status.textContent='Reproducción finalizada';
   else if(playing)status.textContent='Reproduciendo';
   else status.textContent=ready?'Listo para escuchar':'Duración aún no disponible';
  }
 }
 function activate(player){
  const audio=player?.querySelector('audio.living-voice-audio');
  if(!audio)return;
  if(!audio.paused){audio.pause();return;}
  // Never play multiple private voice clips at once.
  document.querySelectorAll('.living-voice-player audio.living-voice-audio').forEach(other=>{
   if(other!==audio&&!other.paused)other.pause();
  });
  update(audio,'Cargando audio…');
  try{
   const promise=audio.play();
   if(promise&&typeof promise.catch==='function')
    promise.catch(()=>update(audio,'No se pudo reproducir. Comprueba la conexión o el archivo.'));
  }catch{
   update(audio,'No se pudo reproducir. Comprueba la conexión o el archivo.');
  }
 }
 if(typeof document!=='undefined'){
  document.addEventListener('click',event=>{
   const button=event.target.closest?.('.living-voice-toggle');
   if(button){activate(button.closest('.living-voice-player'));return;}
  });
  document.addEventListener('input',event=>{
   const range=event.target.closest?.('.living-voice-seek');
   if(!range)return;
   const audio=range.closest('.living-voice-player')?.querySelector('audio.living-voice-audio');
   if(!audio||!hasDuration(audio))return;
   const value=Number(range.value)/1000;
   if(Number.isFinite(value))audio.currentTime=Math.min(audio.duration,Math.max(0,value));
   update(audio);
  });
  for(const kind of ['loadedmetadata','durationchange','timeupdate','play','pause','ended','waiting','playing','error']){
   document.addEventListener(kind,event=>{
    const audio=event.target;
    if(!audio?.matches?.('audio.living-voice-audio'))return;
    const note=kind==='waiting'?'Cargando audio…':
      kind==='error'?'No se pudo cargar este audio.':null;
    update(audio,note);
   },true);
  }
 }
 global.GalaxyVoiceV5={formatTime,hasDuration};
})(window);
