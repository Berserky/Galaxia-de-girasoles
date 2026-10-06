(()=>{
'use strict';
const DEFAULTS={draftPrefix:'nuestra-galaxia.chat-draft.v4',maxHeight:120,minHeight:44,doubleTapGuardMs:280};
const replyCopy=v=>v?{id:v.id||null,sender_person:v.sender_person==null?null:v.sender_person,body:String(v.body||''),message_type:String(v.message_type||'text'),deleted_at:v.deleted_at||null}:null;
function create(options={}){
 const config={...DEFAULTS,...options},storage=options.storage||window.localStorage||null;
 let lastSubmitAt=0;
 let state={conversationKey:'',text:'',replyTarget:null,attachmentIntent:null,recordingIntent:'idle',disabled:false,sending:false,multiline:false,keyboard:{open:false,height:0},height:config.minHeight};
 const storageKey=key=>config.draftPrefix+':'+encodeURIComponent(String(key||'default'));
 const readDraft=key=>{try{return String(storage&&storage.getItem(storageKey(key))||'');}catch{return'';}};
 const writeDraft=(key,value)=>{try{if(!storage)return;if(value)storage.setItem(storageKey(key),String(value));else storage.removeItem(storageKey(key));}catch{}};
 const snapshot=()=>({...state,replyTarget:replyCopy(state.replyTarget),keyboard:{...state.keyboard}});
 function hydrate(key){
  key=String(key||'default');if(state.conversationKey===key)return snapshot();
  state={...state,conversationKey:key,text:readDraft(key),replyTarget:null,attachmentIntent:null,recordingIntent:'idle',sending:false,multiline:false,height:config.minHeight};
  state.multiline=state.text.includes('\n');return snapshot();
 }
 function setText(value,{persist=true}={}){state.text=String(value==null?'':value);state.multiline=state.text.includes('\n');if(persist&&state.conversationKey)writeDraft(state.conversationKey,state.text);return snapshot();}
 function setReply(value){state.replyTarget=replyCopy(value);return snapshot();}
 function cancelReply(){state.replyTarget=null;return snapshot();}
 function setAttachmentIntent(value){state.attachmentIntent=value?String(value):null;return snapshot();}
 function setRecordingIntent(value){state.recordingIntent=String(value||'idle');return snapshot();}
 function setDisabled(value){state.disabled=!!value;return snapshot();}
 function setSending(value){state.sending=!!value;return snapshot();}
 function setKeyboard(open,height=0){state.keyboard={open:!!open,height:Math.max(0,Number(height)||0)};return snapshot();}
 function canSend(attachmentCount=0){return !state.disabled&&(state.text.trim().length>0||Number(attachmentCount)>0);}
 function rightMode(attachmentCount=0){return canSend(attachmentCount)?'send':'voice';}
 function beginSubmit({attachmentCount=0,now=Date.now()}={}){
  const stamp=Number(now)||Date.now();
  if(!canSend(attachmentCount)||state.sending)return false;
  if(lastSubmitAt&&stamp-lastSubmitAt<config.doubleTapGuardMs)return false;
  lastSubmitAt=stamp;state.sending=true;return true;
 }
 function accepted(){
  if(state.conversationKey)writeDraft(state.conversationKey,'');
  state.text='';state.replyTarget=null;state.attachmentIntent=null;state.recordingIntent='idle';state.sending=false;state.multiline=false;state.height=config.minHeight;return snapshot();
 }
 function releaseSubmit(){state.sending=false;return snapshot();}
 function applyInput(textarea,{persist=true,maxHeight=config.maxHeight,minHeight=config.minHeight}={}){
  if(!textarea)return snapshot();
  setText(textarea.value,{persist});
  const max=Math.max(minHeight,Number(maxHeight)||config.maxHeight);
  textarea.style.height='auto';
  const measured=Math.max(minHeight,Number(textarea.scrollHeight)||minHeight),height=Math.min(max,measured);
  textarea.style.height=height+'px';textarea.style.overflowY=measured>max?'auto':'hidden';
  state.height=height;state.multiline=state.text.includes('\n')||measured>minHeight+2;return snapshot();
 }
 return {hydrate,snapshot,setText,setReply,cancelReply,setAttachmentIntent,setRecordingIntent,setDisabled,setSending,setKeyboard,canSend,rightMode,beginSubmit,accepted,releaseSubmit,applyInput,storageKey};
}
window.GalaxyChatComposer=Object.freeze({create});
})();
