(function(root){
 const validDay=value=>/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(String(value||''));
 const sameMonthDay=(value,today)=>validDay(value)&&validDay(today)&&value<today&&value.slice(5)===today.slice(5);
 function yearsAgo(year,today){
  const current=Number(String(today||'').slice(0,4)),past=Number(year);
  return Number.isInteger(current)&&Number.isInteger(past)&&past<current?current-past:0;
 }
 function anniversaryLabel(year,today){
  const n=yearsAgo(year,today);
  if(!n)return String(year||'');
  return 'Hace '+n+' '+(n===1?'año':'años');
 }
 function dayLabel(day){
  if(!validDay(day))return'';
  const [y,m,d]=day.split('-').map(Number);
  const label=new Intl.DateTimeFormat('es-CO',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));
  return label.charAt(0).toUpperCase()+label.slice(1);
 }
 function groupHasActivity(group){
  if(!group)return false;
  const s=group.stats||{};
  return (group.items||[]).length+Number(s.trips||0)+Number(s.encounters||0)+Number(s.gestures||0)+Number(s.voices||0)+Number(s.arrivals||0)>0;
 }
 const api={validDay,sameMonthDay,yearsAgo,anniversaryLabel,dayLabel,groupHasActivity};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyTodayHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this);
