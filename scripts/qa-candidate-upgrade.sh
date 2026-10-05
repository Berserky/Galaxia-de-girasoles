#!/usr/bin/env bash
set -euo pipefail

mkdir -p candidate-evidence
LOG="candidate-evidence/upgrade-install.txt"

adb install previous/NuestraGalaxia.apk | tee "$LOG"
adb shell am start -W -n com.nuestragalaxia.companion/.MainActivity >> "$LOG"

adb install -r candidate/NuestraGalaxia.apk | tee -a "$LOG"

VERSION_CODE=$(jq -r '.versionCode' candidate/candidate.json)
VERSION_NAME=$(jq -r '.versionName' candidate/candidate.json)

adb shell dumpsys package com.nuestragalaxia.companion > /tmp/pkg.txt
grep -Eq "versionCode=$VERSION_CODE([[:space:]]|$)" /tmp/pkg.txt
grep -F "versionName=$VERSION_NAME" /tmp/pkg.txt

adb shell am force-stop com.nuestragalaxia.companion
adb shell am start -W -n com.nuestragalaxia.companion/.MainActivity | tee -a "$LOG"

grep -q "^Success$" "$LOG"
