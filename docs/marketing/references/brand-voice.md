# Brand Voice Document — Marktplaats Watcher

> Built with `02-onboarding /brand-voice`, **Mode 1 — Extract**, from existing product copy: the landing page
> (frontend/src/Landing.jsx), the chat system prompt (agent.py), schedule error messages (frontend/convex/schedule.ts),
> the alert e-mail (frontend/convex/checker.ts) and README.md. The Voice Test Loop was run without the owner; the
> samples are proposals for Daryl to rate. `[NEEDS REVIEW: rate each test sample "nailed it / close / way off"]`

## Voice Foundation

### Brand Personality
The friend at the dinner party who actually knows how Marktplaats works, answers the question you asked in one
sentence, gives you the number, and then mentions the catch without being asked. Calm, practical, a bit dry. Never
sells, never hypes.

Evidence from the product: "Say what you're after in plain words." / "Only the good ones reach your inbox." /
"A portfolio project, not affiliated with Marktplaats." / "Times look like 08:00."

### Always Sound Like
1. **Plain.** Everyday words, short sentences, the way you'd say it out loud. "Pick how often to check."
2. **Concrete.** Real items, real prices, real times, real postcodes. "A Mac mini with 16GB, under €500, near Utrecht."
   Numbers beat adjectives.
3. **Honest about limits.** Say what it doesn't do, what data is kept and for how long, and that it isn't Marktplaats.

### Never Sound Like
1. **Hype.** No "never miss a deal", "revolutionary", "AI-powered magic", exclamation marks.
2. **Corporate or legal.** No "leverage", "seamless", "solutions", "we are committed to your privacy".
3. **Urgent or fear-based.** No "before someone else grabs it!", countdowns, FOMO. Speed is not our promise.

## Voice Mechanics

### Vocabulary & Language
- **Register:** Simple
- **Jargon:** Avoided for end users ("the AI scores it", not "LLM ranking"); translated for LinkedIn (name the tool,
  then say what it does).
- **Profanity/Edginess:** Never
- **Contractions:** Always ("you're", "we've", "don't")
- **Sentence Length:** Short, with the occasional longer sentence that lists the facts.
- **Signature Words/Phrases:** watch, check, score, "a good one", "the good ones", "in plain words", "new listing",
  "worth a look", "Save watch", "great matches only / good matches / every new listing", "what we keep, and for how
  long".
- **Words to Avoid:** deal-sniping, instant, never miss, guaranteed, hack, smart (as a claim), revolutionary,
  seamless, powerful, unlock, "AI-powered", emojis as decoration, "Marktplaats" as if it were our brand.

### Formatting & Visual Rhythm
- **Paragraph Length:** 1–2 sentences
- **Line Breaks:** Standard; one idea per line in steps and e-mails
- **Lists & Bullets:** Frequently, numbered for steps
- **Bold/Italics:** Minimal; bold only for the first words of a step ("**Pick how often to check.**")
- **Emojis:** Never in product copy or e-mail. LinkedIn: max 1–2 functional (→), usually none.
- **Caps for Emphasis:** No
- **Dashes:** Avoid em dashes in public copy (LinkedIn writing rules); use a comma, full stop or colon.

### Emotional Range
- **Vulnerability:** Low in product copy. On LinkedIn Daryl can admit mistakes and trade-offs plainly (e.g. why the first
  check is silent, why the minimum is 15 minutes).
- **Humor:** Dry and rare, from the facts themselves ("I searched for a Mac mini. It found me a Cisco switch.").
- **Excitement:** Measured. Let the result carry it.
- **Conflict/Disagreement:** Direct and polite; state the trade-off and the reason.
- **Default Register:** Calm helpfulness.

## Voice Signature

### Catchphrases & Verbal Tics
- The product in one sentence, as a fill-in: "Check Marktplaats for a ___ ___ and e-mail me ___."
- "Only the good ones reach your inbox."
- "…and the reason for it."
- Fine print that opens with a plain question: "What we keep, and for how long".

### Voice Inspirations
`[NEEDS REVIEW: Daryl to name 2–3]` Suggested fits: gov.uk-style plain English (say the thing, then the detail);
Basecamp/37signals product copy (calm, opinionated, honest about limits).

### Recognition Factor
Every claim is concrete and every alert explains itself. If a sentence could be pasted onto any other app, rewrite it.

### Storytelling Style
Specific example first, principle second. Real items (Mac mini 16GB, Gazelle bike near 3511, Switch OLED under €200),
real times (every morning at 8, Fridays at 18:00), real numbers (first page, ~30 listings, a third have a location).

## Platform Adaptations

