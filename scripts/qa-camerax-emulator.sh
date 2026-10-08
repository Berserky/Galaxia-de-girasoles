#!/usr/bin/env bash
# reactcircus/android-emulator-runner executes its script through /bin/sh.
# Invoke this file as 'bash scripts/qa-camerax-emulator.sh' for safe pipefail.
set -euo pipefail
mkdir -p qa-artifacts
trap 'adb logcat -d > qa-artifacts/chat-4-phase5-logcat.txt 2>/dev/null || true' EXIT
adb logcat -c
adb shell pm list features | grep -i camera | tee qa-artifacts/camera-features.txt || true

gradle -p android --no-daemon :app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyMediaExperienceTest \
  2>&1 | tee qa-artifacts/chat-4-phase5-camera-emulator.txt

python3 scripts/qa_camerax_report.py | tee qa-artifacts/chat-4-phase5-coverage.jsonl

adb logcat -d > qa-artifacts/chat-4-phase5-logcat.txt || true
! grep -E 'FATAL EXCEPTION|ANR in com\.nuestragalaxia\.companion' qa-artifacts/chat-4-phase5-logcat.txt
