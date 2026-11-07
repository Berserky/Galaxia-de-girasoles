#!/usr/bin/env python3
"""V5-P5 #176 reproducible *offline Chromium* nav-135 geometry audit.
Not a WebView test; no writes to packaged Android assets or runtime.
Requires local Python playwright and Chromium, never downloads a browser.
Run: python3 scripts/p5-nav-135-browser-audit.py --out /tmp/galaxy-nav-135
"""
import argparse
import json
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CSS=[
 'android/app/src/main/assets/mobile/app.css',
 'android/app/src/main/assets/mobile/celestial-shell.css',
 'android/app/src/main/assets/mobile/galaxy-moments-v5.css',
]
CANDIDATE='docs/visual-evolution-5/candidates/nav-p5-textzoom-135.css'
WIDTHS=(320,360,393,412)
THEMES=('daylight','cosmic','halloween','christmas','valentine','friendship','easter')

def fixture(candidate):
 app=(ROOT/'android/app/src/main/assets/mobile/app.js').read_text(encoding='utf-8')
 match=re.search(r'const nav=\[(.*?)\];',app)
 if not match: raise ValueError('Real app.js navigation contract absent')
 labels=re.findall(r"\['([^']+)','([^']+)'\]",match.group(1))
 if [a for a,_ in labels]!=['home','map','moments','ai','memories','more']:
  raise ValueError('Navigation destinations changed')
 styles=''.join('<style>'+ (ROOT/path).read_text(encoding='utf-8')+'</style>' for path in CSS)
 # Approximation, not native Android textZoom: 135% applied to computed font.
 styles+='<style>body:not(.chat-mode) .bottom-nav .nav-btn span{font-size:calc(1.35 * clamp(9px,2.8vw,11px))!important}</style>'
 if candidate:
  styles+='<style>'+(ROOT/CANDIDATE).read_text(encoding='utf-8')+'</style>'
 buttons=''.join('<button class="nav-btn'+(' active' if key=='moments' else '')+
  '" type="button"'+(' aria-current="page"' if key=='moments' else '')+
  '><svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20"><circle cx="12" cy="12" r="8"/></svg><span>'+name+'</span></button>'
  for key,name in labels)
 return ('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  styles+'<style>body{margin:0;min-height:100vh}.nav-btn svg{flex:none;width:20px;height:20px}.bottom-nav{bottom:10px}</style>'+
  '</head><body><div id="app"><main class="living-moments">Prueba sintética de barra inferior</main></div>'+
  '<nav class="bottom-nav" aria-label="Navegación principal">'+buttons+'</nav></body></html>')

METRICS=r"""() => {
 const nav=document.querySelector('.bottom-nav'), n=nav.getBoundingClientRect();
 return {viewport:innerWidth,left:n.left,right:n.right,
  labels:[...nav.querySelectorAll('.nav-btn')].map(button=>{
   const label=button.querySelector('span'),b=button.getBoundingClientRect(),r=label.getBoundingClientRect();
   const style=getComputedStyle(label),range=document.createRange();range.selectNodeContents(label);
   const lines=[...range.getClientRects()];
   const inside=lines.every(x=>x.left>=b.left-1&&x.right<=b.right+1&&x.top>=b.top-1&&x.bottom<=b.bottom+1);
   return {text:label.textContent,buttonWidth:b.width,buttonHeight:b.height,lineCount:lines.length,
    whiteSpace:style.whiteSpace,textOverflow:style.textOverflow,overflow:style.overflowX,inside,
    pass:b.width>=44&&b.height>=44&&r.height>0&&lines.length<=2&&inside&&style.textOverflow!=='ellipsis'&&style.overflowX==='visible'};
  })
 };
}"""

def main():
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('--out',required=True,type=Path)
 args=parser.parse_args()
 out=args.out.resolve()
 if out.is_relative_to((ROOT/'android').resolve()):
  raise SystemExit('Blocked: browser evidence must not write into Android assets')
 chromium=next((shutil.which(n) for n in ('chromium','google-chrome','chromium-browser') if shutil.which(n)),None)
 if not chromium: raise SystemExit('Blocked: Chromium unavailable; not a PASS')
 out.mkdir(parents=True,exist_ok=True)
 results=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=chromium,headless=True,args=['--no-sandbox'])
  for candidate in (False,True):
   markup=fixture(candidate)
   for width in WIDTHS:
    for theme in THEMES:
     page=browser.new_page(viewport={'width':width,'height':720},device_scale_factor=1,is_mobile=True,has_touch=True)
     page.set_content(markup,wait_until='load')
     page.evaluate('(theme)=>{document.documentElement.dataset.theme=theme;document.documentElement.style.webkitTextSizeAdjust="135%"}',theme)
     metrics=page.evaluate(METRICS)
     passed=(len(metrics['labels'])==6 and metrics['viewport']==width and metrics['left']>=-1 and
      metrics['right']<=width+1 and all(l['pass'] for l in metrics['labels']))
     results.append({'candidate':candidate,'width':width,'theme':theme,'passed':passed,'metrics':metrics})
     if theme=='cosmic':
      page.screenshot(path=str(out/('nav-'+str(width)+('-candidate' if candidate else '-baseline')+'.png')))
     page.close()
  browser.close()
 (out/'matrix.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
 before=sum(r['passed'] for r in results if not r['candidate'])
 after=sum(r['passed'] for r in results if r['candidate'])
 print(f'Chromium baseline: {before}/28; CSS candidate: {after}/28. Evidence: {out/"matrix.json"}')
 if after!=28: raise SystemExit('FAIL: full-label, <=2-line, >=44px or viewport gate not met')
 print('PASS — OFFLINE CHROMIUM ONLY; Android WebView textZoom=135 remains unverified.')

if __name__=='__main__': main()
