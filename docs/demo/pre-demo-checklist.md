# Pre-demo checklist (course checklist §5)

✅ = verified by the build session on 27 Sep 2026 · ☐ = Daryl does it before demo day (Sat 3 Oct)

| # | Check | Status | Evidence / how |
|---|---|---|---|
| 1 | Deployed and reachable without my laptop | ✅ | https://marktplaats-watcher.vercel.app, GitHub uptime workflow green |
| 2 | Loads on a network I don't control (mobile data) | ☐ | Agent, 27 Sep 2026 23:05: local Mac landing/health 200 only; Daryl phone flow still pending. See human-checks-2026-09-27.md. |
| 3 | The pitch lands in 2–3 seconds | ✅ | Landing sentence + "Set up a free watch" above the fold; landing is in the HTML (no loading screen) |
| 4 | Empty states are real | ✅ | First-run setup, "What are you looking for?", no watches, no matches yet, no alerts, nothing archived |
| 5 | Error states are real | ✅ | AI offline (503 message), Marktplaats down, scoring down (nothing unscored is sent), unknown postcode, limits, duplicate watch |
| 6 | No secrets visible (screen, repo, screenshots) | ✅ | gitleaks scan of the full history in CI; e-mail address blurred in docs screenshots |
| 7 | Cost stated | ✅ | evals/report.md §4; demo script 2:30 |
| 8 | Proof ready | ✅ | evals/report.md: chat 20/20, scorer precision/recall |
| 9 | Judge spot-check done | ☐ | Agent, 27 Sep 2026 23:05: AI second opinion prepared separately; zero Daryl answers recorded. Row 4 asked first. evals.report now keeps cost §4 (801eddd). See human-checks-2026-09-27.md. |
| 10 | Rollback path tested once | ☐ | Not performed; explicit Daryl approval pending. Round-two mixed-version risk handled 27 Sep (801eddd): roll back only to a deployment with the same API (cac3821), per the updated brief. See human-checks-2026-09-27.md. |
| 11 | CSP enforced after a clean sign-in | ☐ | Agent, 27 Sep 2026 23:08: local enforcement blocked images.marktplaats.com; fixed 27 Sep (801eddd, now allowed). Still report-only: next is Daryl's private-window sign-in, then explicit approval to enforce. See human-checks-2026-09-27.md. |
| 12 | Rehearsed twice (engineer and business version) | ☐ | No Daryl presentations/timings recorded. Prepare Version A and Version B; see human-checks-2026-09-27.md. |
| 13 | Three conversations with real Marktplaats hunters | ☐ | Ask about the past: "the last time you looked for something second-hand, how did you keep an eye on it?" |
| 14 | Old Azure course key rotated or deleted | ☐ | If it still exists in the Azure portal |
