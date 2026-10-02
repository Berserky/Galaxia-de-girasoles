// Presentation only. Existing actions still own saving, uploads and permissions.
export function mobileNavigation(view,icon){
 const links=[['inicio','home','Inicio'],['recuerdos','heart','Historia'],['mapa','pin','Mapa']];
 const secondary=!links.some(([id])=>id===view);
 return `<nav class="mobile-dock" aria-label="Navegación móvil">${links.map(([id,symbol,label])=>`${id==='mapa'?'<button class="dock-create" data-action="create-menu" aria-haspopup="dialog" aria-label="Crear un recuerdo, plan o momento">'+icon('plus')+'<span>Crear</span></button>':''}<a href="#${id}" ${view===id?'aria-current="page"':''}>${icon(symbol)}<span>${label}</span></a>`).join('')}<button data-action="more" ${secondary?'aria-current="page"':''} aria-haspopup="dialog" aria-label="Explorar todas las secciones">${icon('grid')}<span>Explorar</span></button></nav>`;
}

export function exploreMarkup(icon){
 const groups=[['Para cada día',[
  ['inicio','home','Inicio','Lo importante, a primera vista'],
  ['conectar','heart','Conectar','Un ratito para escucharnos'],
  ['mapa','pin','Nuestro mapa','Cerca, aunque estemos lejos']
 ]],['Nuestra historia',[
  ['recuerdos','note','Recuerdos','Volver a nuestros momentos'],
  ['album','photo','Álbum','Todas nuestras fotografías'],
  ['musica','music','Música','La banda sonora de lo nuestro']
 ]],['Lo que viene',[
  ['planes','spark','Planes','Ideas para vivir juntos'],
  ['calendario','calendar','Calendario','Días que merecen un lugar'],
  ['universo','grid','Universo','Cápsulas, deseos y viajes']
 ]]];
 return `<span class="eyebrow">TODO, EN SU LUGAR</span><h2 id="modal-title">Explora nuestra galaxia</h2><p>Lo cotidiano, los recuerdos y todo lo que viene.</p><div class="explore-groups">${groups.map(([title,links])=>`<section><h3>${title}</h3><div class="explore-links">${links.map(([id,symbol,label,sub])=>`<a href="#${id}"><span class="menu-icon">${icon(symbol)}</span><span><b>${label}</b><small>${sub}</small></span>${icon('arrow')}</a>`).join('')}</div></section>`).join('')}</div><div class="explore-footer"><a href="#ajustes">${icon('settings')}Ajustes</a><a href="/regalo/">${icon('sun')}El regalo original</a></div>`;
}

export function createMarkup(icon){
 const actions=[['new-memory','heart','Un recuerdo','Un momento que se queda'],['upload','photo','Fotos','Del celular a nuestro álbum'],['new-song','music','Una canción','Algo que suene a nosotros'],['new-event','calendar','Una fecha','Un día para celebrar'],['new-plan','spark','Un plan','Nuestra próxima aventura'],['new-capsule','lock','Una cápsula','Un mensaje para después'],['new-wish','sun','Un deseo','Algo que queremos vivir'],['new-journey','pin','Un viaje','Una historia por recorrer']];
 return `<span class="eyebrow">HAGAMOS ESPACIO PARA ALGO BONITO</span><h2 id="modal-title">¿Qué guardamos hoy?</h2><p>Cada pequeña cosa hace más grande nuestra historia.</p><div class="create-grid">${actions.map(([action,symbol,title,sub])=>`<button data-action="${action}"><span class="menu-icon">${icon(symbol)}</span><span><b>${title}</b><small>${sub}</small></span>${icon('plus')}</button>`).join('')}</div>`;
}
