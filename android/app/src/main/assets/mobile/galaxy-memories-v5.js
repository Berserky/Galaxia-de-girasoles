/* P6A: read-only Memories Hub. Never render locked capsule contents. */
(function(root){
'use strict';
const categories=[['memory','Recuerdos','heart'],['album','Álbum','images'],['music','Música','music'],['event','Calendario','calendar'],['plan','Planes','circle-check-big'],['note','Notas','file-text'],['capsule','Cápsulas','lock'],['wish','Deseos','star'],['journey','Viajes','route']];
const sections=[['discover','Descubrir','sparkles'],['collections','Colecciones','library'],['history','Nuestra historia','orbit']];
const safeItems=items=>(Array.isArray(items)?items:[]).filter(x=>x&&typeof x==='object'&&x.data&&x.kind!=='capsule'&&categories.some(c=>c[0]===x.kind)&&x.kind!=='album'&&x.kind!=='music');
const countByKind=(items,kind)=>(Array.isArray(items)?items:[]).filter(x=>x&&x.kind===kind).length;
function count(items,kind,media){if(kind==='album')return Array.isArray(media?.photo)?media.photo.length:null;if(kind==='music')return (Array.isArray(media?.music)?media.music.length:0)+countByKind(items,'song');return countByKind(items,kind);}
function sectionsNav(active,{esc,ico}){return '<nav class="memories-v5-sections" aria-label="Explorar recuerdos">'+sections.map(([id,label,icon])=>'<button type="button" class="memories-v5-section'+(active===id?' active':'')+'" data-action="memories-section" data-section="'+esc(id)+'" aria-current="'+(active===id?'page':'false')+'">'+ico(icon)+'<span>'+esc(label)+'</span></button>').join('')+'</nav>';}
function collections(items,media,selected,{esc,ico}){return '<div class="memories-v5-categories" role="group" aria-label="Tipos de recuerdos">'+categories.map(([id,label,icon])=>{const n=count(items,id,media);return '<button type="button" class="memories-v5-category'+(selected===id?' active':'')+'" data-action="memories-category" data-kind="'+esc(id)+'" aria-pressed="'+(selected===id?'true':'false')+'">'+ico(icon)+'<span>'+esc(label)+'</span><small>'+(n===null?'—':n)+'</small></button>';}).join('')+'</div>';}
function dateKey(item){const ms=Date.parse(String(item?.data?.date||item?.created||''));return Number.isFinite(ms)?ms:0;}
function discover(items,media,{esc,ico}){
 const entries=safeItems(items).slice().sort((a,b)=>dateKey(b)-dateKey(a)).slice(0,4);
 const total=safeItems(items).length;
 const mediaCount=(Array.isArray(media?.photo)?media.photo.length:0)+(Array.isArray(media?.music)?media.music.length:0)+countByKind(items,'song');
 return '<div class="memories-v5-discover"><div class="memories-v5-hero"><span class="memories-v5-kicker">'+ico('sparkles')+' NUESTRA HISTORIA</span><h3>Todo lo que nos hace nosotros</h3><p>Explora nuestros momentos y encuentra cada recuerdo donde lo guardamos.</p><div class="memories-v5-stats"><span>'+total+' historias y planes</span><span>'+mediaCount+' archivos y canciones</span></div><button type="button" class="btn small" data-action="memories-section" data-section="collections">Explorar colecciones '+ico('arrow-right')+'</button></div><div class="section"><div class="row between"><h3>Lo más reciente</h3><button type="button" class="btn small secondary" data-action="memories-section" data-section="history">Ver historia</button></div>'+(entries.length?'<div class="memories-v5-recent">'+entries.map(item=>{const kind=categories.find(c=>c[0]===item.kind),title=String(item.data?.title||kind?.[1]||'Recuerdo');return '<button type="button" class="memories-v5-recent-card" data-action="memories-recent" data-kind="'+esc(item.kind)+'" data-id="'+esc(String(item.id??''))+'">'+ico(kind?.[2]||'heart')+'<span><b>'+esc(title)+'</b><small>'+esc(kind?.[1]||'Recuerdo')+'</small></span>'+ico('chevron-right')+'</button>';}).join('')+'</div>':'<p class="muted">Aquí aparecerán sus primeros recuerdos cuando los guarden.</p>')+'</div></div>';
}

/* P6B: private gallery uses only signed URLs already supplied by the app.
 * The presentational module never makes a request, stores identifiers or changes media.
 */
const usablePhoto=photo=>photo&&typeof photo.url==='string'&&/^https?:\/\/[^\s]+$/i.test(photo.url);
function albumGallery(photos,{attr,ico}){
 const items=Array.isArray(photos)?photos:[];
 return '<div class="memories-v5-photo-grid" role="list" aria-label="Fotos del álbum privado">'+items.map((photo,index)=>{
  const label='Ver foto '+(index+1)+' de '+items.length;
  return '<div class="memories-v5-photo-card" role="listitem">'+(usablePhoto(photo)?
   '<button type="button" class="memories-v5-photo-open" data-action="album-photo-view" data-index="'+index+'" aria-label="'+attr(label)+'">'+
   '<img loading="lazy" decoding="async" src="'+attr(photo.url)+'" alt="Foto '+(index+1)+' del álbum privado">'+
   '<span class="memories-v5-photo-hint" aria-hidden="true">'+ico('expand')+'</span></button>':
   '<span class="memories-v5-photo-missing" role="status">Imagen no disponible</span>')+'</div>';
 }).join('')+'</div>';
}
function albumViewer(photos,at,{attr,ico}){
 const entries=Array.isArray(photos)?photos:[];
 if(!Number.isSafeInteger(at)||at<0||at>=entries.length||!usablePhoto(entries[at]))return '';
 const photo=entries[at],label='Foto '+(at+1)+' de '+entries.length;
 return '<div class="memories-v5-photo-viewer" role="group" aria-label="'+attr(label)+'">'+
  '<figure><img src="'+attr(photo.url)+'" alt="'+attr(label)+'" loading="eager" decoding="async"></figure>'+
  '<div class="memories-v5-photo-toolbar"><button type="button" data-action="album-photo-view" data-index="'+(at-1)+'"'+(at===0?' disabled':'')+' aria-label="Foto anterior">'+ico('chevron-left')+' Anterior</button>'+
  '<output aria-live="polite">'+label+'</output>'+
  '<button type="button" data-action="album-photo-view" data-index="'+(at+1)+'"'+(at===entries.length-1?' disabled':'')+' aria-label="Foto siguiente">Siguiente '+ico('chevron-right')+'</button></div>'+
  (typeof photo.path==='string'&&photo.path.length?'<div class="memories-v5-photo-danger"><button type="button" class="btn small ghost" data-action="media-delete" data-kind="photo" data-path="'+attr(photo.path)+'">'+ico('trash-2')+' Eliminar esta foto</button><p>Esta acción requiere confirmación.</p></div>':'')+
  '</div>';
}


/* P6C: grouping is visual only. Original queue positions, providers and deletion
 * permissions remain unchanged. No inference when the artist is missing.
 */
const normalizeLabel=s=>String(s??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');
const providerLabel=p=>p==='spotify'?'Spotify':p==='youtube'?'YouTube / YouTube Music':p==='mp3'?'MP3 privado':'Audio por URL';
function musicGrouping(queue){
 const rows=Array.isArray(queue)?queue:[];
 const groups=[],byKey=new Map();
 rows.forEach((track,index)=>{
  if(!track||typeof track!=='object')return;
  const artist=typeof track.artist==='string'?track.artist.trim():'';
  const title=typeof track.title==='string'&&track.title.trim()?track.title.trim():'Canción';
  const isProvider=track.platform==='spotify'||track.platform==='youtube';
  const key=isProvider&&artist?normalizeLabel(title)+'|'+normalizeLabel(artist):null;
  let group=key?byKey.get(key):null;
  // Two entries from the same provider can be distinct recordings: do not merge.
  if(group&&group.entries.some(e=>e.track.platform===track.platform))group=null;
  if(!group){group={title,artist,entries:[]};groups.push(group);if(key&&!byKey.has(key))byKey.set(key,group);}
  group.entries.push({track,index});
 });
 return groups;
}
function musicLibrary(queue,currentIndex,playing,{esc,attr,ico}){
 const groups=musicGrouping(queue);
 return '<div class="memories-v5-music-library" role="list" aria-label="Biblioteca de música">'+groups.map(group=>{
  const multi=group.entries.length>1;
  return '<article class="memories-v5-track-group" role="listitem"><div class="memories-v5-track-head"><span class="memories-v5-track-art" aria-hidden="true">'+ico('music-2')+'</span><div><h4>'+esc(group.title)+'</h4><small>'+esc(group.artist||'Artista no especificado')+(multi?' · '+group.entries.length+' fuentes':'')+'</small></div></div><div class="memories-v5-track-sources">'+group.entries.map(({track,index})=>{
    const provider=providerLabel(track.platform),isActive=index===currentIndex;
    const mp3=track.type==='mp3';
    const deletion=mp3?(typeof track.path==='string'&&track.path?
      '<button class="btn small ghost" data-action="media-delete" data-kind="music" data-path="'+attr(track.path)+'">Eliminar</button>':''):
      '<button class="btn small ghost" data-action="item-delete" data-id="'+attr(track.id||'')+'">Eliminar</button>';
    const share=!mp3?'<button class="btn small secondary" data-action="galaxy-share" data-card-type="SONG" data-kind="song" data-id="'+attr(track.id||'')+'" data-title="'+attr(track.title||'Canción')+'">'+ico('send')+' Galaxy Chat</button>':'';
    return '<div class="memories-v5-track-source'+(isActive?' active':'')+'"><button type="button" class="music-play" data-action="music-play" data-index="'+index+'" aria-label="'+attr('Reproducir con '+provider+': '+group.title)+'">'+ico(isActive&&playing?'pause':'play')+'</button><span class="memories-v5-provider">'+esc(provider)+'</span><details class="memories-v5-track-more"><summary aria-label="'+attr('Opciones de '+provider)+'">'+ico('ellipsis')+' Opciones</summary><div class="row wrap">'+share+deletion+'</div></details></div>';
   }).join('')+'</div></article>';
 }).join('')+'</div>';
}


/* P6D — only a valid, explicit event date can appear on the calendar.
 * An annual event repeats on its declared month/day; we do not invent dates
 * for unclassified events or silently reinterpret item.created as event date.
 */
function validDate(raw){
 if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(raw))return false;
 const year=Number(raw.slice(0,4)),month=Number(raw.slice(5,7)),day=Number(raw.slice(8,10));
 if(year<1900||year>2199||month<1||month>12||day<1||day>31)return false;
 return new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)===raw;
}
const validMonth=value=>typeof value==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=2199;
function shiftMonth(value,offset){
 if(!validMonth(value)||!Number.isSafeInteger(offset)||Math.abs(offset)>12)return null;
 const y=Number(value.slice(0,4)),m=Number(value.slice(5,7));
 const next=new Date(Date.UTC(y,m-1+offset,1)),out=next.toISOString().slice(0,7);
 return validMonth(out)?out:null;
}
function calendarMonth(month,today,items){
 if(validMonth(month))return month;
 if(validDate(today))return today.slice(0,7);
 const found=(Array.isArray(items)?items:[]).find(item=>validDate(item?.data?.date));
 return found?found.data.date.slice(0,7):null;
}
function annualDateForYear(original,year){
 const day=original.slice(5),result=String(year).padStart(4,'0')+'-'+day;
 return validDate(result)?result:null;
}
function eventOccurrence(item,today){
 const date=item?.data?.date;
 if(!validDate(date))return null;
 if(!item.data?.annual||!validDate(today))return date;
 const currentYear=Number(today.slice(0,4)),firstYear=Number(date.slice(0,4));
 for(let y=Math.max(currentYear,firstYear);y<=Math.min(2199,currentYear+8);y++){
  const when=annualDateForYear(date,y);
  if(when&&when>=today)return when;
 }
 return null;
}
function eventRows(items,today){
 const validToday=validDate(today)?today:null,dated=[],undated=[];
 for(const item of Array.isArray(items)?items:[]){
  if(!item||item.kind!=='event'||typeof item!=='object')continue;
  const when=eventOccurrence(item,validToday);
  if(when)dated.push({item,when,annual:item.data?.annual===true,upcoming:validToday?when>=validToday:null});
  else if(!validDate(item?.data?.date))undated.push(item);
 }
 dated.sort((a,b)=>a.when.localeCompare(b.when)||String(a.item.id??'').localeCompare(String(b.item.id??'')));
 return {dated,undated,validToday};
}
function monthEvents(items,month){
 if(!validMonth(month))return [];
 const output=[],year=Number(month.slice(0,4));
 for(const item of Array.isArray(items)?items:[]){
  if(!item||item.kind!=='event'||!validDate(item.data?.date))continue;
  const original=item.data.date;
  const when=item.data.annual===true&&year>=Number(original.slice(0,4))?
   annualDateForYear(original,year):(original.slice(0,7)===month?original:null);
  if(when&&when.slice(0,7)===month)output.push({item,when,annual:item.data.annual===true});
 }
 return output.sort((a,b)=>a.when.localeCompare(b.when));
}
function eventCalendar(items,{today,month,mode='month',selectedDate}={}, {esc,attr,ico,itemCard}){
 const safe=Array.isArray(items)?items.filter(x=>x?.kind==='event'):[];
 const current=calendarMonth(month,today,safe),rows=eventRows(safe,today);
 const view=mode==='agenda'?'agenda':'month',button=(value,label)=>'<button type="button" data-action="memories-calendar-view" data-mode="'+value+'" aria-pressed="'+(view===value)+'">'+label+'</button>';
 const toolbar='<div class="memories-v5-calendar-toggle" role="group" aria-label="Vista del calendario">'+button('month','Mes')+button('agenda','Agenda')+'</div>';
 const renderItems=list=>'<div class="memories-v5-calendar-items">'+list.map(x=>itemCard(x.item||x)).join('')+'</div>';
 if(view==='agenda'){
  const upcoming=rows.validToday?rows.dated.filter(x=>x.upcoming):rows.dated;
  const past=rows.validToday?rows.dated.filter(x=>!x.upcoming).reverse():[];
  const section=(name,list,empty)=>'<section class="memories-v5-event-group"><h4>'+name+' <small>'+list.length+'</small></h4>'+(list.length?renderItems(list):'<p class="muted">'+empty+'</p>')+'</section>';
  return '<div class="memories-v5-event-calendar">'+toolbar+
   section(rows.validToday?'Próximas fechas':'Fechas guardadas',upcoming,'No hay fechas en esta sección.')+
   (rows.validToday?section('Fechas vividas',past,'Aún no hay fechas anteriores.'):'')+
   (rows.undated.length?section('Sin fecha definida',rows.undated,''):'')+'</div>';
 }
 if(!current)return '<div class="memories-v5-event-calendar">'+toolbar+'<p class="muted">Agrega una fecha válida a un evento para ver el calendario.</p></div>';
 const [year,monthNum]=current.split('-').map(Number);
 const first=(new Date(Date.UTC(year,monthNum-1,1)).getUTCDay()+6)%7;
 const days=new Date(Date.UTC(year,monthNum,0)).getUTCDate();
 const entries=monthEvents(safe,current),dayCounts=new Map();
 for(const row of entries)dayCounts.set(row.when,(dayCounts.get(row.when)||0)+1);
 const chosen=validDate(selectedDate)&&selectedDate.slice(0,7)===current?selectedDate:
  validDate(today)&&today.slice(0,7)===current?today:null;
 const controls='<div class="memories-v5-month-controls"><button type="button" data-action="memories-month-shift" data-offset="-1" aria-label="Mes anterior"'+(!shiftMonth(current,-1)?' disabled':'')+'>'+ico('chevron-left')+'</button><h4>'+esc(new Date(Date.UTC(year,monthNum-1,1)).toLocaleDateString('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}))+'</h4><button type="button" data-action="memories-month-shift" data-offset="1" aria-label="Mes siguiente"'+(!shiftMonth(current,1)?' disabled':'')+'>'+ico('chevron-right')+'</button></div>';
 const dayHeaders=['L','M','M','J','V','S','D'].map((label,index)=>'<span role="columnheader" aria-label="'+['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][index]+'">'+label+'</span>').join('');
 const slots=Array.from({length:first},()=>'<span class="memories-v5-calendar-empty" aria-hidden="true"></span>').join('')+
  Array.from({length:days},(_,i)=>{const date=current+'-'+String(i+1).padStart(2,'0'),num=dayCounts.get(date)||0;
   return '<button type="button" class="memories-v5-calendar-day'+(chosen===date?' selected':'')+(num?' has-events':'')+'" data-action="memories-calendar-day" data-date="'+date+'" aria-pressed="'+(chosen===date)+'" aria-label="'+attr('Día '+(i+1)+', '+num+' '+(num===1?'evento':'eventos'))+'">'+(i+1)+(num?'<span class="memories-v5-day-count" aria-hidden="true">'+num+'</span>':'')+'</button>';
  }).join('');
 const selection=chosen?entries.filter(x=>x.when===chosen):[];
 return '<div class="memories-v5-event-calendar">'+toolbar+controls+
  '<div class="memories-v5-calendar-grid" role="grid" aria-label="Calendario de fechas especiales">'+dayHeaders+slots+'</div>'+
  '<section class="memories-v5-selected-day"><h4>'+(chosen?'Día '+esc(chosen)+' · '+selection.length+' '+(selection.length===1?'evento':'eventos'):'Selecciona un día')+'</h4>'+
   (selection.length?renderItems(selection):'<p class="muted">'+(chosen?'No hay eventos guardados para este día.':'Selecciona una fecha para consultar sus eventos.')+'</p>')+'</section>'+
   (rows.undated.length?'<p class="muted">'+rows.undated.length+' '+(rows.undated.length===1?'evento sin fecha':'eventos sin fecha')+'. Puedes consultarlos en Agenda.</p>':'')+'</div>';
}


/* P6D collections present original authenticated plan/note/wish objects.
 * They only group visual states the user has explicitly saved.
 * Never infer a completion state or silently update/remove source items.
 */
function organizedCollection(items,kind,{esc,attr,ico,itemCard}){
 if(!['plan','note','wish'].includes(kind))return '';
 const list=(Array.isArray(items)?items:[]).filter(x=>x&&x.kind===kind&&x.data&&typeof x.data==='object');
 const sections=[];
 if(kind==='plan'){
  const active=list.filter(x=>x.data.done!==true),completed=list.filter(x=>x.data.done===true);
  const chosen=active.filter(x=>x.data.planCategory==='this-week');
  const later=active.filter(x=>x.data.planCategory==='someday');
  const rest=active.filter(x=>x.data.planCategory!=='this-week'&&x.data.planCategory!=='someday');
  sections.push(['Elegidos para esta semana',chosen,'calendar-check'],['Planes por hacer',rest,'list-todo'],['Algún día',later,'cloud-sun'],['Planes realizados',completed,'check-circle']);
 }else if(kind==='wish'){
  sections.push(['Deseos guardados',list.filter(x=>x.data.done!==true),'star'],['Deseos marcados como cumplidos',list.filter(x=>x.data.done===true),'sparkles']);
 }else{
  // Category is a user-saved label, not a generated topic or AI classification.
  const byCategory=new Map();
  for(const item of list){
   const name=typeof item.data.category==='string'&&item.data.category.trim()?item.data.category.trim():'Sin categoría';
   if(!byCategory.has(name))byCategory.set(name,[]);
   byCategory.get(name).push(item);
  }
  for(const [title,group] of byCategory)sections.push([title,group,'notebook-pen']);
 }
 const card=(item)=>kind==='note'?
  '<details class="memories-v5-note" data-item-id="'+attr(item.id??'')+'"><summary>'+ico('file-text')+' <span><b>'+esc(item.data.title||'Nota sin título')+'</b><small>Ver contenido y opciones de esta nota</small></span>'+ico('chevron-down')+'</summary><div class="memories-v5-note-body">'+itemCard(item)+'</div></details>':
  '<div class="memories-v5-specialized-card">'+itemCard(item)+'</div>';
 const groups=sections.filter(([title,rows])=>rows.length).map(([title,rows,icon])=>
  '<section class="memories-v5-collection-group"><h4>'+ico(icon)+' '+esc(title)+' <small>'+rows.length+'</small></h4>'+
  '<div class="memories-v5-specialized-list">'+rows.map(card).join('')+'</div></section>').join('');
 const label=kind==='plan'?'planes':kind==='note'?'notas':'deseos';
 return '<div class="memories-v5-organized" aria-label="Biblioteca de '+label+'">'+
  (groups||'<div class="empty">Todavía no hay '+label+' guardados.</div>')+'</div>';
}


/* P6E: presentation only. Locked capsules must never invoke the full renderer. */
function capsuleShelf(items,{esc,attr,ico,itemCard}){
 const rows=(Array.isArray(items)?items:[]).filter(x=>x?.kind==='capsule'&&x.data&&typeof x.data==='object');
 const locked=rows.filter(x=>x.data.locked===true),opened=rows.filter(x=>x.data.locked!==true);
 const cover=x=>{
  const d=x.data;
  const when=d.unlockType==='place'?'Se abre al llegar al lugar elegido':
   (typeof d.unlockDate==='string'&&validDate(d.unlockDate)?'Disponible desde '+d.unlockDate:'Aún no disponible');
  return '<article class="memories-v5-capsule locked" data-item-id="'+attr(x.id??'')+'"><span class="memories-v5-symbol">'+ico('lock-keyhole')+'</span><div>'+
   '<small>Guardada para después</small><h4>'+esc(d.title||'Cápsula')+'</h4><p>'+esc(when)+'</p><small>Contenido protegido</small></div></article>';
 };
 const open=x=>'<details class="memories-v5-capsule opened" data-item-id="'+attr(x.id??'')+'"><summary>'+
  '<span class="memories-v5-symbol">'+ico('gift')+'</span><span><small>Disponible para descubrir</small><b>'+esc(x.data.title||'Cápsula')+'</b></span>'+
  ico('chevron-down')+'</summary><div class="memories-v5-shelf-detail">'+itemCard(x)+'</div></details>';
 const section=(label,rows,render)=>rows.length?'<section class="memories-v5-shelf-section"><h4>'+label+' <small>'+rows.length+'</small></h4>'+
  '<div class="memories-v5-shelf-list">'+rows.map(render).join('')+'</div></section>':'';
 return '<div class="memories-v5-shelf">'+section('Por descubrir',locked,cover)+section('Cápsulas abiertas',opened,open)+
  (rows.length?'':'<div class="empty">Guarden una cápsula para descubrirla juntos cuando llegue su momento.</div>')+'</div>';
}
function journeyShelf(items,{esc,attr,ico,itemCard}){
 const journeys=(Array.isArray(items)?items:[]).filter(x=>x?.kind==='journey'&&x.data&&typeof x.data==='object');
 const dated=journeys.filter(x=>validDate(x.data.date)).slice().sort((a,b)=>b.data.date.localeCompare(a.data.date));
 const groups=new Map();
 for(const x of dated){const year=x.data.date.slice(0,4);if(!groups.has(year))groups.set(year,[]);groups.get(year).push(x);}
 const undated=journeys.filter(x=>!validDate(x.data.date));
 if(undated.length)groups.set('Sin fecha registrada',undated);
 const card=x=>'<details class="memories-v5-journey" data-item-id="'+attr(x.id??'')+'"><summary>'+
  '<span class="memories-v5-symbol">'+ico('route')+'</span><span><b>'+esc(x.data.title||'Nuestro viaje')+'</b><small>'+
  (validDate(x.data.date)?esc(x.data.date):'Sin fecha guardada')+
  (typeof x.data.placeName==='string'&&x.data.placeName.trim()?' · '+esc(x.data.placeName.trim()):'')+
  '</small></span>'+ico('chevron-down')+'</summary><div class="memories-v5-shelf-detail">'+itemCard(x)+'</div></details>';
 const sections=[...groups].map(([label,group])=>'<section class="memories-v5-shelf-section"><h4>'+esc(label)+' <small>'+group.length+'</small></h4><div class="memories-v5-shelf-list">'+group.map(card).join('')+'</div></section>').join('');
 return '<div class="memories-v5-shelf">'+(sections||'<div class="empty">Sus próximas aventuras aparecerán aquí cuando las guarden.</div>')+'</div>';
}


/* P6F: history derived only from authenticated items and explicit event dates.
 * The creation timestamp, if available, is labelled as save date, never as event date.
 * Locked capsules are excluded even when their public unlock date is in the past.
 */
function timelineRows(items,today){
 const allowed=new Set(['memory','journey','event','capsule','song']),todayKnown=validDate(today);
 const known=[],undated=[];
 for(const item of Array.isArray(items)?items:[]){
  if(!item||!allowed.has(item.kind)||!item.data||typeof item.data!=='object')continue;
  if(item.kind==='capsule'&&item.data.locked===true)continue;
  const date=validDate(item.data.date)?item.data.date:null;
  const created=typeof item.created==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(item.created)&&validDate(item.created.slice(0,10))?item.created.slice(0,10):null;
  const row={item,when:date,created,upcoming:date!==null&&todayKnown&&date>today};
  if(date)known.push(row);else undated.push(row);
 }
 known.sort((a,b)=>b.when.localeCompare(a.when)||String(b.item.id??'').localeCompare(String(a.item.id??'')));
 undated.sort((a,b)=>(b.created||'').localeCompare(a.created||''));
 return {known,undated,todayKnown};
}
function historyTimeline(items,today,{esc,attr,ico,itemCard}){
 const {known,undated}=timelineRows(items,today),upcoming=known.filter(x=>x.upcoming),past=known.filter(x=>!x.upcoming);
 const typeNames={memory:['Recuerdo','heart'],journey:['Viaje','route'],event:['Fecha especial','calendar'],capsule:['Cápsula abierta','gift'],song:['Canción','music']};
 const card=row=>{
  const item=row.item,label=typeNames[item.kind]||['Historia','sparkles'];
  const title=String(item.data?.title||label[0]);
  return '<details class="memories-v5-history-card" data-item-id="'+attr(item.id??'')+'"><summary>'+
   '<span class="memories-v5-history-icon" aria-hidden="true">'+ico(label[1])+'</span>'+
   '<span class="memories-v5-history-summary"><b>'+esc(title)+'</b><small>'+esc(label[0])+
   (row.when?' · Vivido el '+esc(row.when):row.created?' · Guardado el '+esc(row.created):' · Sin fecha registrada')+'</small></span>'+
   ico('chevron-down')+'</summary><div class="memories-v5-history-detail">'+itemCard(item)+'</div></details>';
 };
 const group=(title,list,icon)=>{
  if(!list.length)return '';
  const months=new Map();
  for(const row of list){
   const month=row.when?.slice(0,7)||'Sin fecha de vivencia';
   if(!months.has(month))months.set(month,[]);
   months.get(month).push(row);
  }
  return '<section class="memories-v5-history-section"><h3>'+ico(icon)+' '+title+' <small>'+list.length+'</small></h3>'+
   [...months].map(([month,group])=>'<div class="memories-v5-history-month"><h4>'+esc(month)+' <small>'+group.length+'</small></h4>'+
    '<div class="memories-v5-history-stack">'+group.map(card).join('')+'</div></div>').join('')+'</section>';
 };
 const unclassified=undated.length?'<section class="memories-v5-history-section"><h3>'+ico('book-open')+' Fecha de vivencia no registrada <small>'+undated.length+'</small></h3>'+
  '<p class="muted">Cuando falta la fecha de la experiencia, mostramos la fecha de guardado si existe.</p>'+
  '<div class="memories-v5-history-stack">'+undated.map(card).join('')+'</div></section>':'';
 return '<section class="section memories-v5-history"><div class="section-head"><div><h2>Nuestra historia</h2>'+
  '<p>Fechas auténticas de lo que vivimos, próximas experiencias y recuerdos aún sin fecha.</p></div></div>'+
  group('Próximamente',upcoming,'calendar-clock')+group('Lo que vivimos',past,'book-heart')+unclassified+
  (!known.length&&!undated.length?'<div class="empty">Nuestra historia crecerá a medida que guardemos recuerdos juntos.</div>':'')+'</section>';
}

root.GalaxyMemoriesV5=Object.freeze({categories:categories.map(x=>x.slice()),sectionsNav,collections,discover,safeItems,albumGallery,albumViewer,musicGrouping,musicLibrary,validDate,shiftMonth,calendarMonth,eventOccurrence,eventRows,monthEvents,eventCalendar,organizedCollection,capsuleShelf,journeyShelf,timelineRows,historyTimeline});
})(window);
