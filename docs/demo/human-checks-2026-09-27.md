# Pre-demo human checks — 27 September 2026

**Session state: preparation complete; human execution not complete.** All five requested items remain open. No statement of Daryl's agreement, sign-in, phone use or presentation has been received in this session. No production change, commit or push was made. Times below are Europe/Amsterdam. This file records agent observations separately from human evidence. [docs/demo/human-checks-agent-brief.md:9](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/human-checks-agent-brief.md:9>).

## 1. Judge spot-check — not done

AI preparation recorded at **23:05:20**: all ten listing links opened and separate opinions saved in [evals/data/spotcheck-ai-review.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/data/spotcheck-ai-review.md>). Review order: 4, 3, 9, then 1, 2, 5, 6, 7, 8, 10. Row 4 is the first pending question: judge says no Gazelle indication; live page's brand field says Gazelle. Row 3 is a budget-policy disagreement; row 9 remains uncertain about desk-chair suitability despite an IKEA description.

**Daryl's answers: none received; all ten Agree? cells remain blank. Daryl-disagreed rows: none recorded yet (not evidence of agreement).** `spotcheck.md` and `evals/report.md` remain unchanged. Regeneration has not run against them. The safe report reproduction shows it otherwise deletes cost §4 and only updates agreement count, not model-judge precision/recall. When all answers arrive, preserve §4, disable dotenv loading, regenerate, verify N/10 and disclose any disputes. [raw-output.json](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/round2-course/raw-output.json>); [evals/report.py:18](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/evals/report.py:18>).

## 2. Mobile-data flow — not done

**Agent supporting observation, 23:05:** local Mac landing HTTP200 in 0.075667s; health HTTP200 in 3.489997s. These are request timings, not complete page loads. The local browser displayed the signed-out landing. This is Daryl's host/network, so it does not satisfy an uncontrolled-network check. [observations.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/round2-root/observations.md>).

**Daryl's report: pending.** Required: phone Wi-Fi off; load, personally sign in, open a watch, send one chat; report load yes/no, approximate seconds and anything odd. No result inferred.

## 3. Production rollback — not done

No approval requested yet and no rollback/promotion performed; no production timestamps or duration exist. The added offline compatibility tests accept both payload directions but reproduce incomplete baselines on mixed versions. Revise the drill to protect scheduled checks under explicit approval before proceeding. The approved target remains no earlier than `1749eab`; restore the actual latest deployment after testing. [round2-parser.log](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/round2-implementation/round2-parser.log>); [docs/demo/human-checks-agent-brief.md:43](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/human-checks-agent-brief.md:43>).

**Deployment state:** no production mutation by this session; latest production identity and Vercel auto-promotion setting unverified. Public health success does not establish either. Required future record: target/current deployment IDs, both times, three probes in both states, runbook confusion, and automatic promotion state. [observations.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/round2-root/observations.md>).

## 4. CSP sign-in and enforcement — not done; enforcement blocked

Live header was report-only at **23:05:42**. No Daryl private-window session occurred, and no Vercel production logs were read. No claim of clean sign-in or clean production logs. [observations.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/round2-root/observations.md>).

**Agent local experiment, recorded 23:08:02:** unchanged policy blocks a legitimate `images.marktplaats.com` photo when enforced. That image had naturalWidth 147 under report-only, 0 enforced; allowed CDN control 147 in both. Local report fields showed `img-src` / blocked image origin. Production stayed unchanged; the local fixture was stopped. [csp-observations.json](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/evidence-2026-09-27/round2-root/csp-observations.json>).

Do not perform the one-line enforcement as currently drafted. Build session must address the permitted image origin and review the real session. Daryl then signs in/chat/watch/signs out; agent checks the correct `directive`/`blocked` fields. Any later deployment still requires Daryl's explicit yes and post-deploy personal sign-in. [main.py:189](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/main.py:189>); [docs/demo/human-checks-agent-brief.md:63](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/human-checks-agent-brief.md:63>).

## 5. Timed rehearsals — not done

No presentation occurred; no stopwatch was started and no checkpoint/total times exist. Recommend one full Version A and one full Version B. Before starting, Daryl opens a signed-in app; prepare the dated redacted alert and local report. A typed “start” plus timestamp messages can measure reported checkpoints; evaluating spoken claims requires an actual voice/transcript channel and must not be invented. [docs/demo/demo-script.md:3](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/demo-script.md:3>); [docs/demo/human-checks-agent-brief.md:85](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/human-checks-agent-brief.md:85>).

Prepared corrections: “13 selected listings agreed with the model judge,” historical workload-qualified cost, “uptime check scheduled every 30 minutes,” and human-label status only as actually completed. Up to three notes after each real run. [docs/audit/chatgpt-followup-audit-2026-09-27.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/audit/chatgpt-followup-audit-2026-09-27.md>).

## Record and approvals

All relevant checklist rows stay ☐ with agent preparation notes. **No production changes made; no documents committed or pushed.** No Daryl approval has been received for rollback, enforcement or document commits. Remaining personal actions: ten judgments, phone test, private-window sign-ins and two presentations; production approvals are requested only when each prepared action is ready. [docs/demo/pre-demo-checklist.md](</Users/daryldimitrianthony/FDE Course/2 Projects/marktplaats-watcher/docs/demo/pre-demo-checklist.md>).
