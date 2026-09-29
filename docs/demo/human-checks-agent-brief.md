# Pre-demo human checks: agent brief (updated 28 Sep 2026)

**For:** a computer-use agent working **together with Daryl**, on Daryl's Mac.
**Goal:** close the open human items in `docs/demo/pre-demo-checklist.md` before demo day (Sat 3 Oct 2026):
checklist items 2, 9, 10, 11 and 12, plus three new visual checks after the redesign (sections 6–8).
**Repo:** `/Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher`. **Live app:** https://marktplaats-watcher.vercel.app

**What changed since the last session:**
- The app now uses the **Sieve** design: warm graphite, a teal accent, lilac highlights, and the Geist font served by
  the site itself.
- The logo is a **robot with binoculars**, animated.
- The previous session already wrote the AI second opinion on the judge labels (`evals/data/spotcheck-ai-review.md`)
  and a progress log (`docs/demo/human-checks-2026-09-27.md`). All human answers are still open.
- **Continue there. Don't redo the AI review.**

## 0. The rule that matters most
These checks are named "human" on purpose. The course asks for evidence that **a person** checked the AI and **a
person** rehearsed. So:
- **You prepare, time, check and record. Daryl judges, signs in and presents.**
- **Never write "Daryl agreed", "human-checked" or ✅ for something Daryl didn't do or confirm in this session.** Your
  own opinions go in files and columns labelled *AI second opinion*.
- **Ask Daryl in chat before every action that changes production** (sections 3 and 4), and wait for a clear yes.
- **Never type passwords, sign-in codes or API keys.** Daryl signs in themselves. Don't open `.env` files.
- **Don't change system settings** (for example light/dark mode): ask Daryl to do it.
- **If something breaks, stop.** Put production back (RUNBOOK.md §2 or §7), then tell Daryl what happened.

## 1. Judge spot-check (checklist item 9): Daryl decides, you guide
**File:** `evals/data/spotcheck.md`. It has 10 listings that the AI judge (gpt-5.5) labelled. `evals/report.py` reads
**the last column ("Agree?") as Daryl's answer.** The report says "pending (n/10 answered)" until all 10 are filled in.
1. Open `evals/data/spotcheck-ai-review.md`, your prepared second opinion. The suggested order is 4, 3, 9, then 1, 2,
   5, 6, 7, 8, 10.
2. For each row: show Daryl the listing link (if it's gone, say so), the judge's label and reason, and your second
   opinion. Then ask **"Agree with the judge: yes or no?"**
   - Row 3 is a policy question: does "under €100" include €100? The app treats a maximum as inclusive.
3. Write **only Daryl's answers** into the "Agree?" column of `spotcheck.md`, exactly `yes` or `no`.
4. Run `.venv/bin/python -m evals.report`. Then confirm that line 3 of `evals/report.md` says "N/10 agreed" and that
   section "## 4. Running cost per watch" is still there. The script keeps that section.
5. List the rows where Daryl disagreed. The scorer's precision and recall are measured against the judge's labels, so
   say that the headline numbers would change.

## 2. Loads on a network Daryl doesn't control (item 2)
1. **Supporting evidence from you:** load the site and `/api/health` from your environment, if it isn't Daryl's home
   network. Record the HTTP status and the load time.
2. **The real check is Daryl's.** On their own phone, with **Wi-Fi off and mobile data on**, Daryl:
   - opens the site
   - signs in
   - opens one watch
   - sends one chat message

   Ask Daryl to report whether it loaded, roughly how many seconds it took, anything odd, and whether the new logo and
   design showed. Record exactly what Daryl says.

## 3. Rollback tested once (item 10): changes production, so ask first
**Safe target.** Roll back only to the **previous** Production deployment, and only if its Python API is the same as
the current one:
1. In Vercel → Deployments, note the commit hashes of the previous and the current Production deployment.
2. Run `git diff <previous> <current> -- agent.py main.py`. An empty diff means safe; every commit since `cac3821` has
   left them unchanged.
3. If the diff is **not** empty, ask Daryl to pause checks first (`cd frontend && npx convex env set --prod
   CHECKS_PAUSED 1`) and resume them afterwards (`npx convex env remove --prod CHECKS_PAUSED`).

Expect the look to change for those 2 minutes: the previous deployment may still show the older logo or design.
1. Ask Daryl: "OK to roll production back to the previous deployment for about 2 minutes, then forward again?" Wait
   for yes.
2. Vercel → project `marktplaats-watcher` → Deployments → the previous Production deployment → "…" → **Promote to
   Production** (or **Instant Rollback**). Note the time.
3. Verify:
   - the site loads
   - `/api/health` returns **404** without a key (owner-only since 29 Sep, commit f969278). If the rolled-back
     deployment is older than that, it answers 200 instead: expected for that old version, and the GitHub uptime
     workflow will fail its "Health stays hidden" step until the latest deployment is promoted back (step 4)
   - a chat request without login returns 401:
     `curl -s -o /dev/null -w "%{http_code}" -X POST -H 'content-type: application/json' -d '{"message":"hi"}' https://marktplaats-watcher.vercel.app/api/chat`
4. Promote the **latest** deployment back to Production. Verify the same three checks (health 404 without a key), and
   that the robot logo is back.
   Note the time.
5. **Record:** both times, the minutes taken, anything confusing in RUNBOOK.md §2, and whether Vercel still
   auto-promotes new pushes after a rollback.
   - If it doesn't, say so clearly: the next `git push` might not go live until someone promotes it.

## 4. CSP: clean sign-in, then enforce (item 11): changes production, so ask first
**Background.** `vercel.json` sends the Content-Security-Policy as `Content-Security-Policy-Report-Only`. Violations are
logged as JSON lines with `"event": "csp_violation"` in the Vercel logs. Nothing is blocked yet.

Since the redesign, the page also loads:
- Geist fonts from `/fonts/` (same site, allowed by `font-src 'self'`)
- the themed Clerk sign-in
- listing photos from `admarkt-cdn.marktplaats.com` and `images.marktplaats.com`

1. **Daryl signs in themselves** in a **private/incognito window**:
   - sign in with Clerk (check that the sign-in window shows the teal/graphite theme)
   - open a chat and run one search that shows listing photos
   - open a watch
   - sign out

   You don't type anything into the sign-in form.
2. Vercel → project → **Logs**. Filter on `csp_violation` for the minutes of that session, and record what you find.
   - **Violations found:** stop. List each `violated`/`blocked` pair. Don't enforce; Daryl or the build session
     decides how to change the policy.
   - **None found:** go to step 3.
3. Ask Daryl: "No CSP violations during your sign-in. OK to enforce the policy (one-line change, deploys to
   production)?" Wait for yes.
