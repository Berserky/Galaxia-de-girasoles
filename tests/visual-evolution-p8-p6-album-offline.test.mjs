import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const base=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=file=>readFileSync(resolve(base,file),'utf8');
const win={};
runInNewContext(read('galaxy-memories-v5.js'),{window:win},{timeout:1800});
const hub=win.GalaxyMemoriesV5;
const TOKEN='P8-SIGNED-URL-SECRET-DO-NOT-PRINT';
const PATH='P8-PRIVATE-STORAGE-PATH-DO-NOT-PRINT';
function mockPhoto(kind){
 const statuses=[];
 const parent={replaceChild(node,previous){statuses.push({node,previous})}};
 const doc={createElement(tag){assert.equal(tag,'span');return {
  setAttribute(name,value){this[name]=value},textContent:'',className:''
 }}};
 const thumb=kind==='thumbnail'?{parentNode:parent,ownerDocument:doc}:null;
 const viewer=kind==='viewer'?{}:null;
 const img={tagName:'IMG',src:'https://private.example.invalid/photo?token='+TOKEN,
  parentNode:parent,ownerDocument:doc,closest(selector){
   if(selector==='.memories-v5-photo-open')return thumb;
   if(selector==='.memories-v5-photo-viewer')return viewer;
   return null;
  }};
 return {img,parent,thumb,statuses};
}
test('P8 P6: failed signed thumbnails show accessible offline status without leaking secrets',()=>{
 const {img,statuses,thumb}=mockPhoto('thumbnail');
 assert.equal(hub.albumImageFallback(img),true);
 assert.equal(statuses.length,1);
 assert.equal(statuses[0].previous,thumb);
 const s=statuses[0].node;
 assert.equal(s.className,'memories-v5-photo-missing');
 assert.equal(s.role,'status');
 assert.match(s.textContent,/Foto no disponible/);
 assert.doesNotMatch(s.textContent,new RegExp(TOKEN+'|'+PATH));
});
test('P8 P6: expired image in viewer shows status while navigation is still retained',()=>{
 const {img,statuses}=mockPhoto('viewer');
 assert.equal(hub.albumImageFallback(img),true);
 assert.equal(statuses[0].previous,img,'only broken <img> is replaced, not viewer controls');
 assert.equal(statuses[0].node.role,'status');
});
test('P8 P6: unrelated images, missing DOM and invalid sources cannot trigger private fallback',()=>{
 const {img,statuses}=mockPhoto('unrelated');
 assert.equal(hub.albumImageFallback(img),false);
 assert.equal(statuses.length,0);
 assert.equal(hub.albumImageFallback(null),false);
 const signed={url:'https://private.example.invalid/photo?token='+TOKEN,path:PATH};
 const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const card=hub.albumGallery([signed],{attr:esc,ico:()=>''});
 assert.doesNotMatch(card,/data-path|onerror=|P8-PRIVATE-STORAGE-PATH/);
});
test('P8 P6: browser error listener uses event capture with no inline handlers or network requests',()=>{
 const app=read('app.js');
 assert.match(app,/document\.addEventListener\('error',e=>\{\s*if\(e\.target\?\.tagName==='IMG'\)window\.GalaxyMemoriesV5\?\.albumImageFallback\?\.\(e\.target\);\s*\},true\);/);
 const module=read('galaxy-memories-v5.js');
 assert.doesNotMatch(module,/onerror=|\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage/);
 assert.match(module,/albumImageFallback,musicGrouping/);
 assert.match(read('galaxy-memories-v5.css'),/\.memories-v5-photo-viewer figure \.memories-v5-photo-missing\{min-height:180px/);
});
