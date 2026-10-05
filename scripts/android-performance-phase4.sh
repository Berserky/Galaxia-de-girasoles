#!/usr/bin/env bash
set -euo pipefail

BASELINE_APK=${1:?baseline apk required}
AFTER_APK=${2:?after apk required}
OUT=${3:-/tmp/android-phase4.md}
PKG=com.nuestragalaxia.companion

measure(){
  local label=$1 apk=$2
  adb uninstall "$PKG" >/dev/null 2>&1 || true
  adb install -r "$apk" >/dev/null
  adb shell dumpsys batterystats --reset >/dev/null 2>&1 || true

  local activity
  activity=$(adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER "$PKG" 2>/dev/null | tr -d '\r' | tail -1)
  if [ -z "$activity" ] || [[ "$activity" != *"/"* ]]; then
    echo "Unable to resolve launcher activity for $label: $activity" >&2
    return 1
  fi

  adb shell am force-stop "$PKG"
  local launch
  launch=$(adb shell am start -W -S -n "$activity" 2>&1 | tr -d '\r')
  printf '%s\n' "$launch" >&2

  local pss cpu total_time launch_state
  sleep 4
  pss=$(adb shell dumpsys meminfo "$PKG" | awk '/TOTAL PSS:/ {print $3; exit}')
  cpu=$(adb shell dumpsys cpuinfo | awk '/com\.nuestragalaxia\.companion/ {gsub("%","",$1); print $1; exit}')
  total_time=$(printf '%s\n' "$launch" | awk -F: '/TotalTime:/ {gsub(/[[:space:]]/,"",$2); print $2; exit}')
  if ! [[ "${total_time:-}" =~ ^[1-9][0-9]*$ ]]; then
    total_time=$(printf '%s\n' "$launch" | awk -F: '/WaitTime:/ {gsub(/[[:space:]]/,"",$2); print $2; exit}')
  fi
  launch_state=$(printf '%s\n' "$launch" | awk -F: '/LaunchState:/ {sub(/^[[:space:]]+/,"",$2); print $2; exit}')
  pss=${pss:-0}; cpu=${cpu:-0}
  local battery_file="/tmp/phase4-${label}-batterystats.txt"
  local battery_state="unavailable"
  adb shell dumpsys batterystats --charged > "$battery_file" 2>/dev/null || true
  if [ -s "$battery_file" ]; then battery_state="captured"; fi

  if ! [[ "$pss" =~ ^[1-9][0-9]*$ ]]; then
    echo "Invalid TOTAL PSS for $label: $pss" >&2
    return 1
  fi
  if ! [[ "${total_time:-}" =~ ^[1-9][0-9]*$ ]]; then
    echo "Invalid cold-launch timing for $label" >&2
    return 1
  fi

  printf '%s,%s,%s,%s,%s,%s\n' "$label" "$pss" "$cpu" "$total_time" "${launch_state:-unknown}" "$battery_state"
  adb shell am force-stop "$PKG" || true
}

baseline=$(measure baseline "$BASELINE_APK")
after=$(measure after "$AFTER_APK")
IFS=, read -r _ baseline_pss baseline_cpu baseline_launch baseline_state baseline_battery <<< "$baseline"
IFS=, read -r _ after_pss after_cpu after_launch after_state after_battery <<< "$after"

cat > "$OUT" <<EOF
# Android staging runtime · Phase 4

| Metric | Baseline | After |
| --- | ---: | ---: |
| TOTAL PSS (KB) | $baseline_pss | $after_pss |
| CPU snapshot (%) | $baseline_cpu | $after_cpu |
| Cold launch (ms) | $baseline_launch | $after_launch |
| Launch state | $baseline_state | $after_state |
| Battery diagnostics | $baseline_battery | $after_battery |

Both APKs are debug staging builds launched on the same clean emulator. Runtime values are observational; emulator scheduling is noisy, and emulator batterystats are diagnostic rather than physical-device energy measurements. Functional and deterministic round-trip gates remain authoritative.
EOF
cat "$OUT"