| Platform | Tone Shift | Length & Format | Example |
|---|---|---|---|
| Landing page / in-app | Core voice. Second person, imperative steps. | Headline sentence + one lede + 3 steps + fine print | "Say what you want. Pick when to check. Get only the listings worth a look." |
| Alert e-mail | Even shorter; facts first; footer explains why you got it. | Subject with count and label; one card per listing: title, €, city, score, reason | "2 new matches for Mac mini 16GB. Best: €430, Utrecht, scored 9/10: M2 16GB, well under the usual price." |
| Chat replies | Helpful, brief; explains empty results with numbers; never claims a watch is saved. | Bullets per listing | "Nothing under €500 with 16GB on the first page: 31 listings, 4 were Mac minis, all 8GB." |
| LinkedIn (Daryl, portfolio) | First person, builder's voice; more technical, still plain; shows decisions and trade-offs. | 500–1200 characters, short paragraphs, no hashtags, no em dashes | "My agent searched Marktplaats for a Mac mini and returned a Cisco switch. So I made it score every listing, and explain the score." |
| Dutch copy (future) | Same voice in Dutch, informal "je". | Same | "Zeg wat je zoekt. Kies wanneer we kijken. Je krijgt alleen de goede." `[NEEDS REVIEW: native check]` |

## LinkedIn Voice Profile

> The pack's LinkedIn Deep Dive questions were answered by inference from the operator brief.
> `[NEEDS REVIEW: all six strategy answers]`

### Content Strategie
- **Primary goal:** Portfolio credibility, leading to interviews and client conversations (FDE / AI-engineering work).
- **Brand association:** "Daryl ships real, safe, honest AI products end to end."
- **Content pillars:** (1) Building agents that propose, not act; (2) Shipping it properly: auth, secrets, tests,
  retention; (3) Honest limits and trade-offs (ToS, first page only, 15-minute floor); (4) Learning in public on the
  FDE course.
- **Audience transformation:** FROM "another student demo with a chat box" → TO "this person scopes, ships and runs
  a product like an engineer I'd hire."
- **Unique angle:** A working product with real users and stated limits, not a tutorial clone.
- **Content mix:** 40% process/how it was built, 25% decisions and trade-offs, 20% results/lessons, 15%
  behind-the-scenes of the course.

### LinkedIn Schrijfstijl
- **Persuasion:** Cautious ("this worked for me, here's the evidence").
- **Evidence style:** Both, a concrete story backed by a number or screenshot.
- **CTA style:** Soft ("Curious how others handle X") or none; link to the app/repo in the first comment.
- **Default length:** 800–1200 characters.

### Aspirational Posts
Skipped (none supplied). `[NEEDS REVIEW: paste 3–5 LinkedIn posts Daryl admires]`

## Voice Test Samples

### Casual/Social
Looking for a Gazelle bike near Utrecht? Tell the watcher in one sentence and pick when it should look, every
morning at 8 is fine. It reads each new listing, scores it, and only e-mails you the ones that fit. No app to keep
open.

### Persuasive/Sales
Marktplaats' own saved search sends you everything that matches the word. This reads every new listing first. A Mac
mini with 8GB when you asked for 16? Scored low, never sent. A 16GB M2 for €80 under the usual price, 6 km away? You
get it, with the reason. Free, up to five watches.

### Vulnerable/Personal
The first time I ran my Marktplaats agent, I asked for a Mac mini. One of the results was a Cisco network switch.
That's when I stopped trusting keyword matches and started scoring every listing, with a reason I could check.
`[NEEDS REVIEW: the Cisco switch result is real; confirm the "first time" framing and the causal story are accurate]`

## Metadata

- **Language:** English (Dutch variant to be added)
- **Created:** 2026-09-27
- **Last updated:** 2026-09-27
- **Mode used:** Extract (from existing product copy)
- **Status:** Partial (missing: owner ratings of test samples, voice inspirations, aspirational LinkedIn posts)

---

<!--
```json
{
  "voice": {
    "language": "English",
    "always": ["plain", "concrete", "honest about limits"],
    "never": ["hype", "corporate", "urgent / fear-based"],
    "vocabulary": {
      "register": "simple",
      "jargon": "avoided (end users) / translated (LinkedIn)",
      "profanity": "never",
      "contractions": "always",
      "sentence_length": "short"
    },
    "formatting": {
      "paragraph_length": "short",
      "line_breaks": "standard",
      "emojis": "never"
    },
    "emotional_range": {
      "vulnerability": "low in product, moderate on LinkedIn",
      "humor": "dry, rare, from the facts",
      "default_register": "calm helpfulness"
    },
    "signature": {
      "catchphrases": ["Only the good ones reach your inbox.", "Say what you're after in plain words.", "…and the reason for it."],
      "recognition_factor": "every claim is concrete and every alert explains itself"
    },
    "platforms": ["landing/in-app", "alert e-mail", "chat", "LinkedIn"],
    "linkedin": {
      "goal": "portfolio credibility -> interviews and client conversations",
      "pillars": ["agents that propose, not act", "shipping it properly", "honest limits and trade-offs", "learning in public"],
      "persuasion": "cautious",
      "evidence": "both",
      "cta_style": "soft",
      "default_length": "800-1200 characters"
    }
  },
  "metadata": {
    "created": "2026-09-27",
    "updated": "2026-09-27",
    "mode": "extract"
  }
}
```
-->
