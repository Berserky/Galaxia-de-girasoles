import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

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
 for(const part of ['monthlySummaryTeaser()','todayHistoryTeaser()','encounterStatsTeaser()','dailyQuestionCard(own,partner)',"livingMomentCard(nextAlreadyFeatured?'PRÓXIMA FECHA':'')",'data-action="mood"'])
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
 assert.ok(home.includes("livingMomentCard(nextAlreadyFeatured?'PRÓXIMA FECHA':'')"));
 assert.match(app,/function livingMomentCard\(eyebrowLabel=''\)/);
 assert.match(app,/esc\(eyebrowLabel\|\|m\.label\)/);
 // The original native device regression requires visible text, not just an aria label.
 assert.match(home,/PRÓXIMA FECHA/);
});
