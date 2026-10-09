import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');
const begin=app.indexOf('const CHAT_BACKEND_REACHABLE_GRACE_MS=45_000;');
const end=app.indexOf('const api=(action,payload={})=>{',begin);
assert.ok(begin>=0&&end>begin,'Chat reachability helper must precede API wrapper.');
const helper=app.slice(begin,end);
function connected({paired=true,person='0',proofPerson=person,webviewOnline=false,lastSuccess=0,now=100000}={}){
 return vm.runInNewContext(helper+
  '\nlastSuccessfulApiAt='+String(lastSuccess)+';lastSuccessfulApiPerson='+JSON.stringify(proofPerson)+';chatTransportCanSend('+String(now)+');',
  {native:{paired,person},navigator:{onLine:webviewOnline}});
}
test('recent real backend response overrides Chromium false-offline for paired device',()=>{
 assert.equal(connected({lastSuccess:99000}),true);
 assert.equal(connected({lastSuccess:100}),false);
});
test('offline remains fail-closed without recent positive evidence',()=>{
 assert.equal(connected({lastSuccess:0}),false);
 assert.equal(connected({lastSuccess:1000}),false);
 assert.equal(connected({lastSuccess:100001}),false);
});
test('unpaired device never drains private outbox',()=>{
 assert.equal(connected({paired:false,webviewOnline:true,lastSuccess:99000}),false);
 assert.equal(connected({paired:false,lastSuccess:99000}),false);
});
test('paired WebView explicitly online retains original transport behavior',()=>{
 assert.equal(connected({webviewOnline:true}),true);
});
test('an authenticated response from another profile never unlocks a new profile outbox',()=>{
 assert.equal(connected({person:'1',proofPerson:'0',lastSuccess:99000}),false);
 assert.equal(connected({person:'0',proofPerson:'1',lastSuccess:99000}),false);
 assert.equal(connected({person:'1',proofPerson:'1',lastSuccess:99000}),true);
 assert.equal(connected({person:'',proofPerson:'',lastSuccess:99000}),false);
});
test('native pairing and profile changes revoke stale proof before any delayed delivery',()=>{
 assert.match(app,/if\(!data\.paired\|\|String\(data\.person\?\?''\)!==String\(native\?\.person\?\?''\)\)/);
 assert.match(app,/lastSuccessfulApiAt=0;lastSuccessfulApiPerson=''/);
 assert.match(app,/lastSuccessfulApiPerson=String\(native\.person\)/);
});
test('API ack, chat-state wakeup, presence display and delivery agree on connectivity evidence',()=>{
 assert.match(app,/lastSuccessfulApiAt=Date\.now\(\)/);
 assert.match(app,/action==='chat-state'&&navigator\.onLine===false&&chatDeliveryEngine\?\.snapshot\?\.\(\)\.pending>0/);
 assert.match(app,/online:\(\)=>chatTransportCanSend\(\)/);
 assert.match(app,/if\(!chatTransportCanSend\(\)\)\{const pending/);
});

test('Java 17 Windows Cp1252 cannot corrupt Android instrumentation Spanish and ETA literals',()=>{
 const gradle=readFileSync('android/app/build.gradle.kts','utf8');
 assert.match(gradle,/tasks\.withType<org\.gradle\.api\.tasks\.compile\.JavaCompile>\(\)\.configureEach \{ options\.encoding = "UTF-8" \}/);
});
