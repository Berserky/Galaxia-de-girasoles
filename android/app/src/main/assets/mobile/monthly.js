(function(root){
 const validMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||''));
 function shiftMonth(month,delta){
  if(!validMonth(month))return'';
  const [y,m]=month.split('-').map(Number),d=new Date(Date.UTC(y,m-1+Number(delta||0),1));
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
 }
 function monthLabel(month){
  if(!validMonth(month))return'';
  const [y,m]=month.split('-').map(Number);
  const label=new Intl.DateTimeFormat('es-CO',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,15)));
  return label.charAt(0).toUpperCase()+label.slice(1);
 }
 function canGoNext(month,currentMonth){
  return validMonth(month)&&validMonth(currentMonth)&&month<currentMonth;
 }
 function summaryHasActivity(summary){
  if(!summary)return false;
  const c=summary.counts||{};
  return Number(c.memories||0)+Number(c.plansDone||0)+Number(c.events||0)+Number(c.saved||0)+Number(summary.trips?.count||0)+Number(summary.encounters?.count||0)+Number(summary.bond?.gestures||0)+Number(summary.bond?.voices||0)>0;
 }
 const api={validMonth,shiftMonth,monthLabel,canGoNext,summaryHasActivity};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyMonthly=api;
})(typeof globalThis!=='undefined'?globalThis:this);
