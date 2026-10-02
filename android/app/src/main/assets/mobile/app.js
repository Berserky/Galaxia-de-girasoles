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
let toastTimer,refreshing=false,updateState={text:'La app está al día.',progress:0,busy:false},pendingVoiceDraft=null,lastSurprise=null;
let welcomeStep=0,welcomePreview=false,welcomeGift=true,welcomeEntering=false,tourStep=-1;
const welcomeMusic=new Audio('../musica.mp3');welcomeMusic.loop=true;welcomeMusic.volume=.32;
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
const dailyQuestion=()=>{const d=cloud?.today||new Date().toISOString().slice(0,10);let n=0;for(const c of d)n+=c.charCodeAt(0);return dailyQuestions[n%dailyQuestions.length];};
const currentMonday=()=>{const d=new Date((cloud?.today||new Date().toISOString().slice(0,10))+'T12:00:00');const day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d.toISOString().slice(0,10);};
const coupleDays=()=>{const s=cloud?.settings?.data?.startDate;if(!s)return 0;return Math.max(0,Math.floor((Date.parse((cloud?.today||s)+'T12:00:00Z')-Date.parse(s+'T12:00:00Z'))/86400000));};

async function refreshState({quiet=false}={}){
 if(!native.paired||refreshing)return;
 refreshing=true;
 try{cloud=await api('mobile-state');native=nativeState();if(!quiet)render();}
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
 if(shouldShowAdriWelcome()){renderAdriWelcome();refreshIcons();return;}
 if(!cloud){app.innerHTML=header()+loading('Cargando nuestra galaxia');refreshIcons();refreshState();return;}
 if(view==='home')app.innerHTML=header()+homeView();
 if(view==='map'){app.innerHTML=header()+mapView();setTimeout(()=>{drawMap();if(!mapData)refreshMap({detail:true});},0);}
 if(view==='moments')app.innerHTML=header()+momentsView();
 if(view==='memories'){app.innerHTML=header()+memoriesView();if((memoryTab==='album'&&!mediaFresh('photo'))||(memoryTab==='music'&&!mediaFresh('music')))setTimeout(()=>loadMedia(memoryTab==='album'?'photo':'music').catch(e=>toast(e.message)),0);}
 if(view==='more')app.innerHTML=header()+moreView();
 refreshIcons();
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
 return '<section class="hero"><p class="eyebrow">NUESTRO UNIVERSO</p><h1>'+esc(myName())+' & '+esc(partnerName())+'</h1><p>Un lugar para acompañarnos, guardar lo vivido y seguir construyendo lo que viene.</p><div class="hero-stats"><div class="hero-stat"><b>'+coupleDays()+'</b><small>días juntos</small></div><div class="hero-stat"><b>'+items('memory').length+'</b><small>recuerdos</small></div><div class="hero-stat"><b>'+garden.days+'</b><small>días del girasol</small></div></div></section>'+
 '<section class="section"><div class="section-head"><div><h2>¿Cómo estás hoy?</h2><p>Tu estado se comparte solo con tu persona.</p></div></div><div class="mood-grid">'+Object.entries(moods).map(([id,m])=>'<button class="mood '+(own.mood===id?'active':'')+'" data-action="mood" data-value="'+id+'"><span>'+ico(m[0])+'</span>'+m[1]+'</button>').join('')+'</div>'+(partner.mood?'<div class="card" style="margin-top:10px"><span class="badge">'+esc(partnerName())+'</span> <b>'+esc(moods[partner.mood]?.[1]||partner.mood)+'</b></div>':'')+'</section>'+
 '<section class="section"><div class="card"><p class="eyebrow">PREGUNTA DEL DÍA</p><h3>'+esc(dailyQuestion())+'</h3>'+dailyAnswerMarkup(own,partner)+'</div></section>'+
 '<section class="section"><div class="grid">'+
 actionCard('map-pin','Nuestro mapa','Ver dónde estamos y nuestros recorridos','map')+
 actionCard('heart','Enviar un gesto','Abrazo, beso o “te extraño”','moments')+
 actionCard('images','Guardar recuerdo','Algo que no queremos olvidar','add-memory')+
 actionCard('circle-check-big','Nuevo plan','Algo para hacer juntos','add-plan')+
 '</div></section>'+
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
 return '<section><div class="section-head"><div><p class="eyebrow">LO QUE SOMOS</p><h2>Nuestros recuerdos</h2><p>Todo lo que vamos guardando juntos.</p></div></div><div class="chips">'+tabs.map(([id,label])=>'<button class="chip '+(memoryTab===id?'active':'')+'" data-tab="'+id+'">'+label+'</button>').join('')+'</div>'+body+'</section>';
}
function itemList(kind){
 const list=items(kind),meta=kindMeta[kind]||['sparkles','Contenido'];
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">'+meta[1]+'</h3><small class="muted">'+list.length+' guardados</small></div><button class="btn small" data-action="item-new" data-kind="'+kind+'">+ Añadir</button></div><div class="'+(kind==='memory'||kind==='journey'?'timeline':'stack')+'" style="margin-top:12px">'+(list.length?list.map(itemCard).join(''):'<div class="empty"><span class="big">'+ico(meta[0])+'</span>Aquí aparecerá lo que vayan guardando.</div>')+'</div></div>';
}
function itemCard(i){
 const d=i.data||{},meta=kindMeta[i.kind]||['sparkles',i.kind],date=d.date?fmtDate(d.date):fmtDateTime(i.created),done=d.done?' · Hecho':'';
 return '<div class="card item"><div class="item-icon">'+ico(meta[0])+'</div><div class="item-main"><div class="meta">'+esc(date)+esc(done)+'</div><h3>'+esc(d.title||meta[1])+'</h3>'+(d.body?'<p>'+esc(d.body)+'</p>':'')+'<div class="item-actions"><button class="btn small secondary" data-action="item-edit" data-id="'+i.id+'">Editar</button><button class="btn small ghost" data-action="item-delete" data-id="'+i.id+'">Eliminar</button></div></div></div>';
}
function albumView(){
 const list=media.photo;
 if(!list)return loading('Cargando álbum');
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">Nuestro álbum</h3><small class="muted">'+list.length+' fotos privadas</small></div><button class="btn small" data-action="media-add" data-kind="photo">+ Foto</button></div>'+(list.length?'<div class="gallery" style="margin-top:12px">'+list.map(x=>'<div class="photo"><img loading="lazy" src="'+attr(x.url)+'" alt="Foto de nuestro álbum"><button data-action="media-delete" data-kind="photo" data-path="'+attr(x.path)+'" aria-label="Eliminar foto">'+ico('trash-2')+'</button></div>').join('')+'</div>':'<div class="empty"><span class="big">'+ico('camera')+'</span>Añade la primera foto desde tu teléfono.</div>')+'</div>';
}
function musicView(){
 const list=media.music;
 if(!list)return loading('Cargando música');
 return '<div class="section"><div class="row between"><div><h3 style="margin:0">Nuestra música</h3><small class="muted">'+list.length+' canciones</small></div><button class="btn small" data-action="media-add" data-kind="music">+ MP3</button></div><div class="stack" style="margin-top:12px">'+(list.length?list.map((x,n)=>'<div class="card audio-card"><div class="row between"><div><b>'+(esc(x.originalName||x.name||('Canción '+(n+1))))+'</b><p>'+esc(fmtDateTime(x.created))+'</p></div><button class="btn small ghost" data-action="media-delete" data-kind="music" data-path="'+attr(x.path)+'">Eliminar</button></div><audio controls preload="none" src="'+attr(x.url)+'"></audio></div>').join(''):'<div class="empty"><span class="big">'+ico('music')+'</span>Sube una canción que sea parte de su historia.</div>')+'</div></div>';
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
 const trips=mapData.trips||[],events=mapData.events||[],encounters=mapData.encounters||[];
 return '<section class="section"><div class="section-head"><div><h2>Actividad reciente</h2><p>Recorridos, llegadas y encuentros.</p></div></div><div class="stack">'+
 (trips.slice(0,4).map(t=>'<div class="card"><span class="badge">'+(names()[Number(t.person)]||'Nosotros')+'</span><h3 style="margin-top:8px">'+fmtDistance(t.distance_m)+' · '+fmtDuration(t.duration_s)+'</h3><p>'+esc(fmtDateTime(t.started_at))+(t.max_speed?' · máx. '+(Number(t.max_speed)*3.6).toFixed(0)+' km/h':'')+'</p></div>').join('')||
 events.slice(0,4).map(e=>'<div class="card"><h3>'+(e.event==='arrived'?'Llegada':'Salida')+'</h3><p>'+esc(fmtDateTime(e.happened_at))+'</p></div>').join('')||
 encounters.slice(0,3).map(e=>'<div class="card"><h3 class="icon-title">'+ico('heart')+'Nos encontramos</h3><p>'+esc(fmtDateTime(e.started_at))+'</p></div>').join('')||
 '<div class="empty">Aquí aparecerán los recorridos y encuentros que vayamos guardando.</div>')+
 '</div></section>';
}

