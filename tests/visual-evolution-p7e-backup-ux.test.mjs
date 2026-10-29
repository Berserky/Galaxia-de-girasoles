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
const {enhanceBackups,classify}=sandbox.GalaxyMoreV5;

function fixture(){
 const make=(tag='div')=>({
  tag,children:[],parentNode:null,textContent:'',className:'',
  append(...nodes){for(const node of nodes){if(node.parentNode?.children)node.parentNode.children=node.parentNode.children.filter(x=>x!==node);node.parentNode=this;this.children.push(node);}},
  insertBefore(node,ref){const index=this.children.indexOf(ref);assert.ok(index>=0);node.parentNode=this;this.children.splice(index,0,node);},
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}
 });
 const doc={createElement:make},area=make(),card=make(),row=make();
 const exportButton=make('button'),importButton=make('button');
 row.append(exportButton,importButton);card.append(row);area.append(card);area.ownerDocument=doc;
 area.querySelector=selector=>{
  if(selector==='.v5-backup-zones')return card.children.find(x=>x.className==='v5-backup-zones');
  if(selector==='[data-action="backup-export"]')return exportButton;
  if(selector==='[data-action="backup-import"]')return importButton;
  return null;
 };
 return {area,card,row,exportButton,importButton,hub:{querySelector:s=>s.includes('backups')?area:null}};
}

test('P7E export/import card still routes to backups group',()=>{
 assert.equal(classify({actions:['backup-export','backup-import']}),'backups');
});
test('P7E keeps exact original buttons and their delegated action identities',()=>{
 const f=fixture();assert.equal(enhanceBackups(f.hub),true);
 const zones=f.card.children[0];assert.equal(zones.className,'v5-backup-zones');
 assert.equal(zones.children[0].children[2],f.exportButton);
 assert.equal(zones.children[1].children[2],f.importButton);
 assert.equal(f.row.parentNode,null);
});
test('P7E warns that media is referenced and JSON contains private information',()=>{
 const f=fixture();enhanceBackups(f.hub);
 const zones=f.card.children[0];
 assert.match(zones.children[0].children[1].textContent,/información privada/);
 assert.match(zones.children[0].children[1].textContent,/por referencia/);
});
test('P7E/P7F distinguishes impact preview from server-verified manifest and preserves confirmation',()=>{
 const f=fixture();enhanceBackups(f.hub);
 assert.match(f.card.children[0].children[1].children[1].textContent,/no existe una vista previa/);
 assert.match(app,/if\(a==='backup-import'\)\{\s*const file=await GalaxyNative\.call\('importJson'\)/);
 assert.match(app,/GalaxyMoreV5\?\.backupManifestPreview\?\.\(backup\)/);
 assert.match(app,/if\(!preview\?\.ok\)\{toast\(/);
 assert.match(app,/if\(!confirm\(preview\.message\)\)return;/);
 assert.match(app,/api\('backup-import',\{backup\}\)/);
});
test('P7E is idempotent and does not change native, network or RLS logic',()=>{
 const f=fixture();assert.equal(enhanceBackups(f.hub),true);
 assert.equal(enhanceBackups(f.hub),false);
 const code=source.slice(source.indexOf('function enhanceBackups'),source.indexOf('function organize(container)'));
 assert.doesNotMatch(code,/GalaxyNative|XMLHttpRequest|\bfetch\s*\(|localStorage|sessionStorage|innerHTML/);
});
