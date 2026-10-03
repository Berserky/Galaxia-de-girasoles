(function(root){
 const DATASETS=['history','trips','tripPoints','placeEvents'];
 function validDeleteConfirmation(value){return String(value||'').trim().toUpperCase()==='BORRAR';}
 function exportFileName(day,personName){
  const safe=String(personName||'perfil').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'perfil';
  const date=/^\d{4}-\d{2}-\d{2}$/.test(String(day||''))?day:new Date().toISOString().slice(0,10);
  return 'nuestra-galaxia-gps-'+safe+'-'+date+'.json';
 }
 function emptyBundle(person,personName){
  return {format:'nuestra-galaxia-gps-history',version:1,exportedAt:new Date().toISOString(),person:String(person),personName:String(personName||''),history:[],trips:[],tripPoints:[],placeEvents:[]};
 }
 function appendPage(bundle,dataset,rows){
  if(!DATASETS.includes(dataset))throw new Error('Dataset GPS no válido.');
  const list=Array.isArray(rows)?rows:[];
  bundle[dataset].push(...list);return bundle;
 }
 function counts(bundle){
  return Object.fromEntries(DATASETS.map(key=>[key,Array.isArray(bundle?.[key])?bundle[key].length:0]));
 }
 function totalRows(bundle){return Object.values(counts(bundle)).reduce((a,b)=>a+b,0);}
 const api={DATASETS,validDeleteConfirmation,exportFileName,emptyBundle,appendPage,counts,totalRows};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyGpsHistory=api;
})(typeof globalThis!=='undefined'?globalThis:this);
