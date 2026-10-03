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

let native={paired:false,version:''},cloud=null,mapData=null,view='home',memoryTab='memory',media={photo:null,music:null},mediaLoadedAt={photo:0,music:0},map=null,monthlyCache=new Map(),todayHistoryCache=new Map(),todayHistoryItems=new Map(),encounterStatsCache=null,encounterStatsLoading=false,frequentPlacesData=null,frequentPlacesLoadedAt=0,frequentPlacesLoading=false;
let toastTimer,refreshing=false,updateState={text:'La app está al día.',progress:0,busy:false},pendingVoiceDraft=null,voiceReady=false,voiceRecording=false,voiceResumeMusic=false,lastSurprise=null;
let presenceLastSignature='',voiceTimer=null,voiceSeconds=0;
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
const dailyQuestion=()=>{const d=cloud?.today||new Date().toISOString().slice(0,10);let n=0;for(const c of d)n+=c.charCodeAt(0);return dailyQuestions[n%dailyQuestions.length];};
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
function anniversaryInfo(){const start=cloud?.settings?.data?.startDate,today=cloud?.today;if(!start||!today)return null;const a=new Date(start+'T12:00:00'),b=new Date(today+'T12:00:00');if(a.getUTCDate()!==b.getUTCDate())return null;let months=(b.getUTCFullYear()-a.getUTCFullYear())*12+b.getUTCMonth()-a.getUTCMonth();if(months<=0)return null;return {months,years:Math.floor(months/12)};}
function anniversaryBanner(){const a=anniversaryInfo();if(!a)return'';const title=a.months%12===0?'Hoy cumplen '+a.years+' '+(a.years===1?'año':'años'):'Hoy cumplen '+a.months+' meses';return '<section class="anniversary-mode"><div class="anniversary-stars"></div><p class="eyebrow">UN DÍA DE USTEDES</p><h2>'+esc(title)+'</h2><p>La galaxia guarda lo que han construido hasta hoy.</p><button class="btn small" data-action="anniversary-open">'+ico('sparkles')+' Abrir nuestro día</button></section>';}
function livingMomentCard(){const m=livingMoment();return '<section class="section"><button class="card living-moment" data-action="'+m.action+'" '+(m.id?'data-id="'+m.id+'"':'')+'><span class="item-icon">'+ico(m.icon)+'</span><div><p class="eyebrow">'+esc(m.label)+'</p><h3>'+esc(m.title)+'</h3><p>'+esc(m.body)+'</p></div></button></section>';}
function surpriseNotes(){return items('note').filter(x=>x.data?.surprise);}
function surpriseUnlocked(i){const d=i.data||{};if(d.unlockType==='date')return !d.unlockDate||d.unlockDate<=cloud.today;if(d.unlockType==='place'){const own=(cloud.locations||[]).find(l=>l.person===cloud.person&&l.sharing);if(!own)return false;const km=(a,b,c,e)=>{const R=6371,p=Math.PI/180,da=(c-a)*p,dl=(e-b)*p,q=Math.sin(da/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(dl/2)**2;return 2*R*Math.asin(Math.sqrt(q));};return km(Number(own.latitude),Number(own.longitude),Number(d.latitude),Number(d.longitude))*1000<=Number(d.radius||150);}return true;}
function surpriseNotesView(){const list=surpriseNotes();return '<section class="section"><div class="section-head"><div><h2>Notas sorpresa</h2><p>Mensajes que aparecen en el momento o lugar elegido.</p></div><button class="btn small" data-action="surprise-note-new">+ Sorpresa</button></div><div class="stack">'+(list.length?list.map(i=>{const open=surpriseUnlocked(i),d=i.data||{};return '<div class="card"><span class="badge">'+(open?'Desbloqueada':'Guardada')+'</span><h3 style="margin-top:9px">'+esc(open?d.title:'Hay algo esperando para ti')+'</h3><p>'+esc(open?(d.body||''):(d.unlockType==='date'?'Se abrirá '+fmtDate(d.unlockDate):'Se abrirá al llegar al lugar elegido.'))+'</p>'+(open&&linkedVoices(i.id).length?linkedVoices(i.id).map(voiceCard).join(''):'')+(i.author===cloud.person?'<div class="item-actions"><button class="btn small secondary" data-action="voice-for-item" data-id="'+i.id+'">'+ico('mic')+' Añadir voz</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div>':'')+'</div>';}).join(''):'<div class="empty">Dejen una nota para una fecha o un lugar especial.</div>')+'</div></section>';}

function cloudRenderFingerprint(data=cloud){
 if(!data)return '';
 const compactItems=(data.items||[]).map(i=>[i.id,i.version,i.kind]).join('|');
 const compactBond=(data.bond?.entries||[]).map(i=>[i.id,i.version,i.type]).join('|');
 const compactDevices=(data.devices||[]).map(i=>[i.id,i.person,i.revoked_at||'',i.last_seen||'']).join('|');
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
 try{cloud=await api('mobile-state');native=nativeState();if(!quiet)render();}
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
   mapData=detail||!mapData?next:{...mapData,...next};
   if(view==='map'&&!quiet)render();
   else if(view==='map'){drawMap({fit:false});updateCoupleDistanceDom();updateEtaDom();}
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
 return '<header class="header"><div class="brand"><div class="brand-mark">'+ico('sparkles')+'</div><div><strong>Nuestra Galaxia</strong><small>'+esc(native.paired?(myName()+' & '+partnerName()):'Un espacio para dos')+'</small></div></div><div class="header-actions"><button class="header-search" data-action="universal-search-open" aria-label="Buscar en nuestra galaxia">'+ico('search')+'</button><div class="avatar">'+esc((native.paired?myName():'N').slice(0,1).toUpperCase())+'</div></div></header>';
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
let nativeThemeSent='';
function syncSystemTheme(themeState){
 const active=themeState?.active||'daylight';
 if(nativeThemeSent===active)return;
 nativeThemeSent=active;
 GalaxyNative.call('setSystemTheme',active).catch(()=>{nativeThemeSent='';});
}
function render(){
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
 if(view==='memories'){app.innerHTML=header()+memoriesView();if((memoryTab==='album'&&!mediaFresh('photo'))||(memoryTab==='music'&&!mediaFresh('music')))setTimeout(()=>loadMedia(memoryTab==='album'?'photo':'music').catch(e=>toast(e.message)),0);}
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
 return anniversaryBanner()+'<section class="hero"><p class="eyebrow">NUESTRO UNIVERSO</p><h1>'+esc(myName())+' & '+esc(partnerName())+'</h1><p>Un lugar para acompañarnos, guardar lo vivido y seguir construyendo lo que viene.</p><div class="hero-stats"><div class="hero-stat"><b>'+coupleDays()+'</b><small>días juntos</small></div><div class="hero-stat"><b>'+items('memory').length+'</b><small>recuerdos</small></div><div class="hero-stat"><b>'+garden.days+'</b><small>días del girasol</small></div></div></section>'+monthlySummaryTeaser()+todayHistoryTeaser()+coupleDistanceCard()+encounterStatsTeaser()+nowCard()+
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
function monthlySummaryTeaser(){
 const month=String(cloud?.today||'').slice(0,7),label=window.GalaxyMonthly?.monthLabel(month)||'Nuestro mes';
 return '<section class="section"><button class="card monthly-teaser" data-action="monthly-summary-open" data-month="'+attr(month)+'"><span class="monthly-teaser-icon">'+ico('calendar-heart')+'</span><span><p class="eyebrow">NUESTRO MES</p><h3>'+esc(label)+'</h3><p>Recuerdos, planes, kilómetros, encuentros y pequeños gestos en un solo lugar.</p></span>'+ico('chevron-right')+'</button></section>';
}
function monthlyMetric(iconName,value,label,detail=''){
 return '<div class="monthly-metric"><span>'+ico(iconName)+'</span><b>'+esc(value)+'</b><small>'+esc(label)+'</small>'+(detail?'<em>'+esc(detail)+'</em>':'')+'</div>';
}
function monthlySummaryMarkup(summary){
 const month=summary.month,current=String(cloud?.today||'').slice(0,7),counts=summary.counts||{},trips=summary.trips||{},encounters=summary.encounters||{},connection=summary.connection||{},bond=summary.bond||{};
 const label=window.GalaxyMonthly?.monthLabel(month)||month,has=window.GalaxyMonthly?.summaryHasActivity(summary);
 const km=(Number(trips.distance_m||0)/1000).toFixed(Number(trips.distance_m||0)>=10000?0:1);
 const together=fmtDuration(Number(encounters.together_seconds||0));
 const previous=window.GalaxyMonthly?.shiftMonth(month,-1)||'',next=window.GalaxyMonthly?.shiftMonth(month,1)||'',canNext=window.GalaxyMonthly?.canGoNext(month,current);
 const highlights=(summary.highlights||[]).map(i=>'<button class="monthly-highlight" data-action="universal-search-result" data-type="item" data-id="'+attr(i.id)+'" data-kind="'+attr(i.kind)+'"><span>'+ico(kindMeta[i.kind]?.[0]||'sparkles')+'</span><span><b>'+esc(i.title||'Parte de nuestra historia')+'</b><small>'+esc(fmtDate(i.date))+'</small></span>'+ico('chevron-right')+'</button>').join('');
 return '<div class="monthly-summary"><div class="monthly-nav"><button class="btn small ghost" data-action="monthly-summary-month" data-month="'+attr(previous)+'" aria-label="Mes anterior">'+ico('chevron-left')+'</button><div><p class="eyebrow">NUESTRO MES</p><h2>'+esc(label)+'</h2></div><button class="btn small ghost" data-action="monthly-summary-month" data-month="'+attr(next)+'" aria-label="Mes siguiente" '+(canNext?'':'disabled')+'>'+ico('chevron-right')+'</button></div>'+
 (has?'<div class="monthly-hero"><span>'+ico('sparkles')+'</span><div><b>'+Number(counts.saved||0)+' cosas guardadas</b><p>Un vistazo a lo que construyeron juntos este mes.</p></div></div>'+
 '<div class="monthly-metrics">'+
 monthlyMetric('images',counts.memories||0,'recuerdos')+
 monthlyMetric('circle-check-big',counts.plansDone||0,'planes vividos')+
 monthlyMetric('calendar-heart',counts.events||0,'fechas especiales')+
 monthlyMetric('route',km+' km','recorridos',Number(trips.count||0)+' rutas')+
 monthlyMetric('heart-handshake',encounters.count||0,'encuentros',together+' juntos')+
 monthlyMetric('smile',connection.mood_days||0,'días conectados',Number(connection.answer_days||0)+' preguntas de ambos')+
 monthlyMetric('hand-heart',bond.gestures||0,'gestos enviados')+
 monthlyMetric('mic',bond.voices||0,'mensajes de voz')+
 '</div>'+
 ((Number(counts.songs||0)+Number(counts.notes||0)+Number(counts.journeys||0)+Number(counts.wishesDone||0))?'<div class="monthly-extra card"><h3>También pasó</h3><div class="monthly-extra-row">'+
 (counts.songs?'<span>'+ico('music')+counts.songs+' canciones</span>':'')+
 (counts.notes?'<span>'+ico('file-text')+counts.notes+' notas</span>':'')+
 (counts.journeys?'<span>'+ico('route')+counts.journeys+' viajes</span>':'')+
 (counts.wishesDone?'<span>'+ico('star')+counts.wishesDone+' deseos vividos</span>':'')+
 '</div></div>':'')+
 (highlights?'<div class="monthly-highlights"><div class="section-head"><div><h3>Momentos del mes</h3><p>Algunas cosas para volver a mirar.</p></div></div>'+highlights+'</div>':'')
 :'<div class="universal-search-empty">'+ico('moon-star')+'<h3>Este mes todavía está empezando</h3><p>Cuando guarden recuerdos, recorridos, planes o gestos, su historia mensual aparecerá aquí.</p></div>')+
 '</div>';
}
async function openMonthlySummary(month=String(cloud?.today||'').slice(0,7)){
 if(!window.GalaxyMonthly?.validMonth(month))return;
 const cached=monthlyCache.get(month);
 showModal('Nuestro mes',cached?monthlySummaryMarkup(cached):'<div class="monthly-loading">'+loading('Preparando nuestro mes')+'<p>Reuniendo recuerdos, recorridos y momentos…</p></div>');
 if(cached)return;
 try{
  const summary=await api('monthly-summary',{month});
  monthlyCache.set(month,summary);
  if(modal.open)showModal('Nuestro mes',monthlySummaryMarkup(summary));
 }catch(error){if(modal.open)showModal('Nuestro mes','<div class="universal-search-empty">'+ico('circle-alert')+'<h3>No pudimos preparar este mes</h3><p>'+esc(error.message||'Intenta nuevamente.')+'</p></div>');}
}

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
function distanceAgeLabel(value){
 const age=Math.max(0,Date.now()-Date.parse(value||''));
 if(!Number.isFinite(age))return'';
 if(age<60000)return'Actualizado hace menos de 1 min';
 const min=Math.floor(age/60000);
 if(min<60)return'Actualizado hace '+min+' min';
 const h=Math.floor(min/60);return'Actualizado hace '+h+' h';
}
function coupleDistanceState(){
 return window.GalaxyDistance?.coupleDistance(coupleDistanceLocations())||{available:false,reason:'missing'};
}
function coupleDistanceCard({mapMode=false}={}){
 const state=coupleDistanceState(),title='Distancia entre '+myName()+' y '+partnerName();
 if(!state.available){
   const stale=state.reason==='stale',copy=stale?'Una de las ubicaciones lleva demasiado tiempo sin actualizarse.':'Ambos deben compartir ubicación para calcular la distancia.';
   return '<section class="section"><div class="card couple-distance unavailable" id="coupleDistanceCard"><span class="couple-distance-icon">'+ico(stale?'refresh-cw':'map-pin')+'</span><div><p class="eyebrow">'+esc(title.toUpperCase())+'</p><h3>'+(stale?'Esperando una ubicación reciente':'Distancia no disponible')+'</h3><p>'+esc(copy)+'</p></div>'+(mapMode?'<button class="btn small ghost" data-action="map-refresh">'+ico('refresh-cw')+' Actualizar</button>':'<button class="btn small ghost" data-action="couple-distance-map">'+ico('map-pin')+' Abrir mapa</button>')+'</div></section>';
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
function etaUnavailableCopy(reason){
 if(reason==='none')return {title:'Elige a dónde vas',copy:'Usa Acompáñame para seleccionar a '+partnerName()+' o uno de sus lugares guardados.'};
 if(reason==='own-paused')return {title:'Activa tu ubicación',copy:'Necesitamos tu posición para calcular cuánto falta.'};
 if(reason==='own-stale')return {title:'Esperando tu ubicación',copy:'Tu posición necesita una actualización reciente para calcular el ETA.'};
 if(reason==='target-paused')return {title:partnerName()+' pausó su ubicación',copy:'No calcularemos un ETA hacia una posición que ya no se comparte.'};
 if(reason==='target-stale')return {title:'Esperando a '+partnerName(),copy:'Su última posición es demasiado antigua para estimar una llegada fiable.'};
 if(reason==='place-missing')return {title:'Ese lugar ya no está disponible',copy:'Elige otro destino desde Acompáñame.'};
 return {title:'ETA no disponible',copy:'Actualiza el mapa o elige nuevamente el destino.'};
}
function etaCard(){
 const e=etaState();
 if(!e.available){
  const message=etaUnavailableCopy(e.reason),hasDestination=e.reason!=='none';
  return '<section class="section"><div class="card eta-card unavailable" id="etaCard"><span class="eta-icon">'+ico('timer')+'</span><div><p class="eyebrow">ETA APROXIMADO</p><h3>'+esc(message.title)+'</h3><p>'+esc(message.copy)+'</p></div><button class="btn small '+(hasDestination?'ghost':'secondary')+'" data-action="'+(hasDestination?'map-refresh':'destination')+'">'+ico(hasDestination?'refresh-cw':'navigation')+' '+(hasDestination?'Actualizar':'Acompáñame')+'</button></div></section>';
 }
 const modeIcon=e.mode==='walking'?'person-standing':e.mode==='motorcycle'?'bike':e.mode==='transit'?'bus-front':'navigation';
 const distance=window.GalaxyDistance?.formatDistance(e.meters)||fmtDistance(e.meters),eta=window.GalaxyEta.etaLabel(e.seconds);
 const source=e.speed_source==='live'?'con tu velocidad actual':'con ritmo estimado';
 const targetNote=e.target_moving?' · el destino también está en movimiento':'';
 return '<section class="section"><div class="card eta-card '+(e.arrived?'arrived':'')+'" id="etaCard"><span class="eta-icon">'+ico(e.arrived?'map-pin-check':modeIcon)+'</span><div class="eta-main"><p class="eyebrow">ETA HACIA '+esc(String(e.label||'DESTINO').toUpperCase())+'</p><div class="eta-value"><strong>'+esc(eta)+'</strong><span>'+esc(distance)+'</span></div><p>'+esc(e.arrived?'Ya estás en el destino.':'Estimado '+e.mode_label+', '+source+'.')+'</p><small>Ruta aproximada desde distancia geográfica'+esc(targetNote)+'. No reemplaza navegación vial.</small></div><div class="eta-actions"><button class="btn small secondary" data-action="eta-focus">'+ico('crosshair')+' Ver ruta</button><button class="btn small ghost" data-action="destination">'+ico('shuffle')+' Cambiar</button></div></div></section>';
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
function renderUniversalSearchResults(query){
 const el=document.querySelector('#universalSearchResults');if(!el)return;
 el.innerHTML=universalSearchResultsMarkup(query);refreshIcons();
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
 if(locked)return '<div class="card item" data-item-id="'+attr(i.id)+'"><div class="item-icon">'+ico('lock')+'</div><div class="item-main"><div class="meta">Se abre '+esc(date)+'</div><h3>'+esc(d.title||'Cápsula')+'</h3><p class="muted">Este contenido seguirá guardado hasta la fecha elegida.</p></div></div>';
 return '<div class="card item" data-item-id="'+attr(i.id)+'"><div class="item-icon">'+ico(meta[0])+'</div><div class="item-main"><div class="meta">'+esc(date)+esc(done)+'</div><h3>'+esc(d.title||meta[1])+'</h3>'+(d.body?'<p>'+esc(d.body)+'</p>':'')+(voices.length?'<div class="stack" style="margin-top:10px">'+voices.map(voiceCard).join('')+'</div>':'')+'<div class="item-actions">'+(['memory','capsule','journey'].includes(i.kind)?'<button class="btn small secondary" data-action="voice-for-item" data-id="'+i.id+'">'+ico('mic')+' Añadir voz</button>':'')+'<button class="btn small secondary" data-action="item-edit" data-id="'+i.id+'">Editar</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div></div></div>';
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
 '<div class="grid" style="margin-top:12px">'+personCard(own)+personCard(partner)+'</div>'+coupleDistanceCard({mapMode:true})+etaCard()+
 '<div class="section"><div class="card"><div class="row between"><div><h3>Compartir ubicación</h3><p>'+(native.tracking?'Android la mantiene activa en segundo plano.':'Está detenida en este teléfono.')+'</p></div><span class="badge '+(native.tracking?'good':'')+'">'+(native.tracking?'Activa':'Pausada')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="'+(native.tracking?'location-stop':'location-start')+'">'+(native.tracking?'Detener':'Comenzar')+'</button><button class="btn small secondary" data-action="app-settings">Permisos</button></div></div></div>'+
 '<div class="section"><div class="card"><h3>Cómo me muevo normalmente</h3><p>Ayuda a interpretar cuando Android detecta que vas en vehículo.</p><div class="chips" style="margin-top:12px">'+
 ['','motorcycle','transit'].map(value=>'<button class="chip '+((own.transport_preference||'')===value?'active':'')+'" data-action="transport-set" data-value="'+value+'">'+ico(value==='motorcycle'?'bike':value==='transit'?'bus-front':'navigation')+(value==='motorcycle'?'Moto':value==='transit'?'Transporte público':'Automático')+'</button>').join('')+
 '</div></div></div>'+
 '<div class="section"><div class="grid">'+actionCard('route',own.trip_active?'Terminar recorrido':'Iniciar recorrido',own.trip_active?'Guardaremos el resumen al finalizar':'Registra distancia, duración y movimiento','trip-toggle')+actionCard('map-pin','Guardar este lugar','Casa, trabajo, recuerdo o aventura','place-new')+actionCard('navigation','Acompáñame','Elegir a dónde voy','destination')+'</div></div>'+
 frequentPlacesView()+mapHistoryView()+'</section>';
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
 (trips.slice(0,4).map(t=>'<div class="card"><span class="badge">'+(names()[Number(t.person)]||'Nosotros')+'</span><h3 style="margin-top:8px">'+fmtDistance(t.distance_m)+' · '+fmtDuration(t.duration_s)+'</h3><p>'+esc(fmtDateTime(t.started_at))+(t.max_speed?' · máx. '+(Number(t.max_speed)*3.6).toFixed(0)+' km/h':'')+'</p></div>').join('')||
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

function moreView(){
 const settings=cloud.settings||{data:{},version:1},data=settings.data||{},presence=ownPresence();
 return '<section><div class="section-head"><div><p class="eyebrow">NUESTRA APP</p><h2>Más</h2><p>Privacidad, respaldo, nuestra historia inteligente y ajustes.</p></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Privacidad de “Ahora”</h3><p>Tu ubicación sigue teniendo su propio interruptor. Aquí decides si compartes batería y la canción que estás escuchando.</p></div>'+ico('shield-check')+'</div><div class="privacy-grid"><button class="privacy-toggle '+(presence.shareBattery?'active':'')+'" data-action="presence-battery">'+ico('battery-charging')+'<span><b>Batería</b><small>'+(presence.shareBattery?'Compartida':'Solo para ti')+'</small></span></button><button class="privacy-toggle '+(presence.shareListening?'active':'')+'" data-action="presence-listening">'+ico('music')+'<span><b>Escuchando</b><small>'+(presence.shareListening?'Compartido':'Solo para ti')+'</small></span></button><button class="privacy-toggle '+(native.tracking?'active':'')+'" data-action="map">'+ico('map-pin')+'<span><b>Ubicación</b><small>'+(native.tracking?'Compartiendo':'Pausada')+'</small></span></button></div></div>'+gpsHistoryPrivacyCard()+
 themeSettingsCard()+
 '<div class="card"><div class="row between"><div><h3>Nuestra IA</h3><p>Pregunta por recuerdos, planes, lugares, viajes y momentos guardados. Responde usando únicamente su propia historia.</p></div>'+ico('sparkles')+'</div><button class="btn small" style="margin-top:14px" data-action="our-ai">Preguntar a nuestra historia</button></div>'+
 '<div class="card"><div class="row between"><div><h3>Copia de nuestra galaxia</h3><p>Exporta los datos a un archivo JSON o restaura una copia. Fotos, música y audios permanecen en su almacenamiento privado y se conservan por referencia.</p></div>'+ico('archive')+'</div><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="backup-export">'+ico('download')+' Exportar</button><button class="btn small ghost" data-action="backup-import">'+ico('upload')+' Restaurar</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Widget “Nuestra Galaxia”</h3><p>Foto, próxima fecha y un abrazo desde el escritorio.</p></div><span class="badge '+(native.canPinWidget?'good':'')+'">'+(native.canPinWidget?'Disponible':'Manual')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="widget-add">Añadir widget</button><button class="btn small secondary" data-action="widget-photo">Elegir foto</button><button class="btn small ghost" data-action="widget-photo-clear">Quitar foto</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Notificaciones de momentos</h3><p>Gestos y fechas especiales. Android revisa en segundo plano y también al abrir la app.</p></div><span class="badge '+(native.momentNotifications&&native.notificationsGranted&&native.notificationsEnabled?'good':'')+'">'+(native.momentNotifications?(native.notificationsGranted&&native.notificationsEnabled?'Listas':'Requieren ajuste'):'Pausadas')+'</span></div><div class="notification-health"><span class="'+(native.notificationsGranted?'good':'')+'">'+ico(native.notificationsGranted?'check':'circle-alert')+' Permiso '+(native.notificationsGranted?'concedido':'pendiente')+'</span><span class="'+(native.notificationsEnabled?'good':'')+'">'+ico(native.notificationsEnabled?'bell-ring':'bell-off')+' Sistema '+(native.notificationsEnabled?'habilitado':'bloqueado')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small secondary" data-action="moment-notifications">'+(native.momentNotifications?'Desactivar':'Activar')+'</button>'+(native.momentNotifications?'<button class="btn small ghost" data-action="moment-notification-test">'+ico('bell-ring')+' Probar ahora</button>':'')+(!native.notificationsEnabled?'<button class="btn small ghost" data-action="app-settings">'+ico('settings')+' Ajustes</button>':'')+'</div></div>'+
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
function closeModal(){if(modal.dataset.form==='voice'&&pendingVoiceDraft!==null)resetVoiceDraft();if(modal.open)modal.close();delete modal.dataset.editId;delete modal.dataset.version;delete modal.dataset.kind;delete modal.dataset.form;}
function openItemForm(kind,item){
 const d=item?.data||{},meta=kindMeta[kind]||['sparkles','Contenido'],editing=!!item?.id,places=mapData?.places||[];
 modal.dataset.editId=item?.id||'';modal.dataset.version=item?.version||'';modal.dataset.kind=kind;
 const needsDate=['memory','event','capsule','journey'].includes(kind),canPlace=['memory','journey','event'].includes(kind);
 const placeField=canPlace?(places.length?'<div class="field"><label>Lugar de nuestra historia (opcional)</label><select name="placeId"><option value="">Sin lugar</option>'+places.map(p=>'<option value="'+p.id+'" '+(Number(d.placeId)===Number(p.id)?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>':(d.placeId?'<input type="hidden" name="placeId" value="'+attr(d.placeId)+'">':'')):'';
 const body='<form id="itemForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" value="'+attr(d.title||'')+'" required maxlength="160"></div><div class="field"><label>Texto</label><textarea name="body" placeholder="Escribe aquí…">'+esc(d.body||'')+'</textarea></div>'+
 (needsDate?'<div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="'+attr(d.date||'')+'"></div>':'')+
 '<div class="field"><label>Categoría</label><input class="input" name="category" value="'+attr(d.category||'')+'" placeholder="'+attr(meta[1])+'"></div>'+placeField+
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
 const partner=cloud.person==='0'?'1':'0',places=mapData?.places||[],active=(mapData?.destinations||[]).find(d=>String(d.person)===String(cloud.person)&&d.active!==false);
 const current=active?(active.kind==='person'?'person:'+active.target_person:'place:'+active.place_id):'none';
 showModal('Acompáñame','<form id="destinationForm" class="stack" style="margin-top:16px"><div class="field"><label>Voy hacia</label><select name="destination"><option value="person:'+partner+'" '+(current==='person:'+partner?'selected':'')+'>'+esc(partnerName())+'</option>'+places.map(p=>'<option value="place:'+p.id+'" '+(current==='place:'+p.id?'selected':'')+'>'+esc(p.name)+'</option>').join('')+'<option value="none" '+(current==='none'?'selected':'')+'>Ningún destino</option></select></div><p class="muted">El ETA se actualizará con tu ubicación y forma de moverte.</p><button class="btn" type="submit">Guardar destino</button></form>','destination');
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
 return '<div class="ai-answer"><span class="badge">Nuestra historia</span><h3>'+esc(result.title)+'</h3><p>'+esc(result.body)+'</p>'+(result.matches?.length?'<div class="stack compact">'+result.matches.map(m=>'<div class="ai-match"><b>'+esc(m.title||'Momento')+'</b><small>'+esc(m.body||m.date||'')+'</small></div>').join('')+'</div>':'')+'</div>';
}
function openOurAI(){
 showModal('Nuestra IA','<div class="ai-intro"><p>Busca dentro de lo que ustedes han guardado. Nada de esta función sale a un servicio de IA externo.</p><div class="chips"><button class="chip" data-action="ai-question" data-question="¿Cuántos días llevamos juntos?">Días juntos</button><button class="chip" data-action="ai-question" data-question="¿Qué planes tenemos pendientes?">Planes</button><button class="chip" data-action="ai-question" data-question="¿Qué lugares hemos guardado?">Lugares</button><button class="chip" data-action="ai-question" data-question="Muéstrame nuestros viajes">Viajes</button></div></div><form id="ourAiForm" class="stack" style="margin-top:14px"><div class="field"><label>Pregunta</label><input class="input" name="question" placeholder="Ej. ¿qué recuerdos tenemos de Útica?" required></div><button class="btn" type="submit">'+ico('sparkles')+' Buscar en nuestra historia</button></form><div data-role="ai-result" style="margin-top:14px">'+aiResultMarkup(aiResult(''))+'</div>','our-ai');
}
function showAiAnswer(question){
 const result=aiResult(question),box=modal.querySelector('[data-role="ai-result"]');if(box)box.innerHTML=aiResultMarkup(result);refreshIcons();
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
 if(fd.has('placeId')&&String(fd.get('placeId')||''))data.placeId=Number(fd.get('placeId'));
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
  if(a==='universal-search-open'){openUniversalSearch();return;}
  if(a==='universal-search-result'){await openUniversalSearchResult(btn);return;}
  if(a==='monthly-summary-open'){await openMonthlySummary(btn.dataset.month||String(cloud.today||'').slice(0,7));return;}
  if(a==='monthly-summary-month'){if(!btn.disabled)await openMonthlySummary(btn.dataset.month);return;}
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
  if(a==='new-game'){openGame();return;}
  if(a==='new-ritual'){openRitual();return;}
  if(a==='ritual-edit'){openRitual(cloud.bond.entries.find(x=>x.id===btn.dataset.id));return;}
  if(a==='new-sharednote'){openSharedNote();return;}
  if(a==='sharednote-edit'){openSharedNote(cloud.bond.entries.find(x=>x.id===btn.dataset.id));return;}
  if(a==='new-voice'){openVoice();return;}
  if(a==='voice-for-item'){openVoice(btn.dataset.id);return;}
  if(a==='anniversary-open'){memoryTab='memory';go('memories');setTimeout(()=>document.querySelector('.constellation')?.scrollIntoView({behavior:'smooth',block:'center'}),80);return;}
  if(a==='constellation-item'){const i=cloud.items.find(x=>x.id===btn.dataset.id);if(i)showModal(i.data?.title||'Recuerdo','<div class="card" style="margin-top:16px"><span class="badge">'+esc(kindMeta[i.kind]?.[1]||'Historia')+'</span><p style="margin-top:10px">'+esc(i.data?.body||fmtDate(i.data?.date)||'Parte de nuestra historia.')+'</p>'+(linkedVoices(i.id).length?linkedVoices(i.id).map(voiceCard).join(''):'')+'</div>');return;}
  if(a==='voice-record-start'){voiceResumeMusic=musicPlaying;if(musicPlaying)toggleMusic();await GalaxyNative.call('startVoiceRecording');voiceRecording=true;voiceReady=false;startVoiceTimer();modal.querySelector('[data-role="voice-status"]').textContent='Grabando… 0 s / 60 s';btn.hidden=true;modal.querySelector('[data-action="voice-record-stop"]').hidden=false;return;}
  if(a==='voice-record-stop'){const info=await GalaxyNative.call('stopVoiceRecording');stopVoiceTimer();voiceRecording=false;voiceReady=true;modal.querySelector('[data-role="voice-status"]').textContent='Grabación lista · '+Math.max(1,Math.round((info.durationMs||0)/1000))+' s. Escúchala antes de guardar.';btn.hidden=true;modal.querySelector('[data-action="voice-record-start"]').hidden=false;modal.querySelector('[data-action="voice-preview"]').hidden=false;modal.querySelector('[data-action="voice-discard"]').hidden=false;if(voiceResumeMusic){toggleMusic();voiceResumeMusic=false;}return;}
  if(a==='voice-preview'){voiceResumeMusic=musicPlaying;if(musicPlaying)toggleMusic();await GalaxyNative.call('playVoiceRecording');return;}
  if(a==='voice-discard'){stopVoiceTimer();await GalaxyNative.call('discardVoiceRecording');voiceReady=false;voiceRecording=false;modal.querySelector('[data-role="voice-status"]').textContent='Audio descartado. Puedes grabarlo otra vez.';modal.querySelector('[data-action="voice-preview"]').hidden=true;btn.hidden=true;modal.querySelector('[data-action="voice-record-start"]').hidden=false;return;}
  if(a==='voice-file'){const form=modal.querySelector('#voiceForm'),fd=new FormData(form);pendingVoiceDraft={title:String(fd.get('title')||''),body:String(fd.get('body')||''),referenceId:String(fd.get('referenceId')||'')};if(!pendingVoiceDraft.title.trim()){toast('Ponle un título al mensaje.');return;}const upload=await GalaxyNative.call('pickMedia','voice');await api('bond-save',{type:'voice',data:{...pendingVoiceDraft,audioPath:upload.path,mime:upload.mime}});pendingVoiceDraft=null;closeModal();await refreshState();toast('Mensaje de voz guardado.');return;}
  if(a==='bond-delete'){await busy(()=>bondDelete(btn.dataset.id));return;}
  if(a==='game-guess'){await busy(async()=>{await api('bond-guess',{id:btn.dataset.id,guess:btn.dataset.guess});await refreshState();},'Respuesta enviada.');return;}
  if(a==='surprise'){openSurprise();return;}
  if(a==='surprise-note-new'){if(!mapData)await refreshMap({quiet:true,detail:false});openSurpriseNote();return;}
  if(a==='surprise-again'){openSurprise();return;}
  if(a==='surprise-save'&&lastSurprise){await busy(async()=>{await api('item-save',{kind:'plan',data:{title:lastSurprise.title,body:lastSurprise.body,category:'Cita sorpresa',done:false}});closeModal();await refreshState();},'Cita guardada en Planes.');return;}
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
  if(a==='ai-question'){const q=btn.dataset.question||'';const input=modal.querySelector('#ourAiForm [name="question"]');if(input)input.value=q;showAiAnswer(q);return;}
  if(a==='backup-export'){const backup=await api('backup-export');await GalaxyNative.call('exportJson','nuestra-galaxia-backup-'+(cloud.today||'copia')+'.json',JSON.stringify(backup));toast('Copia guardada en el teléfono.');return;}
  if(a==='gps-history-export'){await exportGpsHistory();return;}
  if(a==='gps-history-delete-open'){openGpsHistoryDelete();return;}
  if(a==='gps-history-map'){closeModal();go('map');return;}
  if(a==='theme-set'){const state=window.GalaxyTheme?.applyTheme(btn.dataset.value);render();toast(state?.selected==='auto'?'Tema automático · ahora '+window.GalaxyTheme.LABELS[state.active]+'.':'Tema '+window.GalaxyTheme.LABELS[state?.active]+' activado.');return;}
  if(a==='backup-import'){if(!confirm('Restaurar una copia añadirá lo que falte sin borrar lo que ya existe. ¿Continuar?'))return;const file=await GalaxyNative.call('importJson'),backup=JSON.parse(file.json||'{}'),result=await api('backup-import',{backup});await refreshState({quiet:true});await refreshMap({quiet:true,detail:true});render();const r=result.restored||{};toast('Copia restaurada: '+Number(r.items||0)+' contenidos, '+Number(r.places||0)+' lugares y '+Number(r.bond||0)+' momentos.');return;}
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
  if(e.target.id==='ourAiForm'){const q=String(new FormData(e.target).get('question')||'');showAiAnswer(q);return;}
  if(e.target.id==='gpsHistoryDeleteForm'){const value=new FormData(e.target).get('confirmation');if(!window.GalaxyGpsHistory?.validDeleteConfirmation(value))throw new Error('Escribe BORRAR exactamente para confirmar.');const submit=e.target.querySelector('button[type="submit"]');if(submit)submit.disabled=true;await deleteGpsHistory();return;}
  if(e.target.id==='pairForm'){
   const code=new FormData(e.target).get('code');await GalaxyNative.call('pair',String(code));native=nativeState();await refreshState();toast('Teléfono vinculado como '+myName()+'.');return;
  }
  if(e.target.id==='musicUrlForm'){const fd=new FormData(e.target),url=String(fd.get('url')||'').trim(),title=String(fd.get('title')||'').trim(),platform=detectMusicPlatform(url);if(!/^https:\/\//i.test(url))throw new Error('Usa un enlace https válido.');await api('item-save',{kind:'song',data:{title,url,platform}});closeModal();await refreshState();rebuildMusicQueue();renderGlobalPlayer();toast('Canción añadida a Nuestra música.');return;}
  if(e.target.id==='dailyForm'){await saveDaily('answer',new FormData(e.target).get('answer'));toast('Respuesta guardada.');return;}
  if(e.target.id==='itemForm'){await submitItem(e.target);return;}
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
  if(e.target.id==='placeForm'){const fd=new FormData(e.target);await api('place-save',{name:fd.get('name'),kind:fd.get('kind'),note:fd.get('note'),latitude:Number(fd.get('latitude')),longitude:Number(fd.get('longitude'))});closeModal();frequentPlacesLoadedAt=0;await refreshMap();await loadFrequentPlaces(true).catch(()=>{});toast('Lugar guardado.');return;}
  if(e.target.id==='destinationForm'){const value=String(new FormData(e.target).get('destination'));if(value==='none')await api('destination-save',{kind:'none'});else{const [kind,id]=value.split(':');await api('destination-save',kind==='person'?{kind,target_person:id,label:partnerName()}:{kind,place_id:Number(id)});}closeModal();await refreshMap({detail:false});if(view==='map')setTimeout(()=>document.querySelector('#etaCard')?.scrollIntoView({behavior:'smooth',block:'center'}),80);toast(value==='none'?'Destino desactivado.':'Destino actualizado · ETA listo.');return;}
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
