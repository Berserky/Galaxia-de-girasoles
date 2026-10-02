export const gestures=Object.freeze([{id:'hug',label:'Un abrazo',emoji:'🫂'},{id:'kiss',label:'Un beso',emoji:'💋'},{id:'miss',label:'Te extraño',emoji:'💛'}]);
export const gameQuestions=Object.freeze([
 {id:'comfort',question:'¿Qué me reconforta después de un día difícil?',options:['Un abrazo','Hablar de todo','Un rato de calma','Algo rico']},
 {id:'date',question:'¿Qué cita elegiría hoy?',options:['Película en casa','Paseo al aire libre','Cocinar juntos','Descubrir un café']},
 {id:'love',question:'¿Qué gesto me hace sentir más querido?',options:['Palabras bonitas','Tiempo juntos','Una sorpresa','Ayuda con algo']},
 {id:'travel',question:'¿A dónde escaparía contigo?',options:['La playa','La montaña','Una ciudad nueva','Una cabaña']},
 {id:'morning',question:'¿Cómo sería mi mañana ideal?',options:['Dormir un poco más','Desayunar juntos','Salir a caminar','Música y café']},
 {id:'memory',question:'¿Qué recuerdo guardaría en una cajita?',options:['Nuestro primer encuentro','Un viaje juntos','Una conversación','Un abrazo especial']}
]);
export const dateIdeas=Object.freeze([
 {id:'tea',title:'Un café sin pantallas',body:'Preparen una bebida y cuéntense algo pequeño de su día.',minutes:15,budget:0,where:'casa'},
 {id:'music',title:'Nuestra mini playlist',body:'Elijan tres canciones y cuenten por qué les recuerdan al otro.',minutes:20,budget:0,where:'casa'},
 {id:'letters',title:'Dos cartas cortitas',body:'Escriban algo que agradecen y léanlo juntos.',minutes:30,budget:0,where:'casa'},
 {id:'cook',title:'Cocinar algo nuevo',body:'Elijan una receta sencilla y preparen la cena juntos.',minutes:60,budget:30000,where:'casa'},
 {id:'movie',title:'Noche de película',body:'Elijan por turnos una película y preparen algo para compartir.',minutes:120,budget:20000,where:'casa'},
 {id:'walk',title:'Paseo de la mano',body:'Caminen sin prisa y busquen un rincón bonito.',minutes:30,budget:0,where:'salir'},
 {id:'icecream',title:'Helado y conversación',body:'Prueben un sabor nuevo y compartan una idea para el futuro.',minutes:45,budget:25000,where:'salir'},
 {id:'picnic',title:'Un picnic sencillo',body:'Lleven algo hecho en casa a un lugar que les guste.',minutes:90,budget:40000,where:'salir'},
 {id:'dinner',title:'Una mesa para dos',body:'Elijan un restaurante y dejen tiempo para conversar.',minutes:120,budget:100000,where:'salir'}
]);
export function weekStart(date=new Date()){
 const raw=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)?date:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
 const d=new Date(raw+'T12:00:00Z');if(!Number.isFinite(d.getTime()))throw Error('Fecha no válida.');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);
}
export function pickDate({minutes,budget,where='any'},random=Math.random){
 if(!Number.isFinite(Number(minutes))||!Number.isFinite(Number(budget))||Number(minutes)<0||Number(budget)<0)return null;
 const choices=dateIdeas.filter(i=>i.minutes<=Number(minutes)&&i.budget<=Number(budget)&&(['any','todos',''].includes(where)||i.where===where));
 return choices.length?choices[Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)))]:null;
}
export function gardenProgress(days){const count=Math.max(0,Math.floor(Number(days)||0));return {days:count,stage:count>=30?4:count>=14?3:count>=7?2:count>=1?1:0};}
export const audioLimit=5*1024*1024;
export function audioMime(bytes,claimed){
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),ascii=(a,z)=>String.fromCharCode(...b.slice(a,z));
 const mime=b.length>=10&&ascii(0,3)==='ID3'||b.length>=4&&b[0]===255&&(b[1]&224)===224?'audio/mpeg':b.length>=12&&ascii(0,4)==='OggS'?'audio/ogg':b.length>=12&&b[0]===26&&b[1]===69&&b[2]===223&&b[3]===163?'audio/webm':b.length>=12&&ascii(4,8)==='ftyp'?'audio/mp4':null;
 if(!mime||claimed?.split(';')[0].trim().toLowerCase()!==mime)throw Error('Usa audio MP3, Ogg, WebM o M4A válido.');return mime;
}
export function validateBond(type,data){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Datos no válidos.');
 const fields={gesture:['gesture'],game:['questionId','answer'],ritual:['week','gratitude','need','plan'],sharednote:['title','body'],voice:['title','body','audioPath','mime','referenceId']}[type];
 if(!fields||Object.keys(data).some(k=>!fields.includes(k)))throw Error('Contenido no válido.');
 const string=(key,max,required=true)=>{const v=data[key];if(v===undefined&&!required)return '';if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('Completa el contenido dentro del límite.');return v.trim();};
 if(type==='gesture'){if(!gestures.some(g=>g.id===data.gesture))throw Error('Gesto no válido.');return {gesture:data.gesture};}
 if(type==='game'){const q=gameQuestions.find(q=>q.id===data.questionId);if(!q||!q.options.includes(data.answer))throw Error('Respuesta no válida.');return {questionId:q.id,answer:data.answer};}
 if(type==='ritual'){const week=string('week',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||new Date(week+'T12:00:00Z').toISOString().slice(0,10)!==week||weekStart(week)!==week)throw Error('Elige el lunes de la semana.');return {week,gratitude:string('gratitude',2000),need:string('need',2000),plan:string('plan',2000)};}
 const out={title:string('title',120),body:string('body',type==='voice'?2000:10000,false)};
 if(type==='voice'){out.audioPath=string('audioPath',100);out.mime=string('mime',30);if(!/^[01]\/[0-9a-f-]{36}\.(mp3|ogg|webm|m4a)$/.test(out.audioPath)||!['audio/mpeg','audio/ogg','audio/webm','audio/mp4'].includes(out.mime))throw Error('Audio no válido.');const ref=string('referenceId',100,false);if(ref)out.referenceId=ref;}
 return out;
}
