#!/usr/bin/env bash
# V5-P1 Android QA. This script MUST run through bash, not /bin/sh.
# Only hermetic Android QA test accounts with localhost backend and suffix .v5p1qa.
set -euo pipefail

bash scripts/visual-evolution-p0-avd.sh

# Instrumentation is separated from the unpaired baseline. Failures retain
# any screenshots already produced for diagnosis; no production token is loaded.
mkdir -p build/p0-avd/p1-synthetic-themes build/p0-avd/p1-responsive-viewports build/p0-avd/p2-bottom-viewports build/p0-avd/p2-question-viewports build/p0-avd/p3-search-viewports build/p0-avd/p3-notifications-viewports
# Preserve partial theme captures even if instrumentation fails later.
# This runs only against the isolated QA emulator; screenshots are synthetic.
pull_theme_evidence() {
  for theme in daylight cosmic halloween christmas valentine friendship easter; do
    adb pull "/sdcard/Download/V5-P1-synthetic-${theme}.png" "build/p0-avd/p1-synthetic-themes/${theme}.png" >/dev/null 2>&1 || true
  done
  for css in 320 360 393 412; do
    adb pull "/sdcard/Download/V5-P1-viewport-${css}.png" "build/p0-avd/p1-responsive-viewports/${css}.png" >/dev/null 2>&1 || true
    adb pull "/sdcard/Download/V5-P2-bottom-${css}.png" "build/p0-avd/p2-bottom-viewports/${css}.png" >/dev/null 2>&1 || true
    adb pull "/sdcard/Download/V5-P2-question-${css}.png" "build/p0-avd/p2-question-viewports/${css}.png" >/dev/null 2>&1 || true
    adb pull "/sdcard/Download/V5-P3-search-${css}.png" "build/p0-avd/p3-search-viewports/${css}.png" >/dev/null 2>&1 || true
    adb pull "/sdcard/Download/V5-P3-notifications-${css}.png" "build/p0-avd/p3-notifications-viewports/${css}.png" >/dev/null 2>&1 || true
  done
}
trap pull_theme_evidence EXIT
gradle -p android --no-daemon :app:connectedDebugAndroidTest \
  -PQA_EDGE_URL=http://127.0.0.1:18765 \
  -PQA_SUPABASE_PUBLISHABLE_KEY=qa_v5p1 \
  -PQA_APPLICATION_SUFFIX=.v5p1qa \
  '-Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyDeviceClosureTest#visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe' \
  2>&1 | tee build/p0-avd/p1-device-instrumentation.log

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
import struct
responsive_dir=Path('build/p0-avd/p1-responsive-viewports')
viewports=[320,360,393,412]
responsive=[responsive_dir/f'{w}.png' for w in viewports]
assert all(p.is_file() for p in responsive), f'Missing P1 physical viewport screenshot: {[str(p) for p in responsive if not p.is_file()]}'
dimensions={}
for css,path in zip(viewports,responsive):
    blob=path.read_bytes()
    assert blob.startswith(b'\x89PNG\r\n\x1a\n'), f'Invalid responsive viewport PNG: {path}'
    width,height=struct.unpack('>II',blob[16:24])
    assert width<height, f'Responsive viewport expected portrait: {path}: {width}x{height}'
    dimensions[css]=(width,height)
assert all(dimensions[a][0]<dimensions[b][0] for a,b in zip(viewports,viewports[1:])), f'Viewport capture widths not increasing: {dimensions}'
print(f'P1 Android physical viewport matrix PASS: {dimensions}')
bottom=[Path('build/p0-avd/p2-bottom-viewports')/f'{w}.png' for w in viewports]
assert all(p.is_file() for p in bottom), f'Missing P2 scroll-bottom screenshot: {[str(p) for p in bottom if not p.is_file()]}'
for css,path in zip(viewports,bottom):
    blob=path.read_bytes()
    assert blob.startswith(b'\x89PNG\r\n\x1a\n'), f'Invalid P2 scroll-bottom PNG: {path}'
    width,height=struct.unpack('>II',blob[16:24])
    assert (width,height)==dimensions[css], f'P2 bottom screenshot dimension mismatch at {css}: {width}x{height}'
