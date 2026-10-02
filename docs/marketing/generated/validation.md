# Product Validation — Marktplaats Watcher

> Applies `10-product-builder` `/productplan` (steps 3–5) and `knowledge-base/product-validatie.md`: the
> Transformation Promise 4-question test, the 5-level validation ladder, a competitor scan and a recommendation.
> The method is written for courses; here "the learner" = the user, and "the product" = a free web app.
> Scored twice, because the product serves two audiences.

## Product idea (intake)
A free web app: describe a second-hand item in plain language, pick a check schedule, and get e-mails only for new
Marktplaats listings the AI scores as good matches, each with a reason. Built as an FDE portfolio piece.
Validation signals so far: none from users. Budget: €0 marketing; hosting/API costs only.

## Transformation Promise 4-Question Test

### A. As a product for end users (Dutch bargain hunters)

| Question | Answer | Score |
|---|---|---|
| **1. Who?** | The specific-item hunter: knows the item and budget (Mac mini 16GB < €500), checks the app by hand, finds native alerts late and noisy. Not resellers. | ✅ Clear (segment chosen in buyer-avatar.md) |
| **2. What transformation?** | From "refresh the app / junk-filled daily e-mail" to "a few e-mails on my schedule, only listings worth a look, each with a reason". Concrete, but not yet measurable: no data on how much noise is removed. | ⚠️ Vague on proof |
| **3. Why you?** | For end users: a student project, unknown sender, no track record, not affiliated; MPAlerts already sells AI filtering, MarktAlert has a free 15-minute tier. Real edges: free with no expiry, a reason per listing, most flexible calm schedule. | ⚠️ Weak |
| **4. Why now?** | LLMs are finally cheap enough to read every listing. But competitors already use that, and Marktplaats is adding natural-language search itself (2026). | ⚠️ Weak |

**Score: 1× ✅ + 3× ⚠️ → "Product needs sharpening"** (pack rule: 2× ✅ or fewer). No ❌, so no stop.
Concrete sharpening per weak point:
- **Q2:** measure it. Hand-label 50 real new listings from 3 watches; report "X of Y irrelevant listings scored below
  6; Z good ones missed". Turn the result into the promise ("filters out most of the junk" only if true).
- **Q3:** lean on what's provably different: *free, no trial clock* and *every alert says why*. Don't claim speed.
- **Q4:** use the concrete moment, not the tech trend: "you want one specific thing this month" (seasonal: bikes in
  September, electronics after launches).

### B. As a portfolio product (LinkedIn: hiring managers, clients, FDE peers)

| Question | Answer | Score |
|---|---|---|
| **1. Who?** | Hiring managers for FDE/AI-engineering roles, SME clients, peer engineers (linkedin-audience.md). | ✅ |
| **2. What transformation?** | From "a student with a chat demo" to "someone who ships a scoped, safe, tested agentic product with users". | ✅ |
| **3. Why you?** | Daryl built and runs it end to end: agent, scheduler, auth, e-mail, deploy, tests, CI, retention, stated risk. | ✅ |
| **4. Why now?** | FDE and agentic-engineering hiring is active; job-seeking window on the course. `[NEEDS REVIEW: Daryl's timeline]` | ✅ (pending timeline) |

**Score: 4× ✅ → strong** as a portfolio piece. Its weakest link was evidence of quality (no eval) and of use (no users).
*Update 27 Sep: an evaluation now exists (evals/report.md); evidence of use is still missing.*

## Validation Ladder

| Level | Signal | Status |
|---|---|---|
| 1 Interest | Forum threads asking for faster/better alerts; 5+ alert apps and several open-source bots exist | Market-level ✅ (for the category, not this product) |
| 2 E-mail / opt-in | Sign-ups | 0 known `[NEEDS REVIEW: check Clerk for real sign-ups]` |
| 3 Time investment | Users who saved a watch and kept it 14 days | 0 known |
| 4–5 Money | Not applicable: free by decision | n/a |

