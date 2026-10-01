import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {fail} from './domain.mjs';
export const scopes={login:'openid email profile',drive:'https://www.googleapis.com/auth/drive.readonly',photos:'https://www.googleapis.com/auth/photospicker.mediaitems.readonly'};
export function seal(data,key) {
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');
}
export function unseal(data,key) {
 const bytes=Buffer.from(data,'base64'),cipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
 cipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString());
}
export async function request(url,options={}) {
 const r=await fetch(url,{...options,signal:AbortSignal.timeout(25000)});
 if(!r.ok) fail(r.status===401 ? 'Vuelve a conectar tu cuenta de Google.' : r.status===403 ? 'Google no dio acceso a este recurso. Revisa los permisos de la cuenta y la carpeta.' : 'Google no pudo completar la solicitud. Intenta de nuevo.',r.status===401?401:502);
 return r;
}
export function googleClient(store,config) {
 const redirect=config.base+'/auth/callback';
 function tokens(email){const row=store.db.prepare('SELECT tokens FROM users WHERE email=?').get(email);return row?.tokens ? unseal(row.tokens,config.key):{};}
 function save(email,t){store.db.prepare('INSERT INTO users VALUES(?,?) ON CONFLICT(email) DO UPDATE SET tokens=excluded.tokens').run(email,seal(t,config.key));}
 async function access(email){let t=tokens(email);if(!t.access_token)fail('Conecta tu cuenta de Google para continuar.',409);if(t.expires_at<Date.now()+60000){if(!t.refresh_token)fail('Vuelve a conectar tu cuenta de Google.',409);const r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,refresh_token:t.refresh_token,grant_type:'refresh_token'})});const n=await r.json();t={...t,...n,expires_at:Date.now()+n.expires_in*1000};save(email,t);}return t.access_token;}
 return {
  tokens,save,redirect,
  async exchange(code,verifier){const r=await request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,code_verifier:verifier,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:redirect,grant_type:'authorization_code'})});const t=await r.json();return {...t,expires_at:Date.now()+t.expires_in*1000};},
  async api(email,url,options={}){return request(url,{...options,headers:{...options.headers,Authorization:`Bearer ${await access(email)}`}});},
  async revoke(email){const t=tokens(email);if(t.refresh_token || t.access_token) await request('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:t.refresh_token||t.access_token})});store.db.prepare('DELETE FROM users WHERE email=?').run(email);}
 };
}
