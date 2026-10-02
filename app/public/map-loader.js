import {withTimeout} from './network.js';
const resources=[['locations','/api/locations',0],['places','/api/map/places',60000],['trip','/api/map/trip',0],['history','/api/map/history',60000],['trips','/api/map/trip/history',60000],['events','/api/map/place/events',60000],['destinations','/api/map/destinations',0],['encounters','/api/map/encounters',60000]];
// Each resource can render independently. Never queue duplicate polling requests.
export function createMapLoader({request,update,onError=()=>{},active=()=>true,now=Date.now,timeout=10000}){
 const pending=new Map(),loaded=new Map();
 return {load({force=false}={}){
  return Promise.all(resources.map(([key,url,ttl])=>{
   if(pending.has(key))return pending.get(key);
   if(!force&&ttl&&loaded.has(key)&&now()-loaded.get(key)<ttl)return;
   const task=withTimeout(Promise.resolve().then(()=>request(url)),timeout).then(data=>{
    if(!active())return;update(key,data);loaded.set(key,now());
   }).catch(error=>{if(active())onError(key,error);}).finally(()=>pending.delete(key));
   pending.set(key,task);return task;
  }));
 }};
}
