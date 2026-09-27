# Runbook: Marktplaats Watcher

What to do when something breaks, written so someone other than the author can follow it. Commands run from the
repo root unless they start with `cd frontend`.

**Where things run:**
- **Vercel** (project `daryl-nunes-projects/marktplaats-watcher`) serves the Next.js UI and the Python API, at
  https://marktplaats-watcher.vercel.app.
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
| Logs | Vercel → Logs; Convex dashboard → Logs | JSON lines: `check`, `chat_turn`, `csp_violation` (Vercel); `check_run`, `health_digest`, `checks_paused` (Convex) |

---

## 1. Stop all scheduled checks now (kill switch)
Use it for runaway cost, Marktplaats complaints, bad alerts going out, or anything where "stop first, understand later" is right.
```bash
cd frontend && npx convex env set --prod CHECKS_PAUSED 1      # takes effect at the next 15-minute tick
cd frontend && npx convex env remove --prod CHECKS_PAUSED     # resume
```
Chat keeps working. The next digest says "Checks are paused".

## 2. Roll back a bad release
1. **UI or API:** Vercel dashboard → Deployments → the last good one → **Promote to Production**. This takes seconds.
   Or revert the commit on `main` and push.
2. **Convex functions or schema:**
   ```bash
   git checkout <last-good-commit> -- frontend/convex
   cd frontend && npx convex deploy -y
   ```
   Schema changes so far only *add* optional fields and tables, so an older deploy accepts newer data.
3. Check: `/api/health` returns 200, the chat without a login returns 401, and sign in and send one message.

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
"failed" and the digest reports it. A check that dies halfway is picked up again within 30 minutes.
1. **App → the watch:** check "last checked" and any error line on the watch page.
2. **Digest problems:** do they mention failed e-mails?
3. **AgentMail console → Sent:** was the e-mail sent?
   - If it's not there, the send failed. Check the Convex logs for `alert e-mail failed` and the AgentMail key and inbox id.
   - If it's there, the problem is deliverability. Ask the user to check spam and add `marktplaats-watcher@agentmail.to` to contacts.
4. **Bounces:** AgentMail shows them per message. A permanent bounce means the Clerk account's e-mail is wrong; the user
   fixes it under their account.

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

## 7. Content-Security-Policy
- The CSP is **report-only**: violations are logged as `csp_violation` in the Vercel logs, and nothing is blocked.
- **To enforce it:** after a sign-in in a private window shows no violations, rename the header key in `vercel.json`
  from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` and deploy.
- **If sign-in breaks after enforcing:** rename it back (or roll back, §2).

## 8. A user asks to be deleted
In the app: Privacy (shield icon) → **Delete my data** removes their watches, chats, folders, seen listings, alerts and
the user row. Their Clerk account is separate: they delete it under their account menu, or the owner does it in the
Clerk dashboard → Users.

## 9. Marktplaats asks us to stop
Pause checks (§1) the same day. Chat search can be switched off by setting `MAX_FETCHES_PER_HOUR=0` in Vercel.
Reply, and record the decision in `docs/system-design.html` §11/§13. The risk (ToS art. 7.3) was accepted knowingly for
the portfolio version.
