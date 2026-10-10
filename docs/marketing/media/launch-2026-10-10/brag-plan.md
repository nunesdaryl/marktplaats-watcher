# Brag Plan: Marktplaats Watcher

Run: /brag FULL workflow (operator: "brag installed pinned, full mode", 10 Oct 2026). Skill pinned at
latent-spaces/brag@8531ccb9f471, Hyperframes run as `npx -y hyperframes@0.8.145`.

## What is this app?
You tell it what you want on Marktplaats in plain words, pick when it checks, and it e-mails you only the new
listings worth a look, each scored 0 to 10 with the reason. Impressive part: it reads every new listing and throws
out the docking stations, SSDs and Cisco switches a keyword saved search would have sent you.

## The angle
A calm, premium product film that lets the real UI do the talking: one search ("Mac mini with 16GB under €500")
goes through the whole product, from the chat box, to the watch it proposes, to the scored listings, to the
e-mail that arrives with the reason. The emotional beat is the sieve: three listings in, one out. Every claim is
the product's own copy or a dated number from `evals/report.md`.

## Hook (first 2-3 seconds)
Big headline lands at 0.2 s: "Tell it what you want, in plain words." (NL: "Zeg in gewone woorden wat je zoekt.")
Under it, the real chat start screen ("What are you looking for?") with the composer in **Watch it** mode (lilac
border), and the request typing itself in: "Mac mini with 16GB under €500, every morning at 8".

## Key moments (the middle)
- The chat proposes a watch (real Proposal card copy), a cursor presses **Save watch**, the card confirms in green.
- Three listings from the landing page's real check arrive one by one and get their score: 9/10 great (E-mailed),
  then two 0/10 low rows that strike through (a docking station; SSDs, a tracker and a Cisco switch).
- The alert e-mail slides in (real e-mail template copy): "Mac mini, 16GB, under €500: 1 new match, best 9/10 at €230".
- One proof card: "100%" of 'great match' picks were real matches, with its qualifier (test of 53 real listings
  from 6 watches, median of 3 runs, report of 10 Oct 2026).

## Outro / punchline
Robot logo + wordmark "Marktplaats **Watcher**", then "Free for 30 days for the first 100 users.", the URL
`marktplaats-watcher.vercel.app`, and the footer "A free portfolio project · Not affiliated with Marktplaats".
(NL adds "App in het Engels", because the app UI is English-only.)

## User flow worth showing
Entry: type a request in plain words in the chat (Watch it mode) → key action: the chat proposes a watch, you press
Save watch → result: new listings are scored with a reason and only the good one is e-mailed.

## Tone
- Preset: polished (with a light app-store touch)
- Creative direction: quiet premium product film; clean feature-card reveals, real UI, no jokes
- Interpretation: 6 short scenes with generous holds, soft crossfades and slides (0.4-0.6 s), one loud element per
  screen (lilac), restrained SFX, sentence case, no exclamation marks, no urgency.

## Format: landscape 1920x1080 AND vertical 1080x1920 (two renders), each in English and Dutch (4 videos)
## Duration: 24.5 s

## Visual identity (from the project)
- Background: #fbfaf7 (light `--bg`), surfaces #eeebe6 / #ffffff, hairline rgba(42,36,30,0.11)
- Accent: #0d6b62 (teal, light theme) with #4fd1bf (logo teal) for glow
- Highlight: #ddd0ff lilac `--tag` with ink #25124f
- Great score: #157346 on white
- Text: #1b1a18, secondary #5b5751, tertiary #6e6a63
- Display font: Geist 600, tracking -0.035em (self-hosted woff2 from frontend/public/fonts)
- Body font: Geist 400/500; Geist Mono for scores, prices, times
- Strongest visual element: the landing's lilac fill-in sentence pills + the scored sample list (9/10 great vs 0/10 low struck through)
- Logo: the live robot-with-binoculars mark (`frontend/public/icon.svg`, generated from `frontend/src/brand/logo.js`).
  Note: `docs/design/sieve/icons/` holds the older sieve symbol, not the robot; the README says the robot is the live logo.

## Share copy (draft)
EN: Marktplaats Watcher: tell it what you want in plain words, pick when it checks, and get an e-mail only for the
new listings worth a look, with the reason. Free for 30 days for the first 100 users. Not affiliated with Marktplaats.

