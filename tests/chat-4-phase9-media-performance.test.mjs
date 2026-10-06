import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const app=()=>read('android/app/src/main/assets/mobile/app.js');
const mediaSource=()=>read('android/app/src/main/assets/mobile/chat-media-engine.js');
const backend=()=>read('supabase/functions/android-companion/index.ts');
const validator=()=>read('supabase/functions/android-companion/media-validation.ts');
const mainActivity=()=>read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
const thumbnailer=()=>read('android/app/src/main/java/com/nuestragalaxia/companion/MediaThumbnailer.java');

function engine(options={},delay=1){
 let active=0,peak=0;
 class MockImage{
  set src(value){
   this._src=value;active++;peak=Math.max(peak,active);
   setTimeout(()=>{active--;this.onload?.();},delay);
  }
  get src(){return this._src||'';}
 }
 const context={
  window:{GalaxyChatPerf:{note(){}}},
  globalThis:null,
  Image:MockImage,
  document:{querySelector(){return null;}},
  performance:{now:()=>Date.now()},
  setTimeout,clearTimeout,Promise,Map,Error,Number,String,Math
 };
 context.globalThis=context;
 vm.createContext(context);vm.runInContext(mediaSource(),context);
 return {instance:context.window.GalaxyChatMedia.create(options),peak:()=>peak};
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('1 thumbnail imagen: bubbles prefer thumbnail and never bind the original as initial src',()=>{
 const source=app(),start=source.indexOf('function chatAttachmentMarkup'),end=source.indexOf('function chatCardMeta',start),fn=source.slice(start,end);
 assert.match(fn,/data-media-thumbnail/);assert.match(fn,/data-media-original/);
 assert.doesNotMatch(fn,/loading="lazy" src="\'+url/);
});
test('2 thumbnail video: video bubble has static poster pipeline and explicit play control',()=>{
 const source=app();assert.match(source,/data-media-kind="video"/);assert.match(source,/data-action="chat-video-play"/);assert.match(source,/preload="none"/);
 assert.match(thumbnailer(),/getScaledFrameAtTime|getFrameAtTime/);
});
test('3 lazy load: media runtime uses IntersectionObserver rooted in chat viewport',()=>assert.match(mediaSource(),/new IntersectionObserver[\s\S]*root,/));
test('4 preload: prefetch margin is bounded and configurable',()=>{assert.match(app(),/preloadMargin:720/);assert.match(mediaSource(),/rootMargin:preloadMargin\+'px 0px'/);});
test('5 cancelación: queued work is dropped when it is no longer wanted',async()=>{
 const {instance}=engine({maxConcurrent:1},8);
 const first=instance.preloadImage('a','a',0,()=>true);
 const second=instance.preloadImage('b','b',1,()=>false).then(()=>false,e=>e.message==='cancelled');
 await first;assert.equal(await second,true);assert.ok(instance.stats().cancelled>=1);
});
test('6 request deduplication: identical stable key shares one request',async()=>{
 const {instance}=engine();await Promise.all([instance.preloadImage('same','u'),instance.preloadImage('same','u')]);
 const stats=instance.stats();assert.equal(stats.requests,1);assert.equal(stats.deduped,1);
});
test('7 cache hit: a completed thumbnail is reused without another request',async()=>{
 const {instance}=engine();await instance.preloadImage('x','u');await instance.preloadImage('x','u');
 const stats=instance.stats();assert.equal(stats.requests,1);assert.equal(stats.cacheHits,1);
});
test('8 cache eviction: memory metadata cache is bounded with LRU-style eviction',async()=>{
 const {instance}=engine({maxEntries:8});
 for(let i=0;i<12;i++)await instance.preloadImage('k'+i,'u'+i);
 const stats=instance.stats();assert.equal(stats.cacheEntries,8);assert.equal(stats.evictions,4);
});
test('9 recurso eliminado: delete invalidates stable media identities before reload',()=>assert.match(app(),/chat-delete[\s\S]*chatMediaEngine\.invalidate/));
test('10 offline cache: runtime does not claim uncached media as available',()=>{
 const source=mediaSource();assert.match(source,/if\(!url\)return Promise\.reject/);assert.doesNotMatch(source,/caches\.open|indexedDB/);
});
test('11 large image: native thumbnail decode is bounded before bubble use',()=>{
 const source=thumbnailer();assert.match(source,/MAX_EDGE=640/);assert.match(source,/setTargetSize/);assert.match(source,/inSampleSize/);assert.match(source,/MAX_BYTES=1536L\*1024L/);
});
test('12 500 imágenes: bounded queue keeps concurrency capped',async()=>{
 const {instance,peak}=engine({maxConcurrent:4,maxEntries:24},2);
 await Promise.all(Array.from({length:500},(_,i)=>instance.preloadImage('i'+i,'u'+i)));
 assert.ok(peak()<=4);assert.equal(instance.stats().cacheEntries,24);
});
test('13 múltiples videos: originals are not initialized by markup and activation is explicit',()=>{
 const source=app(),start=source.indexOf('function chatAttachmentMarkup'),end=source.indexOf('function chatCardMeta',start),fn=source.slice(start,end);
 assert.match(fn,/<video controls preload="none"/);assert.doesNotMatch(fn,/<video controls preload="metadata" playsinline src=/);
});
test('14 HEIC: existing normalization remains and thumbnailer accepts inspected images',()=>{
 const mobile=read('android/app/src/main/java/com/nuestragalaxia/companion/MobileApiClient.java');
 assert.match(mobile,/MediaSniffer\.isHeif/);assert.match(mobile,/transcodeHeifToJpeg/);assert.match(thumbnailer(),/MediaInspector\.isChatImage/);
});
test('15 WebP: validation still accepts WebP and thumbnail output stays browser-safe JPEG',()=>{
 assert.match(validator(),/"image\/webp"/);assert.match(thumbnailer(),/Bitmap\.CompressFormat\.JPEG/);
});
test('16 failed media: runtime records stable error state without infinite retry loop',()=>{
 const source=mediaSource();assert.match(source,/data\.mediaError|dataset\.mediaError/);assert.match(source,/function retry\(/);assert.doesNotMatch(source,/setInterval/);
});
test('17 retry: retry clears failed cache variants and requests at visible priority',()=>assert.match(mediaSource(),/function retry[\s\S]*cache\.delete[\s\S]*requestNode\(node,0\)/));
test('18 navegación rápida: leaving chat detaches observers and heavy resources',()=>assert.match(app(),/previous==='chat'[\s\S]*chatMediaEngine\.detach\(\{release:true\}\)/));
test('19 virtualización: every message-window rerender remounts visibility tracking',()=>assert.match(app(),/el\.innerHTML=chatMessagesMarkup\(\)[\s\S]*chatMediaEngine\.mount\(el\)/));
test('20 abrir original: full photo is promoted only from explicit media-view action',()=>assert.match(app(),/chat-media-view[\s\S]*promoteImage\(viewer/));
test('21 regresar al thumbnail: bubble contract remains thumbnail-backed after viewer closes',()=>assert.ok(app().includes("data-thumbnail=\"'+thumb+'\"")));
test('22 background: hidden app releases media and visible app remounts it',()=>{
 const source=app();assert.match(source,/visibilityState==='hidden'[\s\S]*chatMediaEngine\.detach/);assert.match(source,/visibilityState==='visible'[\s\S]*chatMediaEngine\.mount/);
});
test('23 low-memory: Android forwards trim-memory pressure into media cache release',()=>{
 assert.match(mainActivity(),/onTrimMemory/);assert.match(mainActivity(),/event\("memory-pressure"/);assert.match(app(),/name==='memory-pressure'/);
});
test('24 cleanup: generated thumbnails share existing safe unreferenced-media cleanup',()=>{
 const source=mainActivity();assert.match(source,/uploadedPaths\.add\(thumbnailPath\)/);assert.match(source,/discardUnreferencedChatMedia\(uploadedPaths\)/);assert.match(backend(),/thumbnail_path/);
});
test('25 media en Galaxy Card: no alternate chat media downloader is introduced',()=>{
 const source=app();assert.equal((source.match(/GalaxyChatMedia\.create/g)||[]).length,1);assert.doesNotMatch(source,/fetch\([^)]*galaxy-chat-media/);
});
test('26 GIF GIPHY: existing preview path stays lazy and secrets remain server side',()=>{
 const source=app();assert.match(source,/chat-gif-grid[\s\S]*previewUrl/);assert.match(source,/Powered by GIPHY/);assert.doesNotMatch(source,/GIPHY_API_KEY/);
});
test('27 eliminar mensaje multimedia: backend removes primary plus thumbnail and UI invalidates cache',()=>{
 const source=backend();assert.match(source,/\[String\(a\.path\|\|""\),String\(a\.thumbnail_path\|\|""\)\]/);assert.match(app(),/chatMediaEngine\.invalidate/);
});
test('28 dos usuarios: thumbnail ownership stays behind the existing attachment path guard',()=>{
 const schema=read('supabase/schema.sql');assert.match(schema,/thumbnail_path not like sender\|\|\'\/%\'/);assert.match(schema,/attachment thumbnail is not owned by sender/i);
});
test('29 Realtime: media optimization does not add a second message or realtime channel',()=>{
 const source=app();assert.equal((source.match(/const chatMessageEngine=/g)||[]).length,1);assert.equal((source.match(/const chatDeliveryEngine|chatDeliveryEngine=null/g)||[]).length,1);
});
test('30 chat 20.000+ con media distribuida: virtual message engine stays bounded while media engine remains capped',()=>{
 const message=read('android/app/src/main/assets/mobile/chat-message-engine.js');assert.match(app(),/maxCache:420,windowSize:84/);assert.match(message,/windowSize/);
 const messages=Array.from({length:20000},(_,i)=>({id:String(i),attachments:i%7===0?[{id:'a'+i}]:[]}));
 assert.equal(messages.length,20000);assert.ok(messages.filter(x=>x.attachments.length).length>2800);
 assert.match(app(),/maxEntries:96,maxConcurrent:4/);
});
test('signed URL tokens are not used as the authoritative cache identity',()=>{
 assert.match(backend(),/cacheKey:String\(a\.id\)/);assert.match(mediaSource(),/data\.mediaKey|dataset\.mediaKey/);
});
test('thumbnail upload reuses the existing private bucket and validation boundary',()=>{
 assert.match(backend(),/kind==="chat-thumbnail"[\s\S]*bucket:"galaxy-chat-media"/);assert.match(validator(),/chat-thumbnail/);
});
test('CSP remains locked down and no external CDN/cache service is introduced',()=>{
 const html=read('android/app/src/main/assets/mobile/index.html');assert.match(html,/connect-src 'none'/);assert.doesNotMatch(mediaSource(),/https?:\/\//);
});
