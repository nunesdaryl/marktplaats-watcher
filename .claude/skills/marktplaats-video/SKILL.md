---
name: marktplaats-video
description: Use when making, changing, rendering or reviewing a Marktplaats Watcher video, launch video, ad creative, variant or platform cut (landscape, vertical, EN or NL). Covers the one render command, the pinned tools, the claim and readability rules, and the frame-by-frame review.
---

# Marktplaats Watcher video

One template makes every variant, format and language. Detail: [`marketing/video/HOW-TO.md`](../../../marketing/video/HOW-TO.md). Credits: [`marketing/video/CREDITS.md`](../../../marketing/video/CREDITS.md).

```bash
scripts/render-video.sh <original|animated-logo|cohort1> [landscape|vertical|all] [en|nl|all]
marketing/video/compare.sh <new.mp4> <reference.mp4>   # duration, frame count, PSNR >= 35 dB
```

Output goes to the gitignored `marketing/video/out/`; the poster is also baked in as frame 0.

## Rules

1. **Tools.** Render only through `scripts/render-video.sh`, which runs Hyperframes pinned as `npx -y hyperframes@0.8.145` (`check`, `render`) with telemetry off. brag is pinned to `latent-spaces/brag@8531ccb9f471`. **Never run `hyperframes init`**: it installs skills into ~/.claude, ~/.agents, ~/.cursor, ~/.junie, ~/.copilot, ~/.hermes and ~/.openclaw. Never run an unpinned `npx hyperframes`. Write output only to the gitignored folder.
2. **Claims.** Only from `evals/report.md`, the live dashboard or our own dated evidence (`docs/marketing/competitors/…`). Each claim gets an on-screen footnote readable for at least 5 s. Never write "never", "first", "instant" or "never miss". No Marktplaats logo, colours or interface. No shops or dealers claim while that filter is off.
3. **Languages.** Make EN and NL in the same pass and read the NL for natural wording.
4. **Readable.** At least 0.3 s per word, labels at least 0.8 s, no one-word last lines, clean first frames (no blink), at most 8 blank frames in a transition.
5. **Review every render frame by frame before showing anyone,** with the `video-frame-analysis` skill: `watch_video.sh <video> <out> native`; contact sheets only to navigate; 1:1 crops for all text; follow the logo through the H-to-I loop; check the audio levels at the end.
6. **Factory.** New variants, formats or committed renders go through the factory (spec, build, review, per-issue merge OK). Nothing is posted, uploaded or paid for.

## Variants and where the renders live

| Variant | Length | Renders |
|---|---|---|
| `original` | 24.5 s | Committed: `docs/marketing/media/launch-2026-10-10/` |
| `animated-logo` | 29.0 s (H-to-I loop from 25.0 s) | Not committed yet; render with the command above |
| `cohort1` | 32.0 s (problem hook first; loop from 28.0 s) | Not committed yet; render with the command above |

Open: the platform pack of cut-downs (MW-130) and the `why` variant (MW-131). Both build on this template.

## Change something

Edit `marketing/video/src/template.html` (scenes, strings, timeline; `@only` markers limit lines to variants) and the `VARIANTS` table or `sfx_cues` in `marketing/video/build.py`. HOW-TO.md lists the steps for a new variant, format or language.
