const THEMES=['auto','daylight','cosmic','halloween','christmas','valentine','friendship','easter'];
const LABELS={auto:'Automático',daylight:'Luz suave',cosmic:'Universo oscuro',halloween:'Halloween',christmas:'Navidad',valentine:'San Valentín',friendship:'Amor y amistad',easter:'Pascua'};
function seasonal(now=new Date()){
 const m=now.getMonth()+1,d=now.getDate();
 if(m===10&&d>=20)return'halloween';
 if(m===12&&d>=1)return'christmas';
 if(m===2&&d>=7&&d<=14)return'valentine';
 if(m===9&&d>=10&&d<=30)return'friendship';
 if((m===3&&d>=20)||(m===4&&d<=20))return'easter';
 return'daylight';
}
export function themeOptions(){return THEMES.map(id=>[id,LABELS[id]]);}
export function applyTheme(value=localStorage.getItem('galaxy-theme')||'auto'){
 const selected=THEMES.includes(value)?value:'auto',active=selected==='auto'?seasonal():selected;
 document.documentElement.dataset.theme=active;
 document.documentElement.dataset.themeChoice=selected;
 localStorage.setItem('galaxy-theme',selected);
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content={daylight:'#f7f6fa',cosmic:'#10101d',halloween:'#100913',christmas:'#071510',valentine:'#180810',friendship:'#120b22',easter:'#11162c'}[active]||'#f7f6fa';
 window.dispatchEvent(new CustomEvent('galaxy-theme',{detail:{selected,active}}));
 return{selected,active};
}
applyTheme();
