import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const root=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(root,name),'utf8');
const sandbox={window:{}};
runInNewContext(read('galaxy-memories-v5.js'),sandbox,{timeout:1500});
const hub=sandbox.window.GalaxyMemoriesV5;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ui={attr:esc,ico:x=>'<i>'+esc(x)+'</i>'};
const photos=[{url:'https://media.example.invalid/one.jpg',path:'private/one.jpg'},{url:'https://media.example.invalid/two.jpg',path:'private/two.jpg'}];

test('P6B: every private photo opens safely; none has an exposed delete on thumbnail',()=>{
 const h=hub.albumGallery(photos,ui);
 assert.equal((h.match(/data-action="album-photo-view"/g)||[]).length,2);
 assert.match(h,/role="list" aria-label="Fotos del álbum privado"/);
 assert.doesNotMatch(h,/media-delete|data-path|onerror=/);
 assert.match(h,/loading="lazy"/);
});
test('P6B: viewer navigation stays bounded and deletion remains explicit',()=>{
 const first=hub.albumViewer(photos,0,ui);
 const last=hub.albumViewer(photos,1,ui);
 assert.match(first,/Foto 1 de 2/);
 assert.match(first,/data-index="-1" disabled/);
 assert.match(last,/data-index="2" disabled/);
 assert.match(last,/data-action="media-delete" data-kind="photo"/);
 assert.match(last,/Esta acción requiere confirmación/);
 assert.equal(hub.albumViewer(photos,100,ui),'');
 assert.equal(hub.albumViewer(null,0,ui),'');
});
test('P6B: invalid or missing URL cannot open and does not reveal private paths',()=>{
 const broken=[{},null,{url:'javascript:alert(1)',path:'PRIVATE-PATH'}];
 const h=hub.albumGallery(broken,ui);
 assert.doesNotMatch(h,/data-action="album-photo-view"|PRIVATE-PATH|javascript:/);
 assert.equal(hub.albumViewer(broken,2,ui),'');
});
test('P6B: escaped URL attributes do not inject HTML or event handlers',()=>{
 const h=hub.albumGallery([{url:'https://media.example.invalid/img?name=" onerror="evil'}],ui);
 assert.match(h,/&quot; onerror=&quot;/);
 assert.doesNotMatch(h,/ onerror="evil"/);
 const v=hub.albumViewer([{url:'https://media.example.invalid/image',path:'a" onclick="evil'}],0,ui);
 assert.match(v,/data-path="a&quot; onclick=&quot;evil"/);
 assert.doesNotMatch(v,/onclick="evil"/);
});
test('P6B: app wires viewer to real photos, keeps original Drive flow and confirm',()=>{
 const app=read('app.js');
 assert.match(app,/GalaxyMemoriesV5\.albumGallery\(list,\{attr,ico\}\)/);
 assert.match(app,/GalaxyMemoriesV5\.albumViewer\(list,n,\{attr,ico\}\)/);
 assert.match(app,/if\(a==='album-photo-view'\)/);
 assert.match(app,/if\(a==='media-delete'\)\{if\(confirm\(/);
 assert.match(app,/driveAlbumCard\(\)/);
 assert.match(app,/data-action="album-add"/);
});
test('P6B: gallery module remains read-only and CSP uses only known assets',()=>{
 const module=read('galaxy-memories-v5.js');
 assert.doesNotMatch(module,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative|media-delete\s*\(/);
 assert.match(read('index.html'),/src="\.\/galaxy-memories-v5\.js"/);
});
