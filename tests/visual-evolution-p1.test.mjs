import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const ROOT = resolve(import.meta.dirname, '..');
const MOBILE = resolve(ROOT, 'android/app/src/main/assets/mobile');
const file = name => readFileSync(resolve(MOBILE, name), 'utf8');
const css = file('celestial-shell.css');
const js = file('celestial-shell.js');
const html = file('index.html');
const app = file('app.js');
const tokens = JSON.parse(readFileSync(resolve(ROOT, 'docs/visual-evolution-5/CELESTIAL_TOKENS.json'), 'utf8'));

test('P1 assets load after original CSS and before main app without changing bridge', () => {
  assert.match(html, /href="\.\/app\.css"[\s\S]+href="\.\/celestial-shell\.css"/);
  assert.match(html, /src="\.\/celestial-shell\.js"[\s\S]+src="\.\/app\.js"/);
  assert.match(html, /id="modal" class="modal"/);
  assert.match(html, /id="bottomNav" class="bottom-nav"/);
  assert.match(html, /id="chatFab"/);
  assert.doesNotMatch(js, /GalaxyAndroid\.postMessage|localStorage|fetch\(/);
});

test('P1 theme roles cover all seven native palettes, preserve selected-theme resolver', () => {
  for(const id of tokens.themes.filter(x => x !== 'auto')){
    const pair = tokens.palettes[id];
    const block = css.match(new RegExp('html\\[data-theme="'+id+'"\\]\\s*\\{([^}]+)\\}'));
    assert.ok(block, 'Missing palette '+id);
    assert.ok(block[1].includes('--v5-action:'+pair.accent), 'Accent drift '+id);
    assert.ok(block[1].includes('--v5-on-action:'+pair.onAccent), 'Foreground drift '+id);
  }
  assert.doesNotMatch(js, /GalaxyTheme\.(setChoice|applyTheme)/);
  assert.match(file('theme.js'), /function resolve\(/);
});

test('P1 navigation has six preserved entries and announces only current route', () => {
  for(const route of ['home','map','moments','ai','memories','more'])assert.ok(app.includes("['"+route+"'"),'Missing nav route '+route);
  assert.match(app, /aria-current=\\"page\\"/);
  for(const route of ['home','map','moments','memories','goals','ai','chat','more'])assert.ok(app.includes("view==='"+route+"'"),'Missing renderer '+route);
  assert.match(app, /window\.GalaxyCelestialShell\?\.beforeOpen/);
  assert.match(app, /window\.GalaxyCelestialShell\?\.afterOpen/);
  assert.match(app, /window\.GalaxyCelestialShell\?\.afterClose/);
});

test('P1 CSS reserves separate zones for add + chat FAB + player + keyboard', () => {
  assert.match(css, /#app:has\(\.floating-add:not\(\.hidden\)\) ~ #chatFab/);
  assert.match(css, /:has\(\.global-player\.visible\)/);
  assert.match(css, /v5-input-focused:not\(\.chat-mode\)/);
  assert.match(css, /\.modal:not\(\.chat-surface\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /max-width:360px/);
  assert.match(css, /orientation:landscape/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.doesNotMatch(css, /\.chat-composer\s*\{|\.chat-messages\s*\{/);
});

function harness(){
  const tasks=[],listeners={},attrs={};
  const origin={isConnected:true,focused:false,focus(){this.focused=true;}};
  const firstInput={focused:false,focus(){this.focused=true;}};
  const heading={id:''};
  const modal={
    open:false,
    attributes:attrs,
    listeners:{},
    classList:{contains:()=>false},
    addEventListener(name,fn){this.listeners[name]=fn;},
    querySelector(selector){
      if(selector==='.modal-inner h2')return heading;
      if(selector.includes('[autofocus]'))return firstInput;
      return null;
    },
    setAttribute(k,v){attrs[k]=v;},
    removeAttribute(k){delete attrs[k];}
  };
  const body={classList:{toggle(){}}};
  const doc={activeElement:origin,body,getElementById:id=>id==='modal'?modal:null,addEventListener:(name,fn)=>{listeners[name]=fn}};
  const root={document:doc,requestAnimationFrame:fn=>tasks.push(fn),closed:0,closeModal(){this.closed++;}};
  vm.runInNewContext(js,{window:root,globalThis:root});
  return {root,modal,origin,firstInput,heading,attrs,tasks,listeners};
}

test('P1 normal modal focuses input and restores launcher, Escape uses existing lifecycle', () => {
  const h=harness();
  h.root.GalaxyCelestialShell.beforeOpen(false);
  h.modal.open=true;
  h.root.GalaxyCelestialShell.afterOpen(false);
  assert.equal(h.attrs['aria-modal'],'true');
  assert.equal(h.attrs['aria-labelledby'],'v5-modal-title');
  while(h.tasks.length)h.tasks.shift()();
  assert.equal(h.firstInput.focused,true);
  let prevented=false;
  h.modal.listeners.cancel({preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.equal(h.root.closed,1);
  h.modal.open=false;
  h.root.GalaxyCelestialShell.afterClose(false);
  while(h.tasks.length)h.tasks.shift()();
  assert.equal(h.origin.focused,true);
  assert.equal(h.attrs['aria-labelledby'],undefined);
});

test('P1 Chat surface is not restyled or focus-restored by the shared helper', () => {
  const h=harness();
  h.root.GalaxyCelestialShell.beforeOpen(true);
  h.modal.open=true;
  h.root.GalaxyCelestialShell.afterOpen(true);
  h.root.GalaxyCelestialShell.afterClose(true);
  assert.equal(Object.keys(h.attrs).length,0);
  assert.equal(h.tasks.length,0);
  assert.equal(h.origin.focused,false);
});
