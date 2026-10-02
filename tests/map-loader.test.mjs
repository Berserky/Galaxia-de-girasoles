import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapLoader} from '../app/public/map-loader.js';
test('locations render while history is still pending; overlapping refreshes reuse requests',async()=>{
 let release;const slow=new Promise(r=>release=r),updates=[],calls=[];
 const loader=createMapLoader({request:async url=>{calls.push(url);return url==='/api/map/history'?slow:[url];},update:(key,data)=>updates.push(key)});
 const first=loader.load();await new Promise(r=>setImmediate(r));
 assert.ok(updates.includes('locations'));assert.ok(!updates.includes('history'));
 const second=loader.load();assert.equal(calls.filter(x=>x==='/api/locations').length,1);
 release([]);await Promise.all([first,second]);assert.ok(updates.includes('history'));
 await loader.load();assert.equal(calls.filter(x=>x==='/api/map/history').length,1);
});
test('one failed resource does not discard successful locations and can retry',async()=>{
 let fails=true;const updates=[],errors=[];
 const loader=createMapLoader({request:async url=>{if(url==='/api/map/places'&&fails)throw Error('offline');return [];},update:key=>updates.push(key),onError:(key)=>errors.push(key)});
 await loader.load();assert.ok(updates.includes('locations'));assert.deepEqual(errors,['places']);
 fails=false;await loader.load();assert.ok(updates.includes('places'));
});
test('late responses after leaving the map cannot update the next view',async()=>{
 let active=true,release;const slow=new Promise(r=>release=r),updates=[];
 const loader=createMapLoader({request:()=>slow,active:()=>active,update:key=>updates.push(key)});
 const pending=loader.load();active=false;release([]);await pending;assert.deepEqual(updates,[]);
});
test('a request that never finishes times out without blocking future retries',async()=>{
 const errors=[];let calls=0;
 const loader=createMapLoader({request:()=>{calls++;return new Promise(()=>{});},update:()=>{},onError:key=>errors.push(key),timeout:5});
 await loader.load();assert.equal(errors.length,8);await loader.load();assert.equal(calls,16);
});
