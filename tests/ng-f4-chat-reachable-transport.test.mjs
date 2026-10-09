import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync('android/app/src/main/assets/mobile/app.js','utf8');
const begin=app.indexOf('const CHAT_BACKEND_REACHABLE_GRACE_MS=45_000;');
const end=app.indexOf('const api=(action,payload={})=>{',begin);
assert.ok(begin>=0&&end>begin,'Chat reachability helper must precede API wrapper.');
const helper=app.slice(begin,end);
function connected({paired=true,webviewOnline=false,lastSuccess=0,now=100000}={}){
 return vm.runInNewContext(helper+
  '\nlastSuccessfulApiAt='+String(lastSuccess)+';chatTransportCanSend('+String(now)+');',
  {native:{paired},navigator:{onLine:webviewOnline}});
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
