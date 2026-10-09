import assert from 'node:assert/strict';

const PROD_REF='zqiknzivfahvvadmxrvt';
const endpoint=process.env.QA_STAGING_EDGE_URL||'';
const apiKey=process.env.QA_STAGING_PUBLISHABLE_KEY||'';
const token0=process.env.QA_STAGING_TOKEN_0||'';
const token1=process.env.QA_STAGING_TOKEN_1||'';

function required(){
  const missing=[];
  if(!endpoint)missing.push('QA_STAGING_EDGE_URL');
  if(!apiKey)missing.push('QA_STAGING_PUBLISHABLE_KEY');
  if(!token0)missing.push('QA_STAGING_TOKEN_0');
  if(!token1)missing.push('QA_STAGING_TOKEN_1');
  return missing;
}

const missing=required();
if(missing.length){
  console.log('NOT_EXECUTED: remote staging missing '+missing.join(', '));
  process.exit(78);
}
if(endpoint.includes(PROD_REF)){
  console.error('BLOCKED: QA staging endpoint resolves to the production Supabase project.');
  process.exit(2);
}
// QA device tokens must never be posted to an arbitrary host, even by mistake.
const QA_REF='vwtcncvmwjfywrzjmskw';
let stagingUrl;
try { stagingUrl=new URL(endpoint); }
catch { console.error('BLOCKED: QA staging URL is invalid.'); process.exit(2); }
if(stagingUrl.protocol!=='https:' ||
    stagingUrl.hostname!==QA_REF+'.supabase.co' ||
    stagingUrl.pathname!=='/functions/v1/android-companion' ||
    stagingUrl.username || stagingUrl.password || stagingUrl.search || stagingUrl.hash) {
  console.error('BLOCKED: staging must be the exact QA Supabase Edge endpoint.');
  process.exit(2);
}
if(token0===token1) {
  console.error('BLOCKED: QA member tokens 0 and 1 must be distinct.');
  process.exit(2);
}

async function api(token,body){
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'content-type':'application/json','apikey':apiKey,'x-device-token':token},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(20_000)
  });
  const text=await response.text();
  let data={};try{data=text?JSON.parse(text):{};}catch{}
  if(!response.ok)throw new Error((data.error||text||('HTTP '+response.status)).slice(0,300));
  return data;
}
const contains=(state,body)=>(state.messages||[]).some(m=>m.body===body&&!m.deleted_at);
async function waitVisible(token,a,b){
  const stop=Date.now()+20_000;
  while(Date.now()<stop){
    const state=await api(token,{action:'chat-state',limit:60});
    if(contains(state,a)&&contains(state,b))return state;
    await new Promise(r=>setTimeout(r,500));
  }
  throw new Error('Realtime propagation did not expose both concurrent messages within 20s.');
}

const stamp=Date.now().toString(36);
const body0='[QA5 '+stamp+'] dual-user-0';
const body1='[QA5 '+stamp+'] dual-user-1';
let id0='',id1='';
try{
  const [s0,s1]=await Promise.all([
    api(token0,{action:'mobile-state'}),
    api(token1,{action:'mobile-state'})
  ]);
  assert.equal(String(s0.person),'0','token 0 must resolve to profile 0');
  assert.equal(String(s1.person),'1','token 1 must resolve to profile 1');

  // QA-only preflight: verified public Firebase configuration for both ephemeral
  // sessions. Never print Firebase fields/tokens. This does NOT prove FCM transport.
  const pushConfigs=await Promise.all([
    api(token0,{action:'push-client-config'}),
    api(token1,{action:'push-client-config'})
  ]);
  for(const response of pushConfigs){
    assert.equal(response.available,true,'QA Firebase public client config unavailable');
    for(const key of ['projectId','senderId','applicationId','apiKey'])
      assert.ok(typeof response.config?.[key]==='string'&&response.config[key].length>0,
        'QA Firebase client config missing '+key);
  }
  assert.notEqual(String(pushConfigs[0].deviceId),String(pushConfigs[1].deviceId),
    'FCM bootstrap must resolve two distinct temporary devices');
  console.log('VERIFIED: QA Firebase client bootstrap (not FCM delivery)');

  const [r0,r1]=await Promise.all([
    api(token0,{action:'chat-send',clientId:crypto.randomUUID(),clientCreatedAt:new Date().toISOString(),body:body0,messageType:'text',attachments:[]}),
    api(token1,{action:'chat-send',clientId:crypto.randomUUID(),clientCreatedAt:new Date().toISOString(),body:body1,messageType:'text',attachments:[]})
  ]);
  id0=String(r0.message?.id||''); id1=String(r1.message?.id||'');
  assert.ok(id0&&id1,'both concurrent sends must return message ids');
  assert.notEqual(id0,id1,'concurrent messages must be distinct');

  await Promise.all([waitVisible(token0,body0,body1),waitVisible(token1,body0,body1)]);

  const [map0,map1,backup0]=await Promise.all([
    api(token0,{action:'map-state',detail:false}),
    api(token1,{action:'map-state',detail:false}),
    api(token0,{action:'backup-export'})
  ]);
  assert.ok(Array.isArray(map0.locations),'profile 0 map-state must be readable');
  assert.ok(Array.isArray(map1.locations),'profile 1 map-state must be readable');
  assert.ok(backup0.manifest||backup0.payload||backup0.schemaVersion,'backup-export must return a structured backup');

  console.log('VERIFIED: remote staging dual-user concurrency/realtime/map/backup');
} finally {
  const cleanup=[];
  if(id0)cleanup.push(api(token0,{action:'chat-delete',id:id0,scope:'both'}).catch(()=>null));
  if(id1)cleanup.push(api(token1,{action:'chat-delete',id:id1,scope:'both'}).catch(()=>null));
  await Promise.all(cleanup);
}
