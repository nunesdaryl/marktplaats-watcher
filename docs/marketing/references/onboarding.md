# Company Onboarding Document — Marktplaats Watcher

> Built with the agent-skill-pack `02-onboarding /onboard` flow (5 phases). The owner interview was **not** run:
> every answer below is derived from the repo (README.md, DEPLOY-VERCEL.md, frontend/src/Landing.jsx, agent.py,
> frontend/convex/schedule.ts, frontend/convex/checker.ts) and the operator's brief. Anything that is a guess about
> intent, audience or plans is marked `[NEEDS REVIEW]`. Facts traceable to code are not marked.

## Business Identity

### Differentiator
Marktplaats Watcher reads the listings for you. Each new listing on a watch is scored 0 to 10 by an LLM (OpenAI) with
a one-line reason ("price vs. typical price, specs, distance", per `RANK_PROMPT` in agent.py), and you choose the bar:
"great matches only" (8+), "good matches" (6+) or "every new listing". Marktplaats' own saved search, and most
third-party alert tools, forward everything that matches the keyword (see research.md).

Second differentiator: the whole setup is one sentence in plain language. "Tell me when a Gazelle bike shows up near
3511AB, every morning at 8" becomes a proposed watch with query, filters, schedule and alert level. The chat only
*proposes*; nothing is saved until the user clicks **Save watch**.

Third: the schedule is the user's, not the tool's. Every 15 or 30 minutes, every 1/3/6/12 hours, daily at up to four
times, or chosen weekdays at a time, in Amsterdam time. This makes a calm "morning digest" as easy as a fast check.

### Hidden Gems
Things the product does that the landing page barely mentions:
- **The first check is silent.** A new watch only records what is already listed, so the first e-mail is about
  genuinely new listings, not the 30 that were already there.
- **Every alert explains itself.** The e-mail shows price, city, "scored 8/10" and the model's reason, and says why the
  user is getting it ("You get this because you watch …, checked …, and asked for …").
- **"Must include" spec filter** (e.g. `16gb`, `M2`) and **postcode + radius** filter (postcode to coordinates via
  PDOK, the Dutch government address service).
- **Ask in English or Dutch.** The assistant replies in English unless the user writes Dutch.
- **Honest failure.** If the AI is down, listings arrive marked "Not ranked: the AI was unavailable" instead of
  silently disappearing. If a search finds nothing, the chat explains why "using the numbers".
- **Privacy by default.** Data kept 30 days, purged daily; "Delete my data" removes everything at once; seller
  details are never stored.
- **Built to a professional standard:** Clerk token checked on every chat call, cron endpoint behind a secret,
  listing titles treated as "data, not instructions" (prompt-injection guard), HTML-escaped e-mails, 15 Python + 24
  TypeScript tests, CI on every push. `[NEEDS REVIEW: a static count finds 17 TS test declarations, some are
  parameterised; confirm the 24 figure before quoting it publicly]`

### Best-Selling Product/Service
There is one product and it is free.
- **Name:** Marktplaats Watcher (MVP), live at https://marktplaats-watcher.vercel.app
- **Price:** €0. No paid tier, no offer to sell. `[NEEDS REVIEW: confirm there is no plan to charge, even later]`
- **What's included:** sign-in (Clerk, e-mail), chat search of Marktplaats, up to 5 watches per user, per-watch
  schedule, max price / must-include / postcode + radius filters, AI score + reason per new listing, e-mail alerts
  from marktplaats-watcher@agentmail.to, "Delete my data".
- **Problem it solves:** "I want a specific second-hand thing, I don't want to refresh Marktplaats all day, and I
  don't want an inbox full of irrelevant matches."
- **Real purpose:** a portfolio project for Daryl Nunes' Forward Deployed Engineer course and LinkedIn portfolio.
  Success = credible proof of shipping an agentic product end to end, plus a handful of real users.
  `[NEEDS REVIEW: confirm success criteria and whether real users are a goal or a nice-to-have]`

## Brand & Perception

### Desired Perception
- **For end users:** "a sensible friend who checks Marktplaats for me and only bothers me when it's worth it."
  Calm, useful, honest. Not a deal-sniping machine.
- **For the LinkedIn audience:** "this person can take a fuzzy real-world problem, scope it, ship it safely, and be
  honest about its limits." Engineering judgement over hype.
`[NEEDS REVIEW: both perceptions are inferred from the landing tone and the operator's audience split]`

### Purchase Barriers
(For a free tool, "purchase" = signing in and saving a first watch.)
- "Is this a scam / phishing thing using Marktplaats' name?" Not affiliated, unknown sender domain (agentmail.to).
- "Do I have to give my e-mail to a student project?"
- "Why not just use Marktplaats' own saved search?" (Needs a crisp answer; see research.md comparison.)
- "Other alert apps are faster." True: minimum interval here is 15 minutes; competitors advertise 3 minutes or
  seconds. Speed-focused resellers are not the target.
- "Will it still exist next month?" Portfolio project, ToS risk accepted by the operator (Marktplaats terms art. 7.3).
- Only the first results page (~30 listings) is read; the distance filter only keeps listings that show a location
  (roughly a third).

