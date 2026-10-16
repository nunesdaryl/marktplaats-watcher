# Marktplaats Watcher — Pitch Pack for Marktplaats
_Prepared 2026-10-04 by Axel for Daryl Nunes. Goal: land a conversation with the Marktplaats GTM/partnerships team, per Vinod's Day-4 push ("please reach out to Marktplaats sales team or GTM team")._

---

## 1. The one-liner

**Marktplaats Watcher turns searching into being told.** A user says what they want in plain words ("a Mac mini with 16GB under €500"), picks when to check, and gets an e-mail only when a listing is genuinely worth a look — every new listing read and scored 0 to 10 by an AI agent, with the reason attached.

Live today: **https://marktplaats-watcher.vercel.app** · Free, up to 5 watches per user.

## 2. Why Marktplaats should care (their lens, not ours)

- **It solves the retention gap in saved searches.** Today's saved-search e-mails are keyword dumps: high noise, low trust, users unsubscribe. The Watcher reads every new listing like a human would and only surfaces the good ones, with a reason. That is "saved search 2.0" — a daily habit instead of inbox noise.
- **It brings buyers back on the platform's schedule.** Every alert is a high-intent visit: the user already knows the listing scored 8/10 and why. Better click-through, faster transactions, fresher demand signal for sellers.
- **It helps buyers act on Marktplaats.** Fresh listings could receive first bids sooner, and fewer buyer-seller conversations could be abandoned. Bids and messages would stay inside Marktplaats, without off-platform deals. An official, auditable channel would replace the current bot-like search reads; these are outcomes to test together, not measured claims.
- **Natural-language demand data.** "Gazelle bike near 3511AB under €300, mornings" is structured buyer intent Marktplaats currently never captures. At scale this is a demand-side dataset sellers and categories teams would love.
- **It exists and runs.** Not a slide deck. Deployed, evaluated, tested, with CI, uptime checks and a kill switch. They can try it during the meeting.

## 3. Proof points (all real, all verifiable)

- **Built during the Forward Deployed Engineer program (DataBag, 40h, instructor-led)** — won the Day-4 build-off: 5 of 9 peer votes plus the instructor's.
- **The instructor became the first customer on record.** Vinod Kumar Bhovi (Founder, DataBag; builds agents at Rabobank), live in the room: *"I pay 10 euros to get this application … I think I can be your first user."* He had spent that same lunch break manually hunting Marktplaats for a €400 Mac mini.
- **Production discipline, not a hackathon script:** evals measured against judge labels with human spot-checks (`evals/report.md`), offline test suites (pytest + Convex tests), CI with pip-audit/npm-audit/gitleaks on every push, 30-minute uptime checks, ADR index, NFR doc, a full design system, and a documented runbook with a kill switch.
- **Why these questions were already answered in the room:** peers asked "why wouldn't Marktplaats build this themselves?" — see §6.

## 4. What we're actually asking for (in stages)

**First step: a 30-minute conversation** with the right person on product, partnerships or GTM for the buyer experience. Everything below is what that conversation is about.

The headline ask is **official, revocable delegated buyer access**: users authorise us on Marktplaats' own OAuth-style consent screen to act for them, with separate "place a bid" and "send a message" scopes. Consent is per user and revocable; Marktplaats sets the rate limits and rules. A 30-minute conversation with Product/Partnerships/GTM is the first step toward this path:

1. **Official read access to `/v1/search` for alerts** (the existing MW-14 request), with partner credentials and Marktplaats' rate limits. Today the MVP anonymously reads public search results through `/lrp/api/search`; ADR 0009 records that this route is disallowed by robots.txt and that repeated systematic querying conflicts with the recorded terms. Official access is the exit from that accepted demo risk.
2. **Delegated buyer access for bids and messages.** Let each user opt in through Marktplaats' own consent screen to the "place a bid" and "send a message" scopes, revoke authorisation, and keep every action inside Marktplaats under its limits. The app does not place bids or send messages today.
3. **A joint pilot** with agreed category, success criteria, data rules and a go/pivot/stop decision. Bring observed `bid_handoff` events [N], alerts sent [N], and founding users [N] as evidence once measured; do not substitute estimates for these placeholders.

**Position honestly:** this is a working proof of concept by an engineer who builds governed AI agents for a living (Rabobank, Low-Code & RPA Solutions Engineer; FDE-certified). It is an invitation to build the official version together, not a threat to scrape at scale.

## 5. The route in (ranked)

1. **Vinod's warm intro — do this first.** He told you to contact their GTM team; ask him in the same breath whether he (or anyone in the DataBag/cohort network) has a name at Marktplaats or Adevinta. A warm intro beats everything below.
2. **LinkedIn, targeted.** Search strings: `Marktplaats "product manager" buyer`, `Marktplaats partnerships`, `Marktplaats "business development"`, `Adevinta Benelux product`. Prefer: PM for search/alerts/buyer experience > partnerships lead > GTM. Connect with a 2-line note (see §7b), not a pitch wall.
3. **The company channel.** Marktplaats/Adevinta business contact forms and press/partnerships addresses — slowest, use as a parallel shot, never the only one.
4. **The content route (already in motion).** Your LinkedIn certificate post names the product and the pitch intent publicly; Marktplaats employees are reachable in the comments of a post that performs.

