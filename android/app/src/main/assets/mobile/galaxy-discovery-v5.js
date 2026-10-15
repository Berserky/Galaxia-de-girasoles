/* V5-P3: presentational search and notifications; no API or IA engine changes. */
(function(root){
 'use strict';
 const categories={chat_message:'Chat',status_changed:'Actividad',mood_changed:'Actividad',daily_answer:'Actividad',goal_update:'Actividad',nearby:'Mapa',arrived_safe:'Mapa',memory_shared:'Recuerdos',plan_update:'Actividades',gesture:'Actividad'};
 const typeLabel=(kind,type)=>type==='place'?'Lugar':({'memory':'Recuerdo','song':'Canción','note':'Nota','event':'Fecha','journey':'Viaje','capsule':'Cápsula','wish':'Deseo','plan':'Plan','goal':'Objetivo'}[kind]||'Contenido');
 const eventCategory=n=>n.event_type==='chat_message'||n.action==='chat'?'chat':(n.event_type==='nearby'||n.event_type==='arrived_safe'?'map':'activity');
 const eventName=n=>categories[n.event_type]||'Actividad';
 const dayLabel=(value)=>{const time=Date.parse(value||'');return Number.isFinite(time)?new Date(time).toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'}):'Sin fecha';};
 const html=(value)=>String(value==null?'':value);
 function renderClassic(rows,helpers){
  const {ico,esc,attr,kindMeta}=helpers,groups=[];
  // Keep server/local relevance order unchanged; groups only label contiguous results.
  (rows||[]).forEach(row=>{
   const label=typeLabel(row.kind,row.type);
   let group=groups[groups.length-1];
   if(!group||group.label!==label){group={label,rows:[]};groups.push(group);}
   group.rows.push(row);
  });
  return '<div class="v5-discovery-groups">'+groups.map(g=>'<section class="v5-result-group" aria-label="'+attr(g.label)+'"><h3 class="v5-group-heading">'+esc(g.label)+' <span>'+g.rows.length+'</span></h3><div class="universal-search-list">'+g.rows.map(row=>{
   const iconName=row.type==='place'?'map-pin':(kindMeta[row.kind]?.[0]||'file-text');
   return '<button type="button" class="universal-search-result" data-action="universal-search-result" data-type="'+attr(row.type)+'" data-id="'+attr(row.id)+'" data-kind="'+attr(row.kind||'')+'"><span class="search-result-icon">'+ico(iconName)+'</span><span class="search-result-copy"><b>'+esc(row.title)+'</b><small>'+esc(row.subtitle||'')+'</small></span>'+ico('chevron-right')+'</button>';
  }).join('')+'</div></section>').join('')+'</div><p class="universal-search-count" role="status">'+rows.length+' resultado'+(rows.length===1?'':'s')+' directos</p>';
 }
 function notificationOptions(state){
  const all=Array.isArray(state?.notifications)?state.notifications:[];
  return [{id:'all',label:'Todas',count:all.length},{id:'unread',label:'Sin leer',count:all.filter(n=>!n.read_at).length},{id:'chat',label:'Chat',count:all.filter(n=>eventCategory(n)==='chat').length},{id:'activity',label:'Actividad',count:all.filter(n=>eventCategory(n)!=='chat').length}];
 }
 function renderNotifications(state,filter,helpers){
  const {ico,esc,attr,fmtDateTime}=helpers,all=Array.isArray(state?.notifications)?state.notifications:[];
  const selected=['all','unread','chat','activity'].includes(filter)?filter:'all';
  const rows=all.filter(n=>selected==='all'||(selected==='unread'?!n.read_at:selected==='chat'?eventCategory(n)==='chat':eventCategory(n)!=='chat'));
  const buttons=notificationOptions(state).map(item=>'<button type="button" role="tab" class="v5-notification-filter" aria-selected="'+(selected===item.id)+'" data-action="notifications-filter" data-filter="'+item.id+'">'+item.label+' <span>'+item.count+'</span></button>').join('');
  const groups=[];
  rows.forEach(n=>{
   const category=eventCategory(n),day=dayLabel(n.created_at),key=day+'|'+category;
   let group=groups[groups.length-1];
   if(!group||group.key!==key){group={key,day,category,rows:[]};groups.push(group);}
   group.rows.push(n);
  });
  const body=groups.map(group=>'<section class="v5-notification-group" role="group" aria-label="'+attr(group.day+', '+(group.category==='chat'?'Chat':'Actividad'))+'"><h3 class="v5-group-heading">'+esc(group.day)+' <span>'+ (group.category==='chat'?'Chat':'Actividad')+'</span></h3>'+group.rows.map(n=>{
   const unread=!n.read_at,tag=eventName(n),time=Date.parse(n.created_at||'');
   const historical=(n.event_type==='nearby'&&Number.isFinite(time)&&time<Date.now()-60*60*1000);
   const name=html(n.title).trim(),title=(name?name:tag);
   return '<button type="button" class="notification-row '+(unread?'unread':'')+'" data-action="notification-open" data-id="'+attr(n.id)+'" data-target="'+attr(n.action||'home')+'" data-entity-id="'+attr(n.entity_id||'')+'" aria-label="'+attr((unread?'Sin leer. ':'')+tag+'. '+title)+'"><span class="notification-row-icon">'+ico(helpers.notificationIcon(n.event_type))+'</span><span class="v5-notification-body"><span class="v5-notification-meta"><span class="v5-event-kind">'+esc(historical?'Aviso anterior · Mapa':tag)+'</span>'+(unread?'<span class="v5-unread-indicator">Sin leer</span>':'')+'</span><b>'+esc(title)+'</b><small>'+esc(n.body||'')+'</small><em>'+esc(fmtDateTime(n.created_at))+'</em></span></button>';
  }).join('')+'</section>').join('');
  const empty=selected==='unread'?'No tienes avisos sin leer.':selected==='chat'?'No hay avisos de Chat.':selected==='activity'?'No hay actividad en este filtro.':'Todavía no hay notificaciones.';
  return '<div class="v5-notification-panel"><div class="notification-center-head"><p role="status">'+Math.max(0,Number(state?.unread||0))+' sin leer</p>'+(Number(state?.unread||0)>0?'<button class="btn small ghost" type="button" data-action="notifications-read-all">Marcar todas como leídas</button>':'')+'</div><div class="v5-notification-filters" role="tablist" aria-label="Filtrar notificaciones">'+buttons+'</div><div class="notification-center-list" role="tabpanel" aria-live="polite">'+(rows.length?body:'<div class="universal-search-empty">'+ico('bell-off')+'<h3>'+esc(empty)+'</h3></div>')+'</div></div>';
 }
 root.GalaxyDiscoveryV5=Object.freeze({renderClassic,renderNotifications,eventCategory,notificationOptions});
})(window);
