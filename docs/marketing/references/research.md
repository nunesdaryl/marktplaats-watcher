# Market & Product Research Document — Marktplaats Watcher

> Built with `02-onboarding /research` (7-phase structure), fed by `04-researcher /last30days`-style social
> listening and `/analyseer-concurrent`. The pack's `last30days.py` script is not installed in the pack (only its
> sync script is), so listening was done by hand with WebSearch/WebFetch on 2026-09-27.
>
> **Evidence rules:** quotes are verbatim, under 15 words, with the source URL. "Paraphrase" means a search-engine
> summary I could not open myself; treat as weaker. Nothing is invented. Competitor claims about Marktplaats are
> marketing by interested parties and are labelled as such.
>
> **Coverage gap:** Reddit (r/thenetherlands, r/Netherlands) and X could not be fetched from this environment
> (reddit.com is blocked for the crawler; no X API key configured). Tweakers forum threads did not surface in
> search. `[NEEDS REVIEW: Daryl to spend 20 minutes searching Reddit/Tweakers by hand for "marktplaats melding",
> "zoekopdracht opslaan", "te laat" and paste 5–10 quotes into testimonials.md]`

## Marketing Brain Dump

### Market Awareness
**Solution-aware**, sliding into product-aware. Second-hand hunters already know the problem (good listings go fast,
searching is tedious, results are noisy) and many know a solution exists: Marktplaats' own saved search, and a whole
category of paid alert apps (MarktAlert, MPAlerts, Marktplaats Scanner, DealFinder, self-hosted Telegram bots).
They do not know *this* product. Implication (Schwartz / strategist SKILL): name the desire in the headline, prove it
works (show a real alert with score and reason), then show the mechanism (AI reads every listing).

Market sophistication: **stage 3–4.** "Get notified of new listings" and "be the first" are claimed by everyone.
MPAlerts already claims AI filtering. A new mechanism alone is not enough; the angle has to be *calm + explained*:
fewer e-mails, each with a reason, on a schedule you chose.

### Headline Ideas
[TO BE FILLED BY COPYWRITING] Starting points, not tested:
- "Marktplaats, checked for you. Only the good ones reach your inbox."
- "Say what you want. Pick when to check. Get only the listings worth a look."
- "Every new listing, read and scored. You only hear about the good ones."

### Offer Ideas
[TO BE FILLED BY STRATEGY] Free. No offer to sell (operator decision). The "offer" for the LinkedIn audience is
Daryl's skills, not the tool.

### Overall Ideas
- Don't fight on speed. Competitors check every 3 minutes or "within seconds"; this checks every 15 minutes at best.
- Fight on signal-to-noise and explanation: "scored 8/10: 16GB M2, €80 under the usual price, 6 km away".
- The "mac mini → Cisco switch" example is a perfect, honest demo of why scoring exists.

## Company & Product

### Who Is The Company
Not a company. A free MVP by Daryl Nunes (Forward Deployed Engineer course student, Netherlands), built for his
LinkedIn product portfolio. Not affiliated with Marktplaats.

### Products
One free web app (digital, service): Marktplaats Watcher, https://marktplaats-watcher.vercel.app

### What The Product Does
Before: you open the Marktplaats app several times a day, scroll past business listings and irrelevant hits, or rely
on a once-a-day saved-search e-mail that lists everything. After: you describe what you want once, pick when it should
check, and get an e-mail only when a new listing clears the bar you set, each with a score and a reason.

### Features
- Sign in with Clerk (e-mail).
- Chat search of Marktplaats in plain English or Dutch.
- Chat proposes a watch; user clicks Save (up to 5 watches).
- Schedules: every 15/30 min, every 1/3/6/12 h, daily at up to 4 times, chosen weekdays at a time (Amsterdam time).
- Filters: max price, must-include spec, postcode + radius (PDOK geocoding).
- LLM score 0–10 + one-line reason per new listing; alert level great (8+) / good (6+) / all.
- First check records existing listings silently.
- E-mail alerts from marktplaats-watcher@agentmail.to, with "why you get this" footer and manage/pause link.
- 30-day retention, daily purge, "Delete my data".
- Stack: React/Vite, FastAPI + LangChain tool-calling agent, Convex (DB + crons), Clerk, AgentMail, Vercel; tests + CI.

