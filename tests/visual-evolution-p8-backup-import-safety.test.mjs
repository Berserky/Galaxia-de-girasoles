import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const mobile=new URL('../android/app/src/main/assets/mobile/',import.meta.url);
const more=readFileSync(new URL('galaxy-more-v5.js',mobile),'utf8');
const app=readFileSync(new URL('app.js',mobile),'utf8');
const sandbox={window:{}};
runInNewContext(more,sandbox);
const {enhanceBackups,backupManifestPreview}=sandbox.window.GalaxyMoreV5;
const importBlock=app.slice(app.indexOf("if(a==='backup-import'){"),app.indexOf("if(a==='context-near-toggle')"));

class FakeElement {
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.parentNode=null;this.className='';this.textContent='';}
 append(...nodes){for(const node of nodes){if(node.parentNode)node.remove();this.children.push(node);node.parentNode=this;}}
 insertBefore(node,before){if(node.parentNode)node.remove();const index=this.children.indexOf(before);assert.ok(index>=0);this.children.splice(index,0,node);node.parentNode=this;}
 remove(){if(!this.parentNode)return;const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}
}
function backupFixture(){
 const doc={createElement(tag){return new FakeElement(tag,doc);}};
 const parent=doc.createElement('div'),row=doc.createElement('div');
 const exportButton=doc.createElement('button'),importButton=doc.createElement('button');
 row.append(exportButton,importButton);parent.append(row);
 const area={ownerDocument:doc,querySelector(selector){
  if(selector==='.v5-backup-zones')return parent.children.find(x=>x.className==='v5-backup-zones')||null;
  if(selector.includes('backup-export'))return exportButton;
  if(selector.includes('backup-import'))return importButton;
  return null;
 }};
 return {hub:{querySelector(selector){return selector.includes('backups')?area:null;}},parent,exportButton,importButton};
}

test('P8 backup presentation preserves original export/import action nodes and is idempotent',()=>{
 const fixture=backupFixture();
 assert.equal(enhanceBackups(fixture.hub),true);
 const zones=fixture.parent.children[0];
 assert.equal(zones.className,'v5-backup-zones');
 assert.equal(zones.children.length,2);
 assert.ok(zones.children[0].children.includes(fixture.exportButton));
 assert.ok(zones.children[1].children.includes(fixture.importButton));
 assert.equal(enhanceBackups(fixture.hub),false);
});

test('P8 restore warning describes real manifest preview without promising append-only changes',()=>{
 const fixture=backupFixture();enhanceBackups(fixture.hub);
 const note=fixture.parent.children[0].children[1].children[1].textContent;
 assert.match(note,/manifiesto con cantidades declaradas/);
 assert.match(note,/no una comparación con los datos actuales/);
 assert.match(note,/puede haber conflictos o sustituciones/);
 assert.match(note,/confirmación/);
 assert.doesNotMatch(note,/Aún no existe una vista previa|La restauración añade datos/);
});

test('P8 manifest preview still refuses invalid backups and does not claim local hash verification',()=>{
 const invalid=backupManifestPreview({format:'otra',version:5});
 assert.equal(invalid.ok,false);
 const backup={format:'nuestra-galaxia-backup',version:5,backupId:'00000000-0000-4000-8000-000000000001',manifest:{
  schemaVersion:'20261005011401',
  counts:{settings:1,items:2,places:1,bond:3,chatMessages:0,locationHistory:0,tripHistory:0},
  media:{count:0},payload:{bucket:'galaxy-backups',path:'0/00000000-0000-4000-8000-000000000001.json',sizeBytes:128,sha256:'a'.repeat(64)}
 }};
 const preview=backupManifestPreview(backup);
 assert.equal(preview.ok,true);
 assert.match(preview.message,/El teléfono NO verifica el contenido ni su hash/);
 assert.match(preview.message,/Puede haber conflictos/);
 assert.doesNotMatch(preview.message,/00000000-0000/);
});

test('P8 import is serialized and releases the guard after cancel, error or success',()=>{
 assert.match(app,/let backupImportInFlight=false/);
 assert.match(importBlock,/if\(backupImportInFlight\)return/);
 assert.match(importBlock,/backupImportInFlight=true/);
 assert.match(importBlock,/try\s*\{/);
 assert.match(importBlock,/finally\s*\{\s*backupImportInFlight=false/);
 const steps=["GalaxyNative.call('importJson')","JSON.parse(file.json)","backupManifestPreview?.(backup)","confirm(preview.message)","api('backup-import',{backup})"];
 steps.forEach((step,i)=>{assert.ok(importBlock.includes(step),step);if(i)assert.ok(importBlock.indexOf(steps[i-1])<importBlock.indexOf(step),step);});
});

test('P8 verified server restore cannot be reported as a failed import after UI refresh failure',()=>{
 assert.match(importBlock,/result\?\.verified!==true/);
 assert.match(importBlock,/const r=result\.restored\|\|\{\}/);
 assert.match(importBlock,/let refreshed=true/);
 assert.match(importBlock,/await refreshState\(\{quiet:true\}\)/);
 assert.match(importBlock,/await refreshMap\(\{quiet:true,detail:true\}\)/);
 assert.match(importBlock,/catch\s*\{\s*refreshed=false/);
 assert.match(importBlock,/if\(!refreshed\)/);
 assert.match(importBlock,/Restauración verificada en el servidor/);
 assert.match(importBlock,/no vuelvas a importar la misma copia/);
 assert.ok(importBlock.indexOf('result?.verified!==true')<importBlock.indexOf('let refreshed=true'));
});

test('P8 affected browser modules retain valid JavaScript syntax',()=>{
 assert.doesNotThrow(()=>new Function(more));
 assert.doesNotThrow(()=>new Function(app));
});
