#!/usr/bin/env bash
# P8: diagnostic evidence only; never convert a failed instrumented gate to PASS.
set -uo pipefail
mkdir -p qa-artifacts
{
  echo 'P8 EMULATOR HEALTH (diagnostic, not a test result)'
  date -u '+UTC=%Y-%m-%dT%H:%M:%SZ'
  echo '--- Host RAM ---'
  free -m || true
  echo '--- Host disk ---'
  df -h . || true
  echo '--- Process RSS (names only; no arguments or secrets) ---'
  ps -eo pid,comm,rss,%cpu --sort=-rss | head -n 18 || true
  echo '--- ADB devices ---'
  timeout 10s adb devices -l || true
  echo '--- Boot completion ---'
  timeout 7s adb -s emulator-5554 shell getprop sys.boot_completed || true
  echo '--- Emulator executable presence ---'
  pgrep -c -f '[q]emu-system|[e]mulator.*avd' || true
} > qa-artifacts/p8-emulator-health.txt 2>&1
echo "P8 emulator diagnostics recorded (exit gate unchanged)."