## Audio direction
- Role: warm bed with sparse professional accents
- Music: happy-beats-business-moves-vol-12-by-ende-dot-app.mp3 (steady and clean; skill's pick for `polished`)
- Music treatment: starts at 0, volume ~0.30, 0.4 s fade-in, 1.6 s fade-out under the outro
- Music cue guidance: bundled preset read (`assets/music/cues/...vol-12...music-cues.json`), tempo 109.96 BPM.
  Strong cues to lock: 8.74 s (scoring scene starts), 13.11 s (e-mail arrives), 17.47 s (proof card).
  Beat grid for the scored rows: 8.74 / 9.83 / 10.93 (every other beat, so each row holds ~1.1 s before the next).
- Audio-reactive treatment: subtle; music bass/RMS makes a soft teal/lilac background glow breathe. No waveform or
  equalizer visuals; text never scales with audio.
- SFX posture: sparse, motion-matched, low HF-risk files (soft key ticks while typing, one click on Save watch,
  soft drops on scored rows, one card slide for the e-mail, a soft bong on the logo).
- Audio-coupled moments: typing in the composer, Save watch click, three scored rows, e-mail arrival, logo landing.
- Restraint rule: no SFX louder than the music bed's peaks; no repeated bright clicks; nothing on the proof card.

## Claims used (all must be checkable)
| On screen | Source |
|---|---|
| Tell it what you want, in plain words | README ("Tell it what you want on Marktplaats"), Landing lede "Say what you want in plain words" |
| Checks Marktplaats on your schedule; "every morning at 8" | Landing sentence/EXAMPLES, landing steps "Pick when to check" |
| Every new listing gets a score from 0 to 10, and a reason | Landing lede "We read every new listing, score it 0 to 10 and say why" |
| Only the ones worth a look reach your inbox, with the reason | Landing hero "e-mail me … with the reason"; design README "only the new listings worth a look" |
| Sample rows (Mac mini €230 9/10; docking station €74 0/10; SSDs, tracker, Cisco switch 0/10) | Landing "From a real check for 'Mac mini, 16GB, under €500'" |
| E-mail subject/body | docs/design/sieve/email/alert-email.example.html |
| 100% of 'great match' picks were real matches; 53 listings, 6 watches, median of 3 runs, 10 Oct 2026 | evals/report.md §1 (great precision 100%, median of 3 runs; range 94.1–100.0%) |
| Free for 30 days for the first 100 users | Landing places-left copy + Landing.test.jsx (cap 100); outreach drafts 6 Oct |
| A free portfolio project · Not affiliated with Marktplaats | Landing fine print |
No invented numbers, testimonials, user counts, "places left" counts or urgency.

## Fictional / substituted data
None needed: all listing data shown is the landing page's own public sample; no user names or e-mail addresses
appear. The e-mail is shown without any recipient address.

## Storyboard

### Scene 1 — Hook: plain words — 0.0–4.4 s (4.4 s)
Headline (EN "Tell it what you want, in plain words." / NL "Zeg in gewone woorden wat je zoekt.") slides up at 0.2 s
and holds. Below: chat start screen, h1 "What are you looking for?", composer with the "Search now | Watch it"
switch set to Watch it (lilac), request types in 1.0–3.4 s.
Sequential/interaction: yes — typed text, then the lilac send button press at ~3.7 s.
Audio intent: settle in, music fades up. Audio-coupled idea: soft key ticks on roughly every third character.
Transition mood: soft slide → Scene 2

### Scene 2 — The watch it proposes — 4.4–8.74 s (4.34 s)
Caption: EN "It checks Marktplaats on your schedule." / NL "Hij checkt Marktplaats wanneer jij wilt."
Proposal card (real copy): "Watch **Mac mini, 16GB, under €500**, checked **every morning at 8**, and e-mail you good
matches (listings scoring 6 or higher out of 10)." Buttons "Save watch" / "Adjust".
Cursor moves in and presses Save watch at ~6.9 s; card shows "Watch saved." in green.
Sequential/interaction: yes — simulated click. Audio: one soft click. Transition: soft crossfade → Scene 3

### Scene 3 — The sieve: scored listings — 8.74–13.11 s (4.37 s)
Caption: EN "Every new listing gets a score from 0 to 10, and a reason." / NL "Elke nieuwe advertentie krijgt een score
van 0 tot 10, met de reden." Label above list (real copy): From a real check for "Mac mini, 16GB, under €500".
Rows arrive at 8.74 / 9.83 / 10.93 s (beat-grid, every other beat), each holds; then the two 0/10 rows dim and
strike through at ~12.0 s, the 9/10 row gets a teal "E-mailed" emphasis.
Audio: soft drop per row. Transition: slide → Scene 4

### Scene 4 — The e-mail — 13.11–17.47 s (4.36 s)
Caption: EN "Only the ones worth a look reach your inbox, with the reason." / NL "Alleen wat de moeite waard is komt
in je inbox, met de reden." The alert e-mail card slides up (beat-locked 13.11 s): logo + Marktplaats Watcher,
"Mac mini, 16GB, under €500 · 1 new match", 9/10 badge, "Mac mini i5, 16 GB", "Scored 9/10, €230, Utrecht",
"Well under €500.", button "Open on Marktplaats", footer "Not affiliated with Marktplaats."
Audio: one card slide. Transition: crossfade → Scene 5

### Scene 5 — Proof — 17.47–21.28 s (3.81 s)
Big Geist Mono "100%" (beat-locked 17.47 s), line EN "of ‘great match’ picks were real matches" / NL "van de ‘great
match’-keuzes waren echt raak", footnote EN "Our test of 53 real listings from 6 watches, median of 3 runs (report of
10 Oct 2026)." / NL "Onze test met 53 echte advertenties uit 6 watches, mediaan van 3 runs (rapport van 10 okt 2026)."
Audio: none, let the music carry. Transition: soft crossfade → Scene 6

### Scene 6 — Outro — 21.28–24.5 s (3.22 s)
Robot logo scales in, wordmark "Marktplaats **Watcher**", then the offer line (EN "Free for 30 days for the first
100 users." / NL "30 dagen gratis voor de eerste 100 gebruikers."), URL pill `marktplaats-watcher.vercel.app`,
footer (EN "A free portfolio project · Not affiliated with Marktplaats" / NL "Een gratis portfolioproject · Niet
verbonden aan Marktplaats · App in het Engels"). Holds to the end while music fades.
Audio: soft bong on logo landing (~22.37 s strong cue). Transition: end.

Scene total: 4.4 + 4.34 + 4.37 + 4.36 + 3.81 + 3.22 = 24.5 s.

**Music mood for this video:** steady, clean, quietly upbeat
**Audio summary:** a clean bed fades up under the typing, small UI accents follow the actions, the e-mail and proof
land on strong beats, and the logo gets one soft bell while the music fades.
