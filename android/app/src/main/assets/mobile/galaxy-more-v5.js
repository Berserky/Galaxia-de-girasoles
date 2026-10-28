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
 if(has('moment-notifications')||has('galaxy-notifications-enable'))return 'notifications';
 if(has('backup-export')||has('backup-import'))return 'backups';
 if(has('widget-add')||has('widget-photo'))return 'widgets';
 if(forms.includes('settingsForm')||has('pair-code-self')||has('pair-code-partner')||has('device-revoke')||has('welcome-replay'))return 'profiles';
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
   forms:[...el.querySelectorAll('form[id]')].map(x=>x.id)};
  slots.get(classify(meta)).body.append(el);
 }
 for(const [id,slot] of slots){
  if(!slot.body.childNodes.length)slot.details.remove();
  else if(id==='privacy')slot.details.open=true;
 }
 section.append(hub);
 enhancePrivacy(hub);
 return true;
}
root.GalaxyMoreV5=Object.freeze({classify,organize,enhancePrivacy,privacyAudience});
})(window);
