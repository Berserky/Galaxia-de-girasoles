/**
 * P5 / Chat Phase9 Android cache timeout: READ-ONLY diagnostics for a future
 * authorized WebView assertion. Does not preload images, scroll, retry,
 * mutate the chat or replace Android instrumentation.
 * Reports aggregate counts only; never exports messages, media URLs or IDs.
 */
export const mediaCacheSnapshotExpression = String.raw\`JSON.stringify((()=>{
 const root=document.querySelector('#chatMessages');
 const nodes=root?[...root.querySelectorAll('[data-chat-media]')]:[];
 const visible=node=>{
  if(!node.getBoundingClientRect||!root?.getBoundingClientRect)return false;
  const a=node.getBoundingClientRect(),b=root.getBoundingClientRect();
  return a.bottom>=b.top&&a.top<=b.bottom&&a.right>=b.left&&a.left<=b.right;
 };
 const stats=typeof chatMediaEngine!=='undefined'&&chatMediaEngine&&
  typeof chatMediaEngine.stats==='function'?chatMediaEngine.stats():null;
 return {
  view:typeof view==='string'?view:'UNKNOWN',
  rootPresent:!!root,
  observerSupported:typeof IntersectionObserver==='function',
  mediaNodes:nodes.length,
  visibleNodes:nodes.filter(visible).length,
  wantedNodes:nodes.filter(n=>n.dataset?.mediaWanted==='true').length,
  loadedNodes:nodes.filter(n=>n.dataset?.mediaLoaded==='true'||n.dataset?.mediaPosterLoaded==='true').length,
  errorNodes:nodes.filter(n=>n.dataset?.mediaError==='true').length,
  cacheEntries:stats?.cacheEntries??null,
  active:stats?.active??null,pending:stats?.pending??null,
  queued:stats?.queued??null,requests:stats?.requests??null,failed:stats?.failed??null
 };
})())\`;

const countFields=['mediaNodes','visibleNodes','wantedNodes','loadedNodes','errorNodes',
 'cacheEntries','active','pending','queued','requests','failed'];
export function classifyMediaCacheSnapshot(raw){
 if(typeof raw!=='string'||!raw.trim())throw Error('BLOCK_QA: EMPTY_MEDIA_CACHE_PROOF');
 if(raw.startsWith('ERR:'))throw Error('BLOCK_QA: WEBVIEW_JS_ERROR');
 let d;
 try{d=JSON.parse(raw);}catch{throw Error('BLOCK_QA: NON_JSON_MEDIA_CACHE_PROOF');}
 if(!d||typeof d!=='object'||Array.isArray(d)||
  typeof d.view!=='string'||typeof d.rootPresent!=='boolean'||
  typeof d.observerSupported!=='boolean'||
  countFields.some(k=>!Number.isSafeInteger(d[k])||d[k]<0))
  throw Error('BLOCK_QA: MALFORMED_MEDIA_CACHE_PROOF');
 if(d.visibleNodes>d.mediaNodes||d.wantedNodes>d.mediaNodes||
  d.loadedNodes>d.mediaNodes||d.errorNodes>d.mediaNodes)
  throw Error('BLOCK_QA: IMPOSSIBLE_MEDIA_COUNTERS');
 const proof={
  view:d.view,rootPresent:d.rootPresent,observerSupported:d.observerSupported,
  ...Object.fromEntries(countFields.map(k=>[k,d[k]]))
 };
 const pending=d.active+d.pending+d.queued;
 let reason;
 if(d.view!=='chat'||!d.rootPresent)reason='CHAT_VIEW_OR_ROOT_NOT_READY';
 else if(!d.mediaNodes)reason='NO_RENDERED_MEDIA_NODES';
 else if(!d.visibleNodes)reason='NO_VISIBLE_MEDIA_NODES';
 else if(d.cacheEntries===0&&d.errorNodes)reason='THUMBNAIL_LOAD_ERROR';
 else if(d.cacheEntries===0&&pending>0)reason='THUMBNAIL_REQUEST_IN_FLIGHT';
 else if(d.cacheEntries===0&&d.requests===0&&d.wantedNodes===0)reason='MEDIA_NOT_REQUESTED';
 else if(d.cacheEntries===0&&d.requests>0)reason='REQUEST_FINISHED_WITHOUT_CACHE';
 else if(d.cacheEntries===0)reason='CACHE_EMPTY_UNCLASSIFIED';
 else reason='CACHE_HAS_ENTRY_REQUIRES_NATIVE_CONFIRMATION';
 return Object.freeze({
  status:d.cacheEntries>0&&d.visibleNodes>0&&d.view==='chat'&&d.rootPresent?
   'CACHE_OBSERVED_NATIVE_QA_STILL_REQUIRED':'BLOCK_QA',
  reason,androidVerified:false,releaseApproved:false,
  proof:Object.freeze(proof)
 });
}
