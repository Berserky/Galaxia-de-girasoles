#!/usr/bin/env bash
set -euo pipefail

: "${QA_STAGING_TOKEN_0:?Missing OIDC QA token 0}"
: "${QA_STAGING_TOKEN_1:?Missing OIDC QA token 1}"
: "${QA_STAGING_EDGE_URL:?Missing QA staging endpoint}"
test "$QA_STAGING_EDGE_URL" = "https://vwtcncvmwjfywrzjmskw.supabase.co/functions/v1/android-companion"
test "$QA_STAGING_TOKEN_0" != "$QA_STAGING_TOKEN_1"

mkdir -p candidate-evidence/fcm-live
cp musica.mp3 android/app/src/main/assets/musica.mp3
# Never run with -x, print or persist ephemeral device/FCM credentials.
gradle -p android --no-daemon :app:connectedDebugAndroidTest \
  "-PQA_EDGE_URL=$QA_STAGING_EDGE_URL" \
  "-PQA_SUPABASE_PUBLISHABLE_KEY=$QA_STAGING_PUBLISHABLE_KEY" \
  "-Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyFcmTransportQaTest" \
  "-Pandroid.testInstrumentationRunnerArguments.ngQaToken0=$QA_STAGING_TOKEN_0" \
  "-Pandroid.testInstrumentationRunnerArguments.ngQaToken1=$QA_STAGING_TOKEN_1" \
  > /tmp/ng-f4-fcm-gradle.log 2>&1 && BUILD_PASS=1 || BUILD_PASS=0

# Sanitize ephemeral credentials before exporting any CI diagnostics.
node --input-type=module <<'NODE'
import fs from 'node:fs';
let s=fs.readFileSync('/tmp/ng-f4-fcm-gradle.log','utf8');
for(const token of [process.env.QA_STAGING_TOKEN_0,process.env.QA_STAGING_TOKEN_1]){
  if(token)s=s.split(token).join('[REDACTED_QA_TOKEN]');
}
fs.writeFileSync('candidate-evidence/fcm-live/gradle-redacted.log',s.slice(-150_000));
NODE
if [ "$BUILD_PASS" != 1 ]; then
  echo 'FAIL: QA Firebase transport instrumentation failed (credentials redacted in CI artifact).'
  exit 1
fi

python3 - <<'PY'
from pathlib import Path
from xml.etree import ElementTree as ET
files=list(Path('android/app/build/outputs/androidTest-results/connected').rglob('TEST-*.xml'))
cases=[]
for p in files:
    root=ET.parse(p).getroot()
    for c in root.iter('testcase'):
        if 'GalaxyFcmTransportQaTest' in (c.attrib.get('classname','')+' '+c.attrib.get('name','')):
            cases.append(c)
if len(cases)!=1:
    raise SystemExit(f'FCM QA gate expected exactly 1 executed instrumentation case, got {len(cases)}')
case=cases[0]
if any(case.find(x) is not None for x in ('skipped','failure','error')):
    raise SystemExit('FCM QA live gate was skipped or failed')
print('F4_FCM_LIVE_GATE=VERIFIED')
PY
