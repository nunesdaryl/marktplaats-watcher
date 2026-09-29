# Positioning audit: Marktplaats Watcher vs Marktplaats' own saved search

29 September 2026. Question from Daryl: how does the project differ from what Marktplaats already offers, what is the
USP, and is that clear through the whole journey, from the landing page to sign-up, app use and the alert?

**Sources:**

- Marktplaats' help pages: the general "Beheren opgeslagen zoekopdrachten" page plus its PC, Android and iOS versions, and the notification and search help. Read in Chrome, 29 Sep 2026.
- Daryl's logged-in Marktplaats account: the saved-searches page, `/notifications`, and a live "mac mini" search.
- Daryl's Gmail (read-only).
- This repo's code.
- The agent-skill-pack frameworks and the FDE course material.

An earlier draft of this audit assumed, from the general help page alone, that native alerts are "instant" and
"relevant". Daryl rejected it, and everything below was re-checked against primary sources and the live product.

## 1. The answers

**How we differ.** Marktplaats' saved search is a keyword match with a daily notice. Watcher reads each new listing,
judges it against what you asked for, and only e-mails the ones worth a look. Each one comes with a 0–10 score, a
one-line reason, and your schedule.

**The USP, in one line.** "Marktplaats' saved search sends every ad that contains your words, once a day. Marktplaats
Watcher reads each new ad for you and only e-mails the ones worth a look, with a score and the reason, when you
choose."

**Unique mechanism.** The listing is *read and judged*, not keyword-matched. The score and the one-line reason are the
visible proof of that. This is the "unspoken" mechanism: MPAlerts also reads listings with AI, but never shows why.

**Contrarian belief.** "A keyword match isn't a good match."

**Was it clear through the journey?** Not before this audit. The product never named the native feature, and
several lines sounded like it: "every 30 minutes … every new listing", and an e-mail heading reading "New on
Marktplaats for …". The scorecard in section 3 shows each step before and after the copy fixes.

## 2. Side by side (verified)

| | Marktplaats saved search | Marktplaats Watcher |
|---|---|---|
| Setup | Type keywords, set filters, click "Bewaar je zoekopdracht" | Say it in plain words in the chat (or the setup form), press Save |
| Matching | Keywords in title and description, spelling variants, plurals, `*` | Marktplaats' search plus your price and distance, then the model reads each new listing against what you asked |
| Judgement | None: every ad that matches counts | Score 0–10 and a one-line reason for every new listing |
| What you get | Every match | Only great (8+), good (6+) or all, your choice |
| When | Daily, per the PC, Android and iOS help pages ("dagelijks een melding"); no setting | You choose: every 15 minutes up to weekly, or times like "weekdays at 8" |
| Channels | Two switches: push (app) and e-mail | E-mail (one per check, not one per ad) |
| Coverage | All results | Every listing placed since the last check (since 29 Sep) |
| Feedback | None | Rate each alert: good match, or not right and why |
| First check | n/a | Silent: you only hear about new listings |
| Price | Free | Free, up to 5 watches |
| Terms | Official | Unofficial: robots.txt and terms art. 7.3 risk accepted (MW-14 is the official-API route) |

**Measured noise.** A live "mac mini" search, page 1: 25 unique listings. About 9 weren't a Mac mini (adapters, docks,
other Macs, wanted ads), and 10 were paid placements. The order is partly bought.

**One contradiction to handle honestly.** The general help page says "direct een melding … als eerste", but the
platform pages say "dagelijks". Say "once a day, per its help pages", never "only once a day".

**The native alert, in practice.** Daryl's own saved search "mac mini 16gb" (e-mail on) produced no e-mails we could
find, spam and trash included.

## 3. The journey, before and after

