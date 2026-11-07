import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';
const root=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(root,name),'utf8');
const sandbox={window:{}};
runInNewContext(read('galaxy-more-v5.js'),sandbox,{timeout:2000});
const more=sandbox.window.GalaxyMoreV5;

test('P7K: capture only approved form field and caret, never private values',()=>{
 const form={},field={name:'name0',value:'texto privado',selectionStart:2,selectionEnd:5,closest:q=>q==='#settingsForm'?form:null};
 const snapshot=more.captureSettingsFocus({ownerDocument:{activeElement:field},contains:node=>node===form});
 assert.equal(snapshot.name,'name0');assert.equal(snapshot.start,2);assert.equal(snapshot.end,5);
 assert.equal(Object.hasOwn(snapshot,'value'),false);
 assert.equal(more.captureSettingsFocus({ownerDocument:{activeElement:{name:'password',closest:()=>form}}}),null);
 assert.equal(more.captureSettingsFocus({ownerDocument:{activeElement:{name:'name0',closest:()=>null}}}),null);
});
test('P7K: focus and selection restored without scrolling after safe re-render',()=>{
 let focused=0,range=[];
 const field={isConnected:true,disabled:false,closest:()=>({open:true}),focus:opts=>{assert.equal(opts.preventScroll,true);focused++;},setSelectionRange:(a,b)=>range=[a,b]};
 const host={querySelector:()=>({elements:{namedItem:name=>name==='name1'?field:null}})};
 assert.equal(more.restoreSettingsFocus(host,{name:'name1',start:1,end:3}),true);
 assert.equal(focused,1);assert.deepEqual(range,[1,3]);
});
test('P7K: never focus hidden, disabled, detached or unknown controls',()=>{
 let focused=0;const group={open:false};
 const field={isConnected:true,disabled:false,closest:()=>group,focus:()=>focused++};
 const host={querySelector:()=>({elements:{namedItem:()=>field}})};
 assert.equal(more.restoreSettingsFocus(host,{name:'name0'}),false);
 group.open=true;field.disabled=true;assert.equal(more.restoreSettingsFocus(host,{name:'name0'}),false);
 field.disabled=false;field.isConnected=false;assert.equal(more.restoreSettingsFocus(host,{name:'name0'}),false);
 field.isConnected=true;assert.equal(more.restoreSettingsFocus(host,{name:'token'}),false);
 assert.equal(focused,0);
});
test('P7K: Android date input may throw on selectionStart',()=>{
 const form={},date={name:'startDate',closest:()=>form,get selectionStart(){throw new Error('InvalidStateError');}};
 const snap=more.captureSettingsFocus({ownerDocument:{activeElement:date},contains:()=>true});
 assert.equal(snap.name,'startDate');assert.equal(snap.start,null);
});
test('P7K: detached toggle cannot repopulate group state after unpair',()=>{
 more.resetNavigation();
 assert.equal(more.rememberGroupToggle({isConnected:false,open:true},'sensitive'),false);
 assert.equal(more.rememberGroupToggle({isConnected:true,open:true},'not-a-group'),false);
 assert.equal(more.rememberGroupToggle({isConnected:true,open:true},'privacy'),true);
});
test('P7K: app restore is guarded by paired identity and follows draft restore',()=>{
 const code=read('app.js');
 assert.match(code,/const settingsFocus=window\.GalaxyMoreV5\?\.captureSettingsFocus\(app\)/);
 assert.match(code,/restoreSettingsForm\(\);\s*if\(focusOwner===settingsDraftOwner&&String\(native\.person\?\?''\)===String\(cloud\.person\?\?''\)\)/);
 assert.match(code,/GalaxyMoreV5\?\.restoreSettingsFocus\(app,settingsFocus\)/);
 assert.match(read('galaxy-more-v5.js'),/addEventListener\('toggle',\(\)=>rememberGroupToggle\(slot\.details,id\)\)/);
});
