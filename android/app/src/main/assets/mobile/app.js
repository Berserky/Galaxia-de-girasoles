const $=s=>document.querySelector(s);
const app=$('#app'),navEl=$('#bottomNav'),modal=$('#modal'),toastEl=$('#toast');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc;
const ico=(name,cls='')=>'<i data-lucide="'+attr(name)+'" class="ui-icon '+attr(cls)+'" aria-hidden="true"></i>';
const refreshIcons=()=>requestAnimationFrame(()=>window.lucide?.createIcons?.({attrs:{'stroke-width':1.8}}));
const icons={home:'house',map:'map-pin',moments:'heart',memories:'images',more:'more-horizontal'};
const nav=[['home','Inicio'],['map','Mapa'],['moments','Momentos'],['memories','Recuerdos'],['more','Más']];
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
const surpriseIdeas=[
 {title:'Café y caminata',body:'Elegir un café nuevo y caminar sin afán por el barrio.',minutes:90,budget:45000,where:'salir'},
 {title:'Noche de película',body:'Cada uno propone una película, se sortea una y preparan algo rico.',minutes:150,budget:25000,where:'casa'},
 {title:'Cocinar juntos',body:'Comprar ingredientes para una receta que ninguno haya hecho.',minutes:120,budget:55000,where:'casa'},
 {title:'Fotos de nosotros',body:'Salir a caminar y tomar cinco fotos que cuenten el día.',minutes:90,budget:0,where:'salir'},
 {title:'Picnic sencillo',body:'Algo de comer, una manta y un parque para hablar sin pantallas.',minutes:150,budget:40000,where:'salir'},
 {title:'Preguntas y postre',body:'Comprar un postre y responder diez preguntas para conocerse más.',minutes:60,budget:30000,where:'casa'},
 {title:'Ruta sin destino',body:'Salir juntos y decidir cada giro por turnos durante media hora.',minutes:120,budget:30000,where:'salir'},
 {title:'Álbum del mes',body:'Elegir juntos las mejores fotos del mes y escribir una frase para cada una.',minutes:60,budget:0,where:'casa'}
];

let native={paired:false,version:''},cloud=null,mapData=null,view='home',memoryTab='memory',media={photo:null,music:null},mediaLoadedAt={photo:0,music:0},map=null;
let toastTimer,refreshing=false,updateState={text:'La app está al día.',progress:0,busy:false},pendingVoiceDraft=null,voiceReady=false,voiceRecording=false,voiceResumeMusic=false,voiceTimer=null,voiceSeconds=0,lastSurprise=null,lastPresenceSignature='';
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
function setMusicPlaying(v){musicPlaying=!!v;renderGlobalPlayer();syncPresence().catch(()=>{});}
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
   if(name==='voice'&&data.previewEnded&&voiceResumeMusic){voiceResumeMusic=false;if(!musicPlaying)toggleMusic();}
   if(name==='voice'&&data.ready){stopVoiceTimer();}
   if(name==='voice'&&data.ready&&modal.open){voiceRecording=false;voiceReady=true;const status=modal.querySelector('[data-role="voice-status"]');if(status)status.textContent='Grabación lista. Escúchala antes de guardar.';modal.querySelector('[data-action="voice-record-stop"]')?.setAttribute('hidden','');modal.querySelector('[data-action="voice-preview"]')?.removeAttribute('hidden');modal.querySelector('[data-action="voice-discard"]')?.removeAttribute('hidden');modal.querySelector('[data-action="voice-record-start"]')?.removeAttribute('hidden');}
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
const ownPresence=()=>cloud?.presence?.find?.(r=>String(r.person)===String(cloud?.person))||{};
const partnerPresence=()=>cloud?.presence?.find?.(r=>String(r.person)!==String(cloud?.person))||{};
const ownLocation=()=>cloud?.locations?.find?.(r=>String(r.person)===String(cloud?.person))||{};
const partnerLocation=()=>cloud?.locations?.find?.(r=>String(r.person)!==String(cloud?.person))||{};
async function syncPresence(force=false){
 if(!cloud||!native.paired)return;
 const p=ownPresence(),track=musicQueue[musicIndex],songTitle=musicPlaying&&track?track.title:'',battery=Number(native.batteryLevel);
 const signature=[!!p.share_battery,!!p.share_song,Number.isFinite(battery)?battery:'',p.share_song?songTitle:''].join('|');
 if(!force&&signature===lastPresenceSignature)return;
 lastPresenceSignature=signature;
 try{await api('presence-set',{shareBattery:!!p.share_battery,shareSong:!!p.share_song,...(Number.isFinite(battery)?{battery}:{}),songTitle:p.share_song?songTitle:''});}catch{}
}
function nowCard(){
 const daily=partnerDaily(),loc=partnerLocation(),p=partnerPresence(),parts=[];
 if(daily.mood)parts.push({icon:moods[daily.mood]?.[0]||'heart-pulse',label:'Ánimo',value:moods[daily.mood]?.[1]||daily.mood});
 if(loc.sharing)parts.push({icon:loc.motion==='walking'?'person-standing':loc.motion==='vehicle'?'navigation':'map-pin',label:'Movimiento',value:transportLabel(loc)+(loc.status?' · '+loc.status:'')});
 if(p.share_song&&p.song_title)parts.push({icon:'music',label:'Escuchando',value:p.song_title});
 if(p.share_battery&&Number.isFinite(Number(p.battery)))parts.push({icon:'battery-medium',label:'Batería',value:Number(p.battery)+'%'});
 if(!parts.length)return '<section class="section"><div class="card now-card"><p class="eyebrow">AHORA</p><h3>'+esc(partnerName())+'</h3><p class="muted">Todavía no hay información compartida de este momento.</p></div></section>';
 return '<section class="section"><div class="card now-card"><div class="section-head compact"><div><p class="eyebrow">AHORA</p><h3>'+esc(partnerName())+'</h3></div><span class="status-dot live"></span></div><div class="now-grid">'+parts.map(x=>'<div class="now-item"><span>'+ico(x.icon)+'</span><small>'+esc(x.label)+'</small><b>'+esc(x.value)+'</b></div>').join('')+'</div></div></section>';
}