## 6. Objection handling (asked and answered at demo day)

- **"Why wouldn't Marktplaats build this themselves?"** They can — that is exactly why to talk. The build is not the moat; the proof of what users respond to is. Faster for them to pilot with someone who has it running than to spec it from zero. (And if they are building it: even better, the conversation becomes a hiring/consulting one.)
- **"Does it really save time?"** Vinod's lunch break is the anecdote: a motivated, expert buyer manually refreshing for a €400 Mac mini. The Watcher does that for every user, on schedule, with reasons. Roadmap: WhatsApp/Telegram push, "like self-investing alerts for stocks."
- **"Is this allowed?"** The capped MVP anonymously reads public search results through `/lrp/api/search`; ADR 0009 records the robots.txt and terms risk. Official `/v1/search` access and Marktplaats-controlled consent for buyer actions are the sanctioned path we are asking for.
- **"Why not just automate it?"** We could do it in the user's own browser, but the right way is your consent screen: auditable, revocable, and within your rules.
- **"What about hallucinated scores?"** Scoring is evaluated against judge labels corrected by human spot-checks, with failure categories tracked per prompt version. Alerts carry the reason, so users calibrate trust themselves. Thresholds are user-chosen (great only / good / everything).

## 7. Outreach drafts (Daryl voice, gated)

_Updated drafts for the founding-user push and the API-access request (6 Oct 2026): [outreach-drafts-2026-10-06.md](outreach-drafts-2026-10-06.md)._

### 7a. E-mail / LinkedIn message (warm or semi-warm, ±120 words)

> Subject: Smart alerts for Marktplaats buyers — working demo
>
> Hi [name],
>
> I built something your buyers would use daily and I would rather build it with you than around you.
>
> Marktplaats Watcher: a user says in plain words what they want ("Mac mini 16GB under €500"), picks when to check, and only hears about listings an AI agent scored worth their time, with the reason. It runs live at marktplaats-watcher.vercel.app.
>
> I built it during a Forward Deployed Engineer program, it won the cohort build-off, and the instructor asked to be its first paying user. The honest limit: it anonymously reads public search results today, with a documented robots.txt and terms risk. I would like official search access and revocable buyer consent for bids and messages, and that is exactly what I want to talk about.
>
> Open to a 30-minute call?
>
> Daryl Nunes

### 7b. LinkedIn connect note (≤300 chars)

> Hi [name], I built a working "smart alerts" agent on top of Marktplaats (scores every new listing, mails only the good ones). Won a cohort build-off with it. I'd like to show it to someone on the buyer-experience side. Open to connect?

### 7c. The Vinod ask (WhatsApp/LinkedIn, ≤60 words)

> Vinod, following up on your push at demo day: I'm taking Marktplaats Watcher to Marktplaats. Before I go cold, do you or anyone in the network have a name at Marktplaats or Adevinta (product, partnerships or GTM)? A warm intro would make all the difference. The €10 first-user offer still stands, by the way.

### 7d. The pitch e-mail (16 Oct 2026, Daryl's voice, gated)

**Route (checked 16 Oct 2026):** Marktplaats publishes no e-mail address for API or partner questions. The API docs only say credentials are "assigned by Marktplaats", and the business contact page lists the phone desk (088 008 26 26, Mon–Fri 09:00–17:00), a chat and the help portal. A pitch therefore goes to a named person: Vinod's warm introduction first, else a product, partnerships or API person found on LinkedIn (§5). The help-portal form is only a fallback for the narrow API question. Written in Daryl's calibrated voice (point, explanation, example; no em-dashes; no hype); every claim matches `evals/report.md` (14 Oct) and the pitch deck.

