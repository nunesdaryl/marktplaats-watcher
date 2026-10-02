# Runbook: Marktplaats Watcher

What to do when something breaks, written so someone other than the author can follow it. Commands run from the
repo root unless they start with `cd frontend`.

**Where things run:**
- **Vercel** (project `daryl-nunes-projects/marktplaats-watcher`) serves the Next.js UI and the Python API, at
  https://marktplaats-watcher.vercel.app. The no-hyphen address https://marktplaatswatcher.vercel.app is a project
  domain that 308-redirects there, keeping the path (Vercel → Settings → Domains).
- **Convex** production (`chatty-sardine-719`) holds the data and runs the schedules.
- **Clerk** handles login.
- **AgentMail** (`marktplaats-watcher@agentmail.to`) sends e-mail.
- **OpenAI** project "Marktplaats Watcher" runs the model, with a $10/month hard cap.

**How you hear about problems:**

| Signal | Where | Means |
|---|---|---|
| Health digest e-mail "N problem(s) need a look" | `OWNER_EMAIL` inbox, daily 05:00 UTC | Scheduler stuck, watches failing, e-mails failing, or checks paused |
| "Marktplaats Watcher: all good this week" | Mondays | Heartbeat: silence on a Monday means the digest itself is broken |
| GitHub "uptime" workflow failed | GitHub e-mail | Site down, API down, or chat accepting requests without login |
| GitHub "ci" failed | GitHub e-mail | Tests, build, dependency audit or secret scan failed |
| Owner dashboard | https://marktplaats-watcher.vercel.app/admin/ (signed in as the owner) | Usage, funnel, feedback with screenshots, and the same health summary as the digest |
| Feedback e-mail "Feedback from …" | `OWNER_EMAIL` inbox | Someone used the feedback strip; the screenshot and context are on the dashboard |
| Logs | Vercel → Logs; Convex dashboard → Logs | JSON lines: `check`, `chat_turn`, `csp_violation` (Vercel); `check_run`, `health_digest`, `checks_paused` (Convex) |

---

## Weekly listening loop

The [feedback loop audit](docs/audit/2026-10-02-feedback-loop.md) maps the current path; the full Monday routine arrives with MW-51.

## Trace a request

Find the request id in the API response header `X-Request-Id`, in the owner dashboard's latest errors,
or in the daily health digest. Search that id in Vercel Logs (the dashboard filter or `vercel logs`)
to see the Python JSON lines for the request. For a scheduled check, the Convex `runs` row stores
the run id; each Python check request adds `.0`, `.1`, and so on to that id. Search the run id in
Vercel Logs to see every group. The Convex `errors` table stores the full id for failed groups
and chat turns; filter it by `requestId`. Convex Logs also show the `check_run` line with the run id.

---

## 1. Stop all scheduled checks now (kill switch)
Use it for runaway cost, Marktplaats complaints, bad alerts going out, or anything where "stop first, understand later" is right.
```bash
cd frontend && npx convex env set --prod CHECKS_PAUSED 1      # takes effect at the next 15-minute tick
cd frontend && npx convex env remove --prod CHECKS_PAUSED     # resume
```
Chat keeps working. The next digest says "Checks are paused".

To pause chat immediately, set `CHAT_PAUSED=1` in Vercel Production environment variables and redeploy the API. Chat then returns 503 with the maintenance message; scheduled watches keep running. Remove the variable and redeploy to resume. `CHAT_DAILY_LIMIT` in Convex defaults to 40; set it to 2 to verify that a third message is refused, then remove it. The allowance needs `CONVEX_SITE_URL` and `API_TO_CONVEX_SECRET` in Vercel and the same `API_TO_CONVEX_SECRET` in Convex. If the usage check is unavailable, chat stays open and Vercel logs `usage_check_failed`.

