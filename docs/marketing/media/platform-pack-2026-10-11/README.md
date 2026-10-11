# Platform video pack: 15 s cuts and 6 s bumper — 11 October 2026

**Drafts — not posted. Ads launch only after the Marktplaats call and Daryl's go.** Short, platform-shaped cuts of the launch video for people scrolling past: three 15-second cuts and a 6-second YouTube bumper, each in English and Dutch, all opening with the "too late for that Marktplaats deal?" problem. The app screens stay in English in both languages; captions, claims and the outro change. Check live offer capacity and every claim again before publishing.

| Video | Poster | Placement | Size | Length | Language |
|---|---|---|---|---|---|
| [reels-stories-en.mp4](reels-stories-en.mp4) | [jpg](reels-stories-en.jpg) | Instagram / Facebook Reels and Stories (9:16) | 1080×1920, 30 fps | 15.0 s (450 frames) | English |
| [reels-stories-nl.mp4](reels-stories-nl.mp4) | [jpg](reels-stories-nl.jpg) | same | 1080×1920 | 15.0 s | Dutch |
| [meta-feed-en.mp4](meta-feed-en.mp4) | [jpg](meta-feed-en.jpg) | Meta feed (4:5) | 1080×1350 | 15.0 s | English |
| [meta-feed-nl.mp4](meta-feed-nl.mp4) | [jpg](meta-feed-nl.jpg) | same | 1080×1350 | 15.0 s | Dutch |
| [x-en.mp4](x-en.mp4) | [jpg](x-en.jpg) | X (16:9) | 1920×1080 | 15.0 s | English |
| [x-nl.mp4](x-nl.mp4) | [jpg](x-nl.jpg) | same | 1920×1080 | 15.0 s | Dutch |
| [yt-bumper-en.mp4](yt-bumper-en.mp4) | [jpg](yt-bumper-en.jpg) | YouTube bumper (16:9) | 1920×1080 | 6.0 s (180 frames) | English |
| [yt-bumper-nl.mp4](yt-bumper-nl.mp4) | [jpg](yt-bumper-nl.jpg) | same | 1920×1080 | 6.0 s | Dutch |

H.264 + AAC, 30 fps. The poster is the hook frame (1.0 s, before the "Reserved" stamp) and is also baked in as frame 0. Share captions per platform (EN and NL, X at 280 characters or fewer): [share-captions.txt](share-captions.txt). Made with `scripts/render-video.sh pack all all` and `scripts/render-video.sh bumper all all` (Hyperframes 0.8.145; see [HOW-TO](../../../../marketing/video/HOW-TO.md)). Each video reads without sound; the music bed fades out over the last 1.5 s (bumper 1.2 s).

## Beats

15 s cuts (`reels-stories`, `meta-feed`, `x`):

| Time | Beat | EN on screen |
|---|---|---|
| 0–3 s | Hook, "Reserved" stamp at 1.6 s | Always just too late for that Marktplaats deal? |
| 3–6.05 s | Plain words, typing | Tell it what you want, in plain words. |
| 6.05–11 s | Alert e-mail with the 9/10 score and the reason | Only the ones worth a look reach your inbox, with the reason. |
| 11–15 s | Logo at rest, raises the binoculars at 12.0 s (H→I, 0.72 s) and holds | Marktplaats Watcher · Free for 30 days for the first 100 users. · marktplaats-watcher.vercel.app · Not affiliated with Marktplaats |

Bumper (`yt-bumper`): 0–2 s "Too late for that Marktplaats deal?" (no card) · 1.85–4.55 s "It e-mails you the ones worth a look." over the alert e-mail card · 4.5–6 s robot (raise at 4.9 s), name, URL, "Not affiliated with Marktplaats". Dutch: "Altijd net te laat voor die ene Marktplaats-deal?" / "Te laat voor die Marktplaats-deal?", "Zeg in gewone woorden wat je zoekt.", "Alleen wat de moeite waard is, komt in je inbox, met uitleg waarom.", "Hij mailt alleen wat de moeite waard is.".

Safe zones: `reels-stories` keeps all text and the logo outside the top 14%, bottom 35% and 6% side margins; `meta-feed`, `x` and `yt-bumper` keep 5% margins. A review overlay (`SAFE_ZONE_OVERLAY=1 scripts/render-video.sh pack all all`, written to the gitignored `marketing/video/out/safe-zone/`) tints everything outside the safe box; the station's pixel check found no text or logo outside it in any frame of the eight videos.

## Claims and sources

| On-screen claim | Source and date |
|---|---|
| Free for 30 days for the first 100 users; not affiliated with Marktplaats | [Landing page](../../../../frontend/src/Landing.jsx) |
| Tell it what you want in plain words; only the ones worth a look, with the reason; score and reason in the alert e-mail | [Landing page](../../../../frontend/src/Landing.jsx), sample as in the [10 Oct launch video](../launch-2026-10-10/README.md) |
| "Always just too late for that Marktplaats deal?" | The cohort-1 hook (a question, not a claim) |

No numeric claim is on screen in these cuts (the 100% proof stays in the longer films and on the landing page). No other claims. No "first", "instant", "never miss" or invented urgency; no Marktplaats logo, colours or interface (the sample card is our own style). No claim about shops or dealers.

## Known limits (for the reviewer)

- **No proof scene.** The 15 s cuts carry no numeric claim, so no footnote is needed; the 100% result lives in the longer films and on the landing page.
- **Transitions.** The plain-words headline fades out over 0.15 s (5.90–6.05 s), then the e-mail fades in: no fully blank frame, 3 faint frames during the hand-over (6.03–6.13 s), measured frame by frame. The e-mail is settled about 4.4 s.
- **Outro.** The logo is at rest from 11.0 s and raises at 12.0 s; the offer is on screen about 3.85 s.
- **Bumper.** The hook is shortened to "Too late for that Marktplaats deal?" so it fits 2 s at 0.3 s per word. The logo step on the bumper reaches 3.19 px per frame (smooth ease, accepted).
- The 24.5, 27 and 30 s films are unchanged.

## Checks

`hyperframes@0.8.145 check` 0 errors for every format and both languages (the Dutch copy is checked from a copy whose default language is `nl`); ffprobe sizes, 30 fps, H.264 + AAC, 450 frames for the 15 s cuts and exactly 180 for the bumper; no fully blank frame in the 6 s transition, 3 faint frames during the hand-over (measured on the frames, see Known limits); the logo raise tracked per frame (orange lens centroid): starts at rest, rises the logo's 6.5 units scaled to the rendered size (21.3 px at 210 px, 22.3 px at 220 px, 19.3 px at 190 px), no frame step above 3.2 px, horizontal drift below 1 px, ends held.
