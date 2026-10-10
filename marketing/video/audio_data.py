"""Per-frame music energy (30 fps, 8 bands) for a variant's glow: python3 -I audio_data.py <variant> <total_s> <music_offset_s>.

Writes shared/audio-data/<variant>.json in the same shape as the existing files (rms + 8 log-spaced band energies).
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
MUSIC = HERE / "shared/assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3"
SR, FPS, BANDS = 22050, 30, 8


def main(name, total, offset):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(offset), "-t", str(total), "-i", str(MUSIC), "-ac", "1",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    n = round(total * FPS)
    edges = np.geomspace(60, 10000, BANDS + 1)
    win = SR // FPS * 2
    frames = []
    for i in range(n):
        c = int((i / FPS) * SR)
        seg = x[max(0, c - win // 2): c + win // 2]
        seg = np.pad(seg, (0, win - len(seg)))
        spec = np.abs(np.fft.rfft(seg * np.hanning(win))) / win
        f = np.fft.rfftfreq(win, 1 / SR)
        bands = [float(spec[(f >= lo) & (f < hi)].mean()) for lo, hi in zip(edges[:-1], edges[1:])]
        frames.append({"time": round(i / FPS, 4), "rms": round(float(np.sqrt((seg ** 2).mean())), 4),
                       "bands": [round(b, 4) for b in bands]})
    out = {"duration": total, "fps": FPS, "bands": BANDS, "totalFrames": n, "frames": frames}
    (HERE / f"shared/audio-data/{name}.json").write_text(json.dumps(out, separators=(",", ":")))
    print(f"wrote shared/audio-data/{name}.json ({n} frames)")


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]), float(sys.argv[3]))
