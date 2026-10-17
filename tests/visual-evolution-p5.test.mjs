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
const gardenSource=extract('function bondGardenVisual(garden){','function bondUnlockables(garden){');
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
  assert.match(ui,/role="img" aria-label="Jardín compartido, etapa/);
  assert.match(ui,/aria-hidden="true"/);
 }
});

function renderMoments(garden,entries=[]){
 const context={
  cloud:{person:0,bond:{garden,entries}},
  bondGestureCatalog:()=>[
   {id:'hug',name:'Abrazo',icon:'hand-heart',behavior:'message_haptic'},
   {id:'tap',name:'Toque',icon:'hand',behavior:'haptic'}
  ],
  ico,esc:escape,attr:escape,
  bondGardenVisual:runInNewContext(gardenSource+'\nbondGardenVisual',{ico},{timeout:1200}),
  bondUnlockables:()=>'<div class="bond-unlockables"></div>',
  actionCard:(icon,title,copy,action)=>'<button class="action-card" data-action="'+action+'">'+escape(title)+'</button>',
  surpriseNotesView:()=>'<section id="surprises"></section>',
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