### Influencers & Authorities
- End users: Tweakers (tech buyers), consumer programmes and sites such as Radar / Consumentenbond on second-hand
  buying safety, Dutch deal/"koopjes" communities. `[NEEDS REVIEW: not researched per name]`
- LinkedIn audience: AI-engineering and FDE voices (e.g. Anthropic/OpenAI engineering blogs, LangChain),
  the FDE course instructors and peers. `[NEEDS REVIEW: Daryl to name the 3–5 people he actually follows]`

## Market Patterns

### Seasonal Patterns & Cycles
- Bikes: spring (March–May) and back-to-school/student move-in (late August–September) in university cities
  such as Utrecht and Amsterdam. `[NEEDS REVIEW: general knowledge, not verified with data]`
- Electronics: after new Apple/Nintendo launches (older models flood Marktplaats), around Black Friday and after
  Christmas. `[NEEDS REVIEW]`
- Furniture and household: moving season (summer, student turnover). `[NEEDS REVIEW]`
- Portfolio audience: LinkedIn hiring activity peaks January–March and September–October. `[NEEDS REVIEW]`

### Frequently Asked Questions
Derived from the product's design and its limits (no real user questions yet):
1. Is this Marktplaats? (No, a portfolio project, not affiliated.)
2. How is this different from saving a search on Marktplaats?
3. How fast will I hear about a new listing? (Depends on the schedule you pick; 15 minutes at the fastest.)
4. What does the score mean? (0–10 fit for what you asked, with a one-line reason; 8+ great, 6+ good.)
5. Why didn't I get an e-mail on day one? (The first check only records what's already listed.)
6. Why are some listings missing when I set a radius? (Many private sellers show no location; only ~a third do.)
7. What do you do with my data? (E-mail, watches, seen listings, alerts; 30 days; titles and searches go to OpenAI
   for scoring; "Delete my data".)
8. How many watches can I have? (5.)
9. Can I get alerts by push / Telegram? (No, e-mail only.)
10. Is it free? (Yes.)

## Trust Signals & Assets

### Claims & Guarantees
Claims that are true and checkable today:
- "Scores every new listing 0–10 and tells you why."
- "You pick how often: every 15 minutes up to once a week, in Amsterdam time."
- "Only new listings: the first check just notes what's already there."
- "Your data is deleted after 30 days, or instantly with one click."
- "Free." and "Nothing else, and nothing is sold or shared." (the second is landing page wording; "Free" is not yet
  said on the landing page)
- "Up to 5 watches."
Claims **not** to make: "be the first", "instant", "never miss a deal", "catches every listing" (first page only,
15-minute minimum), any accuracy percentage for the scoring (not measured yet).
Observed proof point: a real search for "mac mini" returned a Cisco network switch among the results. That is the
noise the scoring exists to filter. `[NEEDS REVIEW: capture the actual score/reason the model gave that switch, as a
screenshot, before using it publicly]`

### Content Library
- Landing page: https://marktplaats-watcher.vercel.app
- README.md, DEPLOY-VERCEL.md (setup and deploy), docs/system-design.html, docs/architecture.excalidraw + SVG
- Public repo `[NEEDS REVIEW: is the GitHub repo public? add the link]`
- No blog posts, videos or LinkedIn posts yet about this product. `[NEEDS REVIEW]`

## The Founder

### Origin Story
Daryl Nunes is a student on a Forward Deployed Engineer course, based in the Netherlands, building a product portfolio
for LinkedIn. Marktplaats Watcher started as a course project: a LangChain tool-calling agent (search Marktplaats,
propose a watch) that grew into a full product with sign-in, scheduled checks, AI scoring and e-mail.
`[NEEDS REVIEW: the real personal moment is missing. What did Daryl try to buy on Marktplaats and miss? What was he
doing before the course? This is the strongest story asset and only he can supply it]`

### Contrarian Beliefs
Candidates, inferred from how the product is built (`[NEEDS REVIEW: pick the ones Daryl actually believes]`):
- "Faster alerts aren't the answer. Fewer, better alerts are." (15-minute minimum and a relevance bar, on purpose.)
- "An AI agent should propose, not act." (The chat never saves a watch; the user clicks Save.)
- "Say the limits out loud." (The landing page states what data is kept and that it's not affiliated.)
- "A portfolio project should be run like production": auth, secrets, tests, CI, data retention, a kill switch.

### Content Presence & Platforms
- LinkedIn: primary channel for the portfolio audience. `[NEEDS REVIEW: follower count, posting frequency so far]`
- End-user channels: none yet. Possible: Tweakers forum, r/thenetherlands / r/Netherlands, friends and course peers
  as beta users. `[NEEDS REVIEW]`

## Metadata

- **Created:** 2026-09-27
- **Last updated:** 2026-09-27
- **Status:** Partial (derived without owner interview; missing: founder origin moment, influencer names, content
  presence numbers, confirmation of all `[NEEDS REVIEW]` items)
