/* V5-P4 Connected Journeys: presentation only. No networking or GPS writes. */
(function(root){
 const FRESH_MS=10*60*1000;
 function freshness(location,now=Date.now(),freshMs=FRESH_MS){
  if(!location)return {kind:'missing',label:'Sin señal disponible',detail:'Aún no hay lectura compartida'};
  if(location.sharing!==true)return {kind:'paused',label:'Ubicación pausada',detail:'No se comparte ubicación'};
  const updated=Date.parse(location?.updated_at||'');
  const lat=Number(location?.latitude),lon=Number(location?.longitude);
  if(!Number.isFinite(updated)||location?.latitude==null||location?.longitude==null
   ||!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
   return {kind:'missing',label:'Sin señal disponible',detail:'No hay una lectura válida'};
  if(updated>now+60000)return {kind:'missing',label:'Hora del dispositivo por verificar',detail:'Lectura con fecha futura'};
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
 function sessionProgress(raw){
  if(raw==null||raw==='')return null;
  const n=Number(raw);
  return Number.isFinite(n)?Math.round(Math.max(0,Math.min(100,n))):null;
 }
 function alertPreference(enabled){
  return enabled===true?'Configurado':'No configurado';
 }
 function cooldownCopy(minutes){
  const n=Number(minutes);
  if(!Number.isFinite(n)||n<=0)return 'Intervalo sin definir';
  const m=Math.round(n);
  return 'Intervalo mínimo de '+(m>=60&&m%60===0?
   (m/60)+' '+(m===60?'hora':'horas'):
   m+' '+(m===1?'minuto':'minutos'));
 }
 function timeline(trips,events,encounters){
  const result=[];
  const append=(kind,items,dateField)=>{
   for(const item of Array.isArray(items)?items:[]){
    if(!item||typeof item!=='object')continue;
    const time=Date.parse(item[dateField]||'');
    result.push({kind,item,occurredAt:Number.isFinite(time)?time:null});
   }
  };
  append('trip',trips,'started_at');
  append('event',events,'happened_at');
  append('encounter',encounters,'started_at');
  return result.sort((a,b)=>(b.occurredAt??-Infinity)-(a.occurredAt??-Infinity));
 }

 // Only connect consecutive, dated route samples from the SAME person and
 // continuous time window. The prior renderer linked unrelated GPS journeys.
 // Uses privacy-filtered map-state rows; no GPS reads, storage or networking.
 function trailSegments(rows,{now=Date.now(),breakMs=20*60*1000}={}){
  const groups=new Map(),gap=Math.max(60000,Number(breakMs)||20*60*1000);
  for(const p of Array.isArray(rows)?rows:[]){
   if(!p||!['0','1'].includes(String(p.person))||
    p.latitude==null||p.longitude==null||p.created_at==null||
    (typeof p.latitude==='string'&&!p.latitude.trim())||
    (typeof p.longitude==='string'&&!p.longitude.trim()))continue;
   const lat=Number(p.latitude),lon=Number(p.longitude),time=Date.parse(p.created_at);
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||
    !Number.isFinite(time)||time>now+60000)continue;
   const key=String(p.person);
   if(!groups.has(key))groups.set(key,[]);
   groups.get(key).push({time,latitude:lat,longitude:lon});
  }
  const result=[];
  for(const [person,items] of groups){
   items.sort((a,b)=>a.time-b.time);
   let part=[];
   const finish=()=>{
    if(part.length>=2)result.push({
     person,startedAt:part[0].time,endedAt:part[part.length-1].time,
     points:part.map(p=>[p.latitude,p.longitude])
    });
    part=[];
   };
   for(const sample of items){
    if(part.length&&sample.time-part[part.length-1].time>gap)finish();
    part.push(sample);
   }
   finish();
  }
  return result;
 }
 const api={FRESH_MS,freshness,renderPresence,sessionProgress,alertPreference,cooldownCopy,timeline,trailSegments};

 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyJourneysV5=api;
})(typeof globalThis!=='undefined'?globalThis:this);
