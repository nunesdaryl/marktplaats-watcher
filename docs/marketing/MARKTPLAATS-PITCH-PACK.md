# Marktplaats Watcher — Pitch Pack for Marktplaats
_Prepared 2026-10-04 by Axel for Daryl Nunes. Goal: land a conversation with the Marktplaats GTM/partnerships team, per Vinod's Day-4 push ("please reach out to Marktplaats sales team or GTM team")._

---

## 1. The one-liner

**Marktplaats Watcher turns searching into being told.** A user says what they want in plain words ("a Mac mini with 16GB under €500"), picks when to check, and gets an e-mail only when a listing is genuinely worth a look — every new listing read and scored 0 to 10 by an AI agent, with the reason attached.

Live today: **https://marktplaats-watcher.vercel.app** · Free, up to 5 watches per user.

## 2. Why Marktplaats should care (their lens, not ours)

- **It solves the retention gap in saved searches.** Today's saved-search e-mails are keyword dumps: high noise, low trust, users unsubscribe. The Watcher reads every new listing like a human would and only surfaces the good ones, with a reason. That is "saved search 2.0" — a daily habit instead of inbox noise.
- **It brings buyers back on the platform's schedule.** Every alert is a high-intent visit: the user already knows the listing scored 8/10 and why. Better click-through, faster transactions, fresher demand signal for sellers.
- **Natural-language demand data.** "Gazelle bike near 3511AB under €300, mornings" is structured buyer intent Marktplaats currently never captures. At scale this is a demand-side dataset sellers and categories teams would love.
- **It exists and runs.** Not a slide deck. Deployed, evaluated, tested, with CI, uptime checks and a kill switch. They can try it during the meeting.

## 3. Proof points (all real, all verifiable)

- **Built during the Forward Deployed Engineer program (DataBag, 40h, instructor-led)** — won the Day-4 build-off: 5 of 9 peer votes plus the instructor's.
- **The instructor became the first customer on record.** Vinod Kumar Bhovi (Founder, DataBag; builds agents at Rabobank), live in the room: *"I pay 10 euros to get this application … I think I can be your first user."* He had spent that same lunch break manually hunting Marktplaats for a €400 Mac mini.
- **Production discipline, not a hackathon script:** evals measured against judge labels with human spot-checks (`evals/report.md`), offline test suites (pytest + Convex tests), CI with pip-audit/npm-audit/gitleaks on every push, 30-minute uptime checks, ADR index, NFR doc, a full design system, and a documented runbook with a kill switch.
- **Why these questions were already answered in the room:** peers asked "why wouldn't Marktplaats build this themselves?" — see §6.

## 4. What we're actually asking for (pick per conversation)

1. **A 30-minute conversation** with someone on Product/Partnerships/GTM for the buyer-side experience.
2. **Sanctioned data access** (API or partner feed) — the current MVP reads listings via a signed-in session, which is fine for a demo and wrong for scale. We WANT to do this the official way; that is the point of reaching out.
3. Longer-term options to explore together: white-label "smart alerts" feature, a partner integration, or an acquisition of the capability.

**Position honestly:** this is a working proof of concept by an engineer who builds governed AI agents for a living (Rabobank, Low-Code & RPA Solutions Engineer; FDE-certified). It is an invitation to build the official version together, not a threat to scrape at scale.

## 5. The route in (ranked)

1. **Vinod's warm intro — do this first.** He told you to contact their GTM team; ask him in the same breath whether he (or anyone in the DataBag/cohort network) has a name at Marktplaats or Adevinta. A warm intro beats everything below.
2. **LinkedIn, targeted.** Search strings: `Marktplaats "product manager" buyer`, `Marktplaats partnerships`, `Marktplaats "business development"`, `Adevinta Benelux product`. Prefer: PM for search/alerts/buyer experience > partnerships lead > GTM. Connect with a 2-line note (see §7b), not a pitch wall.
3. **The company channel.** Marktplaats/Adevinta business contact forms and press/partnerships addresses — slowest, use as a parallel shot, never the only one.
4. **The content route (already in motion).** Your LinkedIn certificate post names the product and the pitch intent publicly; Marktplaats employees are reachable in the comments of a post that performs.

