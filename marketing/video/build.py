"""Generate the Hyperframes projects for every variant x format from one template (src/template.html).

Usage: python3 -I build.py <variant|all> [format|all]   (paths are relative to this file)
Output: .build/<variant>/<format>/ (gitignored). Never runs Hyperframes; scripts/render-video.sh does that.

The template holds the scene markup and the GSAP timeline once. Lines between `@only <variants>` and `@end`
markers are kept for the listed variants only; `__NAME__` tokens are filled in per variant and format below.
"""
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
FORMATS = {"landscape": (1920, 1080), "vertical": (1080, 1920)}

# Scene starts (s1..s4 keep their 4.4 / 4.34 / 4.37 / 4.36 s lengths), s5 start + length, s6 start + length.
# poster = the settled frame baked in as frame 0 and written as the .jpg (see scripts/render-video.sh).
VARIANTS = {
    "original": dict(total=24.5, shift=0.0, s5=(17.47, 3.81), s6=(21.28, 3.22), logo_sfx=21.4, music_offset=None),
    "animated-logo": dict(total=29.0, shift=0.0, s5=(17.47, 5.81), s6=(23.28, 5.72), logo_sfx=23.3, music_offset=None),
    # the 3.0 s problem hook goes in front: every cue and scene moves +3.0 s, and the music starts 1.365 s into the
    # track (8 beats = 2 bars at 109.96 BPM, minus 3 s) so the beat locks keep their grid
    "cohort1": dict(total=32.0, shift=3.0, s5=(17.47, 5.81), s6=(23.28, 5.72), logo_sfx=23.3, music_offset=1.365),
    # the `why` film is its own timeline (scene times live in the template): same 3.0 s hook, then pain, turn, four outcome
    # cards and proof, and the outro from 35.11 s; the H-to-I loop starts at l0 and the music offset is the cohort1 one
    "why": dict(total=40.6, shift=0.0, s5=(28.6, 6.51), s6=(35.11, 5.49), logo_sfx=35.13, music_offset=1.365, l0=36.8),
}

# SFX cues: (id, file, start, duration, volume), times for the film without the hook.
TYPE_START, TYPE_STEP, N_CHARS = 1.0, 0.048, 50
KEYS = ["keypress-003.wav", "keypress-011.wav", "keypress-019.wav", "keypress-024.wav"]


def why_sfx_cues(v):
    return [
        ("sfx-stamp", "impactSoft_medium_002.ogg", 1.6, 0.14, 0.40),
        ("sfx-pain-1", "drop_001.ogg", 3.05, 0.11, 0.40),
        ("sfx-pain-2", "drop_002.ogg", 4.3, 0.19, 0.32),
        ("sfx-pain-3", "drop_003.ogg", 5.5, 0.19, 0.32),
        ("sfx-turn", "card-slide-1.ogg", 8.92, 0.6, 0.38),
        ("sfx-chip", "click2.ogg", 10.2, 0.06, 0.40),
        ("sfx-card-a", "click2.ogg", 15.4, 0.06, 0.40),
        ("sfx-card-b", "click2.ogg", 18.15, 0.06, 0.40),
        ("sfx-card-c", "click2.ogg", 21.5, 0.06, 0.40),
        ("sfx-card-d", "click2.ogg", 24.5, 0.06, 0.40),
        ("sfx-logo", "bong_001.ogg", v["logo_sfx"], 0.12, 0.45),
    ]


def sfx_cues(name, v):
    if name == "why":
        return why_sfx_cues(v)
    cues = [(f"sfx-key-{k}", KEYS[k % len(KEYS)], round(TYPE_START + i * TYPE_STEP, 3), 0.25, 0.22)
            for k, i in enumerate(range(0, N_CHARS, 4))]  # a soft tick on every 4th character
    cues += [
        ("sfx-send", "click2.ogg", 3.7, 0.06, 0.40),
        ("sfx-save", "click2.ogg", 6.9, 0.06, 0.45),
        ("sfx-row-1", "drop_001.ogg", 8.84, 0.11, 0.40),
        ("sfx-row-2", "drop_002.ogg", 9.83, 0.19, 0.32),
        ("sfx-row-3", "drop_003.ogg", 10.93, 0.19, 0.32),
        ("sfx-mail", "card-slide-1.ogg", 13.11, 0.6, 0.38),
        ("sfx-logo", "bong_001.ogg", v["logo_sfx"], 0.12, 0.45),
    ]
    cues = [(i, f, round(s + v["shift"], 3), d, vol) for (i, f, s, d, vol) in cues]
    if name == "cohort1":
        cues.insert(len(cues) - 7, ("sfx-stamp", "impactSoft_medium_002.ogg", 1.6, 0.14, 0.40))  # 'Reserved' badge
    return cues


def audio_energy(name):
    d = json.loads((HERE / f"shared/audio-data/{name}.json").read_text())
    rms = [fr["rms"] for fr in d["frames"]]
    bass = [sum(fr["bands"][:2]) / 2 for fr in d["frames"]]
    mr, mb = max(rms) or 1, max(bass) or 1
    return [round(0.6 * r / mr + 0.4 * b / mb, 3) for r, b in zip(rms, bass)]