const dailyQuestion=()=>{const d=cloud?.today||new Date().toISOString().slice(0,10);let n=0;for(const c of d)n+=c.charCodeAt(0);return dailyQuestions[n%dailyQuestions.length];};
const currentMonday=()=>{const d=new Date((cloud?.today||new Date().toISOString().slice(0,10))+'T12:00:00');const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.toISOString().slice(0,10);};
const coupleDays=()=>{const s=cloud?.settings?.data?.startDate;if(!s)return 0;return Math.max(0,Math.floor((Date.parse((cloud?.today||s)+'T12:00:00Z')-Date.parse(s+'T12:00:00Z'))/86400000));};
const dateDistance=d=>Math.round((Date.parse(d+'T12:00:00Z')-Date.parse((cloud?.today||d)+'T12:00:00Z'))/86400000);
function stopVoiceTimer(){if(voiceTimer){clearInterval(voiceTimer);voiceTimer=null;}voiceSeconds=0;}
function startVoiceTimer(){
 stopVoiceTimer();voiceSeconds=0;
 const paint=()=>{const el=modal.querySelector('[data-role="voice-timer"]');if(el)el.textContent=String(Math.floor(voiceSeconds/60)).padStart(2,'0')+':'+String(voiceSeconds%60).padStart(2,'0');};
 paint();voiceTimer=setInterval(()=>{voiceSeconds=Math.min(60,voiceSeconds+1);paint();if(voiceSeconds>=60)stopVoiceTimer();},1000);
}
function livingMoment(){
 const memories=items('memory').filter(x=>x.data?.date),today=cloud?.today||'',sameDay=memories.find(x=>x.data.date.slice(5)===today.slice(5)&&x.data.date!==today);
 const next=cloud?.nextEvent,partner=partnerDaily();
 if(sameDay)return {icon:'history',label:'UN DÍA COMO HOY',title:sameDay.data.title,body:'Este recuerdo volvió a aparecer en su historia.',action:'memory',id:sameDay.id};
 if(next&&dateDistance(next.date)>=0&&dateDistance(next.date)<=14)return {icon:'calendar-heart',label:'SE ACERCA ALGO ESPECIAL',title:next.title,body:'Faltan '+dateDistance(next.date)+' días.',action:'memory'};
 if(partner.mood)return {icon:'heart-pulse',label:'AHORA',title:partnerName()+' está '+(moods[partner.mood]?.[1]||partner.mood).toLowerCase(),body:'Un pequeño gesto puede hacer el día más cercano.',action:'moments'};
 const last=memories.slice().sort((a,b)=>String(b.data.date).localeCompare(String(a.data.date)))[0];
 return last?{icon:'sparkles',label:'DE SU HISTORIA',title:last.data.title,body:'Un recuerdo para volver a mirar hoy.',action:'memory',id:last.id}:{icon:'sparkles',label:'MOMENTOS VIVOS',title:'Su historia empieza aquí',body:'Guarden algo de hoy para encontrarlo más adelante.',action:'add-memory'};
}
function anniversaryInfo(){const start=cloud?.settings?.data?.startDate,today=cloud?.today;if(!start||!today)return null;const a=new Date(start+'T12:00:00'),b=new Date(today+'T12:00:00');if(a.getUTCDate()!==b.getUTCDate())return null;let months=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();if(months<=0)return null;return {months,years:Math.floor(months/12)};}
function anniversaryBanner(){const a=anniversaryInfo();if(!a)return'';const title=a.months%12===0?'Hoy cumplen '+a.years+' '+(a.years===1?'año':'años'):'Hoy cumplen '+a.months+' meses';return '<section class="anniversary-mode"><div class="anniversary-stars"></div><p class="eyebrow">UN DÍA DE USTEDES</p><h2>'+esc(title)+'</h2><p>La galaxia guarda lo que han construido hasta hoy.</p><button class="btn small" data-action="anniversary-open">'+ico('sparkles')+' Abrir nuestro día</button></section>';}
function livingMomentCard(){const m=livingMoment();return '<section class="section"><button class="card living-moment" data-action="'+m.action+'" '+(m.id?'data-id="'+m.id+'"':'')+'><span class="item-icon">'+ico(m.icon)+'</span><div><p class="eyebrow">'+esc(m.label)+'</p><h3>'+esc(m.title)+'</h3><p>'+esc(m.body)+'</p></div></button></section>';}
function surpriseNotes(){return items('note').filter(x=>x.data?.surprise);}
function surpriseUnlocked(i){const d=i.data||{};if(d.unlockType==='date')return !d.unlockDate||d.unlockDate<=cloud.today;if(d.unlockType==='place'){const own=(cloud.locations||[]).find(l=>l.person===cloud.person&&l.sharing);if(!own)return false;const km=(a,b,c,e)=>{const R=6371,p=Math.PI/180,da=(c-a)*p,dl=(e-b)*p,q=Math.sin(da/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(q));};return km(Number(own.latitude),Number(own.longitude),Number(d.latitude),Number(d.longitude))*1000<=Number(d.radius||150);}return true;}
function surpriseNotesView(){const list=surpriseNotes();return '<section class="section"><div class="section-head"><div><h2>Notas sorpresa</h2><p>Mensajes que aparecen en el momento o lugar elegido.</p></div><button class="btn small" data-action="surprise-note-new">+ Sorpresa</button></div><div class="stack">'+(list.length?list.map(i=>{const open=surpriseUnlocked(i),d=i.data||{};return '<div class="card"><span class="badge">'+(open?'Desbloqueada':'Guardada')+'</span><h3 style="margin-top:9px">'+esc(open?d.title:'Hay algo esperando para ti')+'</h3><p>'+esc(open?(d.body||''):(d.unlockType==='date'?'Se abrirá '+fmtDate(d.unlockDate):'Se abrirá al llegar al lugar elegido.'))+'</p>'+(open&&linkedVoices(i.id).length?linkedVoices(i.id).map(voiceCard).join(''):'')+(i.author===cloud.person?'<div class="item-actions"><button class="btn small secondary" data-action="voice-for-item" data-id="'+i.id+'">'+ico('mic')+' Añadir voz</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div>':'')+'</div>';}).join(''):'<div class="empty">Dejen una nota para una fecha o un lugar especial.</div>')+'</div></section>';}

