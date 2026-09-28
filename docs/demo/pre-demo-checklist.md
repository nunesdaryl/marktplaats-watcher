# Pre-demo checklist (course checklist §5)

✅ = verified; see the dated evidence for who performed each check · ☐ = still open before demo day (Sat 3 Oct)

| # | Check | Status | Evidence / how |
|---|---|---|---|
| 1 | Deployed and reachable without my laptop | ✅ | https://marktplaats-watcher.vercel.app, GitHub uptime workflow green |
| 2 | Loads on a network I don’t control (mobile data) | ✅ | Daryl, 2026-09-28 15:57:01 CEST: reported all four phone steps worked (load, sign in, open watch, send chat). iPhone SE 2020 PWA chat-screen spacing could improve (Daryl clarified 2026-09-28 15:57:53 CEST); screenshot confirmed absent mobile logo and partly obscured feedback. Fixed and deployed 28 Sep (14975e1): logo in the phone top bar, new-chat screen fits above the composer; Daryl's on-device re-check pending, load time pending. See human-checks-2026-09-27.md. |
| 3 | The pitch lands in 2–3 seconds | ✅ | Landing sentence + "Set up a free watch" above the fold; landing is in the HTML (no loading screen) |
| 4 | Empty states are real | ✅ | First-run setup, "What are you looking for?", no watches, no matches yet, no alerts, nothing archived |
| 5 | Error states are real | ✅ | AI offline (503 message), Marktplaats down, scoring down (nothing unscored is sent), unknown postcode, limits, duplicate watch |
| 6 | No secrets visible (screen, repo, screenshots) | ✅ | gitleaks scan of the full history in CI; e-mail address blurred in docs screenshots |
| 7 | Cost stated | ✅ | evals/report.md §4; demo script 2:30 |
| 8 | Proof ready | ✅ | evals/report.md: chat 20/20, scorer precision/recall |
| 9 | Judge spot-check done | ✅ | Daryl, 2026-09-28 15:37:43 CEST: completed all 10 judgments; 7/10 agreed, disagreed on rows 3, 4 and 9. Report regenerated; measured cost §4 preserved. Precision/recall still use the judge’s labels. See human-checks-2026-09-27.md. |
| 10 | Rollback path tested once | ☐ | Not performed; explicit Daryl approval pending. Round-two mixed-version risk handled 27 Sep (801eddd): roll back only to a deployment with the same API (cac3821), per the updated brief. See human-checks-2026-09-27.md. |
| 11 | CSP enforced after a clean sign-in | ☐ | Agent, 27 Sep 2026 23:08: local enforcement blocked images.marktplaats.com; fixed 27 Sep (801eddd, now allowed). Still report-only: next is Daryl's private-window sign-in, then explicit approval to enforce. See human-checks-2026-09-27.md. |
| 12 | Rehearsed twice (engineer and business version) | ☐ | No Daryl presentations/timings recorded. Prepare Version A and Version B; see human-checks-2026-09-27.md. |
| 13 | Three conversations with real Marktplaats hunters | ☐ | Ask about the past: "the last time you looked for something second-hand, how did you keep an eye on it?" |
| 14 | Old Azure course key rotated or deleted | ☐ | If it still exists in the Azure portal |
| 15 | Light mode looks right after the redesign (28 Sep) | ☐ | Dark mode checked on desktop and phone by the build session; light mode only on paper (contrast table). Brief §6 |
| 16 | Redesigned alert e-mail seen in the inbox | ☐ | Arrives with the next real match. Brief §7 |
| 17 | Daryl's personal line in the LinkedIn launch post | ☐ | Fill in or delete the `[DARYL: …]` line. Brief §8 |
| 18 | Phone spacing and logo re-checked on the iPhone SE (28 Sep fix) | ☐ | Reload or re-add the home-screen app; check new chat (keyboard open too), the logo on all three tabs, light mode. See human-checks-2026-09-27.md §2 |
