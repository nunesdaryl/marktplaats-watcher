# Deep-dive audit brief: Marktplaats Watcher

**For:** a second-opinion audit by another AI assistant (ChatGPT desktop, with local file access).
**Owner:** Daryl Nunes. **Written:** 27 Sep 2026. **Demo day:** Sat 3 Oct 2026.

## 1. The question
How can we enhance, improve and upgrade the Marktplaats Watcher (the MVP version, the portfolio version and the
LinkedIn version) using everything from the FDE Course and the Marketing Engineer Agent Skill Pack?

Answer three versions of the question:
1. **MVP:** what stops this from being a product people would **pay for**, and what's the smallest path there?
2. **Portfolio:** what would make a hiring manager or client think "this person ships like a senior Forward Deployed Engineer"?
3. **LinkedIn:** what should the public launch look like (positioning, posts, demo assets), using the skill pack's method?

## 2. Where to look (read in this order)
| # | Path | What it is |
|---|---|---|
| 1 | `/Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/README.md` | Stack, setup, evals, cost, operations |
| 2 | `…/marktplaats-watcher/docs/system-design.html` | Design doc; **section 13** is the current version (v3) |
| 3 | `…/marktplaats-watcher/evals/report.md` | Evaluation results and measured cost |
| 4 | `…/marktplaats-watcher/RUNBOOK.md` | Operations: kill switch, rollback, rotation |
| 5 | `…/marktplaats-watcher/docs/demo/` | Problem statement, demo script, pre-demo checklist |
| 6 | `…/marktplaats-watcher/docs/marketing/` | Skill-pack outputs: buyer avatar, in-app copy, LinkedIn posts, competitors, validation |
| 7 | Code: `agent.py`, `main.py`, `frontend/convex/*.ts`, `frontend/src/**` | FastAPI + LangChain agent; Convex backend; Next.js UI |
| 8 | `/Users/daryldimitrianthony/FDE Course/3 Skills/fde-skill/references/checklists.md` | **The course's gates, §1–§9. Use these as the scoring rubric.** |
| 9 | `…/3 Skills/fde-skill/SKILL.md` and `references/*.md` | FDE journey, agent engineering, second brain and startup |
| 10 | `/Users/daryldimitrianthony/FDE Course/1 Course Material/Day 1–3` | Slides and cheat sheets (Day 4 and 5 are empty) |
| 11 | `/Users/daryldimitrianthony/FDE Course/FDE Vault/Home.md` | Obsidian notes linking the course together |
| 12 | `/Users/daryldimitrianthony/FDE Course/3 Skills/agent-skill-pack/` | 10 marketing agents (**written in Dutch**): 01 commander, 02 onboarding, 03 strategist (offer, Value Equation, awareness stages), 04 researcher, 05 copywriter, 06 content creator (LinkedIn rules), 07 ads, 08 customer service, 09 SEO (programmatic), 10 product builder (validation), plus `_vault/` |

- **Live app:** https://marktplaats-watcher.vercel.app. It needs a login; the landing page is public.
- **Code:** https://github.com/nunesdaryl/marktplaats-watcher (public).
- **Don't open** `.env`, `.env.local` or anything holding keys. Never quote secrets.

## 3. What exists today (don't recommend these again; build on them)
- **Product.** Chat that searches Marktplaats in plain words. A "Search now | Watch it" switch saves a **watch**.
  - The user sets a schedule in plain English (every 15 min … weekly, or specific times).
  - An LLM scores new listings 0–10 with a reason and e-mails only the good ones ("good" ≥6, "great" ≥8).
- **Management.** ChatGPT-style sidebar on desktop, Apple-style tabs on phones, and a "…" menu everywhere:
  - rename, pin, edit, pause, duplicate, folders, archive
  - ⌘K search, chats grouped by date
- **Stack.** Next.js 16 static export and FastAPI on Vercel, with Convex (data and crons), Clerk (login), OpenAI
  gpt-5.4-mini, and AgentMail (e-mail).
