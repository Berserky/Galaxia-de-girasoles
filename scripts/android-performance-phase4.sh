#!/usr/bin/env bash
set -euo pipefail

BASELINE_APK=${1:?baseline apk required}
AFTER_APK=${2:?after apk required}
OUT=${3:-/tmp/android-phase4.md}
PKG=com.nuestragalaxia.companion
ACTIVITY="$PKG/.MainActivity"

measure(){
  local label=$1 apk=$2
  adb uninstall "$PKG" >/dev/null 2>&1 || true
  adb install -r "$apk" >/dev/null
  adb shell am force-stop "$PKG"
  local launch
  launch=$(adb shell am start -W -n "$ACTIVITY" 2>/dev/null || true)
  sleep 4
  local pss cpu total_time
  pss=$(adb shell dumpsys meminfo "$PKG" | awk '/TOTAL PSS:/ {print $3; exit}')
  cpu=$(adb shell dumpsys cpuinfo | awk '/com\.nuestragalaxia\.companion/ {gsub("%","",$1); print $1; exit}')
  total_time=$(printf '%s\n' "$launch" | awk -F: '/TotalTime:/ {gsub(/[[:space:]]/,"",$2); print $2; exit}')
  pss=${pss:-0}; cpu=${cpu:-0}; total_time=${total_time:-0}
  printf '%s,%s,%s,%s\n' "$label" "$pss" "$cpu" "$total_time"
  adb shell am force-stop "$PKG" || true
}

baseline=$(measure baseline "$BASELINE_APK")
after=$(measure after "$AFTER_APK")
IFS=, read -r _ baseline_pss baseline_cpu baseline_launch <<< "$baseline"
IFS=, read -r _ after_pss after_cpu after_launch <<< "$after"

cat > "$OUT" <<EOF
# Android staging runtime · Phase 4

| Metric | Baseline | After |
| --- | ---: | ---: |
| TOTAL PSS (KB) | $baseline_pss | $after_pss |
| CPU snapshot (%) | $baseline_cpu | $after_cpu |
| Cold launch TotalTime (ms) | $baseline_launch | $after_launch |

Both APKs are debug staging builds launched on the same clean emulator. Phase 4 does not alter Android UI/native sources; these values are observational and are not used as a hard performance gate because emulator scheduling is noisy.
EOF
cat "$OUT"
