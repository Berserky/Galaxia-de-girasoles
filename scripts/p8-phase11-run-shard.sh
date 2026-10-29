#!/usr/bin/env bash
# P8 Phase11: execute every original instrumented test across isolated AVDs.
# Never hide Gradle failures or mark incomplete/duplicate JUnit as a pass.
set -uo pipefail
shard="$1"
case "$shard" in
  garden) shard_index="" ;;
  closure-0) shard_index=0 ;;
  closure-1) shard_index=1 ;;
  media) shard_index="" ;;
  *) echo "Invalid Phase11 shard: $shard" >&2; exit 2 ;;
esac
out="qa-artifacts/phase11-shards/$shard"
mkdir -p "$out"
results="android/app/build/outputs/androidTest-results/connected"
# Eliminate previous generated JUnit files before this *new AVD* run.
if [[ -d "$results" ]]; then
  find "$results" -type f -name 'TEST-*.xml' -delete
fi
if [[ "$shard" == garden ]]; then
  # Execute the most graphics-intensive original P5 test by itself in an entirely fresh AVD.
  gradle -p android --no-daemon connectedDebugAndroidTest \
    -PQA_EDGE_URL=http://127.0.0.1:18765 \
    -PQA_SUPABASE_PUBLISHABLE_KEY=qa_phase11 \
    '-Pandroid.testInstrumentationRunnerArguments.phase10SoakMs=120000' \
    '-Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyDeviceClosureTest#visualEvolutionP5_realMomentsAndroidScreens_andPrivacy' \
    2>&1 | tee "$out/gradle.log"
  status=$?
elif [[ "$shard" == closure-* ]]; then
  gradle -p android --no-daemon connectedDebugAndroidTest \
    -PQA_EDGE_URL=http://127.0.0.1:18765 \
    -PQA_SUPABASE_PUBLISHABLE_KEY=qa_phase11 \
    '-Pandroid.testInstrumentationRunnerArguments.phase10SoakMs=120000' \
    '-Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyDeviceClosureTest' \
    '-Pandroid.testInstrumentationRunnerArguments.notClass=com.nuestragalaxia.companion.GalaxyDeviceClosureTest#visualEvolutionP5_realMomentsAndroidScreens_andPrivacy' \
    '-Pandroid.testInstrumentationRunnerArguments.numShards=2' \
    "-Pandroid.testInstrumentationRunnerArguments.shardIndex=$shard_index" \
    2>&1 | tee "$out/gradle.log"
  status=$?
else
  gradle -p android --no-daemon connectedDebugAndroidTest \
    -PQA_EDGE_URL=http://127.0.0.1:18765 \
    -PQA_SUPABASE_PUBLISHABLE_KEY=qa_phase11 \
    '-Pandroid.testInstrumentationRunnerArguments.class=com.nuestragalaxia.companion.GalaxyMediaExperienceTest,com.nuestragalaxia.companion.GalaxyVoiceMessagesDeviceTest' \
    2>&1 | tee "$out/gradle.log"
  status=$?
fi
# Preserve real JUnit evidence even if Gradle fails; do not alter the exit code.
if [[ -d "$results" ]]; then
  find "$results" -type f -name 'TEST-*.xml' -exec cp {} "$out/" \;
fi
if (( status != 0 )); then
  echo "Phase11 $shard FAIL: Gradle exit $status" >&2
  exit "$status"
fi
shopt -s nullglob
xml_files=("$out"/TEST-*.xml)
if (( ${#xml_files[@]} == 0 )); then
  echo "Phase11 $shard FAIL: no native Android JUnit XML" >&2
  exit 1
fi
echo "Phase11 $shard: ${#xml_files[@]} JUnit files preserved; final coverage gate still required."