**Current level for this product: 0–1.** Pack advice at this level: don't build more; test with the smallest thing.
Here that means: 8–10 beta users, one real watch each, 14 days (see testimonials.md collection plan).

## Competitor Scan

### Direct (same transformation)
| Competitor | Product | Price | Format | Strength | Weakness |
|---|---|---|---|---|---|
| Marktplaats saved search | Built-in alerts | Free | E-mail (push contested) | Official, full coverage | Reported once a day; no relevance scoring |
| MPAlerts | AI-filtered alerts, 4 platforms | €19.95–39.95/mo, 7-day trial | Push, e-mail, Telegram, Discord, RSS | AI relevance + speed | Paid; no per-listing reason shown |
| MarktAlert | Alerts, 3 platforms | Free (2 alerts, 15 min, 14 days) → €6.95–10.95/mo | E-mail, Telegram, push, webhook | Cheap, fast, same free cadence | Keyword filters only |
| Marktplaats Scanner | Alerts + price drops | Free tier → Pro (3 min) | Push, Telegram, Discord, e-mail | Speed, SEO content | No AI relevance mentioned |
| DIY bots (mrktpltsbot etc.) | Self-hosted | Free | Telegram/Pushover/Discord | Full control | Technical; ban risk |

### Indirect
| Competitor | Product | Overlap |
|---|---|---|
| Vinted saved searches | New-item counter, no notification | Same habit, other platform |
| Cleanplaats / Marktplaats zonder spam | Chrome extensions that hide promoted/business listings | Same "noise" pain |
| Doing nothing / refreshing | Manual | The real competitor |

### Differentiation
- **Different method:** a *reason* per alert and a user-chosen relevance bar. Nobody shows the why.
- **Different price:** free with no trial clock.
- **Different format/pace:** calm digests on a schedule (daily at up to 4 times, chosen weekdays) rather than
  constant pings.
- Competition exists, so the need is real (pack: "competition = good news"). The gap is small but clear.

## Recommendation

**Transformation promise (end users):** "Tell it what you want on Marktplaats in plain words; it checks on your
schedule and e-mails only the listings worth a look, each with a score and the reason."

**Sharpened one-line pitch:**
> **Marktplaats alerts that read the listings first: say what you want, pick when to check, and get only the good
> ones, each with a reason.**

(LinkedIn variant: "A free Marktplaats watcher where an AI agent proposes the watch, you approve it, and every alert
explains why it's worth a look.")

**Target group:** the specific-item hunter (buyer-avatar.md), not resellers.

**Format:**
- Type: free web app (MVP), e-mail alerts
- Scope: as built; no new features for marketing
- Delivery: self-serve

**Price indication:** €0 (operator decision). Paid competitors confirm people pay €7–40/month for alerts, which
supports "free" as a real hook.

**Offer-stack fit:** For end users there is no ladder. For Daryl, the app is the **lead magnet** of his personal
brand: it leads to LinkedIn posts → profile/portfolio → interviews or client calls.

**Verdict:**
- **As an end-user business: not validated, don't invest further.** Crowded category, weak "why you", ToS risk.
  Run the 14-day beta only to earn testimonials and an eval.
- **As a portfolio piece: go.** Strong on all four questions. The two upgrades that matter most, in order:
  (1) a small scoring eval with real numbers, (2) 3–5 real user quotes.

**Validation level:** 0–1. **Next step:** beta of 8–10 users + 50-listing eval, then `05-copywriter` for landing
copy and `06-content-creator /social-post linkedin` for the first posts.

## Metadata
- **Created:** 2026-09-27
- **Inputs:** references/onboarding.md, research.md, testimonials.md; generated/buyer-avatar.md, linkedin-audience.md

## 2 Oct 2026: first beta use

One beta user with a Mac mini watch shared a real alert on 1 October and gave unprompted praise: it saves him time and effort, and he is now first to bid on Mac minis. The ladder now has evidence of real use from one user, still no payment. This is one user's feedback, not evidence that the broader market is validated.

The next step remains 8–10 beta users with one real watch each for 14 days.
