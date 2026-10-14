import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const ROOT=resolve(import.meta.dirname,'..');
const DIR=resolve(ROOT,'android/app/src/main/assets/mobile');
const file=name=>readFileSync(resolve(DIR,name),'utf8');
const presenter=file('galaxy-discovery-v5.js');
const css=file('galaxy-discovery-v5.css');
const html=file('index.html'),app=file('app.js');
const fake={window:{}};
runInNewContext(presenter,fake,{timeout:1200});
const v5=fake.window.GalaxyDiscoveryV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=esc,ico=n=>'<svg data-icon="'+esc(n)+'"></svg>';
const helpers={ico,esc,attr,kindMeta:{memory:['image'],song:['music']},
 fmtDateTime:x=>String(x).slice(0,16),notificationIcon:()=> 'bell'};
const p2={notifications:[
 {id:'c1',event_type:'chat_message',action:'chat',entity_id:'message-1',title:'Chat',body:'Primero',created_at:'2026-10-14T12:00:00Z',read_at:null},
 {id:'c2',event_type:'chat_message',action:'chat',entity_id:'message-2',title:'Chat',body:'Segundo',created_at:'2026-10-14T12:01:00Z',read_at:null},
 {id:'g1',event_type:'goal_update',action:'goals',title:'Objetivo',body:'Hecho',created_at:'2026-10-14T10:00:00Z',read_at:'2026-10-14'},
 {id:'n1',event_type:'nearby',action:'map',title:'Un encuentro',body:'Anterior',created_at:'2020-10-14T12:00:00Z',read_at:null}
],unread:3};
test('P3: Android module loaded only after theme/shell and before app runtime',()=>{
 assert.match(html,/href="\.\/galaxy-welcome\.css"[\s\S]*href="\.\/galaxy-discovery-v5\.css"/);
 assert.match(html,/src="\.\/galaxy-discovery-v5\.js"[\s\S]*src="\.\/app\.js"/);
 assert.doesNotMatch(presenter,/fetch\(|\bGalaxyNative\b|\bSupabase\b|localStorage|\beval\s*\(/);
 assert.match(app,/window\.GalaxyDiscoveryV5\.renderClassic\(/);
 assert.match(app,/window\.GalaxyDiscoveryV5\.renderNotifications\(/);
 assert.match(app,/api\('intelligence-search',\{query:q,limit:24\}\)/);
 assert.match(app,/api\('notifications-list',\{limit:80\}\)/);
 assert.match(app,/api\('notifications-read',\{id:btn\.dataset\.id\}\)/);
 assert.match(app,/await routeGalaxyAction\(target,entity\)/);
});
test('P3: grouped direct matches maintain exact incoming relevance order and routing',()=>{
 const rows=[
 {type:'item',kind:'memory',id:'1',title:'A',subtitle:'texto completo'},
 {type:'place',id:'p',title:'Lugar'},
 {type:'item',kind:'memory',id:'2',title:'B'},
 {type:'item',kind:'song',id:'3',title:'C'}
 ];
 const text=v5.renderClassic(rows,helpers);
 assert.deepEqual([...text.matchAll(/data-id="([^"]+)"/g)].map(a=>a[1]),['1','p','2','3']);
 assert.match(text,/aria-label="Recuerdo"/);
 assert.match(text,/aria-label="Lugar"/);
 assert.match(text,/aria-label="Canción"/);
 assert.match(text,/data-action="universal-search-result"/);
 assert.match(text,/texto completo/);
});
test('P3: presenter escapes private/untrusted content in results and notifications',()=>{
 const bad='<img src=x onerror=alert(1)>';
 const text=v5.renderClassic([{id:bad,type:'item',kind:'memory',title:bad,subtitle:bad}],helpers);
 assert.doesNotMatch(text,/<img/);assert.match(text,/&lt;img/);
 const n=v5.renderNotifications({notifications:[{id:bad,event_type:'chat_message',title:bad,body:bad,created_at:'2026-10-14'}],unread:1},'all',helpers);
 assert.doesNotMatch(n,/<img/);assert.match(n,/&lt;img/);
 assert.doesNotMatch(n,/data-action="notifications-read-all".*data-action="notifications-read-all"/s);
});
test('P3: four notification filters retain individual read actions without hiding chat messages',()=>{
 const all=v5.renderNotifications(p2,'all',helpers);
 assert.equal((all.match(/data-action="notification-open"/g)||[]).length,4);
 assert.deepEqual([...all.matchAll(/data-id="([^"]+)"/g)].map(a=>a[1]),['c1','c2','g1','n1']);
 assert.match(all,/data-action="notifications-read-all">Marcar todas como leídas/);
 assert.match(all,/data-filter="all"/);assert.match(all,/data-filter="unread"/);
 assert.match(all,/data-filter="chat"/);assert.match(all,/data-filter="activity"/);
 assert.equal((v5.renderNotifications(p2,'chat',helpers).match(/data-action="notification-open"/g)||[]).length,2);
 assert.equal((v5.renderNotifications(p2,'unread',helpers).match(/data-action="notification-open"/g)||[]).length,3);
 assert.equal((v5.renderNotifications(p2,'activity',helpers).match(/data-action="notification-open"/g)||[]).length,2);
 assert.match(all,/data-entity-id="message-1"/);
 assert.match(all,/data-entity-id="message-2"/);
 assert.match(all,/Aviso anterior/);
});
test('P3: empty, unread and offline states are explicit',()=>{
 const empty=v5.renderNotifications({notifications:[],unread:0},'all',helpers);
 assert.match(empty,/Todavía no hay notificaciones/);
 assert.match(v5.renderNotifications(p2,'unread',helpers),/Sin leer/);
 assert.match(app,/No pudimos cargar los avisos/);
 assert.match(app,/data-action="notifications-retry"/);
 assert.match(app,/Tus coincidencias directas siguen aquí/);
 assert.match(app,/Buscando coincidencias relacionadas/);
 assert.match(app,/el\.setAttribute\('aria-busy','true'\)/);
 assert.match(app,/const nonce=\+\+intelligenceSearchNonce/);
});
test('P3: preserve navigation and modal lifecycle with independent keyboard-safe result scroll',()=>{
 assert.match(app,/showModal\('Notificaciones',[\s\S]*?'v5-p3-notifications'\)/);
 assert.match(app,/showModal\('Buscar en nuestra galaxia',[\s\S]*?'v5-p3-search'\)/);
 assert.match(presenter,/data-action="notifications-filter"/);
 assert.match(app,/if\(a==='notifications-filter'\)/);
 assert.match(app,/if\(a==='notification-open'\)/);
 assert.match(app,/if\(a==='universal-search-result'\)/);
 assert.match(app,/if\(a==='intelligence-search-result'\)/);
 assert.match(css,/v5-search-results[\s\S]*overflow-y:auto/);
 assert.match(css,/notification-center-list[\s\S]*overflow-y:auto/);
 assert.match(css,/100dvh/);
 assert.match(css,/env\(safe-area-inset-bottom\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/min-height:44px/);
 assert.doesNotMatch(css,/\.chat-messages\s*\{|\.chat-composer\s*\{/);
});

test('P3: real Android test clicks every filter and proves horizontally clipped tabs are reachable',()=>{
 const android=readFileSync(resolve(ROOT,'android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java'),'utf8');
 assert.match(android,/new String\\[\\]\\{"unread","chat","activity","all"\\}/);
 assert.match(android,/v5-notification-filter\\[data-filter=/);
 assert.match(android,/scrollIntoView\\(\\{block:'nearest',inline:'nearest'\\}\\)/);
 assert.match(android,/filterEvidence\\.getBoolean\\("visible"\\)/);
 assert.match(android,/filterEvidence\\.getBoolean\\("minTouch"\\)/);
 assert.match(css,/v5-notification-filters\\s*\\{[\\s\\S]*?overflow-x:auto/);
});
