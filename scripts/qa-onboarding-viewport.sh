#!/usr/bin/env bash
set -euo pipefail
mkdir -p qa-artifacts/ng-aud-003
trap '
  adb logcat -d > qa-artifacts/ng-aud-003/logcat.txt 2>/dev/null || true
  for side in portrait landscape; do
    adb pull "/sdcard/Download/NG-AUD-003-onboarding-${side}.png" "qa-artifacts/ng-aud-003/${side}.png" >/dev/null 2>&1 || true
    adb shell rm -f "/sdcard/Download/NG-AUD-003-onboarding-${side}.png" >/dev/null 2>&1 || true
  done
' EXIT
adb logcat -c
gradle -p android --no-daemon :app:connectedDebugAndroidTest \
  -PQA_EDGE_URL=http://127.0.0.1:18765 \
  -PQA_SUPABASE_PUBLISHABLE_KEY=qa_phase4_onboarding \
  -PQA_APPLICATION_SUFFIX=.onboardingqa \
  '-Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyOnboardingViewportTest' \
  2>&1 | tee qa-artifacts/ng-aud-003/instrumentation.txt

# An Android JUnit XML run that skipped the actual test is not a viewport PASS.
python3 - <<'PY'
import glob
from xml.etree import ElementTree as ET
files=glob.glob("android/app/build/outputs/androidTest-results/**/*.xml",recursive=True)
found=[]
for file in files:
  for e in ET.parse(file).getroot().iter("testcase"):
    if "GalaxyOnboardingViewportTest" in e.attrib.get("classname",""):
      found.append((e.attrib.get("name"), any(e.find(tag) is not None for tag in ("skipped","failure","error"))))
assert len(found)==1 and found[0][0].startswith("unpairedPortraitLandscape_") and not found[0][1], f"NG-AUD-003 NOT VERIFIED: {found}"
print("NG_AUD_003_JUNIT_VERIFIED=1")
PY

# Verify the actual screenshots are painted, not just the DOM/JUnit result.
for side in portrait landscape; do
  adb pull "/sdcard/Download/NG-AUD-003-onboarding-${side}.png" "qa-artifacts/ng-aud-003/${side}.png"
done
python3 scripts/qa-onboarding-image-check.py qa-artifacts/ng-aud-003/portrait.png qa-artifacts/ng-aud-003/landscape.png | tee qa-artifacts/ng-aud-003/screenshot-proof.txt
