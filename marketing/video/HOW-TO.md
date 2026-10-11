# How to make a Marktplaats Watcher video

The launch videos are built from one template here, so a new version or platform cut takes minutes and follows the same rules every time. The source is plain HTML and GSAP, rendered by Hyperframes. Credits and licences are in [CREDITS.md](CREDITS.md).

## One command

```bash
scripts/render-video.sh <variant> [format|all] [lang|all]
# examples
scripts/render-video.sh cohort1 all all          # 4 videos: landscape/vertical x en/nl
scripts/render-video.sh animated-logo landscape en
```

- **variant**: `original`, `animated-logo`, `cohort1`, `why`, `pack` or `bumper` (see below).
- **format**: `landscape` (1920x1080), `vertical` (1080x1920) or `all`. `pack` takes `reels-stories` (1080x1920), `meta-feed` (1080x1350), `x` (1920x1080) or `all`; `bumper` takes `yt-bumper` (1920x1080) or `all`.
- **lang**: `en`, `nl` or `all`. The app screens stay in English in both; captions, claims and the outro change.

It writes `marketing/video/out/brag-<format>-<lang>[-<variant>].mp4` and a matching `.jpg` poster. The poster frame is baked in as frame 0 (same duration, frame count and audio), so every platform's thumbnail shows it. `out/` and `.build/` are gitignored. It needs `npx` (Node), `ffmpeg` and `python3`, and stops with a clear message if one is missing.

Under the hood it runs `python3 -I marketing/video/build.py` (template to `.build/<variant>/<format>/`), then only `npx -y hyperframes@0.8.145 check` and `render`, with `DO_NOT_TRACK=1 HYPERFRAMES_NO_TELEMETRY=1`. A render takes about a minute.

## Rules

1. **Pinned tools, nothing else.** Hyperframes `0.8.145` through `npx -y hyperframes@0.8.145`; brag `latent-spaces/brag@8531ccb9f471` (only for its method notes). **Never run `hyperframes init`**: it installs skills into `~/.claude`, `~/.agents`, `~/.cursor`, `~/.junie`, `~/.copilot`, `~/.hermes` and `~/.openclaw`. Never run an unpinned `npx hyperframes`. Telemetry stays off. Output goes only to the gitignored folders.
2. **Claims only from evidence.** Every number or promise on screen comes from [`evals/report.md`](../../evals/report.md), the product copy in [`frontend/src/Landing.jsx`](../../frontend/src/Landing.jsx), the live dashboard, or our own dated evidence (for example `docs/marketing/competitors/…`). Put the source in the media README and keep an on-screen footnote readable for about 5 seconds. Do not write "never", "first", "instant" or "never miss". No Marktplaats logo, colours or interface. No claim about shops or dealers while that filter is off.
3. **English and Dutch in the same pass.** Read the Dutch aloud for natural wording (for example "met uitleg waarom", "testrondes").
4. **Readable.** At least 0.3 s per word, labels at least 0.8 s, no one-word last lines (the template uses `nowrap` spans and balanced wrapping), a clean first frame (no blink), at most 8 blank frames in any transition.
5. **Review before anyone sees it** (below).
6. **Only the factory commits a final cut.** New variants, formats or committed renders go through the factory: spec, build, review, then a per-issue merge OK. Nothing is posted, uploaded or paid for from here.

## Pipeline

1. **Plan.** Write the storyboard: scene timings, caption text (EN and NL), the claims register with a source for each line. The 10 October plan is [brag-plan.md](../../docs/marketing/media/launch-2026-10-10/brag-plan.md).
2. **Template.** Edit `src/template.html` (markup, CSS, GSAP timeline, EN/NL strings) and, for timings and sounds, the `VARIANTS` table and `sfx_cues` in `build.py`. Lines between `@only <variants>` and `@end` markers belong to those variants only.
3. **Check.** `render-video.sh` runs `hyperframes check` first (lint, layout, contrast); it must show 0 errors for every format.
4. **Render.** `scripts/render-video.sh <variant> all all`.
5. **Review frame by frame** with the `video-frame-analysis` method, on real playback, not pinned frames:
   - `watch_video.sh <video> <out> native` for native fps, especially over every transition (blank frames, blinks, overlaps).
   - Contact sheets are for navigation only. Judge every piece of text and the logo from a 1:1 crop at its real display size, in both languages and both formats.
   - For the H-to-I logo loop, follow the logo through the whole loop and check it ends upright.
   - Check the audio at the end (levels, fade to zero) and the beat locks.
6. **Compare** a re-render with a reviewed one: `marketing/video/compare.sh new.mp4 reference.mp4` checks size, duration, frame count and PSNR of frames every 0.5 s (must be at least 35 dB).
7. **Commit the final cut** through a factory issue only (see rule 6), together with a README that lists claims and sources, like [media/launch-2026-10-10](../../docs/marketing/media/launch-2026-10-10/README.md).

## Variants

