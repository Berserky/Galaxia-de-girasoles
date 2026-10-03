(function(root){
 const RAD=Math.PI/180;
 function metersBetween(a,b){
  const lat1=Number(a?.latitude),lon1=Number(a?.longitude),lat2=Number(b?.latitude),lon2=Number(b?.longitude);
  if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return null;
  const R=6371000,dLat=(lat2-lat1)*RAD,dLon=(lon2-lon1)*RAD;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1*RAD)*Math.cos(lat2*RAD)*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
 }
 function formatDistance(meters){
  const m=Number(meters);
  if(!Number.isFinite(m)||m<0)return'—';
  if(m<1000)return Math.round(m)+' m';
  const km=m/1000;
  return km<10?km.toFixed(1)+' km':Math.round(km)+' km';
 }
 function distanceMood(meters){
  const m=Number(meters);
  if(!Number.isFinite(m))return {key:'unknown',title:'Sin distancia',copy:'Necesitamos las dos ubicaciones compartidas.'};
  if(m<=80)return {key:'together',title:'Juntitos',copy:'Están lo bastante cerca para contar como encuentro.'};
  if(m<=300)return {key:'very-close',title:'Muy cerca',copy:'Están a unos pasos de volver a encontrarse.'};
  if(m<=1000)return {key:'close',title:'Cerquita',copy:'La distancia entre ustedes es pequeña.'};
  return {key:'apart',title:'A '+formatDistance(m),copy:'La galaxia sigue marcando el camino entre los dos.'};
 }
 function ageMs(location,now=Date.now()){
  const t=Date.parse(location?.updated_at||'');
  return Number.isFinite(t)?Math.max(0,now-t):Infinity;
 }
 function coupleDistance(locations,now=Date.now(),freshMs=10*60*1000){
  const rows=Array.isArray(locations)?locations:[];
  const a=rows.find(x=>String(x?.person)==='0'),b=rows.find(x=>String(x?.person)==='1');
  if(!a||!b||!a.sharing||!b.sharing)return {available:false,reason:'paused'};
  if(ageMs(a,now)>freshMs||ageMs(b,now)>freshMs)return {available:false,reason:'stale',ages:[ageMs(a,now),ageMs(b,now)]};
  const meters=metersBetween(a,b);
  if(meters===null)return {available:false,reason:'missing'};
  return {available:true,meters,mood:distanceMood(meters),updated_at:new Date(Math.min(Date.parse(a.updated_at),Date.parse(b.updated_at))).toISOString()};
 }
 const api={metersBetween,formatDistance,distanceMood,coupleDistance,ageMs};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyDistance=api;
})(typeof globalThis!=='undefined'?globalThis:this);