def music_lane(total, fade=2.1, step=0.1, level=0.30):
    """Volume lane for the music bed (absolute gain): the bed level, then a cubic fade over the last `fade` s to 0."""
    pts = [{"t": 0, "v": level}, {"t": round(total - fade, 3), "v": level}]
    k = 1
    while round(k * step, 3) < fade:
        left = fade - k * step
        pts.append({"t": round(total - left, 3), "v": round(level * (left / fade) ** 3, 6)})
        k += 1
    pts.append({"t": total, "v": 0})
    return json.dumps({"version": 1, "lanes": [{"target": "volume", "points": pts}]}, separators=(",", ":"))


def music_tag(name, v):
    src = "assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3"
    if name == "original":
        return (f'<audio id="music" src="{src}" data-start="0" data-duration="{v["total"]}" data-track-index="10" '
                'data-volume="0.30" data-fade-in="0.4" data-fade-out="1.6"></audio>')
    offset = f' data-media-start="{v["music_offset"]}"' if v["music_offset"] else ""
    return (f'<audio id="music" src="{src}" data-start="0" data-duration="{v["total"]:g}"{offset} data-track-index="10" '
            f"data-volume=\"0.30\" data-fade-in=\"0.4\" data-automation='{music_lane(v['total'])}'></audio>")


def keep_variant_lines(text, name):
    """Drop the lines between `@only <variants>` / `@end` markers unless `name` is listed; remove the markers."""
    marker = re.compile(r"^\s*(?:<!--|//|/\*)@(only|end)\b\s*([\w, -]*?)\s*(?:-->|\*/)?\s*$")
    out, keep = [], True
    for line in text.splitlines(keepends=True):
        m = marker.match(line)
        if not m:
            if keep:
                out.append(line)
        elif m.group(1) == "only":
            keep = name in [x.strip() for x in m.group(2).split(",")]
        else:
            keep = True
    return "".join(out)


def num(x):
    return f"{round(x, 3):g}"


def build(name, fmt, template):
    v = VARIANTS[name]
    w, h = FORMATS[fmt]
    sh = v["shift"]
    sfx_html = "\n".join(
        f'      <audio id="{i}" src="assets/sfx/{f}" data-start="{s}" data-duration="{d}" '
        f'data-track-index="{11 + n}" data-volume="{vol}"></audio>'
        for n, (i, f, s, d, vol) in enumerate(sfx_cues(name, v)))
    fills = {
        "__TOTAL__": f"{v['total']:g}", "__W__": str(w), "__H__": str(h), "__FMT__": fmt,
        "__S1__": num(0 + sh), "__S2__": num(4.4 + sh), "__S3__": num(8.74 + sh), "__S4__": num(13.11 + sh),
        "__S5__": num(v["s5"][0] + sh), "__S5D__": num(v["s5"][1]), "__S6__": num(v["s6"][0] + sh), "__S6D__": num(v["s6"][1]),
        "__L0__": num(v.get("l0", 25.0)), "__MUSIC__": music_tag(name, v), "__SFX__": sfx_html,
        "__AUDIO__": json.dumps(audio_energy(name), separators=(",", ":")),
    }
    html = keep_variant_lines(template, name)
    for token, value in fills.items():
        html = html.replace(token, value)
    left = re.findall(r"__[A-Z0-9]+__", html)
    assert not left, f"unfilled tokens: {left}"
    out = HERE / ".build" / name / fmt
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    shutil.copytree(HERE / "shared/assets", out / "assets")
    (out / "index.html").write_text(html)
    (out / "hyperframes.json").write_text(json.dumps({
        "$schema": "https://hyperframes.heygen.com/schema/hyperframes.json",
        "registry": "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
        "paths": {"blocks": "compositions", "components": "compositions/components", "assets": "assets"},
        "media": {"autoProxy": True},
    }, indent=2) + "\n")
    (out / "meta.json").write_text(json.dumps({"id": "composition", "name": "composition"}, indent=2) + "\n")
    (out / "package.json").write_text(json.dumps({
        "name": "composition", "private": True, "type": "module",
        "scripts": {"check": "npx --yes hyperframes@0.8.145 check", "render": "npx --yes hyperframes@0.8.145 render"},
    }, indent=2) + "\n")
    print(f"wrote {out.relative_to(HERE)}/index.html ({w}x{h}, {v['total']:g} s)")


def main(argv):
    if not argv or argv[0] not in (*VARIANTS, "all") or (len(argv) > 1 and argv[1] not in (*FORMATS, "all")):
        sys.exit(f"usage: build.py <{'|'.join(VARIANTS)}|all> [{'|'.join(FORMATS)}|all]")
    names = list(VARIANTS) if argv[0] == "all" else [argv[0]]
    fmts = list(FORMATS) if len(argv) < 2 or argv[1] == "all" else [argv[1]]
    template = (HERE / "src/template.html").read_text()
    for name in names:
        for fmt in fmts:
            build(name, fmt, template)


if __name__ == "__main__":
    main(sys.argv[1:])
