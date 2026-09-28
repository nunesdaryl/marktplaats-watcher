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

## Continuation — 28 September 2026

### 1. Judge spot-check — done (10/10 answered; 7/10 agreed)

Daryl, 2026-09-28 14:24:49 CEST (recorded): answered **“Yes”** in this chat to row 4’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in the last column of [spotcheck.md](../../evals/data/spotcheck.md). This is agreement with the judge’s `different_product` label, not with the separate AI second opinion. No rationale was supplied or inferred.

Daryl, 2026-09-28 14:35:13 CEST (recorded): answered **“Yes”** in this chat to row 3’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `over_budget` label for the €100 set. No rationale was supplied or inferred. This records the row judgment; application policy was not changed.

**Correction from Daryl, 2026-09-28 14:37:51 CEST (recorded):** “Actually for Row 4 and Row 3 and Row 9 I agree with AI second opinion”. This supersedes the two earlier interpretations of “Yes” above. Rows **4 and 3 now contain `no`**, because the prepared AI second opinion disagrees with the judge on both. The earlier entries are retained only as history, not as Daryl’s current judgments.

At the correction above, **row 9** was left pending because the prepared AI second opinion was **unsure**. That interim state is superseded by Daryl’s definite judgment below.

Daryl, 2026-09-28 15:12:29 CEST (recorded), clarified row 9: **“It’s the right product, looking at the description it matches the desire”**. Recorded exactly `no` in the Agree? column, meaning disagreement with the judge’s `different_product` label. This is Daryl’s judgment; the separate AI second opinion remains unchanged.

Daryl, 2026-09-28 15:23:42 CEST (recorded): answered **“Yes”** to row 1’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `wrong_model_or_spec` label for the iPhone 13 mini. No additional rationale was supplied or inferred.

Daryl, 2026-09-28 15:25:00 CEST (recorded): answered **“Yes”** to row 2’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `different_product` label for the mini wireless keyboard. No additional rationale was supplied or inferred.

Daryl, 2026-09-28 15:25:52 CEST (recorded): answered **“Yes”** to row 5’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `match` label for the IKEA Langfjall office chair. No additional rationale was supplied or inferred.

Daryl, 2026-09-28 15:28:31 CEST (recorded): answered **“Yes”** to row 6’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `different_product` label for the moving/transport service. No additional rationale was supplied or inferred.

Daryl, 2026-09-28 15:29:56 CEST (recorded): answered **“Yes”** to row 7’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `unclear` label for the Nintendo Switch consoles advert with a starting price but no OLED-specific price. No additional rationale was supplied or inferred.

Daryl, 2026-09-28 15:36:03 CEST (recorded): answered **“Yes”** to row 8’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `different_product` label for the Rado Green Gazelle wristwatch. No additional rationale was supplied or inferred.

Daryl, 2026-09-28 15:37:43 CEST (recorded): answered **“Yes”** to row 10’s question, “Agree with the judge: yes or no?”. Recorded exactly `yes` in [spotcheck.md](../../evals/data/spotcheck.md), agreeing with the judge’s `match` label for the standard iPhone 13. No additional rationale was supplied or inferred.

**Judge spot-check complete: 10/10 answers recorded; 7/10 agreed.** Daryl agrees on rows 1, 2, 5, 6, 7, 8 and 10 and disagrees on rows **3, 4 and 9**. Row 3: Daryl agreed with the prepared AI view that the app’s inclusive €100 maximum permits the €100 set. Row 4: Daryl agreed with the prepared AI view that the live Gazelle brand field supports investigating the stock advert. Row 9: Daryl explicitly said the description matches the desired product. These are human judgments about the shown listings, not evidence that the judge saw their full descriptions or brand fields.

Agent verification, 2026-09-28 15:37:43 CEST: regenerated [evals/report.md](../../evals/report.md) from saved results using `runpy.run_module('evals.report', run_name='__main__')` with dotenv loading replaced by a no-op and an audit hook rejecting environment-file reads. No model calls or application-code edits. Verified line 3 says **7/10 agreed** and names rows **3, 4, 9**; the measured cost section is preserved; every other report line and all saved scorer/chat/judge result files are unchanged. Checklist item 9 is now complete.

The headline precision and recall remain measured against the original judge labels. Adopting Daryl’s three disputed judgments would change the evaluation reference and require recalculation; no revised precision/recall or human-validated scorer claim is made here. Other human checks remain unconfirmed in this continuation. No production changes, commits or pushes were made.

