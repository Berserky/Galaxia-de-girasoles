(function(root){
 const THEMES=['auto','daylight','cosmic','halloween','christmas','valentine','friendship','easter'];
 const LABELS={auto:'Automático',daylight:'Luz suave',cosmic:'Universo oscuro',halloween:'Halloween',christmas:'Navidad',valentine:'San Valentín',friendship:'Amor y amistad',easter:'Pascua'};
 const COLORS={daylight:'#f7f6fa',cosmic:'#10101d',halloween:'#100913',christmas:'#071510',valentine:'#180810',friendship:'#120b22',easter:'#11162c'};
 const STORAGE_KEY='galaxy-theme';
 function seasonal(now=new Date()){
  const m=now.getMonth()+1,d=now.getDate();
  if(m===10&&d>=20)return'halloween';
  if(m===12&&d>=1)return'christmas';
  if(m===2&&d>=7&&d<=14)return'valentine';
  if(m===9&&d>=10&&d<=30)return'friendship';
  if((m===3&&d>=20)||(m===4&&d<=20))return'easter';
  return'daylight';
 }
 function normalize(value){return THEMES.includes(String(value))?String(value):'auto';}
 function resolve(value,now=new Date()){const selected=normalize(value);return{selected,active:selected==='auto'?seasonal(now):selected};}
 function getChoice(storage=root.localStorage){
  try{return normalize(storage?.getItem(STORAGE_KEY)||'auto');}catch{return'auto';}
 }
 function setChoice(value,storage=root.localStorage){
  const selected=normalize(value);try{storage?.setItem(STORAGE_KEY,selected);}catch{}return selected;
 }
 function applyTheme(value=getChoice(),now=new Date(),doc=root.document){
  const state=resolve(value,now);setChoice(state.selected);
  if(doc?.documentElement){doc.documentElement.dataset.theme=state.active;doc.documentElement.dataset.themeChoice=state.selected;}
  const meta=doc?.querySelector?.('meta[name="theme-color"]');if(meta)meta.content=COLORS[state.active]||COLORS.daylight;
  return state;
 }
 function options(){return THEMES.map(id=>({id,label:LABELS[id]}));}
 function activeLabel(value=getChoice(),now=new Date()){
  const state=resolve(value,now);return LABELS[state.active]||state.active;
 }
 const api={THEMES,LABELS,COLORS,STORAGE_KEY,seasonal,normalize,resolve,getChoice,setChoice,applyTheme,options,activeLabel};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.GalaxyTheme=api;
 if(root.document)applyTheme();
})(typeof globalThis!=='undefined'?globalThis:this);
