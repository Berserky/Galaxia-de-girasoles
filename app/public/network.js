export function withTimeout(operation,ms=20000){
 let timer;
 return Promise.race([Promise.resolve(operation),new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(Error('La conexión tardó demasiado. Revisa tu conexión y vuelve a intentarlo.')),ms);
 })]).finally(()=>clearTimeout(timer));
}
export async function boundedFetch(input,options={}){
 const controller=new AbortController(),signal=options.signal;
 const abort=()=>controller.abort(signal.reason);
 if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(),20000);
 try{return await fetch(input,{...options,signal:controller.signal});}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
