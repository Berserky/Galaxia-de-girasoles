#!/usr/bin/env node
// Consolidated Android Phase11 receipt. Never infer success from workflow exit
// alone: exactly-once JUnit case coverage is mandatory across fresh AVD shards.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';

const base=process.argv[2]||'qa-artifacts/phase11-shards';
const android='android/app/src/androidTest/java/com/nuestragalaxia/companion';
const classes=['GalaxyDeviceClosureTest','GalaxyMediaExperienceTest','GalaxyVoiceMessagesDeviceTest'];
const expected=new Map();
for(const name of classes){
 const java=readFileSync(join(android,name+'.java'),'utf8');
 const tests=[...java.matchAll(/@Test\s+public\s+void\s+(\w+)\s*\(/g)].map(m=>m[1]);
 assert.ok(tests.length>0,'No source tests for '+name);
 for(const t of tests)assert.ok(!expected.has(name+'.'+t),'Duplicate Java test '+t);
 expected.set(name,new Set(tests));
}
function readShard(shard){
 const dir=join(base,shard);
 const files=readdirSync(dir).filter(n=>/^TEST-.*\.xml$/.test(n));
 assert.ok(files.length>0,'Missing real Android JUnit files for '+shard);
 const records=[];
 for(const file of files){
  const xml=readFileSync(join(dir,file),'utf8');
  assert.ok(/<testsuites\b/.test(xml),'Not an Android JUnit document: '+file);
  const top=xml.match(/<testsuites\b([^>]*)>/)?.[1]||'';
  for(const key of ['failures','errors','skipped']){
   const count=Number(top.match(new RegExp(key+'="(\\d+)"'))?.[1]||0);
   assert.equal(count,0,shard+' JUnit '+key+' must be 0');
  }
  const matches=[...xml.matchAll(/<testcase\b([^>]*)>/g)];
  for(const m of matches){
   const attrs=m[1],name=attrs.match(/\bname="([^"]+)"/)?.[1];
   const classname=attrs.match(/\bclassname="([^"]+)"/)?.[1]||'';
   assert.ok(name&&classname,'Invalid JUnit case');
   const className=classname.split('.').at(-1);
   assert.ok(classes.includes(className),'Unexpected Android class in '+shard+': '+className);
   records.push({className,name});
  }
 }
 assert.ok(records.length,'Empty JUnit shard '+shard);
 return records;
}
const rows={
 'garden':readShard('garden'),
 'closure-0':readShard('closure-0'),
 'closure-1':readShard('closure-1'),
 'media':readShard('media')
};
assert.equal(rows.garden.length,1,'Dedicated garden AVD must execute exactly one real Android testcase');
const seen=new Set();
for(const [shard,records] of Object.entries(rows)){
 for(const {className,name} of records){
  if(shard==='garden'){
   assert.equal(className,'GalaxyDeviceClosureTest','Dedicated garden must run real Android Closure class');
   assert.equal(name,'visualEvolutionP5_realMomentsAndroidScreens_andPrivacy','Dedicated garden must run the full native visual test');
  }else if(shard.startsWith('closure-')){
   assert.equal(className,'GalaxyDeviceClosureTest','Wrong Closure shard class');
   assert.notEqual(name,'visualEvolutionP5_realMomentsAndroidScreens_andPrivacy','Garden test must not run twice');
  }
  else assert.notEqual(className,'GalaxyDeviceClosureTest','Closure test duplicated in media shard');
  const key=className+'.'+name;
  assert.ok(!seen.has(key),'Duplicate Android JUnit case: '+key);
  assert.ok(expected.get(className).has(name),'Unknown Android JUnit case: '+key);
  seen.add(key);
 }
}
for(const [name,names] of expected){
 const missing=[...names].filter(t=>!seen.has(name+'.'+t));
 assert.deepEqual(missing,[],'Unexecuted Android tests in '+name);
}
const receipt={status:'VERIFIED_REAL_ANDROID',coverage:'EXACTLY_ONCE',shards:Object.fromEntries(
 Object.entries(rows).map(([key,cases])=>[key,cases.length])),total:seen.size,
 sourceTests:Object.fromEntries([...expected].map(([k,v])=>[k,v.size])),failures:0,errors:0,skipped:0};
mkdirSync(base,{recursive:true});
writeFileSync(join(base,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('GALAXY_P8_PHASE11_ANDROID='+JSON.stringify(receipt));
