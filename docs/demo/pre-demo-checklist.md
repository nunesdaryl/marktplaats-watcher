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
| 18 | Phone spacing and logo re-checked on the iPhone SE (28 Sep fix) | ☐ | Reload or re-add the home-screen app; check new chat (keyboard open too), the logo on all three tabs, light mode. Steps and ChatGPT prompt: iphone-se-recheck-brief.md. Results: human-checks-2026-09-27.md §2 |
| 19 | Feedback strip, screenshot, theme toggle and owner dashboard work on production (29 Sep) | ☐ | Deployed 29 Sep (73e2e63, rebuilt as Production), Web Analytics enabled; agent checked /admin on production as the owner (loads, all healthy). Still Daryl's: send one feedback from the iPhone and check its screenshot on /admin; toggle light/dark. Local check: docs/demo/evidence-2026-09-29/ |
| 20 | Owner-only: /admin and /api/health answer nobody but Daryl (29 Sep) | ✅ | Agent, 29 Sep (f969278): /api/health 404 without or with a wrong key; uptime workflow run passed all steps (health with key, hidden without, home, chat 401); /admin loads for Daryl; tests cover another account with Daryl's e-mail, Daryl's account with another e-mail, and missing settings. Not tested by hand: a second real account (covered by tests). |
| 21 | Dashboard drilldown live, and the Vercel token added for "Website visitors" | ☐ | Drilldown checked locally 29 Sep (accounts → watch → alert, chat transcript, day, funnel, pause/resume with confirm, mark handled, phone). Vercel token: created 29 Sep by the agent in Daryl's browser (project-scoped, expires 28 Dec 2026), pasted into Convex by Daryl; the agent verified it by length only and got live data (6 visitors, 11 page views, 30 days) on dev. Still open: deploy, then check on production. Evidence: docs/demo/evidence-2026-09-29/dashboard-drilldown-*.jpg |
| 22 | Signed-out landing and the account menu look right after every styling change | ✅ | 29 Sep: fixed the teal landing header that hid "Sign in" (CSS class clash with dashboard chart bars) and the unreadable dark account menu (cbe7c1f); agent checked the live landing signed out and the menu in dark mode. Evidence: evidence-2026-09-29/landing-header-fixed.png, account-menu-dark-readable.png |
| 23 | Sign-in goes straight to the app (no landing flash) | ☐ | Fix built 29 Sep (tab marker set on Sign in); tests and build pass; not yet deployed. Daryl: after deploy, sign out, sign in with Google, and check the landing page doesn't flash |
| 24 | Clerk production instance (removes "Development mode") | ☐ | Decision: after the demo. Needs a domain, Clerk DNS records, an own Google OAuth client, a coordinated key switch and re-linking accounts by e-mail. Steps: DEPLOY-VERCEL.md |
