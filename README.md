# Marktplaats Watcher (MVP)

Tell it what you want on Marktplaats, pick how often to check, and get an e-mail when a good one shows up.

**Live:** https://marktplaats-watcher.vercel.app (https://marktplaatswatcher.vercel.app, without the hyphen, redirects there).

- **Sign in** with Clerk (your e-mail address is where alerts go).
- **Chat** to search Marktplaats, or ask it to watch something: "tell me when a Gazelle bike shows up
  near 3511AB, every morning at 8". The chat only *proposes* a watch; you press **Save watch**.
- **Pick the schedule in plain English**: every 15 or 30 minutes, every 1, 3, 6 or 12 hours, every day at
  up to four times, or on chosen weekdays at a time (Amsterdam time).
- **Alerts**: each new listing is scored 0 to 10 by the model with a one-line reason; you choose
  "great matches only", "good matches" or "every new listing". The first check of a new watch only notes
  what is already listed, so you're only told about new ones.

```
Browser (Next.js + Clerk + Convex client)
 ├─ chat ────────► FastAPI /api/chat (Clerk token checked) ─► OpenAI + tools
 │                  search_marktplaats · propose_watch · propose_watch_change (proposals only)
 └─ Save watch ──► Convex (users, watches, seen listings, alerts)
Convex cron, every 15 min ─► due watches, one request per distinct item
   ─► FastAPI /api/internal/check (CRON_SECRET) ─► fetch + filter + drop seen + model scores new
   ─► Convex stores them ─► AgentMail e-mails the good ones
```

| file | what it is |
|---|---|
| `agent.py` | The search tool, the watch-proposal tools, the chat loop, and the scoring used by scheduled checks. |
| `main.py` | FastAPI: `POST /api/chat` (login required), `POST /api/internal/check` (Convex only), `GET /api/health` (owner's uptime check only: needs `HEALTH_KEY`, 404 for everyone else). |
| `frontend/convex/` | Database schema, watches, the scheduled checker, e-mail, crons, and `schedule.ts` (next-check maths and plain-English wording, shared with the UI). |
| `frontend/app/`, `frontend/src/` | Next.js (App Router, static export): landing page; desktop sidebar + phone tab bar; streaming chat with photo cards and saved history; watches, alerts, first-run setup; the feedback strip, the theme toggle and the owner dashboard (`/admin`). |
| `test_agent.py`, `frontend/convex/*.test.ts` | Offline tests (no model, no Marktplaats, no e-mail). |
| `.env.example`, `frontend/.env.example` | Every setting, with where to find it. **Never commit real values.** |

## Run it locally
You need an OpenAI key, a Clerk application, a Convex account and an AgentMail inbox + API key
(see [DEPLOY-VERCEL.md](DEPLOY-VERCEL.md) for where each value comes from).
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
The look follows the **Sieve** design system (`docs/design/sieve/`, made with Claude Design): warm graphite, one teal
accent, lilac highlights for the fill-in sentence, Geist and Geist Mono (self-hosted). The logo is defined once in
`frontend/src/brand/logo.js`. Change `LOGO` there, then run `cd frontend && npm run brand` to regenerate the favicon,
app icons, OG image and `docs/design/logo-h-to-i.gif`. Options and decisions: `docs/design/logo-review.md`.

## Evaluation, cost and operations
- **Evaluation:** `evals/report.md`. The chat golden set passes 20/20. On 49 real listings judged by a stronger model, all 13
  "great match" e-mails agreed with the judge (100% precision, 68% recall) and "good matches" catches 90% of real
  matches. A human check of 10 judge labels agreed with 7; on the other 3 the judge was too strict (it called real
  matches non-matches). Rerun with `.venv/bin/python -m evals.run_scorer`,
  `evals.run_chat`, `evals.report`, `evals.cost`.
- **Cost:** an hourly watch is about €0.35/month; a chat question about €0.002; hard $10/month cap (details in `evals/report.md` §4).
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
- **Light and dark:** follow the device; the sun/moon button (top right) overrides it on that device, and "Match device
  theme" in the account menu goes back.
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
- The tool reads the first results page only (about 30 listings). A distance filter keeps only listings
  that have a location, which is roughly a third of them; many private sellers show no location there.
  Postcode to coordinates uses PDOK, the Dutch government's free address service.
- It fetches only the public `/q/` search page, which robots.txt allows. It never uses `/lrp/api/`.
  One page is fetched per search, and seller details are never kept.
- Marktplaats' terms (Art. 7.3) forbid repeated, systematic querying. Scheduled watches do exactly that;
  the operator has accepted this risk for the public portfolio version. Watches for the same item share
  one request, each user has at most 5 watches, and the shortest interval is 15 minutes.
- Data kept: e-mail address, watches, listings already seen and alerts, 30 days (purged daily).
  "Delete my data" removes all of it. Listing titles and search text are sent to OpenAI for scoring.
