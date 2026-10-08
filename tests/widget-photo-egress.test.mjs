import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const java=(path)=>readFileSync(new URL('../android/app/src/main/java/com/nuestragalaxia/companion/'+path,import.meta.url),'utf8');

test('widget photo reuse compares signed URL pathname, not rotating query token',()=>{
 const worker=java('BondWorker.java'),store=java('BondStore.java');
 assert.match(worker,/if\(bond\.photoFresh\(remote\.getPath\(\)\)\)return;/);
 assert.match(worker,/bond\.photoFetched\(remote\.getPath\(\)\)/);
 assert.match(store,/sourcePath\.equals\(prefs\.getString\("photoSourcePath",""\)\)/);
 assert.match(store,/photo\(\)\.isFile\(\)/);
 assert.match(store,/photo\(\)\.length\(\)<=0/);
 assert.match(store,/PHOTO_REVALIDATE_MILLIS=12L\*60L\*60L\*1000L/);
});

test('widget privacy clearing removes source key and any cached photo',()=>{
 const worker=java('BondWorker.java'),store=java('BondStore.java');
 assert.match(worker,/bond\.clearPhoto\(\)/);
 assert.match(store,/remove\("photoSourcePath"\)\.remove\("photoFetchedAt"\)/);
 assert.match(store,/public void clear\(\)\{prefs\.edit\(\)\.clear\(\)\.apply\(\);photo\(\)\.delete\(\)/);
});

test('QA debug signed photo origin matches the isolated Edge endpoint',()=>{
 const gradle=readFileSync(new URL('../android/app/build.gradle.kts',import.meta.url),'utf8');
 assert.ok(gradle.includes('val qaOrigin = qaEdgeUrl.substringBefore("/functions/v1/")'));
 assert.ok(gradle.includes('buildConfigField("String","SUPABASE_URL"'));
 assert.ok(gradle.includes('vwtcncvmwjfywrzjmskw.supabase.co'));

});
