# Everything we learned: Marktplaats Watcher deep-dive audit

**Date:** 1 October 2026 · **State audited:** `main` at `7a925fc` (live on https://marktplaats-watcher.vercel.app)
**Question:** after six days of building (26 Sep – 1 Oct), what did the FDE course, the marketing skill pack, the
project and its GitHub repo teach, and where does the project stand against the course now?
**Scope:** a written audit only. No code, configuration or production changes were made for it.
**Sources:** `1 Course Material/` (Day 1 deck and cheat sheet, Day 2 cheat sheet, Day 3 PDFs), `3 Skills/fde-skill`,
`3 Skills/agent-skill-pack`, this repo (code, `docs/`, `evals/`, `RUNBOOK.md`, git history), GitHub Actions, the Linear
team MW (comment history of MW-1 to MW-34), and production data read during this session.

## 1. Summary

**Verdict.** The 29 Sep audit scored the project **25 met, 21 partly, 53 open** (100 checks, 1 unverified). Re-scored
for 1 Oct with evidence, it stands at **43 met, 25 partly, 31 open** (1 still unverified). Eighteen checks moved to met
(15 from open, 3 from partly) and seven from open to partly; none went down. Almost all of the movement came from the software factory: 33 issues
(MW-1 to MW-13, MW-15 to MW-34) built by GPT-6 Sol, reviewed by Opus 5.5 by running each change, and merged on the
operator's approval. Every merge is live.

What did not move is telling:

- **The business side (Day 3)** is unchanged at 0 met: no interviews, no pricing test, no trademark search, no lawful
  data route. The course treats these as the core of the FDE role; the project has treated them as "after the demo".
- **Human-owned demo items:** the UAT sign-off line and the iPhone check were done on 2 Oct; two rehearsals and a backup recording remain.
- **Platform hardening** that no incident forced (egress allowlist, backups, SLOs, feature flags, end-to-end UI tests)
  stayed open. Everything an incident did force got fixed within hours.

The strongest lesson of the week is in §4 and §5: **monitor the outcome, not the machinery.** Green runs and zero
errors coexisted with users missing good listings for a day (MW-17). The nightly delivery audit, the catch-up and the
"approve the artifact, then send the artifact" rule came out of that.

### Scorecard, 29 Sep → 1 Oct

| # | Course theme | ✅ 29 Sep | 🟡 29 Sep | ❌ 29 Sep | ✅ 1 Oct | 🟡 1 Oct | ❌ 1 Oct |
|---|---|---|---|---|---|---|---|
| 1 | Discovery and problem framing | 1 | 1 | 4 | 1 | 2 | 3 |
| 2 | Architecture and decisions | 2 | 0 | 3 | 4 | 0 | 1 |
| 3 | Agent harness | 3 | 1 | 4 | 6 | 1 | 1 |
| 4 | Guardrails and security (+1 unverified) | 3 | 4 | 5 | 5 | 3 | 4 |
| 5 | Evaluation engineering | 3 | 4 | 7 | 6 | 6 | 2 |
| 6 | Observability | 0 | 1 | 4 | 2 | 2 | 1 |
| 7 | Deployment and operations | 4 | 2 | 8 | 5 | 4 | 5 |
| 8 | Product, UX and accessibility | 3 | 1 | 5 | 5 | 1 | 3 |
| 9 | Cost (token economics) | 3 | 1 | 2 | 5 | 0 | 1 |
| 10 | Demo day | 2 | 3 | 3 | 3 | 3 | 2 |
| 11 | Startup cycle and go-to-market | 0 | 1 | 6 | 0 | 1 | 6 |
| 12 | Second brain and software factory | 1 | 2 | 2 | 1 | 2 | 2 |
| | **Total (100 checks, 1 unverified)** | **25** | **21** | **53** | **43** | **25** | **31** |

### Every check that changed

| Theme | Check (29 Sep audit) | Was | Now | Evidence |
|---|---|---|---|---|
| 1 | Acceptance criteria in Given/When/Then | ❌ | 🟡 | The 29 Sep roadmap and all 34 factory specs carry testable acceptance criteria (Linear MW; audit §5); not yet traced to test names |
| 2 | ADRs in `docs/adr`, numbered | ❌ | ✅ | `docs/adr/0001`–`0013` plus index (MW-9) |
| 2 | Everything versioned, including prompts | ❌ | ✅ | `PROMPT_VERSION` (`agent.py`, `chat-2026-09-30.2` / `rank-2026-10-01.1`) recorded in `evals/report.md` and results (MW-5, ADR 0013) |
| 3 | Tools return strings, never raise | ❌ | ✅ | MW-1, live 30 Sep |
| 3 | Validate model output | ❌ | ✅ | Missing ids re-ranked, then skipped and logged (MW-2; `agent.py` ranker loop) |
| 3 | Output limits and a turn deadline | ❌ | ✅ | `max_tokens` 1,500 chat / 2,500 ranker, 60 s turn, `maxDuration` 300 in `vercel.json` (MW-3, `docs/nfr.md`) |
| 4 | Never trust the client (assistant turns) | ❌ | ✅ | Backend writes assistant turns; browser `role: "assistant"` rejected (MW-11, ADR 0011) |
| 4 | Retention for every kind of personal data | 🟡 | ✅ | Ratings deleted with their watch; period stated (MW-13) |
| 5 | LLM judge with a human sample | 🟡 | ✅ | Precision and recall now use human-corrected labels: 23 real matches after overrides (`evals/report.md`) |
| 5 | Failure categories counted | ❌ | ✅ | Category tables at "great" and "good" (`evals/report.md`) |
| 5 | Regression run on prompt changes | ❌ | 🟡 | `evals.yml` runs on PRs touching `agent.py`/`evals/**`, but the factory merges locally without PRs, so it has never fired that way |
| 5 | Weekly run for drift | ❌ | 🟡 | Cron Mondays 06:00 UTC in `evals.yml`, key set 30 Sep; first scheduled run is 5 Oct |
| 5 | Repeats / pass@k | ❌ | 🟡 | Scorer gate on the median of 3 runs (MW-29); C3 15/15 on repeat (MW-16); not every case repeated |
| 5 | Results name the model that ran | ❌ | ✅ | Model read from `OPENAI_MODEL` (MW-12) |
| 6 | Correlated trace per request | ❌ | ✅ | `X-Request-Id` from Convex (`checker.ts:378`) through FastAPI (`main.py:32`), on every JSON log line, stored on runs and errors (MW-6) |
| 6 | Errors surface where a human sees them | ❌ | ✅ | `errors` table; digest counts chat and check errors with request ids; Errors list on `/admin` (MW-6, MW-25) |
| 6 | Audit trail of every agent step | ❌ | 🟡 | Server saves the assistant turn with listings, proposals and search (`main.py:159`, MW-11); tool calls are not stored |
| 7 | Rollback tested | ❌ | ✅ | Rehearsed 30 Sep, about 6 s each way (checklist 10, RUNBOOK §2) |
| 7 | Timeouts and retries on outbound calls | ❌ | 🟡 | Timeouts on AgentMail (15 s) and the check API (240 s) (MW-8); Marktplaats fetch retried once; no backoff with jitter |
| 7 | Bounded reads | ❌ | 🟡 | Admin lists paged at 200 on indexes (MW-31, MW-32); delete-my-data still collects per watch (`frontend/convex/users.ts:61-91`) |
| 8 | UI shows an error, not a hang | ❌ | ✅ | Stream timeout re-enables the composer (MW-7) |
| 8 | Mobile as a PWA | ❌ | ✅ | `frontend/public/manifest.webmanifest` with a 512 px maskable icon, linked in `frontend/app/layout.jsx:14` (MW-15) |
| 9 | Cost attributed per user; allowance | ❌ | ✅ | `usage` table and per-user daily allowance (MW-4, ADR 0012) |
| 9 | Kill switch for every autonomous loop | 🟡 | ✅ | `CHAT_PAUSED` joins `CHECKS_PAUSED` (MW-4) |
| 10 | Rollback path known and tested | ❌ | ✅ | As §3.7 above |

**Checked and deliberately not upgraded:** UAT sign-off (the line in `evals/report.md:5` was blank here; signed 2 Oct, `749e205`); rehearsals and
backup recording (checklist 12 open); bounded memory (`RANK_USAGE` still grows, `agent.py:500`; `_recent` keeps a key per
user, `main.py:102`); hostile listing titles (the injection cases `I1`/`I2` in `evals/chat_cases.py` test the user's
message only); error boundary (MW-28's chunk recovery is not one); the factory row (no machine merge gate; the gate is
the operator); global limits (the allowance is in Convex, the per-minute rate limit is still per instance).

**30 Sep 2026 snapshot — evaluation numbers then** (`evals/report.md`, 30 Sep 22:53, `gpt-5.4-mini`): 53 listings from 5 watches; "great"
precision 94% (30 Sep 2026 snapshot, median of 3 runs, range 85.7–100%), recall 74%; "good" 83% / 83%; chat 20/20; human spot-check of the
judge 7/10; 30 Sep 2026 snapshot cost €0.028 per 100 listings, €0.0019 per chat question; busiest case €14.73/month (above the $10 cap).

**1 Oct 2026 snapshot — eval workflow re-run, 1 Oct 06:49 UTC (GitHub Actions run 36826865528, main): passed.** Chat 20/20; corrected "great" precision runs 0.947 / 0.944 / 0.900, median 0.944 against the 0.9 gate; "good" precision 0.826. The previous run (30 Sep 20:24) had failed on a single noisy run (0.895), which MW-29's median gate fixes.

## 2. What the course taught, and where the project applied it

| Lesson | Course source | Applied in the project | Gap |
|---|---|---|---|
| Idea → production in 8 stages: frame, scope, design, build, prove, ship, observe, demo | D1 deck 5.1 | Every stage has an artifact: `docs/demo/problem-statement.md`, system design §1–§21, `evals/`, Vercel, digest + audit, demo script | The last stage ("get the next requirement") has no customer yet |
| Thin slice, demoable on day two | D1 deck 5.3 | Live on Vercel 26 Sep, day one (first commit `2026-09-26`) | — |
| Frame the real requirement | D1 deck 5.2 | "Not another saved search": the requirement is "only what's worth a look", not "alerts" (positioning audit) | Framed from research, not from users |
| Discovery: stakeholders, persona, journey, quantified pain | D1 deck 17.1 | Persona "Joris" (`docs/marketing/generated/buyer-avatar.md`) | Persona invented; 0 interviews (checklist 13) |
| Nine non-functional questions | D1 deck 17.3 | `docs/nfr.md` answers all nine, honestly marking what's unmeasured | p95, peak and availability not measured |
| Given/When/Then acceptance criteria | D1 deck 17.4 | Factory specs with checkbox ACs and verify steps (Linear MW) | Not in G/W/T form, not traced to test names |
| Hypothesis and three KPIs | D1 deck 17.5 | Dashboard tiles (accounts, active, alerts, audit misses) | No written hypothesis with a decision rule |
| ADRs | D1 deck 19.4 | `docs/adr/0001`–`0013` (MW-9) | Operator reading pending (MW-9 human-ready) |
| Release and rollback | D1 deck 22.3 | Rollback drill 30 Sep; RUNBOOK §2 | No feature flags; deploy = release |
| Evals: 20–200 real cases, regression, human queue | D1 deck 24.3 | 20 chat cases, 53 scored listings, median-of-3 gate, CI workflow | No review queue; evals not replayable |
| Cost is a non-functional requirement | D1 deck 26.3 | Per-user allowance, kill switches, €/100 listings measured | Busiest watch exceeds the cap; no cost per outcome |
| Adoption and handover: "a customer who no longer needs the FDE" | D1 deck 26.4 | RUNBOOK with 12+ procedures, DEPLOY-VERCEL | Nobody else has redeployed it |
| Ten-minute security checklist before every demo | D1 deck 12.5 | Checklist rows 1–9, 20; gitleaks, pip-audit, npm audit in CI | "Real customer data is not in your demo": the operator chose to show the dashboard as is |
| "They judge your empty state" | D1 deck 7.4 | Real empty, loading and error states; Sieve design system (system design §14) | — |
| Definition of done: reachable without your laptop; someone else could redeploy | D1 deck 5.4 | Reachable: yes | Redeploy by someone else: never tried |
| Model + harness = agent; loop, context, tool and eval engineering | D2 cheat sheet; `fde-skill/references/agent-engineering.md` | Hand-written capped loop, tools that never raise, structured ranker output, proposals-only writes (system design §4–§8) | Graph and MCP engineering unused (only in the weather-agent exercise) |
| Software factory: intake → build → review → ship | D3 "second brain and software factory" | 33 issues through Linear → GPT-6 Sol → Opus review by running → operator merge (system design §18–§21) | Merge gate is human, not a machine |
| Second brain | D3 second brain | `FDE Vault/`, memory files, the system design as the project's long-form memory | Vault `Decisions.md` and `Evaluation Results.md` still describe v1 |
| Startup cycle: commitment over compliments, PMF, pricing, paid POC | D3 startup cycle | Positioning's five answers on one page | Everything else in §3.11 still open |
| Own the demo and the pilot | D3 startup cycle; `fde-skill` Phase 5 | Live product with real users (4 accounts, 1,000+ alerts) | Rehearsals and backup not done |
| Hook in 2–3 s; cost unprompted; rehearse twice (engineer + VP) | `fde-skill/references/checklists.md` §5 | Landing hook; cost in the demo script | Rehearse twice: open |

## 3. Marketing engineering (the agent skill pack)

**What the pack produced** (`docs/marketing/`, 27–29 Sep), using the strategist, researcher, copywriter and content
agents of `3 Skills/agent-skill-pack`:

- **Positioning** (`positioning-audit-2026-09-29.md`): the saved search sends every ad with your words; Watcher reads
  each new ad and e-mails only those worth a look, with a score and the reason, on your schedule. Contrarian belief: "a
  keyword match isn't a good match".
- **Competitors** (`competitors/`): Marktplaats saved search (free, push and e-mail, no score), MPAlerts (€19.95–39.95/month,
  AI filter, no reason shown), MarktAlert (keyword only, €6.95–10.95).
- **Validation** (`generated/validation.md`): as an end-user product 1 pass and 3 weak on the four-question test, "not
  validated"; as a portfolio piece 4/4, "go". Validation level 0–1.
- **Avatar, in-app copy, LinkedIn launch post and an 8-post series, X repurposing.**

**Verified, not assumed:** the saved search's daily e-mail (three help pages say "dagelijks"; one says "direct", so the
copy says "per its help pages"); the live "mac mini" first page (25 ads, about 9 not a Mac mini, 10 paid); the operator's
own saved search sent no e-mails that could be found. This came from the rule "verify competitor claims on primary
sources and the live logged-in site", now a standing memory.

