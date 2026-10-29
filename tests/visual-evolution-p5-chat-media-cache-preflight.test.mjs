import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {mediaCacheSnapshotExpression,classifyMediaCacheSnapshot} from '../scripts/p5-chat-media-cache-preflight.mjs';

const baseline={view:'chat',rootPresent:true,observerSupported:true,
 mediaNodes:2,visibleNodes:1,wantedNodes:0,loadedNodes:0,errorNodes:0,
 cacheEntries:0,active:0,pending:0,queued:0,requests:0,failed:0};
const check=overrides=>classifyMediaCacheSnapshot(JSON.stringify({...baseline,...overrides}));
test('P5 Phase9: no thumbnail requested after scroll is blocked and diagnosed',()=>{
 const v=check({});
 assert.equal(v.status,'BLOCK_QA');
 assert.equal(v.reason,'MEDIA_NOT_REQUESTED');
 assert.equal(v.androidVerified,false);
});
test('P5 Phase9: pending image decode remains blocked rather than declared success',()=>{
 const v=check({active:1,pending:1,requests:1,wantedNodes:1});
 assert.equal(v.reason,'THUMBNAIL_REQUEST_IN_FLIGHT');
 assert.equal(v.status,'BLOCK_QA');
});
test('P5 Phase9: failed image decode is separated from no request',()=>{
 const v=check({errorNodes:1,requests:1,failed:1});
 assert.equal(v.reason,'THUMBNAIL_LOAD_ERROR');
 assert.equal(v.status,'BLOCK_QA');
});
test('P5 Phase9: zero media DOM and no viewport visibility are separate cases',()=>{
 assert.equal(check({mediaNodes:0,visibleNodes:0,wantedNodes:0}).reason,'NO_RENDERED_MEDIA_NODES');
 assert.equal(check({mediaNodes:2,visibleNodes:0}).reason,'NO_VISIBLE_MEDIA_NODES');
});
test('P5 Phase9: even populated native cache never certifies Android release',()=>{
 const v=check({cacheEntries:2,loadedNodes:1,requests:2});
 assert.equal(v.status,'CACHE_OBSERVED_NATIVE_QA_STILL_REQUIRED');
 assert.equal(v.androidVerified,false);
 assert.equal(v.releaseApproved,false);
});
test('P5 Phase9: reject malformed and inconsistent evidence, not downgrade severity',()=>{
 assert.throws(()=>classifyMediaCacheSnapshot('ERR:ReferenceError'),/WEBVIEW_JS_ERROR/);
 assert.throws(()=>classifyMediaCacheSnapshot('{}'),/MALFORMED/);
 assert.throws(()=>classifyMediaCacheSnapshot('not json'),/NON_JSON/);
 assert.throws(()=>classifyMediaCacheSnapshot(JSON.stringify({...baseline,visibleNodes:3})),/IMPOSSIBLE/);
});
test('P5 Phase9: atomic WebView expression reveals aggregate counters without private media metadata',()=>{
 const root={getBoundingClientRect:()=>({top:0,bottom:600,left:0,right:300}),
 querySelectorAll:()=>[{
  dataset:{mediaWanted:'true',mediaLoaded:'true',mediaKey:'secret-key',
   mediaOriginal:'https://hidden/private?token=secret'},
  getBoundingClientRect:()=>({top:100,bottom:180,left:8,right:150})
 }]};
 const runtime={document:{querySelector:s=>s==='#chatMessages'?root:null},
  chatMediaEngine:{stats:()=>({cacheEntries:1,active:0,pending:0,queued:0,requests:1,failed:0})},
  view:'chat',IntersectionObserver:function(){}};
 const raw=runInNewContext(mediaCacheSnapshotExpression,runtime,{timeout:1500});
 const result=classifyMediaCacheSnapshot(raw);
 assert.equal(result.status,'CACHE_OBSERVED_NATIVE_QA_STILL_REQUIRED');
 assert.equal(result.proof.visibleNodes,1);
 assert.equal(result.proof.loadedNodes,1);
 assert.doesNotMatch(raw,/secret-key|hidden|token|data:image|Media benchmark/);
});