function moreView(){
 const settings=cloud.settings||{data:{},version:1},data=settings.data||{};
 return '<section><div class="section-head"><div><p class="eyebrow">NUESTRA APP</p><h2>Más</h2><p>Widget, ajustes, permisos y actualización.</p></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Widget “Nuestra Galaxia”</h3><p>Foto, próxima fecha y un abrazo desde el escritorio.</p></div><span class="badge '+(native.canPinWidget?'good':'')+'">'+(native.canPinWidget?'Disponible':'Manual')+'</span></div><div class="row wrap" style="margin-top:14px"><button class="btn small" data-action="widget-add">Añadir widget</button><button class="btn small secondary" data-action="widget-photo">Elegir foto</button><button class="btn small ghost" data-action="widget-photo-clear">Quitar foto</button></div></div>'+
 '<div class="card"><div class="row between"><div><h3>Notificaciones de momentos</h3><p>Gestos y fechas especiales, sin depender del GPS.</p></div><span class="badge '+(native.momentNotifications?'good':'')+'">'+(native.momentNotifications?'Activas':'Pausadas')+'</span></div><button class="btn small secondary" style="margin-top:14px" data-action="moment-notifications">'+(native.momentNotifications?'Desactivar':'Activar')+'</button></div>'+
 '<div class="card"><h3>Nuestros datos</h3><form id="settingsForm" class="stack" style="margin-top:12px"><div class="grid"><div class="field"><label>Nombre 1</label><input class="input" name="name0" value="'+attr(data.names?.[0]||'')+'" required></div><div class="field"><label>Nombre 2</label><input class="input" name="name1" value="'+attr(data.names?.[1]||'')+'" required></div></div><div class="field"><label>Inicio de nuestra historia</label><input class="input" type="date" name="startDate" value="'+attr(data.startDate||'')+'"></div><div class="field"><label>Álbum de Google Fotos (opcional)</label><input class="input" name="albumUrl" value="'+attr(data.albumUrl||'')+'" placeholder="https://photos.app.goo.gl/…"></div><button class="btn" type="submit">Guardar ajustes</button></form></div>'+
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
   map.addMarker({lat:p.latitude,lon:p.longitude,icon:markerIcon,className:'place',popup:p.name+(p.note?' · '+p.note:'')});
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
function closeModal(){if(modal.open)modal.close();delete modal.dataset.editId;delete modal.dataset.version;delete modal.dataset.kind;delete modal.dataset.form;}
function openItemForm(kind,item){
 const d=item?.data||{},meta=kindMeta[kind]||['sparkles','Contenido'];
 modal.dataset.editId=item?.id||'';modal.dataset.version=item?.version||'';modal.dataset.kind=kind;
 const needsDate=['memory','event','capsule','journey'].includes(kind);
 const body='<form id="itemForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" value="'+attr(d.title||'')+'" required maxlength="160"></div><div class="field"><label>Texto</label><textarea name="body" placeholder="Escribe aquí…">'+esc(d.body||'')+'</textarea></div>'+
 (needsDate?'<div class="field"><label>Fecha</label><input class="input" type="date" name="date" value="'+attr(d.date||'')+'"></div>':'')+
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
function openVoice(){
 const refs=(cloud.items||[]).filter(i=>['memory','song','capsule'].includes(i.kind)&&!(i.kind==='capsule'&&String(i.data?.date||'')>cloud.today));
 showModal('Mensaje de voz','<form id="voiceForm" class="stack" style="margin-top:16px"><div class="field"><label>Título</label><input class="input" name="title" placeholder="Te pienso…" required></div><div class="field"><label>Dedicatoria</label><textarea name="body" placeholder="Unas palabras antes del audio…"></textarea></div><div class="field"><label>Relacionar con un recuerdo (opcional)</label><select name="referenceId"><option value="">Sin referencia</option>'+refs.map(i=>'<option value="'+i.id+'">'+esc(i.data?.title||'Recuerdo')+'</option>').join('')+'</select></div><button class="btn" type="submit">Elegir o grabar audio</button></form>','voice');
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
  if(a==='bond-delete'){await busy(()=>bondDelete(btn.dataset.id));return;}
  if(a==='game-guess'){await busy(async()=>{await api('bond-guess',{id:btn.dataset.id,guess:btn.dataset.guess});await refreshState();},'Respuesta enviada.');return;}
  if(a==='surprise'){openSurprise();return;}
  if(a==='surprise-again'){openSurprise();return;}
  if(a==='surprise-save'&&lastSurprise){await busy(async()=>{await api('item-save',{kind:'plan',data:{title:lastSurprise.title,body:lastSurprise.body,category:'Cita sorpresa',done:false}});closeModal();await refreshState();},'Cita guardada en Planes.');return;}
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
  if(e.target.id==='dailyForm'){await saveDaily('answer',new FormData(e.target).get('answer'));toast('Respuesta guardada.');return;}
  if(e.target.id==='itemForm'){await submitItem(e.target);return;}
  if(e.target.id==='gameForm'){const fd=new FormData(e.target);await api('bond-save',{type:'game',data:{questionId:fd.get('questionId'),answer:fd.get('answer')}});closeModal();await refreshState();toast('Pregunta guardada.');return;}
  if(e.target.id==='ritualForm'){const fd=new FormData(e.target),data={week:fd.get('week'),gratitude:fd.get('gratitude'),need:fd.get('need'),plan:fd.get('plan')},id=modal.dataset.editId,version=Number(modal.dataset.version||0);if(id)await api('bond-update',{id,version,data});else await api('bond-save',{type:'ritual',data});closeModal();await refreshState();toast('Ritual guardado.');return;}
  if(e.target.id==='sharedNoteForm'){const fd=new FormData(e.target),data={title:fd.get('title'),body:fd.get('body')},id=modal.dataset.editId,version=Number(modal.dataset.version||0);if(id)await api('bond-update',{id,version,data});else await api('bond-save',{type:'sharednote',data});closeModal();await refreshState();toast('Nota compartida guardada.');return;}
  if(e.target.id==='voiceForm'){
   const fd=new FormData(e.target);pendingVoiceDraft={title:String(fd.get('title')),body:String(fd.get('body')||''),referenceId:String(fd.get('referenceId')||'')};closeModal();
   const upload=await GalaxyNative.call('pickMedia','voice');
   await api('bond-save',{type:'voice',data:{...pendingVoiceDraft,audioPath:upload.path,mime:upload.mime}});
   pendingVoiceDraft=null;await refreshState();toast('Mensaje de voz guardado.');return;
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
