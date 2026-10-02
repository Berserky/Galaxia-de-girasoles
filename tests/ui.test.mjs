import test from 'node:test';
import assert from 'node:assert/strict';

test('mobile navigation marks secondary screens under Explore',async()=>{
 const {mobileNavigation}=await import('../app/public/ui.js');
 const icon=name=>'<svg data-icon="'+name+'"></svg>';
 const html=mobileNavigation('musica',icon);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 assert.match(html,/data-action="more"[^>]*aria-current="page"/);
 for(const id of ['inicio','recuerdos','mapa'])assert.ok(html.includes('href="#'+id+'"'));
 assert.equal((mobileNavigation('inicio',icon).match(/aria-current="page"/g)||[]).length,1);
});

test('Explore retains every existing section and the original gift',async()=>{
 const {exploreMarkup}=await import('../app/public/ui.js');
 const html=exploreMarkup(()=>'<svg></svg>');
 for(const id of ['inicio','recuerdos','album','musica','calendario','planes','conectar','mapa','universo','ajustes'])assert.ok(html.includes('href="#'+id+'"'),id);
 assert.ok(html.includes('href="/regalo/"'));
});

test('Create exposes existing actions for every content kind',async()=>{
 const {createMarkup}=await import('../app/public/ui.js');
 const html=createMarkup(()=>'<svg></svg>');
 for(const action of ['new-memory','upload','new-song','new-event','new-plan','new-capsule','new-wish','new-journey'])assert.ok(html.includes('data-action="'+action+'"'),action);
});


test('mobile Create lives in the dock so it cannot cover page actions',async()=>{
 const {mobileNavigation}=await import('../app/public/ui.js');
 assert.match(mobileNavigation('inicio',()=>'<svg></svg>'),/class="dock-create" data-action="create-menu"/);
});


test('in-app Android download points to the current stable channel',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../app/public/app.js',import.meta.url),'utf8');
 assert.ok(source.includes('releases/download/android-stable/NuestraGalaxia-Companion.apk'));
 assert.ok(!source.includes('releases/download/android-v1.0.0/'));
});
