/* V5-P4 Connected Journeys: presentation only. No networking or GPS writes. */
(function(root){
 const FRESH_MS=10*60*1000;
 function freshness(location,now=Date.now(),freshMs=FRESH_MS){
  if(location?.sharing!==true)return {kind:'paused',label:'Ubicación pausada',detail:'No se comparte ubicación'};
  const updated=Date.parse(location?.updated_at||'');
  const lat=Number(location?.latitude),lon=Number(location?.longitude);
  if(!Number.isFinite(updated)||location?.latitude==null||location?.longitude==null
   ||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
   return {kind:'missing',label:'Sin señal disponible',detail:'No hay una lectura válida'};
  const age=Math.max(0,now-updated);
  const min=Math.floor(age/60000),time=min<1?'menos de 1 min':
   min<60?min+' min':Math.floor(min/60)+' h'+(min%60?' '+min%60+' min':'');
  if(age>freshMs)return {kind:'stale',label:'Última señal histórica',detail:'Hace '+time};
  return {kind:'fresh',label:'Ubicación reciente',detail:'Actualizada hace '+time};
 }
 function renderPresence(rows,ownPerson,names,{esc,ico,now=Date.now()}){
  const list=Array.isArray(rows)?rows:[];
  return '<div class="journey-freshness" role="group" aria-label="Antigüedad de ubicaciones">'+
   [String(ownPerson)==='1'?'1':'0',String(ownPerson)==='1'?'0':'1'].map((person,index)=>{
    const location=list.find(row=>String(row?.person)===person);
    const state=freshness(location,now);
    const name=names?.[Number(person)]||('Persona '+(Number(person)+1));
    const icon=state.kind==='fresh'?'locate-fixed':state.kind==='stale'?'clock':
     state.kind==='paused'?'map-pin-off':'circle-help';
    return '<div class="journey-presence '+state.kind+'">'+
     '<span class="journey-presence-icon">'+ico(icon)+'</span>'+
     '<span class="journey-presence-copy"><b>'+esc(index===0?'Tu ubicación':name)+'</b>'+
     '<small>'+esc(state.label)+' · '+esc(state.detail)+'</small></span></div>';
   }).join('')+'</div>';
 }
 const api={FRESH_MS,freshness,renderPresence};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyJourneysV5=api;
})(typeof globalThis!=='undefined'?globalThis:this);
