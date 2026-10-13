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
function renderDaily(own={},partner={}){
 const context={
  dateContext:{question:{}},cloud:{today:'2026-10-13'},
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
