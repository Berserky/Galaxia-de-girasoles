#!/usr/bin/env bash
# Only affects the temporary AVD built by GitHub Actions; no app asset changes.
# Keep the physical framebuffer fixed while native WebView tests exercise
# authentic 320/360/393/412 CSS widths via Android density.
set -euo pipefail
avd_root="${ANDROID_AVD_HOME:-${HOME}/.android/avd}"
cfg="${avd_root}/test.avd/config.ini"
if [[ ! -f "$cfg" ]]; then
 echo "P8 AVD configuration missing: ${avd_root}/test.avd/config.ini" >&2
 exit 1
fi
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
awk '!/^hw\\.lcd\\.(width|height|density)=/' "$cfg" > "$tmp"
cat >> "$tmp" <<'AVD_GEOMETRY'
hw.lcd.width=768
hw.lcd.height=1280
hw.lcd.density=320
AVD_GEOMETRY
cat "$tmp" > "$cfg"
echo "P8 AVD physical framebuffer: 768x1280 at initial 320dpi"
grep -E '^hw\.lcd\.(width|height|density)=' "$cfg"
