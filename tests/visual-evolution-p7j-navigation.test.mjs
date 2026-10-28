import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const base=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=p=>readFileSync(resolve(base,p),'utf8');
const sandbox={window:{}};runInNewContext(read('galaxy-more-v5.js'),sandbox,{timeout:2000});
const more=sandbox.window.GalaxyMoreV5;
test('P7J: unique, grounded quick links for settings sections',()=>{
 const list=Array.from(more.navigationGroups());
 assert.equal(list.length,9);
 assert.equal(new Set(list.map(x=>x.id)).size,list.length);
 assert.ok(list.some(x=>x.id==='sensitive'));
});
test('P7J: deep link opens existing privacy group and returns keyboard focus',()=>{
 const summary={focused:false,scrolled:false,focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};
 const details={open:false,querySelector:()=>summary};
 const host={querySelector:q=>q.includes('data-group="privacy"')?details:null};
 assert.equal(more.revealGroup(host,'privacy',true),true);
 assert.equal(details.open,true);
 assert.equal(summary.focused,true);assert.equal(summary.scrolled,true);
 assert.equal(more.revealGroup(host,'unknown',true),false);
});
test('P7J: group expansion is captured, not lost during periodic renders',()=>{
 const nodes=[{open:false,dataset:{group:'privacy'}},{open:true,dataset:{group:'appearance'}}];
 const hub={querySelectorAll:()=>nodes};
 assert.equal(more.captureNavigation({querySelector:q=>q==='.v5-more-hub'?hub:null}),true);
 const appearance={open:false},scope={querySelector:q=>q.includes('data-group="appearance"')?appearance:null};
 assert.equal(more.revealGroup(scope,'appearance'),true);
 assert.equal(appearance.open,true);
 more.resetNavigation();
});
test('P7J: privacy shortcut from other views opens group before focusing controls',()=>{
 const source=read('app.js');
 assert.match(source,/go\('more'\);\s*window\.GalaxyMoreV5\?\.revealGroup\(app,'privacy'\);/);
 assert.match(source,/GalaxyMoreV5\?\.captureNavigation\(app\)/);
 assert.match(source,/GalaxyMoreV5\?\.resetNavigation\(\)/);
 assert.match(source,/app\.classList\.toggle\('v5-more-route'/);
});
test('P7J: navigation only moves existing controls, without native or network access',()=>{
 const script=read('galaxy-more-v5.js');
 assert.match(script,/slots\.get\(classify\(meta\)\)\.body\.append\(el\)/);
 assert.match(script,/quick\.setAttribute\('aria-label','Acceso rápido a los ajustes'\)/);
 assert.match(script,/button\.setAttribute\('aria-controls',entry\.id\)/);
 assert.doesNotMatch(script,/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative/);
});
test('P7J: responsive compact settings header and 44px touch controls',()=>{
 const style=read('galaxy-more-v5.css');
 assert.match(style,/#app\.v5-more-route>\.header/);
 assert.match(style,/min-height:48px/);
 assert.match(style,/min-height:44px/);
 assert.match(style,/@media\(max-width:390px\)/);
});
