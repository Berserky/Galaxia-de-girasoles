/*
 * Celestial Shell P1: accessibility helpers for the existing native <dialog>.
 * No routing, data, Chat engine or native bridge work is performed here.
 */
(function(root){
  'use strict';
  const doc=root.document;
  if(!doc)return;
  const modal=doc.getElementById('modal');
  let restoreTarget=null;
  let pendingFocus=false;
  let lastInvoker=null;
  let lastInvokedAt=0;
  const isEditable=el=>Boolean(el?.matches?.('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"]'));
  function syncEditing(){
    doc.body?.classList.toggle('v5-input-focused',isEditable(doc.activeElement));
  }
  // WebView touch/JS .click() need not focus the button. Remember the latest
  // actual invoker, so dialog close restores a meaningful location for all inputs.
  doc.addEventListener('click',event=>{
    const candidate=event.target?.closest?.('button,[data-action],[data-view],[role="button"]');
    if(candidate&&!modal?.contains?.(candidate)){
      lastInvoker=candidate;
      lastInvokedAt=Date.now();
    }
  },true);
  doc.addEventListener('focusin',syncEditing);
  doc.addEventListener('focusout',()=>root.requestAnimationFrame(syncEditing));
  function beforeOpen(isChat){
    if(isChat||!modal||modal.open)return;
    const active=doc.activeElement;
    const focused=active&&active!==doc.body&&active.isConnected?active:null;
    const recent=Date.now()-lastInvokedAt<=1000&&lastInvoker?.isConnected?lastInvoker:null;
    restoreTarget=recent||focused;
  }
  function afterOpen(isChat){
    if(isChat||!modal)return;
    const heading=modal.querySelector('.modal-inner h2');
    if(heading){
      heading.id='v5-modal-title';
      modal.setAttribute('aria-labelledby','v5-modal-title');
    }
    modal.setAttribute('aria-modal','true');
    pendingFocus=true;
    root.requestAnimationFrame(()=>{
      if(!pendingFocus||!modal.open||modal.classList.contains('chat-surface'))return;
      pendingFocus=false;
      // querySelector() returns DOM order, not selector order. The close button
      // precedes the search input in a regular dialog; keep it a fallback only.
      const target=modal.querySelector('[autofocus],input:not([type="hidden"]):not(:disabled),textarea:not(:disabled),select:not(:disabled),button:not(.close):not(:disabled)')
        || modal.querySelector('.close');
      target?.focus({preventScroll:true});
      // Some Android WebViews can update activeElement without bubbling focusin.
      // Sync directly after programmatic focus, not only via the document event.
      syncEditing();
    });
  }
  function afterClose(isChat){
    pendingFocus=false;
    if(modal&&!isChat){
      modal.removeAttribute('aria-labelledby');
      modal.removeAttribute('aria-modal');
    }
    const previous=restoreTarget;
    restoreTarget=null;
    if(!isChat&&previous?.isConnected&&typeof previous.focus==='function'){
      root.requestAnimationFrame(()=>{
        if(!modal?.open)previous.focus({preventScroll:true});
        syncEditing();
      });
    } else if(!isChat)root.requestAnimationFrame(syncEditing);
  }
  if(modal){
    modal.addEventListener('cancel',event=>{
      event.preventDefault();
      if(typeof root.closeModal==='function')root.closeModal();
      else modal.close();
    });
    // Also cover a close performed by the platform rather than app.js.
    modal.addEventListener('close',()=>{if(restoreTarget)afterClose(modal.classList.contains('chat-surface'));});
  }
  root.GalaxyCelestialShell=Object.freeze({beforeOpen,afterOpen,afterClose});
})(typeof window!=='undefined'?window:globalThis);
