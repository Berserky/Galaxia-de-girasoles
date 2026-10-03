(function(root){
 function durationLabel(seconds){
  const total=Math.max(0,Math.round(Number(seconds)||0));
  const days=Math.floor(total/86400),hours=Math.floor((total%86400)/3600),minutes=Math.floor((total%3600)/60);
  if(days)return days+' d '+hours+' h';
  if(hours)return hours+' h '+minutes+' min';
  return Math.max(1,minutes)+' min';
 }
 function countLabel(count){
  const n=Math.max(0,Number(count)||0);
  return n+' '+(n===1?'encuentro':'encuentros');
 }
 function activeElapsed(active,now=Date.now()){
  const started=Date.parse(active?.started_at||'');
  return Number.isFinite(started)?Math.max(0,Math.round((now-started)/1000)):0;
 }
 function totalWithActive(stats,now=Date.now()){
  const base=Math.max(0,Number(stats?.total_seconds||0));
  if(!stats?.active)return base;
  const fetched=Date.parse(stats.generated_at||'');
  return base+(Number.isFinite(fetched)?Math.max(0,Math.round((now-fetched)/1000)):0);
 }
 const api={durationLabel,countLabel,activeElapsed,totalWithActive};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyEncounters=api;
})(typeof globalThis!=='undefined'?globalThis:this);