- **Evidence.**
  - chat golden set: 20/20 (27 Sep 2026 snapshot)
  - scorer on 49 real listings judged by gpt-5.5: precision 100% at "great"; recall 90% at "good"
  - 54 JS and 29 Python tests
  - CI with pip-audit, npm audit and gitleaks
  - uptime check every 30 minutes
  - daily health digest to the owner
  - kill switch
  - security headers, with the CSP in report-only mode
- **Cost (measured).** About €0.35 a month for an hourly watch, €0.002 per chat question; $10/month hard cap on OpenAI.
- **Feedback.** An in-app "Feedback & suggestions" button with **"Would you pay for this?"** (No / Maybe / €2 / €5 /
  €10+ a month), e-mailed to the owner.

## 4. Known gaps (already found; go deeper, don't just repeat them)
- **Legal.** Marktplaats terms art. 7.3 (scraping). The risk was accepted for a *free portfolio* project. **Charging
  money changes this.**
- **Not chargeable yet.** Missing:
  - payments (e.g. Stripe) and plan limits
  - KVK/VAT registration, terms of service, a GDPR privacy policy naming the processors, the 14-day withdrawal right
  - own domain and a Clerk production instance
  - e-mail from our own domain (SPF/DKIM)
  - a support inbox that is actually read
- **Risk.** One busy watch can use most of the shared OpenAI cap, which pauses scoring for everyone. The fix is a
  per-user budget.
- **Scorer misses.** A regular iPhone 13 scored 1/10, and an old Mac mini was scored too low.
- **Launch.** The CSP isn't enforced yet, the site is `noindex` (LinkedIn/demo only), and no real-user interviews
  have happened yet.

## 5. Decisions already made (respect them, or argue explicitly why they should change)
- English everywhere; the audience is split:
  - **app:** Dutch bargain hunters
  - **LinkedIn:** hiring managers, clients, FDE peers
- No A/B tests and no launch analytics or event tracking (the owner declined).
- Channels after e-mail: Telegram, Discord, WhatsApp.
- Users configure schedules themselves in plain English, never cron syntax.

## 6. What to deliver
1. **Scorecard.** Every item in `checklists.md` §1–§9: ✅ / ⚠️ / ❌, with the evidence as a file path, and line where
   useful.
2. **Top 10 upgrades**, ranked by impact ÷ effort. Each needs:
   - problem
   - evidence (file path)
   - the course or skill-pack source it comes from
   - concrete change
   - effort (S/M/L)
   - which version it serves (MVP / Portfolio / LinkedIn)
3. **Path to paid.** The smallest sequence to charge money legally and safely:
   - start with the Marktplaats terms question and the alternatives (permission or partner API, a different data
     source, a product built around the user's own saved searches)
   - then payments, plans and pricing, using the strategist's Five Components and Value Equation, and the measured
     cost for margin
4. **Marketing Engineering plan**, using the skill pack's own method:
   - which agents to run, in what order
   - what each should produce
   - what's missing from `docs/marketing/` (for example FAQs, products, offer)
   - the LinkedIn launch sequence following the content-creator rules
5. **Waves.**
   - **Wave 2:** the week after demo day
   - **Wave 3:** within a month
   - **Later:** anything else
   - Each wave has acceptance criteria and non-goals.
6. **Risks and open questions** for the owner. Keep it to at most 5, each answerable in one line.

## 7. Rules for the audit
- **Cite evidence.** Every claim cites a file. If you infer rather than read, label it *assumption*.
- **Don't invent numbers.** No invented metrics, prices or market sizes; use the measured ones in `evals/report.md`
  or say what to measure.
- **Distinguish fact from advice.** Separate "the course says X" (cite the file) from your own opinion.
- **Legal.** Flag legal points as "check with a lawyer", not as advice.
- **Prefer small changes.** Choose small, shippable changes over rewrites; the stack stays unless you show a strong
  reason.
- **Format.** Markdown with tables; aim for a document the owner can act on in one read (about 1,500–3,000 words).
