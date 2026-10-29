(function(root){
'use strict';
// P7A only relocates existing DOM elements; no network, permissions or state changes.
const groups=[
 ['privacy','Privacidad y ubicación'],['appearance','Apariencia y temas'],
 ['notifications','Notificaciones'],['backups','Datos y copias'],
 ['widgets','Widgets'],['profiles','Perfiles y dispositivos'],
 ['system','Sistema y actualizaciones'],['sensitive','Acciones sensibles'],
 ['other','Otros controles']];
function classify(meta={}){
 const actions=meta.actions||[],classes=meta.classes||[],forms=meta.forms||[];
 const has=a=>actions.includes(a);
 if(has('unpair'))return 'sensitive';
 if(meta.id==='presencePrivacySettings'||classes.includes('gps-history-card')||has('gps-history-export'))return 'privacy';
 if(classes.includes('theme-settings-card')||has('theme-set'))return 'appearance';
 if(meta.notificationHealth||has('moment-notifications')||has('galaxy-notifications-enable'))return 'notifications';
 if(has('backup-export')||has('backup-import'))return 'backups';
 if(has('widget-add')||has('widget-photo'))return 'widgets';
 if(forms.includes('settingsForm')||has('pair-code-self')||has('pair-code-partner')||has('device-revoke')||has('welcome-replay'))return 'profiles';
 if(meta.heading==='Permisos de Android')return 'profiles';
 if(meta.id==='updateCard'||has('update-check')||has('app-settings'))return 'system';
 return 'other';
}

function privacyAudience(shared){
 return shared?'Compartido con la pareja vinculada':'Solo para este perfil';
}
// P7B: enhance only the controls already rendered from authenticated/native state.
// No new source of truth, API, permission or destructive handler is introduced.
function enhancePrivacy(hub){
 const area=hub?.querySelector?.('[data-group="privacy"] .v5-more-group-content');
 if(!area)return false;
 const presence=area.querySelector('#presencePrivacySettings');
 if(presence){
  const grid=presence.querySelector('.privacy-grid');
  for(const [action,label] of [['presence-battery','Batería'],['presence-listening','Música escuchada']]){
   const button=grid?.querySelector('[data-action="'+action+'"]');
   if(!button)continue;
   const shared=button.classList.contains('active');
   button.setAttribute('role','switch');
   button.setAttribute('aria-checked',String(shared));
   button.setAttribute('aria-label',label+': '+privacyAudience(shared)+'. Cambiar preferencia');
   const status=button.querySelector('small');
   if(status)status.textContent=privacyAudience(shared);
  }
  const gps=grid?.querySelector('[data-action="map"]');
  if(gps){
   gps.classList.add('v5-gps-navigation');
   const status=gps.querySelector('small')?.textContent?.trim()||'Estado no disponible';
   gps.setAttribute('aria-label','Abrir el mapa para gestionar la ubicación. Estado actual: '+status);
  }
  const note=presence.ownerDocument.createElement('p');
  note.className='v5-privacy-audience';
  note.textContent='Batería y música: decide qué puede ver la pareja vinculada. La ubicación se controla por separado desde el mapa; abrirlo no cambia el permiso GPS.';
  presence.append(note);
 }
 const history=area.querySelector('.gps-history-card');
 const exportButton=history?.querySelector('[data-action="gps-history-export"]');
 const deleteButton=history?.querySelector('[data-action="gps-history-delete-open"]');
 // Only restructure the known pair. Keep both original button nodes and their handlers.
 if(exportButton&&deleteButton&&exportButton.parentNode===deleteButton.parentNode){
  const row=exportButton.parentNode;
  if(row.children.length===2){
   const doc=history.ownerDocument,actions=doc.createElement('div');
   actions.className='v5-gps-actions';
   const addZone=(kind,title,description,button)=>{
    const zone=doc.createElement('section');zone.className='v5-gps-zone v5-gps-zone-'+kind;
    const heading=doc.createElement('h4');heading.textContent=title;
    const help=doc.createElement('p');help.textContent=description;
    zone.append(heading,help,button);actions.append(zone);
   };
   addZone('export','Exportar mi historial','Genera una copia de mis datos de movilidad. Exportar no borra ningún registro.',exportButton);
   addZone('delete','Borrado irreversible','Borra solo mis puntos GPS, recorridos y eventos de movilidad. Conserva lugares guardados, recuerdos, encuentros y datos de mi pareja. Exige la confirmación original.',deleteButton);
   row.parentNode.insertBefore(actions,row);
   row.remove();
  }
 }
 return true;
}


/* P7C: real theme palettes and read-only preview. The existing theme-set
   buttons remain the sole way to persist a choice. */
const THEME_PALETTES=Object.freeze({
 daylight:{surface:'#ffffff',text:'#292638',accent:'#7254c7'},
 cosmic:{surface:'#17172a',text:'#f4f1ff',accent:'#a78bfa'},
 halloween:{surface:'#1b1020',text:'#fff0de',accent:'#f28c28'},
 christmas:{surface:'#0c2119',text:'#f2fff6',accent:'#d65360'},
 valentine:{surface:'#28101b',text:'#fff4f7',accent:'#f06f91'},
 friendship:{surface:'#1c1433',text:'#fff8eb',accent:'#f1b84b'},
 easter:{surface:'#19213d',text:'#f7f5ff',accent:'#b29cff'}
});
function themePalette(engine,choice,now=new Date()){
 if(!engine?.resolve)return null;
 const state=engine.resolve(choice,now),colors=THEME_PALETTES[state.active];
 const bg=engine.COLORS?.[state.active];
 return colors&&bg?{id:state.active,bg,...colors}:null;
}
function nextAutoChange(engine,now=new Date()){
 if(!engine?.seasonal)return null;
 const current=engine.seasonal(now);
 const day=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 for(let offset=1;offset<=370;offset++){
  day.setDate(day.getDate()+1);
  const next=engine.seasonal(day);
  if(next!==current)return{date:new Date(day),theme:next};
 }
 return null;
}
function enhanceAppearance(hub,engine=root.GalaxyTheme,now=new Date()){
 const area=hub?.querySelector?.('[data-group="appearance"] .v5-more-group-content');
 const card=area?.querySelector?.('.theme-settings-card');
 const grid=card?.querySelector?.('.theme-grid');
 if(!grid||!engine?.options||grid.querySelector('.v5-theme-tile'))return false;
 const doc=card.ownerDocument,preview=doc.createElement('section');
 preview.className='v5-theme-live-preview';
 preview.setAttribute('role','status');
 preview.setAttribute('aria-live','polite');
 const title=doc.createElement('h4'),sample=doc.createElement('div'),caption=doc.createElement('p');
 sample.className='v5-theme-sample';
 preview.append(title,sample,caption);
 const show=choice=>{
  const palette=themePalette(engine,choice,now);
  if(!palette)return false;
  const name=engine.LABELS?.[palette.id]||palette.id;
  title.textContent='Vista previa: '+name;
  sample.replaceChildren();
  sample.style.backgroundColor=palette.bg;
  sample.style.color=palette.text;
  const surface=doc.createElement('span'),accent=doc.createElement('span');
  surface.className='v5-theme-sample-surface';surface.style.backgroundColor=palette.surface;
  surface.style.color=palette.text;surface.textContent='Superficie';
  accent.className='v5-theme-sample-accent';accent.style.backgroundColor=palette.accent;
  accent.textContent='Acento';
  sample.append(surface,accent);
  caption.textContent='Solo vista previa: no se ha cambiado ni guardado el tema.';
  return true;
 };
 for(const original of [...grid.querySelectorAll('button[data-action="theme-set"]')]){
  const choice=original.dataset.value;
  if(!themePalette(engine,choice,now))continue;
  const tile=doc.createElement('div');tile.className='v5-theme-tile';
  original.setAttribute('aria-pressed',String(engine.getChoice()===choice));
  const swatches=doc.createElement('span');swatches.className='v5-theme-swatches';
  const palette=themePalette(engine,choice,now);
  for(const color of [palette.bg,palette.surface,palette.accent]){
   const dot=doc.createElement('i');dot.style.backgroundColor=color;dot.setAttribute('aria-hidden','true');swatches.append(dot);
  }
  original.append(swatches);
  const tryButton=doc.createElement('button');
  tryButton.type='button';tryButton.className='v5-theme-try';
  tryButton.textContent='Ver sin aplicar';
  tryButton.setAttribute('aria-label','Vista previa de '+(engine.LABELS?.[choice]||choice)+' sin cambiar el tema');
  tryButton.addEventListener('click',event=>{event.stopPropagation();show(choice);});
  grid.replaceChild(tile,original);
  tile.append(original,tryButton);
 }
 card.append(preview);
 show(engine.getChoice());
 const next=nextAutoChange(engine,now);
 if(next){
  const note=doc.createElement('p');note.className='v5-theme-calendar';
  const date=next.date.toLocaleDateString('es-CO',{day:'numeric',month:'long',year:'numeric'});
  note.textContent='Automático usa la fecha local. Próximo cambio previsto: '+date+' ('+(engine.LABELS?.[next.theme]||next.theme)+'). Cada teléfono guarda su elección por separado.';
  card.append(note);
 }
 return true;
}


// P7D: read only the native-derived labels already rendered by the settings
// screen. Permission, FCM setup and local test requests do NOT prove delivery.
function notificationIndicator(node,fallback='Estado no disponible'){
 const label=node?.textContent?.replace(/\s+/g,' ').trim();
 return label||fallback;
}
function enhanceNotifications(hub){
 const area=hub?.querySelector?.('[data-group="notifications"] .v5-more-group-content');
 if(!area||area.querySelector('.v5-notification-overview'))return false;
 const cards=[...area.querySelectorAll('.card')];
 const activity=cards.find(card=>card.querySelector('.eyebrow')?.textContent?.trim()==='NOTIFICACIONES');
 const moments=cards.find(card=>card.querySelector('[data-action="moment-notifications"]'));
 if(!activity||!moments)return false;
 const activityIndicators=activity.querySelectorAll('.notification-health span');
 const momentIndicators=moments.querySelectorAll('.notification-health span');
 const readings=[
  ['Permiso Android',notificationIndicator(activityIndicators[0])],
  ['Configuración push',notificationIndicator(activityIndicators[1])],
  ['Notificaciones del sistema',notificationIndicator(momentIndicators[1])],
  ['Recordatorios de gestos',notificationIndicator(moments.querySelector('.badge'))]
 ];
 const doc=area.ownerDocument,overview=doc.createElement('section');
 overview.className='v5-notification-overview';
 overview.setAttribute('aria-label','Estado de notificaciones informado por el dispositivo');
 const title=doc.createElement('h4');title.textContent='Estado de este teléfono';
 const list=doc.createElement('dl');list.className='v5-notification-readings';
 for(const [label,value] of readings){
  const row=doc.createElement('div'),dt=doc.createElement('dt'),dd=doc.createElement('dd');
  dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.append(row);
 }
 const caution=doc.createElement('p');
 caution.textContent='Permiso concedido y push configurado no confirman entrega. Comprueba la recepción en la bandeja de Android; aquí no hay un acuse de entrega verificado.';
 overview.append(title,list,caution);
 area.insertBefore(overview,area.firstChild);
 const haptics=moments.querySelector('[data-action="bond-haptics"]');
 if(haptics){
  const zone=doc.createElement('section');zone.className='v5-haptics-zone';
  const heading=doc.createElement('h4');heading.textContent='Respuesta háptica';
  const help=doc.createElement('p');help.textContent='La vibración es independiente de las notificaciones. Se conserva el control original de este dispositivo.';
  zone.append(heading,help,haptics);area.append(zone);
 }
 const test=moments.querySelector('[data-action="moment-notification-test"]');
 if(test){
  const help=doc.createElement('p');help.className='v5-notification-test-help';
  help.textContent='Probar ahora solicita una notificación local; confirma visualmente si aparece en Android. No verifica la entrega push remota.';
  test.parentNode?.append(help);
 }
 return true;
}


// P7E: distinguish read-only export from potentially mutating import while
// retaining the original server validation and native file-picker handlers.
function enhanceBackups(hub){
 const area=hub?.querySelector?.('[data-group="backups"] .v5-more-group-content');
 if(!area||area.querySelector('.v5-backup-zones'))return false;
 const exportButton=area.querySelector('[data-action="backup-export"]');
 const importButton=area.querySelector('[data-action="backup-import"]');
 if(!exportButton||!importButton||exportButton.parentNode!==importButton.parentNode)return false;
 const row=exportButton.parentNode;
 if(row.children.length!==2||!row.parentNode)return false;
 const doc=area.ownerDocument,zones=doc.createElement('div');
 zones.className='v5-backup-zones';
 const add=(kind,title,description,button)=>{
  const zone=doc.createElement('section'),heading=doc.createElement('h4'),note=doc.createElement('p');
  zone.className='v5-backup-zone v5-backup-'+kind;
  heading.textContent=title;note.textContent=description;
  zone.append(heading,note,button);zones.append(zone);
 };
 add('export','Crear una copia','Exporta un JSON con información privada. El archivo puede incluir datos personales; guárdalo en un lugar seguro. Fotos, audios y música se conservan por referencia, no como archivos multimedia.',exportButton);
 add('restore','Restaurar una copia','La restauración añade datos según las reglas actuales del servidor. Aún no existe una vista previa del impacto del archivo: usa solo copias de confianza. Se conserva la confirmación original antes de importar.',importButton);
 row.parentNode.insertBefore(zones,row);
 row.remove();
 return true;
}


/* P7E: the authenticated device list and native permission labels remain the
   only sources of truth. Keep all original action buttons and confirmations. */
function permissionReadings(value){
 const parts=String(value||'').split(' · ');
 if(parts.length!==3)return [];
 const names=['Ubicación','Segundo plano','Notificaciones'];
 const rows=parts.map((part,index)=>{
  const colon=part.indexOf(':');
  if(colon<0||part.slice(0,colon).trim()!==names[index])return null;
  const state=part.slice(colon+1).trim();
  return state?[names[index],state]:null;
 });
 return rows.every(Boolean)?rows:[];
}
function enhanceDevices(hub){
 const area=hub?.querySelector?.('[data-group="profiles"] .v5-more-group-content');
 if(!area)return false;
 let changed=false;
 const card=[...area.querySelectorAll('.card')].find(node=>node.querySelector('[data-action="pair-code-self"]'));
 if(card&&!card.querySelector('.v5-device-safety')){
  const doc=card.ownerDocument;
  for(const button of card.querySelectorAll('[data-action="device-revoke"]')){
   const row=button.closest('.row.between');
   if(row)row.classList.add('v5-device-row');
  }
  const current=card.querySelector('.badge.good');
  const currentRow=current?.closest('.row.between');
  if(currentRow)currentRow.classList.add('v5-device-row','v5-device-current');
  const partner=card.querySelector('[data-action="pair-code-partner"]');
  const self=card.querySelector('[data-action="pair-code-self"]');
  const controls=self?.parentNode;
  if(controls){
   const options=doc.createElement('div');options.className='v5-device-code-options';
   const addOption=(button,title,help)=>{
    if(!button)return;
    const section=doc.createElement('section');section.className='v5-device-code-option';
    const heading=doc.createElement('h4');heading.textContent=title;
    const info=doc.createElement('p');info.textContent=help;
    section.append(heading,info,button);options.append(section);
   };
   addOption(partner,'Vincular teléfono de mi pareja','Genera un código para el perfil de la pareja. No cambia el perfil de este teléfono.');
   addOption(self,'Vincular otro teléfono mío','Genera un código para mi perfil actual. No cambia el perfil de este teléfono.');
   controls.parentNode.insertBefore(options,controls);
   const repair=card.querySelector('[data-action="profile-repair"]');
   if(repair){
    const existingHelp=repair.nextElementSibling?.matches('p')?repair.nextElementSibling:null;
    const advanced=doc.createElement('details');advanced.className='v5-device-recovery';
    const summary=doc.createElement('summary');summary.textContent='Corrección de perfil · acción avanzada';
    const warning=doc.createElement('p');warning.textContent='Solo si este teléfono quedó vinculado al perfil equivocado. Cambiar el perfil puede alterar qué información privada muestra este dispositivo; verifica a quién pertenece antes de continuar.';
    advanced.append(summary,warning);
    if(existingHelp)advanced.append(existingHelp);
    advanced.append(repair);
    controls.parentNode.insertBefore(advanced,controls);
   }
   if(!controls.children.length)controls.remove();
  }
  const safety=doc.createElement('p');safety.className='v5-device-safety';
  safety.textContent='La lista refleja dispositivos asociados a la sesión actual. Revocar impide volver a entrar desde ese teléfono hasta vincularlo de nuevo; se conserva la confirmación original.';
  card.append(safety);
  changed=true;
 }
 const permissions=[...area.querySelectorAll('.card')].find(node=>node.querySelector('h3')?.textContent?.trim()==='Permisos de Android');
 if(permissions&&!permissions.querySelector('.v5-permission-list')){
  const paragraph=permissions.querySelector('p'),readings=permissionReadings(paragraph?.textContent);
  if(readings.length===3){
   const doc=permissions.ownerDocument,list=doc.createElement('dl');list.className='v5-permission-list';
   for(const [name,value] of readings){
    const row=doc.createElement('div'),dt=doc.createElement('dt'),dd=doc.createElement('dd');
    dt.textContent=name;dd.textContent=value;row.append(dt,dd);list.append(row);
   }
   paragraph.replaceWith(list);
   const help=doc.createElement('p');help.className='v5-permission-help';
   help.textContent='Estos estados provienen de Android. Abrir ajustes no concede permisos automáticamente; revisa cada permiso en el sistema.';
   permissions.append(help);changed=true;
  }
 }
 return changed;
}
function enhanceWidgets(hub){
 const area=hub?.querySelector?.('[data-group="widgets"] .v5-more-group-content');
 if(!area||area.querySelector('.v5-widget-zones'))return false;
 const add=area.querySelector('[data-action="widget-add"]');
 const photo=area.querySelector('[data-action="widget-photo"]');
 const clear=area.querySelector('[data-action="widget-photo-clear"]');
 if(!add||!photo||!clear||add.parentNode!==photo.parentNode||photo.parentNode!==clear.parentNode)return false;
 const row=add.parentNode;
 if(row.children.length!==3||!row.parentNode)return false;
 const card=add.closest('.card');
 if(!card)return false;
 const doc=card.ownerDocument,zones=doc.createElement('div');zones.className='v5-widget-zones';
 const addZone=(title,help,buttons)=>{
  const section=doc.createElement('section');section.className='v5-widget-zone';
  const heading=doc.createElement('h4');heading.textContent=title;
  const note=doc.createElement('p');note.textContent=help;
  section.append(heading,note,...buttons);zones.append(section);
 };
 addZone('Añadir a Android','Android gestiona la creación y disponibilidad del widget; aquí no se simula una vista previa.',[add]);
 addZone('Imagen del widget','Elegir o quitar la imagen afecta a la configuración del widget, no elimina la foto original.',[photo,clear]);
 row.parentNode.insertBefore(zones,row);row.remove();
 const heading=card.querySelector('h3');
 if(heading&&heading.textContent.includes('Widget'))heading.textContent='Widget Nuestra Galaxia';
 return true;
}


/* P7F: local read-only manifest preview; backend alone validates the payload. */
function backupManifestPreview(backup){
 const invalid=reason=>({ok:false,reason});
 if(!backup||typeof backup!=='object'||Array.isArray(backup)||backup.format!=='nuestra-galaxia-backup'||Number(backup.version)!==5)
  return invalid('El archivo no es una copia v5 compatible.');
 const manifest=backup.manifest,counts=manifest?.counts;
 if(!/^[0-9a-f-]{36}$/i.test(String(backup.backupId||''))||manifest?.schemaVersion!=='20261005011401')
  return invalid('Identificador o esquema inválido.');
 const required=['settings','items','places','bond','chatMessages','locationHistory','tripHistory'];
 if(!counts||typeof counts!=='object'||Array.isArray(counts)||!required.every(k=>Object.hasOwn(counts,k)))
  return invalid('Faltan conteos en el manifiesto.');
 const values=Object.values(counts);
 if(!values.length||!values.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=100000))
  return invalid('Conteos inválidos en el manifiesto.');
 const mediaCount=manifest?.media?.count,pointer=manifest?.payload;
 if(!Number.isSafeInteger(mediaCount)||mediaCount<0||mediaCount>10000
    ||pointer?.bucket!=='galaxy-backups'||typeof pointer.path!=='string'
    ||!pointer.path.endsWith('/'+backup.backupId+'.json')
    ||!Number.isSafeInteger(pointer.sizeBytes)||pointer.sizeBytes<1||pointer.sizeBytes>60*1024*1024
    ||!/^[0-9a-f]{64}$/i.test(String(pointer.sha256||'')))
  return invalid('Referencia de integridad inválida.');
 return {ok:true,message:
  'VISTA PREVIA DEL MANIFIESTO (cantidades declaradas)\n\n'
  +'Registros: '+values.reduce((sum,n)=>sum+n,0)+'\n'
  +'Contenidos: '+counts.items+'\nLugares: '+counts.places
  +'\nMomentos: '+counts.bond+'\nMensajes: '+counts.chatMessages
  +'\nMultimedia referenciada: '+mediaCount+'\n\n'
  +'No es una comparación con los datos actuales ni una garantía de restauración. '
  +'El teléfono NO verifica el contenido ni su hash: el servidor debe comprobar integridad SHA-256, '
  +'permisos, archivos y compatibilidad antes de aplicar cambios. '
  +'Puede haber conflictos; restaurar no se limita necesariamente a añadir registros.\n\n'
  +'¿Enviar esta copia para verificación y posible restauración?'};
}


/* P7G: use authenticated device metadata for a contextual, fail-closed
   confirmation. Never trust a name or profile supplied by the clicked button. */
function deviceRevokePreview(devices,currentId,targetId,labels=[]){
 const invalid={ok:false,message:'Actualiza la lista de dispositivos antes de revocar.'};
 if(!Array.isArray(devices)||!targetId||String(targetId)===String(currentId))return invalid;
 const target=devices.find(d=>d&&String(d.id)===String(targetId));
 if(!target||target.revoked_at)return invalid;
 const clean=value=>String(value||'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,64);
 const name=clean(target.name)||'Android';
 const profile=clean(labels[Number(target.person)]||('Perfil '+String(target.person)));
 return {ok:true,message:'¿Revocar el dispositivo «'+name+'» del perfil '+profile+'?\n\n'
  +'Este teléfono perderá acceso a Nuestra Galaxia y dejará de recibir avisos vinculados. '
  +'Para volver a entrar tendrá que vincularse otra vez.\n\n'
  +'Esta acción no desvincula el teléfono actual. ¿Confirmar revocación?'};
}
function pairCodeValidity(minutes){
 return Number.isSafeInteger(minutes)&&minutes>0&&minutes<=60
  ?'Vigencia informada por el servidor: '+minutes+' minutos desde la creación. Uso único.'
  :'El servidor no informó una vigencia verificable. Si el código vence, genera otro.';
}


/* P7J - in-memory navigation state. Never persist settings, session keys or
 * location in the navigation layer. All buttons only open existing DOM.
 */
let expandedGroups=new Set(['privacy']);
/* P7K: preserve keyboard focus only for the four existing identity fields.
 * Never capture field values, passwords, tokens, GPS, or destructive controls.
 */
const SETTINGS_FOCUS_FIELDS=new Set(['name0','name1','startDate','albumUrl']);
function captureSettingsFocus(container){
 const field=container?.ownerDocument?.activeElement;
 if(!field||!SETTINGS_FOCUS_FIELDS.has(field.name))return null;
 const form=field.closest?.('#settingsForm');
 if(!form||container?.contains?.(form)===false)return null;
 let start=null,end=null;
 try{
  if(Number.isInteger(field.selectionStart)&&Number.isInteger(field.selectionEnd)){
   start=field.selectionStart;end=field.selectionEnd;
  }
 }catch{} // Android date inputs may reject selectionStart.
 return {name:field.name,start,end};
}
function restoreSettingsFocus(container,snapshot){
 if(!snapshot||!SETTINGS_FOCUS_FIELDS.has(snapshot.name))return false;
 const form=container?.querySelector?.('#settingsForm');
 const field=form?.elements?.namedItem?.(snapshot.name);
 if(!field||field.disabled||field.isConnected===false)return false;
 const group=field.closest?.('details.v5-more-group');
 if(group&&!group.open)return false; // Never open a closed privacy/sensitive section.
 if(typeof field.focus!=='function')return false;
 field.focus({preventScroll:true});
 if(Number.isInteger(snapshot.start)&&Number.isInteger(snapshot.end)&&typeof field.setSelectionRange==='function'){
  try{field.setSelectionRange(snapshot.start,snapshot.end);}catch{}
 }
 return true;
}
function rememberGroupToggle(details,id){
 if(!details?.isConnected||!groups.some(group=>group[0]===id))return false;
 if(details.open)expandedGroups.add(id);else expandedGroups.delete(id);
 return true;
}

function navigationGroups(){
 return groups.map(([id,title])=>({id,title}));
}
function captureNavigation(container){
 const hub=container?.querySelector?.('.v5-more-hub');
 if(!hub)return false;
 const open=[...hub.querySelectorAll('details.v5-more-group')].filter(el=>el.open).map(el=>el.dataset.group);
 expandedGroups=new Set(open);
 return true;
}
function revealGroup(container,id,focus=false){
 if(!groups.some(g=>g[0]===id))return false;
 const details=container?.querySelector?.('.v5-more-group[data-group="'+id+'"]');
 if(!details)return false;
 details.open=true;
 expandedGroups.add(id);
 if(focus){
  const summary=details.querySelector('summary');
  summary?.focus?.({preventScroll:true});
  summary?.scrollIntoView?.({behavior:'auto',block:'nearest'});
 }
 return true;
}
function resetNavigation(){
 expandedGroups=new Set(['privacy']);
}

function organize(container){
 const section=container?.querySelector?.('section');
 if(!section||section.querySelector('.v5-more-hub'))return false;
 const blocks=[...section.children].filter(el=>!el.classList.contains('section-head'));
 if(!blocks.length)return false;
 const doc=section.ownerDocument,hub=doc.createElement('div');
 hub.className='v5-more-hub';
 const heading=doc.createElement('div');heading.className='v5-more-intro';
 const label=doc.createElement('h3');label.textContent='Centro de configuración';
 const hint=doc.createElement('p');hint.textContent='Explora cada área sin perder las opciones y confirmaciones de seguridad.';
 heading.append(label,hint);hub.append(heading);
 const slots=new Map();
 for(const [id,title] of groups){
  const details=doc.createElement('details');details.className='v5-more-group';details.dataset.group=id;
  const summary=doc.createElement('summary');summary.textContent=title;
  const body=doc.createElement('div');body.className='v5-more-group-content';
  details.append(summary,body);hub.append(details);slots.set(id,{details,body});
 }
 for(const el of blocks){
  const meta={id:el.id,classes:[...el.classList],
   actions:[...el.querySelectorAll('[data-action]')].map(x=>x.dataset.action),
   forms:[...el.querySelectorAll('form[id]')].map(x=>x.id),
   notificationHealth:!!el.querySelector('.notification-health'),
   heading:el.querySelector('h3')?.textContent?.trim()};
  slots.get(classify(meta)).body.append(el);
 }
 for(const [id,slot] of slots){
  if(!slot.body.childNodes.length)slot.details.remove();
  else{
   slot.details.open=expandedGroups.has(id);
   slot.details.addEventListener('toggle',()=>rememberGroupToggle(slot.details,id));
  }
 }
 section.append(hub);
 const quick=doc.createElement('nav');quick.className='v5-more-quick';
 quick.setAttribute('aria-label','Acceso rápido a los ajustes');
 const caption=doc.createElement('p');caption.className='v5-more-quick-caption';
 caption.textContent='Ir a un ajuste';quick.append(caption);
 const shortcuts=doc.createElement('div');shortcuts.className='v5-more-quick-grid';
 for(const [id,title] of groups){
  const entry=slots.get(id)?.details;
  if(!entry?.isConnected)continue;
  entry.id='v5-more-'+id;
  const button=doc.createElement('button');button.type='button';button.className='v5-more-quick-link';
  button.textContent=title;button.setAttribute('aria-controls',entry.id);
  button.addEventListener('click',()=>revealGroup(hub,id,true));
  shortcuts.append(button);
 }
 quick.append(shortcuts);
 hub.insertBefore(quick,heading.nextSibling);
 enhancePrivacy(hub);
 enhanceAppearance(hub);
 enhanceNotifications(hub);
 enhanceBackups(hub);
 enhanceDevices(hub);
 enhanceWidgets(hub);
 enhanceIdentity(hub);
 return true;
}

/* P7I: local draft validation only; the authenticated server remains
 * authoritative for version conflicts, permissions and stored settings.
 * No draft is persisted or sent before an explicit successful submission.
 */
function settingsDraft(original={},draft={}){
 const trim=value=>String(value??'').trim();
 const values=value=>Array.isArray(value)?value:[];
 const originalNames=values(original.names),draftNames=values(draft.names);
 const previous={names:[trim(originalNames[0]),trim(originalNames[1])],
  startDate:trim(original.startDate),albumUrl:trim(original.albumUrl)};
 const data={names:[trim(draftNames[0]),trim(draftNames[1])],
  startDate:trim(draft.startDate),albumUrl:trim(draft.albumUrl)};
 const changed=data.names.some((s,i)=>s!==previous.names[i])||
  data.startDate!==previous.startDate||data.albumUrl!==previous.albumUrl;
 let reason='';
 if(data.names.some(name=>!name||name.length>80))reason='Escribe los dos nombres (máximo 80 caracteres cada uno).';
 if(!reason&&data.startDate){
  const raw=data.startDate,valid=/^\d{4}-\d{2}-\d{2}$/.test(raw),year=Number(raw.slice(0,4)),
   month=Number(raw.slice(5,7)),day=Number(raw.slice(8,10));
  if(!valid||year<1900||year>2199||month<1||month>12||day<1||day>31||
     new Date(Date.UTC(year,month-1,day)).toISOString().slice(0,10)!==raw)
   reason='La fecha de inicio no es válida.';
 }
 if(!reason&&data.albumUrl){
  if(data.albumUrl.length>2048||!/^https:\/\/[^/?#@\s]+(?:[/?#][^\s]*)?$/i.test(data.albumUrl))
   reason='El enlace del álbum debe ser una URL HTTPS válida.';
 }
 return {data,changed,valid:!reason,reason};
}
function enhanceIdentity(hub){
 const area=hub?.querySelector?.('[data-group="profiles"] .v5-more-group-content');
 const form=area?.querySelector?.('#settingsForm');
 if(!form||form.querySelector('[data-settings-status]'))return false;
 const labels=[['name0','Primera persona'],['name1','Segunda persona'],['startDate','Fecha en que comenzó nuestra historia'],['albumUrl','Enlace privado del álbum (opcional)']];
 for(const [field,title] of labels){
  const input=form.querySelector('[name="'+field+'"]');
  const label=input?.closest?.('.field')?.querySelector?.('label');
  if(label)label.textContent=title;
 }
 const doc=form.ownerDocument,help=doc.createElement('p');
 help.className='v5-settings-helper';
 help.textContent='Los nombres y fechas que guardes formarán parte de su espacio compartido. Los cambios se envían solo cuando presionas Guardar.';
 form.insertBefore(help,form.firstChild);
 const status=doc.createElement('p');status.className='v5-settings-status';
 status.dataset.settingsStatus='true';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 status.textContent='Sin cambios pendientes.';
 const button=form.querySelector('button[type="submit"]');
 if(button){button.dataset.role='settings-save';button.disabled=true;}
 form.append(status);
 return true;
}

root.GalaxyMoreV5=Object.freeze({classify,organize,navigationGroups,captureNavigation,revealGroup,resetNavigation,captureSettingsFocus,restoreSettingsFocus,rememberGroupToggle,enhancePrivacy,privacyAudience,themePalette,nextAutoChange,enhanceAppearance,notificationIndicator,enhanceNotifications,enhanceBackups,permissionReadings,enhanceDevices,enhanceWidgets,backupManifestPreview,deviceRevokePreview,pairCodeValidity,settingsDraft,enhanceIdentity});
})(window);
