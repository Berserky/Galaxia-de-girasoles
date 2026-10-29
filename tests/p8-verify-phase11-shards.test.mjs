import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const source=resolve(root,'android/app/src/androidTest/java/com/nuestragalaxia/companion');
const classes=['GalaxyDeviceClosureTest','GalaxyMediaExperienceTest','GalaxyVoiceMessagesDeviceTest'];
const testNames=name=>[...readFileSync(join(source,name+'.java'),'utf8').matchAll(/@Test\s+public\s+void\s+(\w+)\s*\(/g)].map(x=>x[1]);
const xml=rows=>'<?xml version="1.0"?><testsuites tests="'+rows.length+'" failures="0" errors="0" skipped="0"><testsuite tests="'+rows.length+'">'+rows.map(([n,t])=>'<testcase classname="com.nuestragalaxia.companion.'+n+'" name="'+t+'" time="1"/>').join('')+'</testsuite></testsuites>';
const make=(dir,which,rows)=>{
 const p=join(dir,which);mkdirSync(p,{recursive:true});writeFileSync(join(p,'TEST-emulator.xml'),xml(rows));
};
const exec=dir=>spawnSync(process.execPath,['scripts/p8-verify-phase11-shards.mjs',dir],{cwd:root,encoding:'utf8'});
test('P8 Phase11 JUnit closure matches exactly-once coverage across two fresh AVD shards',()=>{
 const dir=mkdtempSync(join(tmpdir(),'p8-shards-'));
 try{
  const names=testNames(classes[0]),med=classes.slice(1).flatMap(n=>testNames(n).map(t=>[n,t]));
  assert.equal(names.length,27,'P8 closure source count must be explicit');
  make(dir,'closure-0',names.filter((_,i)=>i%2===0).map(n=>[classes[0],n]));
  make(dir,'closure-1',names.filter((_,i)=>i%2===1).map(n=>[classes[0],n]));
  make(dir,'media',med);
  let r=exec(dir);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const receipt=JSON.parse(readFileSync(join(dir,'receipt.json'),'utf8'));
  assert.equal(receipt.coverage,'EXACTLY_ONCE');
  assert.equal(receipt.total,names.length+med.length);
  assert.equal(receipt.skipped,0);
  // Removing a real method must fail closed, even if all JUnit shards exited 0.
  make(dir,'closure-1',names.filter((_,i)=>i%2===1&&i!==1).map(n=>[classes[0],n]));
  r=exec(dir);
  assert.notEqual(r.status,0,'Missing native test must block phase11');
  // A duplicate across shards must never produce an approved receipt.
  make(dir,'closure-1',[...names.filter((_,i)=>i%2===1).map(n=>[classes[0],n]),[classes[0],names[0]]]);
  r=exec(dir);
  assert.notEqual(r.status,0,'Duplicated native test must block phase11');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('P8 Phase11 CI runs both closure shards in fresh AVD sessions',()=>{
 const workflow=readFileSync(join(root,'.github/workflows/chat-4-phase11-torture.yml'),'utf8');
 assert.match(workflow,/fresh AVD shard 0\/2/);
 assert.match(workflow,/fresh AVD shard 1\/2 plus media/);
 assert.equal((workflow.match(/reactivecircus\/android-emulator-runner@v2/g)||[]).length,2);
 assert.match(workflow,/shardIndex=0/);
 assert.match(workflow,/shardIndex=1/);
 assert.match(workflow,/numShards=2/);
 assert.match(workflow,/node scripts\/p8-verify-phase11-shards.mjs/);
 assert.match(workflow,/qa-artifacts\/phase11-shards\/\*\*/);
});
