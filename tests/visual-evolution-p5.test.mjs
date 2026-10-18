import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const assets=resolve(root,'android/app/src/main/assets/mobile');
const load=name=>readFileSync(resolve(assets,name),'utf8');
const app=load('app.js'),html=load('index.html'),css=load('galaxy-moments-v5.css');
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ico=name=>'<span class="ui-icon">'+escape(name)+'</span>';
const extract=(from,to)=>{
 const start=app.indexOf(from),end=app.indexOf(to,start+from.length);
 assert.ok(start>=0&&end>start,from+' must exist before '+to);
 return app.slice(start,end);
};
const gardenSource=extract('function bondGardenStage(garden){','function bondUnlockables(garden){');
const milestonesSource=extract('function bondUnlockables(garden){','function openBondGestureForm(');
const momentsSource=extract('function momentsView(){','function momentSection(');

test('P5A: design stylesheet is isolated and loaded after the current shell and map styles',()=>{
 assert.match(html,/href="\.\/galaxy-journeys-v5\.css"[\s\S]*href="\.\/galaxy-moments-v5\.css"/);
 assert.match(css,/\.living-moments-intro/);
 assert.match(css,/\.living-activity-cluster/);
 assert.match(css,/\.living-garden-scene/);
 assert.match(css,/@media\(max-width:359px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.living-activity-grid \.action-card:focus-visible/);
 assert.doesNotMatch(css,/\b(?:GPS|Firebase|Supabase|geolocation)\b/i);
});

test('P5A: garden illustration uses actual stage; zero, invalid and extreme stages are bounded',()=>{
 const fn=runInNewContext(gardenSource+'\nbondGardenVisual', {ico}, {timeout:1200});
 for(const [input,stage,flowers] of [
  [{stage:0},0,1],[{stage:2},2,2],[{stage:7},7,7],[{stage:8},8,7],
  [{stage:999},8,7],[{stage:-10},0,1],[{stage:'invalid'},0,1]
 ]){
  const ui=fn(input);
  assert.match(ui,new RegExp('data-stage="'+stage+'"'));
  assert.equal((ui.match(/class="garden-flower f\d+"/g)||[]).length,flowers);
  assert.match(ui,/data-daypart="(?:morning|day|sunset|night)" data-season="(?:winter|spring|summer|autumn)" data-celebration="[a-z]+" role="img" aria-label="Jardín compartido, etapa/);
  assert.match(ui,/aria-hidden="true"/);
 }
});

test('P5 garden: northern-hemisphere seasons and local dayparts follow the calendar',()=>{
 const cases=[
  ['2026-01-15T02:00:00', 'winter','night'],
  ['2026-04-15T08:00:00', 'spring','morning'],
  ['2026-07-15T14:00:00', 'summer','day'],
  ['2026-10-15T18:00:00', 'autumn','sunset']
 ];
 for(const [instant,season,daypart] of cases){
  const FakeDate=class extends Date{constructor(...args){super(...(args.length?args:[instant]));}};
  const render=runInNewContext(gardenSource+'\\nbondGardenVisual',{ico,Date:FakeDate},{timeout:1200});
  const html=render({stage:8});
  assert.match(html,new RegExp('data-daypart="'+daypart+'" data-season="'+season+'"'));
  assert.match(html,/data-stage="8"/);
 }
});

function renderMoments(garden,entries=[]){
 const context={
  cloud:{person:0,capabilities:{chat:true},chat:{unread:3},bond:{garden,entries}},
  bondGestureCatalog:()=>[
   {id:'hug',name:'Abrazo',icon:'hand-heart',behavior:'message_haptic'},
   {id:'tap',name:'Toque',icon:'hand',behavior:'haptic'}
  ],
  ico,esc:escape,attr:escape,
  bondGardenStage:runInNewContext(gardenSource+'\nbondGardenStage',{ico},{timeout:1200}),
  bondGardenVisual:runInNewContext(gardenSource+'\nbondGardenVisual',{ico},{timeout:1200}),
  bondUnlockables:()=>'<div class="bond-unlockables"></div>',
  actionCard:(icon,title,copy,action)=>'<button class="action-card" data-action="'+action+'">'+escape(title)+'</button>',
  surpriseNotesView:()=>'<section id="surprises"></section>',
  gameMomentsSection:()=>'<section id="game-groups"></section>',
  momentSection:()=>'<section class="existing-moment-history"></section>',
  gameCard:()=>'',ritualCard:()=>'',sharedNoteCard:()=>'',voiceCard:()=>''
 };
 return runInNewContext(momentsSource+'\nmomentsView',context,{timeout:1300})();
}

test('P5A: all original action IDs remain accessible and grouped by intention',()=>{
 const html=renderMoments({stage:3,days:9,progressPct:45});
 const activities=html.split('class="living-activity-clusters"')[1].split('</section>')[0];
 assert.match(html,/Nuestros momentos/);
 assert.match(html,/Para una cita/);
 assert.match(html,/Para conectar/);
 for(const action of ['surprise','date-mode-open','plan-roulette-open','date-planner-open',
  'date-question-decks','new-game','new-ritual','new-voice']){
  assert.equal((activities.match(new RegExp('data-action="'+action+'"','g'))||[]).length,1,action);
 }
 assert.match(html,/data-action="bond-gesture-manage"/);
 assert.match(html,/data-action="bond-send-gesture" data-gesture-id="hug"/);
 assert.match(html,/data-action="bond-send-gesture" data-gesture-id="tap"/);
 assert.match(html,/data-action="new-sharednote"/);
 assert.match(html,/id="surprises"/);
});

test('P5B: stage and caption use identical normalized garden values for invalid metadata',()=>{
 for(const [raw,expected] of [[0,0],[8,8],[999,8],[-10,0],['invalid',0]]){
  const ui=renderMoments({stage:raw,days:0,progressPct:0});
  assert.match(ui,new RegExp('class="bond-garden-scene living-garden-scene" data-stage="'+expected+'"'));
  assert.match(ui,new RegExp('class="living-garden-caption">Etapa '+expected+' · 0% de avance'));
  assert.doesNotMatch(ui,/Etapa (?:NaN|Infinity|-10|999)/);
 }
});

test('P5A: progress is clamped and accessible without modifying accumulated real streaks',()=>{
 for(const [raw,expected] of [[-40,0],[0,0],[47,47],[150,100],[null,0]]){
  const ui=renderMoments({stage:3,days:12,currentStreak:4,recordStreak:8,progressPct:raw});
  assert.match(ui,new RegExp('role="progressbar"[^>]+aria-valuenow="'+expected+'"'));
  assert.match(ui,new RegExp('style="width:'+expected+'%"'));
  assert.match(ui,/12<\/b><small>Días totales/);
  assert.match(ui,/4<\/b><small>Racha actual/);
  assert.match(ui,/8<\/b><small>Récord/);
 }
});

test('P5A: existing Bond actions and source-of-truth engines remain unchanged',()=>{
 assert.match(app,/if\(a==='bond-send-gesture'\)/);
 assert.match(app,/if\(a==='bond-gesture-manage'\)/);
 assert.match(app,/if\(a==='date-mode-open'\)/);
 assert.match(app,/if\(a==='plan-roulette-open'\)/);
 assert.match(app,/if\(a==='surprise'\)/);
 assert.doesNotMatch(momentsSource,/\b(?:fetch|api|GalaxyNative|Supabase|localStorage|setInterval|setTimeout)\s*\(/);
});


test('P5B: backend-defined current and future milestones are truthful, distinct and safe',()=>{
 const render=runInNewContext(milestonesSource+'\nbondUnlockables',{ico,esc:escape,attr:escape},{timeout:1200});
 const garden={unlockables:[{label:'Primer brote',days:1,unlocked:true,icon:'sprout'}],
  milestones:[
   {label:'Primer brote',days:1,unlocked:true,icon:'sprout'},
   {label:'Hojas nuevas',days:7,unlocked:false,icon:'leaf'},
   {label:'Hito <no permitido>',days:14,unlocked:false,icon:'invalid-icon'}
  ]};
 const html=render(garden);
 assert.match(html,/role="list" aria-label="Hitos reales del jardín"/);
 assert.equal((html.match(/role="listitem"/g)||[]).length,3);
 assert.match(html,/Logrado: Primer brote/);
 assert.match(html,/Por descubrir: Hojas nuevas/);
 assert.match(html,/7 días/);
 assert.match(html,/14 días/);
 assert.match(html,/&lt;no permitido&gt;/);
 assert.doesNotMatch(html,/<no permitido>|invalid-icon/);
 assert.match(html,/sprout/);
 assert.match(html,/lock/);
 assert.equal(render({milestones:[],unlockables:[]}),"");
});

test('P5B: next garden milestone is shown only with real valid server metadata',()=>{
 const valid=renderMoments({stage:8,totalDays:365,progressPct:100,next:null});
 assert.match(valid,/Nuestro jardín/);
 assert.doesNotMatch(valid,/Próximo hito:/);
 const next=renderMoments({stage:3,totalDays:18,progressPct:25,next:{label:'Girasol',days:30}});
 assert.match(next,/Próximo hito: Girasol al llegar a 30 días compartidos/);
 const fake=renderMoments({stage:3,next:{label:'Girasol',days:'unbounded'}});
 assert.doesNotMatch(fake,/Próximo hito:/);
});

test('P5B: gesture sends show a busy state, prevent double taps and restore on error',()=>{
 assert.match(app,/if\(a==='bond-send-gesture'\)\{/);
 assert.match(app,/if\(btn\.disabled\)return/);
 assert.match(app,/btn\.disabled=true;btn\.setAttribute\('aria-busy','true'\)/);
 assert.match(app,/await sendGesture\(btn\.dataset\.gestureId\)/);
 assert.match(app,/btn\.disabled=false;btn\.removeAttribute\('aria-busy'\)/);
 assert.match(css,/\.living-gestures \.gesture\[aria-busy="true"\]/);
 assert.match(css,/\.living-garden-milestones/);
});

const surpriseSource=extract('function surpriseNotesView(){','function cloudRenderFingerprint(');
const gameSource=extract('function gameMomentsSection(games){','function ritualCard(e){');

test('P5C: a locked surprise never exposes title, message or linked voice',()=>{
 const samples=[
  {id:'locked',author:1,open:false,data:{title:'PRIVATE-TITLE-XYZ',body:'PRIVATE-BODY-XYZ',unlockType:'date',unlockDate:'2027-12-24'}},
  {id:'opened',author:1,open:true,data:{title:'Una carta',body:'Palabras compartidas'}}
 ];
 const ctx={ico,esc:escape,attr:escape,cloud:{person:0},surpriseNotes:()=>samples,
  surpriseUnlocked:i=>i.open,fmtDate:x=>x,
  linkedVoices:id=>{assert.equal(id,'opened');return [];},voiceCard:()=>''};
 const html=runInNewContext(surpriseSource+'\nsurpriseNotesView',ctx,{timeout:1300})();
 assert.match(html,/Hay algo esperando para ti/);
 assert.match(html,/El contenido permanece oculto hasta su desbloqueo/);
 assert.doesNotMatch(html,/PRIVATE-TITLE-XYZ|PRIVATE-BODY-XYZ/);
 assert.match(html,/Una carta/);
 assert.match(html,/Palabras compartidas/);
 assert.equal((html.match(/data-action="surprise-note-new"/g)||[]).length,1);
 assert.equal((html.match(/data-action="item-delete"/g)||[]).length,0);
});
test('P5C: original owner actions remain behind a secondary disclosure',()=>{
 const sample={id:'one',author:0,open:false,data:{title:'Secret',body:'Never-reveal',unlockType:'place'}};
 const ctx={ico,esc:escape,attr:escape,cloud:{person:0},surpriseNotes:()=>[sample],surpriseUnlocked:()=>false,
  fmtDate:x=>x,linkedVoices:()=>{throw Error('Locked voice read');},voiceCard:()=>''};
 const ui=runInNewContext(surpriseSource+'\nsurpriseNotesView',ctx,{timeout:1300})();
 assert.match(ui,/data-action="voice-for-item" data-id="one"/);
 assert.match(ui,/data-action="item-delete" data-id="one"/);
 assert.match(ui,/Opciones de esta sorpresa/);
 assert.doesNotMatch(ui,/Never-reveal/);
 assert.ok(css.includes('.living-surprise-card.sealed'));
 assert.ok(css.includes('.living-secondary-actions>summary:focus-visible'));
});
test('P5C: game sessions separate current turn, waiting and played without leaks',()=>{
 const ctx={ico,esc:escape,attr:escape,cloud:{person:0},partnerName:()=> 'Tu pareja',
  gameQuestions:{tea:{label:'¿Café o té?',options:['Té','Café']}},
  momentSection:(name,list,renderer)=>'<section data-group="'+name+'">'+list.map(renderer).join('')+'</section>'};
 const game=runInNewContext(gameSource+'\n({gameCard,gameMomentsSection})',ctx,{timeout:1300});
 const waiting={id:'waiting',author:0,data:{questionId:'tea',answer:'Café'}};
 const played={id:'played',author:1,data:{questionId:'tea',answer:'Té',guess:'Café',correct:false}};
 const current={id:'turn',author:1,data:{questionId:'tea',answer:'SECRET-ANSWER-XYZ'}};
 const ui=game.gameMomentsSection([waiting,played,current]);
 assert.ok(ui.indexOf('Te toca responder')<ui.indexOf('Esperando respuesta'));
 assert.ok(ui.indexOf('Esperando respuesta')<ui.indexOf('Partidas jugadas'));
 assert.equal((ui.match(/class="card living-game-card/g)||[]).length,3);
 assert.doesNotMatch(game.gameCard(current),/SECRET-ANSWER-XYZ/);
 assert.match(game.gameCard(current),/data-action="game-guess" data-id="turn"/);
 assert.doesNotMatch(game.gameCard(current),/data-action="bond-delete"/);
 assert.match(game.gameCard(waiting),/Opciones de la partida/);
 assert.match(game.gameCard(waiting),/data-action="bond-delete" data-id="waiting"/);
 assert.match(game.gameCard(played),/Respuesta:/);
 assert.ok(css.includes('.living-game-options .chip{min-height:44px'));
});

const p5dSource=extract('function livingEntryMeta(e){','function voiceTimestamp(seconds){');
function p5dCards(person=0){
 const ctx={cloud:{person},esc:escape,attr:escape,partnerName:()=> 'Tu pareja',
  fmtDate:x=>x};
 return runInNewContext(p5dSource+'\n({ritualCard,sharedNoteCard})',ctx,{timeout:1200});
}
test('P5D: ritual has three semantic moments, truthful metadata and owner-only actions',()=>{
 const {ritualCard}=p5dCards();
 const own=ritualCard({id:'ritual-1',author:0,version:3,created:'2026-10-16T16:00:00Z',
  data:{week:'2026-10-12',gratitude:'Gracias <por todo>',need:'Necesito hablar',plan:'Caminata'}});
 assert.equal((own.match(/class="living-ritual-step"/g)||[]).length,3);
 for(const label of ['Gracias','Necesito','Próximo plan'])assert.match(own,new RegExp('<h4>'+label+'</h4>'));
 assert.match(own,/Gracias &lt;por todo&gt;/);
 assert.doesNotMatch(own,/<por todo>/);
 assert.match(own,/datetime="2026-10-16T16:00:00.000Z"/);
 assert.match(own,/>v3</);
 assert.match(own,/data-action="ritual-edit" data-id="ritual-1"/);
 assert.match(own,/data-action="bond-delete" data-id="ritual-1"/);
 assert.match(own,/<details class="living-secondary-actions">/);
 const other=ritualCard({id:'ritual-2',author:1,data:{gratitude:'Gracias'}});
 assert.doesNotMatch(other,/data-action="ritual-edit"|data-action="bond-delete"/);
 assert.doesNotMatch(other,/<time|>v1</);
});
test('P5D: shared notes preserve long body, protect actions and never fabricate versions or dates',()=>{
 const {sharedNoteCard}=p5dCards();
 const long='Una nota '+ 'A'.repeat(250)+' <private>';
 const ui=sharedNoteCard({id:'note-1',author:1,version:4,created:'2026-10-17T12:00:00Z',
  data:{title:'Nuestro <viaje>',body:long}});
 assert.match(ui,/Nuestro &lt;viaje&gt;/);
 assert.doesNotMatch(ui,/<viaje>|<private>/);
 assert.match(ui,/Leer nota completa/);
 assert.match(ui,/class="living-note-summary"/);
 assert.match(ui,/class="living-note-body"/);
 assert.match(ui,/&lt;private&gt;/);
 assert.match(ui,/>v4</);
 assert.match(ui,/data-action="sharednote-edit" data-id="note-1"/);
 assert.match(ui,/data-action="bond-delete" data-id="note-1"/);
 const bad=sharedNoteCard({id:'note-2',data:{title:'Corta',body:'Sin cambios'},version:'1',created:'fecha-invalida'});
 assert.doesNotMatch(bad,/>v1<|<time|Leer nota completa/);
 assert.match(bad,/Sin cambios/);
 for(const invalid of [null,0,-1,Infinity,NaN,'5'])assert.doesNotMatch(
  sharedNoteCard({id:'x',version:invalid,data:{title:'T'}}),/>v(?:0|1|5|Infinity|NaN)</);
});
test('P5D: existing version-aware delete and edit contracts are not weakened',()=>{
 assert.match(app,/if\(!e\|\|!confirm\('¿Eliminar este momento\?'\)\)return/);
 assert.match(app,/await api\('bond-delete',\{id,version:e.version\}\)/);
 assert.match(app,/modal.dataset.editId=entry\?\.id\|\|'';modal.dataset.version=entry\?\.version\|\|''/);
 assert.match(css,/\.living-note-full>summary:focus-visible/);
 assert.match(css,/\.living-note-full>summary\{[^}]*min-height:44px/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.living-ritual-card/);
});


const voiceSource=extract('function voiceCard(e){','function contextSettings(){');
const voiceModule=load('galaxy-voice-v5.js');
function voiceMarkup(data={},person=0){
 const ctx={cloud:{person},esc:escape,attr:escape,ico,
  partnerName:()=> 'Mi pareja',livingEntryMeta:()=>'',voiceTranscriptMarkup:()=>''};
 return runInNewContext(voiceSource+'\nvoiceCard',ctx,{timeout:1500})({id:'synthetic-voice',author:0,data});
}

test('P5E: voice markup keeps original audio URLs and action routes while showing unknown duration',()=>{
 const html=voiceMarkup({title:'Una voz',body:'Te extraño',
  audioUrl:'https://example.invalid/audio.m4a?tag=<private>&a=1'});
 assert.match(html,/class="card audio-card living-voice-card"/);
 assert.match(html,/data-voice-id="synthetic-voice"/);
 assert.match(html,/class="living-voice-toggle"/);
 assert.match(html,/class="living-voice-seek"[^>]*disabled/);
 assert.match(html,/0:00 \/ --:--/);
 assert.match(html,/preload="none" src="https:\/\/example.invalid\/audio.m4a\?tag=&lt;private&gt;&amp;a=1"/);
 assert.match(html,/data-action="voice-transcribe" data-id="synthetic-voice"/);
 assert.match(html,/data-action="bond-delete" data-id="synthetic-voice"/);
 assert.doesNotMatch(html,/<private>/);
 assert.match(html,/Opciones de esta voz/);
 assert.match(css,/\.living-voice-toggle:focus-visible/);
 assert.match(html,/aria-label="Avanzar audio"/);
});

test('P5E: absent audio is explicitly unavailable; no false player or duration',()=>{
 const missing=voiceMarkup({title:'Nota sin archivo'});
 assert.match(missing,/Este mensaje de voz no está disponible/);
 assert.doesNotMatch(missing,/<audio|class="living-voice-player"/);
 assert.doesNotMatch(missing,/0:00 \/ 0:00/);
 const incoming=voiceMarkup({audioUrl:'https://example.invalid/audio.mp3'},1);
 assert.match(incoming,/Mi pareja/);
 assert.doesNotMatch(incoming,/data-action="bond-delete"|data-action="voice-transcribe"/);
});

test('P5E: the audio controller formats only finite non-negative playback times',()=>{
 const wnd={},listeners={};
 runInNewContext(voiceModule,{window:wnd,document:{addEventListener:(name,handler)=>(listeners[name]??=[]).push(handler)}},{timeout:1300});
 assert.equal(wnd.GalaxyVoiceV5.formatTime(5.9),'0:05');
 assert.equal(wnd.GalaxyVoiceV5.formatTime(65),'1:05');
 assert.equal(wnd.GalaxyVoiceV5.formatTime(-1),'--:--');
 assert.equal(wnd.GalaxyVoiceV5.formatTime(Infinity),'--:--');
 assert.equal(wnd.GalaxyVoiceV5.formatTime(NaN),'--:--');
 assert.equal(wnd.GalaxyVoiceV5.hasDuration({duration:Infinity}),false);
 assert.equal(wnd.GalaxyVoiceV5.hasDuration({duration:42.5}),true);
 assert.ok(listeners.loadedmetadata.length>0);
 assert.ok(listeners.error.length>0);
 assert.doesNotMatch(voiceModule,/fetch\s*\(|GalaxyNative|localStorage|Supabase|geolocation/);
 assert.match(html,/src="\.\/galaxy-voice-v5\.js"[\s\S]*src="\.\/app\.js"/);
});

test('P5E: browser media events enable seeking only when actual metadata exists',()=>{
 const listeners={},button={dataset:{},setAttribute(name,value){this[name]=value;}};
 const clock={textContent:''},status={textContent:''};
 const range={disabled:true,max:'100',value:'0',setAttribute(name,value){this[name]=value;}};
 const player={querySelector(selector){
  if(selector==='.living-voice-seek')return range;
  if(selector==='.living-voice-time')return clock;
  if(selector==='.living-voice-toggle')return button;
  if(selector==='.living-voice-status')return status;
  if(selector==='audio.living-voice-audio')return audio;
  return null;
 }};
 const audio={duration:Infinity,currentTime:0,paused:true,ended:false,error:null,
  closest:selector=>selector==='.living-voice-player'?player:null,
  matches:selector=>selector==='audio.living-voice-audio',
  play(){this.paused=false;return Promise.resolve();},pause(){this.paused=true;}};
 const doc={addEventListener:(kind,fn)=>(listeners[kind]??=[]).push(fn),
   querySelectorAll:()=>[audio]};
 runInNewContext(voiceModule,{window:{},document:doc},{timeout:1600});
 const media=kind=>listeners[kind][0]({target:audio});
 media('loadedmetadata');
 assert.equal(range.disabled,true);
 assert.equal(clock.textContent,'0:00 / --:--');
 assert.equal(status.textContent,'Duración aún no disponible');
 audio.duration=125.8;audio.currentTime=70.3;media('durationchange');
 assert.equal(range.disabled,false);
 assert.equal(range.max,'125800');
 assert.equal(range.value,'70300');
 assert.equal(clock.textContent,'1:10 / 2:05');
 assert.equal(range['aria-valuetext'],'1:10 de 2:05');
 audio.currentTime=9;media('error');
 assert.equal(status.textContent,'No se pudo cargar este audio.');
 assert.equal(button['aria-label'],'Reproducir mensaje de voz');
});


test('P5 VE-118/121: all eight Momentos actions have meaningful categories instead of generic Explore',()=>{
 const source=extract('function welcomeActionContext(action){','function actionCard(');
 const context={items:()=>[],cloud:{bond:{garden:{days:12}}},goalsState:null,goalsLoadedAt:0,Date};
 const classify=runInNewContext(source+'\nwelcomeActionContext',context,{timeout:1200});
 const expected={surprise:'SORPRENDER','date-mode-open':'CITA','plan-roulette-open':'PLANEAR','date-planner-open':'PLANEAR','date-question-decks':'CONVERSAR','new-game':'JUGAR','new-ritual':'CONECTAR','new-voice':'ESCUCHAR'};
 for(const [action,category] of Object.entries(expected)){
  const actual=classify(action);
  assert.equal(actual.category,category,action);
  assert.equal(actual.meta,'',action+' must not invent progress');
 }
 assert.equal(classify('map').category,'EXPLORAR');
 assert.equal(classify('add-plan').category,'PLANEAR');
});
test('P5 visual: Chat is reachable from the Momentos cover without a floating overlay and narrow nav labels wrap',()=>{
 const ui=renderMoments({stage:3,days:18,progressPct:25});
 assert.match(ui,/class="living-moments-symbol living-moments-chat" data-action="chat-open"/);
 assert.match(ui,/aria-label="Abrir nuestro chat, 3 mensajes sin leer"/);
 assert.match(ui,/class="chat-fab-badge" aria-hidden="true">3<\/span>/);
 assert.match(app,/if\(a==='chat-open'\)/);
 assert.match(css,/body:not\(\.chat-mode\):has\(\.living-moments\) #chatFab\{display:none\}/);
 assert.match(css,/\.living-moments-chat:focus-visible/);
 assert.match(css,/\.bottom-nav \.nav-btn span\{max-width:none;white-space:nowrap;overflow:visible;text-overflow:clip;overflow-wrap:normal/);
 assert.match(css,/transform:scaleX\(\.7\);transform-origin:center/);
});