## 2. Roll back a bad release
1. **UI or API:** Vercel dashboard → Deployments → the last good one → **Promote to Production**. This takes seconds.
   Or revert the commit on `main` and push. After any deploy, check that it really went to Production (not only
   Preview); DEPLOY-VERCEL.md §3 has the check and the fix (`npx vercel redeploy <url> --target production`).
   **CLI (rehearsed 30 Sep 2026, 6 s each way):** `npx vercel ls --prod` to find the last good deployment, then
   `npx vercel rollback <its url> --yes`; confirm with `npx vercel inspect marktplaats-watcher.vercel.app` (the `url`
   line). **After a rollback Vercel stops assigning new production deploys to the domain** until you promote one:
   when the fix is out, run `npx vercel promote <new deployment url> --yes`, or pushes to `main` won't go live.
   Roll back only to a deployment with the same API as the live Convex functions (MW-11 made the browser's
   `chats.append` user-only: a front end from before MW-11 can't save the agent's answers).
2. **Convex functions or schema:**
   ```bash
   git checkout <last-good-commit> -- frontend/convex
   cd frontend && npx convex deploy -y
   ```
   Schema changes so far only *add* optional fields and tables, so an older deploy accepts newer data.
3. Check: run the GitHub "uptime" workflow (Actions → uptime → Run workflow). It calls `/api/health` with the owner's
   key, checks that it's hidden (404) without it, and that the chat refuses requests without a login (401). Then sign
   in and send one message. Rolling back to a deployment from before 29 Sep (commit f969278) makes `/api/health` public
   again and the uptime check fails its "hidden" step: promote a newer deployment as soon as possible.

HTML is served no-store so a deploy never leaves a browser on stale HTML.
After a caching incident, bump both the cache reset fetch's `?v=` and the `mw-cache-reset` flag value for a new one-time browser cache purge.

## 3. OpenAI: cap reached, key revoked, or model gone
- **Symptoms:**
  - The chat says "The chat can't reach its AI right now."
  - Watches show "The AI that scores listings didn't answer…".
  - Nothing unscored is ever e-mailed, and the listings are scored on the retry.
- **Cap reached:**
  - Check platform.openai.com → Settings → Project "Marktplaats Watcher" → Limits.
  - Either wait for the monthly reset or raise the limit deliberately.
  - Find the cause: a busy 15-minute watch can use most of the cap (evals/report.md §4).
- **Rotate the key:**
  - Create a new restricted key in the same project (Model capabilities: Request, List models: Read).
  - Put it in Vercel as `OPENAI_API_KEY` (Production + Preview) with `printf '%s' "$KEY" | npx vercel env add OPENAI_API_KEY production`.
  - Redeploy, then revoke the old key.
- **Model retired:** set `OPENAI_MODEL` in Vercel, add the model to the project allow-list, redeploy, and **rerun the evals** (`evals/report.md` → How to rerun).

