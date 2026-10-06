import fs from 'node:fs';
import path from 'node:path';

const output=path.resolve(process.cwd(),process.argv[2]||'docs/qa/chat-4-phase9-media-benchmark.json');
const logicalMessages=20_000,images=500,videos=60;
const rows=Array.from({length:logicalMessages},(_,i)=>{
  if(i%40===0){
    const n=Math.floor(i/40),original=2_800_000+((n*7919)%4_800_000),thumbnail=48_000+((n*1543)%72_000);
    return {kind:'image',original,thumbnail};
  }
  if(i%333===0){
    const n=Math.floor(i/333),original=12_000_000+((n*19001)%24_000_000),thumbnail=62_000+((n*733)%78_000);
    return {kind:'video',original,thumbnail};
  }
  return {kind:'text',original:0,thumbnail:0};
});
const windowSize=84,start=logicalMessages-windowSize,visible=rows.slice(start);
const phase8OriginalRequests=visible.filter(x=>x.kind!=='text').length;
const phase8Bytes=visible.reduce((n,x)=>n+x.original,0);
const phase9ThumbRequests=visible.filter(x=>x.kind!=='text').length;
const phase9Bytes=visible.reduce((n,x)=>n+x.thumbnail,0);
const result={
 measuredAt:new Date().toISOString(),
 benchmark:'deterministic transfer model + virtual-window contract',
 dataset:{logicalMessages,images,videos,renderWindow:windowSize},
 phase8Contract:{bubbleVariant:'original URL in media element',requests:phase8OriginalRequests,bytes:phase8Bytes,originalDownloads:phase8OriginalRequests},
 phase9Contract:{bubbleVariant:'thumbnail only',requests:phase9ThumbRequests,bytes:phase9Bytes,originalDownloads:0,maxConcurrent:4,cacheEntries:96,preloadMarginPx:720},
 delta:{bytesSaved:phase8Bytes-phase9Bytes,percentSaved:phase8Bytes?Math.round((1-phase9Bytes/phase8Bytes)*10000)/100:0,originalDownloadsAvoided:phase8OriginalRequests},
 note:'Transfer values are deterministic dataset modelling, not carrier/network telemetry. Physical FPS/PSS/CPU are measured by Android instrumentation.'
};
fs.mkdirSync(path.dirname(output),{recursive:true});
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