print('P2 Welcome Android bottom-scroll matrix PASS: 4/4; final card above navbar.')
# P2-M/O: middle question must have a REAL Android screenshot at all four
# physical widths. The instrumented JUnit already gates the compositor frame
# ratio (>15%) and verifies question chips above the fixed bottom rail.
middle=[Path('build/p0-avd/p2-question-viewports')/f'{w}.png' for w in viewports]
assert all(p.is_file() for p in middle), f'Missing REAL P2 question screenshot: {[str(p) for p in middle if not p.is_file()]}'
for css,path in zip(viewports,middle):
    blob=path.read_bytes()
    assert blob.startswith(b'\x89PNG\r\n\x1a\n'), f'Invalid P2 middle screenshot: {path}'
    width,height=struct.unpack('>II',blob[16:24])
    assert (width,height)==dimensions[css], f'P2 question screenshot dimension mismatch at {css}: {width}x{height}'
    assert hashlib.sha256(blob).hexdigest()!=hashlib.sha256(responsive[viewports.index(css)].read_bytes()).hexdigest(), f'P2 question screenshot repeats the header at {css}'
print('P2 Welcome Android middle-question matrix PASS: 4/4 real rendered frames.')
# P3 must render both modal surfaces in the physical Android WebView at all
# four widths, not merely return CSS geometry or Chrome demo screenshots.
p3surfaces={}
for kind in ('search','notifications'):
    directory=Path('build/p0-avd')/f'p3-{kind}-viewports'
    images=[directory/f'{css}.png' for css in viewports]
    assert all(p.is_file() for p in images), f'Missing real P3 {kind} PNGs: {[str(p) for p in images if not p.is_file()]}'
    for css,path in zip(viewports,images):
        blob=path.read_bytes()
        assert blob.startswith(b'\\x89PNG\\r\\n\\x1a\\n'), f'Invalid P3 {kind} screenshot: {path}'
        width,height=struct.unpack('>II',blob[16:24])
        assert (width,height)==dimensions[css], f'P3 {kind} dimensions mismatch {css}: {width}x{height}'
        assert hashlib.sha256(blob).hexdigest()!=hashlib.sha256(responsive[viewports.index(css)].read_bytes()).hexdigest(), f'P3 {kind} screenshot stale/duplicated at {css}'
    p3surfaces[kind]=len(images)
print(f'P3 real Android modal screenshots PASS: {p3surfaces}')


# Keep a machine-readable success receipt based on the actual Android JUnit
# report (System.out from instrumented tests is not forwarded by Gradle).
import json
import xml.etree.ElementTree as ET
reports=sorted(Path('android/app/build/outputs/androidTest-results/connected/debug').rglob('TEST-*.xml'))
assert reports, 'Android JUnit XML missing: instrumentation cannot be marked PASS'
suites=[node for p in reports for node in ET.parse(p).getroot().iter('testsuite')]
tests=sum(int(s.get('tests','0')) for s in suites)
failures=sum(int(s.get('failures','0')) for s in suites)
errors=sum(int(s.get('errors','0')) for s in suites)
assert tests==1 and failures==0 and errors==0, (tests,failures,errors)
receipt={'status':'VERIFIED_SYNTHETIC_QA','android_junit_tests':tests,
         'android_junit_failures':failures,'android_junit_errors':errors,
         'seven_themes':sorted(p.stem for p in paths),
         'unique_screenshots':unique,
         'responsive_css_widths':viewports,
         'p2_bottom_scroll_screenshots':len(bottom),
         'p2_middle_question_screenshots':len(middle),
         'p3_real_modal_screenshots':p3surfaces,
         'responsive_png_dimensions':{str(k):list(v) for k,v in dimensions.items()},
         'verification':'display-pixel-marker-plus-instrumented-css-layout-focus'}
Path('build/p0-avd/p1-device-summary.json').write_text(
    json.dumps(receipt,sort_keys=True,indent=2)+chr(10),encoding='utf-8')
print('V5_P1_ANDROID_SHELL='+json.dumps(receipt,sort_keys=True))
PY

echo "V5-P1 Android WebView instrumentation PASS: synthetic QA only."