| Step | Before | After (29 Sep) |
|---|---|---|
| Link preview (Google, LinkedIn) | "Marktplaats alerts that read the listings first…" | Names the saved search, then the difference: reads each new listing, only the ones worth a look, score and reason, when you choose |
| Landing hero | One example promised "every 30 minutes … every new listing", which is the native feature | All examples use a threshold ("good matches", "great matches only") |
| Landing proof | 9/10 e-mailed, 0/10 skipped (strong) | Unchanged |
| Landing comparison | None | "Not another saved search": two columns, sourced |
| Landing steps | Step 2 led with speed | Step 2: your schedule, "one e-mail with the good ones, not a ping per listing"; step 3 adds rating |
| Sign-up / onboarding | A keyword and price form, with no sign of the reading | Helper line: "We'll read every new listing for it and only e-mail the ones that fit, with the reason" |
| Empty chat | "…to get the good new ones by e-mail" | "…we read every new listing for you and e-mail only the good ones, with the reason" |
| Proposal saved | "Watch saved." | Adds the silent first check and what happens after |
| Notify "all" | Didn't say it's the native behaviour | "Most e-mails, like Marktplaats' own saved search" |
| Watch page, empty | "No new matches yet…" | "No good ones yet. Every check reads the new listings and only keeps the ones that fit…" |
| Alert e-mail | "New on Marktplaats for …" (sounds like the native feature) | "Worth a look on Marktplaats: …", and the footer says we read each listing |
| Alerts page | "that's how the scores get better" (nothing learns automatically) | "every rating is read to check and improve the scores" |
| Demo script and problem statement | "e-mails at most once a day" (unsourced) | Sourced wording, plus a 20-second answer to "why not the saved search?" |

**Still weak after these copy fixes** (feature work, not copy):

- Search mode shows no scores.
- The onboarding step is a form, not plain language.
- Nothing shows "we read N, sent 1".

## 4. Framework checks

- **Day 3 "five answers":**
    - ICP: Dutch second-hand hunters for a specific item.
    - Alternative: the saved search, or refreshing by hand.
    - Differentiator: the reading and judging with a reason. It's a capability, it's true, it's verifiable in a demo, and it's harder to copy than a keyword alert.
    - Value prop: fewer, better alerts, each with the reason.

    The landing page now names the alternative too; before, it never mentioned it.

- **Value Equation:** *perceived likelihood* comes from showing the reason (the 9/10 vs 0/10 sample) and the rating
  loop. *Effort*: plain words, one click to save. *Time delay*: as often as every 15 minutes, against a daily notice.
- **Awareness and sophistication:** buyers are solution-aware ("I know saved searches exist"), and "get notified" is a
  sophistication 3–4 claim that everyone makes. So the *mechanism* leads: read, score, explain. The new comparison
  block does exactly that.
- **Unique Mechanism:** named in plain words ("reads every new listing and scores it 0 to 10, with the reason"). No
  coined name yet; an optional name for the sieve is listed below.
- **Transformation test:** from "scrolling past chargers and docks every day" to "one e-mail with the two worth a
  look, and why". The landing sample shows this.

## 5. Risks

- **The help pages contradict themselves** (daily vs "direct"). Our wording is sourced and hedged.
- **Marktplaats is adding AI search** ("Nieuwe zoekfuncties begrijpen gewone taal", reported Feb 2026). Plain-language
  setup is not a lasting edge; the score and the reason are.
- **MPAlerts also filters with AI.** Our edge there is price (free) and showing the why.
- **Terms and robots.txt:** accepted for the demo. MW-14 applies for the official API.
- **No head-to-head proof yet:** we have never counted, over the same week, how many alerts the native saved search
  and Watcher send and how many are real matches.
- **Our own settings can contradict the pitch.** A watch set to "all" sends every listing. On 29 Sep Daryl's "iphone"
  watch sent 9–16 per e-mail. Demo with "good" or "great".

## 6. Next, as feature work (not in this change)

1. "We read N new listings, sent 1" in the e-mail and on the watch page: makes the sieve visible.
2. Scores and reasons in search mode.
3. Plain-language onboarding instead of the form.
4. A one-week head-to-head against the native saved search: same query, count alerts and real matches.
5. A feedback question: "What do you use today?"
6. Optional: a name for the mechanism (the sieve).

## 7. Demo lines

- **Opening (15 s):** "Marktplaats' own saved search matches the words you typed and sends a notice once a day, with no
  reason given. Search 'mac mini' and a third of the first page isn't a Mac mini."
- **If asked "why not the saved search?" (20 s):** see the end of `docs/demo/demo-script.md`.
- **Say out loud:** it's unofficial, the terms risk is accepted, and there's a plan (MW-14).
