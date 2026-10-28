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
 enhanceAppearance(hub);
 return true;
}
root.GalaxyMoreV5=Object.freeze({classify,organize,enhancePrivacy,privacyAudience,themePalette,nextAutoChange,enhanceAppearance});
})(window);
