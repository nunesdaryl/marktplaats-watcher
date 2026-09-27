# Follow-up audit brief (round 2): Marktplaats Watcher

**For:** the same assistant that wrote `docs/audit/chatgpt-deep-audit-2026-09-27.md`.
**Owner:** Daryl Nunes. **Written:** 27 Sep 2026.
- **Deadlines:** the first LinkedIn post is planned for **Tue 29 Sep**; demo day is **Sat 3 Oct 2026**.
- **Commit under review:** `cac3821` on `main`, which is live at https://marktplaats-watcher.vercel.app.

## 1. What changed since your audit (commit `1749eab` → `cac3821`)
Every item from your "Confirmed code findings" was acted on, and each fix has a test that failed first.

| Your ID | What was done | Where to verify |
|---|---|---|
| A01 | **Retries.** A failed alert e-mail is retried at the next 3 scheduler ticks (every 15 min); "pending" alerts stuck for more than 30 min are retried too. After 4 attempts the alert stays `failed` and the health digest reports it. Retries only happen within 24 h, and only for watches that are still active. | `frontend/convex/checker.ts` (`claimEmailRetries`, `deliver` in `checkDue`); `schema.ts` (`alerts.attempts`, index `by_emailStatus`) |
| A02 | **Stale results.** `record` ignores a result if, since the claim, the watch was paused or archived, or its search was edited (`watches.searchEditedAt`). `emailContent` also refuses to e-mail about a paused or archived watch. | `checker.ts` `record` and `emailContent`; `watches.ts` `update` |
| A03 | **Remembering listings.** A check now remembers every listing on the page (`parse_listings(..., limit=None)`); the chat still shows 10. Scoring is capped at 20 listings per watch per check; the rest are left out of `currentIds`, so they stay unseen and are scored next time. | `agent.py` `check_query`, `MAX_RANK_PER_CHECK` |
| A04 | **Unreadable pages.** A page without listings data is `ok:false` ("Marktplaats showed an unexpected page"), so the baseline is kept and the check retried in 30 min. The chat tool says the same. | `agent.py` `parse_listings` (`stats["readable"]`), `check_query`, `search_marktplaats` |
| A05 | **Leases.** `claimDue` leases a watch for at most 30 min (`min(nextRun, now+30m)`). A completed `record` sets the real next run. | `checker.ts` `claimDue`, `record` |
| A06 | **Dry runs.** A dry run leases nothing, writes nothing and logs no run; it only logs the e-mails it would send. The existing tests now use real runs with a fake AgentMail. | `checker.ts` `record` (dry-run branch), `checkDue` |
| (new) | **Cheaper first check.** The first check of a new watch sends `seeded:false`, so nothing is scored (nothing is e-mailed then anyway). | `checker.ts` `claimDue` payload; `main.py` `CheckWatch.seeded`; `agent.py` |
| A07 | **Wording.** The demo script and README now say "13/13 'great' e-mails agreed with the judge, 68% recall, human check pending". The ops claim is now "daily health e-mail + 30-minute uptime check". LinkedIn drafts say Next.js, 34 + 61 tests, and that the eval exists. | `docs/demo/demo-script.md`, `README.md`, `docs/marketing/generated/*` |
| A08 | **Privacy text.** The landing page and privacy sheet name the companies that process data. They say "Delete my data" removes what *we* store and that the login account is closed separately. They also give the retention clocks. | `frontend/src/Landing.jsx`, `frontend/src/views/PrivacySheet.jsx` |

- **Tests:** 34 pytest and 61 vitest/convex-test, all green; CI green on `cac3821`. New tests are in
  `frontend/convex/checker.test.ts` and at the end of `test_agent.py`.
- **Live checks:** a production dry run and the first real production run on the new code (2 watches checked, 0
  failed) were observed.

**Trade-offs chosen on purpose.** Challenge them if you disagree, but don't report them as new findings:
- **Duplicate e-mail.** An e-mail AgentMail accepted but didn't confirm may be sent twice; losing alerts was judged worse.
- **"Check now" during a running check.** A press while that watch's check is running is absorbed by that check; the
  schedule then moves to the normal next time.
- **Same-millisecond edit.** `searchEditedAt >= claimTime` treats an edit in the same millisecond as the claim as stale.
- **Retry cadence.** E-mail retries follow the 15-minute tick, not an exponential backoff.
- **Not yet started:** the legal/terms question, payments, commercial hosting, a per-user AI budget, and the human
  eval label review. These are open by decision until after 3 Oct.

## 2. What to do this round
1. **Verify the fixes independently.**
   - Re-run your reproductions from `docs/audit/evidence-2026-09-27/` against `cac3821`. Adapt them where the API
     moved, e.g. `claimDue` now takes `dryRun`, and `record` skips inactive watches.
   - Each "CONFIRMED defect" assertion should now fail. Say which still reproduce, which are fixed, and which fixes
     are partial.
2. **Hunt for regressions the fixes introduced.** Focus on:
   - lease vs. manual check vs. schedule edits
   - retries vs. the health digest counts
   - `seeded:false` vs. an old API still deployed during a rollback (both directions must work)
   - scoring cap vs. cost numbers in `evals/report.md` (do they need re-measuring?)
   - the dry-run branch duplicating the write branch's logic
3. **Go deeper where round 1 was thin:**
   - **Demo readiness for Sat 3 Oct:** walk the demo script against the live product, then list what could fail
     live and the backup for each.
   - **LinkedIn launch pack:** review `docs/marketing/generated/linkedin-launch-post.md` and `linkedin-series.md`
     against the 06-content-creator rules and the evidence. Is the 29 Sep post safe to publish? What must change?
   - **Validation:** turn §9 of the course checklist and the 10-product-builder validation ladder into a concrete
     one-week plan with dated persist/pivot criteria. Use the "Would you pay?" feedback button that now exists
     (`frontend/convex/feedback.ts`).
4. **Keep the rest current.** Update your scorecard, but show **only the rows that changed** since round 1, with evidence.

## 3. What to deliver (one Markdown file: `docs/audit/chatgpt-followup-audit-<date>.md`)
1. **Fix verification table.** Columns: ID, verdict (fixed / partial / not fixed / regression), evidence (test or
   file:line), notes.
2. **New findings**, each with severity, reproduction, file:line and the smallest fix. Mark anything you inferred as an
   *assumption*.
3. **Scorecard delta:** only the changed rows.
4. **Go / no-go** for (a) the 29 Sep LinkedIn post and (b) the 3 Oct demo, each with the blocking items.
5. **Updated top 10** for after demo day: say what dropped off and why.
6. **At most 5 questions** for the owner, each answerable in one line.

## 4. Rules (same as round 1, plus two)
- Cite a file for every claim; no invented numbers; legal points = "check with a lawyer".
- Don't open `.env` files or print secrets.
- **Don't modify application code.** Put reproductions under `docs/audit/evidence-<date>/`, which git ignores.
- **Don't re-report trade-offs listed in §1** unless you show a concrete failure they cause.
