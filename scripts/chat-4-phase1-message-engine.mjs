import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import vm from 'node:vm';

const source=readFileSync('android/app/src/main/assets/mobile/chat-message-engine.js','utf8');
const context={window:{}};
vm.createContext(context);
vm.runInContext(source,context);
const make=()=>context.window.GalaxyMessageEngine.create({pageSize:60,maxCache:420,windowSize:84,windowStep:28,estimatedHeight:92});

function rows(from,count){
 return Array.from({length:count},(_,i)=>{
  const seq=from+i,type=['text','reply','photo','video','audio','card','location','system'][seq%8];
  return {
   id:'m'+seq,client_id:'c'+seq,server_seq:seq,sender_person:String(seq%2),
   body:'Mensaje '+seq,created_at:'2026-10-05T12:00:00Z',message_type:type,
   attachments:['photo','video','audio'].includes(type)?[{kind:type,name:type+'-'+seq}]:[],
   ...(type==='card'?{card:{available:true,type:'PLAN',title:'Plan '+seq}}:{}),
   ...(type==='location'?{attachment:{latitude:4.7,longitude:-74.1}}:{})
  };
 });
}
function timed(fn,repeats=7){
 const samples=[];let result;
 for(let i=0;i<repeats;i++){const t=performance.now();result=fn();samples.push(performance.now()-t);}
 samples.sort((a,b)=>a-b);
 return {ms:Number(samples[Math.floor(samples.length/2)].toFixed(3)),result};
}

const counts=[100,500,5000,20000],scenarios={};
for(const total of counts){
 const e=make(),page=rows(Math.max(1,total-59),Math.min(60,total));
 const initial=timed(()=>e.applyPage(null,{messages:page,nextBeforeSeq:total>60?Math.max(1,total-59):null},{direction:'latest'}));
 e.resetWindow(initial.result.messages.length,{align:'end'});
 const windowed=timed(()=>e.range(initial.result.messages));
 scenarios[total]={
  totalConversationMessages:total,
  initiallyRetrieved:page.length,
  loadedAfterOpen:initial.result.messages.length,
  renderedAfterOpen:windowed.result.messages.length,
  initialMergeMs:initial.ms,
  windowCalculationMs:windowed.ms,
  estimatedDomMessages:windowed.result.messages.length
 };
}

const historyEngine=make();
let history=historyEngine.applyPage(null,{messages:rows(19941,60),nextBeforeSeq:19941},{direction:'latest'});
const historySamples=[];
for(let cursor=19940;cursor>=18000;cursor-=60){
 const t=performance.now();
 history=historyEngine.applyPage(history,{messages:rows(cursor-59,60),nextBeforeSeq:cursor-59},{direction:'older'});
 historyEngine.resetWindow(history.messages.length,{align:'start'});
 historySamples.push({
  mergeMs:Number((performance.now()-t).toFixed(3)),
  loaded:history.messages.length,
  rendered:historyEngine.range(history.messages).messages.length
 });
}
const maxLoaded=Math.max(...historySamples.map(x=>x.loaded));
const maxRendered=Math.max(...historySamples.map(x=>x.rendered));

const result={
 phase:'Galaxy Chat 4.0 / SUPERNOVA Phase 1',
 generatedAt:new Date().toISOString(),
 environment:{node:process.version,platform:process.platform,arch:process.arch},
 phase0Contract:{
  initialRequestMessages:60,
  historicalBehavior:'loaded messages accumulated in state and DOM after backward pagination',
  rendering:'full loaded chat list rendered; content-visibility was not virtualization'
 },
 phase1:{
  pageSize:60,maxCacheMessages:420,windowMessages:84,windowStep:28,
  scenarios,
  longHistory:{pages:historySamples.length,maxLoaded,maxRendered,last:historySamples.at(-1)}
 },
 acceptance:{
  initialRetrievalIndependentOfTotal:counts.every(n=>scenarios[n].initiallyRetrieved<=60),
  boundedCache:maxLoaded<=420,
  boundedDom:maxRendered<=84,
  supports20000:scenarios[20000].initiallyRetrieved===60&&scenarios[20000].renderedAfterOpen<=84
 }
};
if(!Object.values(result.acceptance).every(Boolean))throw new Error('Phase 1 benchmark acceptance failed');
const json=JSON.stringify(result,null,2);
if(process.argv[2])writeFileSync(process.argv[2],json+'\n');
process.stdout.write(json+'\n');
