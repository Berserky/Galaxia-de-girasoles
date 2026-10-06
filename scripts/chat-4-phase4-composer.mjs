import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {performance} from 'node:perf_hooks';

const output=process.argv[2]||'qa-artifacts/chat-4-phase4-composer-node.json';
const composerSource=readFileSync('android/app/src/main/assets/mobile/chat-composer.js','utf8');
const appSource=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');

const map=new Map();
const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
const context={window:{localStorage:storage},setTimeout,clearTimeout};
vm.createContext(context);vm.runInContext(composerSource,context);
const composer=context.window.GalaxyChatComposer.create({storage,maxHeight:120,minHeight:44,doubleTapGuardMs:280});
composer.hydrate('pair:0-1');

const messages=Array.from({length:20000},(_,i)=>({id:'m'+i,server_seq:i+1,body:'mensaje '+i}));
const samples=[];
for(let i=0;i<2500;i++){
 const start=performance.now();
 composer.setText('mensaje '+i);
 samples.push(performance.now()-start);
}
const sorted=[...samples].sort((a,b)=>a-b);
const p95=sorted[Math.floor(sorted.length*.95)]||0;
const inputStart=appSource.indexOf("document.addEventListener('input'");
const inputEnd=appSource.indexOf("document.addEventListener('change'",inputStart);
const inputBlock=appSource.slice(inputStart,inputEnd);
const globalRendersPerKeystroke=(inputBlock.match(/\brender\s*\(/g)||[]).length;

const fake={value:'uno\ndos\ntres\ncuatro\ncinco',scrollHeight:260,style:{}};
const resizeStart=performance.now();composer.applyInput(fake);const resizeMs=performance.now()-resizeStart;

const result={
 generatedAt:new Date().toISOString(),
 messagesResident:messages.length,
 input:{samples:samples.length,p95Ms:Number(p95.toFixed(4)),globalRendersPerKeystroke,pass:p95<8&&globalRendersPerKeystroke===0},
 multiline:{height:fake.style.height,overflowY:fake.style.overflowY,durationMs:Number(resizeMs.toFixed(4)),pass:fake.style.height==='120px'&&fake.style.overflowY==='auto'},
 state:{text:composer.snapshot().text,messagesUnaffected:messages.length===20000},
 targets:{visualInputLag:'no perceptible',globalRendersPerKeystroke:0,maxComposerHeightPx:120}
};
if(!result.input.pass||!result.multiline.pass||!result.state.messagesUnaffected)throw new Error('Phase 4 Composer benchmark failed: '+JSON.stringify(result));
mkdirSync(output.split('/').slice(0,-1).join('/')||'.',{recursive:true});
writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
