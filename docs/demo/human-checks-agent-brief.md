# Pre-demo human checks: agent brief

**For:** a computer-use agent working **together with Daryl**, on Daryl's Mac.
**Goal:** close the open ☐ items 2, 9, 10, 11 and 12 in `docs/demo/pre-demo-checklist.md` before demo day (Sat 3 Oct 2026).
**Repo:** `/Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher`. **Live app:** https://marktplaats-watcher.vercel.app

## 0. The rule that matters most
These checks are named "human" on purpose. The course asks for evidence that **a person** checked the AI and **a
person** rehearsed. So:
- **You prepare, time, check and record. Daryl judges, signs in and presents.**
- **Never write "Daryl agreed", "human-checked" or ✅ for something Daryl didn't do or confirm in this session.** Your
  own opinions go in files and columns labelled *AI second opinion*.
- **Ask Daryl in chat before every action that changes production** (items 3 and 4), and wait for a clear yes.
- **Never type passwords, sign-in codes or API keys.** Daryl signs in himself. Don't open `.env` files.
- **If something breaks, stop.** Put production back (RUNBOOK.md §2 or §7), then tell Daryl what happened.

## 1. Judge spot-check (checklist item 9): Daryl decides, you prepare
**File:** `evals/data/spotcheck.md`. It has 10 listings that the AI judge (gpt-5.5) labelled. `evals/report.py` reads
**the last column ("Agree?") as Daryl's answer.**
1. For each row, open the listing link and read the title, price and description.
   - If the listing is gone, say so: listings expire.
2. Write your view in a **new file**, `evals/data/spotcheck-ai-review.md`, with columns:
   #, judge label, your view (agree / disagree / unsure), one-line reason, and whether the listing is still online.
   - **Don't touch `spotcheck.md`.**
3. Walk Daryl through the rows, **disagreements first**. For each, show the listing and both reasons, then ask
   "Agree with the judge: yes or no?"
4. Write **only Daryl's answers** into the "Agree?" column of `spotcheck.md`, exactly "yes" or "no".
5. Run `.venv/bin/python -m evals.report` and confirm that `evals/report.md` line 3 now says "N/10 agreed".
6. If Daryl disagrees with the judge on any row, list those rows in your final report. They affect the scorer's
   precision and recall numbers.

## 2. Loads on a network Daryl doesn't control (item 2)
1. **Supporting evidence from you:** from your own environment (if it isn't Daryl's home network), load the site and
   `/api/health`. Record the HTTP status, load time and network.
2. **The real check is Daryl's.** On their own phone, with **Wi-Fi off and mobile data on**, Daryl:
   - opens the site
   - signs in
   - opens one watch
   - sends one chat message

   Ask Daryl to report: loaded (yes/no), roughly how many seconds, and anything odd. Record exactly what Daryl says.

## 3. Rollback tested once (item 10): changes production, so ask first
**Safe target.** Roll back only to a deployment whose Python API is the same as the current one. Otherwise, during
the mixed versions, a watch's baseline can be recorded differently (audit round 2, R4). Check with:
`git diff <previous-commit> <current-commit> -- agent.py main.py`. An empty diff means safe. The previous commit
`cac3821` has the same API as the current one. If the diff isn't empty, ask Daryl to pause checks first
(`npx convex env set --prod CHECKS_PAUSED 1`) and to resume them afterwards (`npx convex env remove --prod CHECKS_PAUSED`).
Don't roll back further than the previous deployment.
1. Ask Daryl: "OK to roll production back to the previous deployment for about 2 minutes, then forward again?" Wait
   for yes.
2. Go to Vercel → project `marktplaats-watcher` → Deployments. Find the **previous Production** deployment
   (the one before the current, see "Safe target"), then choose "…" → **Promote to Production** (or **Instant Rollback**). Note the time.
3. Verify each of these:
   - https://marktplaats-watcher.vercel.app loads
   - `/api/health` returns 200
   - a chat POST without login returns 401:
     `curl -s -o /dev/null -w "%{http_code}" -X POST -H 'content-type: application/json' -d '{"message":"hi"}' https://marktplaats-watcher.vercel.app/api/chat`