## 6. Objection handling (asked and answered at demo day)

- **"Why wouldn't Marktplaats build this themselves?"** They can — that is exactly why to talk. The build is not the moat; the proof of what users respond to is. Faster for them to pilot with someone who has it running than to spec it from zero. (And if they are building it: even better, the conversation becomes a hiring/consulting one.)
- **"Does it really save time?"** Vinod's lunch break is the anecdote: a motivated, expert buyer manually refreshing for a €400 Mac mini. The Watcher does that for every user, on schedule, with reasons. Roadmap: WhatsApp/Telegram push, "like self-investing alerts for stocks."
- **"Is this allowed?"** Current MVP runs on a personal signed-in session, deliberately capped (free, 5 watches). We are asking for the sanctioned path — that is the purpose of the meeting. Enterprise framing: "a production version needs a non-personal function user and official access" (your own words at demo day).
- **"What about hallucinated scores?"** Scoring is evaluated against judge labels corrected by human spot-checks, with failure categories tracked per prompt version. Alerts carry the reason, so users calibrate trust themselves. Thresholds are user-chosen (great only / good / everything).

## 7. Outreach drafts (Daryl voice, gated)

### 7a. E-mail / LinkedIn message (warm or semi-warm, ±120 words)

> Subject: Smart alerts for Marktplaats buyers — working demo
>
> Hi [name],
>
> I built something your buyers would use daily and I would rather build it with you than around you.
>
> Marktplaats Watcher: a user says in plain words what they want ("Mac mini 16GB under €500"), picks when to check, and only hears about listings an AI agent scored worth their time, with the reason. It runs live at marktplaats-watcher.vercel.app.
>
> I built it during a Forward Deployed Engineer program, it won the cohort build-off, and the instructor asked to be its first paying user. The honest limit: it currently reads listings via a signed-in session. For anything real it needs official access, and that is exactly what I want to talk about.
>
> Open to a 30-minute call?
>
> Daryl Nunes

### 7b. LinkedIn connect note (≤300 chars)

> Hi [name], I built a working "smart alerts" agent on top of Marktplaats (scores every new listing, mails only the good ones). Won a cohort build-off with it. I'd like to show it to someone on the buyer-experience side. Open to connect?

### 7c. The Vinod ask (WhatsApp/LinkedIn, ≤60 words)

> Vinod, following up on your push at demo day: I'm taking Marktplaats Watcher to Marktplaats. Before I go cold, do you or anyone in the network have a name at Marktplaats or Adevinta (product, partnerships or GTM)? A warm intro would make all the difference. The €10 first-user offer still stands, by the way.

## 8. The 60-second demo script (for the call)

1. Open the landing page, read the fill-in sentence out loud: "Check Marktplaats for a Mac mini with 16GB under €500 every morning at 8 and e-mail me good matches, with the reason."
2. Chat: live search with price filter, show real listings coming back.
3. Save a watch, show the plain-English schedule.
4. Show one real alert e-mail: score, one-line reason, link.
5. Close: "Every piece of this is evaluated, tested and governed. What it needs to be real is official access. That is why I am here."

## 9. Supporting artifacts (all in this repo / course folder)

- Live app: https://marktplaats-watcher.vercel.app
- System design: `docs/architecture.excalidraw` + the 46-page system design (`docs/system-design.html`; PDF exports in the course Deliverables folder)
- Evals: `evals/report.md` · NFRs: `docs/nfr.md` · ADRs: `docs/adr/`
- Runbook incl. kill switch: `RUNBOOK.md`
- FDE certificate: DBG-FDE-2026-009 (issued 3 Oct 2026, DataBag)

---
_Next actions: 1) send the Vinod ask (7c), 2) fire 2–3 LinkedIn connects (7b), 3) e-mail on first accept (7a). Track responses in this file._
