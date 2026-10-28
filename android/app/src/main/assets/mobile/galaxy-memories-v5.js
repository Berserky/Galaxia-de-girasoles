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

root.GalaxyMemoriesV5=Object.freeze({categories:categories.map(x=>x.slice()),sectionsNav,collections,discover,safeItems,albumGallery,albumViewer});
})(window);