> Subject: Smart alerts for Marktplaats buyers: a working demo and a proposal
>
> Hi [name],
>
> I built an alert service for Marktplaats buyers that only e-mails the listings worth a look, and I would like to build the official version of it with you.
>
> It is called Marktplaats Watcher. You say in plain words what you want, for example "a Mac mini with 16GB under €500, every morning at 8", and an AI agent reads every new listing, scores it 0 to 10 and e-mails only the good ones, with one line explaining why. In a real check, a 16GB Mac mini at €230 scored 9 and was e-mailed, while a docking station with "Mac mini" in the title scored 0 and never reached the inbox. A keyword alert would have sent both.
>
> It runs live at marktplaats-watcher.vercel.app. In our test on 53 real listings, every "great match" it e-mailed was a real match (median of 3 runs). I built it during the DataBag Forward Deployed Engineer program, where it won the cohort build-off, and the instructor asked to be its first user. He had spent his lunch break that day refreshing Marktplaats by hand for a €400 Mac mini.
>
> There is one honest limit. Today it reads your public search results without official access, through a route your robots.txt disallows, and your terms don't allow repeated automated searching. I kept it small on purpose, with 5 watches per person, a check every 15 minutes at most and a kill switch, but that is not how it should grow.
>
> So I'm asking for a 30-minute conversation with the right person on product, partnerships or the API side. I would like to talk about three things:
> 1. Official search access (/v1/search) with partner credentials, under your rate limits.
> 2. Later, bids and messages that buyers approve on your own consent screen, so everything stays on Marktplaats.
> 3. A small six-week pilot in one category, with success criteria we agree on before we start.
>
> I have a short deck with the details and the pilot proposal, and I'm happy to send it or walk you through it. If you're not the right person for this, who should I talk to?
>
> Kind regards,
> Daryl Nunes
> Solutions engineer · FDE certificate DBG-FDE-2026-009
> linkedin.com/in/daryl-nunes-959a28411 · darylnunes@gmail.com

**Sent 16 Oct 2026 (by Daryl):**

- **17:09 CEST, Marktplaats Zakelijk callback form** ("Liever advies op maat?", marktplaatszakelijk.nl): submitted ("Bedankt! We nemen zo snel mogelijk contact met je op."). It has no message field, so it is a callback request: expect a call and use this e-mail as the script.
- **17:11 CEST, Adevinta contact form** (adevinta.com/contact, topic "Others"): submitted with a shorter English version of this pitch, asking them to forward it to the Marktplaats NL partnerships, product or API team.
- **17:15 CEST, e-mail to support@marktplaats.nl** (forward request, then this pitch in English and Dutch): bounced with "Address not found". The address only appeared on a third-party site; do not use it again.

The pitch e-mail itself still waits for a named person (Vinod's introduction or LinkedIn). If neither form gets an answer by Fri 23 Oct 2026, that is the next step. The only other published e-mail, marktplaats@teamlewis.com, is the press agency and not a route for a pitch.

The pitch deck's "Proof" and "Success criteria" slides were updated on 16 Oct 2026 to the 14 Oct report (great precision 100%, recall 86%, median of 3 runs), so the deck and this e-mail agree.



1. Open the landing page, read the fill-in sentence out loud: "Check Marktplaats for a Mac mini with 16GB under €500 every morning at 8 and e-mail me good matches, with the reason."
2. Chat: live search with price filter, show real listings coming back.
3. Save a watch, show the plain-English schedule.
4. Show one real alert e-mail: score, one-line reason, link.
5. Close: "Every piece of this is evaluated, tested and governed. What it needs to be real is official access. That is why I am here."

## 9. Supporting artifacts (all in this repo / course folder)

- Live app: https://marktplaats-watcher.vercel.app
- Engineering case study and pilot scorecard: [Marktplaats Watcher, an FDE case study](../case-study.md), especially its [Varick-bar scorecard](../case-study.md#varick-bar-scorecard). The scorecard names gaps in baseline, production latency, run volume, code:LLM ratio and exception approval; it is evidence for a pilot conversation, not a claim of measured buyer impact.
- System design: `docs/architecture.excalidraw` + the 53-page system design (`docs/system-design.html`; PDF exports in the course Deliverables folder)
- Evals: `evals/report.md` · NFRs: `docs/nfr.md` · ADRs: `docs/adr/`
- Runbook incl. kill switch: `RUNBOOK.md`
- FDE certificate: DBG-FDE-2026-009 (issued 3 Oct 2026, DataBag)

### Pilot evidence scorecard

| Evidence | State |
|---|---|
| Named failure harness | Present: [failure categories and operating rules](../case-study.md#evals-from-cases-to-decisions). |
| Cost and latency | Eval-run measures present; production alert latency is a [known gap](../case-study.md#varick-bar-scorecard). |
| Run volume and frequency | Schedules and cost scenarios present; a production volume series is a [known gap](../case-study.md#varick-bar-scorecard). |
| Code:LLM ratio and model calls per run | Chat model calls are recorded; aggregate ratio and production distribution are [known gaps](../case-study.md#varick-bar-scorecard). |
| Operator controls | Pause, change rule and pull in the owner are present; a dedicated exception-approval queue is a [known gap](../case-study.md#varick-bar-scorecard). |

---
_Next actions: 1) send the Vinod ask (7c), 2) fire 2–3 LinkedIn connects (7b), 3) e-mail on first accept (7a). Track responses in this file._

_Status 16 Oct 2026: the founding-user launch posts and the note to Vinod went out (see `generated/launch-posts-2026-10-10.md`); Daryl chose to e-mail the pitch (7d) instead of calling the business desk. Later that day the Zakelijk callback form and the Adevinta contact form were submitted and the support@marktplaats.nl e-mail bounced (list in 7d, recorded on MW-14). Record each answer here and on MW-14._
