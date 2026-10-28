import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const source=readFileSync(resolve(dir,'galaxy-more-v5.js'),'utf8');
const app=readFileSync(resolve(dir,'app.js'),'utf8');
const sandbox={window:null};sandbox.window=sandbox;
runInNewContext(source,sandbox);
const {classify,notificationIndicator,enhanceNotifications}=sandbox.GalaxyMoreV5;

test('P7D routes permission-granted notification card with only Android settings action',()=>{
 assert.equal(classify({notificationHealth:true,actions:['app-settings']}),'notifications');
});
test('P7D retains gestures notifications in same section',()=>{
 assert.equal(classify({actions:['moment-notifications','bond-haptics','app-settings']}),'notifications');
});
test('P7D displays original device-derived text without inferring delivery',()=>{
 assert.equal(notificationIndicator({textContent:'  Push   configurado  '}),'Push configurado');
 assert.equal(notificationIndicator({textContent:'Permiso pendiente'}),'Permiso pendiente');
});
test('P7D missing evidence is not presented as delivered',()=>{
 assert.equal(notificationIndicator(null),'Estado no disponible');
 assert.equal(notificationIndicator({textContent:'  '}),'Estado no disponible');
});
test('P7D preserves native actions, moves the original haptics control and is idempotent',()=>{
 const make=(name='div')=>({
  name,children:[],attrs:{},textContent:'',parentNode:null,
  append(...nodes){for(const node of nodes){if(node.parentNode?.children){node.parentNode.children=node.parentNode.children.filter(x=>x!==node);}node.parentNode=this;this.children.push(node);}},
  setAttribute(key,value){this.attrs[key]=value;}
 });
 const doc={createElement:make};
 const permission={textContent:'Permiso concedido'},push={textContent:'Push configurado'};
 const system={textContent:'Sistema habilitado'};
 const haptics=make('button'),testButton=make('button'),row=make();
 row.append(haptics,testButton);
 const activity={
  querySelector(sel){return sel==='.eyebrow'?{textContent:'NOTIFICACIONES'}:null;},
  querySelectorAll(sel){return sel==='.notification-health span'?[permission,push]:[];}
 };
 const moments={
  querySelector(sel){
   if(sel==='[data-action="moment-notifications"]')return {textContent:'Activar'};
   if(sel==='[data-action="bond-haptics"]')return haptics;
   if(sel==='[data-action="moment-notification-test"]')return testButton;
   if(sel==='.badge')return {textContent:'Listas'};
   return null;
  },
  querySelectorAll(sel){return sel==='.notification-health span'?[permission,system]:[];}
 };
 const area=make();area.ownerDocument=doc;
 area.querySelector=sel=>sel==='.v5-notification-overview'?area.children.find(x=>x.className==='v5-notification-overview'):null;
 area.querySelectorAll=sel=>sel==='.card'?[activity,moments]:[];
 area.insertBefore=(node)=>{node.parentNode=area;area.children.unshift(node);};
 const hub={querySelector:sel=>sel.includes('notifications')?area:null};
 assert.equal(enhanceNotifications(hub),true);
 const overview=area.children[0];
 assert.equal(overview.className,'v5-notification-overview');
 assert.match(overview.children[2].textContent,/no confirman entrega/);
 const zone=area.children.find(x=>x.className==='v5-haptics-zone');
 assert.ok(zone);
 assert.equal(zone.children[2],haptics);
 assert.equal(row.children.includes(testButton),true);
 assert.equal(row.children.includes(haptics),false);
 assert.equal(enhanceNotifications(hub),false);
});
test('P7D is presentation-only: original native actions and guards remain in app.js',()=>{
 assert.match(app,/data-action="moment-notification-test"/);
 assert.match(app,/GalaxyNative.call\('testMomentNotification'\)/);
 assert.match(app,/GalaxyNative.call\('setMomentNotifications'/);
 assert.match(app,/GalaxyNative.call\('setBondHaptics'/);
 const code=source.slice(source.indexOf('function notificationIndicator'),source.indexOf('function organize(container)'));
 assert.doesNotMatch(code,/GalaxyNative|XMLHttpRequest|\bfetch\s*\(|localStorage|sessionStorage|innerHTML/);
 assert.match(code,/no confirman entrega/);
});
