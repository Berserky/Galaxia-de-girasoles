#!/usr/bin/env bash
set -euo pipefail

mkdir -p qa-artifacts
adb logcat -c

gradle -p android --no-daemon :app:connectedDebugAndroidTest \
  -PQA_EDGE_URL=http://127.0.0.1:18765 \
  -PQA_SUPABASE_PUBLISHABLE_KEY=qa_phase5 \
  2>&1 | tee qa-artifacts/instrumentation.txt

PACKAGE=com.nuestragalaxia.companion

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
adb logcat -d > qa-artifacts/logcat.txt
