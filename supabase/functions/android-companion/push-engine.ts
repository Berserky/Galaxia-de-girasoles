export const PUSH_EVENT_TYPES=[
 "gesture","arrived_safe","nearby","capsule","note","reminder",
 "chat_message","status_changed","mood_changed","daily_answer",
 "goal_update","memory_shared","plan_update"
];
const MAX_TTL_SECONDS=86400;
const cachedTokens=new Map<string,{value:string,expiresAt:number}>();

const clean=(value:unknown,max:number)=>String(value??"").trim().slice(0,max);
const base64Url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const utf8=(value:string)=>new TextEncoder().encode(value);

export function sanitizePushPayload(eventType:unknown,payload:any={}){
 const type=clean(eventType,40);
 if(!PUSH_EVENT_TYPES.includes(type))throw new Error("Tipo de evento push no válido.");
 const source=payload&&typeof payload==="object"&&!Array.isArray(payload)?payload:{};
 const out:Record<string,string>={
  eventType:type,
  eventId:clean(source.eventId,80),
  title:clean(source.title,80),
  body:clean(source.body,180)
 };
 if(source.icon)out.icon=clean(source.icon,40);
 if(source.behavior&&["message","haptic","message_haptic"].includes(String(source.behavior)))out.behavior=String(source.behavior);
 if(source.gestureId)out.gestureId=clean(source.gestureId,80);
 if(source.action)out.action=clean(source.action,80);
 if(source.senderName)out.senderName=clean(source.senderName,80);
 if(source.entityType)out.entityType=clean(source.entityType,80);
 if(source.entityId)out.entityId=clean(source.entityId,160);
 // Never send state or coordinates through the generic push envelope.
 for(const forbidden of ["latitude","longitude","battery","song","listening","speed","heading","location"]){
  if(Object.hasOwn(source,forbidden))throw new Error("El evento push contiene datos privados no permitidos.");
 }
 return Object.fromEntries(Object.entries(out).filter(([,value])=>value!==""));
}

function pemBytes(pem:string){
 const body=pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s+/g,"");
 if(!body)throw new Error("Credencial FCM no válida.");
 const raw=atob(body),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 return bytes;
}

export async function serviceAccountAccessToken(credentials:any,scope="https://www.googleapis.com/auth/firebase.messaging"){
 const cached=cachedTokens.get(scope);
 if(cached&&cached.expiresAt>Date.now()+60000)return cached.value;
 const email=clean(credentials?.client_email,300),privateKey=String(credentials?.private_key||"");
 if(!email||!privateKey)throw new Error("Credencial FCM incompleta.");
 const now=Math.floor(Date.now()/1000);
 const header=base64Url(utf8(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const claims=base64Url(utf8(JSON.stringify({iss:email,scope,aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600})));
 const signingInput=header+"."+claims;
 const key=await crypto.subtle.importKey("pkcs8",pemBytes(privateKey),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,utf8(signingInput)));
 const assertion=signingInput+"."+base64Url(signature);
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"urn:ietf:params:oauth2:grant-type:jwt-bearer",assertion})
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok||!json.access_token)throw new Error("Firebase OAuth "+response.status);
 const value=String(json.access_token),expiresAt=Date.now()+Math.max(300,Number(json.expires_in)||3600)*1000;
 cachedTokens.set(scope,{value,expiresAt});
 return value;
}

const decodeConfig=(value:string)=>{
 const normalized=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
 const padded=normalized+"=".repeat((4-normalized.length%4)%4);
 return JSON.parse(atob(padded));
};

export async function firebaseAndroidClientConfig(credentials:any,packageName:string){
 const projectId=clean(credentials?.project_id,160),pkg=clean(packageName,200);
 if(!projectId||!pkg)throw new Error("Firebase no está configurado.");
 const token=await serviceAccountAccessToken(credentials,"https://www.googleapis.com/auth/cloud-platform");
 const base="https://firebase.googleapis.com/v1beta1/projects/"+encodeURIComponent(projectId);
 const headers={authorization:"Bearer "+token,"content-type":"application/json"};
 const listApps=async()=>{
  const response=await fetch(base+"/androidApps?pageSize=100",{headers});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error("Firebase Management "+response.status);
  return Array.isArray(body.apps)?body.apps:[];
 };
 let app=(await listApps()).find((x:any)=>String(x.packageName||"")===pkg);
 if(!app){
  const response=await fetch(base+"/androidApps",{method:"POST",headers,body:JSON.stringify({displayName:"Nuestra Galaxia Android",packageName:pkg})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error("Firebase Android app "+response.status);
  for(let i=0;i<8&&!app;i++){
   await new Promise(resolve=>setTimeout(resolve,750));
   app=(await listApps()).find((x:any)=>String(x.packageName||"")===pkg);
  }
 }
 if(!app?.name)throw new Error("Firebase Android app no disponible.");
 const response=await fetch("https://firebase.googleapis.com/v1beta1/"+String(app.name)+"/config",{headers});
 const body=await response.json().catch(()=>({}));
 if(!response.ok||!body.configFileContents)throw new Error("Firebase Android config "+response.status);
 const config=decodeConfig(String(body.configFileContents)),client=(config.client||[]).find((x:any)=>String(x?.client_info?.android_client_info?.package_name||"")===pkg)||(config.client||[])[0]||{};
 const out={
  projectId:clean(config?.project_info?.project_id||projectId,160),
  senderId:clean(config?.project_info?.project_number,80),
  applicationId:clean(client?.client_info?.mobilesdk_app_id,200),
  apiKey:clean(client?.api_key?.[0]?.current_key,300)
 };
 if(!out.projectId||!out.senderId||!out.applicationId||!out.apiKey)throw new Error("Firebase Android config incompleta.");
 return out;
}

export async function sendFcmData(credentials:any,registrationToken:string,eventType:string,payload:any,ttlSeconds=600){
 const projectId=clean(credentials?.project_id,160),token=clean(registrationToken,4096);
 if(!projectId||!token)throw new Error("FCM no está configurado.");
 const accessToken=await serviceAccountAccessToken(credentials);
 const data=sanitizePushPayload(eventType,payload);
 const ttl=Math.max(0,Math.min(MAX_TTL_SECONDS,Math.floor(Number(ttlSeconds)||600)));
 const response=await fetch("https://fcm.googleapis.com/v1/projects/"+encodeURIComponent(projectId)+"/messages:send",{
  method:"POST",
  headers:{authorization:"Bearer "+accessToken,"content-type":"application/json"},
  body:JSON.stringify({message:{token,data,android:{priority:"HIGH",ttl:ttl+"s"}}})
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok){
  const message=JSON.stringify(json).slice(0,800);
  const error:any=new Error("FCM "+response.status+" "+message);
  error.status=response.status;
  error.code=clean(json?.error?.details?.[0]?.errorCode||json?.error?.status,80);
  throw error;
 }
 return {name:clean(json?.name,300)};
}
