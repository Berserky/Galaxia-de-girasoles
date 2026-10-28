import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const java=readFileSync(new URL('../android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java',import.meta.url),'utf8');
const more=readFileSync(new URL('../android/app/src/main/assets/mobile/galaxy-more-v5.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../android/app/src/main/assets/mobile/app.js',import.meta.url),'utf8');
const method=java.split('@Test public void dailyGoalsPlansEventsCapsulesMapContextBackupAndUpdate_areReachable()')[1]?.split('@Test public void networkOfflineSlowTimeoutAndChatRetry_areExercised()')[0]||'';

test('P8 Android test uses real P7 quick links for collapsed backup and system groups',()=>{
 assert.match(method,/v5-more-quick-link\[aria-controls=\\\"v5-more-backups\\\"\]/);
 assert.match(method,/v5-more-quick-link\[aria-controls=\\\"v5-more-system\\\"\]/);
 assert.match(method,/v5-more-backups'\)\?\.open===true/);
 assert.match(method,/v5-more-system'\)\?\.open===true/);
 assert.match(method,/document\.body\.innerText\.includes\('Copia de nuestra galaxia'\)/);
 assert.match(method,/document\.body\.innerText\.includes\('Actualizaciones'\)/);
});

test('P8 Android test still requires both backup controls, updater and chat',()=>{
 for(const action of ['backup-export','backup-import','update-check'])assert.ok(method.includes(action),action);
 assert.match(method,/launchChat\(\);/);
 assert.match(method,/CÁPSULA BLOQUEADA/);
 assert.match(method,/EN CAMINO/);
});

test('P7 quick links expose actual details rather than synthetic content',()=>{
 assert.match(more,/button\.setAttribute\('aria-controls',entry\.id\)/);
 assert.match(more,/button\.addEventListener\('click',\(\)=>revealGroup\(hub,id,true\)\)/);
 assert.match(more,/details\.open=true/);
 assert.match(more,/\['backups','Datos y copias'\]/);
 assert.match(more,/\['system','Sistema y actualizaciones'\]/);
 assert.match(more,/has\('backup-export'\)\|\|has\('backup-import'\)/);
 assert.match(more,/meta\.id==='updateCard'\|\|has\('update-check'\)/);
 assert.match(app,/window\.GalaxyMoreV5\?\.organize\(app\)/);
});
