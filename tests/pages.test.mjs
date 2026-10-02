import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
test('Pages build supports project subpaths and never publishes server data',()=>{
 execFileSync(process.execPath,['scripts/build-pages.mjs'],{cwd:root,env:{...process.env,CI:'',SUPABASE_URL:'',SUPABASE_PUBLISHABLE_KEY:'',SUPABASE_ANON_KEY:''}});
 const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../dist/app.js',import.meta.url),'utf8');
 assert.ok(!html.includes('src="/'));
 assert.ok(!js.includes('href="/'));
 assert.ok(js.includes('const api=cloudApi'));
 // Every local module imported by the published shell must be deployed.
 for(const file of ['app.js','cloud.js','install.js','theme.js']){
  const source=readFileSync(new URL('../dist/'+file,import.meta.url),'utf8');
  for(const match of source.matchAll(/from ['"]\.\/([^'"?]+)(?:\?[^'"]*)?['"]/g)){
   assert.ok(existsSync(new URL('../dist/'+match[1],import.meta.url)),`${file} imports missing ${match[1]}`);
  }
 }
 execFileSync(process.execPath,['--check','dist/app.js'],{cwd:root});
 execFileSync(process.execPath,['--check','dist/cloud.js'],{cwd:root});
 const secret=spawnSync(process.execPath,['scripts/build-pages.mjs'],{cwd:root,env:{...process.env,CI:'',SUPABASE_PUBLISHABLE_KEY:'sb_secret_test'}});
 assert.notEqual(secret.status,0);
});
