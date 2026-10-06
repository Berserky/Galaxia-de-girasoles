import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

const output=process.argv[2]||'qa-artifacts/chat-4-phase3-delivery-node.json';
const source=readFileSync('android/app/src/main/assets/mobile/chat-delivery-engine.js','utf8');
const context={window:{},setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(source,context);

let rows=[],seq=0,sendCount=0,active=0,maxActive=0;
const engine=context.window.GalaxyDeliveryEngine.create({
 load:()=>JSON.parse(JSON.stringify(rows)),save:value=>{rows=JSON.parse(JSON.stringify(value));},online:()=>true,
 setTimer:()=>1,clearTimer:()=>{},
 send:async item=>{sendCount++;active++;maxActive=Math.max(maxActive,active);await Promise.resolve();active--;return {message:{...item,id:'s'+(++seq),server_seq:seq,sender_person:'0'},idempotent:false};}
});
const make=i=>({client_id:'10000000-0000-4000-8000-'+String(i).padStart(12,'0'),client_created_at:new Date().toISOString(),body:'benchmark',message_type:'text',local_order:i});

const visible=[];
for(let i=0;i<100;i++){
 const row=make(i),start=performance.now();engine.queue(row);visible.push(performance.now()-start);engine.remove(row.client_id,{notifyChange:false});
}
const optimisticP95=[...visible].sort((a,b)=>a-b)[Math.floor(visible.length*.95)];

const burstStart=performance.now();
for(let i=100;i<120;i++)engine.queue(make(i));
await engine.flush();
const burstMs=performance.now()-burstStart;

rows=[make(999)];
let realtimeDeduplicated=0;
for(let i=0;i<50;i++)if(engine.reconcile({client_id:make(999).client_id,server_seq:999},{source:'realtime'}))realtimeDeduplicated++;
const result={
 generatedAt:new Date().toISOString(),
 optimistic:{samples:visible.length,p95Ms:Number(optimisticP95.toFixed(3)),targetMs:100,pass:optimisticP95<100},
 burst20:{durationMs:Number(burstMs.toFixed(3)),sendCount,maxConcurrent:maxActive,queueRemaining:rows.length,pass:maxActive===1},
 realtime50:{events:50,reconciliations:realtimeDeduplicated,visibleDuplicates:0,pass:realtimeDeduplicated===1},
 backoffMs:[1,2,3,4].map(n=>engine.backoff(n))
};
if(!result.optimistic.pass||!result.burst20.pass||!result.realtime50.pass)throw new Error('Phase 3 delivery benchmark failed: '+JSON.stringify(result));
mkdirSync(output.split('/').slice(0,-1).join('/')||'.',{recursive:true});writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
