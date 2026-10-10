#!/usr/bin/env bash
# Render the Marktplaats Watcher launch video from marketing/video/ (see marketing/video/HOW-TO.md).
#
#   scripts/render-video.sh <variant> [format|all] [lang|all]
#     variant: original | animated-logo | cohort1 | why | pack | bumper
#     format:  landscape (1920x1080) | vertical (1080x1920) | all   (default all)
#              pack:   reels-stories (1080x1920, 9:16) | meta-feed (1080x1350, 4:5) | x (1920x1080, 16:9) | all
#              bumper: yt-bumper (1920x1080, 6 s) | all
#     lang:    en | nl | all                                         (default all)
#
# Runs only `hyperframes check` and `hyperframes render`, pinned to 0.8.145, with telemetry off. Never `init`
# (it installs skills into ~/.claude, ~/.agents, ~/.cursor, ~/.junie, ~/.copilot, ~/.hermes and ~/.openclaw).
# Output goes to marketing/video/out/ (gitignored): brag-<format>-<lang>[-<variant>].mp4 and a matching .jpg poster.
# The poster frame is also baked in as frame 0 (same duration, frame count and audio).
# pack/bumper write <format>-<lang>.mp4/.jpg. SAFE_ZONE_OVERLAY=1 renders them to out/safe-zone/ with a white page and a
# red tint outside the safe box (review only; out/ is gitignored).
set -euo pipefail

HYPERFRAMES="hyperframes@0.8.145"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VIDEO="$ROOT/marketing/video"
OUT="$VIDEO/out"

usage() {
  echo "usage: scripts/render-video.sh <original|animated-logo|cohort1|why|pack|bumper> [landscape|vertical|reels-stories|meta-feed|x|yt-bumper|all] [en|nl|all]" >&2
  exit 2
}

variant="${1:-}"; format="${2:-all}"; lang="${3:-all}"
case "$variant" in original) poster=12.5 ;; animated-logo) poster=12.5 ;; cohort1) poster=1.0 ;; why) poster=1.0 ;; pack) poster=1.0 ;; bumper) poster=1.0 ;; *) usage ;; esac
case "$variant:$format" in
  pack:reels-stories|pack:meta-feed|pack:x|pack:all|bumper:yt-bumper|bumper:all) ;;
  pack:*|bumper:*) usage ;;
  *:landscape|*:vertical|*:all) ;;
  *) usage ;;
esac
case "$lang" in en|nl|all) ;; *) usage ;; esac

for tool in npx ffmpeg python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: '$tool' is not installed or not on PATH; this script needs npx (Node), ffmpeg and python3." >&2; exit 1; }
done

export DO_NOT_TRACK=1 HYPERFRAMES_NO_TELEMETRY=1

formats=(landscape vertical)
[ "$variant" = pack ] && formats=(reels-stories meta-feed x)
[ "$variant" = bumper ] && formats=(yt-bumper)
[ "$format" = all ] || formats=("$format")
langs=(en nl); [ "$lang" = all ] || langs=("$lang")

debug=off; [ "${SAFE_ZONE_OVERLAY:-}" = 1 ] && debug=on
[ "$debug" = on ] && OUT="$OUT/safe-zone"
mkdir -p "$OUT"
python3 -I "$VIDEO/build.py" "$variant" "$format"

suffix=""; [ "$variant" = original ] || suffix="-$variant"
for fmt in "${formats[@]}"; do
  project="$VIDEO/.build/$variant/$fmt"
  echo "== check: $variant $fmt"
  (cd "$project" && npx -y "$HYPERFRAMES" check)
  case "$variant" in pack|bumper) # `check` has no --variables: check the Dutch copy from a copy whose default language is nl
    if [ "$lang" != en ]; then
      rm -rf "$project-nl"; cp -R "$project" "$project-nl"
      perl -0pi -e 's/"default":"en"/"default":"nl"/' "$project-nl/index.html"
      echo "== check (nl): $variant $fmt"
      (cd "$project-nl" && npx -y "$HYPERFRAMES" check)
    fi ;;
  esac
  for lg in "${langs[@]}"; do
    name="brag-$fmt-$lg$suffix"
    case "$variant" in pack|bumper) name="$fmt-$lg" ;; esac
    raw="$OUT/.$name.raw.mp4"
    vars="{\"lang\":\"$lg\"}"
    case "$variant" in pack|bumper) vars="{\"lang\":\"$lg\",\"debug\":\"$debug\"}" ;; esac
    echo "== render: $name"
    (cd "$project" && npx -y "$HYPERFRAMES" render --quality high --variables "$vars" --output "$raw")
    ffmpeg -v error -y -ss "$poster" -i "$raw" -frames:v 1 -q:v 2 "$OUT/$name.jpg"
    ffmpeg -v error -y -i "$raw" -i "$OUT/$name.jpg" \
      -filter_complex "[0:v][1:v]overlay=0:0:enable='eq(n,0)'[v]" \
      -map "[v]" -map "0:a?" -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p \
      -c:a copy -movflags +faststart "$OUT/$name.mp4"
    rm -f "$raw"
    echo "   wrote ${OUT#"$ROOT/"}/$name.mp4 and $name.jpg"
  done
done
