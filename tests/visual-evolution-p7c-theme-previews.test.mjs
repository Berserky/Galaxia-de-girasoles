import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runInNewContext} from 'node:vm';

const dir=resolve(import.meta.dirname,'../android/app/src/main/assets/mobile');
const read=name=>readFileSync(resolve(dir,name),'utf8');
const storage={choice:'auto',writes:0,getItem(){return this.choice;},setItem(_key,value){this.choice=value;this.writes++;}};
const sandbox={window:null,localStorage:storage};
sandbox.window=sandbox;
runInNewContext(read('theme.js'),sandbox);
runInNewContext(read('galaxy-more-v5.js'),sandbox);
const engine=sandbox.GalaxyTheme;
const {themePalette,nextAutoChange,enhanceAppearance}=sandbox.GalaxyMoreV5;

function normalized(hex){
 const x=hex.toLowerCase();
 return x.length===4?'#'+[...x.slice(1)].map(c=>c+c).join(''):x;
}
function cssVars(theme){
 const css=read('app.css');
 const block=theme==='daylight'?css.slice(0,css.indexOf('*{')):css.match(new RegExp('html\\[data-theme="'+theme+'"\\]\\{([^}]*)\\}'))?.[1];
 assert.ok(block,'missing CSS theme '+theme);
 const result={};
 for(const key of ['bg','surface','text','accent']){
  const match=block.match(new RegExp('--'+key+':(#[0-9a-fA-F]+)'));
  assert.ok(match,theme+' '+key);
  result[key]=normalized(match[1]);
 }
 return result;
}

test('P7C all seven palettes are real CSS variables, not invented swatches',()=>{
 for(const id of engine.THEMES.filter(id=>id!=='auto')){
  const palette=themePalette(engine,id),css=cssVars(id);
  for(const key of ['bg','surface','text','accent'])assert.equal(normalized(palette[key]),css[key],id+' '+key);
 }
});

test('P7C automatic preview resolves the authentic active theme',()=>{
 const now=new Date(2026,9,25,12);
 assert.equal(themePalette(engine,'auto',now).id,'halloween');
 assert.equal(themePalette(engine,'auto',now).bg,engine.COLORS.halloween);
});

test('P7C next automatic change is derived from engine seasonal rules',()=>{
 const next=nextAutoChange(engine,new Date(2026,9,19,12));
 assert.equal(next.theme,'halloween');
 assert.equal(next.date.getMonth(),9);
 assert.equal(next.date.getDate(),20);
});

test('P7C date rules cover holiday exit without inventing schedules',()=>{
 const next=nextAutoChange(engine,new Date(2026,11,25,12));
 assert.equal(next.theme,'daylight');
 assert.equal(next.date.getMonth(),0);
 assert.equal(next.date.getDate(),1);
});

test('P7C presenter cannot call network, native bridge or persistent storage',()=>{
 const src=read('galaxy-more-v5.js');
 assert.doesNotMatch(src,/\\bfetch\\s*\\(|XMLHttpRequest|localStorage|sessionStorage|GalaxyNative|navigator\\.geolocation/);
 assert.match(src,/original\\.dataset\\.value/);
 assert.match(src,/data-action="theme-set"/);
});

test('P7C preview preserves original theme buttons and never saves a choice',()=>{
 const make=()=>({
  children:[],attrs:{},style:{},dataset:{},events:{},textContent:'',
  setAttribute(k,v){this.attrs[k]=v;},
  append(...nodes){this.children.push(...nodes);},
  replaceChildren(...nodes){this.children=[...nodes];},
  addEventListener(k,fn){this.events[k]=fn;}
 });
 const doc={createElement:()=>make()};
 const buttons=engine.options().map(({id})=>{const b=make();b.dataset.value=id;return b;});
 const grid=make();grid.children=[...buttons];
 grid.querySelector=sel=>sel==='.v5-theme-tile'&&grid.children.some(x=>x.className==='v5-theme-tile')?grid.children[0]:null;
 grid.querySelectorAll=sel=>sel==='button[data-action="theme-set"]'?buttons:[];
 grid.replaceChild=(tile,button)=>{const index=grid.children.indexOf(button);assert.ok(index>=0);grid.children[index]=tile;};
 const card=make();card.ownerDocument=doc;card.querySelector=sel=>sel==='.theme-grid'?grid:null;
 const area={querySelector:sel=>sel==='.theme-settings-card'?card:null};
 const hub={querySelector:sel=>sel.includes('appearance')?area:null};
 const writesBefore=storage.writes,choiceBefore=engine.getChoice();
 assert.equal(enhanceAppearance(hub,engine,new Date(2026,9,25,12)),true);
 assert.equal(grid.children.length,buttons.length);
 for(let i=0;i<buttons.length;i++)assert.equal(grid.children[i].children[0],buttons[i]);
 const previewButton=grid.children[2].children[1];
 assert.equal(previewButton.attrs['aria-label'].includes('sin cambiar'),true);
 previewButton.events.click({stopPropagation(){}});
 assert.equal(storage.writes,writesBefore);
 assert.equal(engine.getChoice(),choiceBefore);
 assert.equal(enhanceAppearance(hub,engine,new Date(2026,9,25,12)),false);
});
