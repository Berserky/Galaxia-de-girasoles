(()=>{
'use strict';

const OUTBOX_KEY='nuestra-galaxia.chat-outbox.v3';
const baseLoadChat=loadChat;
const basePresenceLabel=chatPresenceLabel;
const syncInFlight=new Set();
const syncSeen=new Map();

function rawReadOutbox(){
 try{
  const rows=JSON.parse(localStorage.getItem(OUTBOX_KEY)||'[]');
  return Array.isArray(rows)?rows.map(row=>({...row,_localState:row._localState||'PENDING'})):[];
 }catch{return[];}
}
function rawWriteOutbox(rows){
 try{localStorage.setItem(OUTBOX_KEY,JSON.stringify((rows||[]).slice(-120)));}catch{}
}
function deliveryPayload(item){
 return {
  clientId:item.client_id,clientCreatedAt:item.client_created_at,body:item.body||'',replyTo:item.reply_to||null,messageType:item.message_type||'text',
  attachments:item.attachments||[],attachment:item.attachment||{},entityRef:item.entityRef||null,scheduledAt:item.scheduled_at||null,silent:item.silent===true,
  ttlSeconds:item.ttl_seconds||null,viewOnce:item.view_once===true,effect:item.effect||null,retryCount:Number(item.retryCount||0)
 };
}
function renderDeliveryChange(event){
 if(view!=='chat'||event.type==='reconciled')return;
 const el=document.querySelector('#chatMessages'),anchor=chatCaptureAnchor(el);
 if(event.type==='queued'||event.type==='manual-retry'){
  chatMessageEngine.resetWindow(chatRows().length,{align:'end'});
  chatRenderMessages({scroll:'bottom'});
  return;
 }
 chatMessageEngine.ensureWindow(chatRows().length);
 chatRenderMessages({anchor,scroll:chatNearBottom(el)?'bottom':'preserve'});
}
function applyConfirmation(message,meta={}){
 if(!message)return;
 window.GalaxyChatPerf?.confirmed?.(meta.clientId||message.client_id);
 const el=document.querySelector('#chatMessages'),anchor=chatCaptureAnchor(el),wasNear=chatNearBottom(el);
 const next=chatMessageEngine.applySingle(chatState||{messages:[],unread:0,pinnedIds:[]},message);
 const signature=chatSignature(next),changed=signature!==chatStateSignature;
 chatState=next;chatStateSignature=signature;
 if(view==='chat'&&changed){
  const total=chatRows().length;
  if(wasNear)chatMessageEngine.resetWindow(total,{align:'end'});
  else chatMessageEngine.ensureWindow(total);
  chatRenderMessages({anchor,scroll:wasNear?'bottom':'preserve'});
 }
}
function emitMetric(entry){
 if(!native.paired)return;
 if(!['queued','sending','sent','failed','retry'].includes(entry.event))return;
 api('chat-metric',{
  event:entry.event,retryCount:Number(entry.retryCount||0),failureCode:entry.failureCode||null,
  sendLatencyMs:Number.isFinite(Number(entry.durationMs))?Number(entry.durationMs):null
 }).catch(()=>{});
}

const engine=window.GalaxyDeliveryEngine.create({
 load:rawReadOutbox,
 save:rawWriteOutbox,
 online:()=>!!native.paired&&navigator.onLine!==false,
 send:item=>api('chat-send',deliveryPayload(item)),
 onChange:renderDeliveryChange,
 onConfirm:applyConfirmation,
 onMetric:emitMetric,
 maxQueue:120,maxRetries:8,baseDelayMs:900,maxDelayMs:30000
});
window.GalaxyChatDelivery=engine;

readChatOutbox=rawReadOutbox;
writeChatOutbox=rawWriteOutbox;
patchLocalMessage=(clientId,patch)=>engine.patch(clientId,patch,'patch');
flushChatOutbox=({retryFailed=false}={})=>engine.flush({retryFailed});

queueChatMessage=function({body='',messageType='text',attachments=[],attachment={},entityRef=null,card=null,scheduledAt=null,silent=false,ttlSeconds=null,viewOnce=false,effect=null}={}){
 const clean=String(body||'').trim();
 if(!clean&&messageType==='text'&&!attachments.length)return;
 if(messageType==='card'&&!entityRef)return;
 const clientId=crypto.randomUUID(),created=new Date().toISOString();
 window.GalaxyChatPerf?.optimisticStart?.(clientId);
 engine.queue({
  client_id:clientId,client_created_at:created,body:clean,reply_to:chatReply?.id||null,message_type:messageType,attachments,attachment,entityRef,card,
  scheduled_at:scheduledAt,silent,ttl_seconds:ttlSeconds,view_once:viewOnce,effect,_localState:'PENDING',retryCount:0,local_order:Date.now()
 });
 chatReply=null;chatAttachmentsDraft=[];writeChatDraft('');
 if(view==='chat')requestAnimationFrame(()=>window.GalaxyChatPerf?.optimisticVisible?.(clientId));
 engine.flush().catch(()=>{});
};

loadChat=async function(options={}){
 const result=await baseLoadChat(options);
 for(const message of chatState?.messages||[])engine.reconcile(message,{source:options.syncId?'realtime':'state'});
 return result;
};

chatPresenceLabel=function(){
 if(navigator.onLine===false){
  const pending=engine.snapshot().total;
  return pending?'Sin conexión · '+pending+' pendiente'+(pending===1?'':'s'):'Sin conexión';
 }
 return basePresenceLabel();
};

async function consumeSync(id){
 const messageId=String(id||'');if(!messageId)return;
 const stamp=Number(syncSeen.get(messageId)||0),now=Date.now();
 if(stamp&&now-stamp<15000)return;
 if(syncInFlight.has(messageId))return;
 syncInFlight.add(messageId);
 try{
  if(view==='chat')await loadChat({quiet:true,syncId:messageId});
  else await refreshChatBadge();
  syncSeen.set(messageId,Date.now());
  if(syncSeen.size>120){
   for(const [key,value] of syncSeen){if(Date.now()-Number(value)>60000)syncSeen.delete(key);}
  }
 }finally{syncInFlight.delete(messageId);}
}
const baseNativeEvent=GalaxyNative.event.bind(GalaxyNative);
GalaxyNative.event=function(name,json){
 if(name!=='chat-sync')return baseNativeEvent(name,json);
 if(!native.paired)return;
 let data={};try{data=JSON.parse(json||'{}');}catch{}
 consumeSync(String(data.entityId||'')).catch(()=>{});
};

document.addEventListener('click',event=>{
 const button=event.target.closest?.('[data-action="chat-retry"],[data-action="chat-local-delete"]');
 if(!button)return;
 event.preventDefault();event.stopImmediatePropagation();
 if(button.dataset.action==='chat-retry')engine.retry(button.dataset.clientId).catch(()=>{});
 else engine.remove(button.dataset.clientId,{reason:'local-delete'});
},true);

window.addEventListener('online',()=>{
 if(!native.paired)return;
 engine.kick().catch(()=>{});
 const label=document.querySelector('.chat-contact small');if(label)label.textContent=chatPresenceLabel();
});
window.addEventListener('offline',()=>{
 const label=document.querySelector('.chat-contact small');if(label)label.textContent=chatPresenceLabel();
});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='visible'){engine.recover();engine.kick().catch(()=>{});}
});

engine.recover();
if(native.paired)engine.kick().catch(()=>{});
})();