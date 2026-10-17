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
  [{stage:0},0,1],[{stage:2},2,2],[{stage:7},7,7],
  [{stage:999},7,7],[{stage:-10},0,1],[{stage:'invalid'},0,1]
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