**Still assumed:** the persona, the willingness to pay, the "minutes saved" value. No testimonials exist
(`references/testimonials.md` is a plan).

**Gaps against what the pack recommends:**
1. No evidence of use beyond 4 accounts: no beta cohort, no Sean Ellis question, no commitment ask.
2. No head-to-head week against the saved search, and no "read N, sent 1" line in the e-mail or app, the single most
   persuasive proof the pack's proof framework asks for.
3. The mechanism is unnamed (the pack's MAGIC naming not applied).
4. The demo was not built on the pack's structures (proof-first hook, Epiphany Bridge, three false beliefs) until the
   1 Oct demo script.
5. Twelve `[DARYL]` copy decisions open in `generated/in-app-copy.md`; the launch post's personal line is unwritten.
6. Stale claims: `validation.md` "push contested" (verified since); the post-8 claim "95 tests" is now 131 pytest + 150
   vitest.
7. Risk the positioning names but can't fix: Marktplaats is adding plain-language AI search (reported Feb 2026).

## 4. Engineering lessons

Each pattern from `docs/system-design.html`, grouped, with the event that taught it.

### Agent design
| Pattern | Taught by |
|---|---|
| Ship the thinnest slice end to end, prove it live, then add autonomy | Day-one deploy; autonomy (schedules) added in v2 (§12) |
| Draw the system as model + harness; the harness is where the engineering happens | Every failure this week was in the harness, none in the model's reasoning (§18–§21) |
| Write the loop by hand first; name the three ways it ends | Capped loop: answer, cap (5 model calls, 6 tools), error (§5) |
| The LLM chooses what to search; deterministic code decides what matches | Price/distance filters applied by Marktplaats, never by the model (§16) |
| Limit what the agent can do before limiting what it says | Watch mode gets only proposal tools; injection cases I1/I2 pass (§7) |
| The model proposes, the user decides | Save watch is a human click; the catch-up sends only an approved plan (MW-27) |

### Evaluation
| Pattern | Taught by |
|---|---|
| Write the pass condition first; let real users label real outputs | Alert ratings (`/rate`); 4 ratings so far |
| An evaluation that finds nothing proves nothing | Golden sets grown after each miss (accessories, MW-22) |
| A green eval can hide a coin flip | C3 passed once, then 7/15 on repeat; fixed to 15/15 (MW-16) |
| Gate on the median, not one run | One run failed at 0.895; three runs gave 1.0 / 0.857 / 0.944 (MW-29) |

### Security and secrets
| Pattern | Taught by |
|---|---|
| Never trust the client | Browser could write "assistant" turns (MW-11) |
| Local config is production-adjacent | Tests wrote 11 junk rows to production through a restored `.env` (MW-30) |
| Never touch the main `.env`; worktree links only after `pwd` | A symlink destroyed it on 30 Sep; sensitive keys unrecoverable from Vercel |

### Deployment and the browser
| Pattern | Taught by |
|---|---|
| When production differs from local, log the non-secret config | Deploy-only defects (Vercel Python preset, §10) |
| Check the deploy actually changed production | Production silently stayed on an old version (§10, §18) |
| HTML must not be cached across deploys | White page: Vercel answered 304 to a fixed `Last-Modified`, old HTML pointed at deleted chunks (MW-33, MW-34) |
| Run it where it will run | Reviews on the live site found the 20–25 s lists (MW-31) and the white page |

### The factory
| Pattern | Taught by |
|---|---|
| Builder and reviewer are different models with different jobs | GPT-6 Sol builds, Opus reviews by running it: 12 needs-fix verdicts caught before merge (§6 below) |
| A builder that can't see the screen needs a reviewer who can | MW-15 token rounding broke layouts; seen only in screenshots |
| Specs go stale fast; add a spec addendum | Wave 1 specs predated the 29–30 Sep rewrite (§18) |
| Measure before describing a fix | MW-31 measured 20–25 s before and 0.7 s after |
| Keep gates human where they touch the world | Every merge and every user e-mail approved by the operator |
| Approve the artifact, then send the artifact | Catch-up re-scored at send and differed from the approved list (MW-27) |
| Test at the same door, at the same depth | Positional click wasn't proof; clicking the panel's X element was (MW-34) |

### Operations
| Pattern | Taught by |
|---|---|
| Monitor the outcome, not the machinery | Zero errors while late-published listings were skipped (MW-17); nightly delivery audit (MW-18) |
| Test through the same door production uses | A dry run bypassed HTTP validation and missed the 422 (MW-19 → MW-20) |
| "Does it really do X?" is answered by code plus a live run | Competitor and Marktplaats claims verified on the live site (§17) |

## 5. Incidents and near-misses

| Incident | Cause | Detected by | Fix | Prevention now |
|---|---|---|---|---|
| Only the first results page was read (29 Sep) | The `/q/` page ignores sort and filters, shows 30 in its own order | Code reading during positioning work | Filtered, date-sorted search API, read every page since the last check (§16, ADR 0009) | Nightly audit re-reads each watch |
| Late-published listings skipped (30 Sep) | "New" meant "newer than the watermark"; Marktplaats orders by day only | Operator asked "are users getting what they signed up for?"; replay against production | New = not in `seen_ids` (MW-17) | Delivery audit at 04:30 UTC (MW-18) |
| A broad watch couldn't keep up | 20 scores per check vs hundreds of new iPhone listings | Replay; backlog counter | "Can't keep up" warning and health item (MW-19); iPhone watch paused before the demo | Spec I: narrow at save |
| 422 on every iPhone check, 19:04–19:34 (30 Sep) | MW-19 raised the seen window to 1,500 without raising the API's 1,000 limit | Production errors 30 min after merge | `seen_ids` max 2,000 (MW-20) | Spec D: end-to-end test through the real route |
| Catch-up sent 3 unapproved, missed 9 approved | Send re-ran the audit instead of sending the approved list | Reviewer compared sent vs approved | Plan table: send exactly the plan (MW-27); top-up of 9 | "Approve the artifact, then send the artifact" |
| Catch-up false "sold" | A word search matched "apart verkocht" in descriptions | Review of the dry-run list | `isReserved` flag from the page (MW-23) | — |
| `.env` destroyed (30 Sep) | `ln -sf` ran in the main checkout, not the worktree | Next local run | Keys restored from Convex; HEALTH_KEY rotated; new OpenAI key by the operator | Memory rule: never touch the main `.env` |
| Tests wrote to production | Restored `.env` held `CONVEX_SITE_URL` + secret; tests posted for real | Dashboard showed fake usage and chat errors | 11 rows deleted with the operator's OK; `conftest.py` clears secrets, blocks non-local hosts (MW-30) | Test guard |
| Eval gate failed on noise | One scorer run at 0.895 | `evals.yml` failure 30 Sep 20:24 | Median of 3 (MW-29) | — |
| White page after closing a panel | Stale cached HTML (304 on a fixed `Last-Modified`) pointing at deleted chunks; full page load on close | Operator, in a real browser | HTML `no-store` (MW-33); client-side close + one-time `Clear-Site-Data` (MW-34) | Reviewer first blamed automation tabs: verify in the user's setup |
| Dashboard lists took 20–25 s | Client-side filtering of whole tables | Reviewer timing on production | Server filters, 200-row pages, indexes (MW-31, MW-32): 0.7 s and 0.2 s | — |
| Deploys silently stayed on the old version | Vercel production-only deploy trap | Live check after a deploy | Documented in DEPLOY-VERCEL and RUNBOOK | Smoke test after every deploy |
| Demo script claimed no 5-watch limit (1 Oct) | A keyword search missed `MAX_WATCHES = 5`; nothing confirmed the claim | Reading the landing page ("up to 5 watches") during the MW-45 review | Script frees a slot before the demo; fallback line if the limit appears | Confirm a "doesn't exist" claim by reading the code path, not by a search that finds nothing |

## 6. Factory retrospective

**Volume.** 34 issues filed in team MW; 33 built by the factory (MW-14 is the operator's API application). 170 commits
from 26 Sep to 1 Oct (16, 17, 16, 25, 91, 5 per day); 91 of them on 30 Sep alone, the factory's first full day.

**First-pass rate.** From the Linear verdict comments (`factory-review verdict … result=F/P`): **22 of 33 issues passed
review the first time (67%)**. Eleven issues needed a fix round, 12 rounds in all: MW-3, MW-5, MW-8, MW-10, MW-13,
MW-15 (twice), MW-18, MW-23, MW-26, MW-29. MW-17 was merged twice (a follow-up commit on the same issue).

**What review caught that the build missed:**
- MW-10: a hard-coded "above cap" sentence instead of a computed one.
- MW-5: a test that read committed data, so it would break when the data changed.
- MW-15: layout regressions from token rounding (fixed body line-height, `.photo` with `flex:none`), seen only on screen.
- MW-18: false alarms from the first look, and unscored candidates counted as misses.
- MW-23: the word-search "sold" check and a baseline that hid real misses.
- MW-26: Ask box at 13/15 on its golden set (a spurious text filter, the owner's own e-mail); 15/15 twice after.
- MW-29: an order-dependent test (`OPENAI_MODEL`).

**What review missed, and why:**
- MW-19 → MW-20: the reviewer's dry run called the function directly, bypassing FastAPI validation. Lesson: test
  through the same door.
- MW-23 → MW-27: review approved the dry-run list but not how the send rebuilt it.
- MW-33 alone did not fix the white page for browsers already holding stale HTML; MW-34 did. The reviewer also first
  put the bug down to the automation tabs until the operator reproduced it.

**What it cost and gave.** Review by running it (production dry runs, browser drives, timing) is slower than reading a
diff but caught 12 defects before users saw them. The three that escaped were all in the gap between "the function
works" and "the deployed path works".

**Process notes.** Every spec needed a reviewer's "Spec addendum" first (specs went stale within a day). A Linear 503
once left MW-29 with two labels; repaired by hand. A detached `&` dispatch was killed; dispatches now run tracked.

## 7. Open items, ranked

### Demo week (before Sat 3 Oct; freeze Fri 2 Oct 22:00)
0. **Free a watch slot** before rehearsing: you have 5 of 5 watches, so the live **Save watch** would fail (see the script's setup).
1. **Two timed rehearsals, engineer and business versions** (checklist 12) with the 1 Oct 5-minute script.
2. **Record a backup run** and keep one real alert e-mail ready (§3.10 of the 29 Sep audit).
3. ✅ **Done 2 Oct** (`749e205`, MW-5 closed). **UAT sign-off line** in `evals/report.md:5`: name, date, `chat-2026-09-30.2` / `rank-2026-10-01.1` (MW-5, checklist 33).
4. **On-device checks** on the iPhone (checklist 15, 18, 19, 28), signed-out landing (23), Website visitors panel (21),
   rate one real alert (25).
5. **State the cost unprompted**, with the honest busiest-case number (checklist 34: spend within the $10 cap).
6. **Read the ADRs** (MW-9) and **ask Marktplaats about API access** (MW-14). Update 3 Oct: there is no public sign-up; API access goes through certified partners for posting ads, so the route is a call to the Ondernemersdesk (steps in MW-14).
7. **Delete the old Azure course key** (checklist 14, the one unverified check).
8. **One personal line** in the LinkedIn post (checklist 17).
9. Three hunter conversations, if there's time (checklist 13).
10. Checklist 11 (enforce the CSP after a private-window sign-in) and 24 (Clerk production, decided: after the demo).

### After the demo: factory specs (filed 1 Oct; build after Sat 3 Oct)
| Spec | Title |
|---|---|
| A (MW-35) | Problem box counts each watch's latest audit only |
| B (MW-36) | Hide "can't keep up" on paused watches |
| C (MW-37) | Cache reset marks itself done before fetching |
| D (MW-38) | End-to-end test through the real HTTP check route |
| E (MW-39) | Backfill `seededAt` for existing watches |
| F (MW-40) | Owner e-mail for a real miss (≥ 9/10) |
| G (MW-41) | Quiet-watch alarm |
| H (MW-42) | Canary watch on "iphone" |
| I (MW-43) | Narrow broad watches at save |
| J (MW-44) | Neutral Ask box placeholder |

Also filed 1 Oct, for **before** the freeze at Daryl's request: **MW-45**, a Refresh icon with "Updated HH:MM" on the dashboard and a Dashboard tab on phones (owner only). Merged 1 Oct (main `d4aa99d`) and checked on production: Refresh 0.57 s, no reload. The phone tab is still to be seen on a real phone.

Also 1 Oct evening: **one authoritative design system** (`docs/design/DESIGN-SYSTEM.md`, 131 token values checked, contrast computed, 10 drifts audited; older design docs marked superseded) and **MW-46** (new-alert glow for that visit; archive one or all; restore from Archived). MW-46 passed review on the preview with a real new alert (glow measured per frame: settles once, no loop; archive and restore work); merged 1 Oct evening on Daryl's OK (main `a63284d`).

**2 Oct: the whole backlog shipped.** MW-35 to MW-55 (19 issues, MW-45 and MW-46 having shipped on 1 Oct; including the parked MW-35 to MW-44 and the feedback-loop work MW-47 to MW-53) were reviewed by running them and merged on Daryl's per-issue OK by 12:40, the last eleven through the new merge gate (`docs/factory/merges.md`). Details in system design §22.

**Convex usage (2 Oct):** the owner dashboard's live whole-table reads (`admin.dashboard` 2.11 GB, `admin.ratingStats` 1.11 GB) pushed October past the free plan's 1 GB of database reads in two days; the team moved to the Starter plan ($20 monthly disable threshold). Lesson: a live query that scans tables costs in proportion to how often its data changes times how many screens watch it. Fix filed as MW-56 (after the demo). **MW-56 shipped the same afternoon** (merged `3b73ce3`, backfilled, dashboard numbers identical before and after; dashboard reads about 90% lower with a live tab open; first live alert landed in the totals with no drift). Review caught that one-document-per-day buckets could have hit Convex's 1 MB limit and stopped alerts; hourly buckets and a guard that never blocks the source write fixed it. **3 Oct (demo morning):** two dashboard warnings proved false alarms, each traced to a cause and filed: the canary reads a page that is 29/30 paid placements (MW-57), and the scorer is never told a price is only a starting bid (MW-58). Both shipped that morning (`d72b3a5`, `103a4df`); the eval gate passed on `main` with the four starting-bid listings scored 6–7. The first live alert on the new scoring (09:34) was a €185 fixed-price Switch OLED, scored 10/10 and e-mailed. MW-59 then made the dashboard's red line explain each miss in plain words ("check scored 2") instead of raw request ids. The afternoon added prompt templates, a RAG index in Convex, an MCP server, and a MongoDB Atlas mirror with failover (1,131 vectors, index READY); a vulnerable MCP library was caught by CI and upgraded (MW-72). On 4 October: Clerk's development label hidden (MW-74), the account menu also top right behind a Vercel switch (MW-75), a UI/UX benchmark of the course community site (MW-77), and the meaning of great / good / every new listing shown everywhere it appears (MW-84); a 14-slide pitch deck for Marktplaats was built from the pitch pack. On 5 October: the Founding 100 (first 100 accounts free for 30 days each, waitlist after that, MW-85), a €1 AI budget per person per 30 days (MW-86), a live places counter (MW-87), the owner's OpenAI spend card with breakdowns (MW-88); OpenAI prepaid credit ran out for two hours (nothing unscored was sent; auto-reload now on), and MW-91 makes the dashboard name that cause and e-mail the owner. On 5–6 October: first-use screens with a clear "Create a watch" (MW-79), a "What happens after I start watching?" explanation (MW-81), and the founding month (MW-89): day-14 disappointment survey, day-25 notice, day-30 pause until "Keep my watches" with two questions for another 30 days; review also stopped catch-up e-mails and audit cost for paused or over-budget people. On 6 October new security advisories (pymongo, source-map-js) turned CI red without a code change; MW-93 upgraded both and CI is green again; a flaky older test that once stopped the merge gate is filed as MW-92. Later on 6 October the factory completed the backlog (MW-69, 70, 90, 94, 65, 82, 68, 92, 71, 96 live): "Help me make an offer", a broad-watch warning, a templates picker, "Needs your attention", cleaner alert answers and a self-restoring merge gate; every review found something the builder's partial test run had missed. MW-78 (described account menu) and MW-97 (LF line endings for every text file) closed the factory backlog the same day; what remains are Daryl's own steps (MW-83, MW-95, MW-9, MW-14, MW-76). The highest-leverage next steps are people and access, not code: fill the founding places, start the Marktplaats outreach and API-access request, and interview the first users; ready-to-send drafts are in docs/marketing/outreach-drafts-2026-10-06.md. On 7 October the scorer got fairer to good listings (MW-98: real misses fixed, the bidding rule enforced in code, good-match precision 83% → 91%), the dashboard stopped freezing when left open (MW-99), and a new sharp advisory was fixed with the merge gate now installing npm packages (MW-100). On 9 October ratings started teaching the watch: a one-tap fix after "Not right" (skip a word, lower the maximum, great or good matches) with Undo, the scorer using the watch's last 8 ratings as examples, a first-week rating card, rating links under each e-mailed listing and a weekly rated-share metric (MW-106 to MW-109). The baseline is 1% of e-mailed alerts rated. New Next.js advisories the same day turned CI red; MW-110 upgraded Next.js to 16.4.0 and CI is green again.

### After the demo: from this audit
- **Business side first** (the course's weakest theme here): 20 interviews, Sean Ellis question, a pricing hypothesis
  with a decision rule, trademark search, the lawful data route.
- **Proof for the positioning:** a head-to-head week against the saved search, and "read N, sent 1" in every e-mail.
- **Hardening still open:** egress allowlist and redirect check, backups with a restore drill, SLO and severity levels,
  feature flags, Playwright end-to-end tests, error boundary, bounded memory (`RANK_USAGE`, `_recent`), replayable chat
  evals, a second-provider judge, hostile-title injection cases, review queue for scores 5–7, cost per outcome.
- **Factory:** a machine merge gate, and the PR-path for `evals.yml` (local merges never trigger it).
- **Second brain:** refresh the vault's `Decisions.md` and `Evaluation Results.md`; put this week's lessons into
  `fde-skill` (correct the agent twice → write a skill).