## 4. Rotate other secrets
| Secret | Lives in | Steps |
|---|---|---|
| `CRON_SECRET` | Vercel **and** Convex (must match) | `openssl rand -hex 32`, set it in both (`npx convex env set --prod CRON_SECRET …`, `npx vercel env add CRON_SECRET production`), then redeploy Vercel. The checks fail with 401 until both match. |
| `AGENTMAIL_API_KEY` | Convex | Create a key scoped to the inbox (send and read), `npx convex env set --prod AGENTMAIL_API_KEY …`, delete the old key in AgentMail. |
| Clerk | Vercel (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_ISSUER`) and Convex (`CLERK_JWT_ISSUER_DOMAIN`) | Only on moving to a new Clerk instance. Keep the session-token claim `"email": "{{user.primary_email_address}}"` next to the managed `aud: convex`. |
Never paste keys into chats, issues or the repo; `.env` stays local (mode 600).

## 5. Alerts not arriving
A failed alert e-mail is retried automatically at the next 3 checks (15 minutes apart). After 4 failed tries it stays
"failed" and the digest reports it. A check that dies halfway is picked up again within 30 minutes. Every 15-minute run
takes the watches due now or within the next 2 minutes, so "every 15 minutes" really means every run; if the dashboard's
health line shows runs that alternately check 0 watches, that leeway is gone (`GRACE_MS` in `frontend/convex/checker.ts`).
1. **App → the watch:** check "last checked" and any error line on the watch page.
2. **Digest problems:** do they mention failed e-mails?
3. **AgentMail console → Sent:** was the e-mail sent?
   - If it's not there, the send failed. Check the Convex logs for `alert e-mail failed` and the AgentMail key and inbox id.
   - If it's there, the problem is deliverability. Ask the user to check spam and add `marktplaats-watcher@agentmail.to` to contacts.
4. **Bounces:** AgentMail shows them per message. A permanent bounce means the Clerk account's e-mail is wrong; the user
   fixes it under their account.

### A watch can't keep up
The watch page warns when 20 or more fresh listings are waiting for a later check, or when a check reaches the
40-page read limit. The owner dashboard lists affected watches; the health digest flags a watch at 100 waiting
or when the read limit is reached. Tell the user to narrow the search with a word or a max price. A smaller
search gives each new listing a better chance to be read and scored in the next check.

## 6. Marktplaats changed its page (0 listings everywhere)
- **Symptoms:** watches show "Marktplaats showed an unexpected page. We'll try again soon.", the chat says it couldn't
  read the page, and the health digest lists failing watches. (If the listings data moved but is still readable, you'd
  instead see "Checked 0 listings" everywhere.)
- **Cause:** the parser reads the `__NEXT_DATA__` JSON and looks for a `listings` array (`agent.parse_listings`). A page
  redesign can move it.
- **Steps:**
  1. Pause checks (§1), so first looks don't record empty pages.
  2. Save a fresh page to `tests/search_page.html` (remove seller details).
  3. Fix `find_listings`/`parse_listings`.
  4. Run `pytest` and resume.

## The delivery audit found a miss

The 04:30 UTC audit replays the previous day's search for each active, seeded watch. Its rows are in Convex
`audits`; the owner dashboard shows the latest misses, and the 05:00 UTC digest includes the audit request id.
`handled` means the listing was seen but no alert was recorded. `never_read` means it was absent from seen listings
although a check should have covered its listing day. `read` counts eligible listings and `scored` counts the
candidates sent to the ranker (at most 40 per watch). A failed audit says why and is not evidence of a miss.

Open the listing and the watch, then use the request id to inspect the audit in Vercel Logs and the corresponding
check in Convex `runs`, `seenListings`, and `alerts`. Re-run the same search and scoring replay before treating a
borderline score as a delivery bug: model scores can vary, and the audit requires one point above the notification
threshold. If the replay confirms the gap, record the watch, listing id, timestamps and request ids, fix the cause,
and decide with the owner whether to contact the user. The audit never sends a missed alert itself.

## 7. Content-Security-Policy
- The CSP is **report-only**: violations are logged as `csp_violation` in the Vercel logs, and nothing is blocked.
- **To enforce it:** after a sign-in in a private window shows no violations, rename the header key in `vercel.json`
  from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` and deploy.
- **If sign-in breaks after enforcing:** rename it back (or roll back, §2).

## 8. A user asks to be deleted
In the app: Privacy (shield icon) → **Delete my data** removes their watches, chats, folders, seen listings, alerts,
feedback (with its screenshots), usage events and the user row. Usage events are also forgotten after 90 days (daily
cron "forget usage events older than 90 days"). Their Clerk account is separate: they delete it under their account menu, or the owner does it in the
Clerk dashboard → Users.

## 9. The owner can't open /admin (it goes to the start page)
`/admin` exists only for the owner: the signed-in account must match **both** `OWNER_CLERK_ID` (the Clerk user id) and
`OWNER_EMAIL` in Convex (`cd frontend && npx convex env get OWNER_CLERK_ID --prod`, same for `OWNER_EMAIL`). If either is
missing or different, nobody gets in, and everyone else, signed in or not, sees no dashboard, no link and no data. The
dashboard's code is only downloaded after the server confirms the owner.

`/api/health` is owner-only too: it answers 404 unless the request carries `X-Health-Key` equal to `HEALTH_KEY`
(Vercel env var + GitHub repository secret used by the uptime workflow). To rotate it, generate a new key and pipe it
into both stores (DEPLOY-VERCEL.md §1), then redeploy. Visitor and
page-view counts (including signed-out visitors) are in Vercel → project → Analytics; Web Analytics must be enabled
there once.

## 10. Using the dashboard to find a problem
Use the refresh icon at the top right to recalculate the dashboard; the time under the icon shows when the figures were computed in Amsterdam time.
Every number on `/admin` opens its records: click an account to see its watches (the exact search), chats (the full
conversation), alerts, feedback and activity; click a watch to see its alerts and pause/resume it (two taps, as in the
app); click a chart bar to see that day. The address holds the view, so a link to a record can be kept in a note.

## 11a. Alert ratings ("Good match?")
Ratings arrive from the e-mail links and the Alerts page; see them on `/admin` → "Are the scores right?". If e-mails
stop showing rating links, `RATING_SECRET` is missing in Convex (production). To rotate it, generate a new value and
pipe it in (`K=$(python3 -c "import secrets;print(secrets.token_urlsafe(32))"); npx convex env set RATING_SECRET "$K" --prod`);
links in older e-mails then say "This link isn't valid", and those people can still rate in the app. For the
evaluation: `.venv/bin/python -m evals.pull_ratings && .venv/bin/python -m evals.report`.

## 11. Vercel Web Analytics in the dashboard (token)
The "Website visitors" section reads Vercel Web Analytics with `VERCEL_TOKEN` in Convex (prod and dev). Vercel tokens
can't be read-only, so it's kept only in Convex's server settings, used by one owner-only function, and expires after
90 days. When the dashboard says "token expired" (or to connect it the first time):
1. vercel.com → Account Settings → Tokens → **Create**: name `marktplaats-watcher-dashboard`, scope: Daryl Nunes'
   projects → **only the `marktplaats-watcher` project** (least access), expiration **90 days**. Copy it once. (The
   first one was created on 29 Sep 2026 and expires on 28 Dec 2026.)
2. Convex dashboard → project `marktplaats-watcher` → **Production** → Settings → Environment Variables →
   `VERCEL_TOKEN` → paste → Save. (Same on the dev deployment if you use it locally.) Don't paste it into a chat or a
   terminal command that's logged.
3. Reload `/admin`; the section fills in. Delete the old token in Vercel.
(The Vercel CLI can't create tokens for you: Vercel answers "Cannot create tokens for this app".)

## 12. Marktplaats asks us to stop
Pause checks (§1) the same day. Chat search can be switched off by setting `MAX_FETCHES_PER_HOUR=0` in Vercel.
Reply, and record the decision in `docs/system-design.html` §11/§13. The risk (ToS art. 7.3) was accepted knowingly for
the portfolio version.

## Send a catch-up (missed matches)
1. Dry run: `cd frontend && npx convex run --prod catchup:run '{"dryRun": true}'` returns a `planId` and the exact list
   per user and watch (real misses, still online, not reserved, never already alerted).
2. The operator approves that exact list. To send a hand-picked list instead, create a plan with
   `catchup:planFromItems` (items: watchId, userId, listingId, title, url, score, priceEur).
3. Send: `npx convex run --prod catchup:send '{"planId": "<id>"}'`. It sends only the plan's items, skips any listing
   already alerted, and a plan can't be sent twice.
4. Check: the Catch-ups list on /admin (filter by user) and each alert's e-mail status.

## Running the factory

Use `scripts/factory/dispatch.sh MW-<number>` from the repo for a single `agent-ready` issue. Review the branch and record the verdict in Linear. From a clean main checkout, run `scripts/factory-merge.sh MW-<number> <reviewed-40-character-SHA>` only after the issue has `ready-to-merge`. The gate runs tests, builds, deploy checks and smoke checks, then records the merge in `docs/factory/merges.md`. For UI changes, the reviewer also records a preview walk and screenshots. See [AGENTS.md](AGENTS.md) for the environment-file and production-data limits.