The 27 September entries above are historical observations. The updated [brief](human-checks-agent-brief.md) governs this continuation, including the current rollback target and checks to perform.

### 2. Mobile-data flow — passed, spacing observation open

Daryl, 2026-09-28 15:57:01 CEST (recorded), responded to the requested phone test (Wi-Fi off, mobile data on; load site, sign in, open a watch, send a chat message): **“All four worked, however the spacing on the progressive web app version of the mobile site could be a bit better for an iphone SE 2020”**.

Recorded the four-step functional flow as passed on Daryl’s report. Checklist item 2 is complete. Recorded the **iPhone SE 2020 chat-screen spacing observation** as an open UX follow-up. Daryl subsequently supplied the screenshot below: it shows a partly obscured feedback link and no logo in the signed-in mobile header. No spacing code changes were made. Approximate load time remains unanswered. The screenshot confirms dark surfaces and teal accents; it does not confirm that Daryl saw the robot logo elsewhere. This agent’s local browser is on Daryl’s Mac and is not independent-network evidence.

Daryl, 2026-09-28 15:57:53 CEST (recorded), clarified: **“The chat screen could be better spaced on mobile iPhone SE 2020”**. This identifies the affected screen; no clipping, overlap, keyboard problem or root cause was inferred.

Daryl, 2026-09-28 16:01:24 CEST (recorded), asked **“Also nowhere once loaded do we see the logo while using the app?”** and supplied [this iPhone SE 2020 chat screenshot](evidence-2026-09-28/iphone-se-2020-chat-user.jpg). Original attachment preserved byte-for-byte; SHA-256 `2e3b6c0e298b25977961022df6636e44dc356d45c9c711eb62cf8f37ffaa0980`. The displayed screenshot clock reads 15:58; this note’s timestamp is the recording time, not a measured test duration.

**Confirmed observations:** the signed-in new-chat header has a history icon, “New chat” title and profile avatar, with no robot logo; the feedback text is partly hidden behind the bottom navigation in this captured position. The screenshot contains a browser address bar and controls, so it directly establishes the mobile browser view. Daryl previously described the experience as the PWA; standalone installed-PWA behavior has not been independently verified.

**Source check:** [App.jsx:156](../../frontend/src/App.jsx#L156) renders the mobile header without a logo, so this is omitted branding rather than evidence of a failed logo download. The logo is rendered by [Landing.jsx:29](../../frontend/src/Landing.jsx#L29), [Boot.jsx:11](../../frontend/src/Boot.jsx#L11), and [Sidebar.jsx:97](../../frontend/src/components/Sidebar.jsx#L97); the desktop branch begins at [App.jsx:140](../../frontend/src/App.jsx#L140). These explain why it is visible before/elsewhere in the flow but absent in the shown mobile workspace.

**Spacing hypothesis, not a reproduced root cause:** fixed mobile composer/navigation combined with wrapped text and large vertical spacing may reduce usable room on a short screen ([styles.css:288](../../frontend/src/styles.css#L288), [styles.css:315](../../frontend/src/styles.css#L315), [styles.css:529](../../frontend/src/styles.css#L529); [ChatView.jsx:106](../../frontend/src/views/ChatView.jsx#L106)). The main area scrolls; the screenshot does not prove that feedback is permanently unreachable. On-device scroll, keyboard-open and standalone-PWA checks remain needed before claiming a complete diagnosis.

**Open visual follow-ups:** persistent mobile branding and short-screen chat spacing/feedback visibility. Human functional pass remains valid; these visual findings are not marked resolved. No application edits, production changes or commits were made by this session.

### 3. Production rollback — preparation only; awaiting dashboard sign-in

Agent observation, 2026-09-28 15:57:01 CEST: Vercel redirected the project dashboard to sign-in. Daryl must sign in; no credentials were entered by the agent. The actual current and previous Production deployment IDs and commit hashes remain unverified. No rollback approval has been requested or received, and no production mutation was performed.

Read-only local preparation found an empty `git diff cac3821 a6e5f0a -- agent.py main.py`; recent source versions share those API files. Local Git references do not establish which deployments are current/previous in Vercel. Before the drill, capture both actual Production deployments, compare their API files, identify the exact restoration target, then request Daryl’s approval. The drill follows the narrower previous-deployment rule in the [brief](human-checks-agent-brief.md), rather than treating any “last good” release in [RUNBOOK.md §2](../../RUNBOOK.md) as sufficient. Vercel’s auto-promotion state is still unverified.
