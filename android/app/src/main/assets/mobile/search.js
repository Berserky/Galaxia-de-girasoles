(function(root){
 const KIND_LABELS={
  memory:'Recuerdo',plan:'Plan',note:'Nota',song:'Canción',capsule:'Cápsula',
  wish:'Deseo',journey:'Viaje',event:'Fecha'
 };
 const normalizeSearch=value=>String(value??'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/\s+/g,' ').trim();
 const tokensOf=query=>normalizeSearch(query).split(' ').filter(Boolean);
 function scoreRow(title,fields,query,tokens){
  const titleText=normalizeSearch(title),fieldText=normalizeSearch(fields.filter(Boolean).join(' '));
  const all=(titleText+' '+fieldText).trim();
  if(!tokens.length||!tokens.every(token=>all.includes(token)))return -1;
  let score=0;
  if(titleText===query)score+=240;
  else if(titleText.startsWith(query))score+=150;
  else if(titleText.includes(query))score+=100;
  for(const token of tokens){
   if(titleText===token)score+=60;
   else if(titleText.startsWith(token))score+=35;
   else if(titleText.includes(token))score+=22;
   if(fieldText.includes(token))score+=8;
  }
  return score;
 }
 function searchUniverse(data,query,limit=40){
  const q=normalizeSearch(query),tokens=tokensOf(query);
  if(!q||!tokens.length)return[];
  const rows=[];
  for(const item of data?.items||[]){
   const d=item?.data||{},label=KIND_LABELS[item?.kind]||String(item?.kind||'Contenido');
   const title=String(d.title||label);
   const fields=[d.body,d.category,d.placeName,d.date,d.url,d.platform,label];
   const score=scoreRow(title,fields,q,tokens);
   if(score<0)continue;
   rows.push({
    type:'item',id:String(item.id),kind:String(item.kind||''),title,
    subtitle:[label,d.placeName||d.category||'',d.date||''].filter(Boolean).join(' · '),
    score,sortDate:String(d.date||item.created||'')
   });
  }
  for(const place of data?.places||[]){
   const title=String(place?.name||'Lugar guardado');
   const kind=String(place?.kind||'place');
   const fields=[place?.note,kind,'lugar','mapa'];
   const score=scoreRow(title,fields,q,tokens);
   if(score<0)continue;
   rows.push({
    type:'place',id:String(place.id),kind,title,
    subtitle:['Lugar',place?.note||kind].filter(Boolean).join(' · '),
    latitude:Number(place?.latitude),longitude:Number(place?.longitude),
    score:score+5,sortDate:String(place?.updated_at||place?.created_at||'')
   });
  }
  return rows.sort((a,b)=>b.score-a.score||b.sortDate.localeCompare(a.sortDate)||a.title.localeCompare(b.title,'es')).slice(0,Math.max(1,Number(limit)||40));
 }
 const api={normalizeSearch,searchUniverse,KIND_LABELS};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxySearch=api;
})(typeof globalThis!=='undefined'?globalThis:this);
