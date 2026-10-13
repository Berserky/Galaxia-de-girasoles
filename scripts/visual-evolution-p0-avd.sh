#!/usr/bin/env bash
# V5-P0. Ejecutar únicamente dentro de un AVD recién creado, sin usuarios vinculados.
set -euo pipefail
PKG=com.nuestragalaxia.companion
ACT=com.nuestragalaxia.companion/.MainActivity
OUT="$PWD/build/p0-avd"
mkdir -p "$OUT"
echo "P0 Android baseline: emulator only, debug QA build, no personal user login." | tee "$OUT/README.txt"
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell pm clear "$PKG" >/dev/null
adb shell settings put system font_scale 1.0
adb shell settings put system user_rotation 0 || true
for iteration in 1 2 3 4 5; do
  adb shell am force-stop "$PKG"
  adb shell am start -W -n "$ACT" >"$OUT/start-$iteration.txt"
  grep -E 'Status:|TotalTime:|WaitTime:|ThisTime:' "$OUT/start-$iteration.txt" || true
  sleep 2
done
# PNG signature alone is NOT visual QA. Assert Android accessibility hierarchy
# exposes the real, unpaired pairing form before every capture. This catches
# launcher/system ANR dialogs that previously produced valid but useless PNGs.
assert_onboarding_visible() {
  local label="$1" xml="$OUT/ui-$1.xml" ok=0
  for attempt in 1 2 3 4; do
    adb shell uiautomator dump /sdcard/Download/v5-unpaired-ui.xml >/dev/null 2>&1 || true
    adb exec-out cat /sdcard/Download/v5-unpaired-ui.xml >"$xml" 2>/dev/null || true
    if grep -Eqi 'Vincular este teléfono|Código de vinculación|Todo lo nuestro, ahora en el teléfono' "$xml" \
      && ! grep -Eqi 'Pixel Launcher isn.t responding|System UI isn.t responding|isn.t responding|no responde' "$xml"; then
      ok=1
      break
    fi
    echo "Visual QA: onboarding inaccessible on $label, attempt $attempt/4." >&2
    sleep 3
  done
  if [[ "$ok" != 1 ]]; then
    echo "FAIL VISUAL QA: screenshot $label blocked by system UI or app not accessible." >&2
    adb shell dumpsys window windows >"$OUT/focus-$label.txt" || true
    return 1
  fi
}
assert_onboarding_visible portrait
adb exec-out screencap -p >"$OUT/android-unpaired-portrait.png"
adb shell dumpsys window >"$OUT/window-portrait.txt"
adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
for iteration in 1 2 3 4 5; do
  adb shell input swipe 250 740 250 340 400
  adb shell input swipe 250 340 250 740 400
done
adb shell dumpsys gfxinfo "$PKG" framestats >"$OUT/gfxinfo-framestats.txt"
adb shell dumpsys meminfo "$PKG" >"$OUT/meminfo.txt"
adb shell settings put system font_scale 1.3
sleep 2
assert_onboarding_visible largefont
adb exec-out screencap -p >"$OUT/android-unpaired-largefont.png"
adb shell settings put system font_scale 1.0
adb shell settings put system accelerometer_rotation 0
adb shell settings put system user_rotation 1
sleep 3
assert_onboarding_visible landscape
adb exec-out screencap -p >"$OUT/android-unpaired-landscape.png"
adb shell settings put system user_rotation 0
adb shell settings put system accelerometer_rotation 1
python3 - <<'PY'
from pathlib import Path
import json, re
base=Path('build/p0-avd')
starts=[]
for f in sorted(base.glob('start-*.txt')):
    text=f.read_text()
    status=re.search(r'Status:\s*(\S+)',text)
    total=re.search(r'TotalTime:\s*(\d+)',text)
    starts.append({'iteration':int(f.stem.split('-')[-1]),'status':status.group(1) if status else 'missing','totalTimeMs':int(total.group(1)) if total else None})
    assert status and status.group(1).lower()=='ok',f'Android launch failed: {f}'
for path in base.glob('*.png'):
    assert path.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'),f'Invalid PNG: {path}'
assert len(list(base.glob('*.png')))==3, 'Must capture 3 AVD screenshots'
assert len(list(base.glob('ui-*.xml')))==3, 'Must verify onboarding accessibility for 3 screen captures'
summary={'scope':'fresh isolated Android QA debug/unpaired onboarding ONLY',
 'coldStartProxy':'am force-stop then am start -W; not fully cold CPU/network',
 'launchIterations':starts,
 'gfxinfo':'gfxinfo-framestats.txt raw, never convert into global UI FPS without route control',
 'screenshots':['android-unpaired-portrait.png','android-unpaired-largefont.png','android-unpaired-landscape.png'],
 'notTested':['authenticated views','real GPS','FCM','private media','paired chat','battery delta'],
 'privacy':'no linked accounts, no real coordinates or private images'}
(base/'manifest.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary))
PY
