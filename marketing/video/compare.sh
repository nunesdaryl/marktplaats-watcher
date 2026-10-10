#!/usr/bin/env bash
# Compare a fresh render with a reference render: same duration and frame count, and frames sampled every 0.5 s
# at PSNR >= 35 dB. Needs ffmpeg + ffprobe + python3.
#
#   marketing/video/compare.sh <new.mp4> <reference.mp4> [min_psnr_db]
#
# Example: marketing/video/compare.sh marketing/video/out/brag-landscape-en-cohort1.mp4 /path/to/reviewed/brag-landscape-en-cohort1.mp4
set -euo pipefail

new="${1:-}"; ref="${2:-}"; min="${3:-35}"
[ -f "$new" ] && [ -f "$ref" ] || { echo "usage: compare.sh <new.mp4> <reference.mp4> [min_psnr_db]" >&2; exit 2; }
for tool in ffmpeg ffprobe python3; do
  command -v "$tool" >/dev/null 2>&1 || { echo "error: '$tool' is not installed or not on PATH." >&2; exit 1; }
done

probe() { ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames,duration,width,height -of csv=p=0 "$1"; }
a="$(probe "$new")"; b="$(probe "$ref")"
if [ "$a" != "$b" ]; then
  echo "FAIL: width,height,duration,frames differ: new=$a reference=$b" >&2
  exit 1
fi
echo "same size, duration and frame count: $a"

# One psnr value per frame, then keep the frames at 0.5 s steps (every 15th frame at 30 fps).
fps="$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$new")"
log="$(mktemp)"; trap 'rm -f "$log"' EXIT
ffmpeg -v error -i "$new" -i "$ref" -lavfi "[0:v][1:v]psnr=stats_file=$log" -f null -
python3 -I - "$log" "$fps" "$min" <<'PY'
import re, sys
log, fps, floor = sys.argv[1], sys.argv[2], float(sys.argv[3])
num, den = (fps.split("/") + ["1"])[:2]
step = max(1, round(float(num) / float(den) / 2))  # frames per 0.5 s
worst, bad, n = None, [], 0
for line in open(log):
    m = re.search(r"n:(\d+) .*psnr_avg:(\S+)", line)
    if not m or (int(m.group(1)) - 1) % step:
        continue
    f, v = int(m.group(1)) - 1, m.group(2)
    v = 99.0 if v == "inf" else float(v)
    n += 1
    if worst is None or v < worst[1]:
        worst = (f, v)
    if v < floor:
        bad.append((f, v))
print(f"sampled {n} frames every 0.5 s; lowest PSNR {worst[1]:.2f} dB at {worst[0] / (float(num) / float(den)):.1f} s")
if bad:
    print("FAIL: below %.0f dB at:" % floor, ", ".join(f"{f / (float(num) / float(den)):.1f}s={v:.1f}" for f, v in bad), file=sys.stderr)
    sys.exit(1)
print(f"OK: every sampled frame >= {floor:.0f} dB")
PY
