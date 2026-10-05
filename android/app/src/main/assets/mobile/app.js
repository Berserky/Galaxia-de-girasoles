const $=s=>document.querySelector(s);
const app=$('#app'),navEl=$('#bottomNav'),chatFab=$('#chatFab'),modal=$('#modal'),toastEl=$('#toast');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const ico=(name,cls='')=>'<i data-lucide="'+attr(name)+'" class="ui-icon '+attr(cls)+'" aria-hidden="true"></i>';
const refreshIcons=()=>requestAnimationFrame(()=>window.lucide?.createIcons?.({attrs:{'stroke-width':1.8}}));
const icons={home:'house',map:'map-pin',moments:'heart',ai:'sparkles',memories:'images',more:'more-horizontal'};
const nav=[['home','Inicio'],['map','Mapa'],['moments','Momentos'],['ai','IA'],['memories','Recuerdos'],['more','Más']];
const moods={feliz:['smile','Feliz'],tranquilo:['waves','En calma'],cansado:['moon','Sin energía'],sensible:['heart','Sensible'],abrazo:['hand-heart','Abrazo']};
const kindMeta={
 memory:['heart','Recuerdo'],event:['calendar','Fecha especial'],plan:['circle-check-big','Plan'],note:['file-text','Nota'],
 capsule:['lock','Cápsula'],wish:['star','Deseo'],journey:['route','Viaje'],song:['music','Canción']
};
const gameQuestions={
 comfort:{label:'¿Qué me ayuda más cuando tengo un día difícil?',options:['Un abrazo','Hablar de todo','Un rato de calma','Algo rico']},
 date:{label:'¿Qué plan elegiría para una cita tranquila?',options:['Película en casa','Paseo al aire libre','Cocinar juntos','Descubrir un café']},
 love:{label:'¿Qué detalle me hace sentir más querido/a?',options:['Palabras bonitas','Tiempo juntos','Una sorpresa','Ayuda con algo']},
 travel:{label:'¿Qué viaje elegiría?',options:['La playa','La montaña','Una ciudad nueva','Una cabaña']},
 morning:{label:'¿Cuál sería mi mañana ideal?',options:['Dormir un poco más','Desayunar juntos','Salir a caminar','Música y café']},
 memory:{label:'¿Qué tipo de recuerdo guardo con más cariño?',options:['Nuestro primer encuentro','Un viaje juntos','Una conversación','Un abrazo especial']}
};
const dailyQuestions=[
 '¿Qué fue lo más bonito de tu día?','¿Qué te gustaría que hiciéramos juntos esta semana?','¿Qué recuerdo nuestro te hizo sonreír últimamente?',
 '¿Qué necesitas de mí hoy?','¿Qué lugar te gustaría conocer conmigo?','¿Qué detalle pequeño te hace sentir querido/a?',
 '¿Cuál canción te recuerda a nosotros?','¿Qué comida te gustaría que preparáramos juntos?','¿Qué plan sencillo haría especial un día normal?',
 '¿Qué admiras de nosotros como pareja?','¿Qué te gustaría repetir de estos meses juntos?','¿Qué cosa nueva quisieras enseñarme?',
 '¿Qué te da tranquilidad cuando estamos juntos?','¿Qué foto nuestra te gusta más y por qué?','¿Qué aventura improvisada te gustaría tener?',
 '¿Qué sueño personal quieres que yo acompañe?','¿Qué palabra describe cómo te sientes con nosotros hoy?','¿Qué momento cotidiano quisieras recordar dentro de años?',
 '¿Qué película o serie deberíamos ver juntos?','¿Qué lugar de Bogotá convertirías en “nuestro lugar”?','¿Qué te gustaría recibir más: abrazos, palabras, tiempo o sorpresas?',
 '¿Qué cosa graciosa de mí te da ternura?','¿Qué hábito bonito podríamos construir juntos?','¿Qué te gustaría celebrar aunque parezca pequeño?',
 '¿Qué aprendiste de mí recientemente?','¿Cómo sería un domingo perfecto juntos?','¿Qué te gustaría que nunca dejáramos de hacer?',
 '¿Qué plan harías conmigo con cero presupuesto?','¿Qué quieres agradecerme hoy?','¿Qué quieres que vivamos antes de terminar este año?'
];
const legacySurpriseIdeas=[
 {title:'Café y caminata',body:'Elegir un café nuevo y caminar sin afán por el barrio.',minutes:90,budget:45000,where:'salir'},
 {title:'Noche de película',body:'Cada uno propone una película, se sortea una y preparan algo rico.',minutes:150,budget:25000,where:'casa'},
 {title:'Cocinar juntos',body:'Comprar ingredientes para una receta que ninguno haya hecho.',minutes:120,budget:55000,where:'casa'},
 {title:'Fotos de nosotros',body:'Salir a caminar y tomar cinco fotos que cuenten el día.',minutes:90,budget:0,where:'salir'},
 {title:'Picnic sencillo',body:'Algo de comer, una manta y un parque para hablar sin pantallas.',minutes:150,budget:40000,where:'salir'},
 {title:'Preguntas y postre',body:'Comprar un postre y responder diez preguntas para conocerse más.',minutes:60,budget:30000,where:'casa'},
 {title:'Ruta sin destino',body:'Salir juntos y decidir cada giro por turnos durante media hora.',minutes:120,budget:30000,where:'salir'},
 {title:'Álbum del mes',body:'Elegir juntos las mejores fotos del mes y escribir una frase para cada una.',minutes:60,budget:0,where:'casa'}
];

let native={paired:false,version:''},cloud=null,mapData=null,view='home',memoryTab='memory',memoriesTabsScroll=0,media={photo:null,music:null},mediaLoadedAt={photo:0,music:0},map=null,monthlyCache=new Map(),insightsCache=new Map(),todayHistoryCache=new Map(),todayHistoryItems=new Map(),encounterStatsCache=null,encounterStatsLoading=false,frequentPlacesData=null,frequentPlacesLoadedAt=0,frequentPlacesLoading=false;
let toastTimer,refreshing=false,updateState={text:'La app está al día.',progress:0,busy:false},pendingVoiceDraft=null,voiceReady=false,voiceRecording=false,voiceResumeMusic=false,lastSurprise=null;
let dateContext=null,dateContextLoadedAt=0,dateQuestionNonce=0,dateMode=null,dateModeTimer=null,dateLastExperience=null;
let goalsState=null,goalsLoadedAt=0,goalsFilter='active';
let presenceLastSignature='',voiceTimer=null,voiceSeconds=0,intelligenceSearchNonce=0;
let chatState=null,chatLoading=false,chatQueuedLoad=null,chatReply=null,chatStateSignature='',chatPreferencesState=null,chatUnlockedSession=false,notificationState=null,pendingDeepLink=null;
let chatAttachmentsDraft=[],chatNewCount=0,chatPinIndex=0,chatTypingTimer=null,chatPresenceTimer=null,chatOutboxFlushing=false,chatOutboxFlushPromise=null,chatInitialScroll=true,chatVoiceState={recording:false,paused:false,ready:false,durationMs:0},chatHoldRecord=null;
let welcomeStep=0,welcomePreview=false,welcomeGift=true,welcomeEntering=false,tourStep=-1;
const welcomeMusic=new Audio('../musica.mp3');welcomeMusic.loop=true;welcomeMusic.volume=.32;
const globalPlayer=document.getElementById('globalPlayer'),providerPlayer=document.getElementById('providerPlayer');
const musicAudio=new Audio();musicAudio.preload='metadata';
let musicQueue=[],musicIndex=-1,musicPlaying=false,ytPlayer=null,spotifyApi=null,spotifyController=null,pendingProviderTrack=null;
const songItems=()=>cloud?.items?.filter(x=>x.kind==='song').map(x=>({id:x.id,type:'url',title:x.data?.title||'Canción',url:x.data?.url||'',platform:x.data?.platform||detectMusicPlatform(x.data?.url||''),created:x.created}))||[];
function detectMusicPlatform(url){try{const h=new URL(url).hostname.toLowerCase();if(h.includes('spotify.com'))return'spotify';if(h.includes('youtube.com')||h.includes('youtu.be'))return'youtube';return'audio';}catch{return'audio';}}
function youtubeId(url){try{const u=new URL(url);if(u.hostname.includes('youtu.be'))return u.pathname.split('/')[1];if(u.pathname.includes('/shorts/'))return u.pathname.split('/shorts/')[1]?.split('/')[0];return u.searchParams.get('v');}catch{return'';}}
function rebuildMusicQueue(){const uploads=(media.music||[]).map((x,n)=>({id:'mp3:'+x.path,type:'mp3',title:x.originalName||x.name||('Canción '+(n+1)),url:x.url,platform:'mp3',path:x.path,created:x.created}));musicQueue=[...uploads,...songItems()];}
function playerIcon(){return musicPlaying?'pause':'play';}
function renderGlobalPlayer(){
 rebuildMusicQueue();const t=musicQueue[musicIndex];
 if(!t){globalPlayer.className='global-player';globalPlayer.innerHTML='';return;}
 globalPlayer.className='global-player visible';
 globalPlayer.innerHTML='<button class="player-main" data-action="player-toggle" aria-label="'+(musicPlaying?'Pausar':'Reproducir')+'">'+ico(playerIcon())+'</button><button class="player-info" data-action="player-expand"><span class="player-eq '+(musicPlaying?'playing':'')+'"><i></i><i></i><i></i></span><span><b>'+esc(t.title)+'</b><small>'+esc(t.platform==='youtube'?'YouTube / YouTube Music':t.platform==='spotify'?'Spotify':t.platform==='mp3'?'MP3':'Audio')+'</small></span></button><button class="player-skip" data-action="player-next" aria-label="Siguiente">'+ico('skip-forward')+'</button>';
 refreshIcons();
}
function setMusicPlaying(v){musicPlaying=!!v;renderGlobalPlayer();if(cloud)setTimeout(()=>syncPresence(),0);}
function playMusicAt(index){
 rebuildMusicQueue();if(!musicQueue.length)return;musicIndex=(index+musicQueue.length)%musicQueue.length;const t=musicQueue[musicIndex];
 musicAudio.pause();if(ytPlayer?.pauseVideo)try{ytPlayer.pauseVideo();}catch{}if(spotifyController?.pause)try{spotifyController.pause();}catch{}
 if(t.platform==='youtube'){const id=youtubeId(t.url);if(!id){toast('No pude reconocer ese enlace de YouTube.');return;}pendingProviderTrack=t;setMusicPlaying(false);if(ytPlayer?.loadVideoById){ytPlayer.loadVideoById(id);}else initYouTube(id);}
 else if(t.platform==='spotify'){pendingProviderTrack=t;setMusicPlaying(false);if(spotifyController){spotifyController.loadEntity(t.url);spotifyController.play();}else initSpotify(t);}
 else{musicAudio.src=t.url;musicAudio.play().then(()=>setMusicPlaying(true)).catch(()=>{setMusicPlaying(false);toast('No pude reproducir ese audio.');});}
 renderGlobalPlayer();
}
function toggleMusic(){const t=musicQueue[musicIndex];if(!t)return;if(t.platform==='youtube'&&ytPlayer){musicPlaying?ytPlayer.pauseVideo():ytPlayer.playVideo();setMusicPlaying(!musicPlaying);}else if(t.platform==='spotify'&&spotifyController){spotifyController.togglePlay();setMusicPlaying(!musicPlaying);}else{if(musicPlaying)musicAudio.pause();else musicAudio.play().catch(()=>{});setMusicPlaying(!musicPlaying);}}
function initYouTube(id){if(!window.YT?.Player){setTimeout(()=>initYouTube(id),350);return;}providerPlayer.innerHTML='<div id="ytGlobal"></div>';ytPlayer=new YT.Player('ytGlobal',{height:'200',width:'200',videoId:id,playerVars:{playsinline:1},events:{onReady:e=>{e.target.playVideo();setMusicPlaying(true);},onStateChange:e=>{if(e.data===YT.PlayerState.ENDED)playMusicAt(musicIndex+1);else if(e.data===YT.PlayerState.PLAYING)setMusicPlaying(true);else if(e.data===YT.PlayerState.PAUSED)setMusicPlaying(false);}}});}
window.onSpotifyIframeApiReady=api=>{spotifyApi=api;if(pendingProviderTrack?.platform==='spotify')initSpotify(pendingProviderTrack);};
function initSpotify(t){if(!spotifyApi){setTimeout(()=>{if(!spotifyController&&pendingProviderTrack===t)initSpotify(t);},400);return;}providerPlayer.innerHTML='<div id="spotifyGlobal"></div>';spotifyApi.createController(document.getElementById('spotifyGlobal'),{url:t.url,width:300,height:152},c=>{spotifyController=c;c.addListener('playback_update',e=>setMusicPlaying(!e.data.isPaused));c.play();});}
musicAudio.addEventListener('ended',()=>playMusicAt(musicIndex+1));musicAudio.addEventListener('play',()=>setMusicPlaying(true));musicAudio.addEventListener('pause',()=>{if(musicQueue[musicIndex]?.platform!=='youtube'&&musicQueue[musicIndex]?.platform!=='spotify')setMusicPlaying(false);});

const WELCOME_KEY='nuestra-galaxia.adri-welcome.v1';
const welcomeDone=()=>{try{return localStorage.getItem(WELCOME_KEY)==='done';}catch{return false;}};
const shouldShowAdriWelcome=()=>native.paired&&(welcomePreview||(String(native.person)==='1'&&!welcomeDone()));
const finishAdriWelcome=()=>{try{localStorage.setItem(WELCOME_KEY,'done');}catch{}welcomePreview=false;welcomeStep=0;welcomeGift=true;tourStep=0;view='home';render();};

window.GalaxyNative={
 pending:new Map(),
 call(method,...args){
   const id=(Date.now().toString(36)+Math.random().toString(36).slice(2));
   return new Promise((resolve,reject)=>{
     this.pending.set(id,{resolve,reject});
     try{
       if(!window.GalaxyAndroid?.postMessage)throw new Error('Puente Android no disponible.');
       GalaxyAndroid.postMessage(JSON.stringify({id,method,args}));
     }catch(e){this.pending.delete(id);reject(e);}
   });
 },
 receive(id,json,error){
   const p=this.pending.get(id);if(!p)return;this.pending.delete(id);
   if(error){p.reject(new Error(error));return;}
   try{p.resolve(JSON.parse(json||'{}'));}catch(e){p.reject(e);}
 },
 event(name,json){
   let data={};try{data=JSON.parse(json||'{}');}catch{}
   if(name==='native'){native=data;render();}
   if(name==='update'){updateState=data;renderUpdateOnly();}
   if(name==='deep-link'){pendingDeepLink=data;if(cloud)setTimeout(()=>consumeDeepLink(),0);}
   if(name==='voice'&&data.ready&&modal.open){stopVoiceTimer();voiceRecording=false;voiceReady=true;const status=modal.querySelector('[data-role="voice-status"]');if(status)status.textContent='Grabación lista. Escúchala antes de guardar.';modal.querySelector('[data-action="voice-record-stop"]')?.setAttribute('hidden','');modal.querySelector('[data-action="voice-preview"]')?.removeAttribute('hidden');modal.querySelector('[data-action="voice-discard"]')?.removeAttribute('hidden');modal.querySelector('[data-action="voice-record-start"]')?.removeAttribute('hidden');if(voiceResumeMusic){toggleMusic();voiceResumeMusic=false;}}
   if(name==='voice-preview-ended'&&voiceResumeMusic){toggleMusic();voiceResumeMusic=false;}
 },
 back(){
   if(modal.open){closeModal();return;}
   if(view!=='home'){go('home');return;}
   this.call('closeApp').catch(()=>{});
 }
};

function nativeState(){return native&&typeof native==='object'?native:{paired:false};}
native={paired:false};

const api=(action,payload={})=>GalaxyNative.call('api',JSON.stringify({action,...payload}));
const toast=message=>{toastEl.textContent=message;toastEl.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toastEl.classList.remove('show'),3500);};
const loading=label=>'<'+'div class="card skeleton" aria-label="'+esc(label)+'"></div>';
const fmtDate=value=>{if(!value)return'';try{return new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',year:'numeric'}).format(new Date(value+'T12:00:00'));}catch{return value;}};
const fmtDateTime=value=>{if(!value)return'';try{return new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return value;}};
const fmtDistance=m=>m>=1000?(m/1000).toFixed(1)+' km':Math.round(m||0)+' m';
const fmtDuration=s=>{const min=Math.round((s||0)/60);return min>=60?Math.floor(min/60)+' h '+(min%60)+' min':min+' min';};
const items=kind=>(cloud?.items||[]).filter(i=>i.kind===kind);
const names=()=>cloud?.settings?.data?.names||['Nosotros','Dos'];
const myName=()=>names()[Number(cloud?.person||0)]||'Yo';
const partnerName=()=>names()[Number(cloud?.person||0)===0?1:0]||'Mi persona';
const todayRows=()=>cloud?.daily?.filter(r=>r.day===cloud.today)||[];
const ownDaily=()=>todayRows().find(r=>r.person===cloud?.person)||{};
const partnerDaily=()=>todayRows().find(r=>r.person!==cloud?.person)||{};
const normalizedPresence=person=>{
 const row=(cloud?.presence||[]).find(x=>String(x.person)===String(person));
 if(row)return {shareBattery:row.share_battery===true,shareListening:row.share_song===true,battery:row.battery,listening:row.song_title||'',updatedAt:row.updated_at||null};
 return cloud?.settings?.data?.presence?.[String(person)]||{};
};
const ownPresence=()=>normalizedPresence(String(cloud?.person));
const partnerPresence=()=>normalizedPresence(String(cloud?.person)==='0'?'1':'0');
const currentTrackTitle=()=>{rebuildMusicQueue();return musicPlaying&&musicQueue[musicIndex]?String(musicQueue[musicIndex].title||''):'';};
async function syncPresence(force=false){
 if(!native.paired||!cloud)return;
 const p=ownPresence(),payload={shareBattery:p.shareBattery===true,shareListening:p.shareListening===true,battery:native.battery==null?null:Number(native.battery),listening:currentTrackTitle()};
 const signature=JSON.stringify(payload);
 if(!force&&signature===presenceLastSignature)return;
 presenceLastSignature=signature;
 try{await api('presence-set',payload);await refreshState({quiet:true});try{await GalaxyNative.call('refreshMoments');}catch{}}
 catch(e){presenceLastSignature='';if(force)throw e;}
}
async function togglePresence(kind){
 const p=ownPresence(),payload={shareBattery:p.shareBattery===true,shareListening:p.shareListening===true,battery:native.battery==null?null:Number(native.battery),listening:currentTrackTitle()};
 if(kind==='battery')payload.shareBattery=!payload.shareBattery;
 if(kind==='listening')payload.shareListening=!payload.shareListening;
 await api('presence-set',payload);presenceLastSignature='';await refreshState({quiet:true});render();try{await GalaxyNative.call('refreshMoments');}catch{}
}
function nowPersonCard(person,isOwn){
 const loc=(cloud.locations||[]).find(l=>String(l.person)===String(person))||{},daily=todayRows().find(r=>String(r.person)===String(person))||{};
 const p=cloud?.settings?.data?.presence?.[String(person)]||{},name=names()[Number(person)]||(isOwn?'Yo':'Mi persona');
 const mood=daily.mood?(moods[daily.mood]?.[1]||daily.mood):'Sin estado';
 const movement=loc.sharing?transportLabel(loc):'Ubicación pausada';
 const battery=isOwn?(native.battery==null?NaN:Number(native.battery)):(p.shareBattery===true&&p.battery!=null?Number(p.battery):NaN);
 const listening=isOwn?currentTrackTitle():(p.shareListening===true?String(p.listening||''):'');
 const kmh=loc.sharing?Math.max(0,Number(loc.speed||0)*3.6):null;
 return '<div class="now-person card"><div class="row between"><div><span class="badge">'+esc(isOwn?'Tú':'Ahora')+'</span><h3>'+esc(name)+'</h3></div><span class="now-mood">'+esc(mood)+'</span></div>'+
 '<div class="now-facts"><span>'+ico('navigation')+esc(movement)+(kmh!==null?' · '+kmh.toFixed(kmh<10?1:0)+' km/h':'')+'</span>'+
 (loc.status?'<span>'+ico('message-circle')+esc(loc.status)+'</span>':'')+
 (listening?'<span>'+ico('music')+esc(listening)+'</span>':'')+
 (Number.isFinite(battery)?'<span>'+ico('battery-charging')+Math.round(battery)+'%</span>':'')+'</div></div>';
}
function nowCard(){
 const me=String(cloud.person),other=me==='0'?'1':'0';
 return '<section class="section now-section"><div class="section-head"><div><p class="eyebrow">AHORA</p><h2>Cómo estamos</h2><p>Solo se comparte lo que cada uno decide activar.</p></div><button class="btn small ghost" data-action="now-settings">'+ico('sliders-horizontal')+' Privacidad</button></div><div class="now-grid">'+nowPersonCard(me,true)+nowPersonCard(other,false)+'</div></section>';
}
const dailyQuestion=()=>{if(dateContext?.question?.text)return dateContext.question.text;const d=cloud?.today||new Date().toISOString().slice(0,10);let n=0;for(const ch of d)n+=ch.charCodeAt(0);return dailyQuestions[n%dailyQuestions.length];};
const currentMonday=()=>{const d=new Date((cloud?.today||new Date().toISOString().slice(0,10))+'T12:00:00');const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.toISOString().slice(0,10);};
const coupleDays=()=>{const s=cloud?.settings?.data?.startDate;if(!s)return 0;return Math.max(0,Math.floor((Date.parse((cloud?.today||s)+'T12:00:00Z')-Date.parse(s+'T12:00:00Z'))/86400000));};
const dateDistance=d=>Math.round((Date.parse(d+'T12:00:00Z')-Date.parse((cloud?.today||d)+'T12:00:00Z'))/86400000);
function livingMoment(){
 const memories=items('memory').filter(x=>x.data?.date),next=cloud?.nextEvent,partner=partnerDaily();
 if(next&&dateDistance(next.date)>=0&&dateDistance(next.date)<=14)return {icon:'calendar-heart',label:'SE ACERCA ALGO ESPECIAL',title:next.title,body:'Faltan '+dateDistance(next.date)+' días.',action:'memory'};
 if(partner.mood)return {icon:'heart-pulse',label:'AHORA',title:partnerName()+' está '+(moods[partner.mood]?.[1]||partner.mood).toLowerCase(),body:'Un pequeño gesto puede hacer el día más cercano.',action:'moments'};
 const last=memories.slice().sort((a,b)=>String(b.data.date).localeCompare(String(a.data.date)))[0];
 return last?{icon:'sparkles',label:'DE SU HISTORIA',title:last.data.title,body:'Un recuerdo para volver a mirar hoy.',action:'memory',id:last.id}:{icon:'sparkles',label:'MOMENTOS VIVOS',title:'Su historia empieza aquí',body:'Guarden algo de hoy para encontrarlo más adelante.',action:'add-memory'};
}
function anniversaryInfo(){
 const start=cloud?.settings?.data?.startDate,today=cloud?.today;if(!start||!today)return null;
 const clock=window.GalaxyInsights?.relationshipClock(start,new Date(today+'T12:00:00-05:00').toISOString());
 if(!clock)return null;
 const anniversary=window.GalaxyInsights?.anniversaryDay(start,today.slice(0,7));
 if(anniversary!==today)return null;
 const months=clock.years*12+clock.months;
 if(months<=0)return null;
 return {months,years:Math.floor(months/12)};
}
function anniversaryInsightsBanner(){
 const a=anniversaryInfo();if(!a)return'';
 const title=a.months%12===0?'Hoy cumplen '+a.years+' '+(a.years===1?'año':'años'):'Hoy cumplen '+a.months+' meses';
 return '<section class="anniversary-mode"><div class="anniversary-stars"></div><p class="eyebrow">UN DÍA DE USTEDES</p><h2>'+esc(title)+'</h2><p>El mes que acaba de pasar ya tiene su propia constelación de momentos.</p><button class="btn small" data-action="anniversary-open">'+ico('sparkles')+' Abrir nuestro aniversario</button></section>';
}
function anniversaryBanner(){return anniversaryInsightsBanner();}
function relationshipClockCard(){
 const start=cloud?.settings?.data?.startDate;if(!start)return'';
 const clock=window.GalaxyInsights?.relationshipClock(start,new Date().toISOString());if(!clock)return'';
 const pieces=[];
 if(clock.years)pieces.push(clock.years+' '+(clock.years===1?'año':'años'));
 if(clock.months)pieces.push(clock.months+' '+(clock.months===1?'mes':'meses'));
 pieces.push(clock.days+' '+(clock.days===1?'día':'días'));
 return '<section class="section"><div class="card relationship-clock"><span class="relationship-clock-icon">'+ico('clock')+'</span><div><p class="eyebrow">NUESTRO RELOJ</p><h3>'+esc(pieces.join(' · '))+'</h3><p>'+Number(clock.totalDays).toLocaleString('es-CO')+' días · '+Number(clock.totalHours).toLocaleString('es-CO')+' horas desde que empezó esta historia.</p></div></div></section>';
}
function livingMomentCard(){const m=livingMoment();return '<section class="section"><button class="card living-moment" data-action="'+m.action+'" '+(m.id?'data-id="'+m.id+'"':'')+'><span class="item-icon">'+ico(m.icon)+'</span><div><p class="eyebrow">'+esc(m.label)+'</p><h3>'+esc(m.title)+'</h3><p>'+esc(m.body)+'</p></div></button></section>';}
function surpriseNotes(){return items('note').filter(x=>x.data?.surprise);}
function surpriseUnlocked(i){const d=i.data||{};if(d.unlockType==='date')return !d.unlockDate||d.unlockDate<=cloud.today;if(d.unlockType==='place'){const own=(cloud.locations||[]).find(l=>l.person===cloud.person&&l.sharing);if(!own)return false;const km=(a,b,c,e)=>{const R=6371,p=Math.PI/180,da=(c-a)*p,dl=(e-b)*p,q=Math.sin(da/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(q));};return km(Number(own.latitude),Number(own.longitude),Number(d.latitude),Number(d.longitude))*1000<=Number(d.radius||150);}return true;}
function surpriseNotesView(){const list=surpriseNotes();return '<section class="section"><div class="section-head"><div><h2>Notas sorpresa</h2><p>Mensajes que aparecen en el momento o lugar elegido.</p></div><button class="btn small" data-action="surprise-note-new">+ Sorpresa</button></div><div class="stack">'+(list.length?list.map(i=>{const open=surpriseUnlocked(i),d=i.data||{};return '<div class="card"><span class="badge">'+(open?'Desbloqueada':'Guardada')+'</span><h3 style="margin-top:9px">'+esc(open?d.title:'Hay algo esperando para ti')+'</h3><p>'+esc(open?(d.body||''):(d.unlockType==='date'?'Se abrirá '+fmtDate(d.unlockDate):'Se abrirá al llegar al lugar elegido.'))+'</p>'+(open&&linkedVoices(i.id).length?linkedVoices(i.id).map(voiceCard).join(''):'')+(i.author===cloud.person?'<div class="item-actions"><button class="btn small secondary" data-action="voice-for-item" data-id="'+i.id+'">'+ico('mic')+' Añadir voz</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div>':'')+'</div>';}).join(''):'<div class="empty">Dejen una nota para una fecha o un lugar especial.</div>')+'</div></section>';}

function cloudRenderFingerprint(data=cloud){
 if(!data)return '';
 const compactItems=(data.items||[]).map(i=>[i.id,i.version,i.kind]).join('|');
 const compactBond=(data.bond?.entries||[]).map(i=>[i.id,i.version,i.type]).join('|');
 const compactDevices=(data.devices||[]).map(i=>[i.id,i.person,i.revoked_at||'',i.name||'']).join('|');
 return JSON.stringify({
   today:data.today,person:data.person,settings:data.settings?.version||0,nextEvent:data.nextEvent||null,
   items:compactItems,daily:data.daily||[],locations:data.locations||[],presence:data.presence||[],
   garden:data.bond?.garden||null,bond:compactBond,devices:compactDevices
 });
}
let renderQueued=false;
function scheduleRender(){
 if(renderQueued)return;
 renderQueued=true;
 requestAnimationFrame(()=>{renderQueued=false;if(!editingNow())render();});
}
async function refreshState({quiet=false}={}){
 if(!native.paired||refreshing)return;
 refreshing=true;
 try{cloud=await api('mobile-state');native=nativeState();await loadDateContext(false).catch(()=>{});if(!quiet)render();}
 catch(e){if(!quiet)toast(e.message);}
 finally{refreshing=false;}
}
async function refreshStateIfChanged(){
 const before=cloudRenderFingerprint();
 await refreshState({quiet:true});
 if(before!==cloudRenderFingerprint()&&view!=='map'&&!editingNow())scheduleRender();
}
async function refreshMap({quiet=false,detail=false}={}){
 if(!native.paired)return;
 try{
   const next=await api('map-state',{detail});
   mapData=detail||!mapData?next:{...mapData,...next,context:{...(mapData?.context||{}),...(next?.context||{})}};
   if(view==='map'&&!quiet)render();
   else if(view==='map'){drawMap({fit:false});updateCoupleDistanceDom();updateEtaDom();}
 }catch(e){if(!quiet)toast(e.message);}
}

async function refreshMapNow(){
 let gpsError='';
 if(native.tracking&&native.locationGranted){
  toast('Solicitando una ubicación GPS reciente…');
  try{await GalaxyNative.call('refreshLocation');}
  catch(e){gpsError=String(e?.message||e||'No pudimos actualizar tu GPS.');}
 }
 await refreshMap({quiet:true,detail:true});
 if(view==='map')render();
 const distance=coupleDistanceState();
 if(distance.available)toast('Ubicaciones actualizadas.');
 else if(distance.reason==='stale')toast(staleLocationCopy(distance));
 else if(gpsError)toast(gpsError);
 else if(!native.tracking)toast('Tu ubicación está pausada. Actívala para calcular distancia y ETA.');
 else toast('Mapa actualizado. Falta una ubicación reciente del otro teléfono.');
}
const mediaFresh=kind=>!!media[kind]&&Date.now()-(mediaLoadedAt[kind]||0)<20*60*1000;
async function loadMedia(kind,force=false){
 const fresh=mediaFresh(kind);
 if(fresh&&!force)return media[kind];
 const result=await api('media-list',{kind});
 media[kind]=result.items||[];
 mediaLoadedAt[kind]=Date.now();
 if(view==='memories')render();
 return media[kind];
}

async function loadGoals(force=false){
 if(!native.paired)return goalsState;
 if(!force&&goalsState&&Date.now()-goalsLoadedAt<3*60*1000)return goalsState;
 const result=await api('goals-engine',{operation:'list'});
 goalsState=result;goalsLoadedAt=Date.now();
 if(view==='goals')render();
 return result;
}
const goalById=id=>(goalsState?.goals||[]).find(goal=>String(goal.id)===String(id));
const moneyLabel=value=>'$ '+Math.max(0,Number(value)||0).toLocaleString('es-CO');
const goalCategoryLabel=value=>({travel:'Viaje',home:'En casa',learning:'Aprender',experience:'Experiencia',project:'Proyecto',wellbeing:'Bienestar',other:'Otro'})[value]||'Otro';
const goalStatusLabel=value=>({active:'Activo',paused:'En pausa',completed:'Completado',archived:'Archivado'})[value]||value;
async function refreshGoal(id){
 await loadGoals(true);
 const goal=goalById(id);if(goal)openGoalDetail(id);else{closeModal();render();}
}
function header(){
 const unread=Math.max(0,Number(cloud?.notifications?.unread||0));
 return '<header class="header"><div class="brand"><div class="brand-mark">'+ico('sparkles')+'</div><div><strong>Nuestra Galaxia</strong><small>'+esc(native.paired?(myName()+' & '+partnerName()):'Un espacio para dos')+'</small></div></div><div class="header-actions"><button class="header-search header-notifications '+(unread?'has-unread':'')+'" data-action="notifications-open" aria-label="Notificaciones">'+ico('bell')+(unread?'<span class="header-notification-badge">'+(unread>99?'99+':unread)+'</span>':'')+'</button><button class="header-search" data-action="universal-search-open" aria-label="Buscar en nuestra galaxia">'+ico('search')+'</button><div class="avatar">'+esc((native.paired?myName():'N').slice(0,1).toUpperCase())+'</div></div></header>';
}
function renderNav(){
 navEl.style.display=native.paired&&!shouldShowAdriWelcome()&&view!=='chat'?'grid':'none';
 navEl.innerHTML=nav.map(([id,label])=>'<button class="nav-btn '+(view===id?'active':'')+'" data-view="'+id+'">'+ico(icons[id],'nav-icon')+'<span>'+label+'</span></button>').join('');
}
function renderChatFab(){
 if(!chatFab)return;
 const enabled=!!(native.paired&&cloud?.capabilities?.chat&&!shouldShowAdriWelcome());
 const unread=Math.max(0,Number(cloud?.chat?.unread||0));
 chatFab.classList.toggle('hidden',!enabled||view==='chat');
 if(!enabled||view==='chat'){chatFab.innerHTML='';return;}
 chatFab.innerHTML=ico('message-circle')+(unread?'<span class="chat-fab-badge">'+(unread>99?'99+':unread)+'</span>':'');
 chatFab.classList.toggle('has-unread',unread>0);
}
function syncChatViewportHeight(){
 const height=Math.max(320,Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0));
 document.documentElement.style.setProperty('--chat-viewport-height',height+'px');
}
function go(next){
 const hadMap=!!mapData;
 view=next;syncChatViewportHeight();render();window.scrollTo(0,0);
 if(view==='map'&&hadMap)refreshMap({quiet:true,detail:false});
}
let nativeThemeSent='';
function syncSystemTheme(themeState){
 const active=themeState?.active||'daylight';
 if(nativeThemeSent===active)return;
 nativeThemeSent=active;
 GalaxyNative.call('setSystemTheme',active).catch(()=>{nativeThemeSent='';});
}
function render(){
 const currentMemoriesTabs=$('.memories-tabs');
 if(currentMemoriesTabs)memoriesTabsScroll=currentMemoriesTabs.scrollLeft;
 const themeState=window.GalaxyTheme?.applyTheme(window.GalaxyTheme.getChoice());
 syncSystemTheme(themeState);
 document.body.classList.toggle('chat-mode',native.paired&&view==='chat'&&!shouldShowAdriWelcome());
 renderNav();
 renderChatFab();
 if(!native.paired){renderOnboarding();refreshIcons();return;}
 if(shouldShowAdriWelcome()){globalPlayer.className='global-player';renderAdriWelcome();refreshIcons();return;}
 if(!cloud){app.innerHTML=header()+loading('Cargando nuestra galaxia');refreshIcons();refreshState();return;}
 if(!media.music&&!mediaLoadedAt.music)setTimeout(()=>loadMedia('music').then(renderGlobalPlayer).catch(()=>{}),0);
 if(view==='home')app.innerHTML=header()+homeView();
 if(view==='map'){app.innerHTML=header()+mapView();setTimeout(()=>{drawMap();if(!mapData)refreshMap({detail:true});if(!frequentPlacesFresh())loadFrequentPlaces().catch(()=>{});},0);}
 if(view==='moments')app.innerHTML=header()+momentsView();
 if(view==='memories'){app.innerHTML=header()+memoriesView();requestAnimationFrame(()=>{const tabs=$('.memories-tabs');if(tabs)tabs.scrollLeft=memoriesTabsScroll;});if((memoryTab==='album'&&!mediaFresh('photo'))||(memoryTab==='music'&&!mediaFresh('music')))setTimeout(()=>loadMedia(memoryTab==='album'?'photo':'music').catch(e=>toast(e.message)),0);}
 if(view==='goals'){app.innerHTML=header()+goalsView();if(!goalsState)setTimeout(()=>loadGoals().catch(e=>toast(e.message)),0);}
 if(view==='ai'){app.innerHTML=header()+intelligenceHubView();if(!mapData)setTimeout(()=>refreshMap({quiet:true,detail:true}).catch(()=>{}),0);}
 if(view==='chat'){syncChatViewportHeight();app.innerHTML=chatView();if(!chatState&&!chatLoading)setTimeout(()=>loadChat({quiet:true}),0);if(!chatPreferencesState)setTimeout(()=>loadChatPreferences(),0);}
 if(view==='more')app.innerHTML=header()+moreView();
 refreshIcons();
 if(view==='chat')globalPlayer.className='global-player';else renderGlobalPlayer();
 if(view==='home'&&!encounterStatsCache&&!encounterStatsLoading)setTimeout(()=>loadEncounterStats().catch(()=>{}),0);
 if(tourStep>=0)setTimeout(renderTourOverlay,30);
 if(pendingDeepLink&&cloud)setTimeout(()=>consumeDeepLink(),0);
}
function renderOnboarding(){
 app.innerHTML='<div class="onboarding"><div class="card"><div class="onboarding-logo">'+ico('sparkles')+'</div><p class="eyebrow">NUESTRA GALAXIA · ANDROID</p><h1>Todo lo nuestro, ahora en el teléfono.</h1><p>Vincula este dispositivo con el código generado en Ajustes de Nuestra Galaxia. El código solo sirve una vez y el token queda cifrado por Android.</p><form id="pairForm" class="stack" style="margin-top:22px"><div class="field"><label>Código de vinculación</label><input class="input" name="code" autocomplete="off" autocapitalize="characters" placeholder="Pega aquí el código" required></div><button class="btn" type="submit">Vincular este teléfono</button></form><p class="muted" style="font-size:11px;margin-top:16px">Versión '+esc(native.version||'')+'</p></div></div>';
}

function renderAdriWelcome(){
 if(welcomeGift){
  app.innerHTML='<section class="gift-intro"><div class="gift-ambient"></div><div class="gift-wrap"><div class="gift-box" data-action="gift-open"><div class="gift-lid"><i></i></div><div class="gift-body"><i></i></div><div class="gift-ribbon"></div></div><div class="gift-note">Para ti</div><p class="gift-hint">Toca el regalo</p></div></section>';
  return;
 }
 const scenes=[
  {icon:'sparkles',eyebrow:'HOLA, ADRI',title:'Hay algo que Sebas construyó pensando en ti.',copy:'No es solo una aplicación. Es un pequeño lugar para ustedes dos: para acompañarse, guardar lo vivido y seguir construyendo lo que viene.',visual:'stars'},
  {icon:'map-pin',eyebrow:'UN MISMO MAPA',title:'Aunque estén en lugares diferentes, aquí pueden encontrarse.',copy:'Sus ubicaciones, caminos y lugares importantes pueden vivir en un mismo mapa, siempre bajo el control de cada uno.',visual:'map'},
  {icon:'images',eyebrow:'LO QUE VALE LA PENA GUARDAR',title:'Recuerdos, canciones, planes y pequeñas historias.',copy:'Porque muchas veces lo más bonito no es el gran evento, sino esas cosas pequeñas que terminan significándolo todo.',visual:'memories'},
  {icon:'heart',eyebrow:'UN MENSAJE DE SEBAS',title:'Mi brujita, quería regalarte algo diferente.',copy:'No solamente algo que pudieras guardar, sino algo que pudiéramos seguir construyendo juntos. Aquí quiero que vivan nuestros recuerdos, nuestros lugares, nuestros caminos y todas esas pequeñas cosas que con el tiempo terminan significando muchísimo. Todo esto fue hecho pensando en ti.',visual:'letter'},
  {icon:'route',eyebrow:'ADRI + SEBAS',title:'Nuestra historia, en un solo lugar.',copy:'Esta aplicación no está terminada. Porque nuestra historia tampoco. Bienvenida, mi amor.',visual:'together'}
 ];
 const s=scenes[welcomeStep]||scenes[0],last=welcomeStep===scenes.length-1;
 const dots=scenes.map((_,i)=>'<i class="'+(i===welcomeStep?'active':'')+'"></i>').join('');
 let visual='';
 if(s.visual==='map')visual='<div class="welcome-map"><span class="welcome-pin one">'+ico('navigation')+'</span><span class="welcome-route"></span><span class="welcome-pin two">'+ico('map-pin')+'</span></div>';
 else if(s.visual==='memories')visual='<div class="welcome-orbit"><span>'+ico('images')+'</span><span>'+ico('music')+'</span><span>'+ico('calendar')+'</span><span>'+ico('star')+'</span></div>';
 else if(s.visual==='letter')visual='<div class="welcome-letter">'+ico('heart')+'<span>Para Adri</span></div>';
 else if(s.visual==='together')visual='<div class="welcome-together"><span>A</span><i></i><span>S</span></div>';
 else visual='<div class="welcome-constellation"><i></i><i></i><i></i><i></i><i></i></div>';
 app.innerHTML='<section class="welcome-experience" data-welcome-interactive><div class="welcome-curtain"></div><div class="welcome-stars" aria-hidden="true"></div><button class="welcome-skip" data-action="welcome-skip">Omitir</button><div class="welcome-stage" data-step="'+welcomeStep+'"><div class="welcome-visual"><div class="welcome-symbol">'+ico(s.icon)+'</div>'+visual+'</div><div class="welcome-copy"><p class="welcome-eyebrow">'+s.eyebrow+'</p><h1>'+s.title+'</h1><p>'+s.copy+'</p></div><div class="welcome-footer"><div class="welcome-dots" aria-label="Paso '+(welcomeStep+1)+' de '+scenes.length+'">'+dots+'</div><button class="welcome-next" data-action="welcome-next">'+(last?'Entrar a nuestra galaxia':'Continuar')+' '+ico(last?'sparkles':'arrow-right')+'</button></div></div></section>';
 const welcomeEl=document.querySelector('[data-welcome-interactive]');
 if(welcomeEl&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
  const move=e=>{const r=welcomeEl.getBoundingClientRect(),x=((e.clientX-r.left)/r.width-.5),y=((e.clientY-r.top)/r.height-.5);welcomeEl.style.setProperty('--wx',(50+x*24)+'%');welcomeEl.style.setProperty('--wy',(35+y*18)+'%');welcomeEl.style.setProperty('--px',(x*-10)+'px');welcomeEl.style.setProperty('--py',(y*-8)+'px');};
  welcomeEl.addEventListener('pointermove',move,{passive:true});
  welcomeEl.addEventListener('pointerdown',e=>{for(let i=0;i<7;i++){const p=document.createElement('i'),a=Math.random()*Math.PI*2,d=22+Math.random()*48;p.className='welcome-spark';p.style.left=e.clientX+'px';p.style.top=e.clientY+'px';p.style.setProperty('--sx',Math.cos(a)*d+'px');p.style.setProperty('--sy',Math.sin(a)*d+'px');welcomeEl.appendChild(p);setTimeout(()=>p.remove(),900);}});
 }
}

function renderTourOverlay(){
 document.querySelectorAll('.app-tour').forEach(x=>x.remove());
 document.querySelectorAll('.tour-focus').forEach(x=>x.classList.remove('tour-focus'));
 const steps=[
  {view:'home',sel:'.hero',title:'Este es su lugar',copy:'Aquí verás lo esencial de ustedes: días juntos, recuerdos y cómo están hoy.'},
  {view:'home',sel:'.mood-grid',title:'Cuéntense cómo están',copy:'Con un toque pueden compartir su estado del día y sentirse un poquito más cerca.'},
  {view:'map',sel:'[data-view="map"]',title:'Su mapa compartido',copy:'Aquí viven sus ubicaciones, recorridos, lugares importantes y la forma en que se están moviendo.'},
  {view:'moments',sel:'[data-view="moments"]',title:'Pequeños gestos',copy:'Abrazos, besos, juegos, notas y rituales para esos momentos en los que quieran decir algo sin decir demasiado.'},
  {view:'memories',sel:'[data-view="memories"]',title:'Todo lo que van guardando',copy:'Fotos, canciones, planes, notas, cápsulas, deseos y viajes tienen aquí su propio rincón.'},
  {view:'more',sel:'[data-view="more"]',title:'Y esto seguirá creciendo',copy:'Desde aquí están el widget, permisos, ajustes y las futuras actualizaciones de Nuestra Galaxia.'}
 ];
 const t=steps[tourStep];if(!t){tourStep=-1;welcomeMusic.pause();welcomeMusic.currentTime=0;render();return;}
 if(view!==t.view){view=t.view;render();return;}
 const target=document.querySelector(t.sel);if(target)target.classList.add('tour-focus');
 document.body.insertAdjacentHTML('beforeend','<div class="app-tour"><div class="tour-shade"></div><div class="tour-card"><p class="eyebrow">RECORRIDO '+(tourStep+1)+' / '+steps.length+'</p><h2>'+t.title+'</h2><p>'+t.copy+'</p><div class="row"><button class="btn ghost" data-action="tour-skip">Omitir recorrido</button><button class="btn" data-action="tour-next">'+(tourStep===steps.length-1?'Empezar':'Siguiente')+'</button></div></div></div>');
 refreshIcons();
}

function homeView(){
 const own=ownDaily(),partner=partnerDaily(),next=cloud.nextEvent,garden=cloud.bond?.garden||{days:0,stage:0};
 const locs=cloud.locations||[];
 return anniversaryInsightsBanner()+'<section class="hero"><p class="eyebrow">NUESTRO UNIVERSO</p><h1>'+esc(myName())+' & '+esc(partnerName())+'</h1><p>Un lugar para acompañarnos, guardar lo vivido y seguir construyendo lo que viene.</p><div class="hero-stats"><div class="hero-stat"><b>'+coupleDays()+'</b><small>días juntos</small></div><div class="hero-stat"><b>'+items('memory').length+'</b><small>recuerdos</small></div><div class="hero-stat"><b>'+garden.days+'</b><small>días del girasol</small></div></div></section>'+monthlySummaryTeaser()+todayHistoryTeaser()+coupleDistanceCard()+encounterStatsTeaser()+nowCard()+
 '<section class="section"><div class="section-head"><div><h2>¿Cómo estás hoy?</h2><p>Tu estado se comparte solo con tu persona.</p></div></div><div class="mood-grid">'+Object.entries(moods).map(([id,m])=>'<button class="mood '+(own.mood===id?'active':'')+'" data-action="mood" data-value="'+id+'"><span>'+ico(m[0])+'</span>'+m[1]+'</button>').join('')+'</div>'+(partner.mood?'<div class="card" style="margin-top:10px"><span class="badge">'+esc(partnerName())+'</span> <b>'+esc(moods[partner.mood]?.[1]||partner.mood)+'</b></div>':'')+'</section>'+
 dailyQuestionCard(own,partner)+
 '<section class="section"><div class="grid">'+
 actionCard('map-pin','Nuestro mapa','Ver dónde estamos y nuestros recorridos','map')+
 actionCard('heart','Enviar un gesto','Abrazo, beso o “te extraño”','moments')+
 actionCard('images','Guardar recuerdo','Algo que no queremos olvidar','add-memory')+
 actionCard('circle-check-big','Nuevo plan','Algo para hacer juntos','add-plan')+
 actionCard('target','Nuestros objetivos','Metas, pasos y ahorro manual','goals-open')+
 '</div></section>'+livingMomentCard()+
 (next?'<section class="section"><div class="card"><p class="eyebrow">PRÓXIMA FECHA</p><h3>'+esc(next.title)+'</h3><p>'+esc(fmtDate(next.date))+'</p></div></section>':'')+
 '<section class="section"><div class="section-head"><div><h2>Cerca, aunque estemos lejos</h2><p>Estado actual del mapa compartido.</p></div></div><div class="stack">'+locs.map(personCard).join('')+'</div></section>';
}
function actionCard(iconName,title,copy,action){return '<button class="action-card" data-action="'+action+'"><span class="icon">'+ico(iconName)+'</span><b>'+esc(title)+'</b><small>'+esc(copy)+'</small></button>';}
function insightsTeaser(){
 const today=String(cloud?.today||''),month=today.slice(0,7),year=today.slice(0,4);
 const card=(action,iconName,eyebrow,title,copy,key)=>'<button class="card insight-period-card" data-action="'+action+'" data-key="'+attr(key)+'"><span>'+ico(iconName)+'</span><span><p class="eyebrow">'+esc(eyebrow)+'</p><h3>'+esc(title)+'</h3><p>'+esc(copy)+'</p></span>'+ico('chevron-right')+'</button>';
 return '<section class="section insights-teaser"><div class="section-head"><div><h2>Nuestra historia, en datos</h2><p>Lo que vivimos, sin convertirlo en una competencia.</p></div></div><div class="insights-teaser-grid">'+
  card('insights-week-open','calendar','NUESTRA SEMANA','Esta semana','Encuentros, lugares, moods y caminos.',today)+
  card('insights-month-open','calendar-heart','NUESTRO MES',window.GalaxyMonthly?.monthLabel(month)||month,'Cómo se fue construyendo este mes.',month)+
  card('insights-year-open','sparkles','GALAXIA WRAPPED',year,'El año completo en una constelación.',year)+
 '</div></section>';
}
function monthlySummaryTeaser(){
 const month=String(cloud?.today||'').slice(0,7),label=window.GalaxyMonthly?.monthLabel(month)||'Nuestro mes';
 return '<section class="section"><button class="card monthly-teaser" data-action="insights-month-open" data-key="'+attr(month)+'"><span class="monthly-teaser-icon">'+ico('calendar-heart')+'</span><span><p class="eyebrow">NUESTRO MES</p><h3>'+esc(label)+'</h3><p>Recuerdos, planes, kilómetros, encuentros y pequeños gestos en un solo lugar.</p></span>'+ico('chevron-right')+'</button></section>';
}
function insightMetric(iconName,value,label,detail=''){
 return '<div class="insights-metric"><span>'+ico(iconName)+'</span><b>'+esc(value)+'</b><small>'+esc(label)+'</small>'+(detail?'<em>'+esc(detail)+'</em>':'')+'</div>';
}
function monthlyMetric(iconName,value,label,detail=''){return insightMetric(iconName,value,label,detail);}
function insightPeriodTitle(period){
 if(!period)return'Nuestra historia';
 if(period.kind==='week')return window.GalaxyInsights?.periodLabel('week',period.startDay,period.endDay)||'Nuestra semana';
 if(period.kind==='month')return window.GalaxyMonthly?.monthLabel(period.key)||period.key;
 if(period.kind==='year')return 'Galaxia Wrapped '+period.key;
 if(period.kind==='anniversary')return 'Nuestro aniversario';
 return 'Nuestra historia';
}
function insightPeriodNav(summary){
 const period=summary.period;if(!period||!['week','month','year'].includes(period.kind))return'';
 const prev=window.GalaxyInsights?.shiftPeriod(period,-1),next=window.GalaxyInsights?.shiftPeriod(period,1);
 return '<div class="insights-nav"><button class="btn small ghost" data-action="insights-period" data-kind="'+attr(period.kind)+'" data-key="'+attr(prev?.key||'')+'" aria-label="Periodo anterior">'+ico('chevron-left')+'</button><div><p class="eyebrow">'+esc(period.kind==='year'?'GALAXIA WRAPPED':period.kind==='week'?'NUESTRA SEMANA':'NUESTRO MES')+'</p><h2>'+esc(insightPeriodTitle(period))+'</h2></div><button class="btn small ghost" data-action="insights-period" data-kind="'+attr(period.kind)+'" data-key="'+attr(next?.key||'')+'" aria-label="Periodo siguiente" '+(next?'':'disabled')+'>'+ico('chevron-right')+'</button></div>';
}
function insightExtras(summary){
 const counts=summary.counts||{},bond=summary.bond||{},connection=summary.connection||{},rows=[];
 if(Number(counts.songs||0))rows.push('<span>'+ico('music')+Number(counts.songs||0)+' canciones</span>');
 if(Number(counts.events||0))rows.push('<span>'+ico('calendar-heart')+Number(counts.events||0)+' fechas especiales</span>');
 if(Number(counts.journeys||0))rows.push('<span>'+ico('route')+Number(counts.journeys||0)+' viajes guardados</span>');
 if(Number(bond.voices||0))rows.push('<span>'+ico('mic')+Number(bond.voices||0)+' mensajes de voz</span>');
 if(Number(connection.answer_days||0))rows.push('<span>'+ico('message-circle')+Number(connection.answer_days||0)+' preguntas respondidas por ambos</span>');
 if(Number(counts.notes||0))rows.push('<span>'+ico('file-text')+Number(counts.notes||0)+' notas</span>');
 if(Number(counts.wishesDone||0))rows.push('<span>'+ico('star')+Number(counts.wishesDone||0)+' deseos vividos</span>');
 if(Number(counts.goalsCompleted||0))rows.push('<span>'+ico('target')+Number(counts.goalsCompleted||0)+' objetivos completados</span>');
 if(Number(counts.savingsAchieved||0))rows.push('<span>'+ico('piggy-bank')+Number(counts.savingsAchieved||0)+' metas de ahorro logradas</span>');
 if(Number(summary.goals?.goal_contribution_amount||0))rows.push('<span>'+ico('coins')+moneyLabel(summary.goals.goal_contribution_amount)+' en aportes manuales</span>');
 return rows.length?'<div class="card insights-extra"><h3>También pasó</h3><div class="insight-extra-row">'+rows.join('')+'</div></div>':'';
}
function insightHighlights(summary){
 const rows=summary.highlights||[];if(!rows.length)return'';
 return '<div class="insights-highlights"><div class="section-head"><div><h3>Momentos para volver a mirar</h3><p>Recuerdos y eventos de este periodo.</p></div></div>'+rows.map(i=>'<button class="monthly-highlight" data-action="universal-search-result" data-type="item" data-id="'+attr(i.id)+'" data-kind="'+attr(i.kind)+'"><span>'+ico(kindMeta[i.kind]?.[0]||'sparkles')+'</span><span><b>'+esc(i.title||'Parte de nuestra historia')+'</b><small>'+esc(fmtDate(i.date))+'</small></span>'+ico('chevron-right')+'</button>').join('')+'</div>';
}
function insightPlaces(summary){
 const rows=summary.places?.visits||[];if(!rows.length)return'';
 return '<div class="card insights-places"><h3>Lugares de este periodo</h3><div class="insight-chip-row">'+rows.map(p=>'<span>'+ico('map-pin')+esc(p.name)+' · '+Number(p.count||0)+'</span>').join('')+'</div></div>';
}
function insightPhotos(summary){
 const rows=summary.photos||[];if(!rows.length)return'';
 return '<div class="insight-photos"><div class="section-head"><div><h3>Fotos cercanas a estos días</h3><p>Solo mostramos fotos con contexto temporal disponible.</p></div></div><div class="gallery">'+rows.slice(0,9).map(p=>'<figure class="photo"><img src="'+attr(p.url||'')+'" alt="'+attr(p.name||'Foto de nuestra historia')+'"></figure>').join('')+'</div></div>';
}
function moodName(value){return moods[value]?.[1]||value||'Sin registrar';}
function emotionalHeatmap(summary){
 const period=summary.period,calendar=summary.moods?.calendar||[];if(!period||!['month','week'].includes(period.kind))return'';
 const byDay=new Map(calendar.map(row=>[row.day,row])),cells=[];let day=period.startDay;
 const stop=period.current&&cloud?.today&&cloud.today<period.endDay?window.GalaxyInsights.addDays(cloud.today,1):period.endDay;
 while(day&&day<stop){
  const row=byDay.get(day),people=new Map((row?.people||[]).map(p=>[String(p.person),p]));
  const one=people.get('0'),two=people.get('1');
  const label=fmtDate(day)+': '+esc(names()[0]||'Persona 1')+' '+moodName(one?.mood)+', '+esc(names()[1]||'Persona 2')+' '+moodName(two?.mood);
  cells.push('<div class="emotion-day" aria-label="'+attr(label)+'"><time>'+Number(day.slice(8))+'</time><span class="emotion-person" data-mood="'+attr(one?.mood||'none')+'" title="'+attr((names()[0]||'Persona 1')+': '+moodName(one?.mood))+'">'+ico(moods[one?.mood]?.[0]||'minus')+'</span><span class="emotion-person" data-mood="'+attr(two?.mood||'none')+'" title="'+attr((names()[1]||'Persona 2')+': '+moodName(two?.mood))+'">'+ico(moods[two?.mood]?.[0]||'minus')+'</span></div>');
  day=window.GalaxyInsights.addDays(day,1);
 }
 const connection=summary.connection||{};
 return '<section class="insights-emotions"><div class="section-head"><div><h3>Calendario emocional</h3><p>Un registro descriptivo de cómo se sintió cada uno.</p></div></div><div class="emotion-legend" aria-label="Leyenda del calendario"><span><i></i>'+esc(names()[0]||'Persona 1')+'</span><span><i></i>'+esc(names()[1]||'Persona 2')+'</span></div><div class="emotion-heatmap">'+cells.join('')+'</div><p class="muted">'+Number(connection.exact_mood_days||0)+' coincidencias exactas · '+Number(connection.compatible_mood_days||0)+' días con estados compatibles.</p></section>';
}
function emotionalTrends(summary){
 const cmp=summary.comparison;if(!cmp)return'';
 const d=cmp.deltas||{},phrases=[];
 if(Number(d.mood_days)>0)phrases.push('Registraron mood juntos en '+Math.abs(Number(d.mood_days))+' días más que en el periodo comparable.');
 else if(Number(d.mood_days)<0)phrases.push('Hubo '+Math.abs(Number(d.mood_days))+' días menos con mood de ambos que en el periodo comparable.');
 if(Number(d.answer_days)>0)phrases.push('Respondieron juntos '+Math.abs(Number(d.answer_days))+' preguntas más.');
 if(Number(d.compatible_mood_days)>0)phrases.push('Coincidieron en estados compatibles '+Math.abs(Number(d.compatible_mood_days))+' días más.');
 const current=summary.moods?.distribution||{},previous=cmp.moods?.distribution||{};
 const moodTotals=(source,key)=>Number(source?.['0']?.[key]||0)+Number(source?.['1']?.[key]||0);
 for(const key of Object.keys(moods)){
  const delta=moodTotals(current,key)-moodTotals(previous,key);
  if(delta>=2){phrases.push('Este periodo registraron '+moodName(key).toLowerCase()+' más veces que en el anterior.');break;}
 }
 if(!phrases.length)return'';
 return '<div class="card insight-trends"><h3>Tendencias del periodo</h3><p class="muted">Comparaciones descriptivas; no son una evaluación de la relación.</p><ul>'+phrases.slice(0,3).map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul></div>';
}
function achievementGrid(summary){
 const achievements=summary.achievements||[];if(!achievements.length)return'';
 const sorted=achievements.slice().sort((a,b)=>Number(b.unlocked)-Number(a.unlocked)||Number(b.progress)-Number(a.progress));
 return '<section class="insights-achievements"><div class="section-head"><div><h3>Logros de nuestra galaxia</h3><p>Se calculan desde la historia existente; no crean datos paralelos.</p></div></div><div class="achievement-grid">'+sorted.map(a=>'<article class="achievement-card '+(a.unlocked?'unlocked':'')+'"><span>'+ico(a.icon||'award')+'</span><div><b>'+esc(a.title)+'</b><p>'+esc(a.description||'')+'</p><div class="achievement-progress" aria-label="'+Math.round(Number(a.progress||0)*100)+'%"><i style="width:'+Math.round(Number(a.progress||0)*100)+'%"></i></div></div></article>').join('')+'</div></section>';
}
function wrappedCards(summary){
 if(summary.period?.kind!=='year')return'';
 const entries=Object.entries(summary.series||{}),score=row=>Number(row.memories||0)+Number(row.plansDone||0)+Number(row.events||0)+Number(row.songs||0)+Number(row.mood_days||0);
 const active=entries.slice().sort((a,b)=>score(b[1])-score(a[1]))[0];
 const monthName=active?window.GalaxyMonthly?.monthLabel(active[0]):'';
 const places=(summary.places?.visits||[]).length;
 return '<div class="wrapped-deck" aria-label="Galaxia Wrapped">'+
  '<article class="wrapped-card"><p class="eyebrow">GALAXIA WRAPPED</p><h2>'+Number(summary.counts?.memories||0)+' recuerdos</h2><p>Los momentos que decidieron guardar este año.</p></article>'+
  '<article class="wrapped-card"><p class="eyebrow">CAMINOS</p><h2>'+esc(fmtDistance(Number(summary.trips?.distance_m||0)))+'</h2><p>'+Number(summary.trips?.count||0)+' recorridos registrados.</p></article>'+
  '<article class="wrapped-card"><p class="eyebrow">TIEMPO JUNTOS</p><h2>'+esc(fmtDuration(Number(summary.encounters?.together_seconds||0)))+'</h2><p>'+Number(summary.encounters?.count||0)+' encuentros detectados.</p></article>'+
  '<article class="wrapped-card"><p class="eyebrow">NUESTRA MÚSICA</p><h2>'+Number(summary.counts?.songs||0)+' canciones</h2><p>Las canciones que quedaron guardadas en su historia.</p></article>'+
  '<article class="wrapped-card"><p class="eyebrow">CÓMO ESTUVIMOS</p><h2>'+Number(summary.connection?.mood_days||0)+' días con mood</h2><p>'+Number(summary.questions?.answered_together_days||0)+' preguntas respondidas por ambos.</p></article>'+
  '<article class="wrapped-card"><p class="eyebrow">PEQUEÑOS GESTOS</p><h2>'+Number(summary.bond?.gestures||0)+' gestos</h2><p>Momentos rápidos para decir “estoy aquí”.</p></article>'+
  '<article class="wrapped-card"><p class="eyebrow">LUGARES Y VIAJES</p><h2>'+places+' lugares</h2><p>'+Number(summary.counts?.journeys||0)+' viajes guardados dentro de la galaxia.</p></article>'+
  '<article class="wrapped-card"><p class="eyebrow">OBJETIVOS COMPARTIDOS</p><h2>'+Number(summary.counts?.goalsCompleted||0)+' logrados</h2><p>'+Number(summary.goals?.active_progress_pct||0)+'% de progreso promedio en los objetivos activos.</p></article>'+
  (active?'<article class="wrapped-card"><p class="eyebrow">MES CON MÁS HISTORIA</p><h2>'+esc(monthName||active[0])+'</h2><p>El mes con más actividad guardada dentro de Nuestra Galaxia.</p></article>':'')+
 '</div>';
}
function comparisonMarkup(summary){
 const d=summary.comparison?.deltas;if(!d)return'';
 const rows=[];
 const add=(value,up,down)=>{if(Number(value)>0)rows.push(up.replace('{n}',Math.abs(Number(value))));else if(Number(value)<0)rows.push(down.replace('{n}',Math.abs(Number(value))));};
 add(d.memories,'{n} recuerdos más que en el periodo comparable.','{n} recuerdos menos que en el periodo comparable.');
 add(d.distance_m,'Más kilómetros registrados que en el periodo comparable.','Menos kilómetros registrados que en el periodo comparable.');
 add(d.together_seconds,'Más tiempo de encuentro registrado.','Menos tiempo de encuentro registrado.');
 return rows.length?'<div class="card insight-comparison"><h3>Frente al periodo anterior</h3><ul>'+rows.slice(0,3).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul></div>':'';
}
function insightsSummaryMarkup(summary){
 const counts=summary.counts||{},trips=summary.trips||{},encounters=summary.encounters||{},connection=summary.connection||{},bond=summary.bond||{},has=Number(counts.saved||0)+Number(trips.count||0)+Number(encounters.count||0)+Number(bond.gestures||0)+Number(bond.voices||0)+Number(counts.goalsCompleted||0)+Number(counts.savingsAchieved||0)+Number(summary.goals?.goal_contribution_amount||0)>0;
 return '<div class="insights-summary">'+insightPeriodNav(summary)+wrappedCards(summary)+
 (has?'<div class="insights-hero"><span>'+ico('sparkles')+'</span><div><b>'+Number(counts.saved||0)+' momentos guardados</b><p>Una lectura del periodo construida con su propia historia.</p></div></div>'+
 '<div class="insights-metrics">'+
 insightMetric('images',counts.memories||0,'recuerdos')+
 insightMetric('circle-check-big',counts.plansDone||0,'planes vividos')+
 insightMetric('route',fmtDistance(Number(trips.distance_m||0)),'recorridos',Number(trips.count||0)+' rutas')+
 insightMetric('heart-handshake',encounters.count||0,'encuentros',fmtDuration(Number(encounters.together_seconds||0))+' juntos')+
 insightMetric('smile',connection.mood_days||0,'días con mood de ambos',Number(connection.answer_days||0)+' preguntas de ambos')+
 insightMetric('hand-heart',bond.gestures||0,'gestos')+
 '</div>'+insightExtras(summary)+comparisonMarkup(summary)+insightPlaces(summary)+emotionalHeatmap(summary)+emotionalTrends(summary)+insightPhotos(summary)+insightHighlights(summary)+achievementGrid(summary)
 :'<div class="universal-search-empty">'+ico('moon-star')+'<h3>Este periodo todavía está escribiéndose</h3><p>Cuando existan recuerdos, recorridos, encuentros o gestos, aparecerán aquí.</p></div>'+achievementGrid(summary))+
 '</div>';
}
function monthlySummaryMarkup(summary){return insightsSummaryMarkup(summary);}
function defaultInsightKey(kind){
 const day=String(cloud?.today||'');
 return kind==='week'?day:kind==='month'?day.slice(0,7):kind==='year'?day.slice(0,4):'';
}
async function openInsights(kind,key=defaultInsightKey(kind)){
 const cacheKey=kind+':'+String(key||''),cached=insightsCache.get(cacheKey),title=kind==='year'?'Galaxia Wrapped':kind==='week'?'Nuestra semana':kind==='anniversary'?'Nuestro aniversario':'Nuestro mes';
 showModal(title,cached?insightsSummaryMarkup(cached):'<div class="monthly-loading">'+loading('Preparando nuestra historia')+'<p>Reuniendo recuerdos, caminos y momentos…</p></div>');
 if(cached)return;
 try{
  const summary=await api('insights-summary',{kind,key});
  insightsCache.set(cacheKey,summary);
  if(kind==='month')monthlyCache.set(String(key),summary);
  if(modal.open)showModal(title,insightsSummaryMarkup(summary));
 }catch(error){if(modal.open)showModal(title,'<div class="universal-search-empty">'+ico('circle-alert')+'<h3>No pudimos preparar este periodo</h3><p>'+esc(error.message||'Intenta nuevamente.')+'</p></div>');}
}
async function openMonthlySummary(month=String(cloud?.today||'').slice(0,7)){return openInsights('month',month);}

function todayHistoryTeaser(){
 const day=String(cloud?.today||''),matches=(cloud?.items||[]).filter(i=>{
  const d=String(i.data?.date||i.data?.unlockDate||'');
  return d&&d<day&&d.slice(5)===day.slice(5);
 }).length;
 const label=window.GalaxyTodayHistory?.dayLabel(day)||'Hoy';
 return '<section class="section"><button class="card today-history-teaser" data-action="today-history-open"><span class="today-history-icon">'+ico('history')+'</span><span><p class="eyebrow">UN DÍA COMO HOY</p><h3>'+esc(matches?matches+' '+(matches===1?'recuerdo vuelve':'recuerdos vuelven')+' hoy':'¿Qué pasó un día como hoy?')+'</h3><p>'+esc(matches?'Abre la historia completa de otros '+label.toLowerCase()+'.':'Cuando esta fecha tenga historia, podrás volver a vivirla aquí.')+'</p></span>'+ico('chevron-right')+'</button></section>';
}
function todayHistoryChip(iconName,textValue){
 return '<span class="today-history-chip">'+ico(iconName)+esc(textValue)+'</span>';
}
function todayHistoryMarkup(result){
 const day=result.day,label=window.GalaxyTodayHistory?.dayLabel(day)||day,groups=(result.groups||[]).filter(g=>window.GalaxyTodayHistory?.groupHasActivity(g));
 if(!groups.length)return '<div class="today-history-view"><div class="today-history-head"><span>'+ico('history')+'</span><div><p class="eyebrow">UN DÍA COMO HOY</p><h2>'+esc(label)+'</h2></div><button class="btn small ghost" data-action="today-history-refresh" aria-label="Actualizar">'+ico('refresh-cw')+'</button></div><div class="universal-search-empty">'+ico('moon-star')+'<h3>Esta fecha todavía no tiene pasado</h3><p>Con el tiempo, todo lo que vivan un '+esc(label.toLowerCase())+' volverá a aparecer aquí.</p><button class="btn small" data-action="add-memory">Guardar algo de hoy</button></div></div>';
 const years=groups.map(g=>{
  const s=g.stats||{},age=window.GalaxyTodayHistory?.anniversaryLabel(g.year,day)||g.year,km=(Number(s.distance_m||0)/1000).toFixed(Number(s.distance_m||0)>=10000?0:1),chips=[];
  if(g.items?.length)chips.push(todayHistoryChip('images',g.items.length+' '+(g.items.length===1?'historia':'historias')));
  if(s.trips)chips.push(todayHistoryChip('route',s.trips+' '+(s.trips===1?'recorrido':'recorridos')+' · '+km+' km'));
  if(s.encounters)chips.push(todayHistoryChip('heart-handshake',s.encounters+' '+(s.encounters===1?'encuentro':'encuentros')+' · '+fmtDuration(Number(s.together_seconds||0))));
  if(s.gestures)chips.push(todayHistoryChip('hand-heart',s.gestures+' '+(s.gestures===1?'gesto':'gestos')));
  if(s.voices)chips.push(todayHistoryChip('mic',s.voices+' '+(s.voices===1?'audio':'audios')));
  if(s.shared_notes)chips.push(todayHistoryChip('file-text',s.shared_notes+' '+(s.shared_notes===1?'nota':'notas')));
  if(s.rituals)chips.push(todayHistoryChip('sparkles',s.rituals+' '+(s.rituals===1?'ritual':'rituales')));
  if(s.arrivals)chips.push(todayHistoryChip('map-pin',s.arrivals+' '+(s.arrivals===1?'llegada':'llegadas')));
  if(s.mood_together)chips.push(todayHistoryChip('smile','Ambos compartieron cómo estaban'));
  if(s.answer_together)chips.push(todayHistoryChip('message-circle','Ambos respondieron la pregunta'));
  const itemRows=(g.items||[]).map(i=>{
   todayHistoryItems.set(String(i.id),i);
   const meta=kindMeta[i.kind]||['sparkles','Historia'],when=i.origin==='saved'?'Guardado en la galaxia':meta[1];
   return '<button class="today-history-item" data-action="today-history-item" data-id="'+attr(i.id)+'"><span class="today-history-item-icon">'+ico(meta[0])+'</span><span><b>'+esc(i.title||meta[1])+'</b><small>'+esc(when+(i.placeName?' · '+i.placeName:''))+'</small></span>'+ico('chevron-right')+'</button>';
  }).join('');
  const places=(g.places||[]).length?'<div class="today-history-places">'+ico('map-pin')+'<span>'+esc((g.places||[]).join(' · '))+'</span></div>':'';
  return '<section class="today-history-year"><div class="today-history-year-head"><div><strong>'+esc(g.year)+'</strong><span>'+esc(age)+'</span></div><span class="today-history-year-line"></span></div>'+(chips.length?'<div class="today-history-chips">'+chips.join('')+'</div>':'')+places+(itemRows?'<div class="today-history-items">'+itemRows+'</div>':'')+'</section>';
 }).join('');
 return '<div class="today-history-view"><div class="today-history-head"><span>'+ico('history')+'</span><div><p class="eyebrow">UN DÍA COMO HOY</p><h2>'+esc(label)+'</h2><p>'+groups.length+' '+(groups.length===1?'año volvió':'años volvieron')+' a encontrarlos.</p></div><button class="btn small ghost" data-action="today-history-refresh" aria-label="Actualizar">'+ico('refresh-cw')+'</button></div>'+years+'</div>';
}
async function openTodayHistory(force=false){
 const day=String(cloud?.today||'');if(!window.GalaxyTodayHistory?.validDay(day))return;
 const cached=!force&&todayHistoryCache.get(day);
 showModal('Un día como hoy',cached?todayHistoryMarkup(cached):'<div class="monthly-loading">'+loading('Buscando en nuestra historia')+'<p>Volviendo a otros '+esc((window.GalaxyTodayHistory?.dayLabel(day)||day).toLowerCase())+'…</p></div>');
 if(cached)return;
 try{
  const result=await api('today-history',{day});
  todayHistoryCache.set(day,result);todayHistoryItems.clear();
  if(modal.open)showModal('Un día como hoy',todayHistoryMarkup(result));
 }catch(error){if(modal.open)showModal('Un día como hoy','<div class="universal-search-empty">'+ico('circle-alert')+'<h3>No pudimos volver a esta fecha</h3><p>'+esc(error.message||'Intenta nuevamente.')+'</p></div>');}
}
async function openTodayHistoryItem(btn){
 const id=String(btn.dataset.id||''),live=cloud?.items?.find(i=>String(i.id)===id);
 if(live){await openUniversalSearchResult({dataset:{type:'item',id}});return;}
 const item=todayHistoryItems.get(id);if(!item)return;
 const meta=kindMeta[item.kind]||['sparkles','Historia'];
 showModal(item.title||meta[1],'<div class="card today-history-detail"><span class="badge">'+esc(meta[1])+'</span><p class="muted" style="margin-top:8px">'+esc(fmtDate(item.date))+(item.placeName?' · '+esc(item.placeName):'')+'</p>'+(item.body?'<p style="margin-top:14px">'+esc(item.body)+'</p>':'')+(item.category?'<p class="muted" style="margin-top:10px">'+esc(item.category)+'</p>':'')+'</div>');
}

function coupleDistanceLocations(){
 const rows=mapData?.locations?.length?mapData.locations:(cloud?.locations||[]);
 return rows;
}
function locationAgeMs(location){const t=Date.parse(location?.updated_at||'');return Number.isFinite(t)?Math.max(0,Date.now()-t):Infinity;}
function locationFreshState(location,freshMs=10*60*1000){
 return !!location?.sharing&&Number.isFinite(Number(location?.latitude))&&Number.isFinite(Number(location?.longitude))&&locationAgeMs(location)<=freshMs;
}
function ageDurationLabel(age){
 const ms=Math.max(0,Number(age)||0),min=Math.floor(ms/60000);
 if(min<1)return'menos de 1 min';
 if(min<60)return min+' min';
 const h=Math.floor(min/60),rest=min%60;
 return h+' h'+(rest?' '+rest+' min':'');
}
function distanceAgeLabel(value){
 const age=Math.max(0,Date.now()-Date.parse(value||''));
 if(!Number.isFinite(age))return'';
 return'Actualizado hace '+ageDurationLabel(age);
}
function staleLocationCopy(state){
 const ages=Array.isArray(state?.ages)?state.ages:[],labels=names(),stale=[];
 for(let i=0;i<2;i++)if(Number(ages[i])>10*60*1000)stale.push((labels[i]||('Persona '+(i+1)))+' · hace '+ageDurationLabel(ages[i]));
 return stale.length?'Falta una ubicación reciente: '+stale.join(' / ')+'. Cada teléfono debe enviar su propio GPS.':'Falta una ubicación reciente de uno de los teléfonos.';
}
function coupleDistanceState(){
 return window.GalaxyDistance?.coupleDistance(coupleDistanceLocations())||{available:false,reason:'missing'};
}
function coupleDistanceCard({mapMode=false}={}){
 const state=coupleDistanceState(),title='Distancia entre '+myName()+' y '+partnerName();
 if(!state.available){
   const stale=state.reason==='stale',copy=stale?staleLocationCopy(state):'Ambos deben compartir una ubicación reciente para calcular la distancia.';
   return '<section class="section"><div class="card couple-distance unavailable" id="coupleDistanceCard"><span class="couple-distance-icon">'+ico(stale?'refresh-cw':'map-pin')+'</span><div><p class="eyebrow">'+esc(title.toUpperCase())+'</p><h3>'+(stale?'Esperando una ubicación reciente':'Distancia no disponible')+'</h3><p>'+esc(copy)+'</p></div>'+(mapMode?'<button class="btn small ghost" data-action="map-refresh">'+ico('refresh-cw')+' Actualizar GPS</button>':'<button class="btn small ghost" data-action="couple-distance-map">'+ico('map-pin')+' Abrir mapa</button>')+'</div></section>';
 }
 const mood=state.mood||{},distance=window.GalaxyDistance.formatDistance(state.meters),together=mood.key==='together';
 return '<section class="section"><div class="card couple-distance '+(together?'together':'')+'" id="coupleDistanceCard"><span class="couple-distance-icon">'+ico(together?'heart-handshake':'navigation')+'</span><div class="couple-distance-main"><p class="eyebrow">'+esc(title.toUpperCase())+'</p><div class="couple-distance-value"><strong>'+esc(distance)+'</strong><span>'+esc(mood.title||'')+'</span></div><p>'+esc(mood.copy||'')+'</p><small>'+esc(distanceAgeLabel(state.updated_at))+' · distancia en línea recta</small></div>'+(mapMode?'<button class="btn small secondary" data-action="couple-distance-focus">'+ico('navigation')+' Ver ambos</button>':'<button class="btn small ghost" data-action="couple-distance-map">'+ico('map-pin')+' Ver mapa</button>')+'</div></section>';
}
function updateCoupleDistanceDom(){
 const current=document.querySelector('#coupleDistanceCard');if(!current)return;
 const wrapper=document.createElement('div');wrapper.innerHTML=coupleDistanceCard({mapMode:view==='map'});
 const next=wrapper.querySelector('#coupleDistanceCard');if(next)current.replaceWith(next);
 refreshIcons();
}
function focusCoupleOnMap(){
 const rows=coupleDistanceLocations().filter(l=>l.sharing&&Number.isFinite(Number(l.latitude))&&Number.isFinite(Number(l.longitude)));
 if(!map||rows.length<2)return;
 map.fitBounds(rows.map(l=>[Number(l.latitude),Number(l.longitude)]),{maxZoom:16});
}

function etaData(){
 return {locations:mapData?.locations||cloud?.locations||[],places:mapData?.places||[],destinations:mapData?.destinations||[]};
}
function etaState(){return window.GalaxyEta?.eta(etaData(),String(cloud?.person??''))||{available:false,reason:'engine'};}
function etaUnavailableCopy(reason,e={}){
 if(reason==='none')return {title:'Elige un destino',copy:'ETA significa tiempo estimado de llegada. Toca Acompáñame y elige a '+partnerName()+' o un lugar guardado.'};
 if(reason==='own-paused')return {title:'Activa tu ubicación',copy:'El ETA calcula cuánto tardarías tú en llegar al destino, así que necesita tu GPS activo.'};
 if(reason==='own-stale')return {title:'Esperando tu ubicación',copy:'Tu teléfono no ha enviado una posición reciente. Actualizar GPS pedirá una nueva lectura a Android.'};
 if(reason==='target-paused')return {title:partnerName()+' pausó su ubicación',copy:'Si el destino es '+partnerName()+', su teléfono también debe compartir ubicación.'};
 if(reason==='target-stale')return {title:'Esperando a '+partnerName(),copy:'Su teléfono no ha enviado una posición reciente'+(e.target?.updated_at?' desde hace '+ageDurationLabel(locationAgeMs(e.target)):'')+'. Tú no puedes actualizar su GPS desde este teléfono.'};
 if(reason==='place-missing')return {title:'Ese lugar ya no está disponible',copy:'Elige otro destino desde Acompáñame.'};
 return {title:'ETA no disponible',copy:'El ETA estima tu tiempo de llegada usando distancia, movimiento y velocidad. Actualiza el GPS o cambia el destino.'};
}
function etaCard(){
 const e=etaState();
 if(!e.available){
  const message=etaUnavailableCopy(e.reason,e),hasDestination=e.reason!=='none',ownProblem=e.reason==='own-stale'||e.reason==='own-paused';
  return '<section class="section"><div class="card eta-card unavailable" id="etaCard"><span class="eta-icon">'+ico('timer')+'</span><div><p class="eyebrow">TIEMPO ESTIMADO DE LLEGADA · ETA</p><h3>'+esc(message.title)+'</h3><p>'+esc(message.copy)+'</p></div><button class="btn small '+(hasDestination?'ghost':'secondary')+'" data-action="'+(hasDestination?'map-refresh':'destination')+'">'+ico(hasDestination?'refresh-cw':'navigation')+' '+(hasDestination?(ownProblem?'Actualizar mi GPS':'Revisar de nuevo'):'Acompáñame')+'</button></div></section>';
 }
 const modeIcon=e.mode==='walking'?'person-standing':e.mode==='motorcycle'?'bike':e.mode==='transit'?'bus-front':'navigation';
 const distance=window.GalaxyDistance?.formatDistance(e.meters)||fmtDistance(e.meters),eta=window.GalaxyEta.etaLabel(e.seconds);
 const source=e.speed_source==='live'?'con tu velocidad actual':'con ritmo estimado';
 const targetNote=e.target_moving?' · el destino también está en movimiento':'';
 return '<section class="section"><div class="card eta-card '+(e.arrived?'arrived':'')+'" id="etaCard"><span class="eta-icon">'+ico(e.arrived?'map-pin-check':modeIcon)+'</span><div class="eta-main"><p class="eyebrow">ETA HACIA '+esc(String(e.label||'DESTINO').toUpperCase())+'</p><div class="eta-value"><strong>'+esc(eta)+'</strong><span>'+esc(distance)+'</span></div><p>'+esc(e.arrived?'Ya estás en el destino.':'Llegarías aproximadamente '+e.mode_label+', '+source+'.')+'</p><small>ETA = tiempo estimado de llegada. Se calcula con distancia geográfica, tu modo de movimiento y velocidad'+esc(targetNote)+'. No reemplaza navegación vial.</small></div><div class="eta-actions">'+(contextSession()?.id?'<button class="btn small secondary" data-action="galaxy-share" data-card-type="ETA" data-kind="context_session" data-id="'+attr(contextSession().id)+'" data-title="'+attr(contextSession().label||'Acompáñame')+'">'+ico('send')+' Chat</button>':'')+'<button class="btn small secondary" data-action="eta-focus">'+ico('crosshair')+' Ver ambos</button><button class="btn small ghost" data-action="destination">'+ico('shuffle')+' Cambiar destino</button></div></div></section>';
}
function updateEtaDom(){
 const current=document.querySelector('#etaCard');if(!current)return;
 const wrapper=document.createElement('div');wrapper.innerHTML=etaCard();
 const next=wrapper.querySelector('#etaCard');if(next)current.replaceWith(next);
 refreshIcons();
}
function focusEtaOnMap(){
 const e=etaState();if(!e.available||!map)return;
 const own=e.own;
 map.fitBounds([[Number(own.latitude),Number(own.longitude)],[Number(e.latitude),Number(e.longitude)]],{maxZoom:16});
}

function encounterStatsTeaser(){
 const s=encounterStatsCache;
 if(!s)return '<section class="section"><button class="card encounter-teaser" data-action="encounter-stats-open"><span class="encounter-teaser-icon">'+ico('heart-handshake')+'</span><span><p class="eyebrow">NUESTROS ENCUENTROS</p><h3>Construyendo el contador…</h3><p>Veces que hemos coincidido y tiempo compartido.</p></span>'+ico('chevron-right')+'</button></section>';
 const total=window.GalaxyEncounters?.totalWithActive(s)||Number(s.total_seconds||0),count=Number(s.total_count||0),active=s.active;
 const title=active?'Juntos ahora · '+(window.GalaxyEncounters?.durationLabel(window.GalaxyEncounters.activeElapsed(active))||fmtDuration(active.elapsed_seconds)):count?(window.GalaxyEncounters?.countLabel(count)||count+' encuentros'):'El primer encuentro todavía espera';
 const copy=count?(window.GalaxyEncounters?.durationLabel(total)||fmtDuration(total))+' compartidos · '+Number(s.current_month?.count||0)+' este mes':'Cuando estén cerca durante un rato, la galaxia empezará a contarlo.';
 return '<section class="section"><button class="card encounter-teaser '+(active?'active':'')+'" data-action="encounter-stats-open"><span class="encounter-teaser-icon">'+ico(active?'heart-pulse':'heart-handshake')+'</span><span><p class="eyebrow">NUESTROS ENCUENTROS</p><h3>'+esc(title)+'</h3><p>'+esc(copy)+'</p></span>'+ico('chevron-right')+'</button></section>';
}
async function loadEncounterStats(force=false){
 if(encounterStatsLoading)return encounterStatsCache;
 if(encounterStatsCache&&!force)return encounterStatsCache;
 encounterStatsLoading=true;
 try{
  encounterStatsCache=await api('encounter-stats');
  if(view==='home'&&!modal.open)render();
  return encounterStatsCache;
 }finally{encounterStatsLoading=false;}
}
function encounterStatsMarkup(s){
 const helper=window.GalaxyEncounters,total=helper?.totalWithActive(s)||Number(s.total_seconds||0),month=s.current_month||{},active=s.active,recent=s.recent||[];
 const duration=v=>helper?.durationLabel(v)||fmtDuration(v),count=Number(s.total_count||0),avg=Number(s.average_seconds||0),longest=Number(s.longest?.duration_seconds||0);
 const activeBlock=active?'<div class="encounter-live"><span>'+ico('heart-pulse')+'</span><div><p class="eyebrow">JUNTOS AHORA</p><h3 data-encounter-live>'+esc(duration(helper?.activeElapsed(active)||active.elapsed_seconds||0))+'</h3><p>'+(Number.isFinite(Number(active.current_distance_m))?'Aproximadamente '+Math.round(Number(active.current_distance_m))+' m entre ustedes.':'El encuentro sigue activo.')+'</p></div></div>':'';
 const recentRows=recent.map(r=>'<div class="encounter-recent '+(r.active?'active':'')+'"><span>'+ico(r.active?'heart-pulse':'heart')+'</span><div><b>'+esc(r.active?'Ahora mismo':fmtDateTime(r.started_at))+'</b><small>'+esc(duration(r.active?(helper?.activeElapsed(r)||r.duration_seconds):r.duration_seconds))+(Number.isFinite(Number(r.distance_m))?' · inicio a '+Math.round(Number(r.distance_m))+' m':'')+'</small></div></div>').join('');
 return '<div class="encounter-stats">'+activeBlock+
 '<div class="encounter-metrics">'+
 '<div><span>'+ico('heart-handshake')+'</span><b>'+count+'</b><small>encuentros</small></div>'+
 '<div><span>'+ico('clock-3')+'</span><b>'+esc(duration(total))+'</b><small>tiempo juntos</small></div>'+
 '<div><span>'+ico('calendar-heart')+'</span><b>'+Number(month.count||0)+'</b><small>este mes · '+esc(duration(Number(month.seconds||0)))+'</small></div>'+
 '<div><span>'+ico('timer')+'</span><b>'+esc(duration(avg))+'</b><small>promedio</small></div>'+
 '<div><span>'+ico('trophy')+'</span><b>'+esc(duration(longest))+'</b><small>encuentro más largo</small></div>'+
 '</div>'+
 '<div class="encounter-note"><span>'+ico('info')+'</span><p>La galaxia registra un encuentro cuando ambos comparten ubicación, permanecen a unos 80 m o menos durante al menos un minuto, y lo cierra al separarse.</p></div>'+
 (recentRows?'<div class="encounter-recent-list"><div class="section-head"><div><h3>Encuentros recientes</h3><p>Los últimos momentos detectados juntos.</p></div></div>'+recentRows+'</div>':'<div class="universal-search-empty">'+ico('heart-handshake')+'<h3>Aún no hay encuentros registrados</h3><p>Cuando la app detecte que están juntos, aparecerán aquí.</p></div>')+
 '<div class="form-actions"><button class="btn secondary" data-action="encounter-map">'+ico('map-pin')+' Ver actividad en el mapa</button><button class="btn ghost" data-action="encounter-stats-refresh">'+ico('refresh-cw')+' Actualizar</button></div></div>';
}
async function openEncounterStats(force=false){
 showModal('Nuestros encuentros',encounterStatsCache&&!force?encounterStatsMarkup(encounterStatsCache):'<div class="monthly-loading">'+loading('Contando nuestros encuentros')+'<p>Sumando tiempo, encuentros y lo vivido este mes…</p></div>');
 try{
  const stats=await loadEncounterStats(force||!encounterStatsCache);
  if(modal.open)showModal('Nuestros encuentros',encounterStatsMarkup(stats));
 }catch(error){if(modal.open)showModal('Nuestros encuentros','<div class="universal-search-empty">'+ico('circle-alert')+'<h3>No pudimos contar los encuentros</h3><p>'+esc(error.message||'Intenta nuevamente.')+'</p></div>');}
}

function universalSearchData(){return {items:cloud?.items||[],places:cloud?.places||mapData?.places||[]};}
function universalSearchRows(query){
 if(!window.GalaxySearch?.searchUniverse)return[];
 return window.GalaxySearch.searchUniverse(universalSearchData(),query,40);
}
function universalSearchResultsMarkup(query){
 const q=String(query||'').trim();
 if(!q)return '<div class="universal-search-empty">'+ico('search')+'<h3>Todo lo nuestro, en una búsqueda</h3><p>Busca recuerdos, planes, notas, canciones, cápsulas, deseos, viajes, fechas o lugares.</p></div>';
 const rows=universalSearchRows(q);
 if(!rows.length)return '<div class="universal-search-empty">'+ico('search-x')+'<h3>No encontramos nada</h3><p>Prueba con otra palabra, un lugar, una fecha o el nombre de un recuerdo.</p></div>';
 return '<div class="universal-search-list">'+rows.map(r=>{
  const iconName=r.type==='place'?'map-pin':(kindMeta[r.kind]?.[0]||'file-text');
  return '<button class="universal-search-result" data-action="universal-search-result" data-type="'+attr(r.type)+'" data-id="'+attr(r.id)+'" data-kind="'+attr(r.kind||'')+'"><span class="search-result-icon">'+ico(iconName)+'</span><span class="search-result-copy"><b>'+esc(r.title)+'</b><small>'+esc(r.subtitle||'')+'</small></span>'+ico('chevron-right')+'</button>';
 }).join('')+'</div><p class="universal-search-count">'+rows.length+' resultado'+(rows.length===1?'':'s')+'</p>';
}
function intelligenceSearchExtraMarkup(result,classicRows=[]){
 const classicKeys=new Set((classicRows||[]).map(r=>(r.type==='place'?'place':r.kind)+':'+String(r.id)));
 const rows=(result?.results||[]).filter(r=>!classicKeys.has(String(r.sourceType)+':'+String(r.sourceId))).slice(0,12);
 const mode=result?.mode||'fallback';
 if(!rows.length)return '<p class="universal-search-count intelligence-search-status">Búsqueda clásica activa'+(mode.includes('fallback')?' · fallback':'')+'.</p>';
 return '<div class="intelligence-search-divider"><span>'+ico('sparkles')+'</span><b>Relacionados por Galaxy Intelligence</b><small>Exactos y texto completo tienen prioridad sobre similitud semántica.</small></div><div class="universal-search-list">'+rows.map(r=>'<button class="universal-search-result" data-action="intelligence-search-result" data-source-type="'+attr(r.sourceType||'')+'" data-source-id="'+attr(r.sourceId||'')+'" data-title="'+attr(r.title||'Momento')+'" data-snippet="'+attr(r.snippet||'')+'"><span class="search-result-icon">'+ico(r.sourceType==='place'?'map-pin':r.sourceType==='song'?'music':r.sourceType==='trip'?'route':r.sourceType==='goal'?'target':r.sourceType==='voice-transcript'?'audio-lines':'sparkles')+'</span><span class="search-result-copy"><b>'+esc(r.title||'Momento')+'</b><small>'+esc(r.snippet||r.date||'')+'</small></span><span class="badge mini">'+(r.exact?'Exacta':r.fulltext?'Texto':r.semantic?'Semántica':'Relacionada')+'</span></button>').join('')+'</div><p class="universal-search-count">'+rows.length+' resultado'+(rows.length===1?'':'s')+' adicional'+(rows.length===1?'':'es')+'.</p>';
}
function renderUniversalSearchResults(query){
 const el=document.querySelector('#universalSearchResults');if(!el)return;
 const q=String(query||'').trim(),classic=universalSearchRows(q);
 el.innerHTML=universalSearchResultsMarkup(q);refreshIcons();
 if(q.length<2||!native.paired)return;
 const nonce=++intelligenceSearchNonce;
 api('intelligence-search',{query:q,limit:24}).then(result=>{
  if(nonce!==intelligenceSearchNonce||!document.querySelector('#universalSearchResults'))return;
  const target=document.querySelector('#universalSearchResults');
  if(target){target.innerHTML=universalSearchResultsMarkup(q)+intelligenceSearchExtraMarkup(result,classic);refreshIcons();}
 }).catch(()=>{
  if(nonce!==intelligenceSearchNonce)return;
  const target=document.querySelector('#universalSearchResults');
  if(target&&!target.querySelector('.intelligence-search-status'))target.insertAdjacentHTML('beforeend','<p class="universal-search-count intelligence-search-status">Galaxy Intelligence no respondió · fallback clásico activo.</p>');
 });
}
function openUniversalSearch(){
 showModal('Buscar en nuestra galaxia','<div class="universal-search"><label class="universal-search-box">'+ico('search')+'<input id="universalSearchInput" class="input" autocomplete="off" autocapitalize="sentences" placeholder="Un recuerdo, lugar, canción, plan…" aria-label="Buscar en nuestra galaxia"></label><div id="universalSearchResults" aria-live="polite"></div></div>');
 renderUniversalSearchResults('');
 setTimeout(()=>document.querySelector('#universalSearchInput')?.focus(),80);
}
async function openUniversalSearchResult(btn){
 const type=String(btn.dataset.type||''),id=String(btn.dataset.id||'');
 if(type==='place'){
  const known=(cloud?.places||mapData?.places||[]).find(p=>String(p.id)===id);
  closeModal();go('map');
  if(!mapData)await refreshMap({detail:true});
  const place=(mapData?.places||cloud?.places||[]).find(p=>String(p.id)===id)||known;
  setTimeout(()=>{if(place&&map){map.setView([Number(place.latitude),Number(place.longitude)],16);document.querySelector('#map')?.scrollIntoView({behavior:'smooth',block:'center'});}},180);
  return;
 }
 const item=cloud?.items?.find(i=>String(i.id)===id);if(!item)return;
 closeModal();memoryTab=item.kind==='song'?'music':item.kind;go('memories');
 setTimeout(()=>{
  const target=[...document.querySelectorAll('[data-item-id]')].find(el=>String(el.dataset.itemId)===id);
  if(target){target.classList.add('search-hit');target.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>target.classList.remove('search-hit'),1800);}
 },100);
}

function dailyAnswerMarkup(own,partner){
 let html='';
 if(!own.answer)html='<form id="dailyForm" class="stack" style="margin-top:14px"><textarea name="answer" placeholder="Tu respuesta…" required></textarea><button class="btn" type="submit">Guardar respuesta</button></form>';
 else html='<div class="card" style="margin-top:12px;background:var(--surface2)"><span class="badge">'+esc(myName())+'</span><p style="margin-top:7px">'+esc(own.answer)+'</p></div>';
 if(partner.answer)html+='<div class="card partner-answer" style="margin-top:10px"><span class="badge">'+esc(partnerName())+'</span><p style="margin-top:7px">'+esc(partner.answer)+'</p></div>';
 else if(own.answer)html+='<p class="muted" style="font-size:12px;margin-top:10px">La respuesta de '+esc(partnerName())+' aparecerá cuando ambos hayan respondido.</p>';
 return html;
}
function dailyQuestionCard(own,partner){
 const q=dateContext?.question||{},both=!!own?.answer&&!!partner?.answer;
 const deckLabels={funny:'Divertidas',memories:'Recuerdos',future:'Futuro',intimate:'Íntimas y emocionales',absurd:'Absurdas',travel:'Viajes','would-you-rather':'¿Qué prefieres?'};
 return '<section class="section"><div class="card date-question-card"><div class="row between"><div><p class="eyebrow">PREGUNTA DEL DÍA 2.0</p><small class="muted">'+esc(deckLabels[q.deck]||'Una pregunta para hoy')+'</small></div><button class="icon-btn '+(q.favorite?'active':'')+'" data-action="date-question-favorite" aria-label="'+(q.favorite?'Quitar de favoritas':'Marcar como favorita')+'">'+ico('star')+'</button></div><h3>'+esc(dailyQuestion())+'</h3>'+dailyAnswerMarkup(own,partner)+'<div class="row wrap date-question-actions"><button class="btn small secondary" data-action="galaxy-share" data-card-type="DAILY_QUESTION" data-kind="daily_question" data-id="'+attr(cloud.today)+'" data-title="'+attr(dailyQuestion())+'">'+ico('send')+' Galaxy Chat</button><button class="btn small secondary" data-action="date-question-decks">'+ico('layers-3')+' Barajas</button><button class="btn small ghost" data-action="date-question-memory" '+(both?'':'disabled')+'>'+ico('bookmark-plus')+' '+(q.memoryId?'Ver recuerdo':'Guardar como recuerdo')+'</button></div>'+(both?'':'<p class="muted date-question-privacy">'+ico('lock')+' Las dos respuestas se unen a un recuerdo solo cuando ambos hayan contestado.</p>')+'</div></section>';
}

function personCard(l){
 const name=names()[Number(l.person)]||'Nosotros',sharing=!!l.sharing,fresh=locationFreshState(l),motion=transportLabel(l),kmh=Math.max(0,Number(l.speed||0)*3.6),mine=String(l.person)===String(cloud.person);
 const state=!sharing?'Ubicación pausada':fresh?(esc(motion)+(l.status?' · '+esc(l.status):'')):'Sin actualizar · hace '+ageDurationLabel(locationAgeMs(l));
 const statusAction=l.status?'<button class="btn small secondary" data-action="'+(mine?'galaxy-share':'status-chat-reply')+'" '+(mine?'data-card-type="STATUS" data-kind="status" ':'')+'data-id="'+attr(l.person)+'" data-title="'+attr(l.status)+'">'+ico(mine?'send':'message-circle-reply')+' '+(mine?'Compartir estado':'Responder en Galaxy Chat')+'</button>':'';
 return '<div class="card person-card '+(sharing&&!fresh?'stale':'')+'"><div class="bubble">'+esc(name.slice(0,1))+'</div><div><b><span class="status-dot '+(fresh?'live':sharing?'stale':'')+'"></span>'+esc(name)+'</b><p>'+state+'</p>'+statusAction+'</div><div class="speed">'+(fresh?kmh.toFixed(kmh<10?1:0):'—')+'<small>km/h</small></div></div>';
}
function transportLabel(l){
 if(!l.sharing)return'Ubicación pausada';
 if(l.motion==='walking')return'Caminando';
 if(l.motion==='still')return'Quieto/a';
 if(l.motion==='vehicle')return l.transport_preference==='motorcycle'?'En moto · probable':l.transport_preference==='transit'?'En transporte público · probable':'En vehículo';
 return'Moviéndose';
}

function goalsView(){
 const goals=goalsState?.goals||[],active=goals.filter(g=>['active','paused'].includes(g.status)),done=goals.filter(g=>g.status==='completed'),savings=goals.filter(g=>g.kind==='savings');
 const visible=goalsFilter==='active'?active:goalsFilter==='completed'?done:goalsFilter==='savings'?savings:goals;
 const average=active.length?Math.round(active.reduce((sum,g)=>sum+Number(g.progressPct||0),0)/active.length):0;
 return '<section class="goals-page"><div class="section-head"><div><p class="eyebrow">GALAXY GOALS</p><h2>Nuestros objetivos</h2><p>Planes y deseos siguen siendo suyos. Aquí viven las metas que necesitan pasos y seguimiento.</p></div></div>'+
 '<div class="goals-summary"><div class="card"><span>'+ico('target')+'</span><b>'+active.length+'</b><small>en marcha</small></div><div class="card"><span>'+ico('circle-check-big')+'</span><b>'+done.length+'</b><small>completados</small></div><div class="card"><span>'+ico('piggy-bank')+'</span><b>'+savings.length+'</b><small>ahorros manuales</small></div><div class="card"><span>'+ico('chart-no-axes-column-increasing')+'</span><b>'+average+'%</b><small>progreso activo</small></div></div>'+
 '<div class="row wrap goals-create"><button class="btn" data-action="goal-new">'+ico('target')+' Nuevo objetivo</button><button class="btn secondary" data-action="goal-savings-new">'+ico('piggy-bank')+' Meta de ahorro</button></div>'+
 '<div class="chips goals-filter"><button class="chip '+(goalsFilter==='active'?'active':'')+'" data-action="goals-filter" data-value="active">En marcha</button><button class="chip '+(goalsFilter==='all'?'active':'')+'" data-action="goals-filter" data-value="all">Todos</button><button class="chip '+(goalsFilter==='savings'?'active':'')+'" data-action="goals-filter" data-value="savings">Ahorro</button><button class="chip '+(goalsFilter==='completed'?'active':'')+'" data-action="goals-filter" data-value="completed">Logrados</button></div>'+
 '<div class="stack goals-list">'+(goalsState?visible.length?visible.map(goalCard).join(''):'<div class="empty">'+ico('target')+' No hay objetivos en este filtro.</div>':loading('Cargando objetivos'))+'</div></section>';
}
function goalCard(goal){
 const pct=Math.max(0,Math.min(100,Number(goal.progressPct)||0)),participants=(goal.participants||[]).map(p=>names()[Number(p)]||p).join(' + ');
 const amount=goal.kind==='savings'?'<p class="goal-money"><b>'+moneyLabel(goal.accumulatedAmount)+'</b> / '+moneyLabel(goal.target_amount)+'</p>':'';
 return '<button class="card goal-card" data-action="goal-open" data-id="'+attr(goal.id)+'"><div class="row between"><span class="badge">'+esc(goal.kind==='savings'?'Ahorro manual':goalCategoryLabel(goal.category))+'</span><span class="goal-status">'+esc(goalStatusLabel(goal.status))+'</span></div><h3>'+esc(goal.title)+'</h3>'+(goal.description?'<p>'+esc(goal.description)+'</p>':'')+amount+'<div class="goal-progress"><i style="width:'+pct+'%"></i></div><div class="row between goal-meta"><small>'+pct+'% · '+esc(participants||'Nosotros')+'</small><small>'+(goal.target_date?fmtDate(goal.target_date):'Sin fecha límite')+'</small></div></button>';
}
function goalParticipantsFields(selected=['0','1']){
 return '<div class="field"><label>Participantes</label><div class="goal-participants"><label><input type="checkbox" name="participant0" '+(selected.includes('0')?'checked':'')+'> '+esc(names()[0]||'Persona 1')+'</label><label><input type="checkbox" name="participant1" '+(selected.includes('1')?'checked':'')+'> '+esc(names()[1]||'Persona 2')+'</label></div></div>';
}
function openGoalForm(kind='goal',goal=null){
 const editing=!!goal,actualKind=goal?.kind||kind;modal.dataset.goalId=goal?.id||'';modal.dataset.goalVersion=String(goal?.version||'');
 const categories=[['travel','Viaje'],['home','En casa'],['learning','Aprender'],['experience','Experiencia'],['project','Proyecto'],['wellbeing','Bienestar'],['other','Otro']];
 showModal(editing?'Editar objetivo':actualKind==='savings'?'Nueva meta de ahorro':'Nuevo objetivo','<form id="goalForm" class="stack" style="margin-top:14px"><input type="hidden" name="kind" value="'+attr(actualKind)+'"><div class="field"><label>Título</label><input class="input" name="title" maxlength="160" required value="'+attr(goal?.title||'')+'"></div><div class="field"><label>Descripción</label><textarea name="description" maxlength="4000">'+esc(goal?.description||'')+'</textarea></div><div class="field"><label>Categoría</label><select name="category">'+categories.map(([id,label])=>'<option value="'+id+'" '+((goal?.category||'other')===id?'selected':'')+'>'+label+'</option>').join('')+'</select></div><div class="goal-form-grid"><div class="field"><label>Fecha objetivo (opcional)</label><input class="input" type="date" name="targetDate" value="'+attr(goal?.target_date||'')+'"></div><div class="field"><label>Estado</label><select name="status"><option value="active" '+((goal?.status||'active')==='active'?'selected':'')+'>Activo</option><option value="paused" '+(goal?.status==='paused'?'selected':'')+'>En pausa</option><option value="completed" '+(goal?.status==='completed'?'selected':'')+'>Completado</option><option value="archived" '+(goal?.status==='archived'?'selected':'')+'>Archivado</option></select></div></div>'+(actualKind==='savings'?'<div class="field"><label>Objetivo monetario</label><input class="input" type="number" min="1" step="1000" name="targetAmount" required value="'+attr(goal?.target_amount||'')+'" placeholder="800000"><small>Registro manual. Sin conexión bancaria.</small></div>':'')+goalParticipantsFields(goal?.participants||['0','1'])+'<div class="form-actions"><button type="button" class="btn secondary" data-action="modal-close">Cancelar</button><button class="btn" type="submit">Guardar objetivo</button></div></form>','goal-form');
}
function openGoalDetail(id){
 const goal=goalById(id);if(!goal)return;
 const pct=Math.max(0,Math.min(100,Number(goal.progressPct)||0)),steps=goal.steps||[],links=goal.links||[],contributions=goal.contributions||[];
 const stepsHtml=steps.length?steps.map((step,index)=>'<div class="goal-step '+(step.completed_at?'done':'')+'"><button class="goal-step-check" data-action="goal-step-toggle" data-goal-id="'+attr(goal.id)+'" data-step-id="'+attr(step.id)+'" data-completed="'+(step.completed_at?'true':'false')+'" aria-label="'+(step.completed_at?'Marcar pendiente':'Completar paso')+'">'+ico(step.completed_at?'circle-check-big':'circle')+'</button><span><b>'+esc(step.title)+'</b><small>'+(step.completed_at?'Completado':'Pendiente')+'</small></span><div class="goal-step-order"><button data-action="goal-step-up" data-goal-id="'+attr(goal.id)+'" data-index="'+index+'" '+(index===0?'disabled':'')+' aria-label="Subir paso">'+ico('chevron-up')+'</button><button data-action="goal-step-down" data-goal-id="'+attr(goal.id)+'" data-index="'+index+'" '+(index===steps.length-1?'disabled':'')+' aria-label="Bajar paso">'+ico('chevron-down')+'</button></div></div>').join(''):'<div class="empty compact">Agrega pasos para convertir la meta en algo concreto.</div>';
 const linkHtml=links.length?links.map(link=>'<div class="goal-link"><span>'+ico(link.relation==='memory'?'heart':link.relation==='note'?'file-text':'circle-check-big')+'</span><div><b>'+esc(link.item?.title||'Contenido relacionado')+'</b><small>'+esc(link.relation)+'</small></div><button data-action="goal-link-delete" data-goal-id="'+attr(goal.id)+'" data-link-id="'+attr(link.id)+'" aria-label="Quitar relación">'+ico('x')+'</button></div>').join(''):'<p class="muted">Sin notas, recuerdos o planes relacionados todavía.</p>';
 const contributionHtml=goal.kind==='savings'?'<section class="goal-detail-section"><div class="row between"><div><h3>Aportes manuales</h3><p>Sin conexión bancaria. Solo registra lo que ustedes decidan.</p></div><button class="btn small" data-action="goal-contribution-add" data-id="'+attr(goal.id)+'">+ Aporte</button></div><div class="goal-money-hero"><b>'+moneyLabel(goal.accumulatedAmount)+'</b><span>de '+moneyLabel(goal.target_amount)+'</span></div><div class="stack compact">'+(contributions.length?contributions.map(row=>'<div class="goal-contribution"><div><b>'+moneyLabel(row.amount)+'</b><small>'+fmtDate(row.contribution_date)+(row.note?' · '+esc(row.note):'')+'</small></div><button data-action="goal-contribution-delete" data-goal-id="'+attr(goal.id)+'" data-contribution-id="'+attr(row.id)+'" aria-label="Eliminar aporte">'+ico('trash-2')+'</button></div>').join(''):'<p class="muted">Todavía no hay aportes registrados.</p>')+'</div></section>':'';
 showModal(goal.title,'<div class="goal-detail"><div class="row between"><span class="badge">'+esc(goal.kind==='savings'?'Ahorro manual':goalCategoryLabel(goal.category))+'</span><span>'+esc(goalStatusLabel(goal.status))+'</span></div>'+(goal.description?'<p>'+esc(goal.description)+'</p>':'')+'<div class="goal-progress large"><i style="width:'+pct+'%"></i></div><div class="row between"><b>'+pct+'%</b><small>'+(goal.target_date?'Meta: '+fmtDate(goal.target_date):'Sin fecha límite')+'</small></div><section class="goal-detail-section"><div class="row between"><div><h3>Pasos</h3><p>'+Number(goal.stepsCompleted||0)+' de '+Number(goal.stepsTotal||0)+' completados</p></div><button class="btn small secondary" data-action="goal-step-add" data-id="'+attr(goal.id)+'">+ Paso</button></div><div class="goal-steps">'+stepsHtml+'</div></section>'+contributionHtml+'<section class="goal-detail-section"><div class="row between"><div><h3>Relacionado</h3><p>Referencias, no copias.</p></div><button class="btn small secondary" data-action="goal-link-add" data-id="'+attr(goal.id)+'">+ Vincular</button></div><div class="goal-links">'+linkHtml+'</div></section><div class="form-actions"><button class="btn secondary" data-action="galaxy-share" data-card-type="GOAL" data-kind="goal" data-id="'+attr(goal.id)+'" data-title="'+attr(goal.title)+'">'+ico('send')+' Galaxy Chat</button><button class="btn secondary" data-action="goal-edit" data-id="'+attr(goal.id)+'">'+ico('pencil')+' Editar</button><button class="btn ghost" data-action="goal-delete" data-id="'+attr(goal.id)+'">'+ico('trash-2')+' Eliminar</button></div></div>','goal-detail');
}
function openGoalStepAdd(id){
 showModal('Nuevo paso','<form id="goalStepForm" class="stack"><input type="hidden" name="goalId" value="'+attr(id)+'"><div class="field"><label>Paso</label><input class="input" name="title" maxlength="300" required autofocus></div><button class="btn" type="submit">Agregar paso</button></form>','goal-step');
}
function openGoalContribution(id){
 const goal=goalById(id);if(!goal)return;
 showModal('Registrar aporte','<form id="goalContributionForm" class="stack"><input type="hidden" name="goalId" value="'+attr(id)+'"><div class="field"><label>Valor</label><input class="input" type="number" min="1" step="1000" name="amount" required></div><div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="'+attr(cloud.today)+'" required></div><div class="field"><label>Nota (opcional)</label><input class="input" name="note" maxlength="300"></div><p class="muted">'+ico('shield-check')+' Aporte manual. Sin conexión bancaria.</p><button class="btn" type="submit">Guardar aporte</button></form>','goal-contribution');
}
function openGoalLink(id){
 const candidates=(cloud.items||[]).filter(item=>['memory','note','plan'].includes(item.kind)),goal=goalById(id);
 const linked=new Set((goal?.links||[]).map(link=>String(link.item_id)));
 showModal('Relacionar contenido','<form id="goalLinkForm" class="stack"><input type="hidden" name="goalId" value="'+attr(id)+'"><div class="field"><label>Contenido</label><select name="itemId" required><option value="">Elige…</option>'+candidates.filter(item=>!linked.has(String(item.id))).map(item=>'<option value="'+attr(item.id)+'" data-kind="'+attr(item.kind)+'">'+esc((kindMeta[item.kind]?.[1]||item.kind)+' · '+(item.data?.title||''))+'</option>').join('')+'</select></div><button class="btn" type="submit">Vincular sin duplicar</button></form>','goal-link');
}
function openGoalConvert(item){
 if(!item||!['plan','wish'].includes(item.kind))return;
 showModal('Convertir en objetivo','<form id="goalConvertForm" class="stack"><input type="hidden" name="itemId" value="'+attr(item.id)+'"><div class="card compact"><p class="eyebrow">'+esc(item.kind==='plan'?'PLAN':'DESEO')+'</p><h3>'+esc(item.data?.title||'Sin título')+'</h3><p>'+esc(item.data?.body||'')+'</p></div>'+goalParticipantsFields(['0','1'])+'<label class="row"><input type="checkbox" name="keepOriginal" checked> Conservar el '+(item.kind==='plan'?'plan':'deseo')+' original</label><p class="muted">El objetivo quedará relacionado con el original. No duplicaremos su contenido.</p><button class="btn" type="submit">Crear objetivo</button></form>','goal-convert');
}

function memoriesView(){
 const tabs=[['memory','Recuerdos'],['album','Álbum'],['music','Música'],['event','Calendario'],['plan','Planes'],['note','Notas'],['capsule','Cápsulas'],['wish','Deseos'],['journey','Viajes']];
 let body='';
 if(memoryTab==='album')body=albumView();
 else if(memoryTab==='music')body=musicView();
 else body=itemList(memoryTab);
 return '<section><div class="section-head"><div><p class="eyebrow">LO QUE SOMOS</p><h2>Nuestros recuerdos</h2><p>Todo lo que vamos guardando juntos.</p></div></div><div class="chips memories-tabs">'+tabs.map(([id,label])=>'<button class="chip '+(memoryTab===id?'active':'')+'" data-tab="'+id+'">'+label+'</button>').join('')+'</div>'+body+(memoryTab==='memory'?storyTimeline()+constellationView():'')+'</section>';
}
function itemList(kind){
 const list=items(kind),meta=kindMeta[kind]||['sparkles','Contenido'];
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">'+meta[1]+'</h3><small class="muted">'+list.length+' guardados</small></div><button class="btn small" data-action="item-new" data-kind="'+kind+'">+ Añadir</button></div><div class="'+(kind==='memory'||kind==='journey'?'timeline':'stack')+'" style="margin-top:12px">'+(list.length?list.map(itemCard).join(''):'<div class="empty"><span class="big">'+ico(meta[0])+'</span>Aquí aparecerá lo que vayan guardando.</div>')+'</div></div>';
}
function linkedVoices(id){return (cloud?.bond?.entries||[]).filter(x=>x.type==='voice'&&x.data?.referenceId===id);}
function constellationView(){
 const nodes=(cloud?.items||[]).filter(x=>['memory','journey','song','event'].includes(x.kind)).slice().sort((a,b)=>String(a.data?.date||a.created).localeCompare(String(b.data?.date||b.created))).slice(-18);
 if(!nodes.length)return '';
 return '<section class="section"><div class="section-head"><div><h2>Constelación de recuerdos</h2><p>Cada estrella es una parte de su historia. Las líneas siguen el orden en que la vivieron.</p></div></div><div class="constellation" aria-label="Constelación de recuerdos">'+nodes.map((i,n)=>{const x=10+((n*37)%80),y=12+((n*53)%72),size=8+(n%4)*2;return '<button class="constellation-star" style="--x:'+x+'%;--y:'+y+'%;--s:'+size+'px" data-action="constellation-item" data-id="'+i.id+'" aria-label="'+attr(i.data?.title||'Recuerdo')+'"><i></i><span>'+esc(i.data?.title||'Recuerdo')+'</span></button>';}).join('')+'</div></section>';
}
function linkedDailyQuestionAnswers(i){
 const source=i?.data?.source;if(i?.kind!=='memory'||source?.type!=='daily-question'||!source.day)return'';
 const rows=(cloud?.daily||[]).filter(row=>String(row.day)===String(source.day)&&row.answer).sort((a,b)=>String(a.person).localeCompare(String(b.person)));
 if(rows.length<2)return'Las respuestas siguen vinculadas a la pregunta original.';
 return rows.map(row=>(names()[Number(row.person)]||('Persona '+row.person))+': '+row.answer).join('\n');
}
function itemCard(i){
 const d=i.data||{},meta=kindMeta[i.kind]||['sparkles',i.kind],date=d.unlockAt?fmtDateTime(d.unlockAt):(d.date?fmtDate(d.date):fmtDateTime(i.created)),done=d.done?' · Hecho':'',locked=i.kind==='capsule'&&d.locked===true,voices=locked?[]:linkedVoices(i.id);
 if(locked){const unlockCopy=d.unlockType==='place'?'Se abre al llegar al lugar elegido':'Se abre '+date;return '<div class="card item" data-item-id="'+attr(i.id)+'"><div class="item-icon">'+ico('lock')+'</div><div class="item-main"><div class="meta">'+esc(unlockCopy)+'</div><h3>'+esc(d.title||'Cápsula')+'</h3><p class="muted">El servidor mantiene su contenido protegido hasta el momento elegido.</p><div class="item-actions"><button class="btn small secondary" data-action="galaxy-share" data-card-type="CAPSULE" data-kind="capsule" data-id="'+attr(i.id)+'" data-title="'+attr(d.title||'Cápsula')+'">'+ico('send')+' Compartir en Galaxy Chat</button></div></div></div>';}
 const capsuleMedia=i.kind==='capsule'?'<div class="capsule-reveal-media">'+(d.photoUrl?'<img loading="lazy" src="'+attr(d.photoUrl)+'" alt="Foto de la cápsula">':'')+(d.audioUrl?'<audio controls preload="metadata" src="'+attr(d.audioUrl)+'"></audio>':'')+(d.song?'<button class="btn small secondary" data-action="chat-card-song-play" data-id="'+attr(d.song.id)+'">'+ico('play')+' '+esc(d.song.title||'Canción')+(d.song.artist?' · '+esc(d.song.artist):'')+'</button>':'')+'</div>':'';
 const albumMedia=i.kind==='memory'&&d.source?.type==='chat-album'&&Array.isArray(d.sourceMedia)?'<div class="memory-source-media">'+d.sourceMedia.map(media=>media.kind==='video'?'<video controls preload="metadata" playsinline src="'+attr(media.url)+'"></video>':'<img loading="lazy" src="'+attr(media.url)+'" alt="'+attr(media.name||'Foto del recuerdo')+'">').join('')+'</div>':'';
 return '<div class="card item" data-item-id="'+attr(i.id)+'"><div class="item-icon">'+ico(meta[0])+'</div><div class="item-main"><div class="meta">'+esc(date)+esc(done)+'</div><h3>'+esc(d.title||meta[1])+'</h3>'+((d.body||linkedDailyQuestionAnswers(i))?'<p>'+esc(d.body||linkedDailyQuestionAnswers(i)).replace(/\n/g,'<br>')+'</p>':'')+capsuleMedia+albumMedia+(voices.length?'<div class="stack" style="margin-top:10px">'+voices.map(voiceCard).join('')+'</div>':'')+'<div class="item-actions">'+(['memory','capsule','journey'].includes(i.kind)?'<button class="btn small secondary" data-action="voice-for-item" data-id="'+i.id+'">'+ico('mic')+' Añadir voz</button>':'')+(['plan','wish'].includes(i.kind)?'<button class="btn small secondary" data-action="goal-convert-item" data-id="'+i.id+'">'+ico('target')+' Convertir en objetivo</button>':'')+(['memory','plan','song','capsule','event'].includes(i.kind)?'<button class="btn small secondary" data-action="galaxy-share" data-card-type="'+({memory:'MEMORY',plan:'PLAN',song:'SONG',capsule:'CAPSULE',event:'EVENT'}[i.kind])+'" data-kind="'+attr(i.kind)+'" data-id="'+attr(i.id)+'" data-title="'+attr(d.title||meta[1])+'">'+ico('send')+' Galaxy Chat</button>':'')+'<button class="btn small secondary" data-action="item-edit" data-id="'+i.id+'">Editar</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div></div></div>';
}
function storyTimeline(){
 const entries=(cloud?.items||[]).filter(x=>['memory','journey','event','capsule','song'].includes(x.kind)).filter(x=>x.kind!=='capsule'||String(x.data?.date||'')<=String(cloud.today||'')).slice().sort((a,b)=>String(b.data?.date||b.created).localeCompare(String(a.data?.date||a.created))).slice(0,12);
 return '<section class="section"><div class="section-head"><div><h2>Nuestra historia</h2><p>Recuerdos, viajes, fechas, canciones y cápsulas abiertas en una sola línea del tiempo.</p></div></div><div class="timeline">'+(entries.length?entries.map(itemCard).join(''):'<div class="empty">La historia irá apareciendo aquí a medida que guarden momentos.</div>')+'</div></section>';
}
function driveAlbumCard(){
 const connected=!!native.driveFolderConnected,name=String(native.driveFolderName||'');
 return '<div class="card cloud-album-card '+(connected?'connected':'')+'"><div class="row between"><div><p class="eyebrow">GOOGLE DRIVE COMPARTIDO</p><h3>'+(connected?esc(name||'Carpeta conectada'):'Sin carpeta conectada')+'</h3><p>'+(connected?'Sincroniza las imágenes nuevas de esta carpeta y sus subcarpetas al álbum privado.':'Elige una carpeta desde Google Drive o el selector de archivos de Android.')+'</p></div>'+ico(connected?'folder-sync':'folder-plus')+'</div><div class="row wrap" style="margin-top:12px">'+(connected?'<button class="btn small secondary" data-action="drive-sync">'+ico('refresh-cw')+' Sincronizar</button><button class="btn small ghost" data-action="drive-folder-connect">'+ico('folder-open')+' Cambiar carpeta</button><button class="btn small ghost" data-action="drive-folder-disconnect">'+ico('unlink')+' Desconectar</button>':'<button class="btn small secondary" data-action="drive-folder-connect">'+ico('folder-open')+' Elegir carpeta Drive</button>')+'</div></div>';
}
function openAlbumAdd(){
 showModal('Añadir fotos al álbum','<div class="music-source-grid album-source-grid"><button class="source-card" data-action="photos-picker">'+ico('images')+'<b>Google Photos Picker</b><span>Fotos locales o de tu proveedor cloud disponible</span></button><button class="source-card" data-action="photo-file">'+ico('image-plus')+'<b>Archivo del teléfono</b><span>Elegir una imagen desde Archivos</span></button><button class="source-card" data-action="drive-folder-connect">'+ico('folder-open')+'<b>Google Drive compartido</b><span>'+(native.driveFolderConnected?'Cambiar la carpeta conectada':'Elegir una carpeta para sincronizar')+'</span></button></div><p class="cloud-source-note">'+ico('shield-check')+' Las fotos elegidas o sincronizadas se copian al álbum privado de Nuestra Galaxia. La app no obtiene acceso completo a tu biblioteca de Google Photos.</p>');
}
async function refreshPhotoAlbum(){
 media.photo=null;mediaLoadedAt.photo=0;await loadMedia('photo',true);
 if(view==='memories'&&memoryTab==='album')render();
}
async function importPhotosPicker(){
 closeModal();
 const result=await GalaxyNative.call('pickPhotos');
 await refreshPhotoAlbum();
 toast('Google Photos Picker: '+Number(result.imported||0)+' fotos añadidas'+(result.skipped?' · '+Number(result.skipped)+' omitidas':'')+'.');
}
async function connectDriveFolder(){
 closeModal();
 const result=await GalaxyNative.call('pickDriveFolder');
 native=nativeState();
 if(view==='memories'&&memoryTab==='album')render();
 toast('Carpeta conectada: '+String(result.name||native.driveFolderName||'Google Drive')+'.');
}
async function syncDriveAlbum(){
 showModal('Sincronizando Google Drive','<div class="cloud-sync-progress">'+loading('Leyendo carpeta compartida')+'<h3>Buscando fotos nuevas…</h3><p>Recorreremos la carpeta y sus subcarpetas sin modificar los archivos originales.</p></div>');
 try{
  const result=await GalaxyNative.call('syncDriveFolder');
  await refreshPhotoAlbum();
  closeModal();
  toast('Drive: '+Number(result.imported||0)+' nuevas · '+Number(result.skipped||0)+' ya sincronizadas'+(result.failed?' · '+Number(result.failed)+' omitidas':'')+'.');
 }catch(error){if(modal.open)closeModal();throw error;}
}
function albumView(){
 const list=media.photo;
 if(!list)return loading('Cargando álbum');
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">Nuestro álbum</h3><small class="muted">'+list.length+' fotos privadas</small></div><button class="btn small" data-action="album-add">+ Añadir</button></div>'+driveAlbumCard()+(list.length?'<div class="gallery" style="margin-top:12px">'+list.map(x=>'<div class="photo"><img loading="lazy" src="'+attr(x.url)+'" alt="Foto de nuestro álbum"><button data-action="media-delete" data-kind="photo" data-path="'+attr(x.path)+'" aria-label="Eliminar foto">'+ico('trash-2')+'</button></div>').join('')+'</div>':'<div class="empty"><span class="big">'+ico('camera')+'</span>Añade la primera foto desde Google Photos, Drive o este teléfono.</div>')+'</div>';
}
function musicView(){
 rebuildMusicQueue();
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">Nuestra música</h3><small class="muted">'+musicQueue.length+' canciones compartidas</small></div><button class="btn small" data-action="music-add">+ Añadir música</button></div><p class="muted" style="margin-top:8px">Suban un MP3 o peguen un enlace de Spotify, YouTube, YouTube Music o audio directo.</p><div class="stack music-library" style="margin-top:12px">'+(musicQueue.length?musicQueue.map((x,n)=>'<div class="card music-row '+(n===musicIndex?'active':'')+'"><button class="music-play" data-action="music-play" data-index="'+n+'" aria-label="Reproducir">'+ico(n===musicIndex&&musicPlaying?'pause':'play')+'</button><div class="music-meta"><b>'+esc(x.title)+'</b><p>'+esc(x.platform==='youtube'?'YouTube / YouTube Music':x.platform==='spotify'?'Spotify':x.platform==='mp3'?'MP3':'Audio por URL')+'</p></div>'+(x.type==='mp3'?'<button class="btn small ghost" data-action="media-delete" data-kind="music" data-path="'+attr(x.path)+'">Eliminar</button>':'<div class="row"><button class="btn small secondary" data-action="galaxy-share" data-card-type="SONG" data-kind="song" data-id="'+attr(x.id)+'" data-title="'+attr(x.title)+'">'+ico('send')+' Chat</button><button class="btn small ghost" data-action="item-delete" data-id="'+attr(x.id)+'">Eliminar</button></div>')+'</div>').join(''):'<div class="empty"><span class="big">'+ico('music')+'</span>Construyan aquí la banda sonora de su historia.</div>')+'</div></div>';
}
function openMusicAdd(){
 showModal('Añadir a nuestra música','<div class="music-source-grid"><button class="source-card" data-action="music-upload">'+ico('file-music')+'<b>Subir MP3</b><span>Desde este teléfono</span></button><button class="source-card" data-action="music-url">'+ico('link')+'<b>Pegar enlace</b><span>Spotify, YouTube Music, YouTube o audio</span></button></div>');
}
function openMusicUrl(){
 showModal('Añadir desde un enlace','<form id="musicUrlForm" class="stack" style="margin-top:16px"><div class="field"><label>Nombre de la canción</label><input class="input" name="title" maxlength="160" placeholder="Nuestra canción" required></div><div class="field"><label>Enlace</label><input class="input" type="url" name="url" inputmode="url" placeholder="https://…" required></div><p class="muted">La plataforma se detectará automáticamente.</p><button class="btn" type="submit">Guardar en nuestra música</button></form>','music-url');
}

function bondGestureCatalog(){
 const catalog=cloud?.bond?.gestures||{};
 const builtins=(catalog.builtins?.length?catalog.builtins:[
  {id:'hug',name:'Abrazo',icon:'hand-heart',text:'Tu pareja te envió un abrazo.',behavior:'message_haptic',builtin:true},
  {id:'kiss',name:'Beso',icon:'heart',text:'Tu pareja te envió un beso.',behavior:'message_haptic',builtin:true},
  {id:'miss',name:'Te extraño',icon:'message-circle',text:'Tu pareja te extraña.',behavior:'message',builtin:true},
  {id:'tap',name:'Toque',icon:'hand',text:'Un toque de tu persona.',behavior:'haptic',builtin:true}
 ]);
 return [...builtins,...(catalog.custom||[])];
}
function bondGardenVisual(garden){
 const stage=Number(garden?.stage||0),flowers=Math.min(7,Math.max(1,stage));
 return '<div class="bond-garden-scene" data-stage="'+stage+'" aria-label="Jardín etapa '+stage+'"><span class="garden-sun">'+ico('sun')+'</span><div class="garden-ground"></div><div class="garden-flowers">'+Array.from({length:flowers},(_,i)=>'<span class="garden-flower f'+(i+1)+'">'+ico(stage<2?'sprout':'flower-2')+'</span>').join('')+'</div>'+(stage>=4?'<span class="garden-glow">'+ico('sparkles')+'</span>':'')+'</div>';
}
function bondUnlockables(garden){
 const rows=garden?.unlockables||[];if(!rows.length)return'';
 return '<div class="bond-unlockables">'+rows.map(row=>'<span class="'+(row.unlocked?'unlocked':'locked')+'">'+ico(row.unlocked?'sparkles':'lock')+'<b>'+esc(row.label||'Etapa')+'</b><small>'+Number(row.days||0)+' días</small></span>').join('')+'</div>';
}
function openBondGestureForm(gesture=null){
 const icons=['hand','hand-heart','heart','message-circle','sparkles','star','sun','flower-2','smile','music','coffee','map-pin','moon','bell','waves'];
 const behaviors=[['message','Mensaje'],['haptic','Solo toque háptico'],['message_haptic','Mensaje + toque háptico']];
 showModal(gesture?'Editar gesto':'Nuevo gesto','<form id="bondGestureForm" class="stack"><input type="hidden" name="id" value="'+attr(gesture?.id||'')+'"><input type="hidden" name="version" value="'+attr(gesture?.version||'')+'"><div class="field"><label>Nombre</label><input class="input" name="name" maxlength="40" required value="'+attr(gesture?.name||'')+'" placeholder="Aquí estoy"></div><div class="field"><label>Icono Lucide</label><select name="icon">'+icons.map(icon=>'<option value="'+icon+'" '+((gesture?.icon||'heart')===icon?'selected':'')+'>'+icon+'</option>').join('')+'</select></div><div class="field"><label>Texto</label><input class="input" name="text" maxlength="180" required value="'+attr(gesture?.text||'')+'" placeholder="Pensé en ti"></div><div class="field"><label>Comportamiento</label><select name="behavior">'+behaviors.map(([id,label])=>'<option value="'+id+'" '+((gesture?.behavior||'message')===id?'selected':'')+'>'+label+'</option>').join('')+'</select></div><p class="muted">Los hápticos solo vibran en teléfonos que los hayan activado. Las notificaciones siguen teniendo su propio permiso.</p><button class="btn" type="submit">Guardar gesto</button></form>','bond-gesture');
}
function openBondGestureManager(){
 const custom=cloud?.bond?.gestures?.custom||[];
 showModal('Gestos personalizados','<div class="row between"><p class="muted">Son atajos compartidos. El historial conserva el texto original aunque luego elimines un gesto.</p><button class="btn small" data-action="bond-gesture-new">+ Crear</button></div><div class="stack" style="margin-top:12px">'+(custom.length?custom.map(g=>'<div class="card bond-gesture-row"><span>'+ico(g.icon||'heart')+'</span><div><b>'+esc(g.name)+'</b><small>'+esc(g.text)+' · '+esc(g.behavior)+'</small></div><div class="row"><button class="btn small secondary" data-action="bond-gesture-edit" data-id="'+attr(g.id)+'">Editar</button>'+(String(g.created_by)===String(cloud.person)?'<button class="btn small ghost" data-action="bond-gesture-delete" data-id="'+attr(g.id)+'">Eliminar</button>':'')+'</div></div>').join(''):'<div class="empty">Todavía no han creado gestos propios.</div>')+'</div>','bond-gestures');
}
function momentsView(){
 const bond=cloud.bond||{entries:[],garden:{days:0,stage:0}},entries=bond.entries||[];
 const games=entries.filter(x=>x.type==='game'),rituals=entries.filter(x=>x.type==='ritual'),notes=entries.filter(x=>x.type==='sharednote'),voices=entries.filter(x=>x.type==='voice');
 const garden=bond.garden||{},total=Number(garden.totalDays??garden.days??bond.totalDays??0),current=Number(garden.currentStreak??bond.currentStreak??0),record=Number(garden.recordStreak??bond.recordStreak??0);
 const gestures=bondGestureCatalog();
 return '<section><div class="section-head"><div><p class="eyebrow">GALAXY BOND 2.0</p><h2>Conectar</h2><p>Pequeñas cosas que nos acercan sin convertir el cariño en una obligación.</p></div></div>'+
 '<div class="card bond-garden">'+bondGardenVisual(garden)+'<div class="bond-garden-copy"><p class="eyebrow">NUESTRO JARDÍN</p><h3>Nuestro jardín · '+esc(garden.label||'Nuestro girasol')+'</h3><p>'+total+' días acumulados en los que ambos dejaron algo en la galaxia. Ese progreso nunca se reinicia.</p><div class="bond-streak-grid"><span><b>'+total+'</b><small>Días totales</small></span><span><b>'+current+'</b><small>Racha actual</small></span><span><b>'+record+'</b><small>Récord</small></span></div><div class="progress"><i style="width:'+Number(garden.progressPct||0)+'%"></i></div>'+bondUnlockables(garden)+'</div></div>'+
 '<div class="section"><div class="section-head"><div><h2>Pensé en ti</h2><p>Mensajes rápidos y toques que ustedes pueden personalizar.</p></div><button class="btn small secondary" data-action="bond-gesture-manage">'+ico('settings-2')+' Personalizar</button></div><div class="gesture-grid bond-gesture-grid">'+gestures.map(g=>'<button class="gesture" data-action="bond-send-gesture" data-gesture-id="'+attr(g.id)+'"><span>'+ico(g.icon||'heart')+'</span><b>'+esc(g.name||'Gesto')+'</b><small>'+esc(g.behavior==='haptic'?'Toque háptico':g.behavior==='message_haptic'?'Mensaje + toque':'Mensaje')+'</small></button>').join('')+'</div></div>'+
 '<div class="section"><div class="grid">'+actionCard('sparkles','Cita sorpresa 2.0','Tiempo, presupuesto y contexto real','surprise')+actionCard('timer','Modo Cita','Música, preguntas, fotos y recap','date-mode-open')+actionCard('dices','Ruleta de planes','Elegir entre planes pendientes','plan-roulette-open')+actionCard('list-ordered','Planificar una cita','Armar una secuencia con tiempo y presupuesto','date-planner-open')+actionCard('layers-3','Barajas de preguntas','Elegir un tema para conversar','date-question-decks')+actionCard('gamepad-2','Juego de nosotros','Adivinar lo que elegiría el otro','new-game')+actionCard('notebook-pen','Ritual semanal','Agradecer, pedir y planear','new-ritual')+actionCard('mic','Mensaje de voz','Dejar una voz para el otro','new-voice')+'</div></div>'+
 surpriseNotesView()+
 momentSection('Juego de nosotros',games,gameCard,'No hay preguntas pendientes todavía.')+
 momentSection('Ritual semanal',rituals,ritualCard,'El primer ritual puede empezar esta semana.')+
 '<section class="section"><div class="section-head"><div><h2>Notas compartidas</h2><p>Los dos pueden editarlas.</p></div><button class="btn small" data-action="new-sharednote">+ Nota</button></div><div class="stack">'+(notes.length?notes.map(sharedNoteCard).join(''):'<div class="empty">Una lista, una idea, una promesa o cualquier cosa de los dos.</div>')+'</div></section>'+
 '<section class="section"><div class="section-head"><div><h2>Mensajes de voz</h2><p>Audios privados dentro de la galaxia.</p></div><button class="btn small" data-action="new-voice">+ Voz</button></div><div class="stack">'+(voices.length?voices.map(voiceCard).join(''):'<div class="empty">Todavía no hay mensajes de voz.</div>')+'</div></section>'+
 '</section>';
}
function momentSection(title,list,renderer,empty){return '<section class="section"><div class="section-head"><div><h2>'+esc(title)+'</h2></div></div><div class="stack">'+(list.length?list.map(renderer).join(''):'<div class="empty">'+esc(empty)+'</div>')+'</div></section>';}
function gameCard(e){
 const q=gameQuestions[e.data?.questionId]||{label:'Pregunta',options:[]},mine=e.author===cloud.person,guessed=Object.hasOwn(e.data||{},'guess');
 let body='<p>'+esc(q.label)+'</p>';
 if(mine)body+='<p class="muted" style="margin-top:8px">'+(guessed?'Respuesta: '+esc(e.data.answer)+' · '+(e.data.correct?'¡Acertó!':'No acertó esta vez'):'Tu respuesta está guardada hasta que '+esc(partnerName())+' juegue.')+'</p>';
 else if(guessed)body+='<p style="margin-top:8px"><b>Respuesta:</b> '+esc(e.data.answer)+'<br><span class="muted">Tu elección: '+esc(e.data.guess)+' · '+(e.data.correct?'Acertaste':'Esta vez no')+'</span></p>';
 else body+='<div class="chips" style="margin-top:10px">'+q.options.map(o=>'<button class="chip" data-action="game-guess" data-id="'+e.id+'" data-guess="'+attr(o)+'">'+esc(o)+'</button>').join('')+'</div>';
 return '<div class="card"><span class="badge">'+(mine?'Tu pregunta':esc(partnerName()))+'</span><h3 style="margin-top:9px">Juego de nosotros</h3>'+body+(mine?'<div class="item-actions"><button class="btn small ghost" data-action="bond-delete" data-id="'+e.id+'">Eliminar</button></div>':'')+'</div>';
}
function ritualCard(e){
 const mine=e.author===cloud.person,d=e.data||{};
 return '<div class="card"><span class="badge">'+(mine?'Tu ritual':esc(partnerName()))+' · '+esc(fmtDate(d.week))+'</span><h3 style="margin-top:9px">Gracias</h3><p>'+esc(d.gratitude)+'</p><h3 style="margin-top:12px">Necesito</h3><p>'+esc(d.need)+'</p><h3 style="margin-top:12px">Próximo plan</h3><p>'+esc(d.plan)+'</p>'+(mine?'<div class="item-actions"><button class="btn small secondary" data-action="ritual-edit" data-id="'+e.id+'">Editar</button><button class="btn small ghost" data-action="bond-delete" data-id="'+e.id+'">Eliminar</button></div>':'')+'</div>';
}
function sharedNoteCard(e){
 const d=e.data||{};
 return '<div class="card"><span class="badge">Compartida · v'+Number(e.version||1)+'</span><h3 style="margin-top:9px">'+esc(d.title)+'</h3><p>'+esc(d.body||'')+'</p><div class="item-actions"><button class="btn small secondary" data-action="sharednote-edit" data-id="'+e.id+'">Editar</button><button class="btn small ghost" data-action="bond-delete" data-id="'+e.id+'">Eliminar</button></div></div>';
}
function voiceTimestamp(seconds){
 const s=Math.max(0,Number(seconds)||0),m=Math.floor(s/60),r=Math.floor(s%60);return m+':'+String(r).padStart(2,'0');
}
function voiceTranscriptMarkup(transcript){
 if(!transcript?.text)return'';
 const segments=(transcript.segments||[]).slice(0,12);
 return '<div class="voice-transcript"><div class="row between"><b>'+ico('captions')+' Transcripción</b><span class="badge mini">opcional</span></div><p>'+esc(transcript.text)+'</p>'+(segments.length?'<details><summary>Ver timestamps</summary><div class="voice-transcript-segments">'+segments.map(s=>'<span><b>'+voiceTimestamp(s.start)+'</b> '+esc(s.text)+'</span>').join('')+'</div></details>':'')+'</div>';
}
function voiceCard(e){
 const d=e.data||{},mine=e.author===cloud.person,transcript=d.transcript||null;
 return '<div class="card audio-card" data-voice-id="'+attr(e.id)+'"><span class="badge">'+(mine?'Tu voz':esc(partnerName()))+'</span><h3 style="margin-top:9px">'+esc(d.title)+'</h3>'+(d.body?'<p>'+esc(d.body)+'</p>':'')+(d.audioUrl?'<audio controls preload="none" src="'+attr(d.audioUrl)+'"></audio>':'<p>El enlace de este audio necesita actualizarse.</p>')+voiceTranscriptMarkup(transcript)+(mine?'<div class="item-actions">'+(transcript?'<button class="btn small secondary" data-action="voice-transcript-delete" data-id="'+attr(e.id)+'">'+ico('captions-off')+' Eliminar transcripción</button>':'<button class="btn small secondary" data-action="voice-transcribe" data-id="'+attr(e.id)+'">'+ico('captions')+' Transcribir</button>')+'<button class="btn small ghost" data-action="bond-delete" data-id="'+attr(e.id)+'">Eliminar audio</button></div>':'')+(mine?'<p class="muted voice-ai-note">Transcribir es opcional. El audio original se mantiene aunque elimines su transcripción.</p>':'')+'</div>';
}

function contextSettings(){
 return mapData?.context?.settings||{near_enabled:false,near_distance_m:300,near_cooldown_minutes:60,arrived_safe_enabled:false,date_suggestions:true,memory_suggestions:true,shared_trip_detection:false};
}
function contextSession(){
 return mapData?.context?.session||null;
}
function contextEnginePanel(){
 const s=contextSettings(),session=contextSession(),distance=Number(s.near_distance_m||300),cooldown=Number(s.near_cooldown_minutes||60);
 const sessionTitle=session?.mode==='return_home'?'Regreso a casa':'Acompáñame 2.0';
 const sessionBlock=session?'<div class="context-session"><div class="row between"><div><p class="eyebrow">'+esc(sessionTitle.toUpperCase())+'</p><h3>'+esc(session.label||'Destino')+'</h3></div><span class="badge good">Activo</span></div><div class="context-progress"><i style="width:'+Math.max(0,Math.min(100,Number(session.progress_pct||0)))+'%"></i></div><div class="context-metrics"><span><b>'+Math.max(0,Math.min(100,Number(session.progress_pct||0)))+'%</b><small>progreso</small></span><span><b>'+(session.last_distance_m==null?'—':esc(fmtDistance(session.last_distance_m)))+'</b><small>restante</small></span><span><b>'+(session.last_eta_s==null?'—':esc(fmtDuration(session.last_eta_s)))+'</b><small>ETA</small></span></div><button class="btn small secondary" data-action="galaxy-share" data-card-type="ETA" data-kind="context_session" data-id="'+attr(session.id)+'" data-title="'+attr(session.label||'Acompáñame')+'">'+ico('send')+' Galaxy Chat</button><button class="btn small ghost" data-action="context-session-stop">'+ico('square')+' Terminar sesión</button></div>':'<div class="context-session empty-session"><span>'+ico('route')+'</span><div><b>Sin sesión activa</b><small>Acompáñame y Regreso solo funcionan cuando tú los inicias.</small></div></div>';
 return '<section class="section context-engine"><div class="section-head"><div><p class="eyebrow">Galaxy Context Engine</p><h2>Contexto, sin diez GPS distintos</h2><p>Una sola capa interpreta proximidad, lugares, encuentros, recorridos y llegadas.</p></div></div>'+
 '<div class="grid context-controls"><div class="card"><div class="row between"><div><h3>Estamos cerca</h3><p>Aviso opcional cuando ambos comparten ubicación y entran en tu radio.</p></div><span class="badge '+(s.near_enabled?'good':'')+'">'+(s.near_enabled?'Activo':'Apagado')+'</span></div><p class="context-detail">'+distance+' m · cooldown '+cooldown+' min</p><button class="btn small '+(s.near_enabled?'secondary':'')+'" data-action="context-near-toggle">'+ico(s.near_enabled?'bell-off':'bell')+' '+(s.near_enabled?'Desactivar':'Activar')+'</button></div>'+
 '<div class="card"><div class="row between"><div><h3>Llegué bien</h3><p>Solo avisa al otro al alcanzar un destino de Acompáñame/Regreso.</p></div><span class="badge '+(s.arrived_safe_enabled?'good':'')+'">'+(s.arrived_safe_enabled?'Activo':'Apagado')+'</span></div><button class="btn small '+(s.arrived_safe_enabled?'secondary':'')+'" data-action="context-arrived-toggle">'+ico(s.arrived_safe_enabled?'bell-off':'shield-check')+' '+(s.arrived_safe_enabled?'Desactivar':'Activar')+'</button></div></div>'+
 sessionBlock+
 '<div class="row wrap context-actions"><button class="btn secondary" data-action="destination">'+ico('navigation')+' Acompáñame 2.0</button><button class="btn secondary" data-action="context-return-home">'+ico('house')+' Regreso a casa</button><button class="btn ghost" data-action="context-settings-open">'+ico('settings-2')+' Preferencias</button></div></section>';
}
function contextSuggestionsView(){
 const list=mapData?.context?.suggestions||[];if(!list.length)return'';
 return '<section class="section context-suggestions"><div class="section-head"><div><p class="eyebrow">DESPUÉS DE VERNOS</p><h2>Contexto sugerido</h2><p>La galaxia propone; ustedes deciden. Nada se convierte en cita o recuerdo automáticamente.</p></div></div><div class="stack">'+list.map(s=>{
  const p=s.payload||{};
  if(s.kind==='date')return '<article class="card context-suggestion"><span class="item-icon">'+ico('calendar-heart')+'</span><div><h3>¿Esto fue una cita?</h3><p>'+(p.durationS?esc(fmtDuration(p.durationS))+' juntos':'Estuvieron juntos un buen rato')+(p.place?.name?' · '+esc(p.place.name):'')+'.</p></div><div class="item-actions"><button class="btn small" data-action="context-suggestion-accept" data-id="'+attr(s.id)+'">Sí, fue una cita</button><button class="btn small ghost" data-action="context-suggestion-dismiss" data-id="'+attr(s.id)+'">No</button></div></article>';
  return '<article class="card context-suggestion"><span class="item-icon">'+ico('camera')+'</span><div><h3>'+esc(p.title||'¿Guardamos un recuerdo de este encuentro?')+'</h3><p>'+(p.durationS?esc(fmtDuration(p.durationS))+' juntos':'Encuentro detectado')+(p.place?.name?' · '+esc(p.place.name):'')+'.</p></div><div class="item-actions"><button class="btn small" data-action="context-suggestion-accept" data-id="'+attr(s.id)+'">Guardar recuerdo</button><button class="btn small ghost" data-action="context-suggestion-dismiss" data-id="'+attr(s.id)+'">Ahora no</button></div></article>';
 }).join('')+'</div></section>';
}
function openContextSettings(){
 const s=contextSettings();
 showModal('Preferencias de contexto','<form id="contextSettingsForm" class="stack"><label class="toggle-row"><input type="checkbox" name="nearEnabled" '+(s.near_enabled?'checked':'')+'><span><b>Estamos cerca</b><small>Aviso cuando entren en el radio elegido.</small></span></label><div class="field"><label>Radio de cercanía</label><select name="nearDistanceM">'+[150,300,500,1000,2000].map(v=>'<option value="'+v+'" '+(Number(s.near_distance_m)===v?'selected':'')+'>'+v+' m</option>').join('')+'</select></div><div class="field"><label>Cooldown</label><select name="nearCooldownMinutes">'+[15,30,60,120,240].map(v=>'<option value="'+v+'" '+(Number(s.near_cooldown_minutes)===v?'selected':'')+'>'+v+' min</option>').join('')+'</select></div><label class="toggle-row"><input type="checkbox" name="arrivedSafeEnabled" '+(s.arrived_safe_enabled?'checked':'')+'><span><b>Llegué bien automático</b><small>Solo durante una sesión que tú iniciaste.</small></span></label><label class="toggle-row"><input type="checkbox" name="dateSuggestions" '+(s.date_suggestions!==false?'checked':'')+'><span><b>Preguntar si fue una cita</b><small>Nunca se asumirá automáticamente.</small></span></label><label class="toggle-row"><input type="checkbox" name="memorySuggestions" '+(s.memory_suggestions!==false?'checked':'')+'><span><b>Sugerir recuerdos</b><small>Después de encuentros reales.</small></span></label><label class="toggle-row"><input type="checkbox" name="sharedTripDetection" '+(s.shared_trip_detection===true?'checked':'')+'><span><b>Recorridos juntos</b><small>Usa proximidad, duración y movimiento coherente.</small></span></label><p class="muted">Estas opciones no encienden la ubicación. Compartir GPS sigue siendo una acción separada y visible.</p><button class="btn" type="submit">Guardar preferencias</button></form>','context-settings');
}
function contextRecapMarkup(title,recap){
 const r=recap||{},places=r.places||[],photos=r.photos||[],songs=r.songs||[],memories=r.memories||[],points=r.map?.points||[];
 return '<div class="context-recap"><div class="context-recap-hero"><span>'+ico(r.kind==='date'?'calendar-heart':'route')+'</span><div><p class="eyebrow">'+esc(title.toUpperCase())+'</p><h3>'+esc(fmtDuration(r.durationS||0))+' · '+esc(fmtDistance(r.distanceM||0))+'</h3><p>'+(Number(r.walkingM||0)>0?'Caminata inferida: '+esc(fmtDistance(r.walkingM))+'. ':'')+'Solo usamos segmentos suficientemente coherentes para estimar distancia.</p></div></div>'+(points.length>=2?'<div id="contextRecapMap" class="context-recap-map" aria-label="Mapa del recorrido"></div>':'')+'<div class="context-recap-grid"><span><b>'+places.length+'</b><small>lugares</small></span><span><b>'+photos.length+'</b><small>fotos candidatas</small></span><span><b>'+songs.length+'</b><small>canciones</small></span><span><b>'+memories.length+'</b><small>recuerdos</small></span></div>'+(places.length?'<div class="chips">'+places.map(p=>'<span class="chip static">'+ico('map-pin')+esc(p.name)+'</span>').join('')+'</div>':'')+'<p class="muted">El mapa usa el historial privado ya guardado; no hace geocoding adicional.</p></div>';
}
function renderContextRecapMap(recap){
 const el=document.querySelector('#contextRecapMap'),points=(recap?.map?.points||[]).filter(p=>Number.isFinite(Number(p.latitude))&&Number.isFinite(Number(p.longitude)));
 if(!el||points.length<2||!window.GalaxyMap)return;
 const coords=points.map(p=>[Number(p.latitude),Number(p.longitude)]);
 const mini=new window.GalaxyMap(el,{center:coords[0],zoom:14});
 mini.addPolyline(coords,{className:'context-recap-route'});
 mini.addMarker({lat:coords[0][0],lon:coords[0][1],icon:'play',popup:'Inicio'});
 const last=coords[coords.length-1];mini.addMarker({lat:last[0],lon:last[1],icon:'flag',popup:'Final'});
 mini.fitBounds(coords,{maxZoom:16});
}
function mapView(){
 const own=(cloud.locations||[]).find(l=>l.person===cloud.person)||{},partner=(cloud.locations||[]).find(l=>l.person!==cloud.person)||{};
 return '<section><div class="section-head"><div><p class="eyebrow">NUESTRO MAPA</p><h2>Acompañarnos</h2><p>Ubicación voluntaria, recorridos y lugares importantes.</p></div><button class="btn small secondary" data-action="map-refresh">Actualizar</button></div>'+
 '<div class="map-wrap"><div id="map"></div><button class="map-fab" data-action="status-menu" aria-label="Estado rápido">'+ico('sparkles')+'</button><div id="statusMenu" class="map-status-menu">'+['Ya voy','Voy bien','Llegué','En camino','Necesito una pausa'].map(s=>'<button data-action="status-set" data-status="'+attr(s)+'">'+esc(s)+'</button>').join('')+'<button data-action="status-custom">Otro…</button></div></div>'+
 '<div class="grid" style="margin-top:12px">'+personCard(own)+personCard(partner)+'</div>'+coupleDistanceCard({mapMode:true})+etaCard()+
 '<div class="section"><div class="card"><div class="row between"><div><h3>Compartir ubicación</h3><p>'+(native.tracking?'Android la mantiene activa en segundo plano.':'Está detenida en este teléfono.')+'</p></div><span class="badge '+(native.tracking?'good':'')+'">'+(native.tracking?'Activa':'Pausada')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="'+(native.tracking?'location-stop':'location-start')+'">'+(native.tracking?'Detener':'Comenzar')+'</button><button class="btn small secondary" data-action="app-settings">Permisos</button></div></div></div>'+
 '<div class="section"><div class="card"><h3>Cómo me muevo normalmente</h3><p>Ayuda a interpretar cuando Android detecta que vas en vehículo.</p><div class="chips" style="margin-top:12px">'+
 ['','motorcycle','transit'].map(value=>'<button class="chip '+((own.transport_preference||'')===value?'active':'')+'" data-action="transport-set" data-value="'+value+'">'+ico(value==='motorcycle'?'bike':value==='transit'?'bus-front':'navigation')+(value==='motorcycle'?'Moto':value==='transit'?'Transporte público':'Automático')+'</button>').join('')+
 '</div></div></div>'+
 contextEnginePanel()+
 '<div class="section"><div class="grid">'+actionCard('route',own.trip_active?'Terminar recorrido':'Iniciar recorrido',own.trip_active?'Guardaremos el resumen al finalizar':'Registra distancia, duración y movimiento','trip-toggle')+actionCard('map-pin','Guardar este lugar','Casa, trabajo, recuerdo o aventura','place-new')+actionCard('navigation','Acompáñame 2.0','Destino, progreso, ETA y llegada','destination')+'</div></div>'+
 contextSuggestionsView()+frequentPlacesView()+mapHistoryView()+'</section>';
}
function frequentPlacesFresh(){return !!frequentPlacesData&&Date.now()-frequentPlacesLoadedAt<15*60*1000;}
async function loadFrequentPlaces(force=false){
 if(frequentPlacesLoading)return frequentPlacesData;
 if(frequentPlacesFresh()&&!force)return frequentPlacesData;
 frequentPlacesLoading=true;
 try{
  frequentPlacesData=await api('frequent-places');frequentPlacesLoadedAt=Date.now();
  if(view==='map'&&!editingNow())render();
  return frequentPlacesData;
 }finally{frequentPlacesLoading=false;}
}
function dwellLabel(minutes){
 const m=Math.max(0,Number(minutes)||0);if(m<60)return Math.round(m)+' min acumulados';
 const h=Math.floor(m/60),rest=Math.round(m%60);return h+' h'+(rest?' '+rest+' min':'')+' acumuladas';
}
function visibleFrequentSuggestions(){
 return window.GalaxyFrequentPlaces?.visibleSuggestions(frequentPlacesData?.suggestions||[])||[];
}
function frequentPlacesView(){
 const list=visibleFrequentSuggestions();if(!list.length)return'';
 const own=(mapData?.locations||cloud?.locations||[]).find(l=>String(l.person)===String(cloud.person))||{};
 return '<section class="section frequent-places"><div class="section-head"><div><p class="eyebrow">LUGARES QUE SE REPITEN</p><h2>Quizás este lugar importa</h2><p>La galaxia detectó zonas donde pasas tiempo en varios días distintos. Nada se guarda sin que tú lo decidas.</p></div></div><div class="stack">'+list.slice(0,3).map((s,n)=>{
   const near=window.GalaxyFrequentPlaces?.isNearby(s,own),confidence=window.GalaxyFrequentPlaces?.confidenceLabel(s)||'Lugar frecuente';
   return '<article class="card frequent-place-card '+(near?'near':'')+'"><div class="frequent-place-head"><span class="frequent-place-icon">'+ico(near?'locate-fixed':'map-pin')+'</span><div><span class="badge '+(near?'good':'')+'">'+esc(near?'Estás por aquí ahora':confidence)+'</span><h3>Zona frecuente '+(n+1)+'</h3><p>'+Number(s.days||0)+' días distintos · '+Number(s.visits||0)+' visitas · '+esc(dwellLabel(s.dwell_minutes))+'</p><small>Última visita: '+esc(fmtDateTime(s.last_visit))+'</small></div></div><div class="item-actions"><button class="btn small" data-action="frequent-place-save" data-lat="'+attr(s.latitude)+'" data-lon="'+attr(s.longitude)+'">Guardar lugar</button><button class="btn small secondary" data-action="frequent-place-focus" data-lat="'+attr(s.latitude)+'" data-lon="'+attr(s.longitude)+'">Ver zona</button><button class="btn small ghost" data-action="frequent-place-dismiss" data-lat="'+attr(s.latitude)+'" data-lon="'+attr(s.longitude)+'">Ahora no</button></div></article>';
  }).join('')+'</div><p class="frequent-place-privacy">'+ico('shield-check')+' Solo analiza el historial de ubicación de este perfil. No guarda lugares automáticamente.</p></section>';
}
function frequentSuggestionFromButton(btn){
 const lat=Number(btn.dataset.lat),lon=Number(btn.dataset.lon);
 return (frequentPlacesData?.suggestions||[]).find(s=>Math.abs(Number(s.latitude)-lat)<0.00001&&Math.abs(Number(s.longitude)-lon)<0.00001)||{latitude:lat,longitude:lon};
}
function openFrequentPlaceSuggestion(s){
 showModal('Guardar lugar frecuente','<form id="placeForm" class="stack" style="margin-top:16px"><div class="field"><label>¿Cómo llamamos este lugar?</label><input class="input" name="name" placeholder="Universidad, café, casa de…" required maxlength="80"></div><div class="field"><label>Tipo</label><select name="kind"><option value="home">Casa</option><option value="work">Trabajo</option><option value="memory" selected>Recuerdo</option><option value="adventure">Aventura</option></select></div><div class="field"><label>Nota</label><textarea name="note" placeholder="Detectado porque has estado aquí varios días">Lugar sugerido por visitas frecuentes</textarea></div><input type="hidden" name="latitude" value="'+attr(s.latitude)+'"><input type="hidden" name="longitude" value="'+attr(s.longitude)+'"><p class="muted">La app sugiere la zona; tú eliges si realmente es un lugar importante y cómo guardarlo.</p><button class="btn" type="submit">Guardar en nuestro mapa</button></form>','place');
}

function historyPlacesView(){
 const places=mapData?.places||[];
 if(!places.length)return '<section class="section"><div class="section-head"><div><h2>Mapa de nuestra historia</h2><p>Guarden lugares y relaciónenlos con recuerdos para construirlo.</p></div></div><div class="empty">Aún no hay lugares guardados.</div></section>';
 return '<section class="section"><div class="section-head"><div><h2>Mapa de nuestra historia</h2><p>Lugares importantes conectados con lo que vivieron allí.</p></div></div><div class="history-places">'+places.map(p=>{const linked=(cloud.items||[]).filter(i=>Number(i.data?.placeId)===Number(p.id));return '<article class="card history-place"><button class="history-place-head" data-action="history-place" data-lat="'+attr(p.latitude)+'" data-lon="'+attr(p.longitude)+'"><span class="item-icon">'+ico(p.kind==='home'?'house':p.kind==='work'?'briefcase':p.kind==='adventure'?'compass':'heart')+'</span><span><b>'+esc(p.name)+'</b><small>'+esc(p.note||'Lugar guardado')+'</small></span></button><button class="btn small secondary" data-action="galaxy-share" data-card-type="PLACE" data-kind="place" data-id="'+attr(p.id)+'" data-title="'+attr(p.name)+'">'+ico('send')+' Compartir en Galaxy Chat</button><div class="history-links">'+(linked.length?linked.slice(0,5).map(i=>'<button class="history-memory" data-action="constellation-item" data-id="'+i.id+'">'+ico(kindMeta[i.kind]?.[0]||'sparkles')+' '+esc(i.data?.title||'Historia')+'</button>').join(''):'<button class="history-memory add" data-action="memory-at-place" data-id="'+p.id+'">'+ico('plus')+' Añadir recuerdo aquí</button>')+'</div></article>';}).join('')+'</div></section>';
}
function mapHistoryView(){
 if(!mapData)return '<div class="section">'+loading('Cargando recorridos')+'</div>';
 const trips=mapData.trips||[],events=mapData.events||[],encounters=mapData.encounters||[];
 return historyPlacesView()+'<section class="section" id="encounter-history"><div class="section-head"><div><h2>Actividad reciente</h2><p>Recorridos, llegadas y encuentros.</p></div></div><div class="stack">'+
 (trips.slice(0,4).map(t=>'<div class="card"><span class="badge">'+(names()[Number(t.person)]||'Nosotros')+'</span><h3 style="margin-top:8px">'+fmtDistance(t.distance_m)+' · '+fmtDuration(t.duration_s)+'</h3><p>'+esc(fmtDateTime(t.started_at))+(t.max_speed?' · máx. '+(Number(t.max_speed)*3.6).toFixed(0)+' km/h':'')+'</p><button class="btn small secondary" data-action="context-trip-recap" data-id="'+attr(t.id)+'">'+ico('map')+' Recap de recorrido</button></div>').join('')||
 events.slice(0,4).map(e=>'<div class="card"><h3>'+(e.event==='arrived'?'Llegada':'Salida')+'</h3><p>'+esc(fmtDateTime(e.happened_at))+'</p></div>').join('')||
 encounters.slice(0,3).map(e=>'<div class="card"><h3 class="icon-title">'+ico('heart')+'Nos encontramos</h3><p>'+esc(fmtDateTime(e.started_at))+'</p></div>').join('')||
 '<div class="empty">Aquí aparecerán los recorridos y encuentros que vayamos guardando.</div>')+
 '</div></section>';
}

async function openPairCode(target){
 const profile=names()[Number(target)]||('Perfil '+target);
 const r=await api('pair-code-create',{target_person:String(target),device_name:'Android de '+profile});
 showModal('Código para '+profile,'<div class="stack" style="margin-top:16px"><p>Este código vinculará el próximo teléfono como <b>'+esc(profile)+'</b>. Dura 10 minutos y sirve una sola vez.</p><input class="input" readonly value="'+attr(r.code)+'" aria-label="Código de vinculación"><button class="btn" data-action="pair-code-copy" data-code="'+attr(r.code)+'">'+ico('key')+' Copiar código</button><p class="muted">Antes de compartirlo, verifica que arriba diga el nombre correcto.</p></div>');
}

function deviceProfilesCard(){
 const me=String(cloud?.person??native.person??''),currentId=String(cloud?.device?.id||''),list=cloud?.devices||[],labels=names(),partner=labels[1]||'Adri',mine=labels[Number(me)]||myName();
 const rows=list.map(d=>{
   const current=String(d.id)===currentId,profile=labels[Number(d.person)]||('Perfil '+d.person),last=d.last_seen_at?fmtDateTime(d.last_seen_at):'sin actividad reciente';
   return '<div class="row between" style="gap:10px;padding:10px 0"><span class="row" style="min-width:0">'+ico('smartphone')+'<span style="min-width:0"><b>'+esc(d.name||'Android')+'</b><small class="muted">Perfil '+esc(profile)+' · '+esc(last)+(current?' · este teléfono':'')+'</small></span></span>'+(current?'<span class="badge good">Actual</span>':'<button class="btn small ghost" data-action="device-revoke" data-id="'+attr(d.id)+'">Revocar</button>')+'</div>';
 }).join('');
 const ownerControls=me==='0'
   ?'<div class="stack" style="margin-top:14px"><button class="btn" data-action="pair-code-partner">'+ico('key')+' Generar código para '+esc(partner)+'</button><button class="btn secondary" data-action="pair-code-self">Código para otro teléfono de '+esc(mine)+'</button><button class="btn danger" data-action="profile-repair">Este teléfono es de '+esc(partner)+'</button><p class="muted">Usa la última opción solo en el teléfono de '+esc(partner)+' si por error aparece vinculado como '+esc(mine)+'.</p></div>'
   :'<div class="stack" style="margin-top:14px"><button class="btn secondary" data-action="pair-code-self">'+ico('key')+' Código para otro teléfono de '+esc(mine)+'</button></div>';
 return '<div class="card"><div class="row between"><div><h3>Perfiles y teléfonos</h3><p>Este teléfono está entrando como <b>'+esc(mine)+'</b>. Cada código nuevo queda ligado al perfil que elijas.</p></div>'+ico('smartphone')+'</div><div class="stack" style="margin-top:10px">'+(rows||'<p class="muted">No hay otros teléfonos activos.</p>')+'</div>'+ownerControls+'</div>';
}

function gpsHistoryPrivacyCard(){
 return '<div class="card gps-history-card"><div class="row between"><div><p class="eyebrow">DATOS DE MOVILIDAD</p><h3>Historial GPS de '+esc(myName())+'</h3><p>Exporta o borra únicamente los datos de movilidad de este perfil. Lugares guardados, recuerdos, encuentros y datos de '+esc(partnerName())+' no se eliminan.</p></div>'+ico('route')+'</div><div class="gps-history-scope"><span>'+ico('user-round')+' Solo '+esc(myName())+'</span><span>'+ico('shield-check')+' Control individual</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="gps-history-export">'+ico('download')+' Exportar GPS</button><button class="btn small danger" data-action="gps-history-delete-open">'+ico('trash-2')+' Borrar historial GPS</button></div></div>';
}
function gpsExportProgress(dataset,total){
 const labels={history:'Puntos GPS',trips:'Recorridos',tripPoints:'Puntos de rutas',placeEvents:'Llegadas y salidas'};
 const label=labels[dataset]||'Historial GPS',status=modal.querySelector('#gpsExportStatus'),count=modal.querySelector('#gpsExportCount');
 if(status)status.textContent='Exportando '+label.toLowerCase()+'…';
 if(count)count.textContent=total+' registros preparados';
}
async function exportGpsHistory(){
 const helper=window.GalaxyGpsHistory;if(!helper)return;
 showModal('Exportar historial GPS','<div class="gps-export-progress">'+loading('Preparando historial GPS')+'<h3 id="gpsExportStatus">Preparando exportación…</h3><p id="gpsExportCount">0 registros preparados</p><p class="muted">El archivo contendrá solo los datos de movilidad de '+esc(myName())+'.</p></div>');
 const bundle=helper.emptyBundle(String(cloud.person),myName());
 try{
  for(const dataset of helper.DATASETS){
   let after=0,snapshot=0,done=false,pages=0;
   while(!done){
    if(++pages>1000)throw new Error('El historial es demasiado grande para exportarlo en una sola operación.');
    const page=await api('gps-history-export',{dataset,after,snapshot,limit:1000});
    if(!snapshot)snapshot=Number(page.snapshot||0);
    helper.appendPage(bundle,dataset,page.rows||[]);
    gpsExportProgress(dataset,helper.totalRows(bundle));
    done=!!page.done;
    if(!done){
      const next=Number(page.next||0);if(!Number.isFinite(next)||next<=after)throw new Error('La exportación GPS perdió el cursor.');
      after=next;
    }
   }
  }
  bundle.exportedAt=new Date().toISOString();
  const fileName=helper.exportFileName(cloud.today,myName());
  await GalaxyNative.call('exportJson',fileName,JSON.stringify(bundle));
  closeModal();toast('Historial GPS exportado: '+helper.totalRows(bundle)+' registros.');
 }catch(error){if(modal.open)closeModal();throw error;}
}
function openGpsHistoryDelete(){
 const own=(cloud?.locations||[]).find(l=>String(l.person)===String(cloud.person))||{};
 if(own.trip_active){showModal('Primero termina el recorrido','<div class="gps-delete-warning">'+ico('route')+'<div><h3>Hay un recorrido activo</h3><p>Termínalo antes de borrar el historial GPS para no dejar una ruta incompleta.</p><button class="btn small secondary" data-action="gps-history-map">Ir al mapa</button></div></div>');return;}
 showModal('Borrar historial GPS de '+myName(),'<form id="gpsHistoryDeleteForm" class="stack gps-delete-form" style="margin-top:16px"><div class="gps-delete-warning danger">'+ico('triangle-alert')+'<div><h3>Esta acción no se puede deshacer</h3><p>Se borrarán solo los puntos GPS, recorridos, puntos temporales de rutas y llegadas/salidas de '+esc(myName())+'.</p></div></div><div class="gps-preserved"><b>Se conserva:</b><span>Lugares guardados</span><span>Recuerdos y archivos</span><span>Encuentros compartidos</span><span>Datos de '+esc(partnerName())+'</span></div><div class="field"><label>Escribe BORRAR para confirmar</label><input class="input" name="confirmation" autocomplete="off" autocapitalize="characters" placeholder="BORRAR" required></div><p class="muted">'+(native.tracking?'La ubicación se pausará unos segundos, se limpiará la cola pendiente y volverá a activarse al terminar.':'La ubicación está pausada y seguirá así después del borrado.')+'</p><button class="btn danger" type="submit">'+ico('trash-2')+' Borrar únicamente mi historial GPS</button></form>','gps-delete');
}
async function deleteGpsHistory(){
 const helper=window.GalaxyGpsHistory,wasTracking=!!native.tracking;
 let stopped=false,serverDeleted=false,result=null;
 if(wasTracking){await GalaxyNative.call('stopLocation');stopped=true;native=nativeState();await new Promise(resolve=>setTimeout(resolve,700));}
 try{
  result=await api('gps-history-delete');serverDeleted=true;
  await GalaxyNative.call('clearPendingGps');
 }catch(error){
  if(stopped&&!serverDeleted){try{await GalaxyNative.call('startLocation');native=nativeState();}catch{}}
  if(serverDeleted)throw new Error('El historial del servidor se borró, pero Android no pudo limpiar la cola GPS pendiente. La ubicación quedó pausada para evitar que reaparezcan puntos antiguos.');
  throw error;
 }
 let restarted=false;
 if(wasTracking){
  try{await GalaxyNative.call('startLocation');native=nativeState();restarted=true;}
  catch{}
 }
 frequentPlacesData=null;frequentPlacesLoadedAt=0;mapData=null;
 await refreshState({quiet:true});
 closeModal();render();
 const total=Number(result?.deleted?.total||0);
 toast('Borrados '+total+' registros GPS de '+myName()+'.'+(wasTracking&&!restarted?' Ubicación quedó pausada.':''));
}

function themeIcon(id){
 return {auto:'sparkles',daylight:'sparkles',cosmic:'moon',halloween:'moon',christmas:'star',valentine:'heart',friendship:'hand-heart',easter:'flower-2'}[id]||'sparkles';
}
function themeSettingsCard(){
 const engine=window.GalaxyTheme;if(!engine)return'';
 const choice=engine.getChoice(),state=engine.resolve(choice),automatic=choice==='auto';
 return '<div class="card theme-settings-card"><div class="row between"><div><p class="eyebrow">APARIENCIA</p><h3>Temas de Nuestra Galaxia</h3><p>'+(automatic?'Automático está activo. Ahora se ve como <b>'+esc(engine.LABELS[state.active])+'</b>.':'Elegiste <b>'+esc(engine.LABELS[state.active])+'</b> manualmente.')+'</p></div>'+ico(themeIcon(state.active))+'</div><div class="theme-grid">'+engine.options().map(option=>'<button class="theme-option '+(choice===option.id?'active':'')+'" data-action="theme-set" data-value="'+attr(option.id)+'"><span class="theme-preview" data-preview="'+attr(option.id)+'">'+ico(themeIcon(option.id))+'</span><span><b>'+esc(option.label)+'</b><small>'+(option.id==='auto'?'Cambia con la fecha':option.id===state.active?'Vista actual':'Elegir tema')+'</small></span>'+(choice===option.id?ico('circle-check-big'):'')+'</button>').join('')+'</div><p class="theme-local-note">'+ico('smartphone')+' La apariencia se guarda en este teléfono. No cambia el tema del teléfono de '+esc(partnerName())+'.</p></div>';
}

function chatTime(value){try{return new Intl.DateTimeFormat('es-CO',{hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return'';}}
const CHAT_OUTBOX_KEY='nuestra-galaxia.chat-outbox.v3';
const CHAT_DRAFT_KEY='nuestra-galaxia.chat-draft.v3';
const CHAT_REACTIONS=['\u2764\uFE0F','\uD83D\uDE02','\uD83E\uDD79','\uD83D\uDE2E','\uD83D\uDE22','\uD83D\uDC4D'];

function chatDay(value){
 try{
  const d=new Date(value),today=new Date(),yesterday=new Date(Date.now()-86400000);
  const key=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  if(key(d)===key(today))return'Hoy';if(key(d)===key(yesterday))return'Ayer';
  return new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long'}).format(d);
 }catch{return'';}
}
function chatClock(value){try{return new Intl.DateTimeFormat('es-CO',{hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return'';}}
function chatSize(bytes){const n=Number(bytes||0);if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(1)+' MB';}
function readChatOutbox(){
 try{const rows=JSON.parse(localStorage.getItem(CHAT_OUTBOX_KEY)||'[]');return Array.isArray(rows)?rows.map(x=>({...x,_localState:x._localState==='SENDING'?'PENDING':(x._localState||'PENDING')})):[];}catch{return[];}
}
function writeChatOutbox(rows){try{localStorage.setItem(CHAT_OUTBOX_KEY,JSON.stringify((rows||[]).slice(-120)));}catch{}}
function readChatDraft(){try{return localStorage.getItem(CHAT_DRAFT_KEY)||'';}catch{return'';}}
function writeChatDraft(value){try{localStorage.setItem(CHAT_DRAFT_KEY,String(value||''));}catch{}}
function chatOwn(m){return String(m.sender_person)===String(cloud?.person);}
function chatPartnerLabel(){return chatPreferencesState?.partner_nickname||partnerName();}
function chatDelivery(m){
 const state=m._localState||m.status;
 if(state==='FAILED')return {text:'No enviado',icon:'circle-alert',cls:'failed'};
 if(state==='PENDING')return {text:'Pendiente',icon:'clock-3',cls:'pending'};
 if(state==='SENDING')return {text:'Enviando',icon:'loader-circle',cls:'sending'};
 if(state==='SCHEDULED')return {text:'Programado',icon:'calendar-clock',cls:'scheduled'};
 if(state==='CANCELLED')return {text:'Cancelado',icon:'ban',cls:'failed'};
 if(state==='READ'||m.read_at)return {text:'Leído',icon:'check-check',cls:'read'};
 if(state==='DELIVERED'||m.delivered_at)return {text:'Entregado',icon:'check-check',cls:'delivered'};
 return {text:'Enviado',icon:'check',cls:'sent'};
}
function chatPresenceLabel(){
 const p=chatState?.partnerPresence||{};
 if(p.state==='PRIVATE')return'Privacidad activada';
 if(p.state==='TYPING')return'Escribiendo…';
 if(p.state==='RECORDING_AUDIO')return'Grabando audio…';
 if(p.state==='UPLOADING_MEDIA')return'Subiendo archivo…';
 if(p.state==='ONLINE'&&p.online)return'En línea';
 if(p.lastActiveAt){
  const min=Math.max(0,Math.round((Date.now()-Date.parse(p.lastActiveAt))/60000));
  return min<1?'Activo hace un momento':min<60?'Última vez hace '+min+' min':'Última vez '+fmtDateTime(p.lastActiveAt);
 }
 return'Conversación privada';
}
function chatAttachmentMarkup(a,m=null){
 const kind=String(a.kind||'file'),url=attr(a.url||''),name=esc(a.name||'archivo'),caption=a.caption?'<small class="chat-media-caption">'+esc(a.caption)+'</small>':'';
 if(kind==='photo')return '<button class="chat-photo-card '+(m?.message_type==='gif'?'chat-gif-card':'')+'" type="button" data-action="chat-media-view" data-url="'+url+'" aria-label="Abrir '+(m?.message_type==='gif'?'GIF':'foto')+'"><img loading="lazy" src="'+url+'" alt="'+name+'"></button>'+caption;
 if(kind==='video'){
  const video='<video controls preload="metadata" playsinline src="'+url+'" aria-label="'+name+'"></video>';
  if(m?.message_type==='video_message')return '<div class="chat-video-message-card">'+video+'<small>Videomensaje'+(a.durationMs?' · '+Math.max(1,Math.round(a.durationMs/1000))+' s':'')+'</small></div>';
  return '<div class="chat-video-card">'+video+'<small>'+name+(a.sizeBytes?' · '+chatSize(a.sizeBytes):'')+'</small></div>'+caption;
 }
 if(kind==='audio'){
  const values=Array.isArray(a.waveform)&&a.waveform.length?a.waveform.slice(0,64):Array.from({length:32},(_,i)=>(18+((i*17)%62))/100);
  const bars=values.map(v=>'<i style="--h:'+Math.max(10,Math.round(Number(v||0)*100))+'%"></i>').join('');
  return '<div class="chat-audio-card"><div class="chat-waveform" aria-hidden="true">'+bars+'</div><audio preload="metadata" src="'+url+'"></audio><input class="chat-audio-scrub" type="range" min="0" max="100" value="0" aria-label="Posición del audio"><div class="chat-audio-controls"><button type="button" data-action="chat-audio-toggle">'+ico('play')+'</button><button type="button" data-action="chat-audio-speed" data-speed="1">1×</button><span>'+(a.durationMs?Math.max(1,Math.round(a.durationMs/1000))+' s':'Nota de voz')+'</span>'+(a.id?'<button type="button" class="chat-audio-transcript" data-action="chat-audio-transcript" data-attachment-id="'+attr(a.id)+'">Texto</button>':'')+'</div></div>';
 }
 return '<button class="chat-file-card" type="button" data-action="chat-file-open" data-url="'+url+'" data-name="'+attr(a.name||'archivo')+'" data-mime="'+attr(a.mime||'application/octet-stream')+'">'+ico('file-text')+'<span><b>'+name+'</b><small>'+esc(String(a.mime||'Archivo'))+(a.sizeBytes?' · '+chatSize(a.sizeBytes):'')+' · Abrir</small></span></button>'+caption;
}

function chatCardMeta(card){
 const labels={MEMORY:'Recuerdo',PLAN:'Plan',GOAL:'Objetivo',PLACE:'Lugar',SONG:'Canción',ETA:'ETA',CHECK_IN:'Check-in',POLL:'Encuesta',CHECKLIST:'Checklist',CAPSULE:'Cápsula',DAILY_QUESTION:'Pregunta del día',EVENT:'Evento',STATUS:'Estado'};
 const icons={MEMORY:'images',PLAN:'calendar-days',GOAL:'target',PLACE:'map-pin',SONG:'music-2',ETA:'navigation',CHECK_IN:'map-pin-check',POLL:'list-checks',CHECKLIST:'list-todo',CAPSULE:'package',DAILY_QUESTION:'message-circle-question',EVENT:'calendar',STATUS:'activity'};
 return {label:labels[card?.type]||'Nuestra Galaxia',icon:icons[card?.type]||'sparkles'};
}
function chatGalaxyCardMarkup(card,m){
 if(!card)return'';
 const meta=chatCardMeta(card);
 if(card.available===false)return '<div class="chat-galaxy-card unavailable"><span>'+ico('circle-off')+'</span><div><p class="eyebrow">'+esc(meta.label)+'</p><h3>Contenido no disponible</h3><p>'+esc(card.message||'Este contenido ya no está disponible.')+'</p></div></div>';
 if(card.type==='CAPSULE'&&card.locked)return '<div class="chat-galaxy-card locked"><span>'+ico('lock-keyhole')+'</span><div><p class="eyebrow">CÁPSULA BLOQUEADA</p><h3>'+esc(card.title||'Cápsula')+'</h3><p>'+(card.unlockType==='place'?'Se desbloquea al llegar al lugar elegido.':'Se desbloquea '+esc(fmtDateTime(card.unlockAt))+'.')+'</p></div></div>';
 if(card.type==='POLL'){
  const options=(card.options||[]).map(o=>'<button type="button" class="chat-poll-option '+(o.selected?'selected':'')+'" data-action="chat-poll-vote" data-poll-id="'+attr(card.entityId)+'" data-option-id="'+attr(o.id)+'" data-selected="'+(o.selected?'true':'false')+'" '+(card.closed?'disabled':'')+'><span><b>'+esc(o.label)+'</b><small>'+Number(o.votes||0)+' voto'+(Number(o.votes||0)===1?'':'s')+' · '+Number(o.percent||0)+'%</small></span><i style="--p:'+Math.max(0,Math.min(100,Number(o.percent||0)))+'%"></i></button>').join('');
  const resolution=card.closed?(card.tie?'<small class="muted">Empate: no existe un ganador único para convertir.</small>':card.noVotes?'<small class="muted">La encuesta cerró sin votos.</small>':card.winner?'<small class="muted">Ganador: '+esc(card.winner.label)+' · '+Number(card.winner.votes||0)+' voto'+(Number(card.winner.votes||0)===1?'':'s')+'</small>':''):'';
  const winnerAction=card.closed&&card.winner&&!card.tie?'<button type="button" data-action="chat-poll-plan" data-poll-id="'+attr(card.entityId)+'">'+ico('calendar-plus')+' Crear Plan del ganador: '+esc(card.winner.label)+'</button>':'';
  return '<div class="chat-galaxy-card poll"><div class="chat-card-head"><span>'+ico(meta.icon)+'</span><div><p class="eyebrow">'+(card.closed?'ENCUESTA CERRADA':'ENCUESTA')+'</p><h3>'+esc(card.question||card.title)+'</h3></div></div><div class="chat-poll-options">'+options+'</div>'+resolution+'<div class="chat-card-actions">'+(!card.closed&&String(card.createdBy)===String(cloud.person)?'<button type="button" data-action="chat-poll-close" data-id="'+attr(card.entityId)+'">'+ico('lock')+' Cerrar</button>':'')+winnerAction+'</div></div>';
 }
 if(card.type==='CHECKLIST'){
  const rows=(card.items||[]).map(x=>'<button type="button" class="chat-check-item '+(x.checked?'done':'')+'" data-action="chat-check-set" data-list-id="'+attr(card.entityId)+'" data-item-id="'+attr(x.id)+'" data-checked="'+(x.checked?'true':'false')+'" data-version="'+attr(x.version)+'">'+ico(x.checked?'square-check-big':'square')+'<span>'+esc(x.label)+'</span></button>').join('');
  return '<div class="chat-galaxy-card checklist"><div class="chat-card-head"><span>'+ico(meta.icon)+'</span><div><p class="eyebrow">CHECKLIST · '+Number(card.done||0)+'/'+Number(card.total||0)+'</p><h3>'+esc(card.title)+'</h3></div></div><div class="chat-check-items">'+rows+'</div><div class="chat-card-actions"><button type="button" data-action="chat-check-convert" data-kind="plan" data-id="'+attr(card.entityId)+'">'+ico('calendar-plus')+' Convertir a plan</button><button type="button" data-action="chat-check-convert" data-kind="goal" data-id="'+attr(card.entityId)+'">'+ico('target')+' Convertir a objetivo</button></div></div>';
 }
 if(card.type==='DAILY_QUESTION'){
  return '<div class="chat-galaxy-card daily"><div class="chat-card-head"><span>'+ico(meta.icon)+'</span><div><p class="eyebrow">PREGUNTA DEL DÍA</p><h3>'+esc(card.title)+'</h3></div></div>'+(card.myAnswer?'<p class="chat-card-answer"><b>Tú:</b> '+esc(card.myAnswer)+'</p>':'')+(card.revealed&&card.partnerAnswer?'<p class="chat-card-answer"><b>'+esc(partnerName())+':</b> '+esc(card.partnerAnswer)+'</p>':card.answeredByMe?'<small class="muted">La otra respuesta se revelará cuando ambos contesten.</small>':'')+(!card.answeredByMe?'<div class="chat-card-actions"><button type="button" data-action="chat-daily-answer" data-day="'+attr(card.day)+'">'+ico('message-square-reply')+' Responder</button></div>':'')+'</div>';
 }
 if(card.type==='ETA'||card.type==='CHECK_IN'){
  const eta=Number.isFinite(Number(card.etaSeconds))?fmtDuration(Number(card.etaSeconds)):'ETA pendiente',distance=Number.isFinite(Number(card.distanceM))?fmtDistance(Number(card.distanceM)):'';
  const traveler=names()[Number(card.person)]||'Nosotros',destination=card.title||'Destino',route=traveler+' → '+destination;
  return '<button type="button" class="chat-galaxy-card eta" data-action="chat-card-eta-map" data-id="'+attr(card.entityId)+'"><div class="chat-card-head"><span>'+ico(meta.icon)+'</span><div><p class="eyebrow">'+esc(card.visualStatus||meta.label)+'</p><h3>'+esc(route)+'</h3><p>'+esc([distance,eta,card.transport].filter(Boolean).join(' · '))+'</p></div></div><div class="chat-card-progress"><i style="--p:'+Math.max(0,Math.min(100,Number(card.progressPct||0)))+'%"></i></div><small>Última actualización: '+esc(fmtDateTime(card.updatedAt))+'</small></button>';
 }
 const body=card.body?'<p>'+esc(card.body)+'</p>':'';
 const ownLocation=(cloud?.locations||[]).find(l=>String(l.person)===String(cloud.person)&&l.sharing&&locationFreshState(l));
 const placeMeters=card.type==='PLACE'&&ownLocation?window.GalaxyDistance?.metersBetween?.(ownLocation,{latitude:Number(card.latitude),longitude:Number(card.longitude)}):null;
 const placeDistance=Number.isFinite(Number(placeMeters))?fmtDistance(Number(placeMeters)):'';
 const details=[card.date?fmtDate(card.date):'',card.time||'',card.targetDate?fmtDate(card.targetDate):'',placeDistance,card.artist||'',card.source||'',card.category||'',card.note||'',card.status||''].filter(Boolean).join(' · ');
 const songCover=card.type==='SONG'&&card.cover?'<img class="chat-song-cover" loading="lazy" src="'+attr(card.cover)+'" alt="Portada de '+attr(card.title||'canción')+'">':'';
 const capsuleMedia=card.type==='CAPSULE'?'<div class="capsule-reveal-media">'+(card.photoUrl?'<img loading="lazy" src="'+attr(card.photoUrl)+'" alt="Foto de la cápsula">':'')+(card.audioUrl?'<audio controls preload="metadata" src="'+attr(card.audioUrl)+'"></audio>':'')+(card.song?'<button type="button" data-action="chat-card-song-play" data-id="'+attr(card.song.id)+'">'+ico('play')+' '+esc(card.song.title||'Canción')+(card.song.artist?' · '+esc(card.song.artist):'')+'</button>':'')+'</div>':'';
 let actions='';
 if(card.type==='PLACE')actions='<button type="button" data-action="chat-card-place-map" data-id="'+attr(card.entityId)+'" data-lat="'+attr(card.latitude)+'" data-lon="'+attr(card.longitude)+'">'+ico('map')+' Ver mapa</button><button type="button" data-action="chat-card-place-go" data-id="'+attr(card.entityId)+'">'+ico('navigation')+' Ir</button><button type="button" data-action="chat-card-place-save" data-id="'+attr(card.entityId)+'">'+ico('bookmark-plus')+' Guardar</button>';
 if(card.type==='SONG')actions='<button type="button" data-action="chat-card-song-play" data-id="'+attr(card.entityId)+'">'+ico('play')+' Play</button><button type="button" data-action="chat-card-song-add" data-id="'+attr(card.entityId)+'">'+ico('list-music')+' Añadir a Nuestra Música</button>'+(card.url?'<button type="button" data-action="chat-smart-link" data-url="'+attr(card.url)+'">'+ico('external-link')+' Abrir fuente</button>':'');
 if(card.type==='EVENT')actions='<button type="button" data-action="chat-card-event-plan" data-id="'+attr(card.entityId)+'">'+ico('calendar-plus')+' Añadir a planes</button><button type="button" data-action="chat-card-event-remind" data-id="'+attr(card.entityId)+'">'+ico('bell')+' Recordarme</button>';
 if(card.type==='STATUS'&&String(card.entityId)!==String(cloud.person))actions='<button type="button" data-action="chat-card-status-reply" data-id="'+attr(card.entityId)+'">'+ico('message-circle-reply')+' Responder</button>';
 return '<div class="chat-galaxy-card '+String(card.type||'').toLowerCase()+'">'+songCover+'<div class="chat-card-head"><span>'+ico(meta.icon)+'</span><div><p class="eyebrow">'+esc(meta.label.toUpperCase())+'</p><h3>'+esc(card.title||meta.label)+'</h3>'+body+(details?'<small>'+esc(details)+'</small>':'')+'</div></div>'+capsuleMedia+(actions?'<div class="chat-card-actions">'+actions+'</div>':'')+'</div>';
}
function chatSmartDateTime(body){
 const value=String(body||''),iso=value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/)?.[0],latam=value.match(/\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(20\d{2})\b/);
 let date=iso||'';
 if(!date&&latam)date=latam[3]+'-'+String(latam[2]).padStart(2,'0')+'-'+String(latam[1]).padStart(2,'0');
 if(!date&&/\bmañana\b/i.test(value)&&cloud?.today){const d=new Date(cloud.today+'T12:00:00-05:00');d.setDate(d.getDate()+1);date=d.toISOString().slice(0,10);}
 if(!date&&/\bhoy\b/i.test(value))date=cloud?.today||'';
 const time=value.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/)?.[0]||'';
 return {date,time};
}
function chatSmartActionsMarkup(m){
 if(m.deleted_at||m.message_type==='card')return'';
 const actions=[];
 const url=String(m.body||'').match(/https:\/\/[^\s<]{4,1000}/i)?.[0];
 if(url)actions.push('<button type="button" data-action="chat-smart-link" data-url="'+attr(url)+'">'+ico('external-link')+' Abrir enlace</button>');
 const when=chatSmartDateTime(m.body);
 if(when.date)actions.push('<button type="button" data-action="chat-smart-plan" data-id="'+attr(m.id)+'" data-date="'+attr(when.date)+'">'+ico('calendar-plus')+' Crear plan</button>');
 if(when.date||when.time)actions.push('<button type="button" data-action="chat-smart-remind" data-id="'+attr(m.id)+'" data-date="'+attr(when.date||cloud?.today||'')+'" data-time="'+attr(when.time)+'">'+ico('bell')+' Recordarme</button>');
 if(m.message_type==='location'&&m.attachment?.latitude!=null)actions.push('<button type="button" data-action="chat-smart-place" data-id="'+attr(m.id)+'">'+ico('map-pin-plus')+' Guardar lugar</button>');
 return actions.length?'<div class="chat-smart-actions">'+actions.join('')+'</div>':'';
}
function chatRichMessageMarkup(m){
 let out='';
 if(m.message_type==='card'&&m.card)out+=chatGalaxyCardMarkup(m.card,m);
 if(m.view_once&&!chatOwn(m)){
  if(m.opened_at)out+='<div class="chat-view-once consumed">'+ico('eye-off')+'<span><b>Contenido visto</b><small>Era de una sola visualización.</small></span></div>';
  else out+='<button type="button" class="chat-view-once" data-action="chat-view-once" data-id="'+attr(m.id)+'">'+ico('eye')+'<span><b>Ver una vez</b><small>Foto, video o audio temporal.</small></span></button>';
 }else if(m.message_type==='sticker'&&m.sticker?.url)out+='<button class="chat-sticker-message" type="button" data-action="chat-stickers-open"><img loading="lazy" src="'+attr(m.sticker.url)+'" alt="'+attr(m.sticker.name||'Sticker')+'"></button>';
 else if(Array.isArray(m.attachments)&&m.attachments.length)out+='<div class="chat-media-grid">'+m.attachments.map(a=>chatAttachmentMarkup(a,m)).join('')+'</div>';
 if(m.message_type==='location'){
  if(m.attachment?.mode==='live'){
   const live=m.liveLocation||{},hasPoint=live.latitude!=null&&live.longitude!=null;
   out+='<div class="chat-location-card chat-live-location '+(live.active?'active':'ended')+'">'+ico(live.active?'radio':'map-pin')+'<span><b>'+(live.active?'Ubicación en vivo':'Ubicación en vivo finalizada')+'</b><small>'+(hasPoint?'Actualizada '+esc(fmtDateTime(live.updatedAt||m.created_at)):'Sin posición compartida ahora')+(live.endsAt?' · termina '+esc(fmtDateTime(live.endsAt)):'')+'</small></span>'+(hasPoint?'<button type="button" data-action="chat-location-open" data-lat="'+attr(live.latitude)+'" data-lon="'+attr(live.longitude)+'" aria-label="Ver mapa">'+ico('map')+'</button>':'')+(chatOwn(m)&&live.active?'<button type="button" data-action="chat-location-live-stop" data-id="'+attr(live.id)+'" aria-label="Detener">'+ico('square')+'</button>':'')+'</div>';
  }else if(m.attachment?.latitude!=null)out+='<button class="chat-location-card" type="button" data-action="chat-location-open" data-lat="'+attr(m.attachment.latitude)+'" data-lon="'+attr(m.attachment.longitude)+'">'+ico('map-pin')+'<span><b>'+esc(m.attachment.label||'Ubicación compartida')+'</b><small>Ver en el mapa</small></span></button>';
 }
 if(m.message_type==='song'&&m.attachment?.title)out+='<div class="chat-song-card">'+ico('music-2')+'<span><b>'+esc(m.attachment.title)+'</b><small>'+esc(m.attachment.platform||'Canción')+'</small></span></div>';
 if(m.body&&!m.deleted_at)out+='<div class="chat-formatted">'+chatFormatText(m.body)+'</div>';
 if(m.schedule_state==='pending'&&chatOwn(m))out+='<small class="chat-scheduled-note">'+ico('calendar-clock')+' Se enviará '+esc(fmtDateTime(m.scheduled_at))+(m.silent?' · en silencio':'')+'</small>';
 if(m.expires_at&&!m.deleted_at)out+='<small class="chat-expiry-note">'+ico('timer')+' Temporal hasta '+esc(fmtDateTime(m.expires_at))+'</small>';
 if(m.effect)out+='<span class="chat-effect-badge">'+ico('sparkles')+' '+esc(m.effect)+'</span>';
 if(m.link_preview?.url){
  const lp=m.link_preview;
  out+='<div class="chat-link-card">'+(lp.image?'<img loading="lazy" src="'+attr(lp.image)+'" alt="">':'<span>'+ico(lp.provider==='youtube'?'youtube':lp.provider==='spotify'?'music':'link')+'</span>')+'<div><b>'+esc(lp.title||lp.domain)+'</b><small>'+esc(lp.description||lp.domain||'')+'</small><em>'+esc(lp.domain||'')+'</em></div></div>';
 }
 if(m.deleted_at)out+='<p class="chat-deleted">'+ico('ban')+' Mensaje eliminado</p>';
 if(!m.deleted_at)out+=chatSmartActionsMarkup(m);
 return out||'<p></p>';
}
function chatReactionMarkup(m){
 const reactions=m.reactions||[];if(!reactions.length)return'';
 const groups=new Map();
 for(const r of reactions){const e=String(r.emoji||'');if(!groups.has(e))groups.set(e,[]);groups.get(e).push(String(r.person));}
 return '<div class="chat-reactions">'+[...groups.entries()].map(([emoji,people])=>'<button type="button" data-action="chat-react-quick" data-id="'+attr(m.id)+'" data-emoji="'+attr(emoji)+'" class="'+(people.includes(String(cloud.person))?'mine':'')+'">'+esc(emoji)+(people.length>1?'<small>'+people.length+'</small>':'')+'</button>').join('')+'</div>';
}
function chatMessageMarkup(m,{newDivider=false}={}){
 const own=chatOwn(m),d=chatDelivery(m),reply=m.reply;
 const local=m._localState;
 return (newDivider?'<div class="chat-new-divider" role="separator"><span>Mensajes nuevos</span></div>':'')+
 '<article class="chat-message '+(own?'own':'partner')+(local?' local':'')+'" data-chat-id="'+attr(m.id||m.client_id)+'" data-id="'+attr(m.id||'')+'" data-client-id="'+attr(m.client_id||'')+'">'+
 (reply?'<button type="button" class="chat-reply-preview" data-action="chat-jump" data-id="'+attr(reply.id)+'"><b>'+esc(String(reply.sender_person)===String(cloud.person)?'Tú':partnerName())+'</b><span>'+esc(reply.deleted_at?'Mensaje eliminado':reply.body||({photo:'Foto',video:'Video',audio:'Audio',file:'Archivo'}[reply.message_type]||'Mensaje'))+'</span></button>':'')+
 '<div class="chat-bubble">'+chatRichMessageMarkup(m)+(m.edited_at&&!m.deleted_at?'<span class="chat-edited">Editado</span>':'')+'</div>'+
 chatReactionMarkup(m)+
 '<div class="chat-meta"><span>'+esc(chatClock(m.server_received_at||m.created_at||m.client_created_at))+'</span>'+(own?'<span class="chat-status '+d.cls+'" title="'+esc(d.text)+'">'+ico(d.icon)+' '+esc(d.text)+'</span>':'')+(m.pin?'<span title="Fijado">'+ico('pin')+'</span>':'')+'</div>'+
 (local==='FAILED'?'<div class="chat-failed-actions"><button type="button" data-action="chat-retry" data-client-id="'+attr(m.client_id)+'">Reintentar</button><button type="button" data-action="chat-local-delete" data-client-id="'+attr(m.client_id)+'">Eliminar</button></div>':'')+
 '</article>';
}
function mergeChatOutbox(messages){
 const server=messages||[],serverClients=new Set(server.map(x=>String(x.client_id||'')));
 const local=readChatOutbox().filter(x=>!serverClients.has(String(x.client_id||''))).map(x=>({...x,id:'local:'+x.client_id,sender_person:String(cloud.person),created_at:x.client_created_at,server_seq:Number.MAX_SAFE_INTEGER-1000+(x.local_order||0)}));
 return [...server,...local].sort((a,b)=>{
  const sa=Number(a.server_seq||0),sb=Number(b.server_seq||0);
  if(sa!==sb)return sa-sb;
  return String(a.client_created_at||a.created_at||'').localeCompare(String(b.client_created_at||b.created_at||''));
 });
}
function chatMessagesMarkup(){
 if(chatLoading&&!chatState)return loading('Cargando mensajes');
 const list=mergeChatOutbox(chatState?.messages||[]);
 if(!list.length)return '<div class="chat-empty">'+ico('message-circle')+'<h3>Empiecen por aquí</h3><p>Este chat es privado y no entra automáticamente a Galaxy Intelligence.</p></div>';
 let out='',last='',dividerShown=false;
 for(const m of list){
  const day=chatDay(m.created_at||m.client_created_at);
  if(day!==last){out+='<div class="chat-day"><span>'+esc(day)+'</span></div>';last=day;}
  const unread=!dividerShown&&!chatOwn(m)&&!m.read_at&&!m.deleted_at&&!m._localState;
  out+=chatMessageMarkup(m,{newDivider:unread});if(unread)dividerShown=true;
 }
 return (chatState?.nextBeforeSeq?'<button class="chat-load-more" data-action="chat-load-more">'+ico('history')+' Cargar mensajes anteriores</button>':'')+out;
}
function chatDraftAttachmentMarkup(){
 if(!chatAttachmentsDraft.length)return'';
 return '<div class="chat-draft-media">'+chatAttachmentsDraft.map((a,i)=>'<div><span>'+ico(a.kind==='photo'?'image':a.kind==='video'?'video':a.kind==='audio'?'mic':'file')+'</span><small>'+esc(a.name||a.kind)+'</small><button type="button" data-action="chat-attachment-remove" data-index="'+i+'" aria-label="Quitar adjunto">'+ico('x')+'</button></div>').join('')+'</div>';
}
function chatPinnedBar(){
 const ids=chatState?.pinnedIds||[];if(!ids.length)return'';
 chatPinIndex=Math.min(chatPinIndex,Math.max(0,ids.length-1));const id=ids[chatPinIndex];
 const m=(chatState?.messages||[]).find(x=>String(x.id)===String(id));
 const label=m?(m.deleted_at?'Mensaje eliminado':m.body||({photo:'Foto',video:'Video',audio:'Audio',file:'Archivo'}[m.message_type]||'Mensaje fijado')):'Mensaje fijado';
 return '<div class="chat-pinned"><button type="button" data-action="chat-pin-jump" data-id="'+attr(id)+'">'+ico('pin')+'<span><b>Fijado '+(chatPinIndex+1)+'/'+ids.length+'</b><small>'+esc(label)+'</small></span></button><div><button type="button" data-action="chat-pin-prev" aria-label="Anterior">'+ico('chevron-up')+'</button><button type="button" data-action="chat-pin-next" aria-label="Siguiente">'+ico('chevron-down')+'</button><button type="button" data-action="chat-pins-open" aria-label="Ver fijados">'+ico('list')+'</button></div></div>';
}
function chatView(){
 const draft=readChatDraft();
 return '<section class="chat-shell chat-theme-'+attr(chatPreferencesState?.theme||'galaxy')+'">'+
 '<header class="chat-shell-head"><button class="chat-back" type="button" data-action="chat-close" aria-label="Volver">'+ico('arrow-left')+'</button><div class="chat-avatar">'+esc(chatPartnerLabel().slice(0,1).toUpperCase())+'</div><div class="chat-contact"><p class="eyebrow">GALAXY CHAT</p><h2>'+esc(chatPartnerLabel())+'</h2><small>'+esc(chatPresenceLabel())+'</small></div><button class="chat-head-action" type="button" data-action="chat-search-open" aria-label="Buscar">'+ico('search')+'</button><button class="chat-head-action" type="button" data-action="chat-shared-open" aria-label="Contenido compartido">'+ico('layout-grid')+'</button><button class="chat-head-action" type="button" data-action="chat-saved-open" aria-label="Guardados">'+ico('bookmark')+'</button><button class="chat-head-action" type="button" data-action="chat-settings-open" aria-label="Ajustes del chat">'+ico('settings-2')+'</button></header>'+
 '<div class="chat-pinned-slot">'+chatPinnedBar()+'</div>'+
 '<div class="chat-scroll-wrap"><div id="chatMessages" class="chat-messages" tabindex="0" aria-label="Mensajes">'+chatMessagesMarkup()+'</div>'+(chatNewCount?'<button class="chat-new-button" type="button" data-action="chat-jump-present">'+ico('arrow-down')+' '+chatNewCount+' mensaje'+(chatNewCount===1?'':'s')+' nuevo'+(chatNewCount===1?'':'s')+'</button>':'')+'</div>'+
 '<form id="chatForm" class="chat-composer" autocomplete="off">'+
 (chatReply?'<div class="chat-compose-reply"><span>'+ico('reply')+' Respondiendo a '+esc(chatOwn(chatReply)?'ti':partnerName())+'<small>'+esc(chatReply.body||'Mensaje')+'</small></span><button type="button" data-action="chat-reply-cancel" aria-label="Cancelar respuesta">'+ico('x')+'</button></div>':'')+
 chatDraftAttachmentMarkup()+
 '<div class="chat-compose-row"><button class="chat-plus" type="button" data-action="chat-attach-open" aria-label="Adjuntar">'+ico('plus')+'</button><textarea name="body" maxlength="4000" rows="1" placeholder="Mensaje para '+attr(chatPartnerLabel())+'" aria-label="Mensaje">'+esc(draft)+'</textarea><button class="chat-camera" type="button" data-action="chat-camera-open" aria-label="Abrir cámara">'+ico('camera')+'</button>'+(draft||chatAttachmentsDraft.length?'<button class="chat-send" type="submit" aria-label="Enviar">'+ico('send')+'</button>':'<button class="chat-send chat-mic-hold" type="button" data-action="chat-hold-record" aria-label="Mantén pulsado para grabar">'+ico('mic')+'</button>')+'</div><div class="chat-hold-hint" aria-live="polite" hidden></div></form></section>';
}
async function loadChatPreferences(){
 try{const result=await api('chat-preferences',{operation:'get'});chatPreferencesState=result.preferences||null;if(view==='chat')render();}catch{}
}
function openChatSettings(){
 const p=chatPreferencesState||{};
 showModal('Ajustes del chat','<form id="chatPreferencesForm" class="stack"><div class="field"><label>Apodo para '+esc(partnerName())+'</label><input class="input" name="partnerNickname" maxlength="40" value="'+attr(p.partner_nickname||'')+'" placeholder="'+attr(partnerName())+'"></div><div class="field"><label>Tema del chat</label><select class="input" name="theme"><option value="galaxy">Galaxia</option><option value="sunflowers">Girasoles</option><option value="night">Noche</option><option value="cyberpunk">Cyberpunk</option><option value="romantic">Romántico</option><option value="minimal">Minimalista</option></select></div><div class="field"><label>Privacidad de notificaciones</label><select class="input" name="notificationPrivacy"><option value="full">Nombre y contenido</option><option value="name">Solo nombre</option><option value="generic">Solo “Nuevo mensaje”</option></select></div><label class="chat-setting-toggle"><input type="checkbox" name="showRead" '+(p.show_read!==false?'checked':'')+'> Compartir confirmaciones de lectura</label><label class="chat-setting-toggle"><input type="checkbox" name="showLastSeen" '+(p.show_last_seen!==false?'checked':'')+'> Mostrar última conexión</label><label class="chat-setting-toggle"><input type="checkbox" name="showTyping" '+(p.show_typing!==false?'checked':'')+'> Mostrar “escribiendo…”</label><div class="field"><label>Mensajes temporales por defecto</label><select class="input" name="defaultTtlSeconds"><option value="">Desactivados</option><option value="3600">1 hora</option><option value="86400">24 horas</option><option value="604800">7 días</option><option value="2592000">30 días</option><option value="custom">Personalizado</option></select></div><div class="field" data-role="chat-default-ttl-custom" hidden><label>Horas</label><input class="input" type="number" name="defaultTtlHours" min="1" max="8760" value="48"></div><div class="chat-security-card"><span>'+ico('lock-keyhole')+'</span><div><b>Bloqueo del chat</b><small>'+(native.chatLockEnabled?'Protegido con biometría/PIN del teléfono':'Sin bloqueo adicional')+'</small></div><button class="btn small secondary" type="button" data-action="chat-lock-toggle" data-enabled="'+(native.chatLockEnabled?'true':'false')+'">'+(native.chatLockEnabled?'Desactivar':'Activar')+'</button></div><button class="btn" type="submit">Guardar ajustes</button></form>','chat-settings');
 const f=modal.querySelector('#chatPreferencesForm');if(f){f.theme.value=p.theme||'galaxy';f.notificationPrivacy.value=p.notification_privacy||'full';const fixed=['','3600','86400','604800','2592000'],ttl=p.default_ttl_seconds?String(p.default_ttl_seconds):'';f.defaultTtlSeconds.value=fixed.includes(ttl)?ttl:'custom';const custom=f.querySelector('[data-role="chat-default-ttl-custom"]');if(custom){custom.hidden=f.defaultTtlSeconds.value!=='custom';if(ttl&&!fixed.includes(ttl))f.defaultTtlHours.value=Math.max(1,Math.round(Number(ttl)/3600));}}
}
function openChatSendMenu(){
 const hasViewOnce=chatAttachmentsDraft.length>0&&chatAttachmentsDraft.every(a=>['photo','video','audio'].includes(a.kind));
 const hasMedia=chatAttachmentsDraft.some(a=>a.kind==='photo'||a.kind==='video');
 const min=new Date(Date.now()+60000);min.setSeconds(0,0);const local=new Date(min.getTime()-min.getTimezoneOffset()*60000).toISOString().slice(0,16);
 showModal('Opciones de envío','<div class="chat-send-options"><button class="card" type="button" data-action="chat-send-mode" data-mode="now">'+ico('send')+'<span><b>Enviar ahora</b><small>Envío normal.</small></span></button><button class="card" type="button" data-action="chat-send-mode" data-mode="silent">'+ico('bell-off')+'<span><b>Enviar en silencio</b><small>Sin sonido ni vibración.</small></span></button></div><form id="chatPremiumSendForm" class="stack"><div class="field"><label>Programar</label><input class="input" type="datetime-local" name="scheduledAt" min="'+attr(local)+'" value="'+attr(local)+'"></div><div class="field"><label>Mensaje temporal</label><select class="input" name="ttlSeconds" data-role="chat-ttl"><option value="">No</option><option value="3600">1 hora</option><option value="86400">24 horas</option><option value="604800">7 días</option><option value="2592000">30 días</option><option value="custom">Personalizado</option></select></div><div class="field" data-role="chat-ttl-custom" hidden><label>Horas</label><input class="input" type="number" name="ttlCustomHours" min="1" max="8760" value="48"></div>'+(hasViewOnce?'<label class="chat-setting-toggle"><input type="checkbox" name="viewOnce"> Ver una vez</label>':'')+(hasMedia?'<div class="field"><label>Calidad de envío</label><select class="input" name="mediaQuality"><option value="optimized">Optimizado</option><option value="hd">HD</option><option value="original">Original</option></select></div>':'')+'<div class="field"><label>Efecto</label><select class="input" name="effect"><option value="">Sin efecto</option><option value="hearts">Corazones</option><option value="confetti">Confeti</option><option value="stars">Estrellas</option><option value="kiss">Beso</option><option value="sunflowers">Girasoles</option><option value="galaxy">Galaxia</option></select></div><button class="btn" type="submit">'+ico('calendar-clock')+' Programar envío</button></form>','chat-send-options');
}
function queueCurrentChat(extra={}){
 const body=readChatDraft().trim(),attachments=chatAttachmentsDraft.slice();if(!body&&!attachments.length)return;
 const messageType=attachments.length?(attachments[0].videoMessage?'video_message':attachments[0].gif?'gif':(attachments[0].kind||'file')):'text';
 queueChatMessage({body,messageType,attachments,...extra});
}
function chatSignature(state){
 const messages=(state?.messages||[]).map(m=>[m.id,m.body,m.deleted_at,m.edited_at,m.delivered_at,m.read_at,m.reply_to,m.server_seq,m.schedule_state,m.expires_at,m.opened_at,m.effect,JSON.stringify(m.reactions||[]),!!m.pin,!!m.favorite,JSON.stringify(m.attachments||[]),JSON.stringify(m.sticker||null),JSON.stringify(m.liveLocation||null),JSON.stringify(m.card||null)]);
 return JSON.stringify([messages,state?.unread||0,state?.partnerLastReadAt||'',state?.nextBeforeSeq||'',state?.partnerPresence||{},state?.pinnedIds||[]]);
}
function chatCapturePlayback(){
 const audio=document.querySelector('.chat-audio-card audio:not([paused])');
 if(!audio||audio.paused)return null;
 return {src:audio.currentSrc||audio.src,time:audio.currentTime,rate:audio.playbackRate};
}
function chatRestorePlayback(snapshot){
 if(!snapshot)return;
 const audio=[...document.querySelectorAll('.chat-audio-card audio')].find(x=>(x.currentSrc||x.src)===snapshot.src);
 if(audio){audio.currentTime=snapshot.time||0;audio.playbackRate=snapshot.rate||1;audio.play().catch(()=>{});}
}
function chatNearBottom(el=document.querySelector('#chatMessages')){return !el||el.scrollHeight-el.scrollTop-el.clientHeight<110;}
async function markChatReadIfVisible(){
 if(view!=='chat'||document.visibilityState!=='visible')return;
 const el=document.querySelector('#chatMessages');if(!chatNearBottom(el))return;
 const last=[...(chatState?.messages||[])].reverse().find(m=>!chatOwn(m));
 if(!last||last.read_at)return;
 try{await api('chat-read',{messageId:last.id});GalaxyNative.call('clearChatNotifications').catch(()=>{});last.read_at=new Date().toISOString();chatNewCount=0;if(cloud?.chat)cloud.chat.unread=0;}catch{}
}
async function loadChat({older=false,quiet=false,force=false,aroundId=''}={}){
 if(chatLoading){if(older||force||aroundId)chatQueuedLoad={older,quiet,force,aroundId};return;}chatLoading=true;
 const current=document.querySelector('#chatMessages'),oldHeight=current?.scrollHeight||0,oldTop=current?.scrollTop||0,wasNear=chatNearBottom(current),oldLastSeq=Math.max(0,...(chatState?.messages||[]).map(x=>Number(x.server_seq||0))),playback=chatCapturePlayback();
 try{
  const beforeSeq=older?chatState?.nextBeforeSeq:null;
  const result=await api('chat-state',{limit:60,...(beforeSeq?{beforeSeq}:{}),...(aroundId?{aroundId}:{})});
  let nextState=result;
  if(older&&chatState){
   const map=new Map([...(result.messages||[]),...(chatState.messages||[])].map(m=>[String(m.id),m]));
   nextState={...result,messages:[...map.values()].sort((a,b)=>Number(a.server_seq||0)-Number(b.server_seq||0)),pinnedIds:result.pinnedIds||chatState.pinnedIds||[]};
  }
  const newIncoming=(nextState.messages||[]).filter(m=>Number(m.server_seq||0)>oldLastSeq&&!chatOwn(m));
  const added=newIncoming.length,effectToPlay=[...newIncoming].reverse().find(m=>m.effect)?.effect||null;
  const nextSignature=chatSignature(nextState),changed=force||older||aroundId||nextSignature!==chatStateSignature||!chatState;
  chatState=nextState;chatStateSignature=nextSignature;
  if(view==='chat'){
   if(changed){
    if(!wasNear&&!older&&!aroundId&&added)chatNewCount+=added;
    render();
    requestAnimationFrame(()=>{
     const el=document.querySelector('#chatMessages');if(!el)return;
     if(older)el.scrollTop=Math.max(0,oldTop+(el.scrollHeight-oldHeight));
     else if(aroundId){const target=document.querySelector('[data-chat-id="'+CSS.escape(String(aroundId))+'"]');target?.scrollIntoView({block:'center'});target?.classList.add('chat-highlight');setTimeout(()=>target?.classList.remove('chat-highlight'),1800);}
     else if(wasNear||chatInitialScroll){el.scrollTop=el.scrollHeight;chatNewCount=0;chatInitialScroll=false;}
     chatRestorePlayback(playback);
     if(effectToPlay)setTimeout(()=>runChatEffect(effectToPlay),80);
     setTimeout(()=>markChatReadIfVisible(),40);
    });
   }else await markChatReadIfVisible();
  }else renderChatFab();
 }catch(error){if(!quiet)toast(error.message||'No pudimos cargar el chat.');}
 finally{chatLoading=false;const queued=chatQueuedLoad;chatQueuedLoad=null;if(queued)setTimeout(()=>loadChat(queued),0);}
}
async function refreshChatBadge(){
 if(!native.paired)return;
 try{const result=await api('chat-state',{limit:20});if(cloud?.chat)cloud.chat.unread=Number(result.unread||0);renderChatFab();}catch{}
}
function patchLocalMessage(clientId,patch){
 const rows=readChatOutbox(),i=rows.findIndex(x=>String(x.client_id)===String(clientId));
 if(i>=0){rows[i]={...rows[i],...patch};writeChatOutbox(rows);}
 if(view==='chat')render();
}
async function flushChatOutbox({retryFailed=false}={}){
 if(!native.paired||!navigator.onLine)return;
 if(chatOutboxFlushPromise){
  await chatOutboxFlushPromise;
  if(retryFailed)return flushChatOutbox({retryFailed:true});
  return;
 }
 const run=(async()=>{
  chatOutboxFlushing=true;
  try{
   let rows=readChatOutbox();
   for(const item of rows.slice()){
    if(item._localState==='FAILED'&&!retryFailed)continue;
    if(item.retryCount>=8&&item._localState==='FAILED')continue;
    patchLocalMessage(item.client_id,{_localState:'SENDING'});
    try{
     const result=await api('chat-send',{clientId:item.client_id,clientCreatedAt:item.client_created_at,body:item.body||'',replyTo:item.reply_to||null,messageType:item.message_type||'text',attachments:item.attachments||[],attachment:item.attachment||{},entityRef:item.entityRef||null,scheduledAt:item.scheduled_at||null,silent:item.silent===true,ttlSeconds:item.ttl_seconds||null,viewOnce:item.view_once===true,effect:item.effect||null,retryCount:Number(item.retryCount||0)});
     rows=readChatOutbox().filter(x=>String(x.client_id)!==String(item.client_id));writeChatOutbox(rows);
     if(result?.message){chatState=chatState||{messages:[],unread:0,pinnedIds:[]};const map=new Map([...(chatState.messages||[]),result.message].map(x=>[String(x.id),x]));chatState.messages=[...map.values()].sort((a,b)=>Number(a.server_seq||0)-Number(b.server_seq||0));}
     try{await api('chat-metric',{event:'sent',messageId:result?.message?.id,retryCount:Number(item.retryCount||0)});}catch{}
     if(view==='chat')render();
    }catch(error){
     const nextRetry=Number(item.retryCount||0)+1;
     patchLocalMessage(item.client_id,{_localState:'FAILED',retryCount:nextRetry,failureCode:String(error?.message||'send_failed').slice(0,80)});
     try{await api('chat-metric',{event:'failed',retryCount:nextRetry,failureCode:String(error?.message||'send_failed').slice(0,80)});}catch{}
    }
   }
  }finally{chatOutboxFlushing=false;}
 })();
 chatOutboxFlushPromise=run;
 try{return await run;}
 finally{if(chatOutboxFlushPromise===run)chatOutboxFlushPromise=null;}
}
function queueChatMessage({body='',messageType='text',attachments=[],attachment={},entityRef=null,card=null,scheduledAt=null,silent=false,ttlSeconds=null,viewOnce=false,effect=null}={}){
 const text=String(body||'').trim();
 if(!text&&messageType==='text'&&!attachments.length)return;
 if(messageType==='card'&&!entityRef)return;
 const clientId=crypto.randomUUID(),created=new Date().toISOString();
 const row={client_id:clientId,client_created_at:created,body:text,reply_to:chatReply?.id||null,message_type:messageType,attachments,attachment,entityRef,card,scheduled_at:scheduledAt,silent,ttl_seconds:ttlSeconds,view_once:viewOnce,effect,_localState:'PENDING',retryCount:0,local_order:Date.now()};
 const rows=readChatOutbox();rows.push(row);writeChatOutbox(rows);
 chatReply=null;chatAttachmentsDraft=[];writeChatDraft('');
 try{api('chat-metric',{event:'queued',retryCount:0}).catch(()=>{});}catch{}
 if(view==='chat'){render();requestAnimationFrame(()=>{const el=document.querySelector('#chatMessages');if(el)el.scrollTop=el.scrollHeight;});}
 flushChatOutbox().then(()=>loadChat({quiet:true,force:true})).catch(()=>{});
}
function queueGalaxyCard(cardType,entityKind,entityId,localCard={}){
 if(!entityId)return;
 queueChatMessage({messageType:'card',entityRef:{cardType,entityKind,entityId:String(entityId)},card:{available:true,type:cardType,entityKind,entityId:String(entityId),...localCard}});
}
function shareGalaxyEntity(cardType,entityKind,entityId,title=''){
 if(!entityId)return;queueGalaxyCard(cardType,entityKind,entityId,{title});toast('Compartido en Galaxy Chat.');
}
function setChatPresence(state='ONLINE'){
 clearTimeout(chatPresenceTimer);
 api('chat-presence',{state}).then(result=>{if(chatState&&result.partner)chatState.partnerPresence=result.partner;}).catch(()=>{});
 if(state!=='OFFLINE')chatPresenceTimer=setTimeout(()=>{if(view==='chat'&&document.visibilityState==='visible')setChatPresence('ONLINE');},state==='ONLINE'?30000:6500);
}
function chatTyping(){
 clearTimeout(chatTypingTimer);setChatPresence('TYPING');
 chatTypingTimer=setTimeout(()=>{if(view==='chat')setChatPresence('ONLINE');},5000);
}
function jumpToChatMessage(id){
 const el=[...document.querySelectorAll('[data-chat-id]')].find(x=>String(x.dataset.chatId)===String(id));
 if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('chat-highlight');setTimeout(()=>el.classList.remove('chat-highlight'),1800);return Promise.resolve();}
 return loadChat({aroundId:String(id),quiet:true,force:true});
}
function openChatMessageMenu(id){
 const m=mergeChatOutbox(chatState?.messages||[]).find(x=>String(x.id)===String(id));if(!m||m._localState)return;
 const own=chatOwn(m),mine=(m.reactions||[]).find(r=>String(r.person)===String(cloud.person))?.emoji||'';
 const reactions=CHAT_REACTIONS.map(e=>'<button type="button" class="'+(mine===e?'active':'')+'" data-action="chat-react-menu" data-id="'+attr(m.id)+'" data-emoji="'+attr(e)+'">'+e+'</button>').join('');
 const canEdit=own&&!m.deleted_at&&m.message_type==='text'&&(m.schedule_state==='pending'||Date.now()-Date.parse(m.created_at)<15*60000);
 const photoAttachment=(m.attachments||[]).find(a=>a.kind==='photo');
 showModal('Mensaje','<div class="chat-reaction-picker">'+reactions+'</div><div class="chat-menu-list">'+
 '<button type="button" data-action="chat-reply-menu" data-id="'+attr(m.id)+'">'+ico('reply')+' Responder</button>'+
 (canEdit?'<button type="button" data-action="chat-edit-open" data-id="'+attr(m.id)+'">'+ico('pencil')+' Editar</button>':'')+
 '<button type="button" data-action="chat-pin-toggle" data-id="'+attr(m.id)+'" data-pinned="'+(m.pin?'true':'false')+'">'+ico('pin')+' '+(m.pin?'Desfijar':'Fijar')+'</button>'+
 '<button type="button" data-action="chat-favorite-toggle" data-id="'+attr(m.id)+'" data-saved="'+(m.favorite?'true':'false')+'">'+ico('bookmark')+' '+(m.favorite?'Quitar de guardados':'Guardar mensaje')+'</button>'+
  (!m.deleted_at?'<button type="button" data-action="chat-save-as-open" data-id="'+attr(m.id)+'">'+ico('folder-plus')+' Guardar como…</button>':'')+
 (m.body&&!m.deleted_at?'<button type="button" data-action="chat-translate" data-id="'+attr(m.id)+'">'+ico('languages')+' Traducir</button>':'')+
 (own&&m.schedule_state==='pending'?'<button type="button" data-action="chat-schedule-edit" data-id="'+attr(m.id)+'">'+ico('calendar-clock')+' Cambiar programación</button>':'')+
 (photoAttachment?'<button type="button" data-action="chat-sticker-create" data-attachment-id="'+attr(photoAttachment.id)+'">'+ico('sticker')+' Crear sticker</button><button type="button" data-action="chat-album-add-open" data-attachment-id="'+attr(photoAttachment.id)+'">'+ico('images')+' Añadir a álbum</button>':'')+
 '<button type="button" data-action="chat-delete-open" data-id="'+attr(m.id)+'">'+ico('trash-2')+' Eliminar</button></div>','chat-message-menu');
}
function openChatEdit(id){
 const m=(chatState?.messages||[]).find(x=>String(x.id)===String(id));if(!m)return;
 showModal('Editar mensaje','<form id="chatEditForm" class="stack"><input type="hidden" name="id" value="'+attr(id)+'"><div class="field"><label>Mensaje</label><textarea class="input" name="body" maxlength="4000" rows="5" required>'+esc(m.body||'')+'</textarea></div><button class="btn" type="submit">Guardar cambios</button></form>','chat-edit');
}
function openChatDelete(id){
 showModal('Eliminar mensaje','<div class="chat-delete-options"><button class="card" type="button" data-action="chat-delete-scope" data-id="'+attr(id)+'" data-scope="me">'+ico('eye-off')+'<span><b>Eliminar para mí</b><small>Solo desaparece de este perfil.</small></span></button><button class="card danger" type="button" data-action="chat-delete-scope" data-id="'+attr(id)+'" data-scope="both">'+ico('trash-2')+'<span><b>Eliminar para ambos</b><small>Disponible para mensajes propios dentro de la ventana permitida.</small></span></button></div>','chat-delete');
}
async function openChatCollection(kind){
 const result=await api(kind==='pins'?'chat-pins':'chat-saved'),rows=result.messages||[];
 showModal(kind==='pins'?'Mensajes fijados':'Guardados','<div class="chat-result-list">'+(rows.length?rows.map(m=>'<button type="button" data-action="chat-result-jump" data-id="'+attr(m.id)+'"><span>'+ico(kind==='pins'?'pin':'bookmark')+'</span><div><b>'+esc(chatOwn(m)?'Tú':partnerName())+'</b><small>'+esc(m.deleted_at?'Mensaje eliminado':m.body||({photo:'Foto',video:'Video',audio:'Audio',file:'Archivo'}[m.message_type]||'Mensaje'))+'</small><em>'+esc(fmtDateTime(m.created_at))+'</em></div></button>').join(''):'<div class="empty">Todavía no hay mensajes aquí.</div>')+'</div>','chat-collection');
}
function openChatSearch(){
 showModal('Buscar en el chat','<form id="chatSearchForm" class="chat-search-form"><input class="input" name="query" placeholder="Buscar texto o contenido…"><input class="input" type="date" name="date"><select class="input" name="sender"><option value="all">Todos</option><option value="me">Tú</option><option value="partner">'+esc(partnerName())+'</option></select><select class="input" name="type"><option value="all">Todo</option><option value="messages">Mensajes</option><option value="memories">Recuerdos</option><option value="plans">Planes</option><option value="music">Música</option><option value="places">Lugares</option><option value="goals">Objetivos</option><option value="polls">Encuestas</option><option value="checklists">Checklists</option><option value="capsules">Cápsulas</option><option value="events">Eventos</option><option value="eta">ETA / Acompáñame</option><option value="daily">Pregunta del día</option><option value="status">Estados</option><option value="photo">Fotos</option><option value="video">Videos</option><option value="audio">Audio</option><option value="file">Archivos</option><option value="link">Links</option></select><button class="btn" type="submit">'+ico('search')+' Buscar</button></form><div id="chatSearchResults" class="chat-result-list"></div>','chat-search');
}
async function runChatSearch(form,{beforeSeq=0,append=false}={}){
 const fd=new FormData(form),result=await api('chat-search',{query:String(fd.get('query')||''),date:String(fd.get('date')||''),sender:String(fd.get('sender')||'all'),type:String(fd.get('type')||'all'),beforeSeq:Number(beforeSeq||0),limit:40});
 const box=modal.querySelector('#chatSearchResults'),rows=result.messages||[];
 if(!box)return;
 const markup=rows.map(m=>'<button type="button" data-action="chat-result-jump" data-id="'+attr(m.id)+'"><span>'+ico(m.message_type==='card'?chatCardMeta(m.card).icon:m.message_type==='photo'?'image':m.message_type==='video'?'video':m.message_type==='audio'?'mic':m.message_type==='file'?'file':'message-circle')+'</span><div><b>'+esc(chatOwn(m)?'Tú':partnerName())+'</b><small>'+esc(m.card?.available?m.card.title:(m.body||({photo:'Foto',video:'Video',audio:'Audio',file:'Archivo'}[m.message_type]||'Mensaje')))+'</small><em>'+esc(fmtDateTime(m.created_at))+'</em></div></button>').join('');
 if(append){
  box.querySelector('[data-action="chat-search-more"]')?.remove();
  if(markup)box.insertAdjacentHTML('beforeend',markup);
 }else box.innerHTML=markup||'<div class="empty">Sin coincidencias.</div>';
 if(result.nextBeforeSeq){
  box.insertAdjacentHTML('beforeend','<button class="btn small secondary chat-search-more" type="button" data-action="chat-search-more" data-before-seq="'+attr(result.nextBeforeSeq)+'">'+ico('history')+' Cargar resultados anteriores</button>');
 }
 refreshIcons();
}

function chatFormatText(value){
 const inline=input=>{
  let x=esc(String(input||''));
  x=x.replace(/`([^`\n]{1,500})`/g,'<code>$1</code>');
  x=x.replace(/\*\*([^*\n]{1,1000})\*\*/g,'<strong>$1</strong>');
  x=x.replace(/~~([^~\n]{1,1000})~~/g,'<s>$1</s>');
  x=x.replace(/(^|[^*])\*([^*\n]{1,1000})\*/g,'$1<em>$2</em>');
  x=x.replace(/\|\|([^|\n]{1,1000})\|\|/g,'<button type="button" class="chat-spoiler" data-action="chat-spoiler-reveal">Spoiler</button><span class="chat-spoiler-text" hidden>$1</span>');
  return x;
 };
 const lines=String(value||'').split(/\r?\n/);
 return lines.map(line=>{
  if(/^>\s?/.test(line))return '<blockquote>'+inline(line.replace(/^>\s?/,''))+'</blockquote>';
  if(/^[-•]\s+/.test(line))return '<div class="chat-list-line">'+ico('dot')+'<span>'+inline(line.replace(/^[-•]\s+/,''))+'</span></div>';
  if(/^\d+[.)]\s+/.test(line)){const m=line.match(/^(\d+)[.)]\s+(.*)$/);return '<div class="chat-list-line"><b>'+(m?.[1]||'')+'.</b><span>'+inline(m?.[2]||'')+'</span></div>';}
  return inline(line)||'<br>';
 }).join('<br>');
}
function runChatEffect(effect){
 if(!effect||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const icon={hearts:'heart',confetti:'party-popper',stars:'star',kiss:'heart',sunflowers:'flower-2',galaxy:'sparkles'}[effect]||'sparkles';
 const layer=document.createElement('div');layer.className='chat-effect-layer effect-'+effect;layer.setAttribute('aria-hidden','true');
 layer.innerHTML=Array.from({length:18},(_,i)=>'<i style="--x:'+((i*37)%100)+'%;--d:'+(i%6)*.08+'s;--r:'+((i*47)%180)+'deg">'+ico(icon)+'</i>').join('');
 document.body.appendChild(layer);refreshIcons();setTimeout(()=>layer.remove(),2200);
}
function chatSharedItemMarkup(m){
 const attachment=(m.attachments||[])[0],kind=m.message_type;
 const icon=kind==='photo'||kind==='gif'?'image':kind==='video'||kind==='video_message'?'video':kind==='audio'?'mic':kind==='file'?'file-text':kind==='location'?'map-pin':kind==='song'?'music-2':kind==='link'?'link':'message-circle';
 const label=m.body||attachment?.name||({photo:'Foto',gif:'GIF',video:'Video',video_message:'Videomensaje',audio:'Audio',file:'Archivo',location:'Ubicación',song:'Canción',link:'Enlace',sticker:'Sticker'}[kind]||'Mensaje');
 return '<button type="button" class="chat-shared-item" data-action="chat-result-jump" data-id="'+attr(m.id)+'">'+(attachment?.kind==='photo'&&attachment.url?'<img loading="lazy" src="'+attr(attachment.url)+'" alt="">':'<span>'+ico(icon)+'</span>')+'<div><b>'+esc(label)+'</b><small>'+esc(chatOwn(m)?'Tú':chatPartnerLabel())+' · '+esc(fmtDateTime(m.created_at))+'</small></div>'+ico('chevron-right')+'</button>';
}
async function openChatShared(category='media',query=''){
 const categories=[['media','Multimedia'],['links','Links'],['music','Música'],['files','Archivos'],['locations','Ubicaciones'],['pins','Fijados'],['saved','Guardados']];
 const result=await api('chat-shared',{category,query});
 showModal('Compartido','<div class="chat-shared"><div class="chat-shared-tabs">'+categories.map(([id,label])=>'<button type="button" class="'+(id===category?'active':'')+'" data-action="chat-shared-tab" data-category="'+id+'">'+esc(label)+'</button>').join('')+'<button type="button" data-action="chat-albums-open">Álbumes</button></div><form id="chatSharedSearchForm" class="chat-shared-search"><input type="hidden" name="category" value="'+attr(category)+'"><input class="input" name="query" value="'+attr(query)+'" placeholder="Buscar en '+attr(categories.find(x=>x[0]===category)?.[1]||'Compartido')+'"><button class="btn small" type="submit">'+ico('search')+'</button></form><div class="chat-shared-list">'+((result.messages||[]).length?(result.messages||[]).map(chatSharedItemMarkup).join(''):'<div class="empty">Todavía no hay contenido aquí.</div>')+'</div></div>','chat-shared');
 refreshIcons();
}
async function openChatAlbums(){
 const result=await api('chat-albums',{operation:'list'}),albums=result.albums||[];
 showModal('Álbumes del chat','<div class="chat-albums-head"><button class="btn small" type="button" data-action="chat-album-create">'+ico('plus')+' Nuevo álbum</button></div><div class="chat-album-grid">'+(albums.length?albums.map(a=>'<article class="chat-album-card"><button type="button" data-action="chat-album-open" data-id="'+attr(a.id)+'">'+((a.items||[])[0]?.url?'<img loading="lazy" src="'+attr((a.items||[])[0].url)+'" alt="">':'<span>'+ico('images')+'</span>')+'<div><b>'+esc(a.name)+'</b><small>'+((a.items||[]).length)+' elemento'+((a.items||[]).length===1?'':'s')+(a.album_date?' · '+esc(a.album_date):'')+'</small></div></button></article>').join(''):'<div class="empty">Crea un álbum para reunir fotos y videos del chat sin duplicar archivos.</div>')+'</div>','chat-albums');
}
async function openChatAlbum(id){
 const result=await api('chat-albums',{operation:'list'}),album=(result.albums||[]).find(x=>String(x.id)===String(id));if(!album)return;
 showModal(album.name,'<div class="chat-album-view">'+((album.items||[]).length?(album.items||[]).map(x=>x.kind==='video'?'<video controls playsinline preload="metadata" src="'+attr(x.url)+'"></video>':'<img loading="lazy" src="'+attr(x.url)+'" alt="'+attr(x.name||'Foto')+'">').join(''):'<div class="empty">Este álbum aún está vacío.</div>')+'</div><div class="form-actions"><button class="btn" type="button" data-action="chat-album-memory" data-id="'+attr(album.id)+'">'+ico('images')+' Convertir en recuerdo</button><button class="btn danger small" type="button" data-action="chat-album-delete" data-id="'+attr(album.id)+'">'+ico('trash-2')+' Eliminar álbum</button></div>','chat-album');
}
function openChatAlbumCreate(){
 showModal('Nuevo álbum','<form id="chatAlbumCreateForm" class="stack"><div class="field"><label>Nombre</label><input class="input" name="name" maxlength="80" required placeholder="Ej. Útica"></div><div class="field"><label>Fecha opcional</label><input class="input" type="date" name="albumDate"></div><button class="btn" type="submit">Crear álbum</button></form>','chat-album-create');
}
async function openChatAlbumPicker(attachmentId){
 const result=await api('chat-albums',{operation:'list'}),albums=result.albums||[];
 showModal('Añadir a álbum','<div class="chat-album-picker">'+(albums.length?albums.map(a=>'<button class="card" type="button" data-action="chat-album-add" data-album-id="'+attr(a.id)+'" data-attachment-id="'+attr(attachmentId)+'">'+ico('images')+'<span><b>'+esc(a.name)+'</b><small>'+((a.items||[]).length)+' elementos</small></span></button>').join(''):'<div class="empty">Primero crea un álbum.</div>')+'</div><button class="btn small secondary" type="button" data-action="chat-album-create">'+ico('plus')+' Nuevo álbum</button>','chat-album-picker');
}
async function openChatStickerPicker(){
 const result=await api('chat-stickers',{operation:'list'}),stickers=result.stickers||[];
 showModal('Stickers y GIFs','<div class="chat-sticker-tools"><form id="chatGifSearchForm"><input class="input" name="query" maxlength="50" placeholder="Buscar GIF en GIPHY"><button class="btn small" type="submit">'+ico('search')+'</button></form><small>Powered by GIPHY · clave protegida en servidor</small></div><div id="chatGifResults"></div><div class="chat-sticker-grid">'+(stickers.length?stickers.map(x=>'<div class="chat-sticker-cell"><button type="button" data-action="chat-sticker-send" data-id="'+attr(x.id)+'"><img loading="lazy" src="'+attr(x.url)+'" alt="'+attr(x.name||'Sticker')+'"></button><button type="button" class="chat-sticker-fav '+(x.favorite?'active':'')+'" data-action="chat-sticker-favorite" data-id="'+attr(x.id)+'" data-favorite="'+(x.favorite?'true':'false')+'" aria-label="Favorito">'+ico('star')+'</button></div>').join(''):'<div class="empty">Todavía no han creado stickers. Mantén pulsada una foto del chat y elige “Crear sticker”.</div>')+'</div>','chat-stickers');
 refreshIcons();
}
async function runChatGifSearch(form){
 const query=String(new FormData(form).get('query')||''),box=modal.querySelector('#chatGifResults'),submit=form.querySelector('button[type="submit"]');
 if(submit)submit.disabled=true;
 if(box)box.innerHTML='<div class="monthly-loading">'+loading('Buscando GIFs')+'</div>';
 try{
  const result=await GalaxyNative.call('searchGiphy',query,false);
  if(!result?.configured){
   if(box)box.innerHTML='<div class="chat-giphy-disabled"><b>GIFs online no configurados</b><small>Los stickers privados siguen disponibles. GIPHY se activa con una clave protegida en el servidor.</small></div>';
   return;
  }
  if(box)box.innerHTML='<div class="chat-gif-grid">'+((result.items||[]).length?(result.items||[]).map(x=>'<button type="button" data-action="chat-gif-pick" data-url="'+attr(x.url)+'" data-title="'+attr(x.title||'GIF')+'"><img loading="lazy" src="'+attr(x.previewUrl)+'" alt="'+attr(x.title||'GIF')+'"></button>').join(''):'<div class="empty">Sin GIFs para esa búsqueda.</div>')+'</div><small class="chat-giphy-credit">Powered by GIPHY</small>';
 }catch(error){
  if(box)box.innerHTML='<div class="chat-giphy-disabled"><b>GIPHY no respondió</b><small>'+esc(error?.message||'Puedes seguir usando tus stickers privados e intentar de nuevo.')+'</small></div>';
 }finally{
  if(submit)submit.disabled=false;
  refreshIcons();
 }
}
async function openChatLocationMenu(){
 if(!mapData)await refreshMap({quiet:true,detail:true}).catch(()=>{});
 const places=mapData?.places||[];
 showModal('Compartir ubicación','<div class="chat-location-options"><button class="card" type="button" data-action="chat-location-current">'+ico('locate-fixed')+'<span><b>Ubicación actual</b><small>Una posición puntual obtenida ahora.</small></span></button><div class="chat-live-options"><b>Ubicación en vivo</b><small>Reutiliza el GPS de Nuestra Galaxia. Android mantendrá una notificación visible mientras esté activa.</small><div><button class="btn small secondary" type="button" data-action="chat-location-live" data-duration="900">15 min</button><button class="btn small secondary" type="button" data-action="chat-location-live" data-duration="3600">1 h</button><button class="btn small secondary" type="button" data-action="chat-location-live" data-duration="28800">8 h</button><button class="btn small secondary" type="button" data-action="chat-location-live" data-duration="">Hasta detener</button></div></div>'+(places.length?'<div class="chat-place-list"><b>Lugares guardados</b>'+places.slice(0,30).map(p=>'<button type="button" data-action="chat-location-place" data-lat="'+attr(p.latitude)+'" data-lon="'+attr(p.longitude)+'" data-label="'+attr(p.name)+'">'+ico('map-pin')+'<span>'+esc(p.name)+'</span></button>').join('')+'</div>':'')+'</div>','chat-location');
}
function openChatAttachMenu(){
 showModal('Adjuntar','<div class="chat-attach-grid"><button type="button" data-action="chat-attach-file">'+ico('paperclip')+'<span>Archivos</span></button><button type="button" data-action="chat-attach-location">'+ico('map-pin')+'<span>Ubicación</span></button><button type="button" data-action="chat-context-open">'+ico('route')+'<span>Acompáñame</span></button><button type="button" data-action="chat-galaxy-open">'+ico('orbit')+'<span>Nuestra Galaxia</span></button><button type="button" data-action="chat-poll-open">'+ico('list-checks')+'<span>Encuesta</span></button><button type="button" data-action="chat-check-open">'+ico('list-todo')+'<span>Checklist</span></button><button type="button" data-action="chat-stickers-open">'+ico('sticker')+'<span>GIF / stickers</span></button></div>','chat-attach');
}
async function openChatContextMenu(){
 if(!mapData)await refreshMap({quiet:true,detail:true}).catch(()=>{});
 const places=(mapData?.places||[]).slice(0,20);
 showModal('Acompáñame','<div class="stack"><p class="muted">Inicia una sesión del Galaxy Context Engine y comparte la misma card en Chat.</p><button class="card" type="button" data-action="chat-context-start" data-kind="person" data-id="'+attr(String(cloud.person)==='0'?'1':'0')+'">'+ico('navigation')+'<span><b>Voy hacia '+esc(partnerName())+'</b><small>ETA vivo hacia tu persona</small></span></button><button class="card" type="button" data-action="chat-context-start" data-kind="home">'+ico('house')+'<span><b>Voy a casa</b><small>Usa tu lugar Casa guardado</small></span></button>'+(places.length?'<div class="field"><label>Otro lugar guardado</label><div class="stack">'+places.map(p=>'<button class="card" type="button" data-action="chat-context-start" data-kind="place" data-id="'+attr(p.id)+'">'+ico('map-pin')+'<span><b>'+esc(p.name)+'</b><small>'+esc(p.note||'Lugar guardado')+'</small></span></button>').join('')+'</div></div>':'')+'</div>','chat-context');
}
async function openChatGalaxyPicker(){
 if(!mapData)await refreshMap({quiet:true,detail:true}).catch(()=>{});
 await loadGoals().catch(()=>{});
 await loadDateContext().catch(()=>{});
 const rows=[];
 for(const item of cloud?.items||[]){
  const map={memory:['MEMORY','memory','Recuerdo'],plan:['PLAN','plan','Plan'],song:['SONG','song','Canción'],capsule:['CAPSULE','capsule','Cápsula'],event:['EVENT','event','Evento']},spec=map[item.kind];
  if(spec)rows.push({cardType:spec[0],kind:spec[1],id:item.id,label:spec[2],title:item.data?.title||spec[2],icon:kindMeta[item.kind]?.[0]||'sparkles'});
 }
 for(const goal of goalsState?.goals||[])rows.push({cardType:'GOAL',kind:'goal',id:goal.id,label:'Objetivo',title:goal.title,icon:'target'});
 for(const place of mapData?.places||[])rows.push({cardType:'PLACE',kind:'place',id:place.id,label:'Lugar',title:place.name,icon:'map-pin'});
 const session=contextSession();if(session?.id)rows.unshift({cardType:'ETA',kind:'context_session',id:session.id,label:'ETA',title:session.label||'Acompáñame',icon:'navigation'});
 if(dateContext?.question&&cloud?.today)rows.unshift({cardType:'DAILY_QUESTION',kind:'daily_question',id:cloud.today,label:'Pregunta del día',title:dailyQuestion(),icon:'message-circle-question'});
 for(const loc of cloud?.locations||[])if(loc?.status)rows.unshift({cardType:'STATUS',kind:'status',id:String(loc.person),label:String(loc.person)===String(cloud.person)?'Mi estado':'Estado de '+partnerName(),title:String(loc.status),icon:'message-circle'});
 showModal('Compartir de Nuestra Galaxia','<div class="chat-galaxy-picker">'+(rows.length?rows.slice(0,120).map(x=>'<button type="button" class="card" data-action="chat-galaxy-pick" data-card-type="'+attr(x.cardType)+'" data-kind="'+attr(x.kind)+'" data-id="'+attr(x.id)+'" data-title="'+attr(x.title)+'"><span>'+ico(x.icon)+'</span><div><small>'+esc(x.label)+'</small><b>'+esc(x.title)+'</b></div>'+ico('send')+'</button>').join(''):'<div class="empty">Todavía no hay contenido para compartir.</div>')+'</div>','chat-galaxy-picker');
}
function openChatPollForm(){
 showModal('Nueva encuesta','<form id="chatPollForm" class="stack"><div class="field"><label>Pregunta</label><input class="input" name="question" maxlength="500" required placeholder="¿Qué hacemos el sábado?"></div><div class="field"><label>Opciones, una por línea</label><textarea name="options" rows="6" required placeholder="Cine\nMuseo"></textarea><small>Entre 2 y 10 opciones.</small></div><label class="chat-setting-toggle"><input type="checkbox" name="allowMultiple"> Permitir varias respuestas</label><div class="field"><label>Cierre opcional</label><input class="input" type="datetime-local" name="closesAt"></div><button class="btn" type="submit">'+ico('send')+' Crear encuesta</button></form>','chat-poll-create');
}
function openChatChecklistForm(){
 showModal('Nueva checklist','<form id="chatChecklistForm" class="stack"><div class="field"><label>Título</label><input class="input" name="title" maxlength="300" required placeholder="Viaje a Boyacá"></div><div class="field"><label>Elementos, uno por línea</label><textarea name="items" rows="8" required placeholder="Gasolina\nHotel\nCargadores"></textarea></div><button class="btn" type="submit">'+ico('send')+' Compartir checklist</button></form>','chat-check-create');
}
function chatMessageById(id){return mergeChatOutbox(chatState?.messages||[]).find(x=>String(x.id)===String(id));}
function prefillGoalFromChat(title,description=''){
 openGoalForm('goal');
 const t=modal.querySelector('[name="title"]'),d=modal.querySelector('[name="description"]');if(t)t.value=title||'';if(d)d.value=description||'';
}
function openChatSaveAs(id){
 const m=chatMessageById(id);if(!m)return;
 const body=String(m.body||m.card?.title||'').trim();
 showModal('Guardar como','<div class="chat-save-as"><p>Se abrirá el editor normal y tú confirmarás antes de guardar.</p><div class="chat-attach-grid">'+[['memory','images','Recuerdo'],['plan','calendar-days','Plan'],['goal','target','Objetivo'],['place','map-pin','Lugar'],['song','music-2','Canción'],['note','file-text','Nota'],['wish','star','Deseo']].map(x=>'<button type="button" data-action="chat-save-as-kind" data-id="'+attr(id)+'" data-kind="'+x[0]+'">'+ico(x[1])+'<span>'+x[2]+'</span></button>').join('')+'</div><small class="muted">No se creará nada automáticamente.</small></div>','chat-save-as');
}
function chatOpenItemDraft(kind,title='',body='',extra={}){
 openItemForm(kind,{data:{title,body,...extra}});
 modal.dataset.editId='';modal.dataset.version='';
}
async function openChatAlbumAsMemory(id){
 const result=await api('chat-albums',{operation:'list'}),album=(result.albums||[]).find(x=>String(x.id)===String(id));if(!album)return;
 closeModal();
 chatOpenItemDraft('memory',album.name||'Álbum del chat','',{date:album.album_date||'',source:{type:'chat-album',albumId:String(album.id),attachmentIds:(album.items||[]).map(x=>String(x.id)).filter(Boolean)}});
}

function openChatCameraMenu(){
 showModal('Cámara','<div class="chat-camera-grid"><button type="button" data-action="chat-attach-camera">'+ico('camera')+'<span><b>Tomar foto</b><small>Usar la cámara ahora</small></span></button><button type="button" data-action="chat-attach-video-camera">'+ico('video')+'<span><b>Grabar video</b><small>Video normal de hasta 2 min</small></span></button><button type="button" data-action="chat-video-message-open">'+ico('circle-play')+'<span><b>Videomensaje</b><small>Corto y circular · 15, 30 o 60 s</small></span></button></div>','chat-camera');
}
function openChatPermissionHelp(kind){
 const video=kind==='video',label=video?'cámara y micrófono':'cámara';
 showModal('Permiso necesario','<div class="chat-permission-help">'+ico(video?'video':'camera')+'<h3>Autoriza '+label+'</h3><p>Nuestra Galaxia necesita este permiso solo cuando quieras '+(video?'grabar un video':'tomar una foto')+'. Puedes volver a solicitarlo o abrir los ajustes de Android.</p><div class="chat-permission-actions"><button class="btn" type="button" data-action="chat-permission-retry" data-kind="'+kind+'">Volver a pedir permiso</button><button class="btn secondary" type="button" data-action="chat-open-app-settings">Abrir ajustes</button></div></div>','chat-permission');
}
function normalizeChatUpload(upload,kind,durationMs=null,mediaQuality='optimized'){
 const mime=String(upload?.mime||'').toLowerCase(),browserImage=mime.startsWith('image/')&&!['image/heic','image/heif'].includes(mime);
 const resolvedKind=kind==='file'?(browserImage?'photo':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'file'):kind;
 return {kind:resolvedKind,bucket:upload?.bucket||'galaxy-chat-media',path:upload.path,mime,name:upload.name||upload.originalName||resolvedKind,size:Number(upload.size||0),durationMs:durationMs||upload.durationMs||null,url:upload.url||'',waveform:Array.isArray(upload?.waveform)?upload.waveform:[],mediaQuality,videoMessage:upload?.videoMessage===true,gif:upload?.gif===true,thumbnailPath:upload?.thumbnailPath||null};
}
async function addChatNativeMedia(method,args,kind){
 try{
  setChatPresence('UPLOADING_MEDIA');
  const result=await GalaxyNative.call(method,...(args||[]));
  const uploads=Array.isArray(result?.items)?result.items:[result];
  for(const item of uploads)if(item?.path)chatAttachmentsDraft.push(normalizeChatUpload(item,kind));
  closeModal();render();setChatPresence('ONLINE');
 }catch(e){
  setChatPresence('ONLINE');
  const message=String(e?.message||'');
  if(message.includes('PERMISSION_CAMERA')||message.includes('PERMISSION_MICROPHONE')){openChatPermissionHelp(kind==='video'?'video':'photo');return;}
  if(/cancelad[ao]/i.test(message)){closeModal();return;}
  toast(message||'No pudimos adjuntar el archivo.');
 }
}
function openChatSongPicker(){
 const songs=songItems();
 showModal('Compartir canción','<div class="chat-song-picker">'+(songs.length?songs.map((x,i)=>'<button type="button" data-action="chat-song-pick" data-id="'+attr(x.id)+'" data-index="'+i+'">'+ico('music')+'<span><b>'+esc(x.title)+'</b><small>'+esc(x.platform)+'</small></span></button>').join(''):'<div class="empty">Agrega una canción primero en Nuestra Música.</div>')+'</div>','chat-song');
}
function chatComposerRightMode(textarea){
 const row=textarea?.closest('.chat-compose-row'),button=row?.querySelector('.chat-send');if(!button)return;
 const sending=String(textarea?.value||'').trim().length>0||chatAttachmentsDraft.length>0;
 button.type=sending?'submit':'button';
 if(sending){delete button.dataset.action;button.classList.remove('chat-mic-hold');button.setAttribute('aria-label','Enviar');button.innerHTML=ico('send');}
 else{button.dataset.action='chat-hold-record';button.classList.add('chat-mic-hold');button.setAttribute('aria-label','Mantén pulsado para grabar');button.innerHTML=ico('mic');}
 refreshIcons();
}
function chatHoldHint(text='',kind=''){
 const hint=document.querySelector('.chat-hold-hint');if(!hint)return;
 hint.hidden=!text;hint.textContent=text;hint.dataset.kind=kind||'';
}
async function finishChatHoldRecording({cancel=false}={}){
 const state=chatHoldRecord;if(!state)return;chatHoldRecord=null;
 const button=document.querySelector('[data-action="chat-hold-record"],[data-action="chat-hold-stop"]');button?.classList.remove('recording','canceling','locked');
 chatHoldHint('');
 try{
  if(cancel){await GalaxyNative.call('discardVoiceRecording');setChatPresence('ONLINE');return;}
  const info=await GalaxyNative.call('stopVoiceRecording');
  setChatPresence('ONLINE');
  chatVoiceState={recording:false,paused:false,ready:true,durationMs:Number(info?.durationMs||0)};
  showModal('Nota de voz','<div class="chat-voice-panel"><div class="chat-voice-orb ready">'+ico('audio-lines')+'</div><b data-role="chat-voice-status">Grabación lista · '+Math.max(1,Math.round(chatVoiceState.durationMs/1000))+' s</b><p class="muted">Escúchala antes de enviarla o elimínala para repetir.</p><div class="chat-voice-actions"><button class="btn secondary" type="button" data-action="chat-voice-preview">'+ico('play')+' Escuchar</button><button class="btn ghost" type="button" data-action="chat-voice-discard">Eliminar</button><button class="btn" type="button" data-action="chat-voice-send">'+ico('send')+' Enviar</button></div></div>','chat-voice-ready');
 }catch(e){setChatPresence('ONLINE');toast(e.message||'No pudimos terminar la grabación.');}
}
async function beginChatHoldRecording(e,button){
 if(chatHoldRecord)return;
 try{
  await GalaxyNative.call('startVoiceRecording');
  setChatPresence('RECORDING_AUDIO');
  chatHoldRecord={pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,cancel:false,locked:false};
  try{button.setPointerCapture(e.pointerId);}catch{}
  button.classList.add('recording');
  chatHoldHint('Suelta para enviar · desliza a la izquierda para cancelar · arriba para bloquear','recording');
 }catch(err){chatHoldRecord=null;setChatPresence('ONLINE');toast(err.message||'No pudimos iniciar la grabación.');}
}

function openChatVoice(){
 chatVoiceState={recording:false,paused:false,ready:false,durationMs:0};
 showModal('Nota de voz','<div class="chat-voice-panel"><div class="chat-voice-orb">'+ico('mic')+'</div><b data-role="chat-voice-status">Lista para grabar</b><div class="chat-voice-actions"><button class="btn" type="button" data-action="chat-voice-start">Grabar</button><button class="btn secondary" type="button" data-action="chat-voice-pause" hidden>Pausar</button><button class="btn secondary" type="button" data-action="chat-voice-resume" hidden>Reanudar</button><button class="btn danger" type="button" data-action="chat-voice-stop" hidden>Detener</button><button class="btn ghost" type="button" data-action="chat-voice-preview" hidden>'+ico('play')+' Escuchar</button><button class="btn ghost" type="button" data-action="chat-voice-discard" hidden>Eliminar</button><button class="btn" type="button" data-action="chat-voice-send" hidden>Enviar</button></div></div>','chat-voice');
}
function updateChatVoiceUi(){
 const status=modal.querySelector('[data-role="chat-voice-status"]');if(status)status.textContent=chatVoiceState.recording?(chatVoiceState.paused?'Grabación pausada':'Grabando…'):chatVoiceState.ready?'Lista para enviar':'Lista para grabar';
 const show=(sel,v)=>{const x=modal.querySelector(sel);if(x)x.toggleAttribute('hidden',!v);};
 show('[data-action="chat-voice-start"]',!chatVoiceState.recording&&!chatVoiceState.ready);
 show('[data-action="chat-voice-pause"]',chatVoiceState.recording&&!chatVoiceState.paused);
 show('[data-action="chat-voice-resume"]',chatVoiceState.recording&&chatVoiceState.paused);
 show('[data-action="chat-voice-stop"]',chatVoiceState.recording);
 show('[data-action="chat-voice-preview"]',chatVoiceState.ready);
 show('[data-action="chat-voice-discard"]',chatVoiceState.recording||chatVoiceState.ready);
 show('[data-action="chat-voice-send"]',chatVoiceState.ready);
 refreshIcons();
}
function notificationIcon(type){
 return type==='chat_message'?'message-circle':type==='status_changed'?'message-circle':type==='mood_changed'?'heart':type==='daily_answer'?'message-circle':type==='goal_update'?'target':type==='nearby'?'map-pin':type==='arrived_safe'?'house':type==='memory_shared'?'images':type==='plan_update'?'calendar':type==='gesture'?'hand-heart':'bell';
}
async function openNotificationCenter(){
 const result=await api('notifications-list',{limit:80});notificationState=result;
 const rows=result.notifications||[];
 showModal('Notificaciones','<div class="notification-center-head"><p>'+Number(result.unread||0)+' sin leer</p>'+(result.unread?'<button class="btn small ghost" data-action="notifications-read-all">Marcar todas</button>':'')+'</div><div class="notification-center-list">'+(rows.length?rows.map(n=>'<button class="notification-row '+(!n.read_at?'unread':'')+'" data-action="notification-open" data-id="'+attr(n.id)+'" data-target="'+attr(n.action||'home')+'" data-entity-id="'+attr(n.entity_id||'')+'"><span class="notification-row-icon">'+ico(notificationIcon(n.event_type))+'</span><span><b>'+esc(n.title)+'</b><small>'+esc(n.body||'')+'</small><em>'+esc(fmtDateTime(n.created_at))+'</em></span></button>').join(''):'<div class="empty">Todavía no hay notificaciones.</div>')+'</div>','notifications');
}
async function routeGalaxyAction(action,entityId=''){
 const target=String(action||'home');
 if(target==='chat'){chatState=null;go('chat');await loadChat({quiet:true});if(entityId)await jumpToChatMessage(entityId);return;}
 if(target==='map'){go('map');await refreshMap({quiet:true,detail:true});return;}
 if(target==='goals'){go('goals');await loadGoals(true);if(entityId)setTimeout(()=>openGoalDetail(entityId),80);return;}
 if(target==='moments'){go('moments');return;}
 if(target==='memories'){go('memories');return;}
 if(target==='ai'){go('ai');return;}
 go('home');
}
async function consumeDeepLink(){
 if(!pendingDeepLink||!cloud)return;
 const data=pendingDeepLink;pendingDeepLink=null;
 await routeGalaxyAction(data.action,data.entityId).catch(()=>{});
}

function intelligenceHubView(){
 return '<section class="ai-hub"><div class="ai-hub-hero card"><span class="ai-hub-orbit">'+ico('sparkles')+'</span><div><p class="eyebrow">GALAXY INTELLIGENCE</p><h2>Nuestra IA</h2><p>Busca en su historia, conecta momentos y organiza recuerdos usando únicamente el contenido privado de Nuestra Galaxia.</p></div></div>'+
 '<button class="card ai-hub-primary" type="button" data-action="our-ai"><span>'+ico('message-circle')+'</span><div><p class="eyebrow">PREGÚNTALE A SU HISTORIA</p><h3>Buscar y preguntar</h3><p>Búsqueda híbrida con coincidencias exactas, texto completo y contexto semántico.</p></div>'+ico('chevron-right')+'</button>'+
 '<div class="intelligence-tools ai-hub-tools"><button class="card intelligence-tool" type="button" data-action="intelligence-connections-open"><span>'+ico('git-branch')+'</span><div><b>IA de conexiones</b><small>Descubre relaciones entre recuerdos, canciones, lugares y planes.</small></div></button><button class="card intelligence-tool" type="button" data-action="intelligence-narrator-open"><span>'+ico('book-open-text')+'</span><div><b>IA narradora</b><small>Crea capítulos sustentados únicamente en recuerdos reales.</small></div></button><button class="card intelligence-tool" type="button" data-action="intelligence-book-open"><span>'+ico('book-heart')+'</span><div><b>Libro de Nuestra Galaxia</b><small>Explora su historia organizada por capítulos.</small></div></button></div>'+
 '<div class="card ai-hub-privacy"><span>'+ico('shield-check')+'</span><div><b>Privada por diseño</b><p>Las fuentes bloqueadas no se muestran ni se usan antes de tiempo. Si la IA no está disponible, la búsqueda clásica sigue funcionando.</p></div></div></section>';
}

function moreView(){
 const settings=cloud.settings||{data:{},version:1},data=settings.data||{},presence=ownPresence();
 return '<section><div class="section-head"><div><p class="eyebrow">CONFIGURACIÓN</p><h2>Más</h2><p>Privacidad, permisos, respaldo, dispositivos, apariencia y mantenimiento de la app.</p></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Privacidad de “Ahora”</h3><p>Tu ubicación sigue teniendo su propio interruptor. Aquí decides si compartes batería y la canción que estás escuchando.</p></div>'+ico('shield-check')+'</div><div class="privacy-grid"><button class="privacy-toggle '+(presence.shareBattery?'active':'')+'" data-action="presence-battery">'+ico('battery-charging')+'<span><b>Batería</b><small>'+(presence.shareBattery?'Compartida':'Solo para ti')+'</small></span></button><button class="privacy-toggle '+(presence.shareListening?'active':'')+'" data-action="presence-listening">'+ico('music')+'<span><b>Escuchando</b><small>'+(presence.shareListening?'Compartido':'Solo para ti')+'</small></span></button><button class="privacy-toggle '+(native.tracking?'active':'')+'" data-action="map">'+ico('map-pin')+'<span><b>Ubicación</b><small>'+(native.tracking?'Compartiendo':'Pausada')+'</small></span></button></div></div>'+gpsHistoryPrivacyCard()+
 themeSettingsCard()+
 '<div class="card"><div class="row between"><div><p class="eyebrow">NOTIFICACIONES</p><h3>Mensajes y actividad</h3><p>Galaxy Chat, estados, mapa, objetivos, recuerdos y demás actividad usan notificaciones nativas de Android.</p></div><span class="badge '+(native.notificationsGranted&&native.notificationsEnabled?'good':'warn')+'">'+(native.notificationsGranted&&native.notificationsEnabled?'Activas':'Requieren ajuste')+'</span></div><div class="notification-health"><span class="'+(native.notificationsGranted?'good':'')+'">'+ico(native.notificationsGranted?'check':'circle-alert')+' Permiso '+(native.notificationsGranted?'concedido':'pendiente')+'</span><span class="'+(native.pushConfigured?'good':'')+'">'+ico(native.pushConfigured?'radio':'circle-alert')+' Push '+(native.pushConfigured?'configurado':'pendiente')+'</span></div><div class="row wrap" style="margin-top:14px">'+(!native.notificationsGranted?'<button class="btn small" data-action="galaxy-notifications-enable">'+ico('bell-ring')+' Activar notificaciones</button>':'')+'<button class="btn small ghost" data-action="app-settings">'+ico('settings')+' Ajustes de Android</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Copia de nuestra galaxia</h3><p>Exporta los datos a un archivo JSON o restaura una copia. Fotos, música y audios permanecen en su almacenamiento privado y se conservan por referencia.</p></div>'+ico('archive')+'</div><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="backup-export">'+ico('download')+' Exportar</button><button class="btn small ghost" data-action="backup-import">'+ico('upload')+' Restaurar</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Widget “Nuestra Galaxia” 2.0</h3><p>Foto, fecha, mood, distancia, ETA, canción, próximo plan, jardín y gesto rápido. Elige módulos al añadir cada widget.</p></div><span class="badge '+(native.canPinWidget?'good':'')+'">'+(native.canPinWidget?'Disponible':'Manual')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="widget-add">Añadir widget</button><button class="btn small secondary" data-action="widget-photo">Elegir foto</button><button class="btn small ghost" data-action="widget-photo-clear">Quitar foto</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Gestos y fechas especiales</h3><p>Control adicional para abrazos, besos, “te extraño” y fechas del vínculo.</p></div><span class="badge '+(native.momentNotifications&&native.notificationsGranted&&native.notificationsEnabled?'good':'')+'">'+(native.momentNotifications?(native.notificationsGranted&&native.notificationsEnabled?'Listas':'Requieren ajuste'):'Pausadas')+'</span></div><div class="notification-health"><span class="'+(native.notificationsGranted?'good':'')+'">'+ico(native.notificationsGranted?'check':'circle-alert')+' Permiso '+(native.notificationsGranted?'concedido':'pendiente')+'</span><span class="'+(native.notificationsEnabled?'good':'')+'">'+ico(native.notificationsEnabled?'bell-ring':'bell-off')+' Sistema '+(native.notificationsEnabled?'habilitado':'bloqueado')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="moment-notifications">'+(native.momentNotifications?'Desactivar':'Activar')+'</button><button class="btn small '+(native.bondHaptics?'secondary':'ghost')+'" data-action="bond-haptics">'+ico('smartphone')+' Hápticos '+(native.bondHaptics?'activos':'apagados')+'</button>'+(native.momentNotifications?'<button class="btn small ghost" data-action="moment-notification-test">'+ico('bell-ring')+' Probar ahora</button>':'')+(!native.notificationsEnabled?'<button class="btn small ghost" data-action="app-settings">'+ico('settings')+' Ajustes</button>':'')+'</div><p class="muted" style="margin-top:10px">Push instantáneo: '+(native.pushConfigured?'configurado':'pendiente de Firebase')+'. Notificaciones y vibración se controlan por separado.</p></div>'+
 '<div class="card"><h3>Nuestros datos</h3><form id="settingsForm" class="stack" style="margin-top:12px"><div class="grid"><div class="field"><label>Nombre 1</label><input class="input" name="name0" value="'+attr(data.names?.[0]||'')+'" required></div><div class="field"><label>Nombre 2</label><input class="input" name="name1" value="'+attr(data.names?.[1]||'')+'" required></div></div><div class="field"><label>Inicio de nuestra historia</label><input class="input" type="date" name="startDate" value="'+attr(data.startDate||'')+'"></div><div class="field"><label>Álbum de Google Fotos (opcional)</label><input class="input" name="albumUrl" value="'+attr(data.albumUrl||'')+'" placeholder="https://photos.app.goo.gl/…"></div><button class="btn" type="submit">Guardar ajustes</button></form></div>'+
 (Number(cloud?.person)===0?'<div class="card"><div class="row between"><div><h3>Previsualización de Adri</h3><p>Solo tú puedes ver este control. Abre la bienvenida exactamente como la verá Adri, sin marcarla como completada.</p></div>'+ico('sparkles')+'</div><button class="btn small secondary" style="margin-top:14px" data-action="welcome-replay">Previsualizar bienvenida</button></div>':'')+
 deviceProfilesCard()+'<div class="card"><h3>Permisos de Android</h3><p>Ubicación: '+(native.locationGranted?'concedida':'pendiente')+' · Segundo plano: '+(native.backgroundLocationGranted?'concedido':'opcional')+' · Notificaciones: '+(native.notificationsGranted?'concedidas':'pendientes')+'</p><button class="btn small secondary" style="margin-top:14px" data-action="app-settings">Abrir ajustes del sistema</button></div>'+
 '<div class="card" id="updateCard">'+updateMarkup()+'</div>'+
 '<div class="card"><h3>Este teléfono</h3><p>'+esc(native.name||'Android')+' · Perfil '+esc(myName())+' · v'+esc(native.version)+'</p><button class="btn small danger" style="margin-top:14px" data-action="unpair">Desvincular teléfono</button></div>'+
 '</section>';
}
function updateMarkup(){
 return '<div class="update-line"><div><h3>Actualizaciones</h3><p>'+esc(updateState.text||'Las nuevas versiones llegan dentro de la app.')+'</p>'+(updateState.busy?'<div class="update-bar"><i style="width:'+Math.max(2,Number(updateState.progress||0))+'%"></i></div>':'')+'</div><button class="btn small secondary" data-action="update-check" '+(updateState.busy?'disabled':'')+'>Buscar</button></div>';
}
function renderUpdateOnly(){const el=$('#updateCard');if(el)el.innerHTML=updateMarkup();}

function drawMap({fit=true}={}){
 if(view!=='map'||!$('#map')||typeof GalaxyMap==='undefined'||!mapData)return;
 const previous=map?{center:{...map.center},zoom:map.zoom}:null;
 if(map){map.remove();map=null;}
 map=new GalaxyMap($('#map'),{center:[4.711,-74.0721],zoom:12});
 const locs=(mapData.locations||[]).filter(x=>x.sharing&&Number.isFinite(Number(x.latitude))&&Number.isFinite(Number(x.longitude)));
 const bounds=[];
 locs.forEach(l=>{
   const mine=l.person===cloud.person,name=names()[Number(l.person)]||'Nosotros',fresh=locationFreshState(l);
   map.addMarker({
     lat:l.latitude,lon:l.longitude,label:esc(name.slice(0,1)),
     className:(mine?'mine':'partner')+(fresh?'':' stale'),
     popup:fresh?(name+' · '+transportLabel(l)+' · '+(Number(l.speed||0)*3.6).toFixed(0)+' km/h'):(name+' · última ubicación hace '+ageDurationLabel(locationAgeMs(l)))
   });
   bounds.push([Number(l.latitude),Number(l.longitude)]);
 });
 (mapData.places||[]).forEach(p=>{
   const markerIcon=p.kind==='home'?'house':p.kind==='work'?'briefcase':p.kind==='adventure'?'compass':'heart';
   const linked=(cloud?.items||[]).filter(i=>Number(i.data?.placeId)===Number(p.id));
   map.addMarker({lat:p.latitude,lon:p.longitude,icon:markerIcon,className:'place',popup:p.name+(linked.length?' · '+linked.length+' '+(linked.length===1?'historia':'historias'):'')+(p.note?' · '+p.note:'')});
 });
 visibleFrequentSuggestions().slice(0,3).forEach(s=>map.addMarker({lat:s.latitude,lon:s.longitude,icon:'map-pin',className:'suggestion',popup:'Lugar frecuente · '+Number(s.days||0)+' días · '+Number(s.visits||0)+' visitas'}));
 const grouped={};
 (mapData.tripPoints||[]).slice().reverse().forEach(p=>(grouped[p.person]??=[]).push([Number(p.latitude),Number(p.longitude)]));
 Object.entries(grouped).forEach(([person,points])=>{if(points.length>1)map.addPolyline(points,{className:person===cloud.person?'mine':'partner',dashed:person!==cloud.person});});
 if(fit||!previous){if(bounds.length)map.fitBounds(bounds,{maxZoom:16});}
 else map.setView([previous.center.lat,previous.center.lon],previous.zoom);
}

function showModal(title,body,formId=''){
 modal.innerHTML='<div class="modal-inner"><button class="close" data-action="modal-close" aria-label="Cerrar">'+ico('x')+'</button><h2>'+esc(title)+'</h2>'+body+'</div>';
 if(formId)modal.dataset.form=formId;else delete modal.dataset.form;
 modal.showModal();
 refreshIcons();
}
async function resetVoiceDraft(){stopVoiceTimer();if(voiceRecording||voiceReady){try{await GalaxyNative.call('discardVoiceRecording');}catch{}}voiceRecording=false;voiceReady=false;if(voiceResumeMusic){toggleMusic();voiceResumeMusic=false;}}
function closeModal(){if(modal.dataset.form==='voice'&&pendingVoiceDraft!==null)resetVoiceDraft();if(dateModeTimer){clearInterval(dateModeTimer);dateModeTimer=null;}if(modal.open)modal.close();delete modal.dataset.editId;delete modal.dataset.version;delete modal.dataset.kind;delete modal.dataset.form;}
function openItemForm(kind,item){
 const d=item?.data||{},meta=kindMeta[kind]||['sparkles','Contenido'],editing=!!item?.id,places=mapData?.places||[],songs=items('song');
 modal.dataset.editId=item?.id||'';modal.dataset.version=item?.version||'';modal.dataset.kind=kind;
 const needsDate=['memory','event','journey'].includes(kind),canPlace=['memory','journey','event'].includes(kind),sourceField=d.source?'<input type="hidden" name="sourceJson" value="'+attr(JSON.stringify(d.source))+'">':'';
 const placeField=canPlace?(places.length?'<div class="field"><label>Lugar de nuestra historia (opcional)</label><select name="placeId"><option value="">Sin lugar</option>'+places.map(p=>'<option value="'+p.id+'" '+(Number(d.placeId)===Number(p.id)?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>':(d.placeId?'<input type="hidden" name="placeId" value="'+attr(d.placeId)+'">':'')):'';
 const capsuleFields=kind==='capsule'?'<div class="field"><label>Se desbloquea por</label><select name="unlockType"><option value="date" '+(d.unlockType!=='place'?'selected':'')+'>Fecha y hora</option><option value="place" '+(d.unlockType==='place'?'selected':'')+'>Llegar a un lugar</option></select></div><div class="field"><label>Fecha de desbloqueo</label><input class="input" type="date" name="date" value="'+attr(d.unlockDate||d.date||'')+'"></div><div class="field"><label>Hora de desbloqueo</label><input class="input" type="time" name="unlockTime" value="'+attr(d.unlockTime||'00:00')+'"></div>'+(places.length?'<div class="field"><label>Lugar de desbloqueo</label><select name="unlockPlaceId"><option value="">Elige un lugar</option>'+places.map(p=>'<option value="'+p.id+'" '+(Number(d.placeId)===Number(p.id)?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select><small>Solo se usará cuando elijas “Llegar a un lugar”.</small></div>':'')+'<div class="capsule-media-fields"><input type="hidden" name="capsulePhotoPath" value="'+attr(d.photoPath||'')+'"><input type="hidden" name="capsuleAudioPath" value="'+attr(d.audioPath||'')+'"><input type="hidden" name="capsuleAudioMime" value="'+attr(d.audioMime||'')+'"><div class="row wrap"><button class="btn small secondary" type="button" data-action="capsule-photo-file">'+ico('image-plus')+' Foto</button><span class="muted" data-role="capsule-photo-state">'+(d.photoPath?'Foto añadida':'Sin foto')+'</span></div><div class="row wrap"><button class="btn small secondary" type="button" data-action="capsule-audio-file">'+ico('mic')+' Audio</button><span class="muted" data-role="capsule-audio-state">'+(d.audioPath?'Audio añadido':'Sin audio')+'</span></div><div class="field"><label>Canción opcional</label><select name="capsuleSongId"><option value="">Sin canción</option>'+songs.map(s=>'<option value="'+attr(s.id)+'" '+(String(d.songId||'')===String(s.id)?'selected':'')+'>'+esc(s.data?.title||'Canción')+(s.data?.artist?' · '+esc(s.data.artist):'')+'</option>').join('')+'</select></div></div>':'';
 const body='<form id="itemForm" class="stack" style="margin-top:16px">'+sourceField+'<div class="field"><label>Título</label><input class="input" name="title" value="'+attr(d.title||'')+'" required maxlength="160"></div><div class="field"><label>Texto</label><textarea name="body" placeholder="Escribe aquí…">'+esc(d.body||'')+'</textarea></div>'+
 (needsDate?'<div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="'+attr(d.date||'')+'"></div>':'')+capsuleFields+
 '<div class="field"><label>Categoría</label><input class="input" name="category" value="'+attr(d.category||'')+'" placeholder="'+attr(meta[1])+'"></div>'+placeField+
 (kind==='plan'?'<div class="date-plan-fields"><div class="field"><label>Cuándo</label><select name="planCategory"><option value="this-week" '+(d.planCategory==='this-week'?'selected':'')+'>Esta semana</option><option value="when-possible" '+(!d.planCategory||d.planCategory==='when-possible'?'selected':'')+'>Cuando podamos</option><option value="someday" '+(d.planCategory==='someday'?'selected':'')+'>Algún día</option><option value="travel" '+(d.planCategory==='travel'?'selected':'')+'>Viaje</option><option value="home" '+(d.planCategory==='home'?'selected':'')+'>En casa</option></select></div><div class="date-plan-grid"><div class="field"><label>Presupuesto estimado</label><input class="input" type="number" min="0" step="1000" name="budget" value="'+attr(d.budget??'')+'" placeholder="0"></div><div class="field"><label>Duración (min)</label><input class="input" type="number" min="15" step="15" name="minutes" value="'+attr(d.minutes??'')+'" placeholder="120"></div></div><div class="field"><label>Entorno</label><select name="where"><option value="salir" '+(d.where!=='casa'?'selected':'')+'>Salir</option><option value="casa" '+(d.where==='casa'?'selected':'')+'>En casa</option></select></div></div>':'')+
 (kind==='event'?'<div class="field"><label>Hora (opcional)</label><input class="input" type="time" name="eventTime" value="'+attr(d.time||'')+'"></div><label class="row"><input type="checkbox" name="annual" '+(d.annual?'checked':'')+'> Se repite cada año</label>':'')+
 (kind==='plan'||kind==='wish'?'<label class="row"><input type="checkbox" name="done" '+(d.done?'checked':'')+'> Ya lo hicimos</label>':'')+
 '<div class="form-actions"><button class="btn secondary" type="button" data-action="modal-close">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>';
 showModal((editing?'Editar ':'Nuevo ')+meta[1].toLowerCase(),body,'item');
}
function openGame(){
 const first=Object.keys(gameQuestions)[0];
 showModal('Juego de nosotros','<form id="gameForm" class="stack" style="margin-top:16px"><div class="field"><label>Pregunta</label><select name="questionId" data-role="game-question">'+Object.entries(gameQuestions).map(([id,q])=>'<option value="'+id+'">'+esc(q.label)+'</option>').join('')+'</select></div><div class="field"><label>Tu respuesta</label><select name="answer" data-role="game-answer">'+gameQuestions[first].options.map(o=>'<option>'+esc(o)+'</option>').join('')+'</select></div><p class="muted">Tu respuesta no se mostrará a '+esc(partnerName())+' hasta que haga su intento.</p><button class="btn" type="submit">Guardar pregunta</button></form>','game');
}
function openRitual(entry){
 const d=entry?.data||{};modal.dataset.editId=entry?.id||'';modal.dataset.version=entry?.version||'';
 showModal('Ritual semanal','<form id="ritualForm" class="stack" style="margin-top:16px"><div class="field"><label>Semana</label><input class="input" type="date" name="week" value="'+attr(d.week||currentMonday())+'" '+(entry?'readonly':'')+' required></div><div class="field"><label>Algo que agradezco</label><textarea name="gratitude" required>'+esc(d.gratitude||'')+'</textarea></div><div class="field"><label>Algo que necesito</label><textarea name="need" required>'+esc(d.need||'')+'</textarea></div><div class="field"><label>Un próximo plan</label><textarea name="plan" required>'+esc(d.plan||'')+'</textarea></div><button class="btn" type="submit">Guardar ritual</button></form>','ritual');
}
function openSharedNote(entry){
 const d=entry?.data||{};modal.dataset.editId=entry?.id||'';modal.dataset.version=entry?.version||'';
 showModal(entry?'Editar nota':'Nueva nota compartida','<form id="sharedNoteForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" value="'+attr(d.title||'')+'" required></div><div class="field"><label>Nota</label><textarea name="body">'+esc(d.body||'')+'</textarea></div><button class="btn" type="submit">Guardar nota</button></form>','sharednote');
}
function startVoiceTimer(){
 stopVoiceTimer();voiceSeconds=0;
 voiceTimer=setInterval(()=>{voiceSeconds++;const status=modal.querySelector('[data-role="voice-status"]');if(status&&voiceRecording)status.textContent='Grabando… '+voiceSeconds+' s / 60 s';if(voiceSeconds>=60)stopVoiceTimer();},1000);
}
function stopVoiceTimer(){if(voiceTimer){clearInterval(voiceTimer);voiceTimer=null;}}
function openVoice(referenceId=''){
 pendingVoiceDraft={};voiceReady=false;voiceRecording=false;
 const refs=(cloud.items||[]).filter(i=>['memory','song','capsule'].includes(i.kind)&&!(i.kind==='capsule'&&i.data?.locked===true));
 showModal('Mensaje de voz','<form id="voiceForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" placeholder="Te pienso…" required></div><div class="field"><label>Dedicatoria</label><textarea name="body" placeholder="Unas palabras antes del audio…"></textarea></div><div class="field"><label>Relacionar con un recuerdo (opcional)</label><select name="referenceId"><option value="">Sin referencia</option>'+refs.map(i=>'<option value="'+i.id+'" '+(String(i.id)===String(referenceId)?'selected':'')+'>'+esc(i.data?.title||'Recuerdo')+'</option>').join('')+'</select></div><div class="card compact" data-role="voice-recorder"><b>Grábalo aquí</b><small class="muted" data-role="voice-status">Toca el micrófono cuando estés listo.</small><div class="row wrap" style="margin-top:10px"><button class="btn" type="button" data-action="voice-record-start">'+ico('mic')+' Grabar</button><button class="btn secondary" type="button" data-action="voice-record-stop" hidden>'+ico('square')+' Detener</button><button class="btn secondary" type="button" data-action="voice-preview" hidden>'+ico('play')+' Escuchar</button><button class="btn secondary" type="button" data-action="voice-discard" hidden>'+ico('rotate-ccw')+' Repetir</button></div></div><button class="btn secondary" type="button" data-action="voice-file">'+ico('folder-open')+' Elegir audio del teléfono</button><button class="btn" type="submit">Guardar mensaje de voz</button></form>','voice');
}
function openSurpriseNote(){
 const own=(cloud.locations||[]).find(l=>l.person===cloud.person&&l.sharing),places=mapData?.places||[],hasPlace=!!own||places.length>0;
 const placeOptions=(own?'<option value="current">Donde estoy ahora</option>':'')+places.map(p=>'<option value="saved:'+p.id+'">'+esc(p.name)+'</option>').join('');
 showModal('Nueva nota sorpresa','<form id="surpriseNoteForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" required maxlength="160"></div><div class="field"><label>Mensaje</label><textarea name="body" required></textarea></div><div class="field"><label>Desbloquear</label><select name="unlockType" data-role="surprise-unlock"><option value="date">En una fecha</option>'+(hasPlace?'<option value="place">Al llegar a un lugar</option>':'')+'</select></div><div class="field" data-role="surprise-date"><label>Fecha</label><input class="input" type="date" name="unlockDate" value="'+attr(cloud.today)+'"></div>'+(hasPlace?'<div class="field" data-role="surprise-place" hidden><label>Lugar</label><select name="placeChoice">'+placeOptions+'</select><small>La sorpresa se abrirá dentro de un radio aproximado de 150 m.</small></div>':'')+'<button class="btn" type="submit">Guardar sorpresa</button></form>','surprise-note');
}
async function loadDateContext(force=false){
 if(!native.paired||!cloud)return dateContext;
 if(!force&&dateContext&&Date.now()-dateContextLoadedAt<5*60*1000)return dateContext;
 const next=await api('date-engine',{operation:'context'});
 dateContext=next;dateContextLoadedAt=Date.now();
 return next;
}
function dateDeckLabel(id){
 return ({funny:'Divertidas',memories:'Recuerdos',future:'Futuro',intimate:'Íntimas / emocionales',absurd:'Absurdas',travel:'Viajes','would-you-rather':'¿Qué prefieres?'})[id]||id;
}
async function openQuestionDecks(){
 await loadDateContext();
 const decks=dateContext?.decks||[];
 showModal('Barajas de preguntas','<div class="question-decks">'+decks.map(deck=>'<button class="card question-deck" data-action="date-deck-question" data-deck="'+attr(deck.id)+'"><span>'+ico(deck.id==='travel'?'plane':deck.id==='memories'?'history':deck.id==='future'?'telescope':deck.id==='intimate'?'heart-handshake':deck.id==='absurd'?'wand-sparkles':deck.id==='would-you-rather'?'split':'laugh')+'</span><div><b>'+esc(dateDeckLabel(deck.id))+'</b><small>'+Number(deck.count||0)+' preguntas</small></div>'+ico('chevron-right')+'</button>').join('')+'</div>');
}
async function openDeckQuestion(deck){
 const result=await api('date-engine',{operation:'question',deck,seed:(cloud.today||'')+'|'+deck+'|'+(++dateQuestionNonce)});
 const q=result.question||{};
 showModal(dateDeckLabel(deck),'<div class="card deck-question-result"><p class="eyebrow">PARA CONVERSAR</p><h3>'+esc(q.text||'Pregunta')+'</h3><div class="row wrap"><button class="btn small secondary" data-action="date-deck-question" data-deck="'+attr(deck)+'">'+ico('refresh-cw')+' Otra</button><button class="btn small" data-action="date-mode-with-question" data-question-id="'+attr(q.id||'')+'" data-question-text="'+attr(q.text||'')+'">'+ico('timer')+' Llevar a Modo Cita</button></div></div>');
}
function dateConstraintsForm(id,title,submitLabel,defaults={}){
 const minutes=Number(defaults.minutes||120),budget=Number(defaults.budget??50000),where=defaults.where||'cualquiera';
 return '<form id="'+id+'" class="stack date-constraints" style="margin-top:16px"><div class="date-plan-grid"><div class="field"><label>Tiempo disponible</label><select name="minutes"><option value="30" '+(minutes===30?'selected':'')+'>30 min</option><option value="60" '+(minutes===60?'selected':'')+'>1 hora</option><option value="120" '+(minutes===120?'selected':'')+'>2 horas</option><option value="180" '+(minutes===180?'selected':'')+'>3 horas</option><option value="240" '+(minutes===240?'selected':'')+'>4 horas</option><option value="360" '+(minutes===360?'selected':'')+'>6 horas</option></select></div><div class="field"><label>Presupuesto total</label><input class="input" type="number" min="0" step="5000" name="budget" value="'+attr(budget)+'"></div></div><div class="field"><label>¿Dónde?</label><select name="where"><option value="cualquiera" '+(where==='cualquiera'?'selected':'')+'>Donde encaje mejor</option><option value="casa" '+(where==='casa'?'selected':'')+'>En casa</option><option value="salir" '+(where==='salir'?'selected':'')+'>Salir</option></select></div><div class="field"><label>Distancia máxima (opcional)</label><select name="maxDistanceM"><option value="">Sin límite</option><option value="3000">3 km</option><option value="7000">7 km</option><option value="15000">15 km</option></select></div><button class="btn" type="submit">'+esc(submitLabel)+'</button></form>';
}
async function openSurprise2(){
 await loadDateContext();
 showModal('Cita sorpresa 2.0',dateConstraintsForm('dateSuggestionForm','Cita sorpresa','Sorpréndenos',{minutes:120,budget:50000,where:'cualquiera'}),'date-suggestion');
}
function dateCandidateMarkup(experience){
 const candidate=experience?.candidate;if(!candidate)return '<div class="empty">No encontré un plan compatible. Prueba con más tiempo, presupuesto o sin limitar el lugar.</div>';
 dateLastExperience=experience;
 return '<div class="date-experience card"><p class="eyebrow">PROPUESTA DE GALAXY DATE</p><span class="badge">'+Number(candidate.minutes||0)+' min · $ '+Number(candidate.budget||0).toLocaleString('es-CO')+' · '+esc(candidate.where||'')+'</span><h3>'+esc(candidate.title||'Una cita')+'</h3><p>'+esc(candidate.body||'')+'</p>'+(experience.reasons?.length?'<ul class="date-reasons">'+experience.reasons.map(r=>'<li>'+esc(r)+'</li>').join('')+'</ul>':'')+'<div class="row wrap"><button class="btn secondary" data-action="date-experience-save">'+ico('bookmark-plus')+' Guardar plan</button><button class="btn" data-action="date-mode-start-experience">'+ico('timer')+' Empezar Modo Cita</button></div></div>';
}
async function openPlanRoulette(){
 await loadDateContext();
 const categories=[['','Todos'],['this-week','Esta semana'],['when-possible','Cuando podamos'],['someday','Algún día'],['travel','Viaje'],['home','En casa']];
 showModal('Ruleta de planes','<form id="dateRouletteForm" class="stack"><div class="plan-roulette" aria-live="polite">'+ico('dices')+'<b>Que decida la galaxia</b><small>Solo usa planes pendientes reales.</small></div><div class="field"><label>Categoría</label><select name="category">'+categories.map(([id,label])=>'<option value="'+id+'">'+esc(label)+'</option>').join('')+'</select></div><button class="btn" type="submit">Girar ruleta</button></form>','date-roulette');
}
function rouletteResult(plan){
 if(!plan)return '<div class="empty">No hay planes pendientes en esa categoría.</div>';
 const d=plan.data||plan;
 return '<div class="card plan-roulette result"><p class="eyebrow">LA GALAXIA ELIGIÓ</p><h3>'+esc(d.title||'Plan pendiente')+'</h3><p>'+esc(d.body||'')+'</p><div class="row wrap"><button class="btn" data-action="date-mode-start-plan" data-plan-id="'+attr(plan.id||'')+'">'+ico('timer')+' Empezar Modo Cita</button></div></div>';
}
async function openDatePlanner(){
 await loadDateContext();
 showModal('Planificador de cita',dateConstraintsForm('datePlannerForm','Planificador','Armar nuestra cita',{minutes:180,budget:100000,where:'cualquiera'}),'date-planner');
}
function plannerMarkup(experience){
 const steps=experience?.steps||[];
 if(!steps.length)return '<div class="empty">No pude armar una secuencia con esos límites. Prueba ampliando tiempo o presupuesto.</div>';
 dateLastExperience={candidate:steps[0],planner:experience};
 return '<div class="date-planner-result"><div class="row between"><div><p class="eyebrow">PLAN SECUENCIAL</p><h3>'+Number(experience.totalMinutes||0)+' min · $ '+Number(experience.totalBudget||0).toLocaleString('es-CO')+'</h3></div>'+ico('list-ordered')+'</div><ol>'+steps.map((step,index)=>'<li><span>'+Number(index+1)+'</span><div><b>'+esc(step.title)+'</b><small>'+Number(step.minutes||0)+' min · $ '+Number(step.budget||0).toLocaleString('es-CO')+'</small><p>'+esc(step.body||'')+'</p></div></li>').join('')+'</ol><div class="row wrap"><button class="btn secondary" data-action="date-planner-save">'+ico('bookmark-plus')+' Guardar como plan</button><button class="btn" data-action="date-mode-start-experience">'+ico('timer')+' Empezar Modo Cita</button></div></div>';
}
function newDateModeSession(planId=''){
 return {sessionId:(crypto.randomUUID?.()||(Date.now().toString(36)+'-'+Math.random().toString(36).slice(2))),startedAt:new Date().toISOString(),planId:String(planId||''),songId:'',photos:[],photoPaths:[],questionIds:[],locationEnabled:false,placeId:null,question:null};
}
function dateModeElapsed(session=dateMode){
 if(!session?.startedAt)return 0;
 return Math.max(0,Math.floor((Date.now()-Date.parse(session.startedAt))/1000));
}
function dateModePlan(){
 return (cloud?.items||[]).find(item=>item.kind==='plan'&&String(item.id)===String(dateMode?.planId||''))||null;
}
function dateModeSong(){
 rebuildMusicQueue();return musicQueue[musicIndex]||null;
}
function updateDateModeTimer(){
 if(dateModeTimer){clearInterval(dateModeTimer);dateModeTimer=null;}
 dateModeTimer=setInterval(()=>{const el=modal.querySelector('[data-role="date-elapsed"]');if(el&&dateMode)el.textContent=fmtDuration(dateModeElapsed());},1000);
}
function dateModeMarkup(){
 const plan=dateModePlan(),song=dateModeSong(),photos=dateMode?.photos||[],q=dateMode?.question;
 const locationLabel=dateMode?.locationEnabled?(dateMode.placeId?'Lugar guardado vinculado':'Ubicación contextual activa'):'Sin ubicación';
 return '<div class="date-mode"><div class="date-mode-hero"><p class="eyebrow">MODO CITA</p><h2 data-role="date-elapsed">'+fmtDuration(dateModeElapsed())+'</h2><p>Una pantalla temporal para acompañar este momento.</p></div><div class="date-mode-grid"><button class="card date-mode-tool" data-action="date-mode-music">'+ico('music')+'<b>Música</b><small>'+esc(song?.title||'Elegir nuestra música')+'</small></button><button class="card date-mode-tool" data-action="date-mode-question">'+ico('message-circle-question')+'<b>Pregunta</b><small>'+esc(q?.text||'Sacar una pregunta')+'</small></button><button class="card date-mode-tool" data-action="date-mode-camera">'+ico('camera')+'<b>Cámara / fotos</b><small>'+photos.length+' foto'+(photos.length===1?'':'s')+' en esta cita</small></button><button class="card date-mode-tool" data-action="date-mode-plan">'+ico('circle-check-big')+'<b>Plan actual</b><small>'+esc(plan?.data?.title||'Elegir un plan pendiente')+'</small></button><button class="card date-mode-tool" data-action="date-mode-location">'+ico('map-pin')+'<b>Ubicación</b><small>'+esc(locationLabel)+'</small></button></div>'+(q?'<div class="card date-mode-question"><p class="eyebrow">PREGUNTA PARA AHORA</p><h3>'+esc(q.text)+'</h3></div>':'')+(photos.length?'<div class="date-mode-photos">'+photos.slice(-4).map(photo=>photo.url?'<img src="'+attr(photo.url)+'" alt="Foto tomada durante la cita">':'<span>'+ico('image')+'</span>').join('')+'</div>':'')+'<button class="btn date-mode-save" data-action="date-mode-save">'+ico('heart')+' Guardar esta noche</button></div>';
}
function openDateMode(planId=''){
 if(!dateMode)dateMode=newDateModeSession(planId);
 else if(planId)dateMode.planId=String(planId);
 showModal('Modo Cita',dateModeMarkup(),'date-mode');
 updateDateModeTimer();
}
function openDateModePlanPicker(){
 const plans=(dateContext?.pendingPlans||[]).slice();
 showModal('Plan actual','<div class="stack">'+(plans.length?plans.map(plan=>'<button class="card plan-pick" data-action="date-mode-plan-select" data-plan-id="'+attr(plan.id)+'"><b>'+esc(plan.title||'Plan')+'</b><small>'+esc(dateDeckLabel(plan.planCategory)||'Pendiente')+'</small></button>').join(''):'<div class="empty">No hay planes pendientes. Puedes seguir en Modo Cita sin uno.</div>')+'<button class="btn ghost" data-action="date-mode-open">Volver al modo cita</button></div>');
}
async function openDateModeLocation(){
 await loadDateContext();
 if(!dateContext?.locationAvailable){
  dateMode.locationEnabled=false;dateMode.placeId=null;toast('No hay GPS compartido activo. El Modo Cita funciona igual sin ubicación.');openDateMode();return;
 }
 const places=dateContext.places||[];
 showModal('Contexto de ubicación','<div class="stack"><button class="card plan-pick" data-action="date-mode-location-select" data-place-id=""><b>Usar solo ubicación contextual</b><small>No guarda coordenadas en el recap.</small></button>'+places.slice(0,12).map(place=>'<button class="card plan-pick" data-action="date-mode-location-select" data-place-id="'+attr(place.id)+'"><b>'+esc(place.name)+'</b><small>'+(place.distanceM==null?'Lugar guardado':esc(fmtDistance(place.distanceM)))+'</small></button>').join('')+'<button class="btn ghost" data-action="date-mode-location-off">No usar ubicación</button></div>');
}

function openPlace(){
 const own=(mapData?.locations||cloud.locations||[]).find(l=>l.person===cloud.person&&l.sharing);
 if(!own){toast('Activa tu ubicación para guardar el lugar actual.');return;}
 showModal('Guardar este lugar','<form id="placeForm" class="stack" style="margin-top:16px"><div class="field"><label>Nombre</label><input class="input" name="name" placeholder="Casa, oficina, nuestro parque…" required></div><div class="field"><label>Tipo</label><select name="kind"><option value="home">Casa</option><option value="work">Trabajo</option><option value="memory">Recuerdo</option><option value="adventure">Aventura</option></select></div><div class="field"><label>Nota</label><textarea name="note" placeholder="Algo que quieras recordar de este lugar"></textarea></div><input type="hidden" name="latitude" value="'+Number(own.latitude)+'"><input type="hidden" name="longitude" value="'+Number(own.longitude)+'"><button class="btn" type="submit">Guardar lugar actual</button></form>','place');
}
function openDestination(){
 const partner=cloud.person==='0'?'1':'0',places=mapData?.places||[],active=(mapData?.destinations||[]).find(d=>String(d.person)===String(cloud.person)&&d.active!==false);
 const current=active?(active.kind==='person'?'person:'+active.target_person:'place:'+active.place_id):'none';
 showModal('Acompáñame 2.0','<form id="destinationForm" class="stack" style="margin-top:16px"><div class="field"><label>Voy hacia</label><select name="destination"><option value="person:'+partner+'" '+(current==='person:'+partner?'selected':'')+'>'+esc(partnerName())+'</option>'+places.map(p=>'<option value="place:'+p.id+'" '+(current==='place:'+p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'<option value="none" '+(current==='none'?'selected':'')+'>Ningún destino</option></select></div><p class="muted">La sesión muestra distancia restante, progreso, ETA e histórico. No activará tu ubicación por sí sola.</p><button class="btn" type="submit">Iniciar Acompáñame</button></form>','destination');
}

function storyDocuments(){
 const docs=[];
 for(const i of cloud?.items||[])docs.push({kind:i.kind,title:i.data?.title||kindMeta[i.kind]?.[1]||'Historia',body:[i.data?.body,i.data?.category,i.data?.date].filter(Boolean).join(' · '),date:i.data?.date||i.created});
 for(const p of mapData?.places||[])docs.push({kind:'place',title:p.name,body:p.note||'Lugar de nuestra historia',date:p.created_at});
 for(const t of mapData?.trips||[])docs.push({kind:'trip',title:'Recorrido de '+(names()[Number(t.person)]||'Nosotros'),body:fmtDistance(t.distance_m)+' · '+fmtDuration(t.duration_s)+' · '+(t.dominant_motion||''),date:t.started_at});
 for(const d of cloud?.daily||[])if(d.answer)docs.push({kind:'daily',title:'Respuesta de '+(names()[Number(d.person)]||'Nosotros'),body:d.answer,date:d.day});
 for(const b of cloud?.bond?.entries||[])if(['sharednote','voice','ritual'].includes(b.type)){const x=b.data||{};docs.push({kind:b.type,title:x.title||('ritual'===b.type?'Ritual semanal':'Momento'),body:[x.body,x.gratitude,x.need,x.plan].filter(Boolean).join(' · '),date:b.created});}
 return docs;
}
const aiWords=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9ñ ]/g,' ').split(/\s+/).filter(w=>w.length>2&&!['que','como','con','para','por','una','uno','los','las','del','nos','nuestro','nuestra','cuando','donde'].includes(w));
function aiResult(question){
 const q=String(question||'').trim(),plain=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(!q)return {title:'Pregúntame algo de ustedes',body:'Puedo buscar entre recuerdos, planes, canciones, lugares, recorridos, notas y respuestas guardadas.',matches:[]};
 if(/cuantos? dias|dias juntos|tiempo juntos/.test(plain))return {title:'Su historia hasta hoy',body:'Llevan '+coupleDays()+' días juntos según la fecha configurada en la app.',matches:[]};
 if(/cuantos? recuerdos|recuerdos tenemos/.test(plain))return {title:'Recuerdos guardados',body:'Hay '+items('memory').length+' recuerdos guardados en Nuestra Galaxia.',matches:items('memory').slice(0,5).map(i=>({title:i.data?.title||'Recuerdo',body:fmtDate(i.data?.date)}))};
 if(/planes? pendientes|que planes|planes tenemos/.test(plain)){const list=items('plan').filter(i=>!i.data?.done);return {title:'Planes pendientes',body:list.length?'Tienen '+list.length+' planes todavía por vivir.':'No hay planes pendientes guardados.',matches:list.slice(0,6).map(i=>({title:i.data?.title||'Plan',body:i.data?.body||''}))};}
 if(/lugares?|sitios?/.test(plain)){const list=mapData?.places||[];return {title:'Lugares de ustedes',body:list.length?'Encontré '+list.length+' lugares guardados.':'Todavía no han guardado lugares.',matches:list.slice(0,6).map(p=>({title:p.name,body:p.note||p.kind}))};}
 if(/viajes?|recorridos?|rutas?/.test(plain)){const list=mapData?.trips||[];return {title:'Recorridos guardados',body:list.length?'Hay '+list.length+' recorridos recientes en el mapa.':'Todavía no hay recorridos guardados.',matches:list.slice(0,6).map(t=>({title:fmtDistance(t.distance_m)+' · '+fmtDuration(t.duration_s),body:fmtDateTime(t.started_at)}))};}
 if(/cancion|musica|escuch/.test(plain)){const list=items('song');return {title:'Música de su historia',body:list.length?'Hay '+list.length+' canciones enlazadas a ustedes.':'Aún no hay canciones guardadas por enlace.',matches:list.slice(0,6).map(i=>({title:i.data?.title||'Canción',body:i.data?.platform||''}))};}
 if(/voz|audio|mensaje/.test(plain)){const list=(cloud?.bond?.entries||[]).filter(x=>x.type==='voice');return {title:'Mensajes de voz',body:list.length?'Han guardado '+list.length+' mensajes de voz.':'Todavía no hay mensajes de voz guardados.',matches:list.slice(0,6).map(x=>({title:x.data?.title||'Voz',body:x.data?.body||''}))};}
 const words=aiWords(q),docs=storyDocuments().map(d=>{const hay=aiWords((d.title||'')+' '+(d.body||'')+' '+(d.date||''));let score=0;for(const w of words)for(const h of hay)if(h===w||h.includes(w)||w.includes(h))score+=h===w?3:1;return {...d,score};}).filter(d=>d.score>0).sort((a,b)=>b.score-a.score);
 return docs.length?{title:'Esto encontré en su historia',body:'Relacioné tu pregunta con '+docs.length+' momentos guardados.',matches:docs.slice(0,6)}:{title:'Todavía no encuentro algo relacionado',body:'Prueba con nombres de lugares, palabras de un recuerdo, “planes pendientes”, “viajes”, “canciones” o “cuántos días juntos”.',matches:[]};
}
function aiResultMarkup(result){
 const title=result?.title||'Nuestra historia',body=result?.answer||result?.body||'',sources=result?.sources||result?.matches||[],mode=result?.mode||'classic';
 return '<div class="ai-answer"><div class="row between"><span class="badge">Nuestra historia</span><small class="muted">'+esc(mode.includes('fallback')?'fallback seguro':mode==='ai-grounded'?'IA con fuentes':'búsqueda verificada')+'</small></div><h3>'+esc(title)+'</h3><p>'+esc(body)+'</p>'+(sources.length?'<div class="stack compact ai-sources">'+sources.slice(0,10).map((m,i)=>'<div class="ai-match"><span class="badge mini">'+esc(m.ref||('S'+(i+1)))+'</span><div><b>'+esc(m.title||'Momento')+'</b><small>'+esc(m.snippet||m.body||m.date||'')+'</small></div></div>').join('')+'</div>':'')+'</div>';
}
function openOurAI(){
 showModal('Nuestra IA 2.0','<div class="ai-intro intelligence-intro"><p><b>Galaxy Intelligence</b> combina coincidencia exacta, texto completo y búsqueda semántica dentro de Supabase/PostgreSQL. La búsqueda clásica sigue disponible como fallback.</p><p class="muted">'+ico('shield-check')+' Solo una selección mínima de fuentes puede enviarse al proveedor generativo cuando esa función está configurada. Coordenadas exactas no forman parte del índice semántico.</p><div class="chips"><button class="chip" data-action="ai-question" data-question="¿Cuándo estuvimos por última vez en Útica?">Última vez en Útica</button><button class="chip" data-action="ai-question" data-question="¿Qué recuerdo tenemos relacionado con pesca?">Pesca</button><button class="chip" data-action="ai-question" data-question="Busca la noche donde escuchamos nuestra canción">Música y noches</button></div></div><form id="ourAiForm" class="stack" style="margin-top:14px"><div class="field"><label>Pregunta sobre nuestra historia</label><input class="input" name="question" maxlength="600" placeholder="Ej. ¿qué recuerdos tenemos de Útica?" required></div><button class="btn" type="submit">'+ico('sparkles')+' Preguntar a Nuestra IA 2.0</button></form><div class="intelligence-tools"><button class="card intelligence-tool" type="button" data-action="intelligence-connections-open"><span>'+ico('git-branch')+'</span><div><b>IA de conexiones</b><small>Descubre relaciones y explica por qué existen.</small></div></button><button class="card intelligence-tool" type="button" data-action="intelligence-narrator-open"><span>'+ico('book-open-text')+'</span><div><b>IA narradora</b><small>Un capítulo basado únicamente en 5–10 recuerdos reales.</small></div></button><button class="card intelligence-tool" type="button" data-action="intelligence-book-open"><span>'+ico('book-heart')+'</span><div><b>Libro de Nuestra Galaxia</b><small>Historia organizada por capítulos, lista para evolucionar.</small></div></button></div><div data-role="ai-result" style="margin-top:14px">'+aiResultMarkup(aiResult(''))+'</div>','our-ai');
}
async function showAiAnswer(question){
 const q=String(question||'').trim(),box=modal.querySelector('[data-role="ai-result"]');if(!q||!box)return;
 box.innerHTML='<div class="monthly-loading">'+loading('Buscando en nuestra historia')+'<p>Combinando exactos, texto completo y semántica…</p></div>';
 try{
  const result=await api('intelligence-ask',{question:q});
  if(box.isConnected)box.innerHTML=aiResultMarkup({title:'Esto encontré',...result});
 }catch(error){
  const fallback=aiResult(q);
  if(box.isConnected)box.innerHTML=aiResultMarkup({...fallback,answer:fallback.body,mode:'classic-fallback'});
 }
 refreshIcons();
}
function intelligenceSourceOptions(){
 const rows=[];
 for(const item of cloud?.items||[])if(['memory','song','plan','note','journey'].includes(item.kind))rows.push({type:item.kind,id:item.id,title:item.data?.title||item.kind});
 for(const p of cloud?.places||mapData?.places||[])rows.push({type:'place',id:p.id,title:p.name});
 return rows.slice(0,80);
}
function openIntelligenceConnectionsPicker(){
 const rows=intelligenceSourceOptions();
 showModal('IA de conexiones','<div class="intelligence-feature-head"><span>'+ico('git-branch')+'</span><div><h3>Conexiones explicables</h3><p>Elige una pieza de su historia. Cada relación mostrará sus razones: lugar, época, viaje o similitud semántica.</p></div></div><div class="stack intelligence-source-picker">'+(rows.length?rows.map(r=>'<button class="card compact intelligence-source-choice" data-action="intelligence-connections-run" data-source-type="'+attr(r.type)+'" data-source-id="'+attr(r.id)+'"><span>'+ico(r.type==='song'?'music':r.type==='place'?'map-pin':r.type==='journey'?'route':'heart')+'</span><b>'+esc(r.title)+'</b>'+ico('chevron-right')+'</button>').join(''):'<div class="empty">Guarden primero recuerdos, canciones, lugares o planes.</div>')+'</div>','intelligence-connections');
}
async function openIntelligenceConnections(sourceType,sourceId){
 showModal('IA de conexiones','<div class="monthly-loading">'+loading('Buscando conexiones')+'<p>Comparando contexto y relaciones verificables…</p></div>','intelligence-connections');
 try{
  const result=await api('intelligence-connections',{sourceType,sourceId}),rows=result.connections||[];
  showModal('IA de conexiones','<div class="intelligence-feature-head"><span>'+ico('git-branch')+'</span><div><p class="eyebrow">FUENTE</p><h3>'+esc(result.source?.title||'Momento')+'</h3></div></div><div class="stack">'+(rows.length?rows.map(r=>'<article class="card intelligence-connection"><h3>'+esc(r.title||'Conexión')+'</h3><p class="muted">'+esc(r.date||'')+'</p><ul>'+((r.reasons||[]).map(reason=>'<li>'+esc(reason)+'</li>').join(''))+'</ul></article>').join(''):'<div class="empty">Todavía no encontré una conexión suficientemente útil.</div>')+'</div>','intelligence-connections');
 }catch(error){showModal('IA de conexiones','<div class="empty">'+ico('circle-alert')+' No pudimos calcular conexiones ahora.</div>');}
}
function openIntelligenceNarrator(){
 const memories=items('memory').slice(0,20);
 showModal('IA narradora','<form id="intelligenceNarratorForm" class="stack"><div class="intelligence-feature-head"><span>'+ico('book-open-text')+'</span><div><h3>Un capítulo, sin inventar</h3><p>Selecciona entre 5 y 10 recuerdos. Cada párrafo deberá apuntar a fuentes reales.</p></div></div><div class="intelligence-memory-picker">'+memories.map((m,i)=>'<label class="toggle-row"><input type="checkbox" name="sourceId" value="'+attr(m.id)+'" '+(i<5?'checked':'')+'><span><b>'+esc(m.data?.title||'Recuerdo')+'</b><small>'+esc(fmtDate(m.data?.date||String(m.created||'').slice(0,10)))+'</small></span></label>').join('')+'</div><button class="btn" type="submit">'+ico('sparkles')+' Crear capítulo</button></form><div data-role="narrative-result"></div>','intelligence-narrator');
}
function narrativeMarkup(result){
 if(!result?.available)return '<div class="empty intelligence-fallback">'+ico('shield-check')+'<h3>No se generó un capítulo</h3><p>'+esc(result?.error||'La IA narradora no está disponible. Los recuerdos originales siguen intactos.')+'</p></div>';
 const n=result.narrative||{};
 return '<article class="intelligence-narrative"><p class="eyebrow">CAPÍTULO BASADO EN FUENTES</p><h2>'+esc(n.title||'Nuestro capítulo')+'</h2>'+((n.paragraphs||[]).map(p=>'<p>'+esc(p.text)+' <small>['+(p.sourceIds||[]).map(esc).join(', ')+']</small></p>').join(''))+'</article>';
}
async function openIntelligenceBook(){
 showModal('Libro de Nuestra Galaxia','<div class="monthly-loading">'+loading('Ordenando nuestra historia')+'<p>Preparando capítulos internos…</p></div>','intelligence-book');
 try{
  const book=await api('intelligence-book'),chapterIcons={beginning:'sparkles',firsts:'footprints',dates:'calendar-heart',trips:'route',places:'map-pin',music:'music',photos:'images',quotes:'quote',stats:'chart-no-axes-column-increasing',narrative:'book-open-text'};
  const labels={beginning:'Inicio',firsts:'Primeras veces',dates:'Citas',trips:'Viajes',places:'Lugares',music:'Música',photos:'Fotos',quotes:'Frases',stats:'Estadísticas',narrative:'Capítulos narrativos'};
  showModal('Libro de Nuestra Galaxia','<div class="intelligence-book-head"><span>'+ico('book-heart')+'</span><div><p class="eyebrow">VERSIÓN INTERNA 1</p><h2>Libro de Nuestra Galaxia</h2><p>Organizado para una futura exportación, sin hacer del PDF un requisito de este Galaxy.</p></div></div><div class="intelligence-book-sections">'+(book.sections||[]).map(section=>'<details class="card intelligence-book-section"><summary><span>'+ico(chapterIcons[section.id]||'book-open')+'</span><b>'+esc(labels[section.id]||section.title)+'</b><small>'+Number(section.items?.length||0)+'</small></summary><div class="stack compact">'+((section.items||[]).length?section.items.map(item=>'<div class="ai-match"><b>'+esc(item.title||'Momento')+'</b><small>'+esc(item.date||'')+(item.snippet?' · '+esc(item.snippet):'')+'</small></div>').join(''):'<p class="muted">Este capítulo crecerá con su historia.</p>')+'</div></details>').join('')+'</div>','intelligence-book');
 }catch(error){showModal('Libro de Nuestra Galaxia','<div class="empty">'+ico('circle-alert')+' No pudimos organizar el libro ahora.</div>');}
}
async function openIntelligenceSearchResult(btn){
 const type=String(btn.dataset.sourceType||''),id=String(btn.dataset.sourceId||'');
 if(type==='place'){const fake={dataset:{type:'place',id}};await openUniversalSearchResult(fake);return;}
 if(kindMeta[type]){const fake={dataset:{type:'item',id,kind:type}};await openUniversalSearchResult(fake);return;}
 showModal(btn.dataset.title||'Resultado','<div class="ai-answer"><span class="badge">'+esc(type||'Historia')+'</span><h3>'+esc(btn.dataset.title||'Momento')+'</h3><p>'+esc(btn.dataset.snippet||'Contenido relacionado dentro de su historia.')+'</p></div>');
}
async function busy(task,success){
 try{await task();if(success)toast(success);}
 catch(e){toast(e.message);}
}
async function submitItem(form){
 const fd=new FormData(form),kind=modal.dataset.kind,id=modal.dataset.editId,version=Number(modal.dataset.version||0);
 const data={title:fd.get('title'),body:fd.get('body'),category:fd.get('category')};
 if(fd.has('sourceJson')&&String(fd.get('sourceJson')||'')){try{data.source=JSON.parse(String(fd.get('sourceJson')));}catch{}}
 if(fd.has('date'))data.date=fd.get('date');
 if(kind==='capsule'){
  data.unlockType=fd.get('unlockType')==='place'?'place':'date';
  if(data.unlockType==='place'){
   const place=(mapData?.places||[]).find(p=>String(p.id)===String(fd.get('unlockPlaceId')||''));
   if(!place)throw new Error('Elige el lugar que desbloqueará la cápsula.');
   data.placeId=Number(place.id);data.placeName=String(place.name||'Lugar');data.latitude=Number(place.latitude);data.longitude=Number(place.longitude);data.radius=150;
   data.unlockDate='';data.unlockTime='';delete data.unlockAt;
  }else{
   data.unlockDate=String(fd.get('date')||'');data.unlockTime=String(fd.get('unlockTime')||'00:00');
   if(!data.unlockDate)throw new Error('Elige la fecha de desbloqueo.');
   data.unlockAt=new Date(data.unlockDate+'T'+data.unlockTime+':00-05:00').toISOString();
  }
  data.photoPath=String(fd.get('capsulePhotoPath')||'');data.audioPath=String(fd.get('capsuleAudioPath')||'');data.audioMime=String(fd.get('capsuleAudioMime')||'');data.songId=String(fd.get('capsuleSongId')||'');
  if(!data.photoPath)delete data.photoPath;if(!data.audioPath){delete data.audioPath;delete data.audioMime;}if(!data.songId)delete data.songId;
 }
 if(kind==='event'){data.annual=fd.get('annual')==='on';data.time=String(fd.get('eventTime')||'');if(!data.time)delete data.time;}
 if(kind==='plan'||kind==='wish')data.done=fd.get('done')==='on';
 if(kind==='plan'){data.planCategory=fd.get('planCategory');data.budget=Math.max(0,Number(fd.get('budget')||0));data.minutes=Math.max(15,Number(fd.get('minutes')||120));data.where=fd.get('where')==='casa'?'casa':'salir';}
 if(fd.has('placeId')&&String(fd.get('placeId')||''))data.placeId=Number(fd.get('placeId'));
 await api('item-save',{...(id?{id,version}:{}),kind,data});closeModal();await refreshState();toast('Guardado en nuestra galaxia.');
}
async function deleteItem(id){
 const item=cloud.items.find(i=>i.id===id);if(!item)return;
 if(!confirm('¿Eliminar este contenido?'))return;
 await api('item-delete',{id,version:item.version});await refreshState();toast('Eliminado.');
}
async function saveDaily(field,value){await api('daily-save',{field,value});await refreshState();}
async function sendGesture(gestureId){const definition=bondGestureCatalog().find(g=>String(g.id)===String(gestureId));await api('bond-send-gesture',{gestureId});await refreshState({quiet:true});render();toast(definition?.behavior==='haptic'?'Toque enviado.':(definition?.name||'Gesto')+' enviado.');}
async function bondDelete(id){
 const e=cloud.bond.entries.find(x=>x.id===id);if(!e||!confirm('¿Eliminar este momento?'))return;
 await api('bond-delete',{id,version:e.version});await refreshState();toast('Momento eliminado.');
}
async function chooseWidgetPhoto(){
 const photos=await loadMedia('photo');
 if(!photos.length){toast('Primero añade una foto al álbum.');return;}
 showModal('Foto del widget','<div class="gallery" style="margin-top:16px">'+photos.map(x=>'<button class="photo" style="border:0;padding:0" data-action="widget-photo-select" data-path="'+attr(x.path)+'"><img src="'+attr(x.url)+'" alt="Elegir foto"></button>').join('')+'</div>');
}

document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-view],[data-tab],[data-action]');if(!btn)return;
 if(btn.dataset.view){go(btn.dataset.view);return;}
 if(btn.dataset.tab){memoryTab=btn.dataset.tab;render();return;}
 const a=btn.dataset.action;
 try{
  if(a==='gift-open'){if(welcomeEntering)return;welcomeEntering=true;welcomeMusic.play().catch(()=>{});const intro=document.querySelector('.gift-intro');intro?.classList.add('opening');setTimeout(()=>intro?.classList.add('entering'),900);setTimeout(()=>intro?.classList.add('blackout'),1750);setTimeout(()=>{welcomeGift=false;welcomeEntering=false;render();},2850);return;}
  if(a==='welcome-next'){if(welcomeStep<4){const w=document.querySelector('.welcome-curtain');if(w)w.classList.add('closing');setTimeout(()=>{welcomeStep++;render();},420);}else finishAdriWelcome();return;}
  if(a==='tour-next'){document.querySelector('.app-tour')?.remove();tourStep++;renderTourOverlay();return;}
  if(a==='tour-skip'){document.querySelector('.app-tour')?.remove();tourStep=-1;welcomeMusic.pause();welcomeMusic.currentTime=0;render();return;}
  if(a==='welcome-skip'){finishAdriWelcome();return;}
  if(a==='welcome-replay'){welcomePreview=true;welcomeStep=0;welcomeGift=true;welcomeEntering=false;tourStep=-1;render();window.scrollTo(0,0);return;}
  if(a==='modal-close'){closeModal();return;}
  if(a==='chat-open'){if(native.chatLockEnabled&&!chatUnlockedSession){await GalaxyNative.call('unlockChat');chatUnlockedSession=true;}chatState=null;chatInitialScroll=true;go('chat');setChatPresence('ONLINE');await loadChat({quiet:true,force:true});flushChatOutbox({retryFailed:true}).catch(()=>{});return;}
  if(a==='chat-close'){chatReply=null;setChatPresence('OFFLINE');go('home');return;}
  if(a==='chat-load-more'){await loadChat({older:true});return;}
  if(a==='chat-reply'){const id=btn.dataset.id;chatReply=(chatState?.messages||[]).find(m=>String(m.id)===String(id))||null;closeModal();render();requestAnimationFrame(()=>document.querySelector('#chatForm textarea')?.focus());return;}
  if(a==='chat-reply-menu'){const id=btn.dataset.id;chatReply=(chatState?.messages||[]).find(m=>String(m.id)===String(id))||null;closeModal();render();requestAnimationFrame(()=>document.querySelector('#chatForm textarea')?.focus());return;}
  if(a==='chat-reply-cancel'){chatReply=null;render();return;}
  if(a==='chat-jump'){await jumpToChatMessage(btn.dataset.id);return;}
  if(a==='chat-pin-jump'){await jumpToChatMessage(btn.dataset.id);return;}
  if(a==='chat-jump-present'){chatNewCount=0;const el=document.querySelector('#chatMessages');if(el)el.scrollTo({top:el.scrollHeight,behavior:'smooth'});btn.remove();setTimeout(()=>markChatReadIfVisible(),250);return;}
   if(a==='galaxy-share'){shareGalaxyEntity(btn.dataset.cardType,btn.dataset.kind,btn.dataset.id,btn.dataset.title||'');return;}
   if(a==='status-chat-reply'){shareGalaxyEntity('STATUS','status',btn.dataset.id,btn.dataset.title||'Estado');go('chat');setTimeout(()=>document.querySelector('#chatForm textarea')?.focus(),120);return;}
  if(a==='chat-search-open'){openChatSearch();return;}
  if(a==='chat-search-more'){const form=modal.querySelector('#chatSearchForm');if(form)await runChatSearch(form,{beforeSeq:Number(btn.dataset.beforeSeq||0),append:true});return;}
   if(a==='chat-context-open'){await openChatContextMenu();return;}
   if(a==='chat-context-start'){
    if(!native.tracking){closeModal();toast('Activa Compartir ubicación para iniciar Acompáñame. La app no activará el GPS automáticamente.');go('map');return;}
    const kind=btn.dataset.kind,id=btn.dataset.id;
    const result=kind==='home'
      ?await api('context-session',{operation:'start',mode:'return_home'})
      :await api('context-session',{operation:'start',mode:'accompany',destinationKind:kind,...(kind==='person'?{targetPerson:id,label:partnerName()}:{placeId:Number(id)})});
    if(!result?.session?.id)throw new Error('No pudimos iniciar Acompáñame.');
    closeModal();
    await refreshMap({quiet:true,detail:true}).catch(()=>{});
    queueGalaxyCard('CHECK_IN','context_session',result.session.id,{title:result.session.label||'Acompáñame'});
    toast('Acompáñame iniciado y compartido en Galaxy Chat.');
    return;
   }
   if(a==='chat-galaxy-open'){await openChatGalaxyPicker();return;}
   if(a==='chat-galaxy-pick'){const cardType=btn.dataset.cardType,kind=btn.dataset.kind,id=btn.dataset.id,title=btn.dataset.title||'';closeModal();queueGalaxyCard(cardType,kind,id,{title});toast('Compartido en Galaxy Chat.');return;}
   if(a==='chat-poll-open'){openChatPollForm();return;}
   if(a==='chat-check-open'){openChatChecklistForm();return;}
   if(a==='chat-save-as-open'){openChatSaveAs(btn.dataset.id);return;}
   if(a==='chat-save-as-kind'){
    const m=chatMessageById(btn.dataset.id),kind=btn.dataset.kind;if(!m)return;
    const title=String(m.card?.title||m.body||'').trim().slice(0,160),body=String(m.body||m.card?.body||'').trim();
    closeModal();
    if(kind==='goal'){prefillGoalFromChat(title||'Objetivo desde el chat',body);return;}
    if(kind==='place'){
      const lat=Number(m.card?.latitude??m.attachment?.latitude),lon=Number(m.card?.longitude??m.attachment?.longitude);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)){toast('Este mensaje no incluye una ubicación para guardar.');return;}
      showModal('Guardar lugar','<form id="placeForm" class="stack"><div class="field"><label>Nombre</label><input class="input" name="name" value="'+attr(title||'Lugar del chat')+'" required></div><div class="field"><label>Tipo</label><select name="kind"><option value="memory">Recuerdo</option><option value="home">Casa</option><option value="work">Trabajo</option><option value="adventure">Aventura</option></select></div><div class="field"><label>Nota</label><textarea name="note">'+esc(body)+'</textarea></div><input type="hidden" name="latitude" value="'+attr(lat)+'"><input type="hidden" name="longitude" value="'+attr(lon)+'"><button class="btn" type="submit">Guardar lugar</button></form>','place');return;
    }
    if(kind==='song'){
      openMusicUrl();const song=m.card?.type==='SONG'?m.card:null,u=String(m.body||'').match(/https:\/\/[^\s<]+/i)?.[0]||song?.url||'';const ti=modal.querySelector('[name="title"]'),url=modal.querySelector('[name="url"]');if(ti)ti.value=title||'Canción';if(url)url.value=u;return;
    }
    chatOpenItemDraft(kind,title||({memory:'Recuerdo',plan:'Plan',note:'Nota',wish:'Deseo'}[kind]||'Contenido'),body);return;
   }
  if(a==='chat-settings-open'){openChatSettings();return;}
  if(a==='chat-albums-open'){await openChatAlbums();return;}
  if(a==='chat-album-create'){openChatAlbumCreate();return;}
  if(a==='chat-album-open'){await openChatAlbum(btn.dataset.id);return;}
   if(a==='chat-album-memory'){if(confirm('¿Abrir un recuerdo con este álbum? Nada se guardará hasta que confirmes en el editor.'))await openChatAlbumAsMemory(btn.dataset.id);return;}
  if(a==='chat-album-delete'){if(confirm('¿Eliminar este álbum? Las fotos y videos seguirán en el chat.')){await api('chat-albums',{operation:'delete',id:btn.dataset.id});await openChatAlbums();}return;}
  if(a==='chat-album-add-open'){await openChatAlbumPicker(btn.dataset.attachmentId);return;}
  if(a==='chat-album-add'){await api('chat-albums',{operation:'add',id:btn.dataset.albumId,attachmentIds:[btn.dataset.attachmentId]});closeModal();toast('Añadido al álbum.');return;}
  if(a==='chat-stickers-open'){await openChatStickerPicker();return;}
  if(a==='chat-sticker-send'){closeModal();queueChatMessage({messageType:'sticker',attachment:{stickerId:btn.dataset.id}});return;}
  if(a==='chat-sticker-favorite'){await api('chat-stickers',{operation:'favorite',id:btn.dataset.id,favorite:btn.dataset.favorite!=='true'});await openChatStickerPicker();return;}
  if(a==='chat-sticker-create'){const result=await api('chat-stickers',{operation:'create',attachmentId:btn.dataset.attachmentId,name:'Sticker de Nuestra Galaxia'});closeModal();toast(result.sticker?'Sticker creado.':'No se pudo crear.');return;}
  if(a==='chat-gif-pick'){const imported=await api('chat-gif-import',{url:btn.dataset.url,title:btn.dataset.title||'GIF'});closeModal();const item=normalizeChatUpload({...imported.item,gif:true},'photo');item.gif=true;queueChatMessage({messageType:'gif',attachments:[item]});return;}
  if(a==='chat-video-message-open'){showModal('Videomensaje','<div class="chat-video-duration"><p>Elige la duración máxima.</p><button class="btn secondary" type="button" data-action="chat-video-message" data-seconds="15">15 s</button><button class="btn secondary" type="button" data-action="chat-video-message" data-seconds="30">30 s</button><button class="btn secondary" type="button" data-action="chat-video-message" data-seconds="60">60 s</button></div>','chat-video-duration');return;}
  if(a==='chat-video-message'){await addChatNativeMedia('captureChatVideoMessage',[Number(btn.dataset.seconds||30)],'video');return;}
  if(a==='chat-location-current'){const loc=await GalaxyNative.call('getChatLocation');closeModal();queueChatMessage({messageType:'location',attachment:{mode:'static',latitude:Number(loc.latitude),longitude:Number(loc.longitude),accuracy:Number(loc.accuracy||0),label:'Ubicación actual'}});return;}
  if(a==='chat-location-place'){closeModal();queueChatMessage({messageType:'location',attachment:{mode:'static',latitude:Number(btn.dataset.lat),longitude:Number(btn.dataset.lon),label:btn.dataset.label||'Lugar guardado'}});return;}
  if(a==='chat-location-live'){if(!native.tracking){toast('Para compartir ubicación en vivo, activa primero “Compartir ubicación” en el Mapa. Así Android mantiene el indicador visible y tú controlas cuándo detener el GPS.');closeModal();go('map');return;}await GalaxyNative.call('refreshLocation').catch(()=>{});const raw=btn.dataset.duration,seconds=raw?Number(raw):null,result=await api('chat-live-location',{operation:'start',durationSeconds:seconds});closeModal();queueChatMessage({messageType:'location',attachment:{mode:'live',liveSessionId:result.session.id,label:'Ubicación en vivo'}});return;}
  if(a==='chat-location-live-stop'){await api('chat-live-location',{operation:'stop',id:btn.dataset.id});await loadChat({quiet:true,force:true});return;}
  if(a==='chat-shared-open'){await openChatShared();return;}
  if(a==='chat-shared-tab'){await openChatShared(btn.dataset.category||'media');return;}
  if(a==='chat-spoiler-reveal'){const text=btn.nextElementSibling;btn.hidden=true;if(text)text.hidden=false;return;}
  if(a==='chat-lock-toggle'){const enabled=btn.dataset.enabled!=='true';if(enabled)await GalaxyNative.call('unlockChat').catch(()=>{});native=await GalaxyNative.call('setChatLock',enabled);chatUnlockedSession=!enabled||chatUnlockedSession;openChatSettings();toast(enabled?'Bloqueo del chat activado.':'Bloqueo del chat desactivado.');return;}
  if(a==='chat-send-mode'){const mode=btn.dataset.mode;closeModal();queueCurrentChat({silent:mode==='silent',ttlSeconds:chatPreferencesState?.default_ttl_seconds||null});return;}
  if(a==='chat-view-once'){const result=await api('chat-open-once',{id:btn.dataset.id});const media=result.media||[];showModal('Ver una vez','<div class="chat-view-once-modal">'+media.map(x=>x.kind==='video'?'<video controls autoplay playsinline src="'+attr(x.url)+'"></video>':x.kind==='audio'?'<audio controls autoplay src="'+attr(x.url)+'"></audio>':'<img src="'+attr(x.url)+'" alt="Contenido temporal">').join('')+'<small>Este contenido desaparecerá al cerrar esta vista.</small></div>','chat-view-once');await loadChat({quiet:true,force:true});return;}
  if(a==='chat-audio-transcript'){showModal('Transcribir audio','<div class="chat-transcript-consent">'+ico('shield-check')+'<h3>Transcripción bajo demanda</h3><p>Si este audio aún no tiene transcripción, se enviará temporalmente al proveedor de IA configurado para convertirlo a texto. El audio original seguirá privado y la transcripción podrá borrarse por separado.</p><button class="btn" type="button" data-action="chat-transcript-confirm" data-attachment-id="'+attr(btn.dataset.attachmentId)+'">Acepto y transcribir</button><button class="btn ghost" type="button" data-action="modal-close">Cancelar</button></div>','chat-transcript-consent');return;}
  if(a==='chat-transcript-confirm'){const attachmentId=btn.dataset.attachmentId,result=await api('chat-transcript',{attachmentId});showModal('Transcripción','<div class="chat-transcript"><p>'+esc(result.transcript?.transcript||'Sin texto disponible.')+'</p><button class="btn danger small" type="button" data-action="chat-transcript-delete" data-attachment-id="'+attr(attachmentId)+'">'+ico('trash-2')+' Borrar transcripción</button></div>','chat-transcript');return;}
  if(a==='chat-transcript-delete'){await api('chat-transcript-delete',{attachmentId:btn.dataset.attachmentId});closeModal();toast('Transcripción eliminada. El audio se conserva.');return;}
  if(a==='chat-translate'){const message=(chatState?.messages||[]).find(x=>String(x.id)===String(btn.dataset.id)),result=await api('chat-translate',{id:btn.dataset.id,targetLanguage:'es'});showModal('Traducción','<div class="chat-translation"><small>Original</small><p>'+esc(message?.body||'')+'</p><hr><small>Traducción</small><p>'+esc(result.translation?.translated_text||'')+'</p></div>','chat-translation');return;}
  if(a==='chat-schedule-edit'){const m=(chatState?.messages||[]).find(x=>String(x.id)===String(btn.dataset.id));if(!m)return;const d=new Date(m.scheduled_at),local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);showModal('Mensaje programado','<form id="chatScheduleEditForm" class="stack"><input type="hidden" name="id" value="'+attr(m.id)+'"><div class="field"><label>Fecha y hora</label><input class="input" type="datetime-local" name="scheduledAt" value="'+attr(local)+'" required></div><label class="chat-setting-toggle"><input type="checkbox" name="silent" '+(m.silent?'checked':'')+'> Enviar en silencio</label><button class="btn" type="submit">Guardar</button><button class="btn danger" type="button" data-action="chat-schedule-cancel" data-id="'+attr(m.id)+'">Cancelar mensaje</button></form>','chat-schedule-edit');return;}
  if(a==='chat-schedule-cancel'){await api('chat-schedule-update',{id:btn.dataset.id,cancel:true});closeModal();await loadChat({quiet:true,force:true});return;}
  if(a==='chat-saved-open'){await openChatCollection('saved');return;}
  if(a==='chat-pins-open'){await openChatCollection('pins');return;}
  if(a==='chat-pin-prev'){const ids=chatState?.pinnedIds||[];if(ids.length){chatPinIndex=(chatPinIndex-1+ids.length)%ids.length;render();}return;}
  if(a==='chat-pin-next'){const ids=chatState?.pinnedIds||[];if(ids.length){chatPinIndex=(chatPinIndex+1)%ids.length;render();}return;}
  if(a==='chat-result-jump'){const id=btn.dataset.id;closeModal();await jumpToChatMessage(id);return;}
  if(a==='chat-edit-open'){openChatEdit(btn.dataset.id);return;}
  if(a==='chat-delete'){openChatDelete(btn.dataset.id);return;}
  if(a==='chat-delete-open'){openChatDelete(btn.dataset.id);return;}
  if(a==='chat-delete'){openChatDelete(btn.dataset.id);return;}
  if(a==='chat-delete-scope'){await api('chat-delete',{id:btn.dataset.id,scope:btn.dataset.scope});closeModal();await loadChat({quiet:true,force:true});return;}
  if(a==='chat-pin-toggle'){await api('chat-pin',{id:btn.dataset.id,pinned:btn.dataset.pinned!=='true'});closeModal();await loadChat({quiet:true,force:true});return;}
  if(a==='chat-favorite-toggle'){await api('chat-favorite',{id:btn.dataset.id,saved:btn.dataset.saved!=='true'});closeModal();await loadChat({quiet:true,force:true});return;}
  if(a==='chat-react-menu'){const m=(chatState?.messages||[]).find(x=>String(x.id)===String(btn.dataset.id)),mine=(m?.reactions||[]).find(r=>String(r.person)===String(cloud.person))?.emoji||'',emoji=mine===btn.dataset.emoji?'':btn.dataset.emoji;await api('chat-react',{id:btn.dataset.id,emoji});if(modal.open)closeModal();await loadChat({quiet:true,force:true});return;}
  if(a==='chat-react-quick'){const m=(chatState?.messages||[]).find(x=>String(x.id)===String(btn.dataset.id)),mine=(m?.reactions||[]).find(r=>String(r.person)===String(cloud.person))?.emoji||'',emoji=mine===btn.dataset.emoji?'':btn.dataset.emoji;await api('chat-react',{id:btn.dataset.id,emoji});await loadChat({quiet:true,force:true});return;}
  if(a==='chat-retry'){const rows=readChatOutbox(),i=rows.findIndex(x=>String(x.client_id)===String(btn.dataset.clientId));if(i>=0){rows[i]._localState='PENDING';writeChatOutbox(rows);render();await flushChatOutbox({retryFailed:true});await loadChat({quiet:true,force:true});}return;}
  if(a==='chat-local-delete'){writeChatOutbox(readChatOutbox().filter(x=>String(x.client_id)!==String(btn.dataset.clientId)));render();return;}
  if(a==='chat-attach-open'){openChatAttachMenu();return;}
  if(a==='chat-camera-open'){openChatCameraMenu();return;}
  if(a==='chat-permission-retry'){const kind=btn.dataset.kind==='video'?'video':'photo';closeModal();await addChatNativeMedia(kind==='video'?'captureChatVideo':'captureChatPhoto',[],kind);return;}
  if(a==='chat-open-app-settings'){await GalaxyNative.call('openAppSettings');return;}
  if(a==='chat-attachment-remove'){chatAttachmentsDraft.splice(Number(btn.dataset.index),1);render();return;}
  if(a==='chat-attach-camera'){await addChatNativeMedia('captureChatPhoto',[],'photo');return;}
  if(a==='chat-attach-video-camera'){await addChatNativeMedia('captureChatVideo',[],'video');return;}
  if(a==='chat-attach-file'){await addChatNativeMedia('pickMedia',['chat-file'],'file');return;}
  if(a==='chat-attach-location'){await openChatLocationMenu();return;}
  if(a==='chat-attach-song'){openChatSongPicker();return;}
   if(a==='chat-song-pick'){const song=songItems().find(x=>String(x.id)===String(btn.dataset.id));if(song){closeModal();queueGalaxyCard('SONG','song',song.id,{title:song.title});}return;}
   if(a==='chat-poll-vote'){await api('chat-poll',{operation:'vote',pollId:btn.dataset.pollId,optionId:btn.dataset.optionId,selected:btn.dataset.selected!=='true'});await loadChat({quiet:true,force:true});return;}
   if(a==='chat-poll-close'){if(confirm('¿Cerrar esta encuesta?')){await api('chat-poll',{operation:'close',pollId:btn.dataset.id});await loadChat({quiet:true,force:true});}return;}
   if(a==='chat-poll-plan'){const result=await api('chat-poll',{operation:'winner',pollId:btn.dataset.pollId}),label=String(result?.winner?.label||'').trim();if(!label)throw new Error('La encuesta no tiene un ganador único.');if(confirm('¿Abrir un Plan con el ganador “'+label+'”?')){closeModal();chatOpenItemDraft('plan',label,'Creado desde el ganador confirmado de una encuesta de Galaxy Chat.');}return;}
   if(a==='chat-check-set'){await api('chat-checklist',{operation:'set',checklistId:btn.dataset.listId,itemId:btn.dataset.itemId,checked:btn.dataset.checked!=='true',expectedVersion:Number(btn.dataset.version||1)});await loadChat({quiet:true,force:true});return;}
   if(a==='chat-check-convert'){const card=(chatState?.messages||[]).map(x=>x.card).find(x=>x?.type==='CHECKLIST'&&String(x.entityId)===String(btn.dataset.id));if(!card)return;if(!confirm('¿Abrir el editor para convertir esta checklist?'))return;const body=(card.items||[]).map(x=>(x.checked?'[x] ':'[ ] ')+x.label).join('\n');closeModal();if(btn.dataset.kind==='goal')prefillGoalFromChat(card.title,body);else chatOpenItemDraft('plan',card.title,body);return;}
   if(a==='chat-daily-answer'){if(String(btn.dataset.day)!==String(cloud.today)){toast('Esta pregunta ya no corresponde al día de hoy.');return;}showModal('Responder pregunta del día','<form id="chatDailyAnswerForm" class="stack"><textarea name="answer" required maxlength="3000" rows="6" placeholder="Tu respuesta…"></textarea><button class="btn" type="submit">Guardar respuesta</button></form>','chat-daily-answer');return;}
   if(a==='chat-card-eta-map'){closeModal();go('map');await refreshMap({quiet:true,detail:true});setTimeout(()=>document.querySelector('#etaCard')?.scrollIntoView({behavior:'smooth',block:'center'}),100);return;}
   if(a==='chat-card-place-map'){closeModal();go('map');await refreshMap({quiet:true,detail:true});setTimeout(()=>map?.setView([Number(btn.dataset.lat),Number(btn.dataset.lon)],16),120);return;}
   if(a==='chat-card-place-go'){if(!native.tracking){toast('Activa Compartir ubicación para iniciar Acompáñame.');go('map');return;}await api('context-session',{operation:'start',mode:'accompany',destinationKind:'place',placeId:Number(btn.dataset.id)});closeModal();go('map');await refreshMap({quiet:true,detail:true});toast('Acompáñame iniciado hacia este lugar.');return;}
   if(a==='chat-card-place-save'){
    const card=(chatState?.messages||[]).map(x=>x.card).find(x=>x?.type==='PLACE'&&String(x.entityId)===String(btn.dataset.id));if(!card)return;
    const ownPlaces=(mapData?.places||cloud?.places||[]).filter(p=>String(p.owner)===String(cloud.person));
    const duplicate=ownPlaces.some(p=>String(p.id)===String(card.entityId)||(Math.abs(Number(p.latitude)-Number(card.latitude))<0.00001&&Math.abs(Number(p.longitude)-Number(card.longitude))<0.00001&&String(p.name||'').trim().toLocaleLowerCase('es')===String(card.title||'').trim().toLocaleLowerCase('es')));
    if(duplicate){toast('Este lugar ya está guardado en tu mapa.');return;}
    if(!confirm('¿Guardar este lugar también en tu mapa?'))return;
    showModal('Guardar lugar','<form id="placeForm" class="stack"><div class="field"><label>Nombre</label><input class="input" name="name" value="'+attr(card.title||'Lugar compartido')+'" required></div><div class="field"><label>Tipo</label><select name="kind"><option value="memory">Recuerdo</option><option value="home">Casa</option><option value="work">Trabajo</option><option value="adventure">Aventura</option></select></div><div class="field"><label>Nota</label><textarea name="note">'+esc(card.note||'')+'</textarea></div><input type="hidden" name="latitude" value="'+attr(card.latitude)+'"><input type="hidden" name="longitude" value="'+attr(card.longitude)+'"><button class="btn" type="submit">Guardar lugar</button></form>','place');return;
   }
   if(a==='chat-card-song-play'){rebuildMusicQueue();const index=musicQueue.findIndex(x=>String(x.id)===String(btn.dataset.id));if(index>=0)playMusicAt(index);else toast('Esta canción ya no está disponible en Nuestra Música.');return;}
   if(a==='chat-card-song-add'){const song=(cloud?.items||[]).find(x=>x.kind==='song'&&String(x.id)===String(btn.dataset.id));if(song){toast('Esta canción ya está en Nuestra Música.');return;}toast('La canción ya no está disponible para añadir.');return;}
   if(a==='chat-card-status-reply'){
    const m=(chatState?.messages||[]).find(x=>x.card?.type==='STATUS'&&String(x.card.entityId)===String(btn.dataset.id));if(!m)return;
    chatReply=m;render();requestAnimationFrame(()=>document.querySelector('#chatForm textarea')?.focus());return;
   }
   if(a==='chat-card-event-plan'){const event=(cloud?.items||[]).find(x=>x.kind==='event'&&String(x.id)===String(btn.dataset.id));if(event&&confirm('¿Abrir un plan con este evento?')){closeModal();chatOpenItemDraft('plan',event.data?.title||'Plan',event.data?.body||'',{date:event.data?.date||''});}return;}
   if(a==='chat-card-event-remind'){if(!native.momentNotifications){if(!confirm('¿Activar recordatorios de momentos para este teléfono?'))return;native=await GalaxyNative.call('setMomentNotifications',true);}await GalaxyNative.call('refreshMoments');toast('Recordatorio sincronizado con las notificaciones existentes.');return;}
   if(a==='chat-smart-link'){await GalaxyNative.call('openExternal',btn.dataset.url||'');return;}
   if(a==='chat-smart-plan'){const m=chatMessageById(btn.dataset.id);if(m){closeModal();chatOpenItemDraft('plan',String(m.body||'Plan desde el chat').slice(0,160),m.body||'',{date:btn.dataset.date||''});}return;}
   if(a==='chat-smart-remind'){const m=chatMessageById(btn.dataset.id);if(m){closeModal();chatOpenItemDraft('event',String(m.body||'Recordatorio desde el chat').slice(0,160),m.body||'',{date:btn.dataset.date||cloud?.today||'',time:btn.dataset.time||''});toast('Confirma el evento para activar su recordatorio.');}return;}
   if(a==='chat-smart-place'){const m=chatMessageById(btn.dataset.id),lat=Number(m?.attachment?.latitude),lon=Number(m?.attachment?.longitude);if(!Number.isFinite(lat)||!Number.isFinite(lon))return;showModal('Guardar lugar','<form id="placeForm" class="stack"><div class="field"><label>Nombre</label><input class="input" name="name" required placeholder="Nombre del lugar"></div><div class="field"><label>Tipo</label><select name="kind"><option value="memory">Recuerdo</option><option value="home">Casa</option><option value="work">Trabajo</option><option value="adventure">Aventura</option></select></div><div class="field"><label>Nota</label><textarea name="note"></textarea></div><input type="hidden" name="latitude" value="'+attr(lat)+'"><input type="hidden" name="longitude" value="'+attr(lon)+'"><button class="btn" type="submit">Guardar lugar</button></form>','place');return;}
  if(a==='chat-media-view'){showModal('Foto','<img class="chat-photo-full" src="'+attr(btn.dataset.url)+'" alt="Foto compartida">','chat-photo-view');return;}
  if(a==='chat-file-open'){await GalaxyNative.call('openChatFile',btn.dataset.url||'',btn.dataset.name||'archivo',btn.dataset.mime||'application/octet-stream');return;}
  if(a==='chat-location-open'){go('map');await refreshMap({quiet:true,detail:false});setTimeout(()=>map?.setView([Number(btn.dataset.lat),Number(btn.dataset.lon)],16),120);return;}
  if(a==='chat-audio-toggle'){const card=btn.closest('.chat-audio-card'),audio=card?.querySelector('audio');if(!audio)return;if(audio.paused){document.querySelectorAll('.chat-audio-card audio').forEach(x=>{if(x!==audio)x.pause();});await audio.play();btn.innerHTML=ico('pause');}else{audio.pause();btn.innerHTML=ico('play');}refreshIcons();return;}
  if(a==='chat-audio-speed'){const card=btn.closest('.chat-audio-card'),audio=card?.querySelector('audio');if(!audio)return;const current=Number(btn.dataset.speed||1),next=current===1?1.5:current===1.5?2:1;audio.playbackRate=next;btn.dataset.speed=String(next);btn.textContent=next+'×';return;}
  if(a==='chat-hold-record'){return;}
  if(a==='chat-hold-stop'){await finishChatHoldRecording();return;}
  if(a==='chat-voice-start'){await GalaxyNative.call('startVoiceRecording');chatVoiceState={recording:true,paused:false,ready:false,durationMs:0};setChatPresence('RECORDING_AUDIO');updateChatVoiceUi();return;}
  if(a==='chat-voice-pause'){await GalaxyNative.call('pauseVoiceRecording');chatVoiceState.paused=true;updateChatVoiceUi();return;}
  if(a==='chat-voice-resume'){await GalaxyNative.call('resumeVoiceRecording');chatVoiceState.paused=false;updateChatVoiceUi();return;}
  if(a==='chat-voice-stop'){const info=await GalaxyNative.call('stopVoiceRecording');chatVoiceState={recording:false,paused:false,ready:true,durationMs:Number(info.durationMs||0)};setChatPresence('ONLINE');updateChatVoiceUi();return;}
  if(a==='chat-voice-preview'){await GalaxyNative.call('playVoiceRecording');return;}
  if(a==='chat-voice-discard'){await GalaxyNative.call('discardVoiceRecording');chatVoiceState={recording:false,paused:false,ready:false,durationMs:0};setChatPresence('ONLINE');updateChatVoiceUi();return;}
  if(a==='chat-voice-send'){const duration=chatVoiceState.durationMs,upload=await GalaxyNative.call('saveChatVoiceRecording');closeModal();setChatPresence('ONLINE');queueChatMessage({messageType:'audio',attachments:[normalizeChatUpload(upload,'audio',duration)]});chatVoiceState={recording:false,paused:false,ready:false,durationMs:0};return;}
  if(a==='notifications-open'){await openNotificationCenter();return;}
  if(a==='notifications-read-all'){await api('notifications-read');if(cloud?.notifications)cloud.notifications.unread=0;await openNotificationCenter();return;}
  if(a==='notification-open'){await api('notifications-read',{id:btn.dataset.id});if(cloud?.notifications)cloud.notifications.unread=Math.max(0,Number(cloud.notifications.unread||0)-1);const target=btn.dataset.target||'home',entity=btn.dataset.entityId||'';closeModal();await routeGalaxyAction(target,entity);return;}
  if(a==='galaxy-notifications-enable'){await GalaxyNative.call('requestGalaxyNotifications');native=nativeState();render();toast('Notificaciones activadas.');return;}
  if(a==='goals-open'){go('goals');await loadGoals(true);return;}
  if(a==='goals-filter'){goalsFilter=btn.dataset.value||'active';render();return;}
  if(a==='goal-new'){openGoalForm('goal');return;}
  if(a==='goal-savings-new'){openGoalForm('savings');return;}
  if(a==='goal-open'){openGoalDetail(btn.dataset.id);return;}
  if(a==='goal-edit'){const goal=goalById(btn.dataset.id);if(goal)openGoalForm(goal.kind,goal);return;}
  if(a==='goal-delete'){const goal=goalById(btn.dataset.id);if(goal&&confirm('¿Eliminar este objetivo? Sus planes, deseos, notas y recuerdos relacionados se conservarán.')){const result=await api('goals-engine',{operation:'delete',goalId:goal.id,expectedVersion:goal.version});goalsState=null;closeModal();await loadGoals(true);toast(result.ok?'Objetivo eliminado.':'No se pudo eliminar.');}return;}
  if(a==='goal-step-add'){openGoalStepAdd(btn.dataset.id);return;}
  if(a==='goal-step-toggle'){const goal=goalById(btn.dataset.goalId);if(goal){await api('goals-engine',{operation:'step-toggle',goalId:goal.id,expectedVersion:goal.version,stepId:btn.dataset.stepId,completed:btn.dataset.completed!=='true'});await refreshGoal(goal.id);}return;}
  if(a==='goal-step-up'){const goal=goalById(btn.dataset.goalId),index=Number(btn.dataset.index);if(goal&&index>0){const ids=(goal.steps||[]).map(step=>String(step.id));[ids[index],ids[index-1]]=[ids[index-1],ids[index]];await api('goals-engine',{operation:'step-reorder',goalId:goal.id,expectedVersion:goal.version,stepIds:ids});await refreshGoal(goal.id);}return;}
  if(a==='goal-step-down'){const goal=goalById(btn.dataset.goalId),index=Number(btn.dataset.index);if(goal&&index>=0&&index<(goal.steps||[]).length-1){const ids=(goal.steps||[]).map(step=>String(step.id));[ids[index],ids[index+1]]=[ids[index+1],ids[index]];await api('goals-engine',{operation:'step-reorder',goalId:goal.id,expectedVersion:goal.version,stepIds:ids});await refreshGoal(goal.id);}return;}
  if(a==='goal-contribution-add'){openGoalContribution(btn.dataset.id);return;}
  if(a==='goal-contribution-delete'){const goal=goalById(btn.dataset.goalId);if(goal&&confirm('¿Eliminar este aporte manual?')){await api('goals-engine',{operation:'contribution-delete',goalId:goal.id,expectedVersion:goal.version,contributionId:btn.dataset.contributionId});await refreshGoal(goal.id);}return;}
  if(a==='goal-link-add'){openGoalLink(btn.dataset.id);return;}
  if(a==='goal-link-delete'){const goal=goalById(btn.dataset.goalId);if(goal){await api('goals-engine',{operation:'link-delete',goalId:goal.id,expectedVersion:goal.version,linkId:btn.dataset.linkId});await refreshGoal(goal.id);}return;}
  if(a==='goal-convert-item'){openGoalConvert(cloud.items.find(item=>String(item.id)===String(btn.dataset.id)));return;}
  if(a==='universal-search-open'){openUniversalSearch();return;}
  if(a==='universal-search-result'){await openUniversalSearchResult(btn);return;}
  if(a==='monthly-summary-open'){await openMonthlySummary(btn.dataset.month||String(cloud.today||'').slice(0,7));return;}
  if(a==='monthly-summary-month'){if(!btn.disabled)await openMonthlySummary(btn.dataset.month);return;}
  if(a==='insights-week-open'){await openInsights('week',btn.dataset.key||cloud.today);return;}
  if(a==='insights-month-open'){await openInsights('month',btn.dataset.key||String(cloud.today||'').slice(0,7));return;}
  if(a==='insights-year-open'){await openInsights('year',btn.dataset.key||String(cloud.today||'').slice(0,4));return;}
  if(a==='insights-period'){if(!btn.disabled&&btn.dataset.key)await openInsights(btn.dataset.kind,btn.dataset.key);return;}
  if(a==='today-history-open'){await openTodayHistory();return;}
  if(a==='today-history-refresh'){await openTodayHistory(true);return;}
  if(a==='today-history-item'){await openTodayHistoryItem(btn);return;}
  if(a==='encounter-stats-open'){await openEncounterStats();return;}
  if(a==='encounter-stats-refresh'){await openEncounterStats(true);return;}
  if(a==='encounter-map'){closeModal();go('map');await refreshMap({detail:true});setTimeout(()=>document.querySelector('#encounter-history')?.scrollIntoView({behavior:'smooth',block:'center'}),120);return;}
  if(a==='couple-distance-map'){go('map');await refreshMap({quiet:true,detail:false});setTimeout(()=>{focusCoupleOnMap();document.querySelector('#coupleDistanceCard')?.scrollIntoView({behavior:'smooth',block:'center'});},120);return;}
  if(a==='couple-distance-focus'){focusCoupleOnMap();return;}
  if(a==='eta-focus'){focusEtaOnMap();return;}
  if(a==='frequent-place-save'){openFrequentPlaceSuggestion(frequentSuggestionFromButton(btn));return;}
  if(a==='frequent-place-focus'){if(map){map.setView([Number(btn.dataset.lat),Number(btn.dataset.lon)],16);document.querySelector('#map')?.scrollIntoView({behavior:'smooth',block:'center'});}return;}
  if(a==='frequent-place-dismiss'){const s=frequentSuggestionFromButton(btn);window.GalaxyFrequentPlaces?.dismiss(s,14);render();toast('Ocultaremos esta sugerencia durante dos semanas.');return;}
  if(a==='map'){go('map');return;}
  if(a==='moments'){go('moments');return;}
  if(a==='add-memory'){if(!mapData)await refreshMap({quiet:true,detail:false});openItemForm('memory');return;}
  if(a==='add-plan'){openItemForm('plan');return;}
  if(a==='item-new'){if(['memory','journey','event'].includes(btn.dataset.kind)&&!mapData)await refreshMap({quiet:true,detail:false});openItemForm(btn.dataset.kind);return;}
  if(a==='item-edit'){const item=cloud.items.find(i=>i.id===btn.dataset.id);if(item&&['memory','journey','event'].includes(item.kind)&&!mapData)await refreshMap({quiet:true,detail:false});if(item)openItemForm(item.kind,item);return;}
  if(a==='item-delete'){await deleteItem(btn.dataset.id);return;}
  if(a==='mood'){await busy(()=>saveDaily('mood',btn.dataset.value),'Estado guardado.');return;}
  if(a==='gesture'){await busy(()=>sendGesture(btn.dataset.gesture));return;}
  if(a==='bond-send-gesture'){await busy(()=>sendGesture(btn.dataset.gestureId));return;}
  if(a==='bond-gesture-manage'){openBondGestureManager();return;}
  if(a==='bond-gesture-new'){openBondGestureForm();return;}
  if(a==='bond-gesture-edit'){const gesture=cloud?.bond?.gestures?.custom?.find(g=>String(g.id)===String(btn.dataset.id));if(gesture)openBondGestureForm(gesture);return;}
  if(a==='bond-gesture-delete'){const gesture=cloud?.bond?.gestures?.custom?.find(g=>String(g.id)===String(btn.dataset.id));if(gesture&&confirm('¿Eliminar este gesto personalizado? El historial anterior se conservará.')){await api('bond-gesture-delete',{id:gesture.id,version:gesture.version});closeModal();await refreshState();toast('Gesto eliminado.');}return;}
  if(a==='new-game'){openGame();return;}
  if(a==='new-ritual'){openRitual();return;}
  if(a==='ritual-edit'){openRitual(cloud.bond.entries.find(x=>x.id===btn.dataset.id));return;}
  if(a==='new-sharednote'){openSharedNote();return;}
  if(a==='sharednote-edit'){openSharedNote(cloud.bond.entries.find(x=>x.id===btn.dataset.id));return;}
  if(a==='new-voice'){openVoice();return;}
  if(a==='voice-for-item'){openVoice(btn.dataset.id);return;}
  if(a==='anniversary-open'){await openInsights('anniversary','');return;}
  if(a==='constellation-item'){const i=cloud.items.find(x=>x.id===btn.dataset.id);if(i)showModal(i.data?.title||'Recuerdo','<div class="card" style="margin-top:16px"><span class="badge">'+esc(kindMeta[i.kind]?.[1]||'Historia')+'</span><p style="margin-top:10px">'+esc(i.data?.body||fmtDate(i.data?.date)||'Parte de nuestra historia.')+'</p>'+(linkedVoices(i.id).length?linkedVoices(i.id).map(voiceCard).join(''):'')+'</div>');return;}
  if(a==='voice-record-start'){voiceResumeMusic=musicPlaying;if(musicPlaying)toggleMusic();await GalaxyNative.call('startVoiceRecording');voiceRecording=true;voiceReady=false;startVoiceTimer();modal.querySelector('[data-role="voice-status"]').textContent='Grabando… 0 s / 60 s';btn.hidden=true;modal.querySelector('[data-action="voice-record-stop"]').hidden=false;return;}
  if(a==='voice-record-stop'){const info=await GalaxyNative.call('stopVoiceRecording');stopVoiceTimer();voiceRecording=false;voiceReady=true;modal.querySelector('[data-role="voice-status"]').textContent='Grabación lista · '+Math.max(1,Math.round((info.durationMs||0)/1000))+' s. Escúchala antes de guardar.';btn.hidden=true;modal.querySelector('[data-action="voice-record-start"]').hidden=false;modal.querySelector('[data-action="voice-preview"]').hidden=false;modal.querySelector('[data-action="voice-discard"]').hidden=false;if(voiceResumeMusic){toggleMusic();voiceResumeMusic=false;}return;}
  if(a==='voice-preview'){voiceResumeMusic=musicPlaying;if(musicPlaying)toggleMusic();await GalaxyNative.call('playVoiceRecording');return;}
  if(a==='voice-discard'){stopVoiceTimer();await GalaxyNative.call('discardVoiceRecording');voiceReady=false;voiceRecording=false;modal.querySelector('[data-role="voice-status"]').textContent='Audio descartado. Puedes grabarlo otra vez.';modal.querySelector('[data-action="voice-preview"]').hidden=true;btn.hidden=true;modal.querySelector('[data-action="voice-record-start"]').hidden=false;return;}
  if(a==='voice-file'){const form=modal.querySelector('#voiceForm'),fd=new FormData(form);pendingVoiceDraft={title:String(fd.get('title')||''),body:String(fd.get('body')||''),referenceId:String(fd.get('referenceId')||'')};if(!pendingVoiceDraft.title.trim()){toast('Ponle un título al mensaje.');return;}const upload=await GalaxyNative.call('pickMedia','voice');await api('bond-save',{type:'voice',data:{...pendingVoiceDraft,audioPath:upload.path,mime:upload.mime}});pendingVoiceDraft=null;closeModal();await refreshState();toast('Mensaje de voz guardado.');return;}
  if(a==='bond-delete'){await busy(()=>bondDelete(btn.dataset.id));return;}
  if(a==='game-guess'){await busy(async()=>{await api('bond-guess',{id:btn.dataset.id,guess:btn.dataset.guess});await refreshState();},'Respuesta enviada.');return;}
  if(a==='surprise'){await openSurprise2();return;}
  if(a==='surprise-note-new'){if(!mapData)await refreshMap({quiet:true,detail:false});openSurpriseNote();return;}
  if(a==='date-question-decks'){await openQuestionDecks();return;}
  if(a==='date-deck-question'){await openDeckQuestion(btn.dataset.deck);return;}
  if(a==='date-question-favorite'){const result=await api('date-engine',{operation:'favorite',favorite:!dateContext?.question?.favorite});if(dateContext)dateContext.question=result.question;render();toast(result.question?.favorite?'Pregunta guardada en favoritas.':'Pregunta quitada de favoritas.');return;}
  if(a==='date-question-memory'){const result=await api('date-engine',{operation:'favorite-memory',day:cloud.today});await refreshState({quiet:true});await loadDateContext(true);render();toast(result.existing?'Ese recuerdo ya estaba guardado.':'Pregunta y respuestas guardadas como un recuerdo.');return;}
  if(a==='plan-roulette-open'){await openPlanRoulette();return;}
  if(a==='date-planner-open'){await openDatePlanner();return;}
  if(a==='date-mode-open'){await loadDateContext();openDateMode();return;}
  if(a==='date-mode-with-question'){dateMode=dateMode||newDateModeSession();dateMode.question={id:btn.dataset.questionId,text:btn.dataset.questionText};if(btn.dataset.questionId&&!dateMode.questionIds.includes(btn.dataset.questionId))dateMode.questionIds.push(btn.dataset.questionId);openDateMode();return;}
  if(a==='date-mode-question'){const result=await api('date-engine',{operation:'question',seed:(cloud.today||'')+'|date-mode|'+(++dateQuestionNonce)});dateMode.question=result.question;if(result.question?.id&&!dateMode.questionIds.includes(result.question.id))dateMode.questionIds.push(result.question.id);openDateMode();return;}
  if(a==='date-mode-camera'){const photo=await GalaxyNative.call('capturePhoto');dateMode.photos.push(photo);if(photo.path&&!dateMode.photoPaths.includes(photo.path))dateMode.photoPaths.push(photo.path);media.photo=null;mediaLoadedAt.photo=0;openDateMode();toast('Foto añadida a esta cita y al álbum privado.');return;}
  if(a==='date-mode-music'){rebuildMusicQueue();if(!musicQueue.length){closeModal();memoryTab='music';go('memories');toast('Añade una canción y vuelve a Modo Cita.');return;}if(musicIndex<0)playMusicAt(0);else toggleMusic();dateMode.songId=musicQueue[musicIndex]?.id||'';openDateMode();return;}
  if(a==='date-mode-plan'){await loadDateContext();openDateModePlanPicker();return;}
  if(a==='date-mode-plan-select'){dateMode.planId=String(btn.dataset.planId||'');openDateMode();return;}
  if(a==='date-mode-location'){await openDateModeLocation();return;}
  if(a==='date-mode-location-select'){dateMode.locationEnabled=true;dateMode.placeId=btn.dataset.placeId?Number(btn.dataset.placeId):null;openDateMode();return;}
  if(a==='date-mode-location-off'){dateMode.locationEnabled=false;dateMode.placeId=null;openDateMode();return;}
  if(a==='date-mode-save'){const endedAt=new Date().toISOString(),session={...dateMode,endedAt,elapsedSeconds:dateModeElapsed(),photoPaths:dateMode.photoPaths||[],questionIds:dateMode.questionIds||[]};const result=await api('date-engine',{operation:'date-recap-save',session});dateMode=null;if(dateModeTimer){clearInterval(dateModeTimer);dateModeTimer=null;}closeModal();await refreshState();toast(result.existing?'Esta cita ya estaba guardada.':'Esta noche quedó guardada como recuerdo.');return;}
  if(a==='date-experience-save'&&dateLastExperience?.candidate){const x=dateLastExperience.candidate;await api('item-save',{kind:'plan',data:{title:x.title,body:x.body,category:'Galaxy Date',planCategory:x.planCategory||'when-possible',budget:Number(x.budget||0),minutes:Number(x.minutes||120),where:x.where||'salir',done:false,source:{type:'date-engine',candidateId:x.id}}});await refreshState({quiet:true});await loadDateContext(true);toast('Plan guardado.');return;}
  if(a==='date-planner-save'&&dateLastExperience?.planner){const p=dateLastExperience.planner;await api('item-save',{kind:'plan',data:{title:'Cita planificada · '+cloud.today,body:p.steps.map((x,n)=>(n+1)+'. '+x.title).join('\n'),category:'Galaxy Date',planCategory:'when-possible',budget:Number(p.totalBudget||0),minutes:Number(p.totalMinutes||0),where:p.constraints?.where==='casa'?'casa':'salir',done:false,source:{type:'date-engine-planner',stepIds:p.steps.map(x=>x.id)}}});await refreshState({quiet:true});await loadDateContext(true);toast('Cita planificada guardada.');return;}
  if(a==='date-mode-start-experience'&&dateLastExperience){const id=dateLastExperience.candidate?.source==='pending'?dateLastExperience.candidate.id:'';dateMode=newDateModeSession(id);openDateMode(id);return;}
  if(a==='date-mode-start-plan'){dateMode=newDateModeSession(btn.dataset.planId);openDateMode(btn.dataset.planId);return;}
  if(a==='album-add'){openAlbumAdd();return;}
  if(a==='photos-picker'){await importPhotosPicker();return;}
  if(a==='capsule-photo-file'){const upload=await GalaxyNative.call('pickMedia','photo'),form=modal.querySelector('#itemForm');if(form){form.querySelector('[name="capsulePhotoPath"]').value=upload.path||'';form.querySelector('[data-role="capsule-photo-state"]').textContent=upload.path?'Foto añadida':'Sin foto';}return;}
  if(a==='capsule-audio-file'){const upload=await GalaxyNative.call('pickMedia','voice'),form=modal.querySelector('#itemForm');if(form){form.querySelector('[name="capsuleAudioPath"]').value=upload.path||'';form.querySelector('[name="capsuleAudioMime"]').value=upload.mime||'audio/mp4';form.querySelector('[data-role="capsule-audio-state"]').textContent=upload.path?'Audio añadido':'Sin audio';}return;}
  if(a==='photo-file'){closeModal();await GalaxyNative.call('pickMedia','photo');await refreshPhotoAlbum();toast('Foto añadida desde el teléfono.');return;}
  if(a==='drive-folder-connect'){await connectDriveFolder();return;}
  if(a==='drive-sync'){await syncDriveAlbum();return;}
  if(a==='drive-folder-disconnect'){if(confirm('¿Desconectar esta carpeta de Google Drive? Las fotos ya importadas seguirán en el álbum.')){await GalaxyNative.call('disconnectDriveFolder');native=nativeState();render();toast('Carpeta de Drive desconectada.');}return;}
  if(a==='music-add'){openMusicAdd();return;}
  if(a==='music-upload'){closeModal();await GalaxyNative.call('pickMedia','music');media.music=null;mediaLoadedAt.music=0;await loadMedia('music',true);renderGlobalPlayer();toast('MP3 añadido a Nuestra música.');return;}
  if(a==='music-url'){openMusicUrl();return;}
  if(a==='music-play'){const n=Number(btn.dataset.index);if(n===musicIndex)toggleMusic();else playMusicAt(n);return;}
  if(a==='player-toggle'){toggleMusic();return;}
  if(a==='player-next'){playMusicAt(musicIndex+1);return;}
  if(a==='player-expand'){memoryTab='music';go('memories');return;}
  if(a==='media-add'){await GalaxyNative.call('pickMedia',btn.dataset.kind);media[btn.dataset.kind]=null;mediaLoadedAt[btn.dataset.kind]=0;await loadMedia(btn.dataset.kind,true);toast('Archivo añadido.');return;}
  if(a==='media-delete'){if(confirm('¿Eliminar este archivo?')){await api('media-delete',{kind:btn.dataset.kind,path:btn.dataset.path});media[btn.dataset.kind]=null;mediaLoadedAt[btn.dataset.kind]=0;await loadMedia(btn.dataset.kind,true);toast('Archivo eliminado.');}return;}
  if(a==='history-place'){if(map)map.setView([Number(btn.dataset.lat),Number(btn.dataset.lon)],16);document.querySelector('#map')?.scrollIntoView({behavior:'smooth',block:'center'});return;}
  if(a==='memory-at-place'){openItemForm('memory',{data:{placeId:Number(btn.dataset.id)}});return;}
  if(a==='our-ai'){if(!mapData)await refreshMap({quiet:true,detail:true});openOurAI();return;}
  if(a==='ai-question'){const q=btn.dataset.question||'';const input=modal.querySelector('#ourAiForm [name="question"]');if(input)input.value=q;await showAiAnswer(q);return;}
  if(a==='intelligence-search-result'){await openIntelligenceSearchResult(btn);return;}
  if(a==='intelligence-connections-open'){openIntelligenceConnectionsPicker();return;}
  if(a==='intelligence-connections-run'){await openIntelligenceConnections(btn.dataset.sourceType,btn.dataset.sourceId);return;}
  if(a==='intelligence-narrator-open'){openIntelligenceNarrator();return;}
  if(a==='intelligence-book-open'){await openIntelligenceBook();return;}
  if(a==='voice-transcribe'){if(!confirm('¿Transcribir este audio para poder buscar dentro de él? El audio original se conservará.'))return;toast('Transcribiendo audio…');await api('intelligence-transcribe',{bondId:btn.dataset.id});await refreshState({quiet:true});render();toast('Transcripción lista.');return;}
  if(a==='voice-transcript-delete'){if(!confirm('¿Eliminar solo la transcripción? El audio original se conservará.'))return;await api('intelligence-transcript-delete',{bondId:btn.dataset.id});await refreshState({quiet:true});render();toast('Transcripción eliminada. El audio sigue intacto.');return;}
  if(a==='backup-export'){const backup=await api('backup-export');await GalaxyNative.call('exportJson','nuestra-galaxia-backup-'+(cloud.today||'copia')+'.json',JSON.stringify(backup));toast('Copia guardada en el teléfono.');return;}
  if(a==='gps-history-export'){await exportGpsHistory();return;}
  if(a==='gps-history-delete-open'){openGpsHistoryDelete();return;}
  if(a==='gps-history-map'){closeModal();go('map');return;}
  if(a==='theme-set'){const state=window.GalaxyTheme?.applyTheme(btn.dataset.value);render();toast(state?.selected==='auto'?'Tema automático · ahora '+window.GalaxyTheme.LABELS[state.active]+'.':'Tema '+window.GalaxyTheme.LABELS[state?.active]+' activado.');return;}
  if(a==='backup-import'){if(!confirm('Restaurar una copia añadirá lo que falte sin borrar lo que ya existe. ¿Continuar?'))return;const file=await GalaxyNative.call('importJson'),backup=JSON.parse(file.json||'{}'),result=await api('backup-import',{backup});await refreshState({quiet:true});await refreshMap({quiet:true,detail:true});render();const r=result.restored||{};toast('Copia restaurada: '+Number(r.items||0)+' contenidos, '+Number(r.places||0)+' lugares y '+Number(r.bond||0)+' momentos.');return;}
  if(a==='context-near-toggle'){const s=contextSettings(),next=!s.near_enabled;const result=await api('context-settings',{operation:'save',nearEnabled:next});await GalaxyNative.call('setContextPushPrefs',!!result.settings.near_enabled,!!result.settings.arrived_safe_enabled);await refreshMap({detail:true});toast(next?'Avisos de cercanía activados.':'Avisos de cercanía apagados.');return;}
  if(a==='context-arrived-toggle'){const s=contextSettings(),next=!s.arrived_safe_enabled;const result=await api('context-settings',{operation:'save',arrivedSafeEnabled:next});await GalaxyNative.call('setContextPushPrefs',!!result.settings.near_enabled,!!result.settings.arrived_safe_enabled);await refreshMap({detail:true});toast(next?'Llegué bien automático activado.':'Llegué bien automático apagado.');return;}
  if(a==='context-settings-open'){openContextSettings();return;}
  if(a==='context-return-home'){if(!native.tracking){toast('Activa Compartir ubicación antes de iniciar Regreso a casa. La app no la activará automáticamente.');return;}await api('context-session',{operation:'start',mode:'return_home'});await refreshMap({detail:true});toast('Regreso a casa iniciado.');return;}
  if(a==='context-session-stop'){await api('context-session',{operation:'stop'});await refreshMap({detail:true});toast('Sesión terminada.');return;}
  if(a==='context-suggestion-dismiss'){await api('context-suggestion',{operation:'dismiss',id:btn.dataset.id});await refreshMap({detail:true});toast('Sugerencia descartada.');return;}
  if(a==='context-suggestion-accept'){const suggestion=(mapData?.context?.suggestions||[]).find(s=>String(s.id)===String(btn.dataset.id));const result=await api('context-suggestion',{operation:'accept',id:btn.dataset.id});if(suggestion?.kind==='date'){const recap=await api('context-recap',{kind:'date',sourceEventId:suggestion.source_event_id});showModal('Recap de cita',contextRecapMarkup('Recap de cita',recap.recap));setTimeout(()=>renderContextRecapMap(recap.recap),30);}else{await refreshState({quiet:true});toast(result.item?'Recuerdo guardado.':'Sugerencia aceptada.');}await refreshMap({quiet:true,detail:true});return;}
  if(a==='context-trip-recap'){const recap=await api('context-recap',{kind:'trip',tripId:Number(btn.dataset.id)});showModal('Recap de recorrido',contextRecapMarkup('Recap de recorrido',recap.recap));setTimeout(()=>renderContextRecapMap(recap.recap),30);return;}
  if(a==='map-refresh'){await refreshMapNow();return;}
  if(a==='status-menu'){$('#statusMenu')?.classList.toggle('open');return;}
  if(a==='status-set'){await api('status-set',{status:btn.dataset.status});$('#statusMenu')?.classList.remove('open');await refreshMap();toast('Estado actualizado.');return;}
  if(a==='status-custom'){const value=prompt('¿Qué estado quieres mostrar?','');if(value){await api('status-set',{status:value});await refreshMap();}return;}
  if(a==='location-start'){await GalaxyNative.call('startLocation');native=nativeState();try{await GalaxyNative.call('refreshLocation');}catch{}await refreshMap({quiet:true,detail:false});render();toast('Ubicación activa y GPS actualizado.');return;}
  if(a==='location-stop'){await GalaxyNative.call('stopLocation');native=nativeState();render();toast('Ubicación detenida.');return;}
  if(a==='trip-toggle'){const own=(cloud.locations||[]).find(l=>l.person===cloud.person)||{};await api('trip',{operation:own.trip_active?'stop':'start'});await refreshState();await refreshMap({detail:true});toast(own.trip_active?'Recorrido guardado.':'Recorrido iniciado.');return;}
  if(a==='place-new'){if(!mapData)await refreshMap({quiet:true,detail:true});openPlace();return;}
  if(a==='destination'){if(!mapData)await refreshMap({quiet:true,detail:true});openDestination();return;}
  if(a==='transport-set'){await api('transport-set',{preference:btn.dataset.value});await refreshState({quiet:true});await refreshMap({quiet:true});render();toast('Preferencia de transporte actualizada.');return;}
  if(a==='now-settings'){go('more');setTimeout(()=>document.querySelector('.privacy-grid')?.scrollIntoView({behavior:'smooth',block:'center'}),80);return;}
  if(a==='presence-battery'){await busy(()=>togglePresence('battery'),'Privacidad de batería actualizada.');return;}
  if(a==='presence-listening'){await busy(()=>togglePresence('listening'),'Privacidad de música actualizada.');return;}
  if(a==='pair-code-partner'){await openPairCode('1');return;}
  if(a==='pair-code-self'){await openPairCode(String(cloud.person));return;}
  if(a==='pair-code-copy'){await GalaxyNative.call('copyText','Código de Nuestra Galaxia',String(btn.dataset.code||''));toast('Código copiado.');return;}
  if(a==='profile-repair'){
    const partner=names()[1]||'Adri',mine=names()[0]||'Sebas';
    if(!confirm('Esto cambiará ESTE teléfono de '+mine+' a '+partner+'. Úsalo solo en el teléfono de '+partner+'. ¿Continuar?'))return;
    await api('profile-repair',{target_person:'1'});
    try{localStorage.removeItem(WELCOME_KEY);}catch{}
    native=nativeState();welcomePreview=false;welcomeStep=0;welcomeGift=true;welcomeEntering=false;tourStep=-1;
    await refreshState({quiet:true});render();toast('Perfil corregido: este teléfono ahora es '+partner+'.');return;
  }
  if(a==='device-revoke'){
    if(!confirm('¿Revocar este teléfono? Dejará de poder entrar hasta vincularlo otra vez.'))return;
    await api('device-revoke',{id:btn.dataset.id});await refreshState({quiet:true});render();toast('Teléfono revocado.');return;
  }
  if(a==='app-settings'){await GalaxyNative.call('openAppSettings');return;}
  if(a==='widget-add'){await GalaxyNative.call('addWidget');toast('Android abrió la solicitud del widget.');return;}
  if(a==='widget-photo'){await chooseWidgetPhoto();return;}
  if(a==='widget-photo-select'){await api('bond-widget',{photoPath:btn.dataset.path});closeModal();await GalaxyNative.call('refreshMoments');await refreshState();toast('Foto del widget actualizada.');return;}
  if(a==='widget-photo-clear'){await api('bond-widget',{photoPath:''});await GalaxyNative.call('refreshMoments');await refreshState();toast('Foto del widget retirada.');return;}
  if(a==='moment-notifications'){await GalaxyNative.call('setMomentNotifications',!native.momentNotifications);native=nativeState();render();toast(native.momentNotifications?'Notificaciones activadas. Usa “Probar ahora” para verificar Android.':'Notificaciones pausadas.');return;}
  if(a==='bond-haptics'){await GalaxyNative.call('setBondHaptics',!native.bondHaptics);native=nativeState();render();toast(native.bondHaptics?'Toques hápticos activados.':'Toques hápticos apagados.');return;}
  if(a==='moment-notification-test'){await GalaxyNative.call('testMomentNotification');native=nativeState();toast('Notificación de prueba enviada. Revisa la bandeja de Android.');return;}
  if(a==='update-check'){await GalaxyNative.call('checkUpdate');return;}
  if(a==='unpair'){if(confirm('¿Desvincular este teléfono de Nuestra Galaxia?')){await GalaxyNative.call('unpair');native=nativeState();cloud=null;render();}return;}
 }catch(err){toast(err.message||'No pudimos completar la acción.');}
});

document.addEventListener('input',e=>{
 if(e.target.id==='universalSearchInput')renderUniversalSearchResults(e.target.value);
 if(e.target.matches('#chatForm textarea')){
   writeChatDraft(e.target.value);
   e.target.style.height='auto';e.target.style.height=Math.min(120,e.target.scrollHeight)+'px';
   chatComposerRightMode(e.target);
   chatTyping();
 }
});

document.addEventListener('change',e=>{
 if(e.target.matches('[data-role="chat-ttl"]')){const box=modal.querySelector('[data-role="chat-ttl-custom"]');if(box)box.hidden=e.target.value!=='custom';}
 if(e.target.matches('#chatPreferencesForm [name="defaultTtlSeconds"]')){const box=modal.querySelector('[data-role="chat-default-ttl-custom"]');if(box)box.hidden=e.target.value!=='custom';}
 if(e.target.matches('[data-role="surprise-unlock"]')){const dateBox=modal.querySelector('[data-role="surprise-date"]'),placeBox=modal.querySelector('[data-role="surprise-place"]');if(dateBox)dateBox.hidden=e.target.value!=='date';if(placeBox)placeBox.hidden=e.target.value!=='place';}
 if(e.target.matches('[data-role="game-question"]')){
   const q=gameQuestions[e.target.value],answer=modal.querySelector('[data-role="game-answer"]');
   answer.innerHTML=q.options.map(o=>'<option>'+esc(o)+'</option>').join('');
 }
});

document.addEventListener('submit',async e=>{
 e.preventDefault();
 try{
  if(e.target.id==='chatForm'){queueCurrentChat({ttlSeconds:chatPreferencesState?.default_ttl_seconds||null});return;}
  if(e.target.id==='chatPremiumSendForm'){const fd=new FormData(e.target),when=new Date(String(fd.get('scheduledAt')||''));if(!Number.isFinite(when.getTime())||when.getTime()<=Date.now()+15000)throw new Error('Elige una fecha futura.');const rawTtl=String(fd.get('ttlSeconds')||''),ttl=rawTtl==='custom'?Math.max(1,Math.min(8760,Number(fd.get('ttlCustomHours')||1)))*3600:(Number(rawTtl||0)||chatPreferencesState?.default_ttl_seconds||null);const viewOnce=fd.get('viewOnce')==='on',effect=String(fd.get('effect')||'')||null,quality=String(fd.get('mediaQuality')||'optimized');chatAttachmentsDraft.forEach(x=>{if(x.kind==='photo'||x.kind==='video')x.mediaQuality=quality;});closeModal();queueCurrentChat({scheduledAt:when.toISOString(),ttlSeconds:ttl,viewOnce,effect});return;}
   if(e.target.id==='chatPollForm'){const fd=new FormData(e.target),options=String(fd.get('options')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,10);if(options.length<2)throw new Error('Escribe al menos dos opciones.');const raw=String(fd.get('closesAt')||''),closesAt=raw?new Date(raw).toISOString():null;await api('chat-poll',{operation:'create',pollId:crypto.randomUUID(),clientId:crypto.randomUUID(),question:String(fd.get('question')||''),options,allowMultiple:fd.get('allowMultiple')==='on',closesAt});closeModal();await loadChat({quiet:true,force:true});return;}
   if(e.target.id==='chatChecklistForm'){const fd=new FormData(e.target),items=String(fd.get('items')||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,50);if(!items.length)throw new Error('Escribe al menos un elemento.');await api('chat-checklist',{operation:'create',checklistId:crypto.randomUUID(),clientId:crypto.randomUUID(),title:String(fd.get('title')||''),items});closeModal();await loadChat({quiet:true,force:true});return;}
   if(e.target.id==='chatDailyAnswerForm'){const answer=String(new FormData(e.target).get('answer')||'').trim();await saveDaily('answer',answer);closeModal();await loadChat({quiet:true,force:true});toast('Respuesta guardada en Pregunta del día.');return;}
  if(e.target.id==='chatPreferencesForm'){const fd=new FormData(e.target),raw=String(fd.get('defaultTtlSeconds')||''),defaultTtl=raw==='custom'?Math.max(1,Math.min(8760,Number(fd.get('defaultTtlHours')||1)))*3600:(Number(raw||0)||null),result=await api('chat-preferences',{operation:'save',partnerNickname:String(fd.get('partnerNickname')||''),theme:String(fd.get('theme')||'galaxy'),notificationPrivacy:String(fd.get('notificationPrivacy')||'full'),showRead:fd.get('showRead')==='on',showLastSeen:fd.get('showLastSeen')==='on',showTyping:fd.get('showTyping')==='on',defaultTtlSeconds:defaultTtl});chatPreferencesState=result.preferences||null;closeModal();render();toast('Ajustes del chat guardados.');return;}
  if(e.target.id==='chatScheduleEditForm'){const fd=new FormData(e.target),when=new Date(String(fd.get('scheduledAt')||''));await api('chat-schedule-update',{id:String(fd.get('id')||''),scheduledAt:when.toISOString(),silent:fd.get('silent')==='on'});closeModal();await loadChat({quiet:true,force:true});return;}
  if(e.target.id==='chatEditForm'){const fd=new FormData(e.target);await api('chat-edit',{id:String(fd.get('id')||''),body:String(fd.get('body')||'')});closeModal();await loadChat({quiet:true,force:true});return;}
  if(e.target.id==='chatSearchForm'){await runChatSearch(e.target);return;}
  if(e.target.id==='chatSharedSearchForm'){const fd=new FormData(e.target);await openChatShared(String(fd.get('category')||'media'),String(fd.get('query')||''));return;}
  if(e.target.id==='chatAlbumCreateForm'){const fd=new FormData(e.target);await api('chat-albums',{operation:'create',name:String(fd.get('name')||''),albumDate:String(fd.get('albumDate')||'')});await openChatAlbums();return;}
  if(e.target.id==='chatGifSearchForm'){await runChatGifSearch(e.target);return;}
  if(e.target.id==='ourAiForm'){const q=String(new FormData(e.target).get('question')||'');await showAiAnswer(q);return;}
  if(e.target.id==='intelligenceNarratorForm'){const ids=new FormData(e.target).getAll('sourceId').map(String);if(ids.length<5||ids.length>10)throw new Error('Selecciona entre 5 y 10 recuerdos.');const box=modal.querySelector('[data-role="narrative-result"]');if(box)box.innerHTML='<div class="monthly-loading">'+loading('Escribiendo solo con fuentes reales')+'<p>Validaremos cada párrafo antes de mostrarlo…</p></div>';const result=await api('intelligence-narrate',{sourceIds:ids});if(box)box.innerHTML=narrativeMarkup(result);refreshIcons();return;}
  if(e.target.id==='gpsHistoryDeleteForm'){const value=new FormData(e.target).get('confirmation');if(!window.GalaxyGpsHistory?.validDeleteConfirmation(value))throw new Error('Escribe BORRAR exactamente para confirmar.');const submit=e.target.querySelector('button[type="submit"]');if(submit)submit.disabled=true;await deleteGpsHistory();return;}
  if(e.target.id==='pairForm'){
   const code=new FormData(e.target).get('code');await GalaxyNative.call('pair',String(code));native=nativeState();await refreshState();toast('Teléfono vinculado como '+myName()+'.');return;
  }
  if(e.target.id==='musicUrlForm'){const fd=new FormData(e.target),url=String(fd.get('url')||'').trim(),title=String(fd.get('title')||'').trim(),platform=detectMusicPlatform(url);if(!/^https:\/\//i.test(url))throw new Error('Usa un enlace https válido.');await api('item-save',{kind:'song',data:{title,url,platform}});closeModal();await refreshState();rebuildMusicQueue();renderGlobalPlayer();toast('Canción añadida a Nuestra música.');return;}
  if(e.target.id==='dateSuggestionForm'){const fd=new FormData(e.target),constraints={minutes:Number(fd.get('minutes')),budget:Number(fd.get('budget')),where:String(fd.get('where')),maxDistanceM:fd.get('maxDistanceM')?Number(fd.get('maxDistanceM')):null};const result=await api('date-engine',{operation:'surprise',constraints,seed:cloud.today+'|surprise|'+(++dateQuestionNonce)});showModal('Cita sorpresa 2.0',dateCandidateMarkup(result.experience));return;}
  if(e.target.id==='dateRouletteForm'){const fd=new FormData(e.target),result=await api('date-engine',{operation:'roulette',category:String(fd.get('category')||''),seed:cloud.today+'|roulette|'+(++dateQuestionNonce)});showModal('Ruleta de planes',rouletteResult(result.plan));return;}
  if(e.target.id==='datePlannerForm'){const fd=new FormData(e.target),constraints={minutes:Number(fd.get('minutes')),budget:Number(fd.get('budget')),where:String(fd.get('where')),maxDistanceM:fd.get('maxDistanceM')?Number(fd.get('maxDistanceM')):null};const result=await api('date-engine',{operation:'planner',constraints,seed:cloud.today+'|planner|'+(++dateQuestionNonce)});showModal('Nuestra cita',plannerMarkup(result.experience));return;}
  if(e.target.id==='goalForm'){const fd=new FormData(e.target),id=modal.dataset.goalId,version=Number(modal.dataset.goalVersion||0),participants=[fd.get('participant0')==='on'?'0':'',fd.get('participant1')==='on'?'1':''].filter(Boolean),goal={kind:String(fd.get('kind')||'goal'),title:String(fd.get('title')||''),description:String(fd.get('description')||''),category:String(fd.get('category')||'other'),targetDate:String(fd.get('targetDate')||''),status:String(fd.get('status')||'active'),participants,...(String(fd.get('kind'))==='savings'?{targetAmount:Number(fd.get('targetAmount'))}:{})};const result=await api('goals-engine',{operation:id?'update':'create',...(id?{goalId:id,expectedVersion:version}:{}),goal});closeModal();await loadGoals(true);if(result.goal){render();openGoalDetail(result.goal.id);}toast(id?'Objetivo actualizado.':'Objetivo creado.');return;}
  if(e.target.id==='goalStepForm'){const fd=new FormData(e.target),goal=goalById(fd.get('goalId'));if(!goal)throw new Error('Objetivo no encontrado.');await api('goals-engine',{operation:'step-add',goalId:goal.id,expectedVersion:goal.version,title:String(fd.get('title')||'')});await refreshGoal(goal.id);return;}
  if(e.target.id==='goalContributionForm'){const fd=new FormData(e.target),goal=goalById(fd.get('goalId'));if(!goal)throw new Error('Objetivo no encontrado.');await api('goals-engine',{operation:'contribution-add',goalId:goal.id,expectedVersion:goal.version,contribution:{amount:Number(fd.get('amount')),date:String(fd.get('date')||''),note:String(fd.get('note')||'')}});await refreshGoal(goal.id);return;}
  if(e.target.id==='goalLinkForm'){const fd=new FormData(e.target),goal=goalById(fd.get('goalId')),item=cloud.items.find(x=>String(x.id)===String(fd.get('itemId')));if(!goal||!item)throw new Error('Contenido no disponible.');await api('goals-engine',{operation:'link-add',goalId:goal.id,expectedVersion:goal.version,itemId:item.id,relation:item.kind});await refreshGoal(goal.id);return;}
  if(e.target.id==='goalConvertForm'){const fd=new FormData(e.target),participants=[fd.get('participant0')==='on'?'0':'',fd.get('participant1')==='on'?'1':''].filter(Boolean),result=await api('goals-engine',{operation:'convert-item',itemId:String(fd.get('itemId')||''),keepOriginal:fd.get('keepOriginal')==='on',participants});closeModal();await refreshState({quiet:true});await loadGoals(true);view='goals';render();if(result.goal)openGoalDetail(result.goal.id);toast('Objetivo creado desde el contenido original.');return;}
  if(e.target.id==='dailyForm'){await saveDaily('answer',new FormData(e.target).get('answer'));toast('Respuesta guardada.');return;}
  if(e.target.id==='itemForm'){await submitItem(e.target);return;}
  if(e.target.id==='bondGestureForm'){const fd=new FormData(e.target),id=String(fd.get('id')||''),version=Number(fd.get('version')||0),gesture={name:String(fd.get('name')||''),icon:String(fd.get('icon')||''),text:String(fd.get('text')||''),behavior:String(fd.get('behavior')||'message')};await api('bond-gesture-save',{...(id?{id,version}:{}),gesture});closeModal();await refreshState();toast(id?'Gesto actualizado.':'Gesto creado.');return;}
  if(e.target.id==='gameForm'){const fd=new FormData(e.target);await api('bond-save',{type:'game',data:{questionId:fd.get('questionId'),answer:fd.get('answer')}});closeModal();await refreshState();toast('Pregunta guardada.');return;}
  if(e.target.id==='ritualForm'){const fd=new FormData(e.target),data={week:fd.get('week'),gratitude:fd.get('gratitude'),need:fd.get('need'),plan:fd.get('plan')},id=modal.dataset.editId,version=Number(modal.dataset.version||0);if(id)await api('bond-update',{id,version,data});else await api('bond-save',{type:'ritual',data});closeModal();await refreshState();toast('Ritual guardado.');return;}
  if(e.target.id==='sharedNoteForm'){const fd=new FormData(e.target),data={title:fd.get('title'),body:fd.get('body')},id=modal.dataset.editId,version=Number(modal.dataset.version||0);if(id)await api('bond-update',{id,version,data});else await api('bond-save',{type:'sharednote',data});closeModal();await refreshState();toast('Nota compartida guardada.');return;}
  if(e.target.id==='surpriseNoteForm'){const fd=new FormData(e.target),unlockType=String(fd.get('unlockType')||'date');let lat=null,lon=null,placeId=null,placeName='';if(unlockType==='place'){const choice=String(fd.get('placeChoice')||'');if(choice==='current'){const own=(cloud.locations||[]).find(l=>l.person===cloud.person&&l.sharing);if(!own)throw new Error('Activa tu ubicación o elige un lugar guardado.');lat=Number(own.latitude);lon=Number(own.longitude);placeName='Lugar actual';}else if(choice.startsWith('saved:')){const p=(mapData?.places||[]).find(x=>String(x.id)===choice.slice(6));if(!p)throw new Error('El lugar guardado ya no está disponible.');lat=Number(p.latitude);lon=Number(p.longitude);placeId=p.id;placeName=p.name;}else throw new Error('Elige dónde se desbloqueará la sorpresa.');}const data={title:String(fd.get('title')||''),body:String(fd.get('body')||''),category:'Sorpresa',surprise:true,unlockType,unlockDate:unlockType==='date'?String(fd.get('unlockDate')||''):'',latitude:lat,longitude:lon,radius:150,...(placeId?{placeId,placeName}:{} )};await api('item-save',{kind:'note',data});closeModal();await refreshState();toast('Sorpresa guardada.');return;}
  if(e.target.id==='voiceForm'){
   const fd=new FormData(e.target);pendingVoiceDraft={title:String(fd.get('title')||''),body:String(fd.get('body')||''),referenceId:String(fd.get('referenceId')||'')};
   if(voiceRecording)throw new Error('Detén la grabación antes de guardarla.');
   if(!voiceReady)throw new Error('Graba tu voz o usa “Elegir audio del teléfono”.');
   const upload=await GalaxyNative.call('saveVoiceRecording');
   await api('bond-save',{type:'voice',data:{...pendingVoiceDraft,audioPath:upload.path,mime:upload.mime}});
   pendingVoiceDraft=null;voiceReady=false;closeModal();await refreshState();toast('Mensaje de voz guardado.');return;
  }
  if(e.target.id==='contextSettingsForm'){const fd=new FormData(e.target),payload={operation:'save',nearEnabled:fd.get('nearEnabled')==='on',nearDistanceM:Number(fd.get('nearDistanceM')),nearCooldownMinutes:Number(fd.get('nearCooldownMinutes')),arrivedSafeEnabled:fd.get('arrivedSafeEnabled')==='on',dateSuggestions:fd.get('dateSuggestions')==='on',memorySuggestions:fd.get('memorySuggestions')==='on',sharedTripDetection:fd.get('sharedTripDetection')==='on'};const result=await api('context-settings',payload);await GalaxyNative.call('setContextPushPrefs',!!result.settings.near_enabled,!!result.settings.arrived_safe_enabled);closeModal();await refreshMap({detail:true});toast('Preferencias de contexto guardadas.');return;}
  if(e.target.id==='placeForm'){const fd=new FormData(e.target);await api('place-save',{name:fd.get('name'),kind:fd.get('kind'),note:fd.get('note'),latitude:Number(fd.get('latitude')),longitude:Number(fd.get('longitude'))});closeModal();frequentPlacesLoadedAt=0;await refreshMap();await loadFrequentPlaces(true).catch(()=>{});toast('Lugar guardado.');return;}
  if(e.target.id==='destinationForm'){const value=String(new FormData(e.target).get('destination'));if(value==='none')await api('context-session',{operation:'stop'});else{if(!native.tracking)throw new Error('Activa Compartir ubicación primero. Acompáñame no la activa automáticamente.');const [kind,id]=value.split(':');await api('context-session',{operation:'start',mode:'accompany',destinationKind:kind,...(kind==='person'?{targetPerson:id,label:partnerName()}:{placeId:Number(id)})});}closeModal();await refreshMap({detail:true});if(view==='map')setTimeout(()=>document.querySelector('#etaCard')?.scrollIntoView({behavior:'smooth',block:'center'}),80);toast(value==='none'?'Sesión desactivada.':'Acompáñame 2.0 iniciado.');return;}
  if(e.target.id==='settingsForm'){const fd=new FormData(e.target);await api('settings-save',{version:cloud.settings.version,data:{names:[fd.get('name0'),fd.get('name1')],startDate:fd.get('startDate'),albumUrl:fd.get('albumUrl')}});await refreshState();toast('Ajustes guardados.');return;}
 }catch(err){toast(err.message||'No pudimos guardar.');}
});

modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
function editingNow(){
 const el=document.activeElement,playing=[...document.querySelectorAll('audio')].some(audio=>!audio.paused),draft=String(document.querySelector('#chatForm textarea')?.value||'').trim();
 return modal.open||playing||draft.length>0||!!(el&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
}
setInterval(()=>{
 if(!native.paired||document.visibilityState!=='visible')return;
 refreshStateIfChanged().catch(()=>{});
},45000);
setInterval(()=>{
 if(native.paired&&view==='map'&&document.visibilityState==='visible')refreshMap({quiet:true,detail:false}).catch(()=>{});
},12000);
setInterval(()=>{
 if(native.paired&&view==='chat'&&document.visibilityState==='visible'&&!editingNow())loadChat({quiet:true}).catch(()=>{});
},25000);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&native.paired){
   refreshStateIfChanged().catch(()=>{});
   if(view==='map')refreshMap({quiet:true,detail:false}).catch(()=>{});
   if(view==='chat'){setChatPresence('ONLINE');loadChat({quiet:true,force:true}).catch(()=>{});flushChatOutbox({retryFailed:true}).catch(()=>{});}
   if(native.momentNotifications)GalaxyNative.call('refreshMoments').catch(()=>{});
 }
});

window.visualViewport?.addEventListener('resize',syncChatViewportHeight);
window.visualViewport?.addEventListener('scroll',syncChatViewportHeight);
window.addEventListener('resize',syncChatViewportHeight);
window.addEventListener('online',()=>{if(native.paired){flushChatOutbox({retryFailed:true}).then(()=>view==='chat'&&loadChat({quiet:true,force:true})).catch(()=>{});}});
window.addEventListener('offline',()=>{if(view==='chat')toast('Sin conexión. Tus mensajes quedarán pendientes.');});
document.addEventListener('scroll',e=>{
 if(e.target?.id==='chatMessages'&&chatNearBottom(e.target)){chatNewCount=0;document.querySelector('.chat-new-button')?.remove();markChatReadIfVisible().catch(()=>{});}
},true);
let chatPress=null,chatSwipe=null,chatSendHold=null,chatSendSuppress=false;
document.addEventListener('pointerdown',e=>{
 const send=e.target.closest?.('.chat-send[type="submit"]');
 if(send){chatSendHold={button:send,timer:setTimeout(()=>{chatSendSuppress=true;openChatSendMenu();chatSendHold=null;},520)};return;}
 const hold=e.target.closest?.('[data-action="chat-hold-record"]');
 if(hold){e.preventDefault();beginChatHoldRecording(e,hold);return;}
 const row=e.target.closest?.('.chat-message[data-id]');if(!row||!row.dataset.id)return;
 chatPress={id:row.dataset.id,x:e.clientX,y:e.clientY,timer:setTimeout(()=>{openChatMessageMenu(row.dataset.id);chatPress=null;},520)};
});
document.addEventListener('pointermove',e=>{
 if(chatHoldRecord&&e.pointerId===chatHoldRecord.pointerId&&!chatHoldRecord.locked){
  const dx=e.clientX-chatHoldRecord.startX,dy=e.clientY-chatHoldRecord.startY;
  const button=document.querySelector('[data-action="chat-hold-record"]');
  if(dx<-75){chatHoldRecord.cancel=true;button?.classList.add('canceling');chatHoldHint('Suelta para cancelar','cancel');}
  else{chatHoldRecord.cancel=false;button?.classList.remove('canceling');if(dy<-70){chatHoldRecord.locked=true;button?.classList.add('locked');if(button){button.dataset.action='chat-hold-stop';button.innerHTML=ico('square');button.setAttribute('aria-label','Detener grabación');try{button.releasePointerCapture(e.pointerId);}catch{}}chatHoldHint('Grabación bloqueada · toca detener','locked');refreshIcons();}else chatHoldHint('Suelta para enviar · ← cancelar · ↑ bloquear','recording');}
  return;
 }
 if(chatPress&&Math.hypot(e.clientX-chatPress.x,e.clientY-chatPress.y)>12){clearTimeout(chatPress.timer);chatPress=null;}
});
document.addEventListener('pointerup',e=>{
 if(chatSendHold){clearTimeout(chatSendHold.timer);chatSendHold=null;}
 if(chatHoldRecord&&e.pointerId===chatHoldRecord.pointerId&&!chatHoldRecord.locked){finishChatHoldRecording({cancel:chatHoldRecord.cancel});return;}
 if(chatPress){clearTimeout(chatPress.timer);chatPress=null;}
});
document.addEventListener('pointercancel',e=>{
 if(chatSendHold){clearTimeout(chatSendHold.timer);chatSendHold=null;}
 if(chatHoldRecord&&e.pointerId===chatHoldRecord.pointerId&&!chatHoldRecord.locked){finishChatHoldRecording({cancel:true});return;}
 if(chatPress){clearTimeout(chatPress.timer);chatPress=null;}
});
document.addEventListener('click',e=>{if(chatSendSuppress&&e.target.closest?.('.chat-send[type="submit"]')){e.preventDefault();e.stopImmediatePropagation();chatSendSuppress=false;}},true);
document.addEventListener('touchstart',e=>{const row=e.target.closest?.('.chat-message[data-id]'),t=e.touches?.[0];if(row&&row.dataset.id&&t)chatSwipe={id:row.dataset.id,x:t.clientX,y:t.clientY};},{passive:true});
document.addEventListener('touchend',e=>{if(!chatSwipe)return;const t=e.changedTouches?.[0],swipe=chatSwipe;chatSwipe=null;if(!t)return;const dx=t.clientX-swipe.x,dy=Math.abs(t.clientY-swipe.y);if(dx>58&&dy<45){const m=(chatState?.messages||[]).find(x=>String(x.id)===String(swipe.id));if(m){chatReply=m;render();requestAnimationFrame(()=>document.querySelector('#chatForm textarea')?.focus());}}},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){chatUnlockedSession=false;if(view==='chat')setChatPresence('OFFLINE');}});

render();
if(native.paired)refreshState().then(()=>{syncPresence();flushChatOutbox({retryFailed:true}).catch(()=>{});}).catch(()=>{});
setInterval(()=>{if(native.paired&&cloud&&document.visibilityState==='visible')syncPresence().catch(()=>{});},300000);
setInterval(()=>{if(native.paired&&native.momentNotifications&&document.visibilityState==='visible')GalaxyNative.call('refreshMoments').catch(()=>{});},120000);
