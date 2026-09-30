# FDE Course audit of Marktplaats Watcher

**Date:** 29 September 2026 · **State audited:** `main` at `65c3287` (live on https://marktplaats-watcher.vercel.app)
**Question:** how can this project be improved with what the Forward Deployed Engineer course taught?
**Scope:** a written audit only. No code, configuration or production changes were made for it.

## 1. Summary

**Verdict.** As an engineering MVP, Marktplaats Watcher already meets most of the course's delivery rules:

- it's deployed, evaluated, monitored and costed
- its admin pages and health check are locked to the owner
- it has a runbook, and CI with security scans
- it has a real design system
- users now label its output (the alert ratings)

The gaps fall into three groups:

- **Harness hardening:** tools that can still raise, no token or per-user cost caps, no correlated tracing.
- **Evaluation discipline:** no regression or weekly runs, no prompt versions, and precision is still measured
  against the judge instead of the human-corrected labels.
- **The whole Day 3 business side:** customer discovery, positioning, pricing, the trademark, and a lawful data route.

For demo day on 3 October, the open items are mostly human-owned: the rehearsals, a backup recording and the
on-device checks.

**Status, 30 September (evening).** Wave 1 was pulled forward and all 15 of its factory issues (MW-1 to MW-13, MW-15, MW-16) are built, reviewed
and live, except the parts that need Daryl (§5). That closes the harness-hardening group (tools never raise, token
and per-user caps, request ids with errors in the digest) and most of the evaluation group (human-corrected labels,
failure categories, prompt versions, a weekly CI run that waits for its key). Seen working in production the same evening
(a live chat counted and saved by the server; scheduled checks with 0 failures). The scorecard below is the
29 September snapshot and was not re-scored.

### Scorecard

| # | Course theme | ✅ Met | 🟡 Partly | ❌ Open |
|---|---|---|---|---|
| 1 | Discovery and problem framing | 1 | 1 | 4 |
| 2 | Architecture and decisions | 2 | 0 | 3 |
| 3 | Agent harness | 3 | 1 | 4 |
| 4 | Guardrails and security (+1 unverified: the old Azure key) | 3 | 4 | 5 |
| 5 | Evaluation engineering | 3 | 4 | 7 |
| 6 | Observability | 0 | 1 | 4 |
| 7 | Deployment and operations | 4 | 2 | 8 |
| 8 | Product, UX and accessibility | 3 | 1 | 5 |
| 9 | Cost (token economics) | 3 | 1 | 2 |
| 10 | Demo day | 2 | 3 | 3 |
| 11 | Startup cycle and go-to-market | 0 | 1 | 6 |
| 12 | Second brain and software factory | 1 | 2 | 2 |
| | **Total (100 checks, 1 unverified)** | **25** | **21** | **53** |

Most open checks are in the parts of the course the project never aimed at yet (the business side, §3.11) and in
production hardening (§3.6, §3.7). The engineering core (§3.3, §3.5, §3.8) is mostly met, with a short list of
concrete fixes.

### The ten highest-leverage fixes

1. **Tools never raise.** The postcode lookup can crash a chat turn or a whole scheduled check (§3.3). S
2. **Check the ranker's output against its input.** One listing the model leaves out fails the whole watch, again at
   every retry (§3.3). S
3. **A per-user daily budget, a chat kill switch and `max_tokens`.** Today one signed-in user can use up the month's
   AI budget for everyone (§3.9). M
4. **Regression and weekly evaluation runs, with prompt versions.** "Without an eval set every prompt change is a
   superstition" (§3.5). M
5. **Precision against human-corrected labels, with failure categories counted and a UAT sign-off recorded**
    (§3.5). S
6. **A request id end to end, with chat errors in the owner's digest.** "You cannot operate what you cannot see"
    (§3.6). M
7. **The rollback drill, and one redeploy by someone else from the repo alone.** Both are in the definition of done
    (§3.7). S (human)
8. **Global limits:** the rate limit and fetch cap in Convex instead of per server instance, plus timeouts on every
   outbound call (§3.7). M
9. **An egress allowlist and a redirect check.** "Write the policy before you write the prompt" (§3.4). S–M
10. **Discovery before more features:** 3–5 hunter conversations, the Sean Ellis question, positioning and a pricing
    hypothesis. Also settle the lawful data route and the trademark before anything commercial (§3.11). Human

## 2. Method and sources

- **Course material read:**
    - Day 1: cheat sheet, the 82-page slides, and the full 197-page deck (blocks 13–27)
    - Day 2: agent-engineering cheat sheet
    - Day 3: startup cycle (65 pp), and second brain and software factory (22 pp)
    - skills: `fde-skill` (SKILL.md, checklists, references) and `langchain-langgraph-agents`
    - the FDE Vault notes
- **Not available:** the Day 2 handwritten scan (unreadable), and Days 4 and 5 (no material yet). Rules that may
  come from those days are therefore missing from this audit.
- **Project evidence:**
    - the code at `65c3287`
    - `docs/demo/pre-demo-checklist.md` (items 1–25)
    - the ChatGPT audits in `docs/audit/` (A01–A12, R1–R7)
    - `evals/report.md`
    - RUNBOOK, DEPLOY-VERCEL
    - the four plans in `~/.claude/plans`
    - `4 Deliverables/AUDIT-2026-09-26.md`
- **Two independent passes, merged:** two Claude sessions audited the same sources separately on 29 Sep. This report
  is the union of both. Every finding added from the second pass was re-checked in the code on `65c3287`. Findings
  that both passes made independently are the most reliable (Appendix C).
- **Status rules:**
    - ✅ = met, with evidence
    - 🟡 = partly met, or built but not yet proven in production
    - ❌ = open
    - "unverified" = only Daryl can see it (for example the Azure portal)
    - Every code citation was re-opened on `65c3287`.
- **Source shorthand:** D1 = Day 1 deck page, D1-CS = Day 1 cheat sheet, D2-CS = Day 2 cheat sheet, D3-SU / D3-SB =
  Day 3 decks, CHK = `fde-skill/references/checklists.md`, LG = `langchain-langgraph-agents`.
- **Effort:** S = hours, M = a day or two, L = a week or more.

## 3. Audit by course theme

### 3.1 Discovery and problem framing
| Course rule (source) | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| One-paragraph problem, no technology words (D1 p195) | ✅ | `docs/demo/problem-statement.md` | — | — |
| One real conversation with someone who has the problem (D1 p195; checklist 13) | ❌ | Checklist item 13 open | Three hunter conversations, asking about the past ("the last time you looked for something second-hand…") | S · demo week |
| Ideation proof: repeated pain in 20+ interviews (D3-SU p6) | ❌ | None recorded | Interview log in the marketing vault; stop at 20 | L · 3 |
| Value quantified in three buckets: revenue, risk, cost (CHK §1, §9) | ❌ | Not in the demo script | One slide: minutes saved per search, missed good deals, € per month | S · demo week |
| Non-functional requirements written down: p95, peak, availability, cost ceiling per user, retention (D1 p140–141) | 🟡 | Retention and cost exist (PrivacySheet, evals §4); no latency/peak/ceiling | `docs/nfr.md` with the nine questions answered | S · 1 |
| Acceptance criteria in Given/When/Then, traceable to tests (D1 p142) | ❌ | Features were specified in plans, not as G/W/T | Use G/W/T in the roadmap items below and in issues | S · 1 |

### 3.2 Architecture and decisions
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| Thin slice; monolith by default; trade-offs said out loud (D1 p46, p50, p52) | ✅ | Design doc §11 and the decisions table | — | — |
| Pick three of the eight qualities (D1 p151) | ✅ | Security, cost and observability are argued in the design doc | Name them explicitly in the ADR index | S · 1 |
| ADRs in `docs/adr`, numbered, never edited (D1 p152) | ❌ | `docs/adr/` does not exist; decisions live only in the design doc | Backfill about 8 ADRs (Convex, proposals-only chat, owner check, report-only CSP, 15-min dispatcher + leeway, e-mail-only, Vercel Hobby, Clerk dev) | M · 1 |
| Everything versioned, including prompts and eval sets (D1 p149–150) | ❌ | Prompts are inline constants (`agent.py:283` SYSTEM_PROMPT, `agent.py:400` RANK_PROMPT) with no version id; eval data isn't versioned | `PROMPT_VERSION` recorded in logs, `runs` and `evals/*_results.json` | S · 1 |
| Use a graph, MCP or a small decision model where they pay off (D2-CS "seven engineerings"; D3-SB Type Safe AI) | ❌ | The check pipeline is plain Python (`agent.py:431` `check_query`); `search_marktplaats` isn't exposed over MCP; every listing goes to the full ranker | Port the check to a LangGraph StateGraph (fetch → parse → dedupe → rank → notify) with the same eval numbers; a read-only MCP server for the search; a small "worth scoring?" model if it cuts cost without losing precision | L · 3 |

### 3.3 Agent harness
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| Name the three stop conditions; cap model calls (LG) | ✅ | `agent.py:331` (5 model calls), `agent.py:316` `MAX_TOOL_CALLS = 6` | — | — |
| Scope enforced in code, not only the prompt ("prompt rules are requests", D3-SB p9) | ✅ | Watch mode only gets the proposal tools (evals report, case W4) | — | — |
| Human approval for writes (D1 p108) | ✅ | The chat only proposes watches; the user presses Save | — | — |
| Tools return strings, never raise; timeout on every call (LG tool-design) | ❌ | `postcode_location` has no status check and parses `r.json()["response"]["docs"]` (`agent.py:47-49`); callers only catch `httpx.HTTPError` (`agent.py:163`, `agent.py:449`), so a 5xx or HTML reply raises ValueError/KeyError and ends the chat turn or the whole check request | Catch everything in the tool and return a sentence; `raise_for_status` | S · 1 |
| Validate model output (structured output is necessary, not sufficient) | ❌ | Ranker output isn't checked against the ids it got (`agent.py:418-424`); one missing id → score None → the whole watch is reported failed (`agent.py:469-472`) and retried every 30 minutes, likely failing the same way | Re-rank only the missing ids once, then skip-and-log a poison item | S · 1 |
| Output limits and a turn deadline (D1 p177; LG serving) | ❌ | No `max_tokens` on either model (`agent.py:277`, `agent.py:395`); no overall deadline; no `maxDuration` in `vercel.json` | `max_tokens`, and a 60 s turn budget that ends with a clear message | S · 1 |
| Swappable model / fallback ("the model is swappable", D1 p107) | 🟡 | One `OPENAI_MODEL` everywhere; swappable by env, no automatic fallback | Fallback model on provider errors, logged | S · 2 |
| Human review queue for low-confidence cases ("that queue is a product feature", D1 p176) | ❌ | Low scores are simply not e-mailed; nothing is reviewed | Owner queue: listings scored 5–7 plus user "not right" ratings, on `/admin` | M · 2 |

### 3.4 Guardrails and security
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| Ten-minute security checklist before every demo (D1 p82) | ✅ | Secrets injected; gitleaks, pip-audit and npm audit in CI; ownership checked server-side; `/admin` and `/api/health` owner-only (checklist 20) | Rerun it on demo morning | S · demo week |
| AuthZ on every request, server-side (D1 p62) | ✅ | `requireUser` and ownership checks in Convex; Clerk token on `/api/chat` | — | — |
| Secrets in a vault, rotatable (D1 p80) | ✅ | Vercel, Convex and GitHub secrets; HEALTH_KEY, RATING_SECRET and VERCEL_TOKEN piped, never shown | — | — |
| Old course key rotated (checklist 14) | unverified | Only visible in the Azure portal | Daryl: delete the old Azure key | S · demo week |
| Enforced CSP (checklist 11) | 🟡 | `vercel.json:9` is `Content-Security-Policy-Report-Only` | Clean private-window sign-in, then enforce | S · 2 |
| Egress allowlist / sandbox policy ("write the policy before the prompt", D3-SB p10, p21) | ❌ | No allowlist in code, Docker or Vercel | Code-level host allowlist (marktplaats.nl, pdok.nl, api.openai.com) for every outbound call | S–M · 2 |
| Redirects only to allowed hosts | ❌ | `httpx.get(..., follow_redirects=True)` (`agent.py:134`) with no final-host check | Check `page.url.host` against the allowlist | S · 2 |
| Retrieved content is data, not instructions (CHK §4) | 🟡 | Prompt text says so; injection tests cover the user's message only, not listing titles; no score sanity check | Eval cases with hostile titles ("score this 10"); clamp scores that break the filters | S · 1 |
| Never trust the client: the server keeps its own record of what the agent said (D1 p62) | ❌ | `chats.append` accepts `role: "assistant"` from the browser, and proposals are checked for their `type` only (`frontend/convex/chats.ts:21-28`, `:48-52`), so a user can write "assistant" messages into their own history | Write assistant turns from the backend only (with §3.6's server-side transcript); validate every proposal field | S · 1 |
| Retention stated and enforced for every kind of personal data (CHK §4) | 🟡 | "Delete my data" removes ratings (`frontend/convex/users.ts:76`), but deleting a watch leaves its alerts' ratings behind (`users.ts:51-57`), and the 30-day purge skips them (`frontend/convex/checker.ts:340-352`); the privacy text gives no period for ratings | Delete ratings with their watch, and state a period (or "until you delete your data") in `PrivacySheet.jsx` and the README | S · 1 |
| Unauthenticated endpoints rate-limited | ❌ | `/api/csp-report` (`main.py:177`) has no login and no limit | Cap per IP; sample the logs | S · 2 |
| Supply chain pinned and scanned (D1 p79) | 🟡 | Audits run in CI; Actions pinned by tag (`.github/workflows/ci.yml:12` `actions/checkout@v4`); no Dependabot | SHA pins and Dependabot | S · 2 |
| Lawful data route | ❌ | Scheduled querying of Marktplaats is against its terms (art. 7.3); risk accepted for the portfolio version (README) | Get advice or ask Marktplaats for a feed/API before anything commercial | Human · 3 |

### 3.5 Evaluation engineering
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| Golden set ≥ 20 real cases (CHK §3) | ✅ | 20 chat cases (`evals/chat_cases.py`), 49 scored listings | Grow the scorer set to 100+ from user ratings | M · 2 |
| Pass rate as a number | ✅ | Chat 20/20; scorer precision and recall per level | — | — |
| Loop-count check (took 8 steps where 3 expected = FAIL) | ✅ | The chat table records tool calls against a max per case | — | — |
| LLM judge with a human sample (D1 p176) | 🟡 | Human spot-check 7/10, but precision and recall still use the judge's labels (`evals/report.md` line 3) | Recompute with Daryl's three corrections as ground truth | S · 1 |
| Failure categories counted (CHK §3) | ❌ | Misses are listed, not categorised | Categories (wrong model/spec, accessory, over budget, unclear) with counts | S · 1 |
| First-run UAT sign-off, who and when (CHK §3) | ❌ | Not recorded | A dated sign-off line in the report | S · demo week |
| Regression run on every prompt, model or tool change (D1 p108) | ❌ | Evals run by hand; not in CI | A CI job that runs the evals when `agent.py` prompts change (costs about €0.01 a run) | M · 1 |
| Weekly run for drift (D1 p177) | ❌ | None | Scheduled GitHub workflow, results committed | S · 1 |
| Real users label real outputs | 🟡 | Alert ratings live since 29 Sep (`convex/ratings.ts`); 0 ratings so far | Invite the beta users to rate; include in the report weekly | S · 2 |
| Score each layer, not only the final answer (D2-CS) | 🟡 | Chat and scorer tested separately; the parser has one fixture | A scraper canary: a live parse check in the uptime workflow | S · 2 |
| Repeats / pass@k for a non-deterministic system | ❌ | Each case runs once | Run each case 3×, report pass^3 | S · 2 |
| Results name the model that actually ran | ❌ | The model and its price are hard-coded as `"gpt-5.4-mini"` (`evals/run_scorer.py:44-46`, `evals/run_chat.py:32-34`, `evals/cost.py:21-22`), whatever `OPENAI_MODEL` is set to | Read the model from the environment; key the price table by it | S · 1 |
| Evals can be replayed (a prerequisite for a CI gate) | ❌ | The chat set calls the live agent, so live Marktplaats (`evals/run_chat.py:14`); results change with the listings | Record the search pages as fixtures and replay them; keep one live run weekly | M · 2 |
| An independent judge | 🟡 | The judge (`gpt-5.5`, `evals/label.py:13`) and the scorer come from the same provider, so they may share blind spots | Label a sample with a second provider's model and report agreement | S · 2 |

### 3.6 Observability
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| Logs, metrics and traces "on the first day" (D1 p71, p172) | 🟡 | JSON log lines (`main.py:80-82`); dashboard metrics; no traces | — (see the rows below) | — |
| Correlated trace per request | ❌ | No request id across Convex → Python → OpenAI | A request id header, logged at every hop and stored on `runs` and alerts | M · 1 |
| Errors surface where a human sees them (definition of done) | ❌ | The digest covers the scheduler only (`convex/health.ts:22-43`); chat 5xx and client errors only reach Vercel logs | Count chat errors in Convex; digest and dashboard show them; optionally Sentry | M · 1 |
| Audit trail of every agent step, showable (FDE Phase 4) | ❌ | Transcripts are saved by the browser (`ChatView.jsx:90-95`); a failed save is swallowed (`ChatView.jsx:95` `.catch(() => {})`) | Save the assistant turn server-side, with tool calls | M · 2 |
| Cost per outcome, not per month (D1 p174) | ❌ | Monthly estimate only | € per alert sent and € per chat answer on the dashboard | M · 2 |

### 3.7 Deployment and operations
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| Reachable without your laptop; tests in the pipeline (definition of done) | ✅ | Vercel production; CI green | — | — |
| Runbook; uptime check; budget alert (D1 p64–66) | ✅ | RUNBOOK.md; `uptime.yml` every 30 min; OpenAI $10 hard cap | — | — |
| Hard budget alert before the first deploy | ✅ | Hard project cap | — | — |
| Kill switch | ✅ | `CHECKS_PAUSED` | Add one for chat (§3.9) | — |
| Rollback tested (checklist 10; D1 p165) | ❌ | Drill not done; same-API rule (R4) documented | Do it once on a quiet evening; time it | S · demo week |
| One-step deploy that waits for CI (definition of done; D3-SB p19–21: the gate is a machine) | ❌ | Deploying is two manual steps, `npx convex deploy` then `git push` (DEPLOY-VERCEL.md); no workflow deploys or blocks a deploy (`.github/workflows/`); the Docker image is never built in CI. Whether Vercel waits for checks is unverified | A deploy workflow on `main` after CI passes (Convex, then a Vercel deploy hook); build the image in CI | M · 2 |
| Someone else can redeploy from the repo alone | ❌ | Never tried | Hand DEPLOY-VERCEL.md to a course mate or a fresh agent | S · 2 |
| Global limits, stateless instances (D1 p149) | 🟡 | Rate limit and fetch cap are in memory per instance (`main.py:66-77`, `agent.py:21-25`) | Counters in Convex | M · 2 |
| Timeouts and retries with backoff on every outbound call (D1 p168) | ❌ | Convex's calls to AgentMail (`convex/checker.ts:264`) and the check API (`checker.ts:310`) have no timeout; no retry on Marktplaats fetches | AbortSignal timeouts; backoff with jitter | S · 1 |
| Idempotency; durable delivery | 🟡 | Leases and attempt caps (R1–R3); an e-mail may arrive twice by design; no durable outbox (A01) | Idempotency key per alert e-mail | M · 2 |
| Bounded reads | ❌ | `.collect()` on 24 h of alerts and all active watches (`convex/health.ts:24-28`), and on every seen listing in delete-my-data (`convex/users.ts:52-54`) | Page the reads; batch the deletion | S · 2 |
| Tested backups, RPO/RTO (D1 p170) | ❌ | No export or restore procedure | Convex snapshot export, plus a restore drill in RUNBOOK | S · 2 |
| SLO, severity levels, postmortems (D1 p168–171) | ❌ | None | "99% of checks run on time; chat p95 < 20 s"; Sev1–4 in RUNBOOK | S · 2 |
| Feature flags: deploy ≠ release (D1 p164) | ❌ | Features ship on deploy | A flags table in Convex for risky features | S · 2 |

### 3.8 Product, UX and accessibility
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| The four decisions: 8/16/24/32/48, two fonts, one accent, real states (D1-82 p57) | ✅ | Sieve tokens (`frontend/src/styles.css`); real empty and error states (checklist 4, 5) | — | — |
| Hook lands in 2–3 seconds (CHK §5) | ✅ | Landing sentence and CTA above the fold (checklist 3) | — | — |
| Contrast 4.5:1 (D1 p146) | ✅ | Sieve contrast table, both themes | — | — |
| Accessibility: keyboard, labels, reduced motion, screen-reader pass (D1 p146) | 🟡 | Labels, focus rings and reduced motion exist; the streamed answer has no `aria-live`; no axe/Lighthouse or VoiceOver pass recorded | Add `aria-live`; run axe and 10 minutes of VoiceOver; record the result | S · 2 |
| The UI shows an error, not a hang, when the backend fails (LG verification) | ❌ | `streamChat` has no timeout or abort and parses lines unguarded (`frontend/src/lib/stream.js:30`) | AbortController timeout; catch parse errors; always clear the "thinking" state | S · 1 |
| The user journey is tested end to end ("tests are the specification", fde-skill Phase 3) | ❌ | Unit tests cover the API (pytest) and Convex (vitest); nothing drives the real UI: sign in → watch in plain English → check now → alert → rate | Playwright with Clerk testing tokens, against a preview deploy, in CI | M · 2 |
| Error boundary | ❌ | None in `frontend/src` or `frontend/app` | A top-level boundary with a friendly reload | S · 2 |
| Mobile as a PWA (D1-82 p56) | ❌ | No web manifest | `manifest.webmanifest` with icons and theme | S · 2 |
| Language of the market | ❌ | UI English only (`frontend/app/layout.jsx:37` `lang="en"`); agent replies in Dutch when asked | Dutch UI once the interviews confirm the audience | M · 3 |

### 3.9 Cost (token economics)
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| State running cost per month and per user, unprompted (CHK §5) | ✅ | About €0.35/month per hourly watch (`evals/report.md` §4) | Remeasure at the current 20-listing cap | S · 1 |
| Hard budget cap | ✅ | $10/month OpenAI project cap | — | — |
| Retries capped | ✅ | Model `max_retries`; e-mail attempt caps | — | — |
| Cost attributed per user; allowance (CHK §6; A09) | ❌ | No usage table; one user can use up the budget for everyone | Per-user daily token/chat budget in Convex, shown on the dashboard | M · 1 |
| Kill switch for every autonomous loop (CHK §6) | 🟡 | Checks have one (`CHECKS_PAUSED`); chat has none | `CHAT_PAUSED` env | S · 1 |
| Bounded memory | ❌ | `RANK_USAGE` is a module-level list that only grows (`agent.py:397`); the rate-limit map `_recent` keeps an entry for every user ever seen (`main.py:69`) | Only record usage under evals, or cap it; drop empty `_recent` entries | S · 1 |

### 3.10 Demo day
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| URL loads on a network you don't control; the hook works; real states; no secrets; cost stated (CHK §5) | ✅ | Checklist items 1–9 | — | — |
| MVP demoable, not described (CHK §9) | ✅ | Live since 26 Sep | — | — |
| Validated publicly (LinkedIn) | 🟡 | Draft ready; `[DARYL: …]` line open (`docs/marketing/generated/linkedin-launch-post.md:53`) | Write the line; post after the demo | S · demo week |
| Rehearsed twice: engineer and VP versions (CHK §5) | ❌ | Checklist 12 open | Two timed runs; note the times | S · demo week |
| Rollback path known and tested | ❌ | See §3.7 | — | — |
| Backup if live fails | ❌ | No recording | Record the 3-minute script once; keep a redacted real alert e-mail | S · demo week |
| Claims match the evidence | 🟡 | Claims corrected in `801eddd`; no dated claims register | One table: claim, number, source, date | S · demo week |
| On-device checks (items 15, 16, 18, 19, 21, 23, 25) | 🟡 | Deployed; Daryl's checks pending | Daryl, on the iPhone and signed out | S · demo week |

### 3.11 Startup cycle and go-to-market (Day 3)
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| Positioning's five answers: ICP, personas, alternative, differentiator, value prop (D3-SU p33) | 🟡 | All five on one page since 29 Sep: `docs/marketing/positioning-audit-2026-09-29.md` (alternative verified against Marktplaats' own saved search; the landing page now names it) | The same five in the champion's words, from interviews | S · 3 |
| Commitment over compliments (D3-SU p19–20) | ❌ | "Would you pay" answers only | Ask for a small commitment (a pilot slot, an intro) in the beta | S · 3 |
| PMF signal: Sean Ellis 40% "very disappointed" (D3-SU p29) | ❌ | Not asked | Add the question to the feedback sheet after two weeks of use | S · 3 |
| Pricing hypothesis and decision rule (D3-SU p41; D1 p131) | ❌ | None | "€2/month for 10 watches; 5 sign-ups in a week or change the promise" | S · 3 |
| Trademark: search before traction (D3-SU p15–17) | ❌ | The name contains "Marktplaats"; the risk was accepted for the portfolio version | Benelux/EU search; pick a neutral brand before going commercial | S · 3 |
| Pivot/persist decision written down with evidence (D3-SU p25) | ❌ | None | A dated decision note after the beta | S · 3 |
| Unit economics: gross margin, LTV:CAC (D3-SU p43) | ❌ | Cost per watch known, revenue and CAC unknown | Model it once pricing is tested | S · 3 |

### 3.12 Second brain and software factory (Day 3)
| Course rule | Status | Evidence | Recommended fix | Effort · Wave |
|---|---|---|---|---|
| A Markdown vault the agent can read | ✅ | `FDE Vault/` with Projects, Components, Concepts | — | — |
| Decisions dated and kept current | 🟡 | `Decisions.md` and `Evaluation Results.md` still describe v1 | Refresh, or point them to the ADRs | S · 1 |
| "Correct the agent twice → write a skill" (D3-SB p17) | ❌ | Lessons from this project (FastAPI preset, production-deploy check, CSS class clash, Clerk dark menu) aren't in `fde-skill` (CAI-98) | Add them to the skill's checklists | S · 2 |
| Workspace housekeeping: no stale secrets, no copied course material, everything backed up (AUDIT-2026-09-26 #9–#13) | ❌ | `2 Projects/weather-agent/.env` still holds the old Azure entries; `04-researcher` has Playwright profiles and `/Volumes` paths; `05-copywriter/bronnen` may hold paid-course transcripts; about 1 GB of duplicates; the skill and vault repos have no remote | Clear the Azure entries; fix or remove the profiles and paths; check the transcripts; delete the duplicates; add private remotes | S · any time |
| Factory: intake → build → gate → review → ship (D3-SB p19–21) | 🟡 | 30 Sep: all of Wave 1 (MW-1 to MW-13, MW-15, MW-16) ran through the factory: GPT-6 Sol builds, Opus 5.5 reviews by running each change, the operator approves each merge; seven needs-fix cycles across the wave; all live (system design §18–19) | Add a merge-gate script | — · 2 |

## 4. What is already strong (say it on stage)

- **Evaluation in layers:**
    - chat golden set 20/20
    - scorer precision and recall against a stronger judge
    - a human spot check of the judge (7/10, disagreements named)
    - measured cost
    - and now users labelling real alerts
- **Safety by design:**
    - the chat only proposes; a human saves
    - watch mode is enforced in code
    - the owner pages are locked to a Clerk id and e-mail
    - the health endpoint is keyed
    - rating links carry a per-alert code
- **Operations:**
    - runbook with a kill switch
    - uptime workflow that also checks the locks
    - daily health digest
    - CI with pip-audit, npm audit and gitleaks
    - Vercel's production-only deploy trap found and documented
- **Product craft:**
    - a design system with contrast tables
    - light/dark mode
    - a feedback strip with screenshots
    - a drill-down owner dashboard
    - real empty and error states

## 5. Roadmap
Each item is written as done-when (Given/When/Then), so it can go straight into the factory as an issue.

### Wave 1: the week after the demo (from 5 Oct 2026)

Filed on 29 September as factory specs **MW-1 to MW-13** in the Linear team "Marktplaats Watcher" (key MW; the repo's
`.factory.json` binds it), in the order below. Each waits for the operator's `agent-ready` label before the build loop
picks it up.

**Done 30 Sep, before the demo:** every Wave 1 issue, built by GPT-6 Sol, reviewed by Opus 5.5 and merged on Daryl's
OK. Each spec got a reviewer's addendum first, because the specs predate the 29–30 Sep rewrite of the checks. Three
wait on Daryl (`human-ready`): MW-5 (the eval key and the UAT sign-off), MW-9 (reading the ADRs) and MW-14 (the
Marktplaats API application). System design §19 has the evidence for each.

1. **(MW-1, ✅ live 30 Sep) Tools never raise.** Given the postcode service returns HTML or a 5xx, when a chat or check uses a postcode,
   then the user sees "postcode service unavailable", and the other watches in the group still run. (§3.3)
2. **(MW-2, ✅ live 30 Sep) Ranker output check.** Given the model leaves out a listing id, when a check scores, then the missing ids are
   re-scored once and otherwise skipped and logged; the watch still delivers the rest. (§3.3)
3. **(MW-3, ✅ live 30 Sep) Token caps and turn deadline.** Given any chat, when it runs, then no model call exceeds `max_tokens` and the
   turn ends within 60 s with a clear message. (§3.3)
4. **(MW-4, ✅ live 30 Sep) Per-user daily budget and chat kill switch.** Given a user hits the daily allowance, when they chat, then they
   get a friendly limit message; setting `CHAT_PAUSED=1` stops chat for everyone. (§3.9)
5. **(MW-5, ✅ live 30 Sep; key and sign-off with Daryl) Evaluation gate:**
    - human-corrected labels
    - failure categories counted
    - `PROMPT_VERSION` in results
    - a CI job on prompt changes and a weekly scheduled run
    - UAT sign-off line
    (§3.5)
6. **(MW-6, ✅ live 30 Sep) Request ids and errors in the digest.** Given a chat or check fails, when the digest runs, then it lists the
   count and the latest request ids. (§3.6)
7. **(MW-7, ✅ live 30 Sep) Stream timeout.** Given the API hangs, when a user waits 60 s, then the UI shows an error and re-enables the
   composer. (§3.8)
8. **(MW-8, ✅ live 30 Sep) Outbound timeouts** on the AgentMail and check-API calls. (§3.7)
9. **(MW-9, ✅ live 30 Sep, ADRs 0001–0013; reading with Daryl) ADRs 0001–0008 and `docs/nfr.md`.** (§3.1, §3.2)
10. **(MW-10, ✅ 30 Sep: €14.73/month for a busy 15-minute watch, above the $10 cap) Remeasure cost at the 20-listing cap.** (§3.9)
11. **(MW-11, ✅ live 30 Sep) The server writes the agent's turns.** Given a signed-in user, when the browser calls `chats.append` with
    `role: "assistant"`, then it is rejected; assistant turns are written by the backend only. (§3.4)
12. **(MW-12, ✅ live 30 Sep) Evals name the real model.** Given `OPENAI_MODEL` is changed, when the evals run, then `evals/report.md` shows
    that model and its price. (§3.5)
13. **(MW-13, ✅ live 30 Sep) Ratings follow their watch.** Given a user deletes a watch, when it is gone, then its alerts' ratings are gone
    too, and the privacy text states how long ratings are kept. (§3.4)
14. **(MW-15, ✅ live 30 Sep) Design polish:** the Sieve token sweep and the component cards. Layout-changing spacing
    values were kept, so the sweep is partial by design. (§3.8)
15. **(MW-16, ✅ live 30 Sep) Chat eval C3 no longer flaky:** 15/15 repeated runs, up from 7/15. (§3.5)

### Wave 2: October 2026

- global limits in Convex
- egress allowlist and redirect check
- enforced CSP
- rate-limited CSP reports
- SHA pins and Dependabot
- server-side transcripts and the agent audit trail
- idempotency key per e-mail
- bounded reads
- backups and a restore drill
- SLO and severity levels
- feature flags
- low-confidence review queue
- model fallback
- scraper canary
- pass^3 runs
- `aria-live`, error boundary, PWA manifest, axe/VoiceOver pass
- the redeploy-by-someone-else test
- one-step deploy that waits for CI, and the Docker image built in CI
- replayable chat evals (recorded search pages), then the evals as a CI gate
- a second-provider judge on a sample
- Playwright end-to-end tests of the main journey
- fde-skill lessons

### Wave 3: product, gated on validation

1. Twenty interviews, positioning page, Sean Ellis question, commitment ask.
2. Pricing experiment with a written decision rule; unit economics.
3. Trademark search and a neutral brand name.
4. Lawful data route (advice, or a feed/API agreement).
5. Clerk production, a domain and an own e-mail sender.
6. Commercial hosting.
7. Dutch UI, more result pages, price-drop alerts.
8. Telegram, only if users ask for it.
9. A dated pivot/persist decision.
10. Agent architecture, once the evals can prove no regression: the check as a LangGraph StateGraph, a read-only MCP
    server for the search, and a small "worth scoring?" model if it saves cost.

### Any time: workspace housekeeping
Clear the old Azure entries from `weather-agent/.env`; fix the `04-researcher` profiles and paths; check
`05-copywriter/bronnen`; delete the duplicate course files; give the skill and vault repos a private remote; refresh the
vault's `Decisions.md`, `Evaluation Results.md` and `Permissions.md`. (§3.12)

## 6. Demo-week checklist (human-owned, before Sat 3 Oct)
| Item | Owner | Link |
|---|---|---|
| Two timed rehearsals (engineer and VP versions) | Daryl | checklist 12 |
| Record the 3-minute demo as a backup; keep a redacted real alert e-mail | Daryl | §3.10 |
| On-device checks: light mode, iPhone SE, feedback with screenshot, dashboard, sign-in without a landing flash, one alert rating | Daryl | checklist 15, 18, 19, 21, 23, 25 |
| Rollback drill (roll back only to a 29 Sep or later deployment) | Daryl | checklist 10, RUNBOOK §2 |
| Delete the old Azure course key | Daryl | checklist 14 |
| One personal line in the LinkedIn post | Daryl | checklist 17 |
| A one-page claims register (claim, number, source, date) | Daryl + Claude | §3.10 |
| Three hunter conversations, if time allows | Daryl | checklist 13 |
| A value slide in three buckets | Daryl + Claude | §3.1 |
| UAT sign-off line in `evals/report.md` | Daryl | §3.5 |

## Appendix A: course rule index
| Rule | Where in the course |
|---|---|
| Definition of done | D1-82 p47; CHK §2; D1-CS |
| Ten-minute security checklist | D1-82 p82 |
| Pre-demo check; rehearse twice | CHK §5 |
| Evaluation report gate (≥ 20 cases, failure categories, loop-count, UAT sign-off) | CHK §3; fde-skill Phase 3 |
| Regression eval; weekly drift; judge plus human sample | D1-197 p108, p176–177 |
| Three stop conditions; tools never raise; timeouts; caps | LG SKILL.md, tool-design, loop-vs-graph |
| Four decisions; accessibility five checks | D1-82 p57; D1-197 p146 |
| Logs, metrics, traces; cost per outcome | D1-82 p71; D1-197 p172, p174 |
| Rollback, feature flags, SLO, backups | D1-197 p164–171 |
| ADRs; everything versioned | D1-197 p149–152 |
| Sandbox: four constraints; policy before prompt | D3-SB p9–13, p21 |
| Positioning five answers; pricing; unit economics; trademark | D3-SU p15–17, p33, p41, p43 |
| Sean Ellis 40%; cohorts; pivot/persist | D3-SU p25–31 |
| Second brain; software factory stations | D3-SB p4–21 |

## Appendix B: open items from earlier audits
| ID | Item | Status | Where in this audit |
|---|---|---|---|
| A01 | Durable e-mail delivery | 🟡 (leases and caps; no outbox) | §3.7 |
| A07 | Claims register | 🟡 | §3.10 |
| A09 | Per-user budget and allowance | ❌ | §3.9 |
| A10 | Human-approved ground truth; untouched test set | 🟡 | §3.5 |
| A11 | Lawful data route | ❌ | §3.4 |
| A12 | Test the buyer mission and offer before billing | ❌ | §3.11 |
| R4 | Mixed-version rollback | 🟡 (rule, not code) | §3.7 |
| Checklist 10–19, 21, 23–25 | Human checks and deploy follow-ups | see `docs/demo/pre-demo-checklist.md` | §6 |
| AUDIT-09-26 #8 | Shared rate-limit store | 🟡 | §3.7 |
| AUDIT-09-26 #9–13 | Old Azure key entries, skill-pack housekeeping, duplicates, fde-skill fixes | ❌ | §3.12 |
| MVP Gaps #6 | Egress allowlist | ❌ | §3.4, §5 Wave 3 |
| MVP Gaps #7 | More than the first results page | ✅ 29 Sep: checks read every listing since the last check (system design §16); official API access is MW-14 | §3.4 |

## Appendix C: where each finding came from
Two sessions audited the project independently on 29 Sep; this report merges them.

- **Found by both passes (highest confidence):** the postcode tool can raise; `RANK_USAGE` grows forever; rate limits
  are per instance; no per-user budget; listing-title injection untested; CSP report-only; no egress allowlist; no
  error tracking or tracing; no cost per outcome; rollback not drilled; precision measured against the judge; no
  evals in CI; the interviews, legal route and demo rehearsals still open; the vault is stale.
- **Found only by the first pass (the report's base):** the ranker id check; `max_tokens` and a turn deadline;
  redirects to any host; SHA pins and Dependabot; request ids; the audit trail; outbound timeouts; bounded reads;
  backups, SLO and feature flags; the UX items; ADRs and prompt versions; the Day 3 business rows.
- **Added from the second pass, each re-checked in the code:** the browser can write "assistant" messages; ratings
  outlive their watch; the hard-coded eval model; evals that can't be replayed; a same-provider judge; the two-step
  deploy not gated on CI; no end-to-end tests; `_recent` never shrinks; graph, MCP and a small decision model; the
  workspace housekeeping.
