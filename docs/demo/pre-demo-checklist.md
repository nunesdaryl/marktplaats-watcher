# Pre-demo checklist (course checklist §5)

✅ = verified by the build session on 27 Sep 2026 · ☐ = Daryl does it before demo day (Sat 3 Oct)

| # | Check | Status | Evidence / how |
|---|---|---|---|
| 1 | Deployed and reachable without my laptop | ✅ | https://marktplaats-watcher.vercel.app, GitHub uptime workflow green |
| 2 | Loads on a network I don't control (mobile data) | ☐ | Open it on your phone with Wi-Fi off |
| 3 | The pitch lands in 2–3 seconds | ✅ | Landing sentence + "Set up a free watch" above the fold; landing is in the HTML (no loading screen) |
| 4 | Empty states are real | ✅ | First-run setup, "What are you looking for?", no watches, no matches yet, no alerts, nothing archived |
| 5 | Error states are real | ✅ | AI offline (503 message), Marktplaats down, scoring down (nothing unscored is sent), unknown postcode, limits, duplicate watch |
| 6 | No secrets visible (screen, repo, screenshots) | ✅ | gitleaks scan of the full history in CI; e-mail address blurred in docs screenshots |
| 7 | Cost stated | ✅ | evals/report.md §4; demo script 2:30 |
| 8 | Proof ready | ✅ | evals/report.md: chat 20/20, scorer precision/recall |
| 9 | Judge spot-check done | ☐ | Fill in the last column of evals/data/spotcheck.md (10 rows), then `.venv/bin/python -m evals.report` |
| 10 | Rollback path tested once | ☐ | Vercel → Deployments → promote the previous deployment, then promote the current one back (RUNBOOK §2) |
| 11 | CSP enforced after a clean sign-in | ☐ | Sign in once in a private window; if the Vercel logs show no `csp_violation`, enforce it (RUNBOOK §7) |
| 12 | Rehearsed twice (engineer and business version) | ☐ | docs/demo/demo-script.md, timed at 3:00 each |
| 13 | Three conversations with real Marktplaats hunters | ☐ | Ask about the past: "the last time you looked for something second-hand, how did you keep an eye on it?" |
| 14 | Old Azure course key rotated or deleted | ☐ | If it still exists in the Azure portal |
