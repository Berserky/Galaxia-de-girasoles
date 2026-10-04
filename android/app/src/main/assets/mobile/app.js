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
     try{GalaxyAndroid[method](id,...args);}
     catch(e){this.pending.delete(id);reject(e);}
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
   if(name==='voice'&&data.ready&&modal.open){stopVoiceTimer();voiceRecording=false;voiceReady=true;const status=modal.querySelector('[data-role="voice-status"]');if(status)status.textContent='Grabación lista. Escúchala antes de guardar.';modal.querySelector('[data-action="voice-record-stop"]')?.setAttribute('hidden','');modal.querySelector('[data-action="voice-preview"]')?.removeAttribute('hidden');modal.querySelector('[data-action="voice-discard"]')?.removeAttribute('hidden');modal.querySelector('[data-action="voice-record-start"]')?.removeAttribute('hidden');if(voiceResumeMusic){toggleMusic();voiceResumeMusic=false;}}
   if(name==='voice-preview-ended'&&voiceResumeMusic){toggleMusic();voiceResumeMusic=false;}
 },
 back(){
   if(modal.open){closeModal();return;}
   if(view!=='home'){go('home');return;}
   try{GalaxyAndroid.closeApp();}catch{}
 }
};

function nativeState(){
 try{return JSON.parse(GalaxyAndroid.nativeState()||'{}');}catch{return {paired:false};}
}
native=nativeState();

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
 return '<header class="header"><div class="brand"><div class="brand-mark">'+ico('sparkles')+'</div><div><strong>Nuestra Galaxia</strong><small>'+esc(native.paired?(myName()+' & '+partnerName()):'Un espacio para dos')+'</small></div></div><div class="header-actions"><button class="header-search" data-action="universal-search-open" aria-label="Buscar en nuestra galaxia">'+ico('search')+'</button><div class="avatar">'+esc((native.paired?myName():'N').slice(0,1).toUpperCase())+'</div></div></header>';
}
function renderNav(){
 navEl.style.display=native.paired&&!shouldShowAdriWelcome()?'grid':'none';
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
function go(next){
 const hadMap=!!mapData;
 view=next;render();window.scrollTo(0,0);
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
 renderNav();
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
 if(view==='more')app.innerHTML=header()+moreView();
 refreshIcons();
 renderGlobalPlayer();
 if(view==='home'&&!encounterStatsCache&&!encounterStatsLoading)setTimeout(()=>loadEncounterStats().catch(()=>{}),0);
 if(tourStep>=0)setTimeout(renderTourOverlay,30);
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
 return '<section class="section"><div class="card eta-card '+(e.arrived?'arrived':'')+'" id="etaCard"><span class="eta-icon">'+ico(e.arrived?'map-pin-check':modeIcon)+'</span><div class="eta-main"><p class="eyebrow">ETA HACIA '+esc(String(e.label||'DESTINO').toUpperCase())+'</p><div class="eta-value"><strong>'+esc(eta)+'</strong><span>'+esc(distance)+'</span></div><p>'+esc(e.arrived?'Ya estás en el destino.':'Llegarías aproximadamente '+e.mode_label+', '+source+'.')+'</p><small>ETA = tiempo estimado de llegada. Se calcula con distancia geográfica, tu modo de movimiento y velocidad'+esc(targetNote)+'. No reemplaza navegación vial.</small></div><div class="eta-actions"><button class="btn small secondary" data-action="eta-focus">'+ico('crosshair')+' Ver ambos</button><button class="btn small ghost" data-action="destination">'+ico('shuffle')+' Cambiar destino</button></div></div></section>';
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
 return '<section class="section"><div class="card date-question-card"><div class="row between"><div><p class="eyebrow">PREGUNTA DEL DÍA 2.0</p><small class="muted">'+esc(deckLabels[q.deck]||'Una pregunta para hoy')+'</small></div><button class="icon-btn '+(q.favorite?'active':'')+'" data-action="date-question-favorite" aria-label="'+(q.favorite?'Quitar de favoritas':'Marcar como favorita')+'">'+ico('star')+'</button></div><h3>'+esc(dailyQuestion())+'</h3>'+dailyAnswerMarkup(own,partner)+'<div class="row wrap date-question-actions"><button class="btn small secondary" data-action="date-question-decks">'+ico('layers-3')+' Barajas</button><button class="btn small ghost" data-action="date-question-memory" '+(both?'':'disabled')+'>'+ico('bookmark-plus')+' '+(q.memoryId?'Ver recuerdo':'Guardar como recuerdo')+'</button></div>'+(both?'':'<p class="muted date-question-privacy">'+ico('lock')+' Las dos respuestas se unen a un recuerdo solo cuando ambos hayan contestado.</p>')+'</div></section>';
}

function personCard(l){
 const name=names()[Number(l.person)]||'Nosotros',sharing=!!l.sharing,fresh=locationFreshState(l),motion=transportLabel(l),kmh=Math.max(0,Number(l.speed||0)*3.6);
 const state=!sharing?'Ubicación pausada':fresh?(esc(motion)+(l.status?' · '+esc(l.status):'')):'Sin actualizar · hace '+ageDurationLabel(locationAgeMs(l));
 return '<div class="card person-card '+(sharing&&!fresh?'stale':'')+'"><div class="bubble">'+esc(name.slice(0,1))+'</div><div><b><span class="status-dot '+(fresh?'live':sharing?'stale':'')+'"></span>'+esc(name)+'</b><p>'+state+'</p></div><div class="speed">'+(fresh?kmh.toFixed(kmh<10?1:0):'—')+'<small>km/h</small></div></div>';
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
 showModal(goal.title,'<div class="goal-detail"><div class="row between"><span class="badge">'+esc(goal.kind==='savings'?'Ahorro manual':goalCategoryLabel(goal.category))+'</span><span>'+esc(goalStatusLabel(goal.status))+'</span></div>'+(goal.description?'<p>'+esc(goal.description)+'</p>':'')+'<div class="goal-progress large"><i style="width:'+pct+'%"></i></div><div class="row between"><b>'+pct+'%</b><small>'+(goal.target_date?'Meta: '+fmtDate(goal.target_date):'Sin fecha límite')+'</small></div><section class="goal-detail-section"><div class="row between"><div><h3>Pasos</h3><p>'+Number(goal.stepsCompleted||0)+' de '+Number(goal.stepsTotal||0)+' completados</p></div><button class="btn small secondary" data-action="goal-step-add" data-id="'+attr(goal.id)+'">+ Paso</button></div><div class="goal-steps">'+stepsHtml+'</div></section>'+contributionHtml+'<section class="goal-detail-section"><div class="row between"><div><h3>Relacionado</h3><p>Referencias, no copias.</p></div><button class="btn small secondary" data-action="goal-link-add" data-id="'+attr(goal.id)+'">+ Vincular</button></div><div class="goal-links">'+linkHtml+'</div></section><div class="form-actions"><button class="btn secondary" data-action="goal-edit" data-id="'+attr(goal.id)+'">'+ico('pencil')+' Editar</button><button class="btn ghost" data-action="goal-delete" data-id="'+attr(goal.id)+'">'+ico('trash-2')+' Eliminar</button></div></div>','goal-detail');
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
 const d=i.data||{},meta=kindMeta[i.kind]||['sparkles',i.kind],date=d.date?fmtDate(d.date):fmtDateTime(i.created),done=d.done?' · Hecho':'',locked=i.kind==='capsule'&&String(d.date||d.unlockDate||'')>String(cloud.today||''),voices=locked?[]:linkedVoices(i.id);
 if(locked)return '<div class="card item" data-item-id="'+attr(i.id)+'"><div class="item-icon">'+ico('lock')+'</div><div class="item-main"><div class="meta">Se abre '+esc(date)+'</div><h3>'+esc(d.title||'Cápsula')+'</h3><p class="muted">Este contenido seguirá guardado hasta la fecha elegida.</p></div></div>';
 return '<div class="card item" data-item-id="'+attr(i.id)+'"><div class="item-icon">'+ico(meta[0])+'</div><div class="item-main"><div class="meta">'+esc(date)+esc(done)+'</div><h3>'+esc(d.title||meta[1])+'</h3>'+((d.body||linkedDailyQuestionAnswers(i))?'<p>'+esc(d.body||linkedDailyQuestionAnswers(i)).replace(/\n/g,'<br>')+'</p>':'')+(voices.length?'<div class="stack" style="margin-top:10px">'+voices.map(voiceCard).join('')+'</div>':'')+'<div class="item-actions">'+(['memory','capsule','journey'].includes(i.kind)?'<button class="btn small secondary" data-action="voice-for-item" data-id="'+i.id+'">'+ico('mic')+' Añadir voz</button>':'')+(['plan','wish'].includes(i.kind)?'<button class="btn small secondary" data-action="goal-convert-item" data-id="'+i.id+'">'+ico('target')+' Convertir en objetivo</button>':'')+'<button class="btn small secondary" data-action="item-edit" data-id="'+i.id+'">Editar</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div></div></div>';
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
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">Nuestra música</h3><small class="muted">'+musicQueue.length+' canciones compartidas</small></div><button class="btn small" data-action="music-add">+ Añadir música</button></div><p class="muted" style="margin-top:8px">Suban un MP3 o peguen un enlace de Spotify, YouTube, YouTube Music o audio directo.</p><div class="stack music-library" style="margin-top:12px">'+(musicQueue.length?musicQueue.map((x,n)=>'<div class="card music-row '+(n===musicIndex?'active':'')+'"><button class="music-play" data-action="music-play" data-index="'+n+'" aria-label="Reproducir">'+ico(n===musicIndex&&musicPlaying?'pause':'play')+'</button><div class="music-meta"><b>'+esc(x.title)+'</b><p>'+esc(x.platform==='youtube'?'YouTube / YouTube Music':x.platform==='spotify'?'Spotify':x.platform==='mp3'?'MP3':'Audio por URL')+'</p></div>'+(x.type==='mp3'?'<button class="btn small ghost" data-action="media-delete" data-kind="music" data-path="'+attr(x.path)+'">Eliminar</button>':'<button class="btn small ghost" data-action="item-delete" data-id="'+attr(x.id)+'">Eliminar</button>')+'</div>').join(''):'<div class="empty"><span class="big">'+ico('music')+'</span>Construyan aquí la banda sonora de su historia.</div>')+'</div></div>';
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
 const sessionBlock=session?'<div class="context-session"><div class="row between"><div><p class="eyebrow">'+esc(sessionTitle.toUpperCase())+'</p><h3>'+esc(session.label||'Destino')+'</h3></div><span class="badge good">Activo</span></div><div class="context-progress"><i style="width:'+Math.max(0,Math.min(100,Number(session.progress_pct||0)))+'%"></i></div><div class="context-metrics"><span><b>'+Math.max(0,Math.min(100,Number(session.progress_pct||0)))+'%</b><small>progreso</small></span><span><b>'+(session.last_distance_m==null?'—':esc(fmtDistance(session.last_distance_m)))+'</b><small>restante</small></span><span><b>'+(session.last_eta_s==null?'—':esc(fmtDuration(session.last_eta_s)))+'</b><small>ETA</small></span></div><button class="btn small ghost" data-action="context-session-stop">'+ico('square')+' Terminar sesión</button></div>':'<div class="context-session empty-session"><span>'+ico('route')+'</span><div><b>Sin sesión activa</b><small>Acompáñame y Regreso solo funcionan cuando tú los inicias.</small></div></div>';
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
 return '<section class="section"><div class="section-head"><div><h2>Mapa de nuestra historia</h2><p>Lugares importantes conectados con lo que vivieron allí.</p></div></div><div class="history-places">'+places.map(p=>{const linked=(cloud.items||[]).filter(i=>Number(i.data?.placeId)===Number(p.id));return '<article class="card history-place"><button class="history-place-head" data-action="history-place" data-lat="'+attr(p.latitude)+'" data-lon="'+attr(p.longitude)+'"><span class="item-icon">'+ico(p.kind==='home'?'house':p.kind==='work'?'briefcase':p.kind==='adventure'?'compass':'heart')+'</span><span><b>'+esc(p.name)+'</b><small>'+esc(p.note||'Lugar guardado')+'</small></span></button><div class="history-links">'+(linked.length?linked.slice(0,5).map(i=>'<button class="history-memory" data-action="constellation-item" data-id="'+i.id+'">'+ico(kindMeta[i.kind]?.[0]||'sparkles')+' '+esc(i.data?.title||'Historia')+'</button>').join(''):'<button class="history-memory add" data-action="memory-at-place" data-id="'+p.id+'">'+ico('plus')+' Añadir recuerdo aquí</button>')+'</div></article>';}).join('')+'</div></section>';
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
 '<div class="card"><div class="row between"><div><h3>Copia de nuestra galaxia</h3><p>Exporta los datos a un archivo JSON o restaura una copia. Fotos, música y audios permanecen en su almacenamiento privado y se conservan por referencia.</p></div>'+ico('archive')+'</div><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="backup-export">'+ico('download')+' Exportar</button><button class="btn small ghost" data-action="backup-import">'+ico('upload')+' Restaurar</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Widget “Nuestra Galaxia” 2.0</h3><p>Foto, fecha, mood, distancia, ETA, canción, próximo plan, jardín y gesto rápido. Elige módulos al añadir cada widget.</p></div><span class="badge '+(native.canPinWidget?'good':'')+'">'+(native.canPinWidget?'Disponible':'Manual')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="widget-add">Añadir widget</button><button class="btn small secondary" data-action="widget-photo">Elegir foto</button><button class="btn small ghost" data-action="widget-photo-clear">Quitar foto</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Notificaciones de momentos</h3><p>Gestos y fechas especiales. Android revisa en segundo plano y también al abrir la app.</p></div><span class="badge '+(native.momentNotifications&&native.notificationsGranted&&native.notificationsEnabled?'good':'')+'">'+(native.momentNotifications?(native.notificationsGranted&&native.notificationsEnabled?'Listas':'Requieren ajuste'):'Pausadas')+'</span></div><div class="notification-health"><span class="'+(native.notificationsGranted?'good':'')+'">'+ico(native.notificationsGranted?'check':'circle-alert')+' Permiso '+(native.notificationsGranted?'concedido':'pendiente')+'</span><span class="'+(native.notificationsEnabled?'good':'')+'">'+ico(native.notificationsEnabled?'bell-ring':'bell-off')+' Sistema '+(native.notificationsEnabled?'habilitado':'bloqueado')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="moment-notifications">'+(native.momentNotifications?'Desactivar':'Activar')+'</button><button class="btn small '+(native.bondHaptics?'secondary':'ghost')+'" data-action="bond-haptics">'+ico('smartphone')+' Hápticos '+(native.bondHaptics?'activos':'apagados')+'</button>'+(native.momentNotifications?'<button class="btn small ghost" data-action="moment-notification-test">'+ico('bell-ring')+' Probar ahora</button>':'')+(!native.notificationsEnabled?'<button class="btn small ghost" data-action="app-settings">'+ico('settings')+' Ajustes</button>':'')+'</div><p class="muted" style="margin-top:10px">Push instantáneo: '+(native.pushConfigured?'configurado':'pendiente de Firebase')+'. Notificaciones y vibración se controlan por separado.</p></div>'+
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
 const d=item?.data||{},meta=kindMeta[kind]||['sparkles','Contenido'],editing=!!item?.id,places=mapData?.places||[];
 modal.dataset.editId=item?.id||'';modal.dataset.version=item?.version||'';modal.dataset.kind=kind;
 const needsDate=['memory','event','capsule','journey'].includes(kind),canPlace=['memory','journey','event'].includes(kind);
 const placeField=canPlace?(places.length?'<div class="field"><label>Lugar de nuestra historia (opcional)</label><select name="placeId"><option value="">Sin lugar</option>'+places.map(p=>'<option value="'+p.id+'" '+(Number(d.placeId)===Number(p.id)?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>':(d.placeId?'<input type="hidden" name="placeId" value="'+attr(d.placeId)+'">':'')):'';
 const body='<form id="itemForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" value="'+attr(d.title||'')+'" required maxlength="160"></div><div class="field"><label>Texto</label><textarea name="body" placeholder="Escribe aquí…">'+esc(d.body||'')+'</textarea></div>'+
 (needsDate?'<div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="'+attr(d.date||'')+'"></div>':'')+
 '<div class="field"><label>Categoría</label><input class="input" name="category" value="'+attr(d.category||'')+'" placeholder="'+attr(meta[1])+'"></div>'+placeField+
 (kind==='plan'?'<div class="date-plan-fields"><div class="field"><label>Cuándo</label><select name="planCategory"><option value="this-week" '+(d.planCategory==='this-week'?'selected':'')+'>Esta semana</option><option value="when-possible" '+(!d.planCategory||d.planCategory==='when-possible'?'selected':'')+'>Cuando podamos</option><option value="someday" '+(d.planCategory==='someday'?'selected':'')+'>Algún día</option><option value="travel" '+(d.planCategory==='travel'?'selected':'')+'>Viaje</option><option value="home" '+(d.planCategory==='home'?'selected':'')+'>En casa</option></select></div><div class="date-plan-grid"><div class="field"><label>Presupuesto estimado</label><input class="input" type="number" min="0" step="1000" name="budget" value="'+attr(d.budget??'')+'" placeholder="0"></div><div class="field"><label>Duración (min)</label><input class="input" type="number" min="15" step="15" name="minutes" value="'+attr(d.minutes??'')+'" placeholder="120"></div></div><div class="field"><label>Entorno</label><select name="where"><option value="salir" '+(d.where!=='casa'?'selected':'')+'>Salir</option><option value="casa" '+(d.where==='casa'?'selected':'')+'>En casa</option></select></div></div>':'')+
 (kind==='event'?'<label class="row"><input type="checkbox" name="annual" '+(d.annual?'checked':'')+'> Se repite cada año</label>':'')+
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
 const refs=(cloud.items||[]).filter(i=>['memory','song','capsule'].includes(i.kind)&&!(i.kind==='capsule'&&String(i.data?.date||'')>cloud.today));
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
 if(fd.has('date'))data.date=fd.get('date');
 if(kind==='event')data.annual=fd.get('annual')==='on';
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
});

document.addEventListener('change',e=>{
 if(e.target.matches('[data-role="surprise-unlock"]')){const dateBox=modal.querySelector('[data-role="surprise-date"]'),placeBox=modal.querySelector('[data-role="surprise-place"]');if(dateBox)dateBox.hidden=e.target.value!=='date';if(placeBox)placeBox.hidden=e.target.value!=='place';}
 if(e.target.matches('[data-role="game-question"]')){
   const q=gameQuestions[e.target.value],answer=modal.querySelector('[data-role="game-answer"]');
   answer.innerHTML=q.options.map(o=>'<option>'+esc(o)+'</option>').join('');
 }
});

document.addEventListener('submit',async e=>{
 e.preventDefault();
 try{
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
 const el=document.activeElement,playing=[...document.querySelectorAll('audio')].some(audio=>!audio.paused);
 return modal.open||playing||!!(el&&['INPUT','TEXTAREA','SELECT'].includes(el.tagName));
}
setInterval(()=>{
 if(!native.paired||document.visibilityState!=='visible')return;
 refreshStateIfChanged().catch(()=>{});
},45000);
setInterval(()=>{
 if(native.paired&&view==='map'&&document.visibilityState==='visible')refreshMap({quiet:true,detail:false}).catch(()=>{});
},12000);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&native.paired){
   refreshStateIfChanged().catch(()=>{});
   if(view==='map')refreshMap({quiet:true,detail:false}).catch(()=>{});
   if(native.momentNotifications)GalaxyNative.call('refreshMoments').catch(()=>{});
 }
});

render();
if(native.paired)refreshState().then(()=>syncPresence()).catch(()=>{});
setInterval(()=>{if(native.paired&&cloud&&document.visibilityState==='visible')syncPresence().catch(()=>{});},300000);
setInterval(()=>{if(native.paired&&native.momentNotifications&&document.visibilityState==='visible')GalaxyNative.call('refreshMoments').catch(()=>{});},120000);
