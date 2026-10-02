export const kinds = ['memory','song','event','plan','note','capsule','wish','journey'];
export const questions = [
 '¿Qué pequeño momento nuestro te gustaría volver a vivir?',
 '¿Qué puedo hacer esta semana para que te sientas más acompañado/a?',
 '¿Qué plan sencillo te haría muy feliz este fin de semana?',
 '¿Qué has descubierto de nosotros que te gusta mucho?',
 '¿Qué sueño te gustaría que empezáramos a construir juntos?',
 '¿Qué canción te recuerda a nosotros y por qué?',
 '¿Qué detalle cotidiano te hace sentir querido/a?',
 '¿Qué lugar te gustaría conocer conmigo?',
 '¿De qué te gustaría que nos riéramos cuando seamos viejitos?',
 '¿Qué necesitas hoy: compañía, ayuda, una charla o un abrazo?',
 '¿Qué agradeces de nuestra historia esta semana?',
 '¿Qué tradición pequeña te gustaría inventar juntos?'
];
export const ideas = [
 {title:'Una cita sin pantallas',text:'Preparen algo rico y regálense una hora de conversación.',category:'En casa',minutes:60},
 {title:'Una canción, una historia',text:'Cada uno elige una canción y cuenta qué recuerdo le trae.',category:'Conectar',minutes:20},
 {title:'Turistas por un día',text:'Elijan un rincón de su ciudad que todavía no conozcan.',category:'Aventura',minutes:120},
 {title:'Cartas para el futuro',text:'Escriban lo que desean vivir juntos. Guárdenlo para otra fecha.',category:'Conectar',minutes:30},
 {title:'Cocinar a cuatro manos',text:'Elijan una receta nueva y repártanse las tareas.',category:'En casa',minutes:60},
 {title:'El paseo de las pequeñas cosas',text:'Salgan a caminar y fotografíen cinco cosas que les hagan sonreír.',category:'Aventura',minutes:45},
 {title:'Noche de preguntas',text:'Elijan tres preguntas de este espacio y escuchen sin interrumpirse.',category:'Conectar',minutes:25},
 {title:'Un picnic a su manera',text:'Un mantel, algo para compartir y un lugar donde estar tranquilos.',category:'Aventura',minutes:90}
];
export function fail(message,status=400) { throw Object.assign(new Error(message),{status}); }
export function text(value,max=500,required=false) {
 if(typeof value!=='string' || value.length>max || (required && !value.trim())) fail('Revisa los campos: falta información o el texto es demasiado largo.');
 return value.trim();
}
export function validDate(s) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
 const d=new Date(s+'T12:00:00Z'); return !isNaN(d) && d.toISOString().slice(0,10)===s && Number(s.slice(0,4))>=1900;
}
export function today(now=new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function questionFor(date) { return questions[Math.floor(Date.parse(date+'T12:00:00Z')/86400000)%questions.length]; }
export function mediaLink(raw) {
 let u; try {u=new URL(raw);} catch {fail('Pega un enlace válido de Spotify o YouTube.');}
 if(u.protocol!=='https:' || u.username || u.password || u.port) fail('Usa un enlace HTTPS de Spotify o YouTube.');
 if(u.hostname==='open.spotify.com') {
   const m=u.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist)\/([a-zA-Z0-9]{22})\/?$/);
   if(m) return {provider:'Spotify',url:`https://open.spotify.com/${m[1]}/${m[2]}`,embed:`https://open.spotify.com/embed/${m[1]}/${m[2]}`};
 }
 if(['www.youtube.com','youtube.com','youtu.be','music.youtube.com'].includes(u.hostname)) {
   const id=u.hostname==='youtu.be' ? u.pathname.slice(1) : u.pathname==='/watch' ? u.searchParams.get('v') : u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)$/)?.[1];
   if(/^[\w-]{11}$/.test(id||'')) return {provider:'YouTube',url:`https://www.youtube.com/watch?v=${id}`,embed:`https://www.youtube-nocookie.com/embed/${id}`};
 }
 fail('Este enlace no se reconoce. Usa una canción, álbum o playlist de Spotify, o un video de YouTube.');
}
export function folderId(raw) {
 const s=text(raw,600,true);
 if(/^[\w-]{10,200}$/.test(s)) return s;
 try {const u=new URL(s); const m=u.pathname.match(/\/folders\/([\w-]+)/); if(u.hostname==='drive.google.com' && m) return m[1];} catch {}
 fail('Pega el enlace de una carpeta de Google Drive.');
}
export function validateItem(raw) {
 if(!raw || !kinds.includes(raw.kind)) fail('Tipo de contenido no válido.');
 const d={kind:raw.kind,title:text(raw.title,120,true),body:text(raw.body||'',5000),date:raw.date||'',category:text(raw.category||'',40),done:!!raw.done,annual:!!raw.annual};
 if(d.date && !validDate(d.date)) fail('La fecha no es válida.');
 if(raw.kind==='event' && !d.date) fail('Elige una fecha para este evento.');
 if(['memory','plan','wish','journey'].includes(raw.kind)){
  const hasCoords=raw.latitude!==''&&raw.latitude!=null&&raw.longitude!==''&&raw.longitude!=null,latitude=Number(raw.latitude),longitude=Number(raw.longitude);
  if(hasCoords&&Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180){d.latitude=latitude;d.longitude=longitude;d.placeName=text(raw.placeName||'',80);}
 }
 if(raw.kind==='capsule'){
  const unlockDate=raw.unlockDate||raw.date;if(!unlockDate||!validDate(unlockDate))fail('Elige cuándo se abrirá la cápsula.');d.unlockDate=unlockDate;d.date=unlockDate;
 }
 if(raw.kind==='wish')d.done=!!raw.done;
 if(raw.kind==='journey'){d.endDate=raw.endDate||'';if(d.endDate&&!validDate(d.endDate))fail('La fecha final del viaje no es válida.');if(d.date&&d.endDate<d.date)fail('El viaje no puede terminar antes de comenzar.');}

 if(raw.kind==='song'){
  const audioUrl=text(raw.audioUrl||'',1000);
  if(audioUrl){if(!/^https:\/\//.test(audioUrl))fail('El audio guardado no es válido.');d.audioUrl=audioUrl;d.url=text(raw.url||'',700);d.provider='MP3';d.embed='';}
  else Object.assign(d,mediaLink(text(raw.url,700,true)));
 }
 return d;
}
export function ics(events) {
 const escape=s=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Nuestra Galaxia//ES','CALSCALE:GREGORIAN'];
 for(const e of events) {const d=e.data; lines.push('BEGIN:VEVENT',`UID:${e.id}@nuestra-galaxia`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART;VALUE=DATE:${d.date.replaceAll('-','')}`,`SUMMARY:${escape(d.title)}`,`DESCRIPTION:${escape(d.body)}`,...(d.annual?['RRULE:FREQ=YEARLY']:[]),'END:VEVENT');}
 lines.push('END:VCALENDAR');
 return lines.map(line=>{let out='',chunk='';for(const ch of line){if(Buffer.byteLength(chunk+ch)>73){out+=chunk+'\r\n ';chunk='';}chunk+=ch;}return out+chunk;}).join('\r\n')+'\r\n';
}
