let deferredInstallPrompt=null;
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isiOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
function installMarkup(){
 const ios=isiOS();
 return `<section class="install-gate"><div class="install-card"><img src="./icon.svg" width="76" height="76" alt=""><p class="eyebrow">NUESTRA GALAXIA</p><h1>Llévame contigo.</h1><p class="install-copy">Este pequeño universo fue hecho para vivir en tu celular, como una aplicación solo para ustedes dos.</p><button class="btn primary install-action" id="install-app">${ios?'Ver cómo instalar':'Instalar nuestra galaxia'}</button><button class="btn text-button" id="install-later">Continuar en el navegador</button><p class="install-help" id="install-help">${ios?'En iPhone: toca Compartir y luego «Añadir a pantalla de inicio».':''}</p><small>Después de instalarla, ábrela desde el icono de tu pantalla de inicio.</small></div></section>`;
}
export async function setupPwa(beforeLogin){
 if('serviceWorker'in navigator)try{await navigator.serviceWorker.register('./sw.js',{scope:'./'});}catch{}
 if(standalone()){document.documentElement.classList.add('is-installed');return false;}
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;document.querySelector('#install-app')?.removeAttribute('disabled');});
 window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;location.reload();});
 if(sessionStorage.getItem('galaxy-install-skip')==='1')return false;
 beforeLogin(installMarkup());
 document.querySelector('#install-app')?.addEventListener('click',async()=>{
  if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;return;}
  document.querySelector('#install-help').textContent=isiOS()?'Toca el botón Compartir de Safari → «Añadir a pantalla de inicio» → Añadir.':'Abre el menú del navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio».';
 });
 document.querySelector('#install-later')?.addEventListener('click',()=>{sessionStorage.setItem('galaxy-install-skip','1');location.reload();});
 return true;
}
