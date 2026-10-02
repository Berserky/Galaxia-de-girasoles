import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
import {ideas,questionFor,today,validateItem,text,validDate,ics} from './domain.js';
import config from './config.js';
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url||'')&&!!config.key;
const client=configured?createClient(config.url,config.key):null;
const checked=async request=>{const {data,error}=await request;if(error)throw Error(error.message);return data;};
const bucket=()=>client.storage.from('galaxy-photos');
const musicBucket=()=>client.storage.from('galaxy-music');
async function signedMusic(path){if(!path)return '';return (await checked(musicBucket().createSignedUrl(path,3600))).signedUrl;}
function albumUrl(raw){if(!raw)return '';const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||!['photos.app.goo.gl','photos.google.com'].includes(u.hostname))throw Error('Usa el enlace de tu álbum de Google Fotos.');return u.href;}
async function allItems(){const raw=await checked(client.from('galaxy_items').select('*').order('created',{ascending:false}));const rows=raw.map(i=>{const d=validateItem({...i.data,kind:i.kind});if(i.kind==='song'&&i.data.audioPath)d.audioPath=i.data.audioPath;return {...i,data:d};});for(const i of rows){if(i.kind==='song'&&i.data.audioPath)i.data.audioUrl=await signedMusic(i.data.audioPath);}return rows;}
async function settings(){const s=await checked(client.from('galaxy_settings').select('*').eq('id',1).single());s.data.albumUrl=albumUrl(s.data.albumUrl);return s;}
async function person(){let p=await checked(client.rpc('galaxy_person'));const token=sessionStorage.getItem('galaxy-invitation');if(p===null&&token){await checked(client.rpc('galaxy_claim',{token}));sessionStorage.removeItem('galaxy-invitation');p=await checked(client.rpc('galaxy_person'));}if(p===null)throw Error('Este correo no está invitado. Introduce la invitación que te compartió tu pareja.');return p;}
async function photoList(){let files=[],offset=0;for(;;){const page=await checked(bucket().list('',{limit:100,offset,sortBy:{column:'created_at',order:'desc'}}));files.push(...page.filter(f=>f.id));if(page.length<100)break;offset+=100;}if(!files.length)return [];
 const signed=await checked(bucket().createSignedUrls(files.map(f=>f.name),600));
 return files.map((f,i)=>({id:f.name,name:f.name.slice(37),url:signed[i].signedUrl,created:f.created_at}));}
