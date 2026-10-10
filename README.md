# Marktplaats Watcher (MVP)

Tell it what you want on Marktplaats, pick how often to check, and get an e-mail when a good one shows up.

We hide paid placements and, unless you choose otherwise, shops and dealers. We use only whether a seller has a website, never who they are. The shop filter is enabled after its live signal review.

Before setting `BUSINESS_SELLER_FILTER_ENABLED=1` on the search service, review 24 hours of normal scheduled runs in the owner dashboard's Runs view. It records counts for website URL present, show website true, and the combined signal; no seller identity is logged. Hand-check at least 20 flagged listings during those existing reads and record precision in the review. Leave the flag at `0` if the signal is weak.

**Live:** https://marktplaats-watcher.vercel.app (https://marktplaatswatcher.vercel.app, without the hyphen, redirects there).

- **Sign in** with Clerk (your e-mail address is where alerts go).
- **Chat** to search Marktplaats, or ask it to watch something: "tell me when a Gazelle bike shows up
  near 3511AB, every morning at 8". The chat only *proposes* a watch; you press **Save watch**.
- **Pick the schedule in plain English**: every 15 or 30 minutes, every 1, 3, 6 or 12 hours, every day at
  up to four times, or on chosen weekdays at a time (Amsterdam time).
- **Alerts**: each new listing is scored 0 to 10 by the model with a one-line reason; you choose
  "great matches only", "good matches" or "every new listing". The first check of a new watch only notes
  what is already listed, so you're only told about new ones. The Alerts tab (and the sidebar on desktop)
  shows how many arrived since you last looked.

```
Browser (Next.js + Clerk + Convex client)
 ├─ chat ────────► FastAPI /api/chat (Clerk token checked) ─► OpenAI + tools
 │                  search_marktplaats · propose_watch · propose_watch_change (proposals only)
 └─ Save watch ──► Convex (users, watches, seen listings, alerts)
Convex cron, every 15 min ─► due watches (and those due within 2 min), one read per distinct search + filters
   ─► FastAPI /api/internal/check (CRON_SECRET) ─► read every listing since the last check (date-sorted, filtered) + drop seen + model scores new
   ─► Convex stores them ─► AgentMail e-mails the good ones
```

