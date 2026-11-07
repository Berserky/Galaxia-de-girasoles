#!/usr/bin/env bash
set -euo pipefail

mkdir -p qa-artifacts
# Preserve forensic evidence when Gradle/UTP exits early after the AVD disappears.
# The runner is isolated and unpaired; never record environment variables or process args.
LOGCAT_PID=""

capture_exit() {
  local status="$1"
  trap - EXIT
  set +e
  printf 'exit_status=%s\n' "$status" > qa-artifacts/exit-status.txt
  date -u +'%Y-%m-%dT%H:%M:%SZ' >> qa-artifacts/exit-status.txt
  timeout 10s adb devices -l > qa-artifacts/adb-devices-at-exit.txt 2>&1
  ps -eo pid,ppid,stat,rss,etime,comm > qa-artifacts/host-processes-at-exit.txt
  cat /proc/meminfo > qa-artifacts/host-meminfo-at-exit.txt
  if [[ -n "$LOGCAT_PID" ]]; then
    kill "$LOGCAT_PID" 2>/dev/null || true
    wait "$LOGCAT_PID" 2>/dev/null || true
  fi
  timeout 10s adb logcat -d -v threadtime -b main -b system -b crash \
    > qa-artifacts/logcat-at-exit.txt 2> qa-artifacts/logcat-at-exit-stderr.txt || true
  if (( status != 0 )); then
    timeout 10s sudo -n dmesg -T 2>/dev/null \
      | grep -Ei 'oom|out of memory|killed process|qemu|emulator|segfault' \
      | tail -n 100 > qa-artifacts/host-kernel-signals.txt || true
  fi
  exit "$status"
}
trap 'capture_exit "$?"' EXIT

adb logcat -c
adb logcat -v threadtime -b main -b system -b crash \
  > qa-artifacts/logcat-live.txt 2> qa-artifacts/logcat-live-stderr.txt &
LOGCAT_PID=$!

gradle -p android --no-daemon :app:connectedDebugAndroidTest \
  -PQA_EDGE_URL=http://127.0.0.1:18765 \
  -PQA_SUPABASE_PUBLISHABLE_KEY=qa_phase5 \
  2>&1 | tee qa-artifacts/instrumentation.txt

grep "GALAXY_CHAT_PHASE0_ANDROID=" qa-artifacts/instrumentation.txt > qa-artifacts/chat-4-phase0-android.jsonl || true
grep "GALAXY_CHAT_PHASE1_ANDROID=" qa-artifacts/instrumentation.txt > qa-artifacts/chat-4-phase1-android.jsonl || true
grep "GALAXY_CHAT_PHASE2_ANDROID=" qa-artifacts/instrumentation.txt > qa-artifacts/chat-4-phase2-android.jsonl || true
grep "GALAXY_CHAT_PHASE4_ANDROID=" qa-artifacts/instrumentation.txt > qa-artifacts/chat-4-phase4-android.jsonl || true

PACKAGE=com.nuestragalaxia.companion
DEBUG_APK="android/app/build/outputs/apk/debug/app-debug.apk"

# connectedDebugAndroidTest cleans the target package after instrumentation.
# Reinstall the exact debug APK just exercised so lifecycle checks run against
# the same build instead of failing because the Activity no longer exists.
adb install -r "$DEBUG_APK" | tee qa-artifacts/lifecycle-install.txt

echo "=== killed -> cold start ===" | tee qa-artifacts/lifecycle.txt
adb shell am force-stop "$PACKAGE"
if adb shell pidof "$PACKAGE" | grep -q .; then
  echo "FAIL: package survived force-stop" | tee -a qa-artifacts/lifecycle.txt
  exit 1
fi

adb shell am start -W -n "$PACKAGE/.MainActivity" | tee -a qa-artifacts/lifecycle.txt
sleep 2
adb shell pidof "$PACKAGE" | tee -a qa-artifacts/lifecycle.txt
adb shell dumpsys activity activities | grep -m1 -E "mResumedActivity|topResumedActivity" | tee -a qa-artifacts/lifecycle.txt

echo "=== foreground -> background ===" | tee -a qa-artifacts/lifecycle.txt
adb shell input keyevent KEYCODE_HOME
sleep 1
if adb shell dumpsys activity activities | grep -m1 -E "mResumedActivity|topResumedActivity" | grep -q "$PACKAGE"; then
  echo "FAIL: app remained resumed after HOME" | tee -a qa-artifacts/lifecycle.txt
  exit 1
fi

echo "=== background -> foreground ===" | tee -a qa-artifacts/lifecycle.txt
adb shell am start -W -n "$PACKAGE/.MainActivity" | tee -a qa-artifacts/lifecycle.txt
sleep 1
adb shell dumpsys activity activities | grep -m1 -E "mResumedActivity|topResumedActivity" | tee -a qa-artifacts/lifecycle.txt
adb shell dumpsys activity activities | grep -m1 -E "mResumedActivity|topResumedActivity" | grep -q "$PACKAGE"

echo "VERIFIED: killed/cold-start/background/foreground" | tee -a qa-artifacts/lifecycle.txt
adb logcat -d > qa-artifacts/logcat.txt || true
