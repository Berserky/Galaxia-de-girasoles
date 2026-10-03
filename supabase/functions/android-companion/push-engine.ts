export const PUSH_EVENT_TYPES=["gesture","arrived_safe","nearby","capsule","note","reminder"];
const MAX_TTL_SECONDS=86400;
let cachedToken:{value:string,expiresAt:number}|null=null;

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

async function serviceAccountAccessToken(credentials:any){
 if(cachedToken&&cachedToken.expiresAt>Date.now()+60000)return cachedToken.value;
 const email=clean(credentials?.client_email,300),privateKey=String(credentials?.private_key||"");
 if(!email||!privateKey)throw new Error("Credencial FCM incompleta.");
 const now=Math.floor(Date.now()/1000);
 const header=base64Url(utf8(JSON.stringify({alg:"RS256",typ:"JWT"})));
 const claims=base64Url(utf8(JSON.stringify({
  iss:email,
  scope:"https://www.googleapis.com/auth/firebase.messaging",
  aud:"https://oauth2.googleapis.com/token",
  iat:now,
  exp:now+3600
 })));
 const signingInput=header+"."+claims;
 const key=await crypto.subtle.importKey("pkcs8",pemBytes(privateKey),{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["sign"]);
 const signature=new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",key,utf8(signingInput)));
 const assertion=signingInput+"."+base64Url(signature);
 const response=await fetch("https://oauth2.googleapis.com/token",{
  method:"POST",
  headers:{"content-type":"application/x-www-form-urlencoded"},
  body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion})
 });
 const json=await response.json().catch(()=>({}));
 if(!response.ok||!json.access_token)throw new Error("FCM OAuth "+response.status);
 cachedToken={value:String(json.access_token),expiresAt:Date.now()+Math.max(300,Number(json.expires_in)||3600)*1000};
 return cachedToken.value;
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