4. In `vercel.json`, change only the header **key** `Content-Security-Policy-Report-Only` to
   `Content-Security-Policy`. Keep the value unchanged.
5. **Run the checks:** `cd frontend && npm test && npm run build`, then `cd .. && .venv/bin/python -m pytest -q`.
6. **Commit and deploy:**
   1. Commit on `wave1-demo-ready` with the message `Enforce the Content-Security-Policy after a clean sign-in check`.
   2. Fast-forward `main` to it and push both branches.
   3. Wait until the production deployment is Ready.
7. `curl -sI https://marktplaats-watcher.vercel.app | grep -i content-security` should show the enforced header.
8. **Daryl signs in once more** in a new private window: chat with photos, a watch, sign out. Everything must still
   work, including the fonts, photos and sign-in.
   - **If anything breaks:** revert the one-line change, commit, push `main` and tell Daryl (RUNBOOK.md §7).

## 5. Rehearsed twice (item 12): Daryl presents, you time and check
**Script:** `docs/demo/demo-script.md`. Version A is for engineers and Version B for business people; each runs 3:00.
1. Before starting, open what the script needs: the live app (signed in, dark mode), Gmail with an alert e-mail, and
   `evals/report.md`.
2. For each run, start a stopwatch when Daryl starts. Note the actual time at every script timestamp and the total.
3. **Check what Daryl says against the evidence.**
   - **Scorer:** "13 of 13 listings scored 8 or more agreed with the stronger AI judge (68% recall)". Add "human check
     pending" until section 1 is done; afterwards, the real N/10.
   - **"Good" level:** 90% recall at 85% precision.
   - **Chat:** 20/20.
   - **Cost:** "an hourly watch finding one new listing an hour costs about €0.35 a month in AI cost".
   - **Monitoring:** "a daily health e-mail and an uptime check every 30 minutes".
   - **Flag any stronger claim:** "every e-mail is right", "before users notice", "nobody else does this".
4. After each run, give **3 notes at most**: what ran long, what was unclear, and one thing to cut.
5. **Two complete runs are required:** one of each version, or two of whichever Daryl chooses.

## 6. NEW: light mode looks right (visual check after the redesign)
The redesign was checked in dark mode (the demo mode) at desktop and phone width. Light mode was only checked on paper
(the contrast table).
1. Ask Daryl to switch the Mac to **Light** appearance: System Settings → Appearance. You don't change it.
2. Screenshot these at desktop width: the landing page (signed out, private window), a new chat, a chat with listing
   cards, a watch page, and the Edit-watch sheet with the lilac schedule pills.
3. Look for text that's hard to read, invisible borders, or anything still amber or bright blue (old design). Tell
   Daryl what you found; don't change code.
4. Ask Daryl to switch back to Dark for the demo.

## 7. NEW: the redesigned alert e-mail
The alert e-mail now has the logo, Sieve colours and score badges. It's only sent when a watch finds a new good
listing.
1. Ask Daryl whether a new alert e-mail has arrived since 28 Sep 12:00. If so, open it in Gmail (Daryl's inbox; read
   only).
2. Check:
   - the logo shows (Gmail may ask to "display images")
   - the score badge
   - the reason line
   - "Open on Marktplaats"
   - "Manage or pause this watch"
   - the footer with "not affiliated" and "Replies to this address aren't read"
3. If none has arrived, record that. Don't create fake data to force one.

## 8. NEW: Daryl's line in the LinkedIn post
`docs/marketing/generated/linkedin-launch-post.md` has one placeholder: `[DARYL: one personal line, in your own words, on
why the reason matters to you]`.
1. Ask Daryl for the sentence, or whether to delete the line. **Don't write the sentence for Daryl.**
2. Put in exactly what Daryl says, or remove the line, and keep the post under 1,200 characters.

## 9. Record the results
- **`docs/demo/pre-demo-checklist.md`:** change ☐ to ✅ only where the check was done. Evidence format:
  "Daryl, <date> <time>: <what happened>". Keep ☐ with a note for anything not done or failed.
- **Append to `docs/demo/human-checks-2026-09-27.md`**, or start `human-checks-<date>.md`: one short section per item,
  with times and results, and your AI second opinion kept separate from Daryl's answers.
- **Don't commit without Daryl's OK.** If Daryl says yes, commit on `wave1-demo-ready` with the message
  `Pre-demo human checks`, fast-forward `main` and push.
- **Your final message to Daryl lists:**
  - each item as done, not done or failed
  - any production changes, with times, and whether production is back on the latest version
  - rows where Daryl disagreed with the judge
  - what Daryl still has to do
