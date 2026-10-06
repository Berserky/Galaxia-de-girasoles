(()=>{
'use strict';
function create(options={}){
 const maxEntries=Math.max(8,Number(options.maxEntries||96));
 const maxConcurrent=Math.max(1,Number(options.maxConcurrent||4));
 const preloadMargin=Math.max(120,Number(options.preloadMargin||720));
 let root=null,observer=null,visibleObserver=null,active=0,clock=0,generation=0;
 const cache=new Map(),pending=new Map(),queue=[];
 const metrics={requests:0,cacheHits:0,deduped:0,evictions:0,failed:0,cancelled:0,videoStarts:0,audioStarts:0,originalOpens:0};
 const note=(type,data={})=>window.GalaxyChatPerf?.note?.('media-'+type,data);
 const keyOf=(node,variant='thumb')=>{
  const base=String(node?.dataset?.mediaKey||node?.dataset?.attachmentId||node?.dataset?.mediaOriginal||'media');
  return base+':'+variant;
 };
 function touch(key){
  const hit=cache.get(key);if(!hit)return null;
  hit.used=++clock;cache.delete(key);cache.set(key,hit);return hit;
 }
 function remember(key,url){
  if(!key||!url)return url;
  cache.delete(key);cache.set(key,{url,used:++clock});
  while(cache.size>maxEntries){
   const oldest=cache.keys().next().value;cache.delete(oldest);metrics.evictions++;note('evict',{entries:cache.size});
  }
  return url;
 }
 function cachedUrl(key){
  const hit=touch(key);if(!hit)return '';
  metrics.cacheHits++;note('cache-hit',{entries:cache.size});return hit.url;
 }
 function pump(){
  if(!globalThis.Image)return;
  queue.sort((a,b)=>a.priority-b.priority||a.seq-b.seq);
  while(active<maxConcurrent&&queue.length){
   const job=queue.shift();
   if(job.cancelled||!job.wanted()){job.cancelled=true;pending.delete(job.key);job.reject(Error('cancelled'));metrics.cancelled++;continue;}
   active++;metrics.requests++;note('request',{active,priority:job.priority});
   const image=new Image();job.image=image;
   if('decoding'in image)image.decoding='async';
   const finish=(ok)=>{
    image.onload=null;image.onerror=null;active=Math.max(0,active-1);pending.delete(job.key);
    if(ok){remember(job.key,job.url);job.resolve(job.url);}
    else{metrics.failed++;job.reject(Error('media-load-failed'));}
    pump();
   };
   image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=job.url;
  }
 }
 function preloadImage(key,url,priority=1,wanted=()=>true){
  if(!url)return Promise.reject(Error('missing-media-url'));
  const hit=cachedUrl(key);if(hit)return Promise.resolve(hit);
  const existing=pending.get(key);
  if(existing){metrics.deduped++;note('dedupe',{pending:pending.size});return existing.promise;}
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  const job={key,url,priority:Number(priority||0),wanted,resolve,reject,promise,seq:++clock,cancelled:false,image:null};
  pending.set(key,job);queue.push(job);pump();return promise;
 }
 function assignImage(node,priority=1){
  if(!node?.isConnected||node.dataset.mediaWanted==='false')return;
  const thumb=String(node.dataset.mediaThumbnail||''),original=String(node.dataset.mediaOriginal||'');
  const url=thumb||original;if(!url)return;
  const variant=thumb?'thumb':'fallback-original',key=keyOf(node,variant);
  node.dataset.mediaWanted='true';node.dataset.mediaVariant=variant;
  preloadImage(key,url,priority,()=>node.isConnected&&node.dataset.mediaWanted!=='false')
   .then(value=>{
    if(!node.isConnected||node.dataset.mediaWanted==='false')return;
    if(node.getAttribute('src')!==value)node.setAttribute('src',value);
    node.dataset.mediaLoaded='true';node.dataset.mediaError='false';node.closest?.('.chat-photo-card')?.removeAttribute('data-media-error');
   })
   .catch(error=>{if(error?.message!=='cancelled'&&node.isConnected){node.dataset.mediaError='true';node.closest?.('.chat-photo-card')?.setAttribute('data-media-error','true');}});
 }
 function assignPoster(node,priority=1){
  if(!node?.isConnected||node.dataset.mediaWanted==='false')return;
  const thumb=String(node.dataset.mediaThumbnail||'');if(!thumb)return;
  const key=keyOf(node,'thumb');node.dataset.mediaWanted='true';
  preloadImage(key,thumb,priority,()=>node.isConnected&&node.dataset.mediaWanted!=='false')
   .then(value=>{if(node.isConnected&&node.dataset.mediaWanted!=='false'){node.poster=value;node.dataset.mediaPosterLoaded='true';node.dataset.mediaError='false';node.closest?.('.chat-video-shell')?.removeAttribute('data-media-error');}})
   .catch(error=>{if(error?.message!=='cancelled'&&node.isConnected){node.dataset.mediaError='true';node.closest?.('.chat-video-shell')?.setAttribute('data-media-error','true');}});
 }
 function requestNode(node,priority=1){
  if(!node)return;
  const kind=String(node.dataset.mediaKind||'photo');
  if(kind==='video')assignPoster(node,priority);else if(kind==='photo'||kind==='gif'||kind==='card-image')assignImage(node,priority);
 }
 function releaseNode(node){
  if(!node)return;node.dataset.mediaWanted='false';
  const kind=String(node.dataset.mediaKind||'');
  if(kind==='video'){
   try{node.pause?.();}catch{}
   if(node.hasAttribute('src')){node.removeAttribute('src');try{node.load?.();}catch{}}
   node.dataset.mediaActive='false';
  }else if((kind==='photo'||kind==='gif'||kind==='card-image')&&!node.dataset.mediaThumbnail){
   node.removeAttribute('src');node.dataset.mediaLoaded='false';
  }
 }
 function inViewport(node,container){
  if(!node?.getBoundingClientRect||!container?.getBoundingClientRect)return false;
  const a=node.getBoundingClientRect(),b=container.getBoundingClientRect();
  return a.bottom>=b.top&&a.top<=b.bottom;
 }
 function mount(container){
  detach({release:false});root=container||null;generation++;
  if(!root)return;
  const nodes=[...root.querySelectorAll('[data-chat-media]')];
  if(!globalThis.IntersectionObserver){nodes.slice(0,12).forEach(node=>requestNode(node,0));return;}
  observer=new IntersectionObserver(entries=>{
   for(const entry of entries){
    if(entry.isIntersecting){entry.target.dataset.mediaWanted='true';requestNode(entry.target,1);}
    else releaseNode(entry.target);
   }
  },{root,rootMargin:preloadMargin+'px 0px',threshold:0.01});
  visibleObserver=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){entry.target.dataset.mediaWanted='true';requestNode(entry.target,0);}
  },{root,rootMargin:'0px',threshold:0.01});
  for(const node of nodes){observer.observe(node);visibleObserver.observe(node);if(inViewport(node,root))requestNode(node,0);}
 }
 function detach({release=true}={}){
  observer?.disconnect();visibleObserver?.disconnect();observer=null;visibleObserver=null;
  if(root&&release)for(const node of root.querySelectorAll('[data-chat-media]'))releaseNode(node);
  root=null;generation++;
  for(const job of queue)if(!job.wanted()){job.cancelled=true;metrics.cancelled++;}
 }
 async function activateVideo(video,{autoplay=true}={}){
  if(!video)return false;
  const url=String(video.dataset.mediaOriginal||'');if(!url)return false;
  if(video.getAttribute('src')!==url){video.preload='metadata';video.src=url;video.dataset.mediaActive='true';try{video.load();}catch{}}
  metrics.videoStarts++;note('video-start',{active:1});
  if(autoplay)try{await video.play();}catch{}
  return true;
 }
 async function activateAudio(audio,{autoplay=true}={}){
  if(!audio)return false;
  const url=String(audio.dataset.mediaOriginal||'');if(!url)return false;
  if(audio.getAttribute('src')!==url){audio.preload='metadata';audio.src=url;try{audio.load();}catch{}}
  metrics.audioStarts++;note('audio-start',{active:1});
  if(autoplay)try{await audio.play();}catch{}
  return true;
 }
 function promoteImage(image,{key='',url=''}={}){
  if(!image||!url)return Promise.reject(Error('missing-media-url'));
  metrics.originalOpens++;note('original-open',{count:metrics.originalOpens});
  const stable=(key||image.dataset.mediaKey||url)+':original';
  image.dataset.mediaWanted='true';
  return preloadImage(stable,url,0,()=>image.isConnected&&image.dataset.mediaWanted!=='false').then(value=>{
   if(image.isConnected){image.src=value;image.dataset.mediaLoaded='true';image.dataset.mediaVariant='original';}
   return value;
  });
 }
 function retry(node){
  if(!node)return;node.dataset.mediaError='false';node.dataset.mediaWanted='true';
  for(const variant of ['thumb','fallback-original'])cache.delete(keyOf(node,variant));
  requestNode(node,0);
 }
 function invalidate(baseKey){
  const base=String(baseKey||'');if(!base)return;
  for(const key of [...cache.keys()])if(key===base||key.startsWith(base+':'))cache.delete(key);
  for(const [key,job] of pending)if(key===base||key.startsWith(base+':')){job.cancelled=true;pending.delete(key);}
  if(root)for(const node of root.querySelectorAll('[data-chat-media]'))if(String(node.dataset.mediaKey||'')===base)releaseNode(node);
  note('invalidate',{entries:cache.size});
 }
 function memoryPressure(){
  cache.clear();
  for(const job of queue)job.cancelled=true;
  queue.splice(0,queue.length);metrics.cancelled+=pending.size;
  if(root)for(const node of root.querySelectorAll('[data-chat-media]'))if(!inViewport(node,root))releaseNode(node);
  note('memory-pressure',{entries:0});
 }
 function stats(){return {...metrics,cacheEntries:cache.size,pending:pending.size,queued:queue.length,active,generation};}
 return {mount,detach,activateVideo,activateAudio,promoteImage,retry,invalidate,memoryPressure,stats,preloadImage};
}
window.GalaxyChatMedia={create};
})();