(function(root){
 const DISMISS_PREFIX='galaxy.frequent-place.dismissed.';
 function quantize(value,step=0.001){return Math.round(Number(value)/step)*step;}
 function suggestionKey(s){
  const lat=quantize(s?.latitude),lon=quantize(s?.longitude);
  return Number.isFinite(lat)&&Number.isFinite(lon)?lat.toFixed(3)+','+lon.toFixed(3):'';
 }
 function confidenceLabel(s){
  const days=Math.max(0,Number(s?.days||0)),minutes=Math.max(0,Number(s?.dwell_minutes||0));
  if(days>=6&&minutes>=180)return'Muy frecuente';
  if(days>=4&&minutes>=90)return'Frecuente';
  return'Lugar repetido';
 }
 function distanceMeters(a,b){
  return root.GalaxyDistance?.metersBetween(a,b)??null;
 }
 function isNearby(s,location,meters=220){
  if(!location?.sharing)return false;
  const d=distanceMeters(s,location);
  return Number.isFinite(d)&&d<=meters;
 }
 function dismiss(s,days=14,storage=root.localStorage){
  const key=suggestionKey(s);if(!key||!storage)return;
  storage.setItem(DISMISS_PREFIX+key,String(Date.now()+Math.max(1,days)*86400000));
 }
 function isDismissed(s,storage=root.localStorage,now=Date.now()){
  const key=suggestionKey(s);if(!key||!storage)return false;
  const until=Number(storage.getItem(DISMISS_PREFIX+key)||0);
  if(until>now)return true;
  if(until)storage.removeItem(DISMISS_PREFIX+key);
  return false;
 }
 function visibleSuggestions(list,storage=root.localStorage,now=Date.now()){
  return (Array.isArray(list)?list:[]).filter(s=>!isDismissed(s,storage,now));
 }
 const api={suggestionKey,confidenceLabel,isNearby,dismiss,isDismissed,visibleSuggestions,distanceMeters};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyFrequentPlaces=api;
})(typeof globalThis!=='undefined'?globalThis:this);
