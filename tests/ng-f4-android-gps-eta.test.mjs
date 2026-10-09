import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const android=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java','utf8');
const backend=readFileSync('android/app/src/androidTest/java/com/nuestragalaxia/companion/QaHttpServer.java','utf8');

test('Android ETA QA harness exercises live and failure-state UI in real WebView',()=>{
  const start=android.indexOf('gpsEta_onAndroidMapShowsLivePausedStaleAndOfflineStates');
  const end=android.indexOf('@Test public void notificationDeepLink_',start);
  assert.ok(start>0&&end>start);
  const testcase=android.slice(start,end);
  for(const v of ['EtaScenario.LIVE','EtaScenario.PARTNER_PAUSED','EtaScenario.OWN_STALE','EtaScenario.OFFLINE','GALAXY_F4_GPS_ETA=VERIFIED'])
    assert.ok(testcase.includes(v),v);
  assert.match(testcase,/refreshMap\(\{quiet:false,detail:true\}\)/);
  assert.match(testcase,/#etaCard \.eta-value strong/);
  assert.match(backend,/private volatile EtaScenario etaScenario = EtaScenario.DEFAULT/);
  assert.match(backend,/\.put\("destinations"/);
  assert.match(backend,/\.put\("target_person","0"\.equals\(person\)\?"1":"0"\)/);
  assert.doesNotMatch(testcase,/https?:\/\/[^\s]*supabase\.co/);
});