async function refreshState({quiet=false}={}){
 if(!native.paired||refreshing)return;
 refreshing=true;
 try{cloud=await api('mobile-state');native=nativeState();syncPresence().catch(()=>{});if(!quiet)render();}
 catch(e){if(!quiet)toast(e.message);}
 finally{refreshing=false;}
}
async function refreshMap({quiet=false,detail=false}={}){
 if(!native.paired)return;
 try{
   const next=await api('map-state',{detail});
   mapData=detail||!mapData?next:{...mapData,...next};
   if(view==='map'&&!quiet)render();
   else if(view==='map')drawMap({fit:false});
 }catch(e){if(!quiet)toast(e.message);}
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

function header(){
 return '<header class="header"><div class="brand"><div class="brand-mark">'+ico('sparkles')+'</div><div><strong>Nuestra Galaxia</strong><small>'+esc(native.paired?(myName()+' & '+partnerName()):'Un espacio para dos')+'</small></div></div><div class="avatar">'+esc((native.paired?myName():'N').slice(0,1).toUpperCase())+'</div></header>';
}
function renderNav(){
 navEl.style.display=native.paired&&!shouldShowAdriWelcome()?'grid':'none';
 navEl.innerHTML=nav.map(([id,label])=>'<button class="nav-btn '+(view===id?'active':'')+'" data-view="'+id+'">'+ico(icons[id],'nav-icon')+'<span>'+label+'</span></button>').join('');
}
function go(next){
 const hadMap=!!mapData;
 view=next;render();window.scrollTo(0,0);
 if(view==='map'&&hadMap)refreshMap({quiet:true,detail:false});
}
function render(){
 renderNav();
 if(!native.paired){renderOnboarding();refreshIcons();return;}
 if(shouldShowAdriWelcome()){globalPlayer.className='global-player';renderAdriWelcome();refreshIcons();return;}
 if(!cloud){app.innerHTML=header()+loading('Cargando nuestra galaxia');refreshIcons();refreshState();return;}
 if(!media.music&&!mediaLoadedAt.music)setTimeout(()=>loadMedia('music').then(renderGlobalPlayer).catch(()=>{}),0);
 if(view==='home')app.innerHTML=header()+homeView();
 if(view==='map'){app.innerHTML=header()+mapView();setTimeout(()=>{drawMap();if(!mapData)refreshMap({detail:true});},0);}
 if(view==='moments')app.innerHTML=header()+momentsView();
 if(view==='memories'){app.innerHTML=header()+memoriesView();if((memoryTab==='album'&&!mediaFresh('photo'))||(memoryTab==='music'&&!mediaFresh('music')))setTimeout(()=>loadMedia(memoryTab==='album'?'photo':'music').catch(e=>toast(e.message)),0);}
 if(view==='more')app.innerHTML=header()+moreView();
 refreshIcons();
 renderGlobalPlayer();
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
 return anniversaryBanner()+'<section class="hero"><p class="eyebrow">NUESTRO UNIVERSO</p><h1>'+esc(myName())+' & '+esc(partnerName())+'</h1><p>Un lugar para acompañarnos, guardar lo vivido y seguir construyendo lo que viene.</p><div class="hero-stats"><div class="hero-stat"><b>'+coupleDays()+'</b><small>días juntos</small></div><div class="hero-stat"><b>'+items('memory').length+'</b><small>recuerdos</small></div><div class="hero-stat"><b>'+garden.days+'</b><small>días del girasol</small></div></div></section>'+nowCard()+
 '<section class="section"><div class="section-head"><div><h2>¿Cómo estás hoy?</h2><p>Tu estado se comparte solo con tu persona.</p></div></div><div class="mood-grid">'+Object.entries(moods).map(([id,m])=>'<button class="mood '+(own.mood===id?'active':'')+'" data-action="mood" data-value="'+id+'"><span>'+ico(m[0])+'</span>'+m[1]+'</button>').join('')+'</div>'+(partner.mood?'<div class="card" style="margin-top:10px"><span class="badge">'+esc(partnerName())+'</span> <b>'+esc(moods[partner.mood]?.[1]||partner.mood)+'</b></div>':'')+'</section>'+
 '<section class="section"><div class="card"><p class="eyebrow">PREGUNTA DEL DÍA</p><h3>'+esc(dailyQuestion())+'</h3>'+dailyAnswerMarkup(own,partner)+'</div></section>'+
 '<section class="section"><div class="grid">'+
 actionCard('map-pin','Nuestro mapa','Ver dónde estamos y nuestros recorridos','map')+
 actionCard('heart','Enviar un gesto','Abrazo, beso o “te extraño”','moments')+
 actionCard('images','Guardar recuerdo','Algo que no queremos olvidar','add-memory')+
 actionCard('circle-check-big','Nuevo plan','Algo para hacer juntos','add-plan')+
 '</div></section>'+livingMomentCard()+
 (next?'<section class="section"><div class="card"><p class="eyebrow">PRÓXIMA FECHA</p><h3>'+esc(next.title)+'</h3><p>'+esc(fmtDate(next.date))+'</p></div></section>':'')+
 '<section class="section"><div class="section-head"><div><h2>Cerca, aunque estemos lejos</h2><p>Estado actual del mapa compartido.</p></div></div><div class="stack">'+locs.map(personCard).join('')+'</div></section>';
}
function actionCard(iconName,title,copy,action){return '<button class="action-card" data-action="'+action+'"><span class="icon">'+ico(iconName)+'</span><b>'+esc(title)+'</b><small>'+esc(copy)+'</small></button>';}
function dailyAnswerMarkup(own,partner){
 let html='';
 if(!own.answer)html='<form id="dailyForm" class="stack" style="margin-top:14px"><textarea name="answer" placeholder="Tu respuesta…" required></textarea><button class="btn" type="submit">Guardar respuesta</button></form>';
 else html='<div class="card" style="margin-top:12px;background:var(--surface2)"><span class="badge">'+esc(myName())+'</span><p style="margin-top:7px">'+esc(own.answer)+'</p></div>';
 if(partner.answer)html+='<div class="card" style="margin-top:10px;background:#fff7f8"><span class="badge">'+esc(partnerName())+'</span><p style="margin-top:7px">'+esc(partner.answer)+'</p></div>';
 else if(own.answer)html+='<p class="muted" style="font-size:12px;margin-top:10px">La respuesta de '+esc(partnerName())+' aparecerá cuando ambos hayan respondido.</p>';
 return html;
}
function personCard(l){
 const name=names()[Number(l.person)]||'Nosotros',live=!!l.sharing,motion=transportLabel(l),kmh=Math.max(0,Number(l.speed||0)*3.6);
 return '<div class="card person-card"><div class="bubble">'+esc(name.slice(0,1))+'</div><div><b><span class="status-dot '+(live?'live':'')+'"></span>'+esc(name)+'</b><p>'+(live?esc(motion)+(l.status?' · '+esc(l.status):''):'Ubicación pausada')+'</p></div><div class="speed">'+(live?kmh.toFixed(kmh<10?1:0):'—')+'<small>km/h</small></div></div>';
}
function transportLabel(l){
 if(!l.sharing)return'Ubicación pausada';
 if(l.motion==='walking')return'Caminando';
 if(l.motion==='still')return'Quieto/a';
 if(l.motion==='vehicle')return l.transport_preference==='motorcycle'?'En moto · probable':l.transport_preference==='transit'?'En transporte público · probable':'En vehículo';
 return'Moviéndose';
}

function memoriesView(){
 const tabs=[['memory','Recuerdos'],['album','Álbum'],['music','Música'],['event','Calendario'],['plan','Planes'],['note','Notas'],['capsule','Cápsulas'],['wish','Deseos'],['journey','Viajes']];
 let body='';
 if(memoryTab==='album')body=albumView();
 else if(memoryTab==='music')body=musicView();
 else body=itemList(memoryTab);
 return '<section><div class="section-head"><div><p class="eyebrow">LO QUE SOMOS</p><h2>Nuestros recuerdos</h2><p>Todo lo que vamos guardando juntos.</p></div></div><div class="chips">'+tabs.map(([id,label])=>'<button class="chip '+(memoryTab===id?'active':'')+'" data-tab="'+id+'">'+label+'</button>').join('')+'</div>'+body+(memoryTab==='memory'?storyTimeline()+constellationView():'')+'</section>';
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
function itemCard(i){
 const d=i.data||{},meta=kindMeta[i.kind]||['sparkles',i.kind],date=d.date?fmtDate(d.date):fmtDateTime(i.created),done=d.done?' · Hecho':'',locked=i.kind==='capsule'&&String(d.date||d.unlockDate||'')>String(cloud.today||''),voices=locked?[]:linkedVoices(i.id);
 if(locked)return '<div class="card item"><div class="item-icon">'+ico('lock')+'</div><div class="item-main"><div class="meta">Se abre '+esc(date)+'</div><h3>'+esc(d.title||'Cápsula')+'</h3><p class="muted">Este contenido seguirá guardado hasta la fecha elegida.</p></div></div>';
 return '<div class="card item"><div class="item-icon">'+ico(meta[0])+'</div><div class="item-main"><div class="meta">'+esc(date)+esc(done)+'</div><h3>'+esc(d.title||meta[1])+'</h3>'+(d.body?'<p>'+esc(d.body)+'</p>':'')+(d.placeName?'<p class="place-link">'+ico('map-pin')+' '+esc(d.placeName)+'</p>':'')+(voices.length?'<div class="stack" style="margin-top:10px">'+voices.map(voiceCard).join('')+'</div>':'')+'<div class="item-actions">'+(['memory','capsule','journey'].includes(i.kind)?'<button class="btn small secondary" data-action="voice-for-item" data-id="'+i.id+'">'+ico('mic')+' Añadir voz</button>':'')+'<button class="btn small secondary" data-action="item-edit" data-id="'+i.id+'">Editar</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div></div></div>';
}
function storyTimeline(){
 const entries=(cloud?.items||[]).filter(x=>['memory','journey','event','capsule','song'].includes(x.kind)).filter(x=>x.kind!=='capsule'||String(x.data?.date||'')<=String(cloud.today||'')).slice().sort((a,b)=>String(b.data?.date||b.created).localeCompare(String(a.data?.date||a.created))).slice(0,12);
 return '<section class="section"><div class="section-head"><div><h2>Nuestra historia</h2><p>Recuerdos, viajes, fechas, canciones y cápsulas abiertas en una sola línea del tiempo.</p></div></div><div class="timeline">'+(entries.length?entries.map(itemCard).join(''):'<div class="empty">La historia irá apareciendo aquí a medida que guarden momentos.</div>')+'</div></section>';
}
function albumView(){
 const list=media.photo;
 if(!list)return loading('Cargando álbum');
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">Nuestro álbum</h3><small class="muted">'+list.length+' fotos privadas</small></div><button class="btn small" data-action="media-add" data-kind="photo">+ Foto</button></div>'+(list.length?'<div class="gallery" style="margin-top:12px">'+list.map(x=>'<div class="photo"><img loading="lazy" src="'+attr(x.url)+'" alt="Foto de nuestro álbum"><button data-action="media-delete" data-kind="photo" data-path="'+attr(x.path)+'" aria-label="Eliminar foto">'+ico('trash-2')+'</button></div>').join('')+'</div>':'<div class="empty"><span class="big">'+ico('camera')+'</span>Añade la primera foto desde tu teléfono.</div>')+'</div>';
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

function momentsView(){
 const bond=cloud.bond||{entries:[],garden:{days:0,stage:0}},entries=bond.entries||[];
 const games=entries.filter(x=>x.type==='game'),rituals=entries.filter(x=>x.type==='ritual'),notes=entries.filter(x=>x.type==='sharednote'),voices=entries.filter(x=>x.type==='voice');
 const stage=Number(bond.garden?.stage||0),plant=ico(stage===0?'sprout':'flower-2')+(stage>=3?ico('sparkles','garden-sparkle'):'');
 const pct=Math.min(100,(bond.garden?.days||0)/30*100);
 return '<section><div class="section-head"><div><p class="eyebrow">MOMENTOS PARA DOS</p><h2>Conectar</h2><p>Pequeñas cosas que nos acercan.</p></div></div>'+
 '<div class="card garden"><div class="garden-plant">'+plant+'</div><div><h3>Nuestro girasol</h3><p>'+Number(bond.garden?.days||0)+' días en los que ambos dejaron algo en la galaxia.</p><div class="progress"><i style="width:'+pct+'%"></i></div></div></div>'+
 '<div class="section"><div class="gesture-grid">'+
 '<button class="gesture" data-action="gesture" data-gesture="hug"><span>'+ico('hand-heart')+'</span>Abrazo</button>'+
 '<button class="gesture" data-action="gesture" data-gesture="kiss"><span>'+ico('heart')+'</span>Beso</button>'+
 '<button class="gesture" data-action="gesture" data-gesture="miss"><span>'+ico('message-circle')+'</span>Te extraño</button></div></div>'+
 '<div class="section"><div class="grid">'+actionCard('dice-5','Cita sorpresa','Una idea según el momento','surprise')+actionCard('gamepad-2','Juego de nosotros','Adivinar lo que elegiría el otro','new-game')+actionCard('notebook-pen','Ritual semanal','Agradecer, pedir y planear','new-ritual')+actionCard('mic','Mensaje de voz','Dejar una voz para el otro','new-voice')+'</div></div>'+
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
function voiceCard(e){
 const d=e.data||{};
 return '<div class="card audio-card"><span class="badge">'+(e.author===cloud.person?'Tu voz':esc(partnerName()))+'</span><h3 style="margin-top:9px">'+esc(d.title)+'</h3>'+(d.body?'<p>'+esc(d.body)+'</p>':'')+(d.audioUrl?'<audio controls preload="none" src="'+attr(d.audioUrl)+'"></audio>':'<p>El enlace de este audio necesita actualizarse.</p>')+(e.author===cloud.person?'<div class="item-actions"><button class="btn small ghost" data-action="bond-delete" data-id="'+e.id+'">Eliminar</button></div>':'')+'</div>';
}

function mapView(){
 const own=(cloud.locations||[]).find(l=>l.person===cloud.person)||{},partner=(cloud.locations||[]).find(l=>l.person!==cloud.person)||{};
 return '<section><div class="section-head"><div><p class="eyebrow">NUESTRO MAPA</p><h2>Acompañarnos</h2><p>Ubicación voluntaria, recorridos y lugares importantes.</p></div><button class="btn small secondary" data-action="map-refresh">Actualizar</button></div>'+
 '<div class="map-wrap"><div id="map"></div><button class="map-fab" data-action="status-menu" aria-label="Estado rápido">'+ico('sparkles')+'</button><div id="statusMenu" class="map-status-menu">'+['Ya voy','Voy bien','Llegué','En camino','Necesito una pausa'].map(s=>'<button data-action="status-set" data-status="'+attr(s)+'">'+esc(s)+'</button>').join('')+'<button data-action="status-custom">Otro…</button></div></div>'+
 '<div class="grid" style="margin-top:12px">'+personCard(own)+personCard(partner)+'</div>'+
 '<div class="section"><div class="card"><div class="row between"><div><h3>Compartir ubicación</h3><p>'+(native.tracking?'Android la mantiene activa en segundo plano.':'Está detenida en este teléfono.')+'</p></div><span class="badge '+(native.tracking?'good':'')+'">'+(native.tracking?'Activa':'Pausada')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="'+(native.tracking?'location-stop':'location-start')+'">'+(native.tracking?'Detener':'Comenzar')+'</button><button class="btn small secondary" data-action="app-settings">Permisos</button></div></div></div>'+
 '<div class="section"><div class="card"><h3>Cómo me muevo normalmente</h3><p>Ayuda a interpretar cuando Android detecta que vas en vehículo.</p><div class="chips" style="margin-top:12px">'+
 ['','motorcycle','transit'].map(value=>'<button class="chip '+((own.transport_preference||'')===value?'active':'')+'" data-action="transport-set" data-value="'+value+'">'+ico(value==='motorcycle'?'bike':value==='transit'?'bus-front':'navigation')+(value==='motorcycle'?'Moto':value==='transit'?'Transporte público':'Automático')+'</button>').join('')+
 '</div></div></div>'+
 '<div class="section"><div class="grid">'+actionCard('route',own.trip_active?'Terminar recorrido':'Iniciar recorrido',own.trip_active?'Guardaremos el resumen al finalizar':'Registra distancia, duración y movimiento','trip-toggle')+actionCard('map-pin','Guardar este lugar','Casa, trabajo, recuerdo o aventura','place-new')+actionCard('navigation','Acompáñame','Elegir a dónde voy','destination')+'</div></div>'+
 mapHistoryView()+'</section>';
}
function mapHistoryView(){
 if(!mapData)return '<div class="section">'+loading('Cargando recorridos')+'</div>';
 const trips=mapData.trips||[],events=mapData.events||[],encounters=mapData.encounters||[],places=mapData.places||[];
 const placesWithHistory=places.map(p=>({place:p,stories:(cloud.items||[]).filter(i=>Number(i.data?.placeId)===Number(p.id)&&['memory','journey'].includes(i.kind))})).filter(x=>x.stories.length);
 return (placesWithHistory.length?'<section class="section"><div class="section-head"><div><h2>Mapa de nuestra historia</h2><p>Lugares enlazados con recuerdos y viajes.</p></div></div><div class="stack">'+placesWithHistory.slice(0,8).map(x=>'<div class="card place-history"><span>'+ico('map-pin')+'</span><div><h3>'+esc(x.place.name)+'</h3><p>'+x.stories.map(i=>esc(i.data?.title||'Recuerdo')).join(' · ')+'</p></div></div>').join('')+'</div></section>':'')+
 '<section class="section"><div class="section-head"><div><h2>Actividad reciente</h2><p>Recorridos, llegadas y encuentros.</p></div></div><div class="stack">'+
 (trips.slice(0,4).map(t=>'<div class="card"><span class="badge">'+(names()[Number(t.person)]||'Nosotros')+'</span><h3 style="margin-top:8px">'+fmtDistance(t.distance_m)+' · '+fmtDuration(t.duration_s)+'</h3><p>'+esc(fmtDateTime(t.started_at))+(t.max_speed?' · máx. '+(Number(t.max_speed)*3.6).toFixed(0)+' km/h':'')+'</p></div>').join('')||
 events.slice(0,4).map(e=>'<div class="card"><h3>'+(e.event==='arrived'?'Llegada':'Salida')+'</h3><p>'+esc(fmtDateTime(e.happened_at))+'</p></div>').join('')||
 encounters.slice(0,3).map(e=>'<div class="card"><h3 class="icon-title">'+ico('heart')+'Nos encontramos</h3><p>'+esc(fmtDateTime(e.started_at))+'</p></div>').join('')||
 '<div class="empty">Aquí aparecerán los recorridos y encuentros que vayamos guardando.</div>')+
 '</div></section>';
}

function relationshipAnswer(raw){
 const q=String(raw||'').trim().toLowerCase();if(!q)return {title:'Pregúntame algo de ustedes',body:'Puedo buscar entre recuerdos, viajes, canciones, notas, planes, lugares y fechas guardadas.'};
 const all=(cloud.items||[]).filter(i=>!i.data?.locked),words=q.normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\s+/).filter(w=>w.length>2);
 const normalize=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 if(/proxim|fecha|anivers/.test(normalize(q))&&cloud.nextEvent)return {title:'Lo próximo',body:cloud.nextEvent.title+' · '+fmtDate(cloud.nextEvent.date)};
 if(/ultimo|reciente/.test(normalize(q))&&/recuerdo|viaje|momento/.test(normalize(q))){const hit=all.filter(i=>['memory','journey'].includes(i.kind)).sort((a,b)=>String(b.data?.date||b.created).localeCompare(String(a.data?.date||a.created)))[0];if(hit)return {title:hit.data?.title||'Último recuerdo',body:hit.data?.body||fmtDate(hit.data?.date)};}
 if(/lugar|donde|sitio/.test(normalize(q))){const ps=(cloud.places||[]).slice(0,5);if(ps.length)return {title:'Lugares de ustedes',body:ps.map(p=>p.name).join(' · ')};}
 const scored=all.map(i=>{const hay=normalize([i.data?.title,i.data?.body,i.data?.category,i.data?.placeName,kindMeta[i.kind]?.[1]].join(' '));return {i,score:words.reduce((n,w)=>n+(hay.includes(w)?1:0),0)};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,5);
 if(scored.length)return {title:'Encontré '+scored.length+' coincidencia'+(scored.length===1?'':'s'),body:scored.map(x=>(x.i.data?.title||kindMeta[x.i.kind]?.[1]||'Momento')+(x.i.data?.date?' · '+fmtDate(x.i.data.date):'')).join('\n')};
 return {title:'No encontré algo exacto',body:'Prueba con una palabra del recuerdo, un lugar, una canción, “último recuerdo” o “próxima fecha”.'};
}
function openRelationshipAI(){
 showModal('Nuestra IA · beta privada','<div class="card compact"><p>Busca únicamente dentro de lo que ustedes guardaron en Nuestra Galaxia. La pregunta se procesa en este teléfono.</p></div><form id="aiForm" class="stack" style="margin-top:14px"><div class="field"><label>¿Qué quieres recordar?</label><input class="input" name="question" placeholder="Ej. ¿Cuál fue nuestro último viaje?" required></div><button class="btn" type="submit">'+ico('sparkles')+' Buscar en nuestra historia</button></form><div data-role="ai-answer"></div>');
}
function moreView(){
 const settings=cloud.settings||{data:{},version:1},data=settings.data||{};
 return '<section><div class="section-head"><div><p class="eyebrow">NUESTRA APP</p><h2>Más</h2><p>Widget, ajustes, permisos y actualización.</p></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Widget “Nuestra Galaxia”</h3><p>Foto, próxima fecha y un abrazo desde el escritorio.</p></div><span class="badge '+(native.canPinWidget?'good':'')+'">'+(native.canPinWidget?'Disponible':'Manual')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="widget-add">Añadir widget</button><button class="btn small secondary" data-action="widget-photo">Elegir foto</button><button class="btn small ghost" data-action="widget-photo-clear">Quitar foto</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Notificaciones de momentos</h3><p>Gestos y fechas especiales, sin depender del GPS.</p></div><span class="badge '+(native.momentNotifications?'good':'')+'">'+(native.momentNotifications?'Activas':'Pausadas')+'</span></div><button class="btn small secondary" style="margin-top:14px" data-action="moment-notifications">'+(native.momentNotifications?'Desactivar':'Activar')+'</button></div>'+
 '<div class="card"><h3>Nuestros datos</h3><form id="settingsForm" class="stack" style="margin-top:12px"><div class="grid"><div class="field"><label>Nombre 1</label><input class="input" name="name0" value="'+attr(data.names?.[0]||'')+'" required></div><div class="field"><label>Nombre 2</label><input class="input" name="name1" value="'+attr(data.names?.[1]||'')+'" required></div></div><div class="field"><label>Inicio de nuestra historia</label><input class="input" type="date" name="startDate" value="'+attr(data.startDate||'')+'"></div><div class="field"><label>Álbum de Google Fotos (opcional)</label><input class="input" name="albumUrl" value="'+attr(data.albumUrl||'')+'" placeholder="https://photos.app.goo.gl/…"></div><button class="btn" type="submit">Guardar ajustes</button></form></div>'+
 '<div class="card"><h3>Ahora · privacidad</h3><p>Elige qué información temporal puede ver '+esc(partnerName())+'. La ubicación sigue controlándose por separado desde el mapa.</p><div class="privacy-grid"><button class="privacy-toggle '+(ownPresence().share_battery?'active':'')+'" data-action="presence-battery-toggle">'+ico('battery-medium')+'<span><b>Batería</b><small>'+(ownPresence().share_battery?'Compartida':'Privada')+'</small></span></button><button class="privacy-toggle '+(ownPresence().share_song?'active':'')+'" data-action="presence-song-toggle">'+ico('music')+'<span><b>Lo que escucho</b><small>'+(ownPresence().share_song?'Compartido':'Privado')+'</small></span></button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Nuestra IA · beta privada</h3><p>Busca y conecta lo que ya han guardado, sin enviar la pregunta a un servicio externo.</p></div>'+ico('sparkles')+'</div><button class="btn small secondary" style="margin-top:14px" data-action="relationship-ai">Preguntar por nuestra historia</button></div>'+
 '<div class="card"><h3>Copia de seguridad</h3><p>Exporta recuerdos, planes, notas, fechas, momentos y lugares a un archivo JSON. Restaurar combina la copia sin borrar lo que ya existe.</p><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="backup-export">'+ico('download')+' Exportar copia</button><button class="btn small ghost" data-action="backup-import">'+ico('upload')+' Restaurar copia</button></div></div>'+
 (Number(cloud?.person)===0?'<div class="card"><div class="row between"><div><h3>Previsualización de Adri</h3><p>Solo tú puedes ver este control. Abre la bienvenida exactamente como la verá Adri, sin marcarla como completada.</p></div>'+ico('sparkles')+'</div><button class="btn small secondary" style="margin-top:14px" data-action="welcome-replay">Previsualizar bienvenida</button></div>':'')+
 '<div class="card"><h3>Permisos de Android</h3><p>Ubicación: '+(native.locationGranted?'concedida':'pendiente')+' · Segundo plano: '+(native.backgroundLocationGranted?'concedido':'opcional')+' · Notificaciones: '+(native.notificationsGranted?'concedidas':'pendientes')+'</p><button class="btn small secondary" style="margin-top:14px" data-action="app-settings">Abrir ajustes del sistema</button></div>'+
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
   const mine=l.person===cloud.person,name=names()[Number(l.person)]||'Nosotros';
   map.addMarker({
     lat:l.latitude,lon:l.longitude,label:esc(name.slice(0,1)),
     className:mine?'mine':'partner',
     popup:name+' · '+transportLabel(l)+' · '+(Number(l.speed||0)*3.6).toFixed(0)+' km/h'
   });
   bounds.push([Number(l.latitude),Number(l.longitude)]);
 });
 (mapData.places||[]).forEach(p=>{
   const markerIcon=p.kind==='home'?'house':p.kind==='work'?'briefcase':p.kind==='adventure'?'compass':'heart';
   const linked=(cloud.items||[]).filter(i=>Number(i.data?.placeId)===Number(p.id)&&['memory','journey'].includes(i.kind));
   map.addMarker({lat:p.latitude,lon:p.longitude,icon:markerIcon,className:'place',popup:p.name+(p.note?' · '+p.note:'')+(linked.length?' · '+linked.length+' recuerdo'+(linked.length===1?'':'s'):'')});
 });
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
async function resetVoiceDraft(){stopVoiceTimer();if(voiceRecording||voiceReady){try{await GalaxyNative.call('discardVoiceRecording');}catch{}}voiceRecording=false;voiceReady=false;if(voiceResumeMusic){if(!musicPlaying)toggleMusic();voiceResumeMusic=false;}}
function closeModal(){if(modal.dataset.form==='voice'&&pendingVoiceDraft!==null)resetVoiceDraft();if(modal.open)modal.close();delete modal.dataset.editId;delete modal.dataset.version;delete modal.dataset.kind;delete modal.dataset.form;}
function openItemForm(kind,item){
 const d=item?.data||{},meta=kindMeta[kind]||['sparkles','Contenido'];
 modal.dataset.editId=item?.id||'';modal.dataset.version=item?.version||'';modal.dataset.kind=kind;
 const needsDate=['memory','event','capsule','journey'].includes(kind);
 const body='<form id="itemForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" value="'+attr(d.title||'')+'" required maxlength="160"></div><div class="field"><label>Texto</label><textarea name="body" placeholder="Escribe aquí…">'+esc(d.body||'')+'</textarea></div>'+
 (needsDate?'<div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="'+attr(d.date||'')+'"></div>':'')+
 (['memory','journey'].includes(kind)?'<div class="field"><label>Lugar relacionado (opcional)</label><select name="placeId"><option value="">Sin lugar</option>'+(cloud.places||[]).map(p=>'<option value="'+p.id+'" '+(String(d.placeId||'')===String(p.id)?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>':'')+
 '<div class="field"><label>Categoría</label><input class="input" name="category" value="'+attr(d.category||'')+'" placeholder="'+attr(meta[1])+'"></div>'+
 (kind==='event'?'<label class="row"><input type="checkbox" name="annual" '+(d.annual?'checked':'')+'> Se repite cada año</label>':'')+
 (kind==='plan'||kind==='wish'?'<label class="row"><input type="checkbox" name="done" '+(d.done?'checked':'')+'> Ya lo hicimos</label>':'')+
 '<div class="form-actions"><button class="btn secondary" type="button" data-action="modal-close">Cancelar</button><button class="btn" type="submit">Guardar</button></div></form>';
 showModal((item?'Editar ':'Nuevo ')+meta[1].toLowerCase(),body,'item');
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
function openVoice(referenceId=''){
 pendingVoiceDraft={};voiceReady=false;voiceRecording=false;
 const refs=(cloud.items||[]).filter(i=>(['memory','song','capsule','journey'].includes(i.kind)||(i.kind==='note'&&i.data?.surprise))&&!(i.kind==='capsule'&&String(i.data?.date||'')>cloud.today)&&!i.data?.locked);
 showModal('Mensaje de voz','<form id="voiceForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" placeholder="Te pienso…" required></div><div class="field"><label>Dedicatoria</label><textarea name="body" placeholder="Unas palabras antes del audio…"></textarea></div><div class="field"><label>Relacionar con un recuerdo (opcional)</label><select name="referenceId"><option value="">Sin referencia</option>'+refs.map(i=>'<option value="'+i.id+'" '+(String(i.id)===String(referenceId)?'selected':'')+'>'+esc(i.data?.title||'Recuerdo')+'</option>').join('')+'</select></div><div class="card compact" data-role="voice-recorder"><b>Grábalo aquí</b><small class="muted" data-role="voice-status">Toca el micrófono cuando estés listo.</small><strong class="voice-timer" data-role="voice-timer">00:00</strong><div class="row wrap" style="margin-top:10px"><button class="btn" type="button" data-action="voice-record-start">'+ico('mic')+' Grabar</button><button class="btn secondary" type="button" data-action="voice-record-stop" hidden>'+ico('square')+' Detener</button><button class="btn secondary" type="button" data-action="voice-preview" hidden>'+ico('play')+' Escuchar</button><button class="btn secondary" type="button" data-action="voice-discard" hidden>'+ico('rotate-ccw')+' Repetir</button></div></div><button class="btn secondary" type="button" data-action="voice-file">'+ico('folder-open')+' Elegir audio del teléfono</button><button class="btn" type="submit">Guardar mensaje de voz</button></form>','voice');
}
function openSurpriseNote(){
 const own=ownLocation(),places=cloud.places||[],canPlace=places.length||own.sharing;
 showModal('Nueva nota sorpresa','<form id="surpriseNoteForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" required maxlength="160"></div><div class="field"><label>Mensaje</label><textarea name="body" required></textarea></div><div class="field"><label>Desbloquear</label><select name="unlockType" data-role="surprise-unlock"><option value="date">En una fecha</option>'+(canPlace?'<option value="place">Al llegar a un lugar</option>':'')+'</select></div><div class="field" data-role="surprise-date"><label>Fecha</label><input class="input" type="date" name="unlockDate" value="'+attr(cloud.today)+'"></div><div class="stack" data-role="surprise-place" hidden><div class="field"><label>Lugar</label><select name="placeId">'+places.map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('')+(own.sharing?'<option value="current">Mi ubicación actual</option>':'')+'</select></div><div class="field"><label>Radio de desbloqueo</label><select name="radius"><option value="75">75 m</option><option value="150" selected>150 m</option><option value="300">300 m</option></select></div></div><button class="btn" type="submit">Guardar sorpresa</button></form>','surprise-note');
}
function openSurprise(){
 const idea=surpriseIdeas[Math.floor(Math.random()*surpriseIdeas.length)];lastSurprise=idea;
 showModal('Cita sorpresa','<div class="card" style="margin-top:16px"><span class="badge">'+idea.minutes+' min · '+(idea.budget?('$ '+idea.budget.toLocaleString('es-CO')):'$ 0')+' · '+esc(idea.where)+'</span><h3 style="margin-top:10px">'+esc(idea.title)+'</h3><p>'+esc(idea.body)+'</p></div><div class="form-actions"><button class="btn secondary" data-action="surprise-again">Otra idea</button><button class="btn" data-action="surprise-save">Guardar como plan</button></div>');
}
function openPlace(){
 const own=(mapData?.locations||cloud.locations||[]).find(l=>l.person===cloud.person&&l.sharing);
 if(!own){toast('Activa tu ubicación para guardar el lugar actual.');return;}
 showModal('Guardar este lugar','<form id="placeForm" class="stack" style="margin-top:16px"><div class="field"><label>Nombre</label><input class="input" name="name" placeholder="Casa, oficina, nuestro parque…" required></div><div class="field"><label>Tipo</label><select name="kind"><option value="home">Casa</option><option value="work">Trabajo</option><option value="memory">Recuerdo</option><option value="adventure">Aventura</option></select></div><div class="field"><label>Nota</label><textarea name="note" placeholder="Algo que quieras recordar de este lugar"></textarea></div><input type="hidden" name="latitude" value="'+Number(own.latitude)+'"><input type="hidden" name="longitude" value="'+Number(own.longitude)+'"><button class="btn" type="submit">Guardar lugar actual</button></form>','place');
}
function openDestination(){
 const partner=cloud.person==='0'?'1':'0',places=mapData?.places||[];
 showModal('Acompáñame','<form id="destinationForm" class="stack" style="margin-top:16px"><div class="field"><label>Voy hacia</label><select name="destination"><option value="person:'+partner+'">'+esc(partnerName())+'</option>'+places.map(p=>'<option value="place:'+p.id+'">'+esc(p.name)+'</option>').join('')+'<option value="none">Ningún destino</option></select></div><button class="btn" type="submit">Guardar destino</button></form>','destination');
}

async function busy(task,success){
 try{await task();if(success)toast(success);}
 catch(e){toast(e.message);}
}
async function submitItem(form){
 const fd=new FormData(form),kind=modal.dataset.kind,id=modal.dataset.editId,version=Number(modal.dataset.version||0);
 const data={title:fd.get('title'),body:fd.get('body'),category:fd.get('category')};
 if(fd.has('date'))data.date=fd.get('date');
 if(fd.has('placeId')){const place=(cloud.places||[]).find(p=>String(p.id)===String(fd.get('placeId')));data.placeId=place?place.id:null;data.placeName=place?place.name:'';}
 if(kind==='event')data.annual=fd.get('annual')==='on';
 if(kind==='plan'||kind==='wish')data.done=fd.get('done')==='on';
 await api('item-save',{...(id?{id,version}:{}),kind,data});closeModal();await refreshState();toast('Guardado en nuestra galaxia.');
}
async function deleteItem(id){
 const item=cloud.items.find(i=>i.id===id);if(!item)return;
 if(!confirm('¿Eliminar este contenido?'))return;
 await api('item-delete',{id,version:item.version});await refreshState();toast('Eliminado.');
}
async function saveDaily(field,value){await api('daily-save',{field,value});await refreshState();}
async function sendGesture(gesture){await api('bond-save',{type:'gesture',data:{gesture}});await refreshState({quiet:true});render();toast(gesture==='hug'?'Abrazo enviado.':gesture==='kiss'?'Beso enviado.':'Le contaste que le extrañas.');}
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
  if(a==='map'){go('map');return;}
  if(a==='moments'){go('moments');return;}
  if(a==='add-memory'){openItemForm('memory');return;}
  if(a==='add-plan'){openItemForm('plan');return;}
  if(a==='item-new'){openItemForm(btn.dataset.kind);return;}
  if(a==='item-edit'){openItemForm(cloud.items.find(i=>i.id===btn.dataset.id)?.kind,cloud.items.find(i=>i.id===btn.dataset.id));return;}
  if(a==='item-delete'){await deleteItem(btn.dataset.id);return;}
  if(a==='mood'){await busy(()=>saveDaily('mood',btn.dataset.value),'Estado guardado.');return;}
  if(a==='gesture'){await busy(()=>sendGesture(btn.dataset.gesture));return;}
  if(a==='new-game'){openGame();return;}
  if(a==='new-ritual'){openRitual();return;}
  if(a==='ritual-edit'){openRitual(cloud.bond.entries.find(x=>x.id===btn.dataset.id));return;}
  if(a==='new-sharednote'){openSharedNote();return;}
  if(a==='sharednote-edit'){openSharedNote(cloud.bond.entries.find(x=>x.id===btn.dataset.id));return;}
  if(a==='new-voice'){openVoice();return;}
  if(a==='voice-for-item'){openVoice(btn.dataset.id);return;}
  if(a==='anniversary-open'){memoryTab='memory';go('memories');setTimeout(()=>document.querySelector('.constellation')?.scrollIntoView({behavior:'smooth',block:'center'}),80);return;}
  if(a==='constellation-item'){const i=cloud.items.find(x=>x.id===btn.dataset.id);if(i)showModal(i.data?.title||'Recuerdo','<div class="card" style="margin-top:16px"><span class="badge">'+esc(kindMeta[i.kind]?.[1]||'Historia')+'</span><p style="margin-top:10px">'+esc(i.data?.body||fmtDate(i.data?.date)||'Parte de nuestra historia.')+'</p>'+(linkedVoices(i.id).length?linkedVoices(i.id).map(voiceCard).join(''):'')+'</div>');return;}
  if(a==='voice-record-start'){voiceResumeMusic=musicPlaying;if(musicPlaying)toggleMusic();await GalaxyNative.call('startVoiceRecording');voiceRecording=true;voiceReady=false;startVoiceTimer();modal.querySelector('[data-role="voice-status"]').textContent='Grabando… máximo 1 minuto.';btn.hidden=true;modal.querySelector('[data-action="voice-record-stop"]').hidden=false;return;}
  if(a==='voice-record-stop'){const info=await GalaxyNative.call('stopVoiceRecording');stopVoiceTimer();voiceRecording=false;voiceReady=true;modal.querySelector('[data-role="voice-status"]').textContent='Grabación lista · '+Math.max(1,Math.round((info.durationMs||0)/1000))+' s. Escúchala antes de guardar.';btn.hidden=true;modal.querySelector('[data-action="voice-record-start"]').hidden=false;modal.querySelector('[data-action="voice-preview"]').hidden=false;modal.querySelector('[data-action="voice-discard"]').hidden=false;if(voiceResumeMusic){if(!musicPlaying)toggleMusic();voiceResumeMusic=false;}return;}
  if(a==='voice-preview'){voiceResumeMusic=musicPlaying;if(musicPlaying)toggleMusic();await GalaxyNative.call('playVoiceRecording');return;}
  if(a==='voice-discard'){stopVoiceTimer();await GalaxyNative.call('discardVoiceRecording');voiceReady=false;voiceRecording=false;modal.querySelector('[data-role="voice-status"]').textContent='Audio descartado. Puedes grabarlo otra vez.';modal.querySelector('[data-action="voice-preview"]').hidden=true;btn.hidden=true;modal.querySelector('[data-action="voice-record-start"]').hidden=false;return;}
  if(a==='voice-file'){const form=modal.querySelector('#voiceForm'),fd=new FormData(form);pendingVoiceDraft={title:String(fd.get('title')||''),body:String(fd.get('body')||''),referenceId:String(fd.get('referenceId')||'')};if(!pendingVoiceDraft.title.trim()){toast('Ponle un título al mensaje.');return;}const upload=await GalaxyNative.call('pickMedia','voice');await api('bond-save',{type:'voice',data:{...pendingVoiceDraft,audioPath:upload.path,mime:upload.mime}});pendingVoiceDraft=null;closeModal();await refreshState();toast('Mensaje de voz guardado.');return;}
  if(a==='bond-delete'){await busy(()=>bondDelete(btn.dataset.id));return;}
  if(a==='game-guess'){await busy(async()=>{await api('bond-guess',{id:btn.dataset.id,guess:btn.dataset.guess});await refreshState();},'Respuesta enviada.');return;}
  if(a==='surprise'){openSurprise();return;}
  if(a==='surprise-note-new'){openSurpriseNote();return;}
  if(a==='surprise-again'){openSurprise();return;}
  if(a==='surprise-save'&&lastSurprise){await busy(async()=>{await api('item-save',{kind:'plan',data:{title:lastSurprise.title,body:lastSurprise.body,category:'Cita sorpresa',done:false}});closeModal();await refreshState();},'Cita guardada en Planes.');return;}
  if(a==='music-add'){openMusicAdd();return;}
  if(a==='music-upload'){closeModal();await GalaxyNative.call('pickMedia','music');media.music=null;mediaLoadedAt.music=0;await loadMedia('music',true);renderGlobalPlayer();toast('MP3 añadido a Nuestra música.');return;}
  if(a==='music-url'){openMusicUrl();return;}
  if(a==='music-play'){const n=Number(btn.dataset.index);if(n===musicIndex)toggleMusic();else playMusicAt(n);return;}
  if(a==='player-toggle'){toggleMusic();return;}
  if(a==='player-next'){playMusicAt(musicIndex+1);return;}
  if(a==='player-expand'){memoryTab='music';go('memories');return;}
  if(a==='media-add'){await GalaxyNative.call('pickMedia',btn.dataset.kind);media[btn.dataset.kind]=null;mediaLoadedAt[btn.dataset.kind]=0;await loadMedia(btn.dataset.kind,true);toast('Archivo añadido.');return;}
  if(a==='media-delete'){if(confirm('¿Eliminar este archivo?')){await api('media-delete',{kind:btn.dataset.kind,path:btn.dataset.path});media[btn.dataset.kind]=null;mediaLoadedAt[btn.dataset.kind]=0;await loadMedia(btn.dataset.kind,true);toast('Archivo eliminado.');}return;}
  if(a==='map-refresh'){await refreshMap({detail:true});return;}
  if(a==='status-menu'){$('#statusMenu')?.classList.toggle('open');return;}
  if(a==='status-set'){await api('status-set',{status:btn.dataset.status});$('#statusMenu')?.classList.remove('open');await refreshMap();toast('Estado actualizado.');return;}
  if(a==='status-custom'){const value=prompt('¿Qué estado quieres mostrar?','');if(value){await api('status-set',{status:value});await refreshMap();}return;}
  if(a==='location-start'){await GalaxyNative.call('startLocation');native=nativeState();render();toast('Ubicación activa.');return;}
  if(a==='location-stop'){await GalaxyNative.call('stopLocation');native=nativeState();render();toast('Ubicación detenida.');return;}
  if(a==='trip-toggle'){const own=(cloud.locations||[]).find(l=>l.person===cloud.person)||{};await api('trip',{operation:own.trip_active?'stop':'start'});await refreshState();await refreshMap({detail:true});toast(own.trip_active?'Recorrido guardado.':'Recorrido iniciado.');return;}
  if(a==='place-new'){if(!mapData)await refreshMap({quiet:true,detail:true});openPlace();return;}
  if(a==='destination'){if(!mapData)await refreshMap({quiet:true,detail:true});openDestination();return;}
  if(a==='transport-set'){await api('transport-set',{preference:btn.dataset.value});await refreshState({quiet:true});await refreshMap({quiet:true});render();toast('Preferencia de transporte actualizada.');return;}
  if(a==='presence-battery-toggle'){const p=ownPresence(),enable=!p.share_battery;await api('presence-set',{shareBattery:enable,...(Number.isFinite(Number(native.batteryLevel))?{battery:Number(native.batteryLevel)}:{})});lastPresenceSignature='';await refreshState();toast(enable?'Batería compartida con '+partnerName()+'.':'Tu batería volvió a ser privada.');return;}
  if(a==='presence-song-toggle'){const p=ownPresence(),enable=!p.share_song,track=musicQueue[musicIndex];await api('presence-set',{shareSong:enable,songTitle:enable&&musicPlaying&&track?track.title:''});lastPresenceSignature='';await refreshState();toast(enable?'La canción actual puede aparecer en “Ahora”.':'Lo que escuchas volvió a ser privado.');return;}
  if(a==='relationship-ai'){openRelationshipAI();return;}
  if(a==='backup-export'){const backup=await api('backup-export');await GalaxyNative.call('saveBackup',JSON.stringify(backup));toast('Copia de seguridad guardada en tu teléfono.');return;}
  if(a==='backup-import'){const picked=await GalaxyNative.call('pickBackup');let backup;try{backup=JSON.parse(picked.content||'{}');}catch{throw new Error('El archivo seleccionado no es una copia válida.');}if(!confirm('¿Restaurar esta copia? Se combinará con lo actual y no se borrarán tus datos existentes.'))return;const restored=await api('backup-restore',{backup});await refreshState();toast('Copia restaurada · '+Number(restored?.restored?.items||0)+' contenidos recuperados.');return;}
  if(a==='app-settings'){await GalaxyNative.call('openAppSettings');return;}
  if(a==='widget-add'){await GalaxyNative.call('addWidget');toast('Android abrió la solicitud del widget.');return;}
  if(a==='widget-photo'){await chooseWidgetPhoto();return;}
  if(a==='widget-photo-select'){await api('bond-widget',{photoPath:btn.dataset.path});closeModal();await GalaxyNative.call('refreshMoments');await refreshState();toast('Foto del widget actualizada.');return;}
  if(a==='widget-photo-clear'){await api('bond-widget',{photoPath:''});await GalaxyNative.call('refreshMoments');await refreshState();toast('Foto del widget retirada.');return;}
  if(a==='moment-notifications'){await GalaxyNative.call('setMomentNotifications',!native.momentNotifications);native=nativeState();render();toast(native.momentNotifications?'Notificaciones activadas.':'Notificaciones pausadas.');return;}
  if(a==='update-check'){await GalaxyNative.call('checkUpdate');return;}
  if(a==='unpair'){if(confirm('¿Desvincular este teléfono de Nuestra Galaxia?')){await GalaxyNative.call('unpair');native=nativeState();cloud=null;render();}return;}
 }catch(err){toast(err.message||'No pudimos completar la acción.');}
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
  if(e.target.id==='pairForm'){
   const code=new FormData(e.target).get('code');await GalaxyNative.call('pair',String(code));native=nativeState();await refreshState();toast('Teléfono vinculado.');return;
  }
  if(e.target.id==='musicUrlForm'){const fd=new FormData(e.target),url=String(fd.get('url')||'').trim(),title=String(fd.get('title')||'').trim(),platform=detectMusicPlatform(url);if(!/^https:\/\//i.test(url))throw new Error('Usa un enlace https válido.');await api('item-save',{kind:'song',data:{title,url,platform}});closeModal();await refreshState();rebuildMusicQueue();renderGlobalPlayer();toast('Canción añadida a Nuestra música.');return;}
  if(e.target.id==='aiForm'){const answer=relationshipAnswer(new FormData(e.target).get('question')),box=modal.querySelector('[data-role="ai-answer"]');if(box)box.innerHTML='<div class="card ai-answer" style="margin-top:14px"><p class="eyebrow">EN NUESTRA HISTORIA</p><h3>'+esc(answer.title)+'</h3><p>'+answer.body.split('\n').map(esc).join('<br>')+'</p></div>';refreshIcons();return;}
  if(e.target.id==='dailyForm'){await saveDaily('answer',new FormData(e.target).get('answer'));toast('Respuesta guardada.');return;}
  if(e.target.id==='itemForm'){await submitItem(e.target);return;}
  if(e.target.id==='gameForm'){const fd=new FormData(e.target);await api('bond-save',{type:'game',data:{questionId:fd.get('questionId'),answer:fd.get('answer')}});closeModal();await refreshState();toast('Pregunta guardada.');return;}
  if(e.target.id==='ritualForm'){const fd=new FormData(e.target),data={week:fd.get('week'),gratitude:fd.get('gratitude'),need:fd.get('need'),plan:fd.get('plan')},id=modal.dataset.editId,version=Number(modal.dataset.version||0);if(id)await api('bond-update',{id,version,data});else await api('bond-save',{type:'ritual',data});closeModal();await refreshState();toast('Ritual guardado.');return;}
  if(e.target.id==='sharedNoteForm'){const fd=new FormData(e.target),data={title:fd.get('title'),body:fd.get('body')},id=modal.dataset.editId,version=Number(modal.dataset.version||0);if(id)await api('bond-update',{id,version,data});else await api('bond-save',{type:'sharednote',data});closeModal();await refreshState();toast('Nota compartida guardada.');return;}
  if(e.target.id==='surpriseNoteForm'){const fd=new FormData(e.target),unlockType=String(fd.get('unlockType')||'date');let place=null;if(unlockType==='place'){const value=String(fd.get('placeId')||'');place=value==='current'?ownLocation():(cloud.places||[]).find(p=>String(p.id)===value);if(!place)throw new Error('Elige un lugar válido.');}const data={title:String(fd.get('title')||''),body:String(fd.get('body')||''),category:'Sorpresa',surprise:true,unlockType,unlockDate:unlockType==='date'?String(fd.get('unlockDate')||''):'',latitude:unlockType==='place'?Number(place.latitude):null,longitude:unlockType==='place'?Number(place.longitude):null,placeId:unlockType==='place'&&place.id?place.id:null,placeName:unlockType==='place'?(place.name||'Ubicación actual'):'',radius:unlockType==='place'?Number(fd.get('radius')||150):150};await api('item-save',{kind:'note',data});closeModal();await refreshState();toast('Sorpresa guardada.');return;}
  if(e.target.id==='voiceForm'){
   const fd=new FormData(e.target);pendingVoiceDraft={title:String(fd.get('title')||''),body:String(fd.get('body')||''),referenceId:String(fd.get('referenceId')||'')};
   if(voiceRecording)throw new Error('Detén la grabación antes de guardarla.');
   if(!voiceReady)throw new Error('Graba tu voz o usa “Elegir audio del teléfono”.');
   const upload=await GalaxyNative.call('saveVoiceRecording');
   await api('bond-save',{type:'voice',data:{...pendingVoiceDraft,audioPath:upload.path,mime:upload.mime}});
   pendingVoiceDraft=null;voiceReady=false;closeModal();await refreshState();toast('Mensaje de voz guardado.');return;
  }
  if(e.target.id==='placeForm'){const fd=new FormData(e.target);await api('place-save',{name:fd.get('name'),kind:fd.get('kind'),note:fd.get('note'),latitude:Number(fd.get('latitude')),longitude:Number(fd.get('longitude'))});closeModal();await refreshMap();toast('Lugar guardado.');return;}
  if(e.target.id==='destinationForm'){const value=String(new FormData(e.target).get('destination'));if(value==='none')await api('destination-save',{kind:'none'});else{const [kind,id]=value.split(':');await api('destination-save',kind==='person'?{kind,target_person:id,label:partnerName()}:{kind,place_id:Number(id)});}closeModal();await refreshMap();toast('Destino actualizado.');return;}
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
 refreshState({quiet:true}).then(()=>{if(view!=='map'&&!editingNow())render();}).catch(()=>{});
},45000);
setInterval(()=>{
 if(native.paired&&view==='map'&&document.visibilityState==='visible')refreshMap({quiet:true,detail:false}).catch(()=>{});
},12000);
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'&&native.paired){
   refreshState({quiet:true}).then(()=>{if(view!=='map'&&!editingNow())render();}).catch(()=>{});
   if(view==='map')refreshMap({quiet:true,detail:false}).catch(()=>{});
 }
});

render();
if(native.paired)refreshState();
