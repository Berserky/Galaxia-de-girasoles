// Independent of module loading: a failed import must not trap the splash.
(()=>{
 const app=document.querySelector('#app');
 function recover(){
  if(!app.querySelector('.boot'))return;
  app.innerHTML='<section class="login"><h1>No pudimos abrir su espacio</h1><p>Revisa tu conexión y vuelve a intentarlo. Tu sesión y tus datos siguen guardados.</p><button class="btn primary" id="retry-start">Volver a intentar</button></section>';
  document.querySelector('#retry-start').onclick=()=>location.reload();
 }
 const timer=setTimeout(recover,30000);
 const observer=new MutationObserver(()=>{if(!app.querySelector('.boot')){clearTimeout(timer);observer.disconnect();}});
 observer.observe(app,{childList:true,subtree:true});
})();
