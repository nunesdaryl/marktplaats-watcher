# `why` launch video drafts — 10 October 2026

Drafts for review. **Nothing has been posted.** One variant of the launch video that sells the *why*: the pains of hunting on Marktplaats yourself, what Marktplaats Watcher gives you instead (one benefit per card), proof, and the free founding offer (pain, outcome, call to action). The app UI stays in English in both languages; captions, footnotes and the outro change. Check live offer capacity and all claims again before publishing.

| Video | Poster | Format | Language | Duration |
|---|---|---|---|---|
| [brag-landscape-en-why.mp4](brag-landscape-en-why.mp4) | [jpg](brag-landscape-en-why.jpg) | 1920×1080, 30 fps | English | 40.3 s (1209 frames) |
| [brag-landscape-nl-why.mp4](brag-landscape-nl-why.mp4) | [jpg](brag-landscape-nl-why.jpg) | 1920×1080, 30 fps | Dutch | 40.3 s |
| [brag-vertical-en-why.mp4](brag-vertical-en-why.mp4) | [jpg](brag-vertical-en-why.jpg) | 1080×1920, 30 fps | English | 40.3 s |
| [brag-vertical-nl-why.mp4](brag-vertical-nl-why.mp4) | [jpg](brag-vertical-nl-why.jpg) | 1080×1920, 30 fps | Dutch | 40.3 s |

Captions (EN and NL): [share-copy-why.txt](share-copy-why.txt). Made with `scripts/render-video.sh why all all` (Hyperframes 0.8.145; see [HOW-TO](../../../../marketing/video/HOW-TO.md)). The poster is the hook frame without the "Reserved" badge (1.0 s) and is also baked in as frame 0.

## Beats

| Time | Beat | EN on screen |
|---|---|---|
| 0–3.0 s | Hook (as the FDE Cohort 1 version), badge at 1.6 s | Always just too late for that Marktplaats deal? |
| 3.0–8.6 s | Pain, three lines, footnote | About 1 in 3 results isn't what you searched for. · 10 paid ads on the first page. · Wanted ads and reserved ones in between. |
| 8.6–15.1 s | Turn, footnote | Hear about it when your dream item pops up. Checked for you, as often as every 15 minutes. Not one daily list of 812 new ads. |
| 15.1–28.3 s | Four outcome cards | Say it in plain words — no filters. · Only the ones worth a look, with the reason. · No paid placements, wanted ads or reserved ones. · On your schedule — from every 15 minutes to once a day. |
| 28.3–34.81 s | Proof | 100% of 'great match' picks were real matches (footnote) |
| 33.81–40.3 s | Offer | Logo (still, then one H→I loop from 36.5 s), "Free for 30 days for the first 100 users.", URL, fine print |

Outcome cards start at 15.1 / 17.85 / 21.2 / 24.2 s. Footnotes are fully visible about 5.2 s or longer (pain 5.3, turn 6.1, proof 5.4). Dutch lines are in the template (`marketing/video/src/template.html`) and in the captions file.

## Claims and sources

| On-screen claim | Source and date |
|---|---|
| About 1 in 3 results was not what we searched for: 9 of 25 listings not a Mac mini, 10 paid placements, first results page for 'mac mini', 29 Sep 2026 | [Our dated check](../../competitors/marktplaats-saved-search.md) ("Noise, measured live") |
| Saved-search notifications in our own account, 8–10 Oct 2026: one per search per day, e.g. 'There are 812 new listings for your search: playstation 5' | [Notifications observed in our own account](../../competitors/marktplaats-saved-search.md) and the [cropped screenshot](../../competitors/evidence/2026-10-10-marktplaats-notifications.png). It matches Marktplaats' PC, Android and iOS help pages ("dagelijks", checked 29 Sep 2026); its general help page says "direct … als eerste", so the video always says "in our own account" with the dates. |
| Checked as often as every 15 minutes; schedule choices (every 15 minutes, every morning at 8, weekends only) | [Landing page](../../../../frontend/src/Landing.jsx), `frontend/convex/crons.ts` (15-minute minimum) |
| Plain words, no filters; 9/10 row with a reason | [Landing page](../../../../frontend/src/Landing.jsx), sample row as in the [10 Oct launch video](../launch-2026-10-10/README.md) |
| No paid placements, wanted ads or reserved ones | In code: paid placements removed before scoring (`agent.py` `priorityProduct`), reserved listings skipped (`agent.py` `reserved`), wanted ads never alerted (`checker.ts` `!item.wanted_ad`). Verified by the station. |
| 100% of 'great match' picks were real matches (53 listings, 6 watches, median of 3 runs) | [Evaluation report](../../../../evals/report.md), 10 Oct 2026 |
| Free for 30 days for the first 100 users; free portfolio project, not affiliated with Marktplaats | [Landing page](../../../../frontend/src/Landing.jsx) |

Comparative-advertising basics: every statement about Marktplaats is a dated fact from our own check with its footnote on screen (footnotes visible about 5 s or longer); no Marktplaats logo, colours, fonts or screenshots; the sample rows are our own style; no claim about shops or dealers; no "never", "first", "instant" or "never miss".

## Checks

Builder self-checks after the station's first review: `hyperframes@0.8.145 check` 0 errors for landscape and vertical; durations, sizes and frame counts by ffprobe (1209 frames, 30 fps); 1:1 frames of the pain, turn, outcome and outro scenes for orphans and line breaks. The `original`, `animated-logo` and `cohort1` generated HTML is unchanged except for an equivalent element lookup. The full frame-by-frame review (contact sheets, logo centroid, end audio) is repeated by the station.
