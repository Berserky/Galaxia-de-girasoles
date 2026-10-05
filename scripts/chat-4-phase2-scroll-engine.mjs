import {readFileSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import vm from 'node:vm';

const scrollSource=readFileSync('android/app/src/main/assets/mobile/chat-scroll-engine.js','utf8');
const messageSource=readFileSync('android/app/src/main/assets/mobile/chat-message-engine.js','utf8');

function storage(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function scrollEngine(){
 let raf=0;const sessionStorage=storage();
 const ctx={window:{matchMedia:()=>({matches:false}),GalaxyChatPerf:{note(){}}},sessionStorage,
  requestAnimationFrame:fn=>{raf++;fn(raf*16);return raf;},cancelAnimationFrame(){},setTimeout:fn=>{fn();return 1;},clearTimeout(){},Date,Math,JSON,Number,String,Object,Array,Map,Set};
 vm.createContext(ctx);vm.runInContext(scrollSource,ctx);return ctx.window.GalaxyScrollEngine.create();
}
function messageEngine(){
 const ctx={window:{}};vm.createContext(ctx);vm.runInContext(messageSource,ctx);return ctx.window.GalaxyMessageEngine.create({pageSize:60,maxCache:420,windowSize:84,windowStep:28,estimatedHeight:92});
}
function fakeWindow(total=84,height=92){
 const el={scrollTop:0,clientHeight:720,scrollHeight:total*height,isConnected:true,_rows:[]};
 el.getBoundingClientRect=()=>({top:0,bottom:el.clientHeight,height:el.clientHeight});
 el.querySelectorAll=s=>s==='.chat-message'?el._rows:[];
 el.scrollTo=({top})=>{el.scrollTop=top;};
 const rebuild=ids=>{el._rows=ids.map((id,i)=>({dataset:{chatId:id,id},getBoundingClientRect:()=>{const top=i*height-el.scrollTop;return {top,bottom:top+height,height};}}));el.scrollHeight=ids.length*height;};
 rebuild(Array.from({length:total},(_,i)=>'m'+i));
 return {el,rebuild};
}
function median(values){const a=[...values].sort((a,b)=>a-b);return a[Math.floor(a.length/2)];}

const engine=scrollEngine(),{el,rebuild}=fakeWindow(84);
el.scrollTop=2500;engine.bind(el);
const baseAnchor=engine.captureAnchor(el),samples=[],drifts=[];
for(let round=0;round<40;round++){
 const ids=[...Array.from({length:(round+1)*50},(_,i)=>'old-'+i),...Array.from({length:84},(_,i)=>'m'+i)];
 const before=performance.now();rebuild(ids);engine.restoreAnchor(el,baseAnchor,'benchmark-prepend');samples.push(performance.now()-before);
 const after=engine.captureAnchor(el);drifts.push(Math.abs((after?.viewportOffset||0)-(baseAnchor?.viewportOffset||0)));
}

const m=messageEngine(),logical=Array.from({length:20000},(_,i)=>({id:'msg-'+i,server_seq:i+1}));
m.resetWindow(logical.length,{align:'end'});
const range=m.range(logical);

const result={
 phase:'Galaxy Chat 4.0 / SUPERNOVA Phase 2',
 generatedAt:new Date().toISOString(),
 environment:{node:process.version,platform:process.platform,arch:process.arch},
 baseline:{phase0CriticalBug:'global refresh could replace #chatMessages and lose historical viewport',phase1:{maxCache:420,windowMessages:84}},
 phase2:{
  anchorModel:'message_id + viewportOffset',
  prepend50x40:{medianMs:Number(median(samples).toFixed(3)),maxMs:Number(Math.max(...samples).toFixed(3)),maxVisualDriftPx:Number(Math.max(...drifts).toFixed(3))},
  logical20000:{rendered:range.messages.length,topPx:range.topPx,bottomPx:range.bottomPx}
 },
 acceptance:{
  zeroAnchorDrift:Math.max(...drifts)<1,
  boundedRenderedWindow:range.messages.length<=84,
  supports20000:logical.length===20000&&range.messages.length<=84
 }
};
if(!Object.values(result.acceptance).every(Boolean))throw new Error('Phase 2 benchmark acceptance failed');
const json=JSON.stringify(result,null,2);
if(process.argv[2])writeFileSync(process.argv[2],json+'\n');
process.stdout.write(json+'\n');
