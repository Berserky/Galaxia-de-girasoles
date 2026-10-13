#!/usr/bin/env bash
# V5-P1 Android QA. This script MUST run through bash, not /bin/sh.
# Only hermetic Android QA test accounts with localhost backend and suffix .v5p1qa.
set -euo pipefail

bash scripts/visual-evolution-p0-avd.sh

# Instrumentation is separated from the unpaired baseline. Failures retain
# any screenshots already produced for diagnosis; no production token is loaded.
mkdir -p build/p0-avd/p1-synthetic-themes
# Preserve partial theme captures even if instrumentation fails later.
# This runs only against the isolated QA emulator; screenshots are synthetic.
pull_theme_evidence() {
  for theme in daylight cosmic halloween christmas valentine friendship easter; do
    adb pull "/sdcard/Download/V5-P1-synthetic-${theme}.png" "build/p0-avd/p1-synthetic-themes/${theme}.png" >/dev/null 2>&1 || true
  done
}
trap pull_theme_evidence EXIT
gradle -p android --no-daemon :app:connectedDebugAndroidTest \
  -PQA_EDGE_URL=http://127.0.0.1:18765 \
  -PQA_SUPABASE_PUBLISHABLE_KEY=qa_v5p1 \
  -PQA_APPLICATION_SUFFIX=.v5p1qa \
  '-Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyDeviceClosureTest#visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe' \
  2>&1 | tee build/p0-avd/p1-device-instrumentation.log

grep 'V5_P1_ANDROID_SHELL=' build/p0-avd/p1-device-instrumentation.log > build/p0-avd/p1-device-summary.txt || true

pull_theme_evidence
trap - EXIT

python3 - <<'PY'
from pathlib import Path
import hashlib
paths=list(Path('build/p0-avd/p1-synthetic-themes').glob('*.png'))
assert len(paths)==7, f'Expected 7 synthetic QA Android screenshots, got {len(paths)}'
for path in paths:
    assert path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'), f'Invalid PNG: {path}'
unique=len(set(hashlib.sha256(path.read_bytes()).hexdigest() for path in paths))
assert unique>=5, f'Android themed captures unexpectedly identical: {unique}/7'
print(f'Seven REAL Android WebView PNG previews, synthetic QA only; {unique} unique screens.')
PY

echo "V5-P1 Android WebView instrumentation PASS: synthetic QA only."
