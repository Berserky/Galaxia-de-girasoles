import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(dir,name),'utf8');
const sandbox={window:{}};
runInNewContext(read('galaxy-more-v5.js'),sandbox);
const {enhancePrivacy,privacyAudience}=sandbox.window.GalaxyMoreV5;

function fixture({battery=true,listening=false,withDelete=true}={}){
 const doc={createElement:()=>makeNode(doc)};
 const make=(classes=[])=>{const n=makeNode(doc);n.classes=new Set(classes);return n;};
 const hub=make(),area=make(),presence=make(),grid=make(),history=make(),row=make();
 const batteryButton=make(battery?['active']:[]),listeningButton=make(listening?['active']:[]),gpsButton=make();
 const batterySmall=make(),listeningSmall=make(),gpsSmall=make();gpsSmall.textContent='Pausada';
 const exportButton=make(),deleteButton=make();
 grid.queries={'[data-action="presence-battery"]':batteryButton,'[data-action="presence-listening"]':listeningButton,'[data-action="map"]':gpsButton};
 batteryButton.queries={small:batterySmall};listeningButton.queries={small:listeningSmall};gpsButton.queries={small:gpsSmall};
 presence.queries={'.privacy-grid':grid};
 history.queries={'[data-action="gps-history-export"]':exportButton};
 if(withDelete)history.queries['[data-action="gps-history-delete-open"]']=deleteButton;
 row.append(exportButton,deleteButton);history.append(row);
 area.queries={'#presencePrivacySettings':presence,'.gps-history-card':history};
 hub.queries={'[data-group="privacy"] .v5-more-group-content':area};
 return {hub,presence,batteryButton,listeningButton,gpsButton,batterySmall,listeningSmall,exportButton,deleteButton,history,row};
}
function makeNode(doc){
 const n={ownerDocument:doc,children:[],attrs:{},classes:new Set(),queries:{},textContent:'',className:'',parentNode:null,removed:false,
  querySelector(s){return this.queries[s]||null},
  setAttribute(k,v){this.attrs[k]=v},
  append(...elements){for(const e of elements){if(e.parentNode)e.parentNode.children=e.parentNode.children.filter(x=>x!==e);this.children.push(e);e.parentNode=this}},
  insertBefore(e,ref){if(e.parentNode)e.parentNode.children=e.parentNode.children.filter(x=>x!==e);const i=this.children.indexOf(ref);this.children.splice(i<0?this.children.length:i,0,e);e.parentNode=this},
  remove(){this.removed=true;if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null},
 };
 n.classList={contains:s=>n.classes.has(s),add:s=>n.classes.add(s)};
 return n;
}
test('P7B audience never claims public visibility or invents timestamps',()=>{
 assert.equal(privacyAudience(true),'Compartido con la pareja vinculada');
 assert.equal(privacyAudience(false),'Solo para este perfil');
});
test('P7B renders authenticated preference booleans as accessible switches',()=>{
 const f=fixture();assert.equal(enhancePrivacy(f.hub),true);
 assert.equal(f.batteryButton.attrs.role,'switch');assert.equal(f.batteryButton.attrs['aria-checked'],'true');
 assert.equal(f.listeningButton.attrs['aria-checked'],'false');
 assert.match(f.batterySmall.textContent,/pareja vinculada/);
 assert.match(f.listeningSmall.textContent,/Solo para este perfil/);
});
test('P7B GPS is navigation, not a misleading toggle',()=>{
 const f=fixture();enhancePrivacy(f.hub);
 assert.equal(f.gpsButton.attrs.role,undefined);
 assert.match(f.gpsButton.attrs['aria-label'],/Abrir el mapa.*Pausada/);
 assert.ok(f.gpsButton.classes.has('v5-gps-navigation'));
});
test('P7B separates export and delete without replacing action nodes',()=>{
 const f=fixture();enhancePrivacy(f.hub);
 assert.equal(f.row.removed,true);
 const zones=f.history.children[0].children;
 assert.equal(zones.length,2);
 assert.equal(zones[0].children[2],f.exportButton);
 assert.equal(zones[1].children[2],f.deleteButton);
 assert.match(zones[1].children[1].textContent,/confirmación original/);
});
test('P7B does not restructure GPS controls when action pair is incomplete',()=>{
 const f=fixture({withDelete:false});enhancePrivacy(f.hub);
 assert.equal(f.row.removed,false);
 assert.equal(f.exportButton.parentNode,f.row);
});
test('P7B preserves original strong confirmation and server-side delete',()=>{
 const app=read('app.js'),js=read('galaxy-more-v5.js');
 assert.match(app,/Escribe BORRAR para confirmar/);
 assert.match(app,/api\('gps-history-delete'\)/);
 assert.match(app,/clearPendingGps/);
 assert.match(app,/data-action="presence-battery"/);
 assert.doesNotMatch(js,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative|gps-history-delete'\)/);
});