async function updateOne(query){const rows=await checked(query.select('id'));if(!rows.length)throw Error('Cambió en otro dispositivo. Actualiza la página antes de guardar.');return {};}
export async function cloudApi(url,options={}){
 if(!configured)throw Error('Falta conectar el proyecto gratuito de Supabase.');
 const session=(await client.auth.getSession()).data.session;
 if(!session)throw Error('Entra con tu correo para abrir su espacio.');
 const method=options.method||'GET',data=typeof options.body==='string'?JSON.parse(options.body):{};
 if(url==='/api/logout'){await checked(client.auth.signOut());return {};}
 const p=await person();
 if(url==='/api/invite')return {token:await checked(client.rpc('galaxy_invite'))};
 if(url==='/api/state'){
  const [s,items,daily]=await Promise.all([settings(),allItems(),checked(client.rpc('galaxy_daily_read'))]);
  const day=today(),current=daily.filter(d=>d.day===day);
  return {demo:false,cloud:true,person:p,settings:s,items,today:day,question:questionFor(day),ideas,daily:current,allAnswered:current.filter(d=>d.answered).length===2,connections:{google:false,photos:false,drive:false},photoCount:0};
 }
 if(url==='/api/items'&&method==='POST'){const d=validateItem(data);if(data.audioPath)d.audioPath=text(data.audioPath,300,true);return checked(client.from('galaxy_items').insert({kind:d.kind,data:d,author:p}).select().single());}
 if(url.startsWith('/api/items/')){const id=url.split('/').pop();if(method==='DELETE')return updateOne(client.from('galaxy_items').delete().eq('id',id).eq('version',data.version));if(method==='PUT'){const d=validateItem(data);if(data.audioPath)d.audioPath=text(data.audioPath,300,true);return updateOne(client.from('galaxy_items').update({data:d}).eq('id',id).eq('version',data.version));}}
 if(url==='/api/settings'&&method==='PUT'){
  if(!Array.isArray(data.names)||data.names.length!==2)throw Error('Completa los dos nombres.');
  const d={names:data.names.map(n=>text(n,40,true)),startDate:data.startDate||'',albumUrl:albumUrl(data.albumUrl)};
  if(d.startDate&&(!validDate(d.startDate)||d.startDate>today()))throw Error('Revisa la fecha de inicio.');
  return updateOne(client.from('galaxy_settings').update({data:d}).eq('id',1).eq('version',data.version));
 }
 if(url==='/api/daily')return checked(client.rpc('galaxy_daily_save',data));
 if(url==='/api/music/upload'){
  const file=options.body,b=new Uint8Array(await file.slice(0,3).arrayBuffer());
  const mime=(b[0]===73&&b[1]===68&&b[2]===51)||(b[0]===255&&(b[1]&224)===224)?'audio/mpeg':null;
  if(!mime||file.size>20971520)throw Error('Sube un MP3 válido de hasta 20 MB.');
  const raw=decodeURIComponent(options.headers['X-File-Name']||'cancion.mp3').replace(/[^\p{L}\p{N} ._-]/gu,'_').slice(0,100)||'cancion.mp3';
  const path=crypto.randomUUID()+'-'+raw;
  await checked(musicBucket().upload(path,file,{contentType:mime,upsert:false}));
  return {path,url:await signedMusic(path)};
 }
 if(url==='/api/photos')return {photos:await photoList()};
 if(url==='/api/photos/upload'){
  const file=options.body,b=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const mime=b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71?'image/png':String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'?'image/webp':null;
  if(!mime||file.size>12582912)throw Error('Sube una foto JPG, PNG o WebP de hasta 12 MB.');
  const name=decodeURIComponent(options.headers['X-File-Name']).replace(/[^\p{L}\p{N} ._-]/gu,'_').slice(0,120)||'Foto';
  await checked(bucket().upload(crypto.randomUUID()+'-'+name,file,{contentType:mime,upsert:false}));return {};
 }
 if(url.startsWith('/api/photos/')&&method==='DELETE'){await checked(bucket().remove([decodeURIComponent(url.slice('/api/photos/'.length))]));return {};}
 if(url==='/api/export')return {settings:await settings(),items:await allItems(),daily:await checked(client.rpc('galaxy_daily_read'))};
 if(url==='/api/calendar.ics')return ics((await allItems()).filter(i=>i.kind==='event'));
 throw Error('En la versión gratuita pueden abrir su álbum de Google Fotos y subir aquí las fotos que elijan.');
}
export function loginMarkup(esc){return `<section class="login cloud-entry"><div class="entry-intro"><img src="./icon.svg" width="64" height="64" alt=""><p class="eyebrow">UN ESPACIO PARA DOS</p><h1>El mundo es grande.<br><em>Lo nuestro es aquí.</em></h1><p class="entry-subtitle">Nuestra historia, nuestros planes.<br>Y un lugar al que siempre volver.</p></div><div class="entry-card">${configured?'<button class="btn primary entry-google" id="cloud-google"><span aria-hidden="true" class="google-letter">G</span>Continuar con Google<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button><details class="entry-disclosure"><summary>Tengo una invitación<span aria-hidden="true">+</span></summary><div class="entry-disclosure-body"><label for="invitation-code">El código que te compartió tu pareja</label><input id="invitation-code" autocomplete="off" placeholder="Pega aquí tu invitación"><p>Pégalo y continúa con tu cuenta de Google.</p></div></details><details class="entry-disclosure"><summary>Entrar con correo y contraseña<span aria-hidden="true">+</span></summary><form id="cloud-login" class="entry-disclosure-body"><label>Tu correo<input name="email" type="email" autocomplete="username" placeholder="tu@correo.com" required></label><label>Tu contraseña<input name="password" type="password" autocomplete="current-password" required></label><button class="btn primary">Entrar a nuestra galaxia</button><p class="inline-error" role="alert"></p></form></details>':'<p>Su rincón está preparado. Falta conectar Supabase para activar el acceso privado.</p>'}<p id="login-status" role="alert"></p>${configured?'<button class="btn text-button" id="cloud-signout">Cambiar de cuenta</button>':''}</div><p class="entry-privacy"><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Un pequeño universo. Solo para ustedes dos.</p></section>`;}
export function rememberInvitation(){const value=document.querySelector('#invitation-code')?.value.trim();if(value)sessionStorage.setItem('galaxy-invitation',value);}
export async function googleLogin(){rememberInvitation();await checked(client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,queryParams:{prompt:'select_account'}}}));}
export async function login(email,password){await checked(client.auth.signInWithPassword({email,password}));await person();}
export async function signOut(){if(client)await checked(client.auth.signOut());}

