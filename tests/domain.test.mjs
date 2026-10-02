import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {mediaLink,validDate,validateItem,folderId,ics,today} from '../app/domain.mjs';
import {seal,unseal} from '../app/google.mjs';
import {openStore} from '../app/store.mjs';
import {nextOccurrence} from '../app/public/dates.js';
test('yearly dates handle leap days and future first occurrences',()=>{
 assert.equal(nextOccurrence('2024-02-29',true,'2026-10-01'),'2028-02-29');
 assert.equal(nextOccurrence('2028-05-01',true,'2026-10-01'),'2028-05-01');
 assert.equal(nextOccurrence('2020-10-01',true,'2026-10-01'),'2026-10-01');
});
test('dates reject impossible dates and preserve Bogotá day boundaries',()=>{
 assert.equal(validDate('2025-02-29'),false);assert.equal(validDate('2024-02-29'),true);
 assert.equal(today(new Date('2026-10-02T02:00:00Z')),'2026-10-01');
 assert.throws(()=>validateItem({kind:'event',title:'Cumpleaños',date:'2026-02-31'}));
});
test('music URLs normalize only supported provider formats',()=>{
 assert.equal(mediaLink('https://open.spotify.com/intl-es/track/1234567890123456789012?si=test').provider,'Spotify');
 assert.equal(mediaLink('https://youtu.be/abcdefghijk?t=22').embed,'https://www.youtube-nocookie.com/embed/abcdefghijk');
 for(const url of ['javascript:alert(1)','https://evil.test/track/1234567890123456789012','https://open.spotify.com.evil.test/track/1234567890123456789012','https://x@open.spotify.com/track/1234567890123456789012','https://youtu.be/x'])assert.throws(()=>mediaLink(url));
});
test('Drive folder selection rejects unrelated hosts',()=>{
 assert.equal(folderId('https://drive.google.com/drive/u/0/folders/abcdefghijk'),'abcdefghijk');
 assert.throws(()=>folderId('https://evil.test/folders/abcdefghijk'));
});
test('tokens authenticate encrypted bytes and cannot be read with a different key',()=>{
 const key=randomBytes(32),value={access_token:'secret',refresh_token:'never public'},encrypted=seal(value,key);
 assert.deepEqual(unseal(encrypted,key),value);assert.ok(!encrypted.includes('secret'));
 assert.throws(()=>unseal(encrypted,randomBytes(32)));
});
test('calendar export escapes content and supports yearly recurrence',()=>{
 const result=ics([{id:'abc',data:{date:'2026-10-03',title:'Nosotros; tú, yo',body:'Una\nlínea',annual:true}}]);
 assert.match(result,/RRULE:FREQ=YEARLY/);assert.match(result,/DTSTART;VALUE=DATE:20261003/);assert.match(result,/Nosotros\\; tú\\, yo/);assert.ok(result.endsWith('\r\n'));
});
test('shared storage persists across restarts and rejects stale updates',()=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'galaxia-test-'));let store=openStore(dir);
 try {assert.equal(store.list().length,6);const data=validateItem({kind:'plan',title:'Una caminata'});const id=store.add(data,'0');store.update(id,{...data,done:true},1);assert.throws(()=>store.update(id,data,1),/cambió/);assert.throws(()=>store.remove(id,1),/cambió/);store.close();store=openStore(dir);assert.equal(store.list().find(i=>i.id===id).data.done,true);assert.equal(store.list().length,7);}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});

test('connected universe validates capsules wishes journeys and geotags',()=>{
 const capsule=validateItem({kind:'capsule',title:'Para después',body:'Hola futuro',unlockDate:'2027-01-01'});assert.equal(capsule.unlockDate,'2027-01-01');
 const wish=validateItem({kind:'wish',title:'Conocer un lugar',latitude:'4.65',longitude:'-74.08',placeName:'Bogotá'});assert.equal(wish.placeName,'Bogotá');assert.equal(wish.latitude,4.65);
 const journey=validateItem({kind:'journey',title:'Viaje',date:'2026-10-10',endDate:'2026-10-12'});assert.equal(journey.endDate,'2026-10-12');
 assert.throws(()=>validateItem({kind:'capsule',title:'Sin fecha'}));assert.throws(()=>validateItem({kind:'journey',title:'Al revés',date:'2026-10-12',endDate:'2026-10-10'}));
});
