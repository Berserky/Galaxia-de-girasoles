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
 return true;
}
root.GalaxyMoreV5=Object.freeze({classify,organize});
})(window);
