import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,unlink,stat} from 'node:fs/promises';
import {randomBytes,createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {openStore} from './store.mjs';
import {bondStore} from './bond-store.mjs';
import {audioMime,audioLimit} from './public/bond-domain.js';
import {fail,text,validDate,today,questionFor,ideas,validateItem,folderId,ics} from './domain.mjs';
import {googleClient,scopes,request} from './google.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const sha=s=>createHash('sha256').update(s).digest('hex');
const equal=(a,b)=>typeof a==='string' && typeof b==='string' && Buffer.byteLength(a)===Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function configuration(env=process.env,demo=process.argv.includes('--demo')) {
 const port=Number(env.PORT||4180),base=(env.BASE_URL||`http://localhost:${port}`).replace(/\/$/,'');
 const emails=(env.ALLOWED_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
 if(demo && env.NODE_ENV==='production') throw Error('La vista local no puede ejecutarse en producción.');
 if(!demo && (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || new Set(emails).size!==2 || !/^[a-fA-F0-9]{64}$/.test(env.TOKEN_KEY||''))) throw Error('Configura Google, las dos cuentas permitidas y TOKEN_KEY. Para una vista local usa npm run dev.');
 if(env.NODE_ENV==='production' && !base.startsWith('https://')) throw Error('BASE_URL debe usar HTTPS en producción.');
 return {port,base,demo,emails:demo?['local-sebas','local-adri']:emails,key:Buffer.from(env.TOKEN_KEY||randomBytes(32).toString('hex'),'hex'),clientId:env.GOOGLE_CLIENT_ID,clientSecret:env.GOOGLE_CLIENT_SECRET,dir:path.resolve(env.DATA_DIR||(demo?'data/demo':'data/private')),host:demo?'127.0.0.1':env.HOST||'0.0.0.0'};
}
export async function createApp(config) {
 const store=openStore(config.dir),db=store.db,g=googleClient(store,config),mediaDir=path.join(config.dir,'photos');
 await mkdir(mediaDir,{recursive:true});
 const bond=bondStore(db),voiceDir=path.join(config.dir,'voice');await mkdir(voiceDir,{recursive:true});
 db.exec(`CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,source TEXT NOT NULL,externalId TEXT UNIQUE,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS pickers(id TEXT PRIMARY KEY,email TEXT NOT NULL,expires INTEGER NOT NULL);`);
 const cookie=(name,value,maxAge=604800)=>`${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${config.base.startsWith('https:')?'; Secure':''}`;
 function session(req){const id=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('ng_session='))?.slice(11);if(!id)return null;return db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(sha(id),Date.now());}
 function createSession(res,email){const id=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(sha(id),email,csrf,Date.now()+7*86400000);res.setHeader('Set-Cookie',cookie('ng_session',id));}
 function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
 function redirect(res,url){res.writeHead(302,{Location:url});res.end();}
 async function raw(req,max=100000){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)fail('El archivo es demasiado grande.',413);chunks.push(chunk);}return Buffer.concat(chunks);}
 async function body(req){try{return JSON.parse((await raw(req)).toString());}catch(e){if(e.status)throw e;fail('No se pudo leer el formulario.');}}
 function photoMime(b){if(b[0]===255&&b[1]===216&&b[2]===255)return'image/jpeg';if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';if(b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP')return'image/webp';fail('Usa fotos JPG, PNG o WebP.');}
 async function savePhoto(bytes,name,source,external=null){if(bytes.length>12*1024*1024)fail('Cada foto puede pesar hasta 12 MB.');const mime=photoMime(bytes);if(external&&db.prepare('SELECT id FROM photos WHERE externalId=?').get(external))return false;const id=randomUUID();await writeFile(path.join(mediaDir,id),bytes,{flag:'wx'});try{db.prepare('INSERT INTO photos VALUES(?,?,?,?,?,?)').run(id,text(name||'Un recuerdo',200),mime,source,external,new Date().toISOString());}catch(e){await unlink(path.join(mediaDir,id));throw e;}return true;}
 function state(s){const settings=store.settings(),person=String(config.emails.indexOf(s.email)),day=today();const daily=store.daily(day);const allAnswered=daily.filter(d=>d.answer).length===2;
 return {demo:config.demo,person,csrf:s.csrf,settings,items:store.list(),today:day,question:questionFor(day),ideas,daily:daily.map(d=>({...d,answer:d.person===person||allAnswered?d.answer:null,answered:!!d.answer})),allAnswered,connections:{google:!!config.clientId,drive:!config.demo&&!!g.tokens(s.email).scope?.includes(scopes.drive),photos:!config.demo&&!!g.tokens(s.email).scope?.includes(scopes.photos)},photoCount:db.prepare('SELECT count(*) AS n FROM photos').get().n};}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; frame-src https://open.spotify.com https://www.youtube-nocookie.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  try {
   const u=new URL(req.url,config.base),p=u.pathname;
   const allowedHosts=[new URL(config.base).host,...(config.demo?[`127.0.0.1:${config.port}`,`localhost:${config.port}`]:[])];
   if(!allowedHosts.includes(req.headers.host))fail('Host no permitido.',403);
   let s=session(req);
   if(config.demo && !s){createSession(res,config.emails[0]);s={email:config.emails[0],csrf:''};if(p.startsWith('/api/')) return redirect(res,'/');}
   if(p==='/health')return json(res,{ok:true});
   if(p==='/regalo')return redirect(res,'/regalo/');
   if(p==='/auth/google') {
    if(config.demo || !config.clientId)fail('La conexión Google requiere configurar las credenciales de la aplicación.',409);
    const feature=['drive','photos'].includes(u.searchParams.get('feature'))?u.searchParams.get('feature'):'login';
    if(feature!=='login'&&!s) return redirect(res,'/auth/google');
    const nonce=randomBytes(32).toString('hex'),verifier=randomBytes(48).toString('base64url');
    db.prepare('DELETE FROM oauth WHERE expires<?').run(Date.now());
    db.prepare('INSERT INTO oauth VALUES(?,?,?,?)').run(sha(nonce),verifier,Date.now()+600000,s?.email||null);
    res.setHeader('Set-Cookie',cookie('ng_oauth',nonce,600));
    const params=new URLSearchParams({client_id:config.clientId,redirect_uri:g.redirect,response_type:'code',scope:scopes.login+(feature!=='login'?' '+scopes[feature]:''),state:nonce,code_challenge:Buffer.from(sha(verifier),'hex').toString('base64url'),code_challenge_method:'S256',access_type:'offline',include_granted_scopes:'true',prompt:feature==='login'?'select_account':'consent'});
    return redirect(res,'https://accounts.google.com/o/oauth2/v2/auth?'+params);
   }
   if(p==='/auth/callback') {
    const nonce=u.searchParams.get('state')||'',c=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('ng_oauth='))?.slice(9),o=db.prepare('SELECT * FROM oauth WHERE state=? AND expires>?').get(sha(nonce),Date.now());
    if(!o||!equal(nonce,c))fail('El inicio de sesión venció. Vuelve a intentarlo.',403);
    db.prepare('DELETE FROM oauth WHERE state=?').run(sha(nonce));
    if(u.searchParams.has('error'))return redirect(res,'/?auth=cancelled');
    const t=await g.exchange(u.searchParams.get('code'),o.verifier);
    const profile=await (await request('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${t.access_token}`}})).json();
    const email=profile.email?.toLowerCase();
    if(!profile.email_verified||!config.emails.includes(email)||(o.email&&o.email!==email))fail('Usa una de las dos cuentas autorizadas para este espacio.',403);
    g.save(email,{...g.tokens(email),...t});createSession(res,email);return redirect(res,'/');
   }
   if(p.startsWith('/api/')||p.startsWith('/media/')||p.startsWith('/regalo')) {
    if(!s)fail('Inicia sesión para entrar a su espacio.',401);
    if(!['GET','HEAD'].includes(req.method)) {
     const origin=req.headers.origin;
     if(!origin||!allowedHosts.some(h=>origin===`${new URL(config.base).protocol}//${h}`)||!equal(req.headers['x-csrf-token'],s.csrf))fail('Vuelve a cargar la página para guardar los cambios.',403);
    }
   }
   const bondPerson=s?String(config.emails.indexOf(s.email)):null;
   if(p==='/api/bond'&&req.method==='GET')return json(res,bond.read(bondPerson));
   if(p==='/api/bond'&&req.method==='POST'){const b=await body(req);return json(res,bond.add(b.type,b.data,bondPerson),201);}
   if(p==='/api/bond/widget'&&req.method==='POST'){const b=await body(req);return json(res,bond.widget(b.photoPath));}
   if(p==='/api/bond/audio'&&req.method==='POST'){
    const bytes=await raw(req,audioLimit);let mime;try{mime=audioMime(bytes,req.headers['content-type']);}catch(e){fail(e.message);}
    const name=req.headers['x-file-name'];if(typeof name!=='string'||!name||name.length>500)fail('Falta el nombre del audio.');try{decodeURIComponent(name);}catch{fail('Nombre del audio no válido.');}
    const ext={'audio/mpeg':'mp3','audio/ogg':'ogg','audio/webm':'webm','audio/mp4':'m4a'}[mime],id=randomUUID(),audioPath=bondPerson+'/'+id+'.'+ext;
    await writeFile(path.join(voiceDir,id+'.'+ext),bytes,{flag:'wx'});db.prepare('INSERT INTO bond_audio VALUES(?,?,?)').run(audioPath,mime,bondPerson);
    return json(res,{path:audioPath,url:'/media/voice/'+encodeURIComponent(audioPath),mime},201);
   }
   if(p.startsWith('/api/bond/audio/')&&req.method==='GET'){const audioPath=decodeURIComponent(p.slice('/api/bond/audio/'.length));if(!db.prepare('SELECT path FROM bond_audio WHERE path=?').get(audioPath))fail('Audio no encontrado.',404);return json(res,{url:'/media/voice/'+encodeURIComponent(audioPath)});}
   if(p.startsWith('/media/voice/')&&req.method==='GET'){const audioPath=decodeURIComponent(p.slice('/media/voice/'.length)),audio=db.prepare('SELECT * FROM bond_audio WHERE path=?').get(audioPath);if(!audio)fail('Audio no encontrado.',404);res.setHeader('Content-Type',audio.mime);return res.end(await readFile(path.join(voiceDir,audioPath.split('/')[1])));}
   const bondGuess=p.match(/^\/api\/bond\/([\w-]+)\/guess$/);
   if(bondGuess&&req.method==='POST'){const b=await body(req);return json(res,bond.guess(bondGuess[1],b.guess,bondPerson));}
   const bondEntry=p.match(/^\/api\/bond\/([\w-]+)$/);
   if(bondEntry&&['PUT','DELETE'].includes(req.method)){const b=await body(req);return json(res,req.method==='PUT'?bond.update(bondEntry[1],b.version,b.data,bondPerson):bond.remove(bondEntry[1],b.version,bondPerson));}
   if(p==='/api/state'&&req.method==='GET')return json(res,state(s));
   if(p==='/api/demo-person'&&req.method==='POST'&&config.demo){const b=await body(req);if(!['0','1'].includes(b.person))fail('Persona no válida.');createSession(res,config.emails[Number(b.person)]);return json(res,{ok:true});}
   if(p==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE id=?').run(s.id);res.setHeader('Set-Cookie',cookie('ng_session','',0));return json(res,{ok:true});}
   if(p==='/api/items'&&req.method==='POST'){const d=validateItem(await body(req));return json(res,{id:store.add(d,String(config.emails.indexOf(s.email)))},201);}
   const item=p.match(/^\/api\/items\/([\w-]+)$/);
   if(item&&['PUT','DELETE'].includes(req.method)){const b=await body(req);if(!Number.isInteger(b.version))fail('Falta la versión del contenido.');if(req.method==='PUT')store.update(item[1],validateItem(b),b.version);else store.remove(item[1],b.version);return json(res,{ok:true});}
   if(p==='/api/settings'&&req.method==='PUT') {
    const b=await body(req),old=store.settings().data;
    if(!Array.isArray(b.names)||b.names.length!==2)fail('Escribe los dos nombres.');
    const d={...old,names:b.names.map(n=>text(n,40,true)),startDate:text(b.startDate||'',10),albumUrl:text(b.albumUrl||'',500)};
    if(d.startDate&&(!validDate(d.startDate)||d.startDate>today()))fail('El inicio de su historia debe ser una fecha válida, hasta hoy.');
    if(d.albumUrl){let a;try{a=new URL(d.albumUrl);}catch{fail('Revisa el enlace del álbum.');}if(a.protocol!=='https:'||!['photos.app.goo.gl','photos.google.com'].includes(a.hostname)||a.username||a.password||a.port)fail('Usa un enlace de Google Fotos.');}
    if(!Number.isInteger(b.version))fail('Falta la versión.');store.saveSettings(d,b.version);return json(res,{ok:true});
   }
   if(p==='/api/daily'&&req.method==='POST'){const b=await body(req),person=String(config.emails.indexOf(s.email));if(!['mood','answer'].includes(b.field))fail('Campo no válido.');const v=text(b.value,b.field==='mood'?30:3000,true);if(b.field==='mood'&&!['feliz','tranquilo','cansado','sensible','abrazo'].includes(v))fail('Elige una emoción.');store.saveDaily(today(),person,b.field,v);return json(res,{ok:true});}
   if(p==='/api/calendar.ics'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="nuestro-calendario.ics"'});return res.end(ics(store.list().filter(i=>i.kind==='event')));}
   if(p==='/api/export'&&req.method==='GET'){res.setHeader('Content-Disposition','attachment; filename="nuestra-galaxia.json"');return json(res,{exportedAt:new Date().toISOString(),bond:bond.read(String(config.emails.indexOf(s.email))),settings:store.settings().data,items:store.list(),daily:db.prepare('SELECT day,person,mood,answer FROM daily').all().map(d=>{const both=db.prepare('SELECT count(*) AS n FROM daily WHERE day=? AND answer IS NOT NULL').get(d.day).n===2;return {...d,answer:d.person===String(config.emails.indexOf(s.email))||both?d.answer:null};}),photos:db.prepare('SELECT id,name,source,created FROM photos').all()});}
   if(p==='/api/photos'&&req.method==='GET')return json(res,{photos:db.prepare('SELECT id,name,source,created FROM photos ORDER BY created DESC').all()});
   if(p==='/api/photos/upload'&&req.method==='POST'){const name=decodeURIComponent(req.headers['x-file-name']||'Un recuerdo');await savePhoto(await raw(req,12*1024*1024),name,'Subida por ustedes');return json(res,{ok:true},201);}
   const photo=p.match(/^\/api\/photos\/([\w-]+)$/);
   if(photo&&req.method==='DELETE'){const row=db.prepare('SELECT * FROM photos WHERE id=?').get(photo[1]);if(!row)fail('La foto ya no existe.',404);await unlink(path.join(mediaDir,row.id));db.prepare('DELETE FROM photos WHERE id=?').run(row.id);return json(res,{ok:true});}
   const media=p.match(/^\/media\/([\w-]+)$/);
   if(media){const row=db.prepare('SELECT * FROM photos WHERE id=?').get(media[1]);if(!row)fail('Foto no encontrada.',404);res.setHeader('Content-Type',row.mime);return res.end(await readFile(path.join(mediaDir,row.id)));}
   if(p==='/api/google/disconnect'&&req.method==='POST'){if(!config.demo)await g.revoke(s.email);return json(res,{ok:true});}
   if(p.startsWith('/api/drive')||p.startsWith('/api/picker')) {
    if(config.demo)fail('La vista local no conecta cuentas. Configura Google para activar esta función.',409);
   }
   if(p==='/api/drive/folder'&&req.method==='POST'){const b=await body(req),id=folderId(b.url),meta=await(await g.api(s.email,`https://www.googleapis.com/drive/v3/files/${id}?fields=id,name,mimeType&supportsAllDrives=true`)).json();if(meta.mimeType!=='application/vnd.google-apps.folder')fail('El enlace no es una carpeta.');const old=store.settings();store.saveSettings({...old.data,folderId:id,folderName:meta.name},old.version);return json(res,{ok:true});}
   if(p==='/api/drive/photos'&&req.method==='GET'){const id=store.settings().data.folderId;if(!id)fail('Elige una carpeta en Ajustes.',409);const q=new URLSearchParams({q:`'${id}' in parents and trashed = false and (mimeType = 'image/jpeg' or mimeType = 'image/png' or mimeType = 'image/webp')`,fields:'nextPageToken,files(id,name)',pageSize:'60',supportsAllDrives:'true',includeItemsFromAllDrives:'true',...(u.searchParams.get('page')?{pageToken:u.searchParams.get('page')}:{})});return json(res,await(await g.api(s.email,'https://www.googleapis.com/drive/v3/files?'+q)).json());}
   const drive=p.match(/^\/api\/drive\/image\/([\w-]+)$/);
   if(drive&&req.method==='GET'){const meta=await(await g.api(s.email,`https://www.googleapis.com/drive/v3/files/${drive[1]}?fields=parents,mimeType,size&supportsAllDrives=true`)).json();if(!meta.parents?.includes(store.settings().data.folderId)||!['image/jpeg','image/png','image/webp'].includes(meta.mimeType))fail('Esta foto no pertenece a la carpeta elegida.',403);if(Number(meta.size)>12*1024*1024)fail('La foto supera 12 MB.',413);const r=await g.api(s.email,`https://www.googleapis.com/drive/v3/files/${drive[1]}?alt=media&supportsAllDrives=true`);res.setHeader('Content-Type',meta.mimeType);return res.end(Buffer.from(await r.arrayBuffer()));}
   if(p==='/api/picker'&&req.method==='POST'){const r=await(await g.api(s.email,'https://photospicker.googleapis.com/v1/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pickingConfig:{maxItemCount:'30'}})})).json();db.prepare('INSERT OR REPLACE INTO pickers VALUES(?,?,?)').run(r.id,s.email,Date.now()+3600000);return json(res,{id:r.id,url:r.pickerUri});}
   if(p==='/api/picker/import'&&req.method==='POST') {
    const b=await body(req),row=db.prepare('SELECT * FROM pickers WHERE id=? AND email=? AND expires>?').get(text(b.id,300,true),s.email,Date.now());if(!row)fail('La selección venció. Elige las fotos de nuevo.',409);
    const sessionData=await(await g.api(s.email,`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(row.id)}`)).json();if(!sessionData.mediaItemsSet)return json(res,{pending:true});
    let page='',imported=0,skipped=0;
    do{const q=new URLSearchParams({sessionId:row.id,pageSize:'100',...(page?{pageToken:page}:{})});const batch=await(await g.api(s.email,'https://photospicker.googleapis.com/v1/mediaItems?'+q)).json();for(const m of batch.mediaItems||[]){if(m.type!=='PHOTO'){skipped++;continue;}const u=new URL(m.mediaFile.baseUrl);if(u.protocol!=='https:'||!u.hostname.endsWith('.googleusercontent.com'))fail('Google devolvió una dirección de foto no válida.',502);const bytes=await(await g.api(s.email,u.href+'=w2048-h2048')).arrayBuffer();if(await savePhoto(Buffer.from(bytes),m.mediaFile.filename||'Google Fotos','Google Fotos',m.id))imported++;}page=batch.nextPageToken||'';}while(page);
    await g.api(s.email,`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(row.id)}`,{method:'DELETE'});db.prepare('DELETE FROM pickers WHERE id=?').run(row.id);return json(res,{imported,skipped});
   }
   if(p.startsWith('/api/'))fail('Ruta no encontrada.',404);
   if(!['GET','HEAD'].includes(req.method))fail('Método no permitido.',405);
   let file;
   if(p.startsWith('/regalo')) {const sub=p.replace(/^\/regalo\/?/,'')||'index.html';if(!['index.html','style.css','script.js','girasol.js','recuerdos.js','musica.mp3'].includes(sub))fail('No encontrado.',404);file=path.join(root,sub);}
   else {const sub=p==='/'?'index.html':decodeURIComponent(p.slice(1));file=path.resolve(root,'app/public',sub);if(!file.startsWith(path.resolve(root,'app/public')+path.sep))fail('No encontrado.',404);}
   try{await stat(file);}catch{fail('No encontrado.',404);}
   res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');
   res.end(req.method==='HEAD'?undefined:await readFile(file));
  } catch(e){if(!res.headersSent)json(res,{error:e.status?e.message:'No pudimos completar la acción. Intenta de nuevo.'},e.status||500);else res.end();if(!e.status)console.error('Request failed:',e.name);}
 });
 server.requestTimeout=120000;
 return {server,store};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const config=configuration();const {server}=await createApp(config);server.listen(config.port,config.host,()=>console.log(`Nuestra galaxia: ${config.base}${config.demo?' (vista local)':''}`));
}