| file | what it is |
|---|---|
| `agent.py` | The search tool, the watch-proposal tools, the chat loop, and the scoring used by scheduled checks. |
| `main.py` | FastAPI: `POST /api/chat` (login required), `POST /api/internal/check` (Convex only), `GET /api/health` (owner's uptime check only: needs `HEALTH_KEY`, 404 for everyone else). |
| `frontend/convex/` | Database schema, watches, the scheduled checker, e-mail (incl. the Dutch/English onboarding sequence in `nurture.ts`), crons, and `schedule.ts` (next-check maths and plain-English wording, shared with the UI). |
| `frontend/app/`, `frontend/src/` | Next.js (App Router, static export): landing page, public Dutch/English landing pages `/nl/` and `/en/` (live founding-places count, first-touch UTM source stored at sign-up); desktop sidebar + phone tab bar; streaming chat with photo cards and saved history; watches, alerts, first-run setup; the feedback strip, the theme toggle and the owner dashboard (`/admin`). |
| `test_agent.py`, `frontend/convex/*.test.ts` | Offline tests (no model, no Marktplaats, no e-mail). |
| `.env.example`, `frontend/.env.example` | Every setting, with where to find it. **Never commit real values.** |

## Run it locally
You need an OpenAI key, a Clerk application, a Convex account and an AgentMail inbox + API key
(see [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) for where each value comes from).

| Variable | Purpose |
|---|---|
| `MODEL_PROVIDER` | Optional chat and rank provider; defaults to `openai`. Production installs OpenAI only; an Anthropic deployment requires deliberately adding `langchain-anthropic` to production requirements. |
| `OPENAI_MODEL` | Chat and rank model name, including when `MODEL_PROVIDER` selects another provider. |
| `OPENAI_API_KEY` | Required for the default provider and embeddings. |
| `ANTHROPIC_API_KEY` | Required for an Anthropic model swap; install `requirements-evals.txt` for a local eval rerun. |
| `JUDGE_MODEL` | Optional eval judge model; defaults to `gpt-5.5`. |
| `MODEL_INPUT_PRICE_USD_PER_MILLION`, `MODEL_OUTPUT_PRICE_USD_PER_MILLION` | Required for an eval model absent from the price table; used for cost reporting. |

```bash
cp .env.example .env                           # fill in
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
.venv/bin/uvicorn main:app --port 8000

cd frontend && npm install
cp .env.example .env.local                     # add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
npx convex dev                                 # logs in, creates the dev deployment; copy its URL to NEXT_PUBLIC_CONVEX_URL
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
npx convex env set WATCHER_API_URL <a URL Convex can reach, e.g. your Vercel preview or a tunnel to :8000>
npx convex env set CRON_SECRET <same value as in .env>
npx convex env set AGENTMAIL_API_KEY <key>     # typed by you, never pasted into a chat
npx convex env set AGENTMAIL_INBOX_ID marktplaats-watcher@agentmail.to
npx convex env set APP_URL http://localhost:3000
npx convex env set OWNER_EMAIL <you@example.com>   # daily health digest (only when something is wrong)
# npx convex env set CHECKS_PAUSED 1              # kill switch: stops all scheduled checks (see RUNBOOK.md)
npm run dev                                    # Next.js on http://localhost:3000 (proxies /api to :8000)
```
Preview a check: `npx convex run checker:checkDue '{"dryRun": true}'` fetches and scores, logs the e-mails it would
send, and changes nothing (no listings marked seen, no alerts, no schedule change).

Tests: `.venv/bin/python -m pytest -q` and `cd frontend && npm test && npm run typecheck`.
CI runs the same on every push to every branch, plus `pip-audit`, `npm audit` and a gitleaks secret scan
(`.github/workflows/ci.yml`). An uptime check runs every 30 minutes (`.github/workflows/uptime.yml`).

## Design and logo
The design system (colours, type, spacing, motion, components, states, voice, with a 1 Oct audit) is in
[`docs/design/DESIGN-SYSTEM.md`](docs/design/DESIGN-SYSTEM.md): the one source of truth for the app's look.

Architecture decisions are indexed in [docs/adr/](docs/adr/README.md); current non-functional requirements are in [docs/nfr.md](docs/nfr.md).
The [Case study](docs/case-study.md) traces the buyer problem, architecture, production failure, evaluation evidence, costs and pilot gaps.
The [feedback loop audit](docs/audit/2026-10-02-feedback-loop.md) traces user signals through evaluation, release and reply.
The [3 October prompt templates, MCP and RAG audit](docs/audit/2026-10-03-prompt-templates-mcp-rag.md) maps the course material to the planned demo-day work.
The [weekly listening loop](RUNBOOK.md#weekly-listening-loop) gives the Monday routine and its read-only `scripts/factory/loop-status.sh` checkpoint.

The look follows the **Sieve** design system (`docs/design/sieve/`, made with Claude Design): warm graphite, one teal
accent, lilac highlights for the fill-in sentence, Geist and Geist Mono (self-hosted). The logo is defined once in
`frontend/src/brand/logo.js`. Change `LOGO` there, then run `cd frontend && npm run brand` to regenerate the favicon,
app icons, OG image and `docs/design/logo-h-to-i.gif`. Options and decisions: `docs/design/logo-review.md`.

## Evaluation, cost and operations
- **Evaluation:** `evals/report.md` measures chat and listing scores against judge labels corrected by human spot-checks,
  with [operating rules](evals/report.md#operating-rules), [open risks](evals/report.md#open-risks),
  [failure mapping](evals/report.md#failure-mapping), outcome and trajectory grades, abstention strata, latency,
  and prompt versions. A pull request changing `agent.py` or `evals/**`, a Monday 06:00 UTC
  schedule, or a manual dispatch reruns the evals; the gate requires all but one chat case (22 of 23) and 90% precision for
  "great" matches. The 10 Oct 2026 report records 100% great precision, 74% recall (median of 3 runs) on 53 listings from 6 watches, and 23/23 chat cases. The operator fills in the report's UAT sign-off after review. Rerun locally with
  `.venv/bin/python -m evals.run_scorer`, `evals.run_chat`, `evals.report`, `evals.gate`, `evals.cost`.
- **Cost:** an hourly watch is about €0.33/month with 1 new listing per check and €3.68 with 20; a busy 15-minute
  watch (20 new listings every check) is €14.73/month, within the $110/month OpenAI project cap but far above each user's €1 AI budget per 30 days, which pauses it first; a chat question about
  €0.0020 (9 Oct 2026 report, `evals/report.md` §3–4); scoring costs €0.0302 per 100 listings.
- **Feedback and "would you pay?":** a slim "Free beta · Give feedback & suggestions" strip sits on top of every signed-in
  page. Each message comes with a screenshot of the page it was sent from (opt-out, e-mail addresses blanked), the
  page, screen size, browser, app version and the last few errors in that tab. It's e-mailed to `OWNER_EMAIL`;
  `cd frontend && npx convex run --prod feedback:summary` counts the answers and lists the latest messages.
- **Owner dashboard (`/admin`):** only the owner's account (its Clerk id `OWNER_CLERK_ID` **and** its e-mail `OWNER_EMAIL`
  must both match) can open it; for everyone else, signed in or not, it behaves like a page that doesn't exist. Every
  number, bar, funnel step and breakdown row opens the exact records behind it in a side panel (accounts and their
  e-mails, each watch's exact search, every alert, full chat conversations, feedback, the usage log, one day), with
  breadcrumbs, search, sorting, CSV download and a link per view. Safe owner actions: pause/resume a watch, mark
  feedback handled, copy an e-mail. A "Website visitors" section pulls Vercel Web Analytics into the dashboard
  (`frontend/convex/analytics.ts`, needs `VERCEL_TOKEN`). It shows accounts, active people, watches, alerts, daily charts, the sign-up → first-alert funnel,
  which features are used (Search now vs Watch it, schedules, phone vs desktop, light vs dark), would-pay answers,
  health, and every feedback message with its screenshot and what the person did just before. Usage events are our
  own (`frontend/convex/events.ts`): feature names only, never what people type, kept 90 days, deleted with "Delete my
  data". Signed-out visitors are counted by Vercel Web Analytics (cookieless).
- **Users rate their alerts:** every alert (e-mail and Alerts page) asks "Good match? 👍 / 👎". 👎 asks why (chips +
  note). Links in the e-mail work without signing in (a per-alert code, `RATING_SECRET`). The dashboard shows agreement
  per score band; `.venv/bin/python -m evals.pull_ratings` then `evals.report` adds "What users said" to
  `evals/report.md`. Ratings are kept for 12 months after their last update, and deleted with the watch or with
  "Delete my data".
- **Alert archive:** new alerts show a New pill and glow for that visit; archive one or all and restore them under Archived.
- **Watch size warning:** chat proposals and the watch editor estimate new listings per check and suggest narrowing searches that exceed the 20-listing check budget.
- **Light and dark:** follow the device; the sun/moon button (top right) overrides it on that device, and "Match device
  theme" in the account menu goes back.
- **Software factory queue:** Linear team "Marktplaats Watcher" (MW), bound by `.factory.json`. Wave 1 of the audit
  is filed as MW-1 to MW-13, the official Marktplaats API route as MW-14, the design polish as MW-15 and a flaky chat
  eval as MW-16; the build loop only picks up issues marked `agent-ready`, and issues whose next step is Daryl's carry
  `human-ready`. On 30 Sep all of Wave 1 plus MW-15 and MW-16 went through it (GPT-6 Sol builds at medium effort via
  `/opt/homebrew/bin/codex`, Claude Opus 5.5 reviews by running each change, Daryl approves each merge) and is live;
  MW-9 and MW-14 wait on Daryl (`human-ready`); MW-5 closed on 2 Oct after the UAT sign-off and a passing eval run. MW-57 (canary) and MW-58 (scorer sees "bidding from") shipped on 3 Oct. The run is written up in `docs/system-design.html` §18–19.
  On 30 Sep evening an alert audit found late-published listings being skipped: MW-17 fixed it, MW-19 flags
  watches too broad to keep up, MW-18 adds a nightly delivery audit to the owner digest, MW-20 fixed a regression
  (§20). Later that night MW-21 to MW-34 stored check scores, stopped accessory matches, sent users a catch-up
  of 33 missed matches, rebuilt the owner dashboard (filters on every list, ⌘K, an Ask box) and fixed a stale-HTML
  white page after deploys (§21). The first nightly audit, digest and users' daily checks on 1 Oct ran clean.
  Deep-dive audit of everything learned, re-scored against the course (43 met, 25 partly, 31 open):
  `docs/audit/2026-10-01-everything-we-learned.md`.
- **FDE course audit (29 Sep 2026):** `docs/audit/2026-09-29-fde-course-audit.md`: every course rule, its status
  with evidence, and a dated roadmap.
- **Positioning audit (29 Sep 2026):** `docs/marketing/positioning-audit-2026-09-29.md`: how this differs from
  Marktplaats' own saved search (verified from its help pages and a logged-in account), the USP, and every step of
  the journey before and after the copy fixes.
- **When something breaks:** `RUNBOOK.md` (kill switch, rollback, key rotation, alerts not arriving).
- **Demo:** `docs/demo/` (problem statement, 3-minute script, pre-demo checklist).

## Run it with Docker (for anyone)
One container serves the chat UI and the API on port 8000. Secrets are **not** in the image;
each user supplies their own `.env` (copy `.env.example` and fill it in). The two public UI values go in
as build args: `--build-arg NEXT_PUBLIC_CONVEX_URL=... --build-arg NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...`.

```bash
# Build (on this Mac)
docker build -t marktplaats-watcher:1.0 .                                  # Apple Silicon (arm64)
docker build --platform linux/amd64 -t marktplaats-watcher:1.0-amd64 .     # Intel / most servers

# Export to a file you can share
docker save marktplaats-watcher:1.0 | gzip > marktplaats-watcher-1.0-arm64.tar.gz

# Import and run anywhere
docker load < marktplaats-watcher-1.0-arm64.tar.gz
docker run -d --name marktplaats-watcher --env-file .env -p 127.0.0.1:8000:8000 marktplaats-watcher:1.0
# open http://localhost:8000
```
Pick the file that matches the machine: `arm64` for Apple Silicon, `amd64` for Intel Macs, Windows and
most Linux/cloud servers. The container runs as a non-root user; its health check loads the home page (`/api/health` is reserved for the owner's
uptime check).

## Limits
- Chat allows 40 questions per person per Europe/Amsterdam day, resetting at midnight. Each admitted account also has a €1 AI budget per 30-day period from admission; at the limit, its watches and chat pause until the next period. The owner account matching both `OWNER_CLERK_ID` and `OWNER_EMAIL` is exempt. Convex `CHAT_DAILY_LIMIT` and `USER_AI_BUDGET_EUR` can change the defaults. The API uses `CONVEX_SITE_URL` and matching `API_TO_CONVEX_SECRET` in Vercel and Convex to check access and record priced token usage. If Convex cannot be reached, chat refuses new questions and logs `usage_check_failed`.
- The owner dashboard shows app-measured OpenAI spend for the current UTC calendar month. Set `OPENAI_MONTHLY_CAP_USD` in Convex to the same dollar amount as the hard cap you set in OpenAI settings; the dashboard uses it for the remaining amount and sends one owner e-mail at 80%. Optionally set `OPENAI_ADMIN_API_KEY` in Convex to an OpenAI API Platform organization Admin key with Costs read access. An hourly Convex job then shows billed USD and its last update. Keep the key in Convex environment settings, never in the browser or this repository. App measurements use the shared model price table and an approximate 0.92 USD-to-EUR rate; embedding tokens are estimated from text length because the embedding client does not expose token usage in this path. Watch estimates and delivery audits do not call OpenAI.
- The chat's search reads the first results page only (about 30 listings), from the public `/q/` page,
  which robots.txt allows. A distance filter keeps only listings that have a location, which is roughly a
  third of them; many private sellers show no location there. Postcode to coordinates uses PDOK, the Dutch
  government's free address service.
- Scheduled checks read every listing placed since the last check. They use Marktplaats' date-sorted search
  (`/lrp/api/search`, the one behind the site's "Datum (nieuw-oud)" sort), with the watch's price and
  distance applied by Marktplaats. Robots.txt disallows that path; using it is the owner's decision
  (29 Sep 2026), because the `/q/` page ignores sorting and filters and showed only a fraction of the
  matches. Marktplaats sorts by day, not by time, so a check reads all of the days since its last check:
  usually one page for a watch with a price and distance, more for a broad one (at most 40 pages).
  "New" means unseen and placed after the newest listing of the last check. Seller details are never kept.
- Marktplaats' terms (Art. 7.3) forbid repeated, systematic querying. Scheduled watches do exactly that;
  the operator has accepted this risk for the public portfolio version. Watches with the same search and
  filters share one read, each user has at most 5 watches, and the shortest interval is 15 minutes.
- Data kept: e-mail address, watches, listings already seen and alerts, 30 days (purged daily).
  "Delete my data" removes all of it. Listing titles and search text are sent to OpenAI for scoring.

## Failure harness

- [Kill switches](RUNBOOK.md#1-stop-all-scheduled-checks-now-kill-switch) pause chat and scheduled checks separately; [ADR 0012](docs/adr/0012-allowance-and-kill-switches.md) records the choice.
- Chat [fails closed on allowance and admission outages](docs/adr/0012-allowance-and-kill-switches.md#amendment-2026-10-05-mw-85). Model calls have [token caps and timeouts](RUNBOOK.md#trace-a-request); the [runbook](RUNBOOK.md#3-openai-cap-reached-key-revoked-or-model-gone) covers exhausted credit and revoked keys.
- Scheduled Marktplaats reads (`fetch_search`) retry a 429, 5xx, timeout or connection error **once**, after a jittered backoff (honouring `Retry-After`, capped at 16 s) within the request's deadline, exactly as many requests as before MW-103 (operator rule: request volume per check must not go up); other 4xx and malformed responses fail at once. A lasting failure is left to the next 15-minute tick, which re-reads safely ([ADR 0014](docs/adr/0014-check-idempotency-and-resume.md)). The volume estimate never retries. Chat reads public `/q/` pages with a 15-minute cache and an hourly cap instead.
- [Failed alert e-mail is retried at the next three checks](RUNBOOK.md#5-alerts-not-arriving), at most four sends total. [ADR 0012](docs/adr/0012-allowance-and-kill-switches.md) covers the operating controls. The [nightly delivery audit](RUNBOOK.md#the-delivery-audit-found-a-miss) checks for missed deliveries.

## MCP

The [MCP server](mcp_server.py) exposes six read-only tools over streamable HTTP at `/api/mcp`: `list_my_watches`, `get_watch_activity`, `get_alert_evidence`, `search_my_alerts`, `compare_vector_stores`, and `search_marktplaats`. A client connects to `https://marktplaats-watcher.vercel.app/api/mcp` with `Authorization: Bearer <token>`. The server must have `MCP_ENABLED=1`. The bearer token may be a verified Clerk session token for an admitted user, or the owner's configured `MCP_OWNER_TOKEN` with `OWNER_CLERK_ID`; rate limits and admission checks apply. See [the access middleware](main.py) and [ADR 0011](docs/adr/0011-server-writes-agent-turns.md). The owner's Claude Desktop/Code connection demonstration is a separate operator step.

## Running the factory

The MW queue is in Linear. From the main checkout, run `scripts/factory/dispatch.sh MW-<number>` for one `agent-ready` issue. After a PASS review marks it `ready-to-merge` and Daryl adds an `Operator merge approval:` comment, run `scripts/factory-merge.sh MW-<number> <reviewed-40-character-SHA>`. The gate and evidence log are described in [AGENTS.md](AGENTS.md) and [RUNBOOK.md](RUNBOOK.md).
