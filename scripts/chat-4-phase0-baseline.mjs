import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import vm from 'node:vm';

const app=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');
const css=readFileSync('android/app/src/main/assets/mobile/app.css','utf8');
const edge=readFileSync('supabase/functions/android-companion/index.ts','utf8');
const main=readFileSync('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java','utf8');

function extractFunction(source,name){
 const start=source.indexOf('function '+name+'(');
 if(start<0)throw new Error('Missing function '+name);
 let brace=source.indexOf('{',start),depth=0,quote='',escape=false;
 for(let i=brace;i<source.length;i++){
  const c=source[i];
  if(quote){if(escape)escape=false;else if(c==='\\\\')escape=true;else if(c===quote)quote='';continue;}
  if(c==='"'||c==="'"||c==='\x60'){quote=c;continue;}
  if(c==='{')depth++;else if(c==='}'&&--depth===0)return source.slice(start,i+1);
 }
 throw new Error('Unclosed function '+name);
}
const names=['chatAttachmentMarkup','chatReactionMarkup','chatRichMessageMarkup','chatMessageMarkup','mergeChatOutbox','chatMessagesMarkup'];
const source=names.map(n=>extractFunction(app,n)).join('\n');
const context={
 chatLoading:false,chatState:null,cloud:{person:'0',today:'2026-10-05',locations:[]},
 attr:v=>String(v??'').replaceAll('"','&quot;'),esc:v=>String(v??''),ico:()=>'<i></i>',
 chatOwn:m=>String(m?.sender_person)==='0',chatDelivery:()=>({cls:'sent',text:'Enviado',icon:'check'}),
 chatDay:()=> '5 oct',chatFormatText:v=>String(v??''),chatSmartActionsMarkup:()=>'',chatGalaxyCardMarkup:card=>'<div class="chat-galaxy-card '+String(card?.type||'').toLowerCase()+'"><span>'+String(card?.title||card?.type||'Card')+'</span></div>',
 chatSize:n=>String(n||0)+' B',fmtDateTime:()=>'',readChatOutbox:()=>[],Number,String,Array,Map,Math,JSON
};
vm.createContext(context);vm.runInContext(source,context);

function attachment(kind,i){
 const base={id:'a'+i,kind,name:kind+'-'+i,mime:kind==='photo'?'image/jpeg':kind==='video'?'video/mp4':kind==='audio'?'audio/mp4':'application/pdf',sizeBytes:1024};
 if(kind!=='file')base.url='https://example.invalid/media/'+i;
 if(kind==='audio')base.waveform=[.2,.5,.7,.4,.8];
 return base;
}
function message(i){
 const type=['text','reply','reaction','photo','video','audio','card','location','system','combined'][i%10];
 const m={id:'m'+i,client_id:'c'+i,sender_person:String(i%2),body:'Mensaje '+i,message_type:'text',server_seq:i,created_at:'2026-10-05T12:00:00Z',reactions:[]};
 if(type==='reply')m.reply={id:'m'+Math.max(1,i-1),sender_person:String((i+1)%2),body:'Respuesta previa'};
 if(type==='reaction')m.reactions=[{emoji:'❤',person:'0'},{emoji:'❤',person:'1'}];
 if(['photo','video','audio'].includes(type)){m.message_type=type;m.attachments=[attachment(type,i)];}
 if(type==='card'){m.message_type='card';m.card={available:true,type:['MEMORY','PLAN','GOAL','POLL','CHECKLIST'][i%5],title:'Galaxy Card '+i};}
 if(type==='location'){m.message_type='location';m.attachment={latitude:4.7,longitude:-74.1,label:'Ubicación QA'};}
 if(type==='system'){m.body='Mensaje del sistema '+i;m.system=true;}
 if(type==='combined'){m.message_type='photo';m.attachments=[attachment('photo',i),attachment('audio',i)];m.reactions=[{emoji:'✨',person:'1'}];m.reply={id:'m'+Math.max(1,i-2),sender_person:'1',body:'Contexto'};}
 return m;
}
function median(a){const v=[...a].sort((x,y)=>x-y);return v[Math.floor(v.length/2)];}
function renderMetric(count){
 const rows=Array.from({length:count},(_,i)=>message(i+1));
 context.chatState={messages:rows,nextBeforeSeq:count>60?Math.max(1,count-60):null};
 const times=[];let html='';
 for(let i=0;i<3;i++){const t=performance.now();html=context.chatMessagesMarkup();times.push(performance.now()-t);}
 return {
  messages:count,markupMs:Number(median(times).toFixed(2)),htmlBytes:Buffer.byteLength(html),
  approximateNodes:(html.match(/<[a-z][^>]*>/gi)||[]).length,
  images:(html.match(/<img\b/gi)||[]).length,videos:(html.match(/<video\b/gi)||[]).length,audios:(html.match(/<audio\b/gi)||[]).length
 };
}
const counts=[100,500,5000,20000];
const render=Object.fromEntries(counts.map(n=>[n,renderMetric(n)]));
const phase4=spawnSync(process.execPath,['scripts/benchmark-phase4.mjs'],{encoding:'utf8',maxBuffer:64*1024*1024});
if(phase4.status!==0)throw new Error('Phase 4 benchmark failed: '+phase4.stderr);
const server=JSON.parse(phase4.stdout);
const marker=(s)=>app.includes(s);
const result={
 version:'Galaxy Chat Universe 3.5.1',generatedAt:new Date().toISOString(),
 environment:{node:process.version,platform:process.platform,arch:process.arch},
 dataset:{counts,mix:['text','reply','reaction','photo','video','audio','Galaxy Card','location','system','combined']},
 render,server,
 architecture:{
  initialUiLimit:marker("api('chat-state',{limit:60")?60:null,
  fullChatViewReplacement:marker("app.innerHTML=chatView()"),
  prependHeightDelta:marker("oldTop+(el.scrollHeight-oldHeight)"),
  normalHistoryAnchorRestore:false,
  pollingMs:marker("},25000);")?25000:null,
  lazyImages:marker('loading="lazy"'),
  videoPreloadMetadata:marker('video controls preload="metadata"'),
  audioPreloadMetadata:marker('audio preload="metadata"'),
  contentVisibility:css.includes('content-visibility:auto'),
  nativePhotoPicker:main.includes('PickMultipleVisualMedia(30)'),
  nativeCameraIntent:main.includes('MediaStore.ACTION_IMAGE_CAPTURE'),
  nativeVoiceRecorder:main.includes('new MediaRecorder'),
  serverSeqPagination:edge.includes('.order("server_seq"')&&edge.includes('beforeSeq')
 },
 p0:{
  scrollJumpReproducible:marker("render();\n    requestAnimationFrame")&&marker("else if(wasNear||chatInitialScroll)"),
  cause:'full chat DOM replacement does not restore a history anchor on ordinary refresh when wasNear=false; late media/viewport size changes can amplify displacement'
 },
 targets:{warmOpenMs:500,coldFirstVisibleMs:1200,scrollFps:60,spontaneousScrollJumps:0,visualSendMs:100,globalRerenderOnIncoming:0,incrementalHistoryMessages:20000}
};
const json=JSON.stringify(result,null,2);
if(process.argv[2])writeFileSync(process.argv[2],json+'\n');
process.stdout.write(json+'\n');