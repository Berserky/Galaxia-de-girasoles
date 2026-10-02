import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'dist');
function replaceRequired(source,needle,replacement,label){
 if(!source.includes(needle))throw Error('Build Pages incompatible: '+label);
 return source.replace(needle,replacement);
}
const defaults=JSON.parse(await readFile(path.join(root,'deploy/public-config.json'),'utf8'));
const url=process.env.SUPABASE_URL||defaults.url||'',key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||defaults.key||'';
if(process.env.CI&&(!url||!key))throw Error('Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en las variables del repositorio.');
if(key.startsWith('sb_secret_'))throw Error('Nunca publiques una clave secreta. Usa la publishable key.');
if(key.split('.').length===3){const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));if(claims.role!=='anon')throw Error('Solo se permite la clave anon pública.');}
await mkdir(out,{recursive:true});
for(const name of ['index.html','app.js','app.css','dates.js','icon.svg','garden.svg','manifest.webmanifest']){
 let source=await readFile(path.join(root,'app/public',name),'utf8');
 source=source.replaceAll('="/','="./').replaceAll("url('/","url('./").replaceAll('"start_url":"/"','"start_url":"./"').replaceAll('"src":"/icon.svg"','"src":"./icon.svg"');
 if(name==='app.js'){
  source="import {cloudApi,loginMarkup,login,signOut,googleLogin,rememberInvitation} from './cloud.js';\n"+source;
  const apiStart=source.indexOf('async function api('),apiEnd=source.indexOf('async function refresh(',apiStart);
  source=source.slice(0,apiStart)+'const api=cloudApi;\n'+source.slice(apiEnd);
  source=source.replace("async function boot(){try", "async function boot(){try");
  const start=source.indexOf('async function boot()'),end=source.indexOf('// Refresca',start);
  source=source.slice(0,start)+`async function boot(){try{await refresh();}catch(e){state=null;app.innerHTML=loginMarkup(esc);document.querySelector('#login-status').textContent=e.message==='Entra con tu correo para abrir su espacio.'?'':e.message;}}
document.addEventListener('submit',async e=>{if(e.target.id!=='cloud-login')return;e.preventDefault();const f=e.target,b=f.querySelector('button');b.disabled=true;try{rememberInvitation();const d=new FormData(f);await login(d.get('email'),d.get('password'));await boot();}catch(error){f.querySelector('.inline-error').textContent=error.message;}finally{b.disabled=false;}});
document.addEventListener('click',async e=>{try{if(e.target.closest('#cloud-google'))await googleLogin();if(e.target.id==='invite-partner'){const {token}=await api('/api/invite');show('<h2 id="modal-title">Una invitación para Adriana</h2><p>Comparte la dirección de esta página y este código solo con ella. Expira en 7 días y sirve una vez.</p><textarea readonly aria-label="Código de invitación">'+esc(token)+'</textarea>');}}catch(error){const status=document.querySelector('#login-status');if(status)status.textContent=error.message;else toast(error.message);}});
document.addEventListener('click',async e=>{if(e.target.id==='cloud-signout'){await signOut();await boot();}const a=e.target.closest('a');if(!a)return;if(['./api/export','./api/calendar.ics'].includes(a.getAttribute('href'))){e.preventDefault();try{const calendar=a.getAttribute('href').endsWith('.ics'),data=await api(calendar?'/api/calendar.ics':'/api/export');const url=URL.createObjectURL(new Blob([calendar?data:JSON.stringify(data,null,2)],{type:calendar?'text/calendar':'application/json'}));const link=document.createElement('a');link.href=url;link.download=calendar?'nuestros-dias.ics':'nuestra-galaxia.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){toast(error.message);}}});
`+source.slice(end);
  source=replaceRequired(source,"filter='Todos';draw();","filter='Todos';if(state)draw();",'hashchange');
  source=replaceRequired(source,'<h2>Guardar y salir</h2>','<h2>Guardar y salir</h2>${state.person===\'0\'?\'<button class="btn secondary" id="invite-partner">Invitar a Adriana</button>\':\'\'}','botón de invitación');
  source=source.replaceAll("${photoSource==='drive'?'/api/drive/image/':'/media/'}${encodeURIComponent(p.id)}",'${esc(p.url)}').replaceAll("${photoSource==='drive'?'/api/drive/image/':'/media/'}${encodeURIComponent(id)}",'${esc(p.url)}');
  source=replaceRequired(source,"case'picker':if","case'picker':return toast('Abre su álbum de Google Fotos, descarga las fotos que elijan y súbelas con Añadir fotos.');if",'Google Fotos');
  source=source.replace("${btn('Elegir de Google Fotos','picker','text-button')}",'');
  source=source.replace(/<button data-action="photo-source" data-value="drive"[\s\S]*?<\/button>/,'');
  // Sustituye exclusivamente la tarjeta de conexiones de la versión con servidor.
  const a=source.indexOf('<section class="card"><span class="eyebrow">FOTOS QUE SIGUEN'),b=source.indexOf('<section class="card"><span class="eyebrow">SU HISTORIA',a);
  if(a<0||b<0)throw Error('No se encontró la tarjeta de conexiones');
  source=source.slice(0,a)+'<section class="card"><span class="eyebrow">NUESTRO ÁLBUM</span><h2>Fotos para los dos</h2><p>Guarden arriba el enlace de su álbum de Google Fotos para abrirlo cuando quieran. También pueden subir fotos desde el celular a su álbum privado.</p><p class="fine-print">Esta versión no importa ni sincroniza automáticamente Google Fotos o Drive. El almacenamiento gratuito de Supabase tiene un límite de 1 GB por proyecto.</p></section>'+source.slice(b);
 }
 await writeFile(path.join(out,name),source);
}
await copyFile(path.join(root,'app/cloud/adapter.js'),path.join(out,'cloud.js'));
await writeFile(path.join(out,'domain.js'),(await readFile(path.join(root,'app/domain.mjs'),'utf8')).replaceAll('Buffer.byteLength(chunk+ch)','new TextEncoder().encode(chunk+ch).length'));
await writeFile(path.join(out,'config.js'),'export default '+JSON.stringify({url,key})+';\n');
await writeFile(path.join(out,'.nojekyll'),'');
await mkdir(path.join(out,'regalo'),{recursive:true});
for(const name of ['index.html','style.css','script.js','recuerdos.js','girasol.js','musica.mp3'])await copyFile(path.join(root,name),path.join(out,'regalo',name));
// Cada publicación renueva los recursos para evitar mezclar pantallas antiguas y nuevas.
const revision=(process.env.GITHUB_SHA||Date.now().toString(36)).slice(0,12);
for(const name of ['app.js','cloud.js']){
 const source=await readFile(path.join(out,name),'utf8');
 await writeFile(path.join(out,name),source.replace(/from '(\.\/[^']+\.js)'/g,`from '$1?v=${revision}'`));
}
const html=await readFile(path.join(out,'index.html'),'utf8');
await writeFile(path.join(out,'index.html'),html.replace(/(\.\/app\.(?:js|css))"/g,`$1?v=${revision}"`));
console.log('Sitio generado en dist. Los datos privados se guardan en Supabase, nunca en GitHub.');


