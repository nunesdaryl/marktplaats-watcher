# `animated-logo` and FDE Cohort 1 launch video drafts — 10 October 2026

Drafts for review. **Nothing has been posted.** These are the committed renders of two variants of the 10 October launch video, made from the same template as the [original](../launch-2026-10-10/README.md) and the [`why`](../why-2026-10-10/README.md) videos. The app UI shown is in English in both languages; the Dutch videos use Dutch captions, footnotes and outro copy. Check live offer capacity and all claims again before publishing.

## The two variants

- **`animated-logo`, 30.2 s, 906 frames.** The original story, with no logo tilt. At the end the robot's H→I binocular loop plays once, from 26.2 s. Poster frame: 12.5 s.
- **`cohort1`, 33.2 s, 996 frames.** Starts with a problem hook, "Always just too late for that Marktplaats deal?", which came from FDE cohort feedback (Reserved badge at 1.6 s). Then the animated-logo film, shifted by 3.0 s, so the loop starts at 29.2 s. Poster frame: 1.0 s (the hook, before the badge).

Timing after station review (MW-134): the score scene is 0.6 s longer (Dutch reading time, and the struck-through "0/10" rows with the green "E-mailed." hold 1.26 s), the e-mail scene 0.2 s longer, and the 100% proof scene 0.4 s longer (footnote readable 5.0 s or more). The Dutch footnote says "uit 6 zoekopdrachten", and the vertical Dutch fine print breaks after "portfolioproject".

## Files

| Video | Poster | Format | Language | Duration |
|---|---|---|---|---|
| [brag-landscape-en-animated-logo.mp4](brag-landscape-en-animated-logo.mp4) | [jpg](brag-landscape-en-animated-logo.jpg) | 1920×1080, 30 fps | English | 30.2 s (906 frames) |
| [brag-landscape-nl-animated-logo.mp4](brag-landscape-nl-animated-logo.mp4) | [jpg](brag-landscape-nl-animated-logo.jpg) | 1920×1080, 30 fps | Dutch | 30.2 s (906 frames) |
| [brag-vertical-en-animated-logo.mp4](brag-vertical-en-animated-logo.mp4) | [jpg](brag-vertical-en-animated-logo.jpg) | 1080×1920, 30 fps | English | 30.2 s (906 frames) |
| [brag-vertical-nl-animated-logo.mp4](brag-vertical-nl-animated-logo.mp4) | [jpg](brag-vertical-nl-animated-logo.jpg) | 1080×1920, 30 fps | Dutch | 30.2 s (906 frames) |
| [brag-landscape-en-cohort1.mp4](brag-landscape-en-cohort1.mp4) | [jpg](brag-landscape-en-cohort1.jpg) | 1920×1080, 30 fps | English | 33.2 s (996 frames) |
| [brag-landscape-nl-cohort1.mp4](brag-landscape-nl-cohort1.mp4) | [jpg](brag-landscape-nl-cohort1.jpg) | 1920×1080, 30 fps | Dutch | 33.2 s (996 frames) |
| [brag-vertical-en-cohort1.mp4](brag-vertical-en-cohort1.mp4) | [jpg](brag-vertical-en-cohort1.jpg) | 1080×1920, 30 fps | English | 33.2 s (996 frames) |
| [brag-vertical-nl-cohort1.mp4](brag-vertical-nl-cohort1.mp4) | [jpg](brag-vertical-nl-cohort1.jpg) | 1080×1920, 30 fps | Dutch | 33.2 s (996 frames) |

Each poster is also baked into its video as frame 0.

## Claims and sources

Same claims and sources as the [original's README](../launch-2026-10-10/README.md#claims-and-sources) (plain-words search and schedule, 0 to 10 score with a reason, sample rows, sample e-mail, the 100% "great match" result from the 10 October test of 53 listings from 6 watches with the median of 3 runs, the free offer for the first 100 users, and the not-affiliated fine print). The `cohort1` hook adds no claim of its own. The on-screen footnotes are part of the videos.

## How these were made and how to re-render

Hyperframes 0.8.145 and brag `latent-spaces/brag@8531ccb9f471`, both pinned. Never run `hyperframes init`. Source and credits: [marketing/video/HOW-TO.md](../../../../marketing/video/HOW-TO.md), [CREDITS.md](../../../../marketing/video/CREDITS.md).

```bash
scripts/render-video.sh animated-logo all all
scripts/render-video.sh cohort1 all all
```

Output goes to the gitignored `marketing/video/out/`. `marketing/video/compare.sh <new.mp4> <reference.mp4>` checks duration, frame count and PSNR against these files (35 dB or more). MW-129 showed the template reproduces the station-reviewed renders on every frame (at least 51 dB PSNR; 6 of 12 bit-identical), so a re-render can differ slightly in encoding.

New variants, formats or committed renders go through the factory. Nothing here is posted, uploaded or paid for.