## Value & Positioning

### Benefits
- Stop refreshing: the checking happens on your schedule.
- Less noise: irrelevant hits (wrong product, accessories, business listings) are scored low and never reach you.
- Faster decisions: every alert says why it's worth a look.
- Low effort: one sentence sets up a watch.
- Peace of mind on privacy: short retention, one-click delete.

### Competitive Advantages & Claims
| Claim | Provable? |
|---|---|
| Free, no trial, no card | Yes (no billing exists) |
| Score 0–10 + reason on every new listing | Yes (agent.py `rank_listings`, e-mail shows it) |
| Plain-language setup, chat proposes / you confirm | Yes |
| Flexible schedule incl. weekdays and up to 4 daily times | Yes (schedule.ts) |
| 30-day retention, one-click delete | Yes |
| Better relevance than keyword alerts | Plausible, **not measured** `[NEEDS REVIEW: run a small eval]` |

### Common Use Cases
- A specific electronics spec: "Mac mini with 16GB under €500" (must-include 16gb).
- A bike near home: "Gazelle bike within 10 km of 3511".
- A console on a budget: "Nintendo Switch OLED under €200, Fridays at 18:00".
- Furniture for a move, checked every morning. `[NEEDS REVIEW: assumed]`

## Customer Profile

### The Customer Now
Adults in the Netherlands (students to mid-career, roughly 20–45) who buy second-hand to save money or for
sustainability, usually hunting one specific item at a time, often in university/commuter cities. They check the
Marktplaats app repeatedly, have tried the saved search, and find alerts either late or noisy.
`[NEEDS REVIEW: demographics are assumptions, not sourced data]`
Context: Marktplaats is the largest Dutch classifieds site, ~350,000 new ads a day (paraphrase of Wikipedia via
search, https://en.wikipedia.org/wiki/Marktplaats.nl).

### The Customer After
Opens one e-mail, sees two listings scored 8 and 9 with a reason, taps the good one, messages the seller. Feels in
control and not glued to the app.

### Wants & Needs (Surface Level)
- "Tell me when it's listed." (Viva forum, 30-01-2025: "kun je bij Vinted emailnotificaties krijgen als er nieuwe
  artikelen zijn" https://forum.viva.nl/mode-beauty/emailnotificaties-op-vinted-bij-nieuwe-artikelen/list_messages/509984)
- A good price for a specific spec, near home.
- Not having to check manually.

### What Customers Don't Want
- Being too late: "Alleen krijg je helaas niet instant een melding helaas." (Almdudler, 05-05-2024,
  https://www.viafora.nl/forum/digital/zoekfunctie-van-marktplaats)
- Repetitive, low-value notifications: "En constant hetzelfde plaatje in de melding" (same thread).
- Clutter from traders: "No longer dealing with the same bulk trader cluttering results" (testimonial on a
  competitor site, https://mpalerts.nl/).
- Being scammed or wasting trips (32% of buyers report a scam on second-hand marketplaces, UK survey, paraphrase via
  search, https://www.aol.com/third-buyers-experienced-scam-second-230100096.html). Out of scope for this product.

### Desires (Ranked By Power)
1. **Winning the good deal** (not losing it to someone quicker) — strong, but competitors own "speed".
2. **Control / not wasting time** — freedom from refreshing the app.
3. **Being a smart buyer** — the identity of someone who pays a fair price.
4. **Calm** — no notification overload.
5. **Sustainability / thrift identity** — secondary. `[NEEDS REVIEW: ranking is inferred]`

## Struggles & Objections

### Day To Day Struggles
- Checking the app "every day" by hand: "Elke dag even kijken" (Viva forum reply, 2025, URL above).
- Built-in alerts arrive once a day at the time the search was saved (Boarn, 06-05-2024, Viafora thread, paraphrased
  by the fetch tool; MarktAlert also states native alerts come "maximaal één keer per dag", https://marktalert.nl/).
- Search results full of business and promoted listings: two Chrome extensions exist just to strip them,
  "Marktplaats zonder spam" and "Cleanplaats - Marktplaats zonder spam" (Chrome Web Store titles,
  https://chromewebstore.google.com/detail/cleanplaats-marktplaats-z/peebdbeclpkljmfocjifjpjlngfpfhjp).
- Keyword search matches the wrong things (observed in this product: "mac mini" returned a Cisco network switch).

### Questions Customers Have
Before: Is it safe / legit? How is it different from saving a search? How fast? Is it free? Does it do Vinted or
2dehands? After: Why no e-mail yet? What does the score mean? Why is this 5/10?

### Other Solutions For Main Desires
- **Do nothing / refresh the app** (most common).
- **Marktplaats saved search** ("Bewaarde zoekopdrachten").
- **Paid/freemium alert apps:** MarktAlert, MPAlerts, Marktplaats Scanner, DealFinder, Marketplace Monitor.
- **Self-hosted bots / scripts:** mrktpltsbot (Telegram), nagsterFVZ/marktplaats-scraper (Pushover),
  marktplaats-alert-bot (Discord), marktplaats-monitor (desktop → Telegram), Apify actors.
- **Other platforms' own tools:** Vinted saved searches (counter only, no notification), Facebook Marketplace.
- **Browser extensions** that clean the results page (Cleanplaats, Marktplaats zonder spam).
- **Tweakers Pricewatch** for new-price reference and Tweakers V&A for used tech. `[NEEDS REVIEW: could not verify
  Tweakers' alert features in this session]`

### Beliefs & Objections
- "Speed is everything. 15 minutes is too slow." (True for resellers and hot items.)
- "Marktplaats already does this."
- "Scraping is not allowed; this might be shut down." (A search summary of a sitedeals.nl thread says scraping "is no
  longer considered legal"; page returned 403, unverified. Marktplaats ToS art. 7.3 forbids systematic querying;
  risk accepted by the operator.)
- "AI will hide good listings from me." (Mitigation: "every new listing" option; unranked listings still arrive.)
- "Why give my e-mail to a student project?"

### Problems To Solve While Marketing
- Can't advertise on Marktplaats' name or brand (not affiliated; avoid anything that looks official).
- Legal/ToS exposure limits loud public promotion to end users. `[NEEDS REVIEW: how visible should end-user
  promotion be, given art. 7.3?]`
- Free + portfolio = no budget; distribution is word of mouth and LinkedIn.
- Competitors outspend and outpace on speed and platform coverage.

## Reviews & Market Language

### Product Reviews (Positive)
No reviews of Marktplaats Watcher yet (see testimonials.md). Competitor-site praise shows what the market values:
- "Scored an iPhone 15 same day for half retail price" (MPAlerts testimonial, https://mpalerts.nl/)
- "A.I. understands exactly what I mean describing what I'm looking for" (MPAlerts testimonial)
MarktAlert claims "4.8/5 Gebruikerswaardering" with no visible reviews (https://marktalert.nl/).

### Competitor Reviews (Negative)
About Marktplaats' own alerts (users and interested competitors):
- "Alleen krijg je helaas niet instant een melding helaas." (user, Viafora, 2024)
- "as far as I can tell that's a day overview" (developer README,
  https://github.com/nagsterFVZ/marktplaats-scraper)
- "in de praktijk komen die meldingen vaak met flinke vertraging" (competitor blog,
  https://www.marktplaatsscanner.com/blog/marktplaats-melding-instellen-handleiding/)
- "Alerts are delayed, often by several hours" / "You can't control how often they're sent" (competitor blog,
  https://marketplacemonitor.com/blog-get-notified-marktplaats-listings/)
- "de standaard Marktplaats-app stuurt geen echte melding bij nieuwe advertenties" (competitor blog,
  https://marktalert.nl/blog/automatische-meldingen-marktplaats-complete-gids)
About third-party bots: "uses unofficial APIs" … "account or IP bans" (mrktpltsbot README,
https://github.com/eigenein/mrktpltsbot).
No negative user reviews of MarktAlert/MPAlerts found in this session. `[NEEDS REVIEW: check App Store / Play reviews]`

### Buzz Words & Niche Phrases
(Count = number of distinct sources in this research using the phrase or its direct equivalent.)
| Phrase | Count | Note |
|---|---|---|
| melding / meldingen (notification) | 7 | The core Dutch word. Use it in Dutch copy. |
| direct / instant / meteen | 6 | Competitors' main promise. Avoid competing on it. |
| zoekopdracht opslaan / bewaarde zoekopdracht | 4 | What people call the native feature. |
| te laat / vertraging / delayed | 4 | The native feature's main complaint. |
| deal / koopje / sniping deals | 4 | Bargain-hunter identity. |
| spam / rommel / cluttering / topadvertenties | 4 | Noise from business/promoted listings. |
| elke dag even kijken / refreshen | 3 | The manual workaround. |

## Competitor Research

Profiles in the `/analyseer-concurrent` format are in `../competitors/`. Summary:

### Competitor 1: Marktplaats saved search ("Bewaarde zoekopdrachten")
- **Ad Library:** n/a
- **Landing Pages:** https://help.marktplaats.nl/s/article/beheren-opgeslagen-zoekopdrachten (page did not render
  for the fetch tool)
- **Website:** https://www.marktplaats.nl
- **Price Range:** Free, built in
- **Active Offers:** n/a
- **Notes:** E-mail to the logged-in address, reported as once a day at the time the search was saved. Whether the
  app also sends push for saved searches is contested: one competitor says it doesn't, a 2026 AI blog says it does.
  `[NEEDS REVIEW: Daryl to test in the app and screenshot the settings]`. In 2026 Marktplaats is adding AI:
  "Nieuwe zoekfuncties begrijpen gewone taal." (aiinsider.nl, 3 Feb 2026,
  https://aiinsider.nl/nieuws/marktplaats-2026-hoe-ai-advertenties-en-sociale-functies-verandert/). This weakens
  "plain language" as a long-term differentiator.

### Competitor 2: MPAlerts
- **Ad Library:** not checked
- **Landing Pages:** https://mpalerts.nl/
- **Website:** https://mpalerts.nl/
- **Price Range:** €19.95/month (5 searches), €39.95/month (15 searches)
- **Active Offers:** 7-day free trial, no credit card
- **Notes:** Closest competitor on the AI angle: "Our A.I. reads every listing and automatically filters irrelevant
  results". Covers Marktplaats, 2dehands, Vinted, Facebook. Push, e-mail, Telegram, Discord, RSS. Speed "within
  several seconds to several minutes".

### Competitor 3: MarktAlert
- **Ad Library:** not checked
- **Landing Pages:** https://marktalert.nl/
- **Website:** https://marktalert.nl/
- **Price Range:** Free (2 alerts, 15-min checks, 14 days), Plus €6.95/month (5 alerts, 5 min), PRO €10.95/month
  (10+ alerts, 3 min, 45 days)
- **Active Offers:** Free tier
- **Notes:** Marktplaats, 2dehands, Vinted; e-mail, Telegram, app push, webhooks; price-drop monitoring on paid
  plans. No AI relevance scoring mentioned. Free tier overlaps Watcher's cadence directly.

### Competitor 4: Marktplaats Scanner (marktplaatsscanner.com / .nl)
- **Ad Library:** not checked
- **Landing Pages:** https://www.marktplaatsscanner.nl/notificatie/
- **Website:** https://www.marktplaatsscanner.com/
- **Price Range:** Free tier with limited searches; Pro price not stated on the page read
- **Active Offers:** Pro: "Een check-interval van 3 minuten per zoekopdracht"
- **Notes:** Push, Telegram, Discord, e-mail; price-drop alerts. Content-marketing heavy (SEO blog).

### Competitor 5: DIY / self-hosted bots (mrktpltsbot, marktplaats-scraper, Discord bot, Apify)
- **Ad Library:** n/a
- **Landing Pages:** https://github.com/eigenein/mrktpltsbot, https://github.com/nagsterFVZ/marktplaats-scraper,
  https://github.com/muhammad-a-dev/marktplaats-alert-bot, https://apify.com/bostomate/marktplaats-monitor
- **Website:** GitHub / Apify
- **Price Range:** Free (self-hosted) or pay-per-use (Apify)
- **Active Offers:** n/a
- **Notes:** Proves demand among technical users; each warns of bans / unofficial APIs. Same audience as the LinkedIn
  engineers, useful for the portfolio story.

Also seen, not profiled: DealFinder (claims free, 25+ platforms, push; https://deal-finder.app/en, page did not
render), Marketplace Monitor (7-day trial; https://marketplacemonitor.com), MeteenMelding (page 404), Vinted
Scanner.

### Comparison: Marktplaats' own saved search vs. Marktplaats Watcher (and the two closest alternatives)

| | Marktplaats saved search | Marktplaats Watcher | MarktAlert (free) | MPAlerts |
|---|---|---|---|---|
| Price | Free | Free | Free (2 alerts, 14 days) | €19.95+/month after trial |
| How you set it up | Run a search with filters, save it | One plain-language sentence in a chat, then Save | Form | Form + AI description |
| How often | Reported once a day, at the time you saved it | You choose: 15/30 min, 1–12 h, daily up to 4 times, or chosen weekdays | Every 15 min | Seconds to minutes |
| Channel | E-mail (push contested `[NEEDS REVIEW]`) | E-mail | E-mail, Telegram, push, webhook | Push, e-mail, Telegram, Discord, RSS |
| Relevance filtering | Keyword + Marktplaats filters; no scoring | AI score 0–10 + one-line reason; you pick great / good / all | Filters (price, location, photos) | AI filters irrelevant results |
| Explains *why* a listing matters | No | Yes, a reason per listing | No | Not shown on the site |
| "Must include" spec (e.g. 16gb) | Via keywords | Yes | Advanced filters on paid plans | Via AI description |
| Only genuinely new listings | Yes | Yes (first check silent) | Yes | Yes |
| Coverage | All Marktplaats results | Every listing placed since the last check (since 29 Sep; was the first page, ~30 listings) | Marktplaats, 2dehands, Vinted | + Facebook |
| Location filter | Yes (Marktplaats' own) | Postcode + radius; only listings showing a location (~1/3) | Yes | Yes |
| Official / ToS-safe | Yes | No: reads public search pages, ToS art. 7.3 risk accepted | Unofficial | Unofficial |
| Data retention | Marktplaats account | 30 days, one-click delete | Not checked | Not checked |

**Read-out:** Watcher can't win on speed, coverage or channels. It wins on (1) free with no time limit, (2) a *reason*
for every alert, (3) the most flexible calm schedule, (4) plain-language setup. Its real edge over the native feature
is the score + reason and the schedule; its edge over paid apps is price and explanation.

## Metadata

- **Created:** 2026-09-27
- **Last updated:** 2026-09-27
- **Status:** Partial (missing: Reddit/X/Tweakers voice, app-store reviews of competitors, verification of native
  push behaviour, Tweakers Pricewatch features, Meta Ad Library checks)