4. Promote the **current** (latest) deployment back to Production. Verify the same three
   checks. Note the time.
5. **Record:** both times, the minutes taken, anything confusing in RUNBOOK.md §2, and whether Vercel auto-promotes
   new pushes after a rollback.
   - If Vercel stopped auto-assigning production after an Instant Rollback, say so clearly: the next `git push` might
     not go live.

## 4. CSP: clean sign-in, then enforce (item 11): changes production, so ask first
**Background.** `vercel.json` sends the Content-Security-Policy as `Content-Security-Policy-Report-Only`. Violations are
logged by the API as JSON lines with `"event": "csp_violation"` in the Vercel logs. Nothing is blocked yet.
1. **Daryl signs in himself** in a **private/incognito window**:
   - sign in with Clerk
   - open a chat and send one message
   - open a watch
   - sign out

   You don't type anything into the sign-in form.
   During the session, also open a chat search whose results show photos from both image hosts:
   `admarkt-cdn.marktplaats.com` and `images.marktplaats.com`. Both are now allowed; the second one was missing until
   audit round 2 (R5).
2. Open Vercel → project → **Logs**. Filter on `csp_violation` for the minutes of that session, and record what you
   find.
   - **Violations found:** stop. List each `violated`/`blocked` pair. Don't enforce; Daryl or the build session
     decides how to change the policy.
   - **None found:** go to step 3.
3. **Ask Daryl:** "No CSP violations during your sign-in. OK to enforce the policy (one-line change, deploys to
   production)?" Wait for yes.
4. In `vercel.json`, change only the header **key** `Content-Security-Policy-Report-Only` to
   `Content-Security-Policy`. Keep the value unchanged.
5. **Run the checks:**
   - `cd frontend && npm test && npm run build`
   - `cd .. && .venv/bin/python -m pytest -q`
6. **Commit and deploy:**
   1. Commit on branch `wave1-demo-ready` with the message `Enforce the Content-Security-Policy after a clean sign-in check`.
   2. Fast-forward `main` to it and push both branches. Vercel deploys `main` to production.
   3. Wait until the production deployment is Ready.
7. `curl -sI https://marktplaats-watcher.vercel.app | grep -i content-security` should show the enforced header.
8. **Daryl signs in once more** in a new private window (chat, watch, sign out).
   - **If anything breaks:** revert the one-line change, commit, push `main` and tell Daryl (RUNBOOK.md §7).

## 5. Rehearsed twice (item 12): Daryl presents, you time and check
**Script:** `docs/demo/demo-script.md`. Version A is for engineers and Version B for business people; both run 3:00,
with the timestamps written in.
1. Before starting, open what the script needs: the live app (signed in), Gmail with an alert e-mail, and
   `evals/report.md`.
2. For each run, start a stopwatch when Daryl starts. Note the actual time at every script timestamp and the total.
3. **Check what Daryl says against the evidence.**
   - Numbers must match `evals/report.md`: 13/13 "great" e-mails agreed with the judge, 68% recall, "good" 90%
     recall at 85% precision, 20/20 chat, about €0.35/month per hourly watch.
   - Flag any stronger claim: "every e-mail is right", "before users notice", "nobody else does this".
4. After each run, give **3 notes at most**: what ran long, what was unclear, and one thing to cut.
5. Do one run of **Version A** and one of **Version B**, or two of whichever Daryl chooses. Two complete runs are
   required.

## 6. Record the results
- **In `docs/demo/pre-demo-checklist.md`:** change ☐ to ✅ only where the check was done. Evidence format:
  "Daryl, <date> <time>: <what happened>". Keep ☐ with a note for anything not done or failed.
- **New file `docs/demo/human-checks-<date>.md`:** one short section per item, with times, results, and your AI
  second opinion kept separate from Daryl's answers.
- **Don't commit these docs without Daryl's OK.** If Daryl says yes, commit them on `wave1-demo-ready` with the message
  `Pre-demo human checks`, fast-forward `main` and push.
- **Your final message to Daryl lists:**
  - each item as done, not done or failed
  - any production changes made, with times, and whether production is back on the latest version
  - rows where Daryl disagreed with the judge
  - anything Daryl still has to do themselves
