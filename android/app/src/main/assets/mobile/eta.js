(function(root){
 const SPEEDS={walking:4.8,motorcycle:28,transit:18,vehicle:24,auto:20};
 const FACTORS={walking:1.18,motorcycle:1.30,transit:1.38,vehicle:1.30,auto:1.32};
 const MODE_LABELS={walking:'caminando',motorcycle:'en moto',transit:'en transporte público',vehicle:'en vehículo',auto:'en movimiento'};
 function locationFresh(location,now=Date.now(),freshMs=10*60*1000){
  const t=Date.parse(location?.updated_at||'');
  return !!location?.sharing&&Number.isFinite(t)&&now-t<=freshMs&&Number.isFinite(Number(location?.latitude))&&Number.isFinite(Number(location?.longitude));
 }
 function movementMode(location){
  if(location?.motion==='walking')return'walking';
  if(location?.motion==='vehicle'){
   if(location?.transport_preference==='motorcycle')return'motorcycle';
   if(location?.transport_preference==='transit')return'transit';
   return'vehicle';
  }
  if(location?.transport_preference==='motorcycle')return'motorcycle';
  if(location?.transport_preference==='transit')return'transit';
  return'auto';
 }
 function speedEstimate(location,mode){
  const observed=Math.max(0,Number(location?.speed||0)*3.6),fallback=SPEEDS[mode]||SPEEDS.auto;
  const max=mode==='walking'?9:mode==='transit'?90:mode==='motorcycle'?130:160;
  const usable=observed>=2.5&&observed<=max;
  return {kmh:usable?observed:fallback,source:usable?'live':'typical',observed_kmh:observed};
 }
 function resolveDestination(data,person,now=Date.now()){
  const destinations=Array.isArray(data?.destinations)?data.destinations:[];
  const locations=Array.isArray(data?.locations)?data.locations:[];
  const places=Array.isArray(data?.places)?data.places:[];
  const destination=destinations.find(d=>String(d.person)===String(person)&&d.active!==false);
  if(!destination)return {available:false,reason:'none'};
  if(destination.kind==='person'){
   const target=locations.find(l=>String(l.person)===String(destination.target_person));
   if(!target?.sharing)return {available:false,reason:'target-paused',destination};
   if(!locationFresh(target,now))return {available:false,reason:'target-stale',destination,target};
   return {available:true,type:'person',destination,target,label:destination.label||'Mi persona',latitude:Number(target.latitude),longitude:Number(target.longitude)};
  }
  if(destination.kind==='place'){
   const place=places.find(p=>String(p.id)===String(destination.place_id));
   if(!place)return {available:false,reason:'place-missing',destination};
   return {available:true,type:'place',destination,target:place,label:destination.label||place.name||'Lugar',latitude:Number(place.latitude),longitude:Number(place.longitude)};
  }
  return {available:false,reason:'invalid',destination};
 }
 function eta(data,person,now=Date.now()){
  const locations=Array.isArray(data?.locations)?data.locations:[];
  const own=locations.find(l=>String(l.person)===String(person));
  if(!own?.sharing)return {available:false,reason:'own-paused'};
  if(!locationFresh(own,now))return {available:false,reason:'own-stale'};
  const resolved=resolveDestination(data,person,now);
  if(!resolved.available)return resolved;
  const meters=root.GalaxyDistance?.metersBetween(own,{latitude:resolved.latitude,longitude:resolved.longitude});
  if(!Number.isFinite(meters))return {available:false,reason:'distance'};
  const arrivedThreshold=resolved.type==='person'?80:60;
  const mode=movementMode(own),speed=speedEstimate(own,mode),routeMeters=meters*(FACTORS[mode]||FACTORS.auto);
  const seconds=meters<=arrivedThreshold?0:Math.max(60,Math.round(routeMeters/(speed.kmh/3.6)));
  return {
   available:true,...resolved,own,meters,route_meters:routeMeters,seconds,arrived:meters<=arrivedThreshold,
   mode,mode_label:MODE_LABELS[mode]||MODE_LABELS.auto,speed_kmh:speed.kmh,speed_source:speed.source,
   target_moving:resolved.type==='person'&&Math.max(0,Number(resolved.target?.speed||0)*3.6)>=3
  };
 }
 function etaLabel(seconds){
  const s=Math.max(0,Number(seconds)||0);
  if(s===0)return'Ya llegaste';
  const min=Math.max(1,Math.round(s/60));
  if(min<60)return'≈ '+min+' min';
  const h=Math.floor(min/60),rest=min%60;
  return '≈ '+h+' h'+(rest?' '+rest+' min':'');
 }
 const api={locationFresh,movementMode,speedEstimate,resolveDestination,eta,etaLabel,SPEEDS,FACTORS,MODE_LABELS};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyEta=api;
})(typeof globalThis!=='undefined'?globalThis:this);