| Variant | Length | Frames | Scenes (start s) | Notes |
|---|---|---|---|---|
| `original` | 24.5 s | 735 | search 0, watch 4.4, scored rows 8.74, e-mail 13.11, proof 17.47, outro 21.28 | Committed in `docs/marketing/media/launch-2026-10-10/`. Logo tilts at the end. Poster 12.5 s. |
| `animated-logo` | 30.2 s | 906 | same, score scene 8.74 to 13.71, e-mail 13.71, proof held longer (18.27 to 24.48), outro 24.48 | No tilt; the logo does the H-to-I loop once from 26.2 s (keyframes from `frontend/src/brand/logo.js`). Footnote and Dutch wording polished. Poster 12.5 s. Committed in `docs/marketing/media/variants-2026-10-10/`. |
| `cohort1` | 33.2 s | 996 | problem hook 0, then the animated-logo film shifted by 3.0 s (loop from 29.2 s) | From FDE cohort feedback: a "too late" hook with a Reserved badge (badge at 1.6 s). Music starts 1.365 s into the track to keep the beat grid. Poster 1.0 s (hook, before the badge). Committed in `docs/marketing/media/variants-2026-10-10/`. |

| `why` | 45.7 s | 1371 | hook 0, pain 3.0, turn 8.9, outcome cards 15.4 / 18.15 (score list, then alert e-mail, 8.45 s) / 26.6 / 29.6, proof 33.7, outro 40.21 (loop from 41.9 s) | Its own timeline (no nested film). PAS: the cohort1 hook, three pain lines from our dated 29 Sep check, the 8-10 Oct own-account contrast, four outcome cards (plain words, worth a look with the reason, no paid/wanted/reserved, your schedule), proof, free founding offer. Music offset 1.365 s like `cohort1`; glow data from `audio_data.py`. Poster 1.0 s (hook, before the badge). Committed in `docs/marketing/media/why-2026-10-10/`. |


### Platform pack (MW-130)

`pack` (15.0 s, 450 frames) and `bumper` (6.0 s, 180 frames) have their own template, `src/pack.html`, because they need per-format safe boxes (reels-stories: top 14%, bottom 35%, sides 6%; meta-feed, x, yt-bumper: 5%). It takes the shared scene CSS and the logo SVG from `template.html` (so they cannot drift) and its own timeline: hook 0 to 3 s, plain words 3 to 6.05 s (fade-out 5.90 to 6.05 s, overlapping the e-mail fade-in), alert e-mail 6.05 to 11 s, outro from 11 s with one H-to-I raise at 12.0 s that holds (no numeric claim, so no footnote). The bumper is hook 0 to 2 s, alert card 1.85 to 4.55 s, robot, name and URL 4.5 to 6 s (raise at 4.9 s). Output is `marketing/video/out/<format>-<lang>.mp4` and `.jpg` (poster 1.0 s). Music offset 1.365 s like `cohort1`; the glow data is `shared/audio-data/pack.json` and `bumper.json`.

Review overlay: `SAFE_ZONE_OVERLAY=1 scripts/render-video.sh pack all all` writes to `out/safe-zone/` with a white page and a red tint outside the safe box (variable `debug=on`); any text or logo showing outside the tint's clean area is a violation. Exits are opacity-only, because a slide would leave the box. `hyperframes check` cannot take variables, so the script checks the Dutch copy from a copy of the project whose default language is `nl`. Committed renders: `docs/marketing/media/platform-pack-2026-10-11/`.

## Add a variant or a format

- **Variant.** (A cut that needs safe boxes or a new format goes in `src/pack.html` and a `VARIANTS` row with `template`, `formats`, `mail`, `outro` and `l0`.) Add a row to `VARIANTS` in `build.py` (length, `shift`, scene 5 and 6 timings, logo sound time, music offset), put its lines in the template under `@only <name>` or add the name to an existing `@only` list, and put its per-frame music energy in `shared/audio-data/<name>.json` (30 fps, 8 bands, from the music at the same offset; `python3 -I marketing/video/audio_data.py <name> <total_s> <music_offset_s>` writes it). Add its poster time to `render-video.sh`. Then render all formats and languages and review frame by frame.
- **Format.** Add the size to `FORMATS` in `build.py` and the format name to the `case` in `render-video.sh`; the CSS has `.fmt-<name>` rules next to `.fmt-landscape` and `.fmt-vertical` (caption width, text sizes, `.ui` zoom) that need a matching set. Check every scene at 1:1.
- **Language.** Add a block to the `T` object in the template and the code to `render-video.sh`.

## What is where

| Path | Content |
|---|---|
| `src/template.html` | One template for all variants, formats and languages |
| `build.py` | Variant table, sound cues, music volume lane; writes `.build/` |
| `shared/assets/` | Geist fonts (with OFL.txt), music, Kenney sound effects, GSAP, brand SVGs |
| `shared/audio-data/` | Per-variant music energy that drives the background glow |
| `audio_data.py` | Writes `shared/audio-data/<variant>.json` for a new variant |
| `compare.sh` | Duration, frame count and PSNR comparison with a reference render |
| `CREDITS.md` | Music, sound, font and tool credits |
| `out/`, `.build/` | Generated, gitignored |
