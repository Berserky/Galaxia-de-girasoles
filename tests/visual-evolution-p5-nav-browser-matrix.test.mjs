import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const source=readFileSync(resolve(root,'scripts/p5-nav-135-browser-audit.py'),'utf8');

test('P5 #176 browser matrix: script uses the shipped navigation source and original CSS',()=>{
 for(const file of [
  'app.js','app.css','celestial-shell.css','galaxy-moments-v5.css',
  'nav-p5-textzoom-135.css'
 ]) assert.ok(source.includes(file),file);
 assert.match(source,/navigation contract absent/i);
 assert.match(source,/Navigation destinations changed/);
});
test('P5 #176 browser matrix: four mobile widths, seven themes, 135% font and six controls',()=>{
 assert.match(source,/WIDTHS=\(320,360,393,412\)/);
 assert.match(source,/THEMES=\('daylight','cosmic','halloween','christmas','valentine','friendship','easter'\)/);
 assert.match(source,/1\.35 \* clamp/);
 assert.match(source,/len\(metrics\['labels'\]\)==6/);
 assert.match(source,/after!=28/);
});
test('P5 #176 browser matrix: physical bounds, legible wrap and 44px target are strict failures',()=>{
 assert.match(source,/b\.width>=44&&b\.height>=44/);
 assert.match(source,/lines\.length<=2&&inside/);
 assert.match(source,/style\.textOverflow!=='ellipsis'/);
 assert.match(source,/style\.overflowX==='visible'/);
 assert.match(source,/metrics\['right'\]<=width\+1/);
 assert.match(source,/raise SystemExit\('FAIL:/);
});
test('P5 #176 browser matrix: standalone QA refuses Android path writes and never claims WebView',()=>{
 assert.match(source,/out\.is_relative_to\(\(ROOT\/'android'\)\.resolve\(\)\)/);
 assert.match(source,/Blocked: browser evidence must not write into Android assets/);
 assert.match(source,/Android WebView textZoom=135 remains unverified/);
 assert.doesNotMatch(source,/subprocess\.run|requests\.get|urlopen|urllib\.request|pip install/);
});
test('P5 #176 browser matrix: Python syntax compiles without needing third-party imports',t=>{
 const result=spawnSync('python3',['-c',"import sys;compile(sys.stdin.read(),'p5-nav-browser-audit.py','exec')"],{
  input:source,encoding:'utf8',timeout:10000
 });
 if(result.error?.code==='ENOENT'){t.skip('python3 unavailable on runner');return;}
 assert.equal(result.status,0,result.stderr);
});
