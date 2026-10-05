import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('renewed Android layout keeps every interactive control used by the activity',()=>{
 const activity=read('android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java');
 const layout=read('android/app/src/main/res/layout/activity_main.xml');
 const referenced=[...activity.matchAll(/R\.id\.(\w+)/g)].map(m=>m[1]);
 for(const id of new Set(referenced))assert.ok(layout.includes('@+id/'+id),id+' must stay in the layout');
});

test('stable update metadata is derived from the Android package version',()=>{
 const gradle=read('android/app/build.gradle.kts');
 const candidate=read('.github/workflows/android-release-candidate.yml');
 const stable=read('.github/workflows/android-release-stable.yml');
 const code=Number(gradle.match(/versionCode = (\d+)/)[1]);
 const name=gradle.match(/versionName = "([^"]+)"/)[1];
 assert.ok(candidate.includes("VERSION_CODE=$(printf '%s'")&&candidate.includes('versionCode = ([0-9]+)'));
 assert.ok(candidate.includes('VERSION_NAME=$(printf')&&candidate.includes('versionName = "([^"]+)"'));
 assert.ok(stable.includes('versionCode:$versionCode')&&stable.includes('versionName:$versionName'));
 assert.ok(code>2&&name.length>0,'existing signed installs must detect this update');
});
