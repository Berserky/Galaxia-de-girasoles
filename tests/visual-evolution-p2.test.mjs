import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const ROOT=resolve(import.meta.dirname,'..');
const mobile=resolve(ROOT,'android/app/src/main/assets/mobile');
const file=name=>readFileSync(resolve(mobile,name),'utf8');
const html=file('index.html'),app=file('app.js'),css=file('galaxy-welcome.css');
const home=app.slice(app.indexOf('function homeView(){'),app.indexOf('function actionCard('));

test('P2A welcome stylesheet loads only in packaged Android after P1',()=>{
 assert.match(html,/href="\.\/celestial-shell\.css"[\s\S]+href="\.\/galaxy-welcome\.css"/);
 assert.doesNotMatch(css,/\.chat-composer\s*\{|\.chat-messages\s*\{|#chatForm|GalaxyNative/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/@media\(min-width:640px\)/);
});

test('P2A keeps existing navigation, dynamic stats and 5 direct actions',()=>{
 assert.ok(home.startsWith('function homeView(){'));
 assert.match(home,/class="galaxy-welcome"/);
 assert.match(home,/coupleDays\(\)/);
 assert.match(home,/items\('memory'\)\.length/);
 assert.match(home,/garden\.days/);
 assert.match(home,/data-view="memories"/);
 assert.match(home,/data-view="moments"/);
 for(const action of ['map','moments','add-memory','add-plan','goals-open'])
  assert.match(home,new RegExp("actionCard\\([^\\n]*'"+action+"'\\)"),'Missing action '+action);
});

test('P2A retains location privacy and state controls without fake live telemetry',()=>{
 for(const part of ['coupleDistanceCard()','nowCard()','locs.map(personCard)','data-action="now-settings"','locationFreshState(l)']){
  assert.ok(app.includes(part),'Required existing source missing: '+part);
 }
 assert.match(home,/welcome-presence-details/);
 assert.match(home,/!cloud\?\.settings\?\.data\?\.startDate|started=!!cloud\?\.settings\?\.data\?\.startDate/);
 assert.match(home,/started\?coupleDays\(\):'—'/);
 assert.doesNotMatch(css,/background-attachment:fixed/);
});

test('P2A preserves mood, daily answer, history, encounters and calendar routing',()=>{
 for(const part of ['monthlySummaryTeaser()','todayHistoryTeaser()','encounterStatsTeaser()','dailyQuestionCard(own,partner)','livingMomentCard()','data-action="mood"'])
  assert.ok(home.includes(part),'Missing existing Home element '+part);
 assert.match(home,/aria-pressed/);
 assert.match(app,/data-action="date-question-memory"/);
 assert.match(app,/data-action="date-question-favorite"/);
 assert.match(app,/data-action="date-question-decks"/);
 assert.match(app,/data-action="galaxy-share"/);
 assert.match(app,/name="answer" rows="2"/);
 assert.match(home,/nextAlreadyFeatured/);
 assert.match(home,/!nextAlreadyFeatured/);
});

test('P2A upcoming event has a visible next-date label in exactly one featured card',()=>{
 assert.match(home,/nextCard=next&&!nextAlreadyFeatured/);
 assert.ok(home.includes("livingMomentCard()"));
 assert.match(app,/m\.label==='SE ACERCA ALGO ESPECIAL'\?'PRÓXIMA FECHA':m\.label/);
 assert.match(app,/function livingMomentCard\(\)/);
 assert.match(app,/esc\(m\.label==='SE ACERCA ALGO ESPECIAL'\?'PRÓXIMA FECHA':m\.label\)/);
 // The original native device regression requires visible text, not just an aria label.
 assert.match(home,/PRÓXIMA FECHA/);
});

const extract=(start,end)=>{
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing function block '+start);
 return app.slice(a,b);
};
const presenceSource=extract('const normalizedPresence=','const ownPresence=');
const freshnessSource=extract('function locationAgeMs(','function staleLocationCopy(');
const nowSource=extract('function nowPersonCard(','function nowCard(');
function renderPartner({location={},presence={}}={}){
 const cloud={
  person:0,today:'2026-10-13',locations:[{person:'1',...location}],
  presence:[{person:'1',...presence}],daily:[],
  settings:{data:{presence:{}}}
 };
 const context={
  cloud,native:{battery:45},todayRows:()=>[],moods:{},
  names:()=>['Ada','Sol'],transportLabel:()=> 'Caminando',
  currentTrackTitle:()=>'',ico:()=>'',esc:v=>String(v),
 };
 return runInNewContext(
  presenceSource+'\n'+freshnessSource+'\n'+nowSource+'\nnowPersonCard("1",false)',
  context
 );
}

test('P2B rejects stale GPS movement, uses real presence and describes last reading',()=>{
 const html=renderPartner({
  location:{sharing:true,latitude:4.6,longitude:-74.1,speed:5,updated_at:new Date(Date.now()-30*60000).toISOString()},
  presence:{share_battery:true,share_song:true,battery:77,song_title:'Nuestra canción'}
 });
 assert.match(html,/Ubicación sin actualizar · hace 30 min/);
 assert.doesNotMatch(html,/Caminando|18(?:\.0)? km\/h/);
 assert.match(html,/77%/);
 assert.match(html,/Nuestra canción/);
});

test('P2B never fabricates zero speed, even with fresh shared coordinates',()=>{
 const html=renderPartner({location:{sharing:true,latitude:4.6,longitude:-74.1,speed:null,updated_at:new Date().toISOString()}});
 assert.match(html,/Caminando/);
 assert.doesNotMatch(html,/0(?:\.0)? km\/h/);
});

test('P2B paused GPS cannot masquerade as live and respects media privacy',()=>{
 const html=renderPartner({
  location:{sharing:false,speed:8,updated_at:new Date().toISOString()},
  presence:{share_battery:false,share_song:false,battery:77,song_title:'Privado'}
 });
 assert.match(html,/Ubicación pausada/);
 assert.doesNotMatch(html,/Caminando|km\/h|77%|Privado|Ubicación sin actualizar/);
});

test('P2B mood options remain tappable and readable on narrow screens',()=>{
 assert.match(css,/\.welcome-mood-section \.mood-grid \{[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/\.welcome-mood-section \.mood \{[\s\S]*?min-height:56px/);
 assert.match(css,/\.welcome-mood-section \.mood:focus-visible/);
 assert.match(css,/@media\(min-width:540px\)/);
 assert.match(home,/aria-pressed/);
});


const dailyAnswerSource=extract('function dailyAnswerMarkup(', 'function dailyQuestionCard(');
const dailyQuestionSource=extract('function dailyQuestionCard(', 'function personCard(');
function renderDaily(own={},partner={},favorite=false){
 const context={
  dateContext:{question:{favorite}},cloud:{today:'2026-10-13'},
  dailyQuestion:()=> '¿Qué te hizo sonreír hoy?',ico:()=>'',esc:v=>String(v),attr:v=>String(v),
  myName:()=> 'Yo',partnerName:()=> 'Mi persona',own,partner
 };
 return runInNewContext(dailyAnswerSource+'\n'+dailyQuestionSource+'\ndailyQuestionCard(own,partner)',context);
}

test('P2C daily progress reflects 0, 1 and 2 actual answers, without adding server calls',()=>{
 const zero=renderDaily(),one=renderDaily({answer:'Guardada'}),both=renderDaily({answer:'Guardada'},{answer:'En privado'});
 assert.match(zero,/0 de 2 respuestas listas/);
 assert.match(one,/1 de 2 respuestas listas/);
 assert.match(both,/2 de 2 respuestas listas/);
 assert.match(one,/role="status" aria-label="1 de 2 respuestas registradas"/);
 assert.match(one,/date-question-privacy/);
 assert.doesNotMatch(one,/En privado/);
 assert.doesNotMatch(both,/date-question-privacy/);
 assert.match(both,/En privado/);
 for(const html of [zero,one,both]){
  for(const a of ['galaxy-share','date-question-decks','date-question-memory','date-question-favorite'])
   assert.ok(html.includes('data-action="'+a+'"'),'Missing existing action '+a);
 }
});

test('P2C daily actions have touch targets and responsive layout without sharing answer text',()=>{
 assert.match(css,/V5 P2C: daily question and actions/);
 assert.match(css,/date-question-actions > \.btn \{[\s\S]*?min-width:0;min-height:44px/);
 assert.match(css,/date-question-privacy \{[\s\S]*?font-size:12px/);
 assert.match(css,/date-question-progress \{[\s\S]*?font-size:12px/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(min-width:540px\)/);
 const one=renderDaily({answer:'texto exclusivo'});
 assert.match(one,/data-card-type="DAILY_QUESTION"/);
 assert.doesNotMatch(one,/data-title="texto exclusivo"/);
});


test('P2B missing coordinates and future timestamps are never presented as live GPS',()=>{
 const missing=renderPartner({location:{sharing:true,latitude:null,longitude:null,speed:4,updated_at:new Date().toISOString()}});
 assert.match(missing,/Ubicación sin actualizar/);
 assert.doesNotMatch(missing,/Caminando|km\/h/);
 const future=renderPartner({location:{sharing:true,latitude:4.6,longitude:-74.1,speed:4,updated_at:new Date(Date.now()+24*3600_000).toISOString()}});
 assert.match(future,/Ubicación sin actualizar · hora del dispositivo por verificar/);
 assert.doesNotMatch(future,/Caminando|km\/h/);
});


const detailSource=extract('function personCard(','function transportLabel(');
function renderLocationDetail(location){
 const context={
  l:{person:'1',...location},cloud:{person:'0'},
  names:()=>['Ada','Sol'],transportLabel:()=> 'Caminando',
  esc:v=>String(v),ico:()=>'',attr:v=>String(v)
 };
 return runInNewContext(freshnessSource+'\n'+detailSource+'\npersonCard(l)',context);
}

test('P2E detailed GPS card does not fabricate 0 km/h when speed is missing or invalid',()=>{
 const fix={sharing:true,latitude:4.6,longitude:-74.1,updated_at:new Date().toISOString()};
 for(const speed of [null,undefined,'unknown',-4]){
  const markup=renderLocationDetail({...fix,speed});
  assert.match(markup,/aria-label="Velocidad sin lectura">—<small>km\/h<\/small>/);
  assert.doesNotMatch(markup,/>0(?:\.0)?<small>km\/h/);
 }
 const measured=renderLocationDetail({...fix,speed:2});
 assert.match(measured,/>7\.2<small>km\/h<\/small>/);
 assert.doesNotMatch(measured,/Velocidad sin lectura/);
 const measuredZero=renderLocationDetail({...fix,speed:0});
 assert.match(measuredZero,/>0\.0<small>km\/h<\/small>/);
});

test('P2E detailed GPS card refuses future/missing/stale/paused positions as live',()=>{
 const time=new Date().toISOString();
 const base={sharing:true,latitude:4.6,longitude:-74.1,speed:5,updated_at:time};
 const missing=renderLocationDetail({...base,latitude:null,longitude:null});
 assert.match(missing,/Sin lectura GPS reciente/);
 assert.doesNotMatch(missing,/Caminando|>18<small>km\/h/);
 const future=renderLocationDetail({...base,updated_at:new Date(Date.now()+24*3600_000).toISOString()});
 assert.match(future,/Hora del dispositivo por verificar/);
 assert.doesNotMatch(future,/Caminando|>18<small>km\/h/);
 const stale=renderLocationDetail({...base,updated_at:new Date(Date.now()-30*60000).toISOString()});
 assert.match(stale,/Sin actualizar/);
 assert.doesNotMatch(stale,/Caminando|>18<small>km\/h/);
 const paused=renderLocationDetail({...base,sharing:false});
 assert.match(paused,/Ubicación pausada/);
 assert.doesNotMatch(paused,/Caminando|>18<small>km\/h/);
});

test('P2G Android screenshot gate checks real bottom pixels, not only DOM scrollY',()=>{
 const android=readFileSync(resolve(ROOT,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 assert.match(android,/android\.graphics\.Bitmap topFrame=instrumentation\.getUiAutomation\(\)\.takeScreenshot\(\)/);
 assert.match(android,/awaitV5BottomFramePainted\(topFrame,targetCss\)/);
 assert.match(android,/realDisplayChange/);
 assert.match(android,/P2 bottom screenshot rejected: Android display never painted/);
 assert.match(android,/changedPixelRatio/);
 assert.match(android,/latest>=0\.15d/);
 assert.match(android,/if\(\+\+consecutive>=2\)/);
 assert.match(android,/topFrame\.recycle\(\)/);
 assert.ok(android.indexOf('awaitV5BottomFramePainted(topFrame,targetCss)')<
   android.indexOf('shell("screencap -p /sdcard/Download/V5-P2-bottom-"'),
   'Screenshot must not be saved until real display evidence is visible');
});


const bentoSource=extract('function welcomeActionContext(','function insightsTeaser(');
function renderWelcomeShortcut(action,{data=[],days=null,goals=null,goalsAgeMs=0}={}){
 const context={
  cloud:{items:data,bond:{garden:{days}}},goalsState:goals,
  goalsLoadedAt:Date.now()-goalsAgeMs,
  items:kind=>data.filter(i=>i.kind===kind),ico:()=>'',esc:v=>String(v)
 };
 return runInNewContext(
  bentoSource+'\n'+'actionCard("target","Nuestros objetivos","Metas, pasos y ahorro manual",'+JSON.stringify(action)+')',
  context
 );
}

test('P2K real-data shortcut groups keep all five actions and touch/focus access',()=>{
 const categories={
  map:'EXPLORAR',moments:'CONECTAR','add-memory':'CREAR',
  'add-plan':'PLANEAR','goals-open':'AVANZAR'
 };
 for(const [action,category] of Object.entries(categories)){
  const markup=renderWelcomeShortcut(action);
  assert.match(markup,new RegExp('data-action="'+action+'"'));
  assert.match(markup,new RegExp('welcome-action-kicker">'+category+'<'));
  assert.doesNotMatch(markup,/welcome-action-meta/);
 }
 assert.match(css,/welcome-action-kicker/);
 assert.match(css,/welcome-action-meta/);
 assert.match(css,/welcome-bento \.action-card:focus-visible/);
 assert.doesNotMatch(bentoSource,/\b(?:fetch|api|GalaxyNative\.call)\s*\(/);
});

test('P2K only shows real nonzero plans/memories/relationship metrics already loaded',()=>{
 const entries=[
  {kind:'plan',data:{title:'Privado',done:false}},
  {kind:'plan',data:{title:'Terminado',done:true}},
  {kind:'memory',data:{title:'Mi recuerdo'}},
 ];
 const plan=renderWelcomeShortcut('add-plan',{data:entries});
 assert.match(plan,/1 plan pendiente/);
 assert.doesNotMatch(plan,/Privado|Terminado|Mi recuerdo/);
 const memory=renderWelcomeShortcut('add-memory',{data:entries});
 assert.match(memory,/1 recuerdo guardado/);
 const moments=renderWelcomeShortcut('moments',{days:12});
 assert.match(moments,/12 días compartidos/);
 assert.doesNotMatch(renderWelcomeShortcut('moments',{days:0}),/welcome-action-meta/);
 assert.doesNotMatch(renderWelcomeShortcut('moments',{days:-1}),/welcome-action-meta/);
 const many=renderWelcomeShortcut('add-plan',{data:[
  {kind:'plan',data:{}},{kind:'plan',data:{done:false}}
 ]});
 assert.match(many,/2 planes pendientes/);
});

test('P2K goals summary never invents unavailable or stale goals data',()=>{
 const goals={goals:[{status:'active',title:'Privado'},{status:'paused'},{status:'completed'}]};
 assert.doesNotMatch(renderWelcomeShortcut('goals-open'),/welcome-action-meta/);
 const fresh=renderWelcomeShortcut('goals-open',{goals,goalsAgeMs:5_000});
 assert.match(fresh,/2 objetivos en marcha/);
 assert.doesNotMatch(fresh,/Privado|completed/);
 assert.doesNotMatch(renderWelcomeShortcut('goals-open',{goals,goalsAgeMs:200_000}),/welcome-action-meta/);
 assert.doesNotMatch(renderWelcomeShortcut('goals-open',{goals:{goals:[]}}),/welcome-action-meta/);
});


const privacyDeepLinkSource=extract('function openPresencePrivacySettings(){',"let nativeThemeSent='';");

test('P2L privacy CTA synchronously navigates to the visible real settings panel and focuses it',()=>{
 const calls=[],panel={
  scrollIntoView:options=>calls.push(['scroll',options]),
  focus:options=>calls.push(['focus',options])
 };
 const context={
  go:view=>{calls.push(['go',view]);assert.equal(view,'more');},
  document:{getElementById:id=>{
   calls.push(['lookup',id]);assert.equal(id,'presencePrivacySettings');return panel;
  }}
 };
 runInNewContext(privacyDeepLinkSource+'\nopenPresencePrivacySettings();',context);
 assert.deepEqual(calls[0],['go','more']);
 assert.deepEqual(calls[1],['lookup','presencePrivacySettings']);
 assert.equal(calls[2][0],'scroll');
 assert.equal(calls[2][1].block,'center');
 assert.equal(calls[3][0],'focus');
 assert.equal(calls[3][1].preventScroll,true);
 assert.match(app,/if\(a==='now-settings'\)\{openPresencePrivacySettings\(\);return;\}/);
});

test('P2L privacy focus gracefully handles an unavailable panel without side effects or timeouts',()=>{
 const calls=[];
 runInNewContext(privacyDeepLinkSource+'\nopenPresencePrivacySettings();',{
  go:view=>calls.push(view),
  document:{getElementById:()=>null}
 });
 assert.deepEqual(calls,['more']);
 assert.doesNotMatch(privacyDeepLinkSource,/setTimeout|setInterval|\bapi\s*\(|GalaxyNative\.call/);
 assert.match(app,/id="presencePrivacySettings" class="card presence-privacy-settings"/);
 assert.match(app,/aria-labelledby="presencePrivacyHeading" tabindex="-1"/);
 assert.match(app,/id="presencePrivacyHeading">Privacidad de/);
 assert.match(css,/\.presence-privacy-settings:focus \{/);
 assert.match(css,/scroll-margin-block:88px/);
 // The home control and the real privacy toggles retain their original actions.
 assert.match(app,/data-action="now-settings"/);
 for(const action of ['presence-battery','presence-listening','map'])
  assert.ok(app.includes('data-action="'+action+'"'),'Privacy control unavailable '+action);
});


test('P2M personal answer readiness is correct for 0/1/2 responses and never embeds their text',()=>{
 const examples=[
  {own:{},partner:{},count:0,me:'Pendiente',other:'Pendiente'},
  {own:{answer:'ALPHA_CONFIDENTIAL'},partner:{},count:1,me:'Lista',other:'Pendiente'},
  {own:{},partner:{answer:'BETA_CONFIDENTIAL'},count:1,me:'Pendiente',other:'Lista'},
  {own:{answer:'ALPHA_CONFIDENTIAL'},partner:{answer:'BETA_CONFIDENTIAL'},count:2,me:'Lista',other:'Lista'},
 ];
 for(const x of examples){
  const html=renderDaily(x.own,x.partner);
  assert.match(html,new RegExp(x.count+' de 2 respuestas listas'));
  const badges=html.split('<div class="date-question-person-status"')[1]?.split('</div>')[0]||'';
  assert.match(badges,/role="group" aria-label="Quién ha respondido"/);
  assert.match(badges,new RegExp('aria-label="Tu respuesta: '+x.me.toLowerCase()+'"'));
  assert.match(badges,new RegExp('aria-label="La otra respuesta: '+x.other.toLowerCase()+'"'));
  assert.equal((badges.match(/class="date-question-person /g)||[]).length,2);
  assert.doesNotMatch(badges,/ALPHA_CONFIDENTIAL|BETA_CONFIDENTIAL/);
  assert.match(html,/aria-pressed="false"/);
  assert.equal(html.includes('data-action="date-question-memory" disabled'),x.count<2);
 }
 assert.doesNotMatch(dailyQuestionSource,/\b(?:api|fetch|saveDaily)\s*\(/);
});

test('P2M favorite state has accessible pressed semantics and unchanged existing actions',()=>{
 const favorite=renderDaily({}, {}, true);
 const normal=renderDaily({}, {}, false);
 assert.match(favorite,/data-action="date-question-favorite" aria-pressed="true" aria-label="Quitar de favoritas"/);
 assert.match(normal,/data-action="date-question-favorite" aria-pressed="false" aria-label="Marcar como favorita"/);
 assert.match(css,/V5 P2M: explicit individual answer readiness/);
 assert.match(css,/date-question-person-status \{[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/date-question-person \{[\s\S]*?min-height:44px/);
 assert.match(css,/\.date-question-card \.icon-btn\[aria-pressed="true"\]/);
 for(const action of ['galaxy-share','date-question-decks','date-question-memory']){
  assert.match(favorite,new RegExp('data-action="'+action+'"'));
  assert.match(normal,new RegExp('data-action="'+action+'"'));
 }
});
