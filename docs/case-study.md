# Marktplaats Watcher, an FDE case study

This is the engineering account of a working portfolio MVP, with the operating limits a prospective pilot owner would need to decide what to test next. **Evaluation snapshot:** Scorer run: 2026-10-09; chat run: 2026-10-09. The [evaluation report](../evals/report.md) is the source of truth when results change. The VP summary remains for the operator to write.

<!-- VP summary: operator writes this; no stack words -->

## Pain point: a buyer must keep looking

A buyer hunting a specific second-hand item can miss a good listing between manual visits. Broad keyword alerts also surface accessories and look-alikes. The [problem statement](demo/problem-statement.md) describes the buyer's job; the [positioning audit](marketing/positioning-audit-2026-09-29.md) compares the site's saved search. The desired outcome is a timely, explainable shortlist, with the buyer deciding whether to contact a seller. Time saved, seller response, and purchase outcomes have **not** been baselined with users.

## Why AI belongs, and where it stops

The decision order is **delete → plain code → agent → human**. Delete repeated browsing where possible. Use code for schedules, filters, deduplication, limits and delivery. Use an agent where a phrase such as “Mac mini with enough memory” must be interpreted against messy listing text, or where a buyer speaks in natural language. Keep choice and accountability with people. This is a task analysis, not a measured manual-time study; the counts are actions per *one* manual search pass, and every additional tab or refresh repeats the relevant row. Risk means the cost of a wrong result or action; volume means how often the step repeats.

| Manual “watch Marktplaats” step | Count per pass | Decision | Risk × volume rule |
|---|---:|---|---|
| Open the site and enter the same search | 2 actions | Delete | Low-risk repetition; save the watch once. |
| Reopen a results tab and wait for it to load | 1 tab + 1 wait | Delete | High repetition; schedule a background check. |
| Reapply price, distance and sort controls | 3 controls | Plain code | Explicit filters should be deterministic and repeat reliably. |
| Refresh the tab and inspect which listings are new | 1 click + 1 scan | Plain code | Frequent comparison of ids and timestamps; use watermarks and seen ids. |
| Open a candidate and compare its title, description and price with intent | 1 click per candidate | Agent | High-volume language judgment; record a score and reason, then audit misses. |
| Decide whether an uncertain candidate deserves attention | 1 decision per candidate | Human | False alerts and misses matter; the buyer chooses a threshold and can rate alerts. |
| Save or change a search and decide whether to contact a seller | 1 confirmation per change or contact | Human | Persistent writes and contact are consequential; the user confirms a proposal. The app does not contact sellers. |

**Why not just software?** Plain filters cannot reliably tell an accessory from the requested product or interpret a buyer's informal constraints. The model's job is limited to proposing search/watch parameters and ranking candidate listings. Code validates tool inputs, owns the schedule and thresholds, and makes the actual writes. Chat proposals are not persisted until the signed-in user presses Save; [ADR 0002](adr/0002-user-confirms-chat-proposals.md) records that boundary. The owner can pause checks, and unresolved delivery misses reach the owner through the [runbook](../RUNBOOK.md). An agent cannot bid, message a seller, silently change another person's watch, or send an unscored listing as a scored match.

## Architecture and one-screen stack + agent setup

| Layer | What runs and why | Owner of the decision |
|---|---|---|
| Interface and identity | Next.js, Clerk and Convex show chat, watches, alerts and ratings; Convex stores user data and runs schedules. | User saves and edits watches. |
| Agent and tools | FastAPI and LangChain `ChatOpenAI` call `search_marktplaats`, `propose_watch`, and `propose_watch_change`. Search reads a public page; proposals do not write. Watch mode removes search from the available tools in code. | Model interprets language; code restricts tool access. |
| Ranking and routing | The configured OpenAI model is **gpt-5.4-mini** in the cited run; ranker and chat use the same provider. Chat routes by mode to search plus proposal tools or proposal-only tools; ranking uses structured scores. The saved report names **gpt-5.5** as judge, with a human spot-check. | Code validates output, caps calls and applies bidding and alert rules. [evals/report.md §1. Does the AI e-mail the right listings? (scorer vs corrected labels)](../evals/report.md#1-does-the-ai-e-mail-the-right-listings-scorer-vs-corrected-labels) |
| Harness and eval gate | Versioned prompts, tool-call limits, timeouts, structured ranking output, offline tests, a saved listing fixture and chat golden set. CI reruns the eval gate on relevant changes and weekly; the gate checks chat and great-match precision. | Operator reviews failures and signs off; [ADR 0013](adr/0013-prompt-versions-and-eval-gate.md). |
| Human surface | Save confirmation, alert ratings and owner dashboard; pause through the dashboard or kill switch. A rating can become a reviewed case. | Buyer and owner retain control; [README](../README.md#evaluation-cost-and-operations), [runbook](../RUNBOOK.md). |
| Cost per run | **€0.0299 per 100 listings** for scoring; **€0.0019 per chat question** in the saved run. Empty checks make no model call. | Code meters usage and enforces allowances; [evals/report.md §3. Cost](../evals/report.md#3-cost), [evals/report.md §4. Running cost per watch (measured)](../evals/report.md#4-running-cost-per-watch-measured). |

The data path is: user confirms a watch → Convex schedules a due check → code reads and deduplicates new listings → model ranks the bounded candidate set → code applies the user's notify rule → Convex stores an alert and sends mail. The [system design](system-design.html) and [README architecture map](../README.md) give component detail. The scheduled read of Marktplaats' date-sorted endpoint has an acknowledged access risk; [README Limits](../README.md#limits) names it. Official access is part of the [Marktplaats ask](marketing/MARKTPLAATS-PITCH-PACK.md#4-what-were-actually-asking-for-in-stages), not a feature already obtained.

## Iterations, including the production failure

- The first chat evaluation exposed a “Watch it” turn that searched instead of proposing a watch. Restricting available tools in code fixed the route; a wrongly specified accessory case was also corrected in the eval itself. See [eval findings](../evals/report.md#what-the-evaluation-found-and-what-changed).
- On **30 Sep**, an alert audit found late-published listings being skipped. Date-sorted reads and watermarks were fixed, broad watches gained warnings, a nightly delivery audit was added, and a regression was repaired. A later catch-up sent missed matches. The failure was in *coverage of the read*, so a good ranker score could not rescue a listing it never saw. See [README history](../README.md#evaluation-cost-and-operations) and [system design](system-design.html).
- The **7–9 Oct** work made the evidence more honest and the operator path more usable: scorer fairness and human-corrected labels (MW-98), the bidding-from rule in code (MW-106), ratings as feedback cases (MW-107), dashboard trust work (MW-111–113), and current-report claim checks (MW-101). These are implementation and evaluation steps, not proof of business impact; see [report findings](../evals/report.md#what-the-evaluation-found-and-what-changed), [ratings](../README.md#evaluation-cost-and-operations), and [dashboard](../README.md#evaluation-cost-and-operations). MW-115 is the delegated-access ask, recorded in the [pitch pack](marketing/MARKTPLAATS-PITCH-PACK.md#4-what-were-actually-asking-for-in-stages); no delegated access is claimed.

## Evals: from cases to decisions

The reproducible chain is [frozen listings](../evals/data/listings.json) and [chat cases](../evals/chat_cases.py) → agent runs → saved outcome and trajectory grades → failure categories → [cost script](../evals/cost.py) and report. The 20-case learner floor was expanded to a **23-case** chat golden set; the cited run scored **23/23 outcome** and **23/23 trajectory**. This remains a selected regression set, not a population estimate. [evals/report.md §2. Does the chat do the right thing? (23-case golden set)](../evals/report.md#2-does-the-chat-do-the-right-thing-23-case-golden-set), [evals/report.md §Chat strata and abstention](../evals/report.md#chat-strata-and-abstention)

The scorer fixture holds **53 real Marktplaats listings from 6 watches**. In the **9 Oct 2026** run, great-match precision was **100%** (median range **95.0–100.0%**) and recall **78%** (range **73.9–82.6%**); good-match precision/recall were **91%/87%**. Human overrides correct some judge labels. These are *median of 3 runs*, and misses remain visible in the report. [evals/report.md §1. Does the AI e-mail the right listings? (scorer vs corrected labels)](../evals/report.md#1-does-the-ai-e-mail-the-right-listings-scorer-vs-corrected-labels)

The operational mapping below uses the report's saved representative scorer run at both notify levels **plus** operator-confirmed delivery-audit misses. A listing can appear at both levels, so counts are category occurrences, not distinct production incidents. [evals/report.md §Failure mapping](../evals/report.md#failure-mapping)

| Failure category | Count | What the saved evidence means |
|---|---:|---|
| missing context | 3 | Delivery-audit reconstruction lacked some listing fields. |
| wrong tool | 0 | None observed in these saved results. |
| wrong record | 7 | Human override, variant or accessory mismatch. |
| invalid output | 3 | A mismatch between expected and produced scoring/chat result. |
| unsafe action | 0 | None observed in these saved results. |
| timeout | 0 | None observed in these saved results. |

**One full, local run trail.** The [MW-103 fixture](../evals/data/mw103_local_tool_trail.json) is a deterministic fake-model run on sanitised search data, with **local ids and no production data**. Request `local-mw103-run-1`: user asks “Find a Mac mini” → model call → `search_marktplaats` with `query` argument → tool outcome `ok` and six fixture listings → model call → answer “Here is a Mac mini listing.” The trail records **2 model calls, 1 tool call** and the ordered sequence; it proves the local trace shape, not live search quality.

The chat eval p95 was **2.92 s** over the saved cases; a live production latency SLO is still unmeasured. The report separates normal, edge, ambiguous and high-risk cases, including abstention. The gate and [operating rules](../evals/report.md#operating-rules) say when to notify, escalate and call a result ready. [evals/report.md §Chat strata and abstention](../evals/report.md#chat-strata-and-abstention)

## Economics and operator decision

The saved run costs **€0.0299 per 100 listings** for scoring and about **€0.0019 per question** for chat. A check with no new listings costs **€0.00000** in model calls; a check with **20** new listings costs **€0.00511** before a possible retry. At **720 checks/month**, the report's hourly, 20-new-listing scenario is **€3.68/month**; at **2880 checks/month**, the 15-minute scenario is **€14.73/month**. These are workload scenarios, not customer prices or full commercial unit economics. [evals/report.md §3. Cost](../evals/report.md#3-cost), [evals/report.md §4. Running cost per watch (measured)](../evals/report.md#4-running-cost-per-watch-measured)

### Varick-bar scorecard

| Question | Status and evidence |
|---|---|
| Named failure harness | Present: [failure mapping](../evals/report.md#failure-mapping), [operating rules](../evals/report.md#operating-rules), [runbook](../RUNBOOK.md), and the local trace above. |
| Cost + latency | Present for eval runs: [cost](../evals/report.md#3-cost), [chat p95](../evals/report.md#chat-strata-and-abstention). Gap: production end-to-end alert latency is not measured. |
| Run volume and frequency | Present as configured schedules and workload scenarios in [running cost](../evals/report.md#4-running-cost-per-watch-measured). Gap: a published production run-volume series and manual baseline. |
| Code:LLM ratio and model calls per run | Model calls are present per chat case in [chat results](../evals/report.md#2-does-the-chat-do-the-right-thing-23-case-golden-set), and empty checks make none. Gap: no defensible aggregate code:LLM work ratio; no instrumented production distribution. |
| Operator controls | Pause: [runbook kill switch](../RUNBOOK.md#1-stop-all-scheduled-checks-now-kill-switch). Change rule: signed-in watch editor and [proposal confirmation](adr/0002-user-confirms-chat-proposals.md). Approve exception: buyer can choose an alert threshold, but there is no dedicated exception-approval queue. Pull a person in: [delivery audit and owner digest](../RUNBOOK.md#the-delivery-audit-found-a-miss); escalation is not a staffed service contract. |

### Pilot pre-flight: Vas's thirteen failure reasons

This is a self-check against [Vas's published list](https://x.com/vasuman/status/2107530654741348354), in its original order. “Partial” means a mechanism exists but the pilot evidence is incomplete. It is not a launch approval.

| # | Failure reason | Status | Watcher evidence or gap |
|---:|---|---|---|
| 1 | No thorough process map | Partial | The manual-to-system map above covers the buyer path; no observed cross-system map from users. |
| 2 | Automating a step, not the full process | Partial | Background checks and alert delivery cover discovery; purchase and seller contact stay with the buyer. |
| 3 | No baseline cycle time, cost or error rate | Gap | No measured manual refresh time, missed-listing baseline or buyer outcome baseline; [NFRs](nfr.md). |
| 4 | A sidekick instead of a background agent | Present | Scheduled watches operate without a chat session; [README](../README.md). |
| 5 | Not embedded in systems of record | Gap | Separate login and store; official delegated Marktplaats access is only an [ask](marketing/MARKTPLAATS-PITCH-PACK.md#4-what-were-actually-asking-for-in-stages). |
| 6 | No AI owner | Partial | Owner dashboard, digest and [runbook](../RUNBOOK.md) exist; no staffed pilot support rota. |
| 7 | Legal, security and finance too late | Partial | Access risk is recorded in [README Limits](../README.md#limits) and costs in the [report](../evals/report.md); external pilot sign-offs are absent. |
| 8 | Exceptions outside the happy path | Partial | Failure categories, abstention cases, retries and delivery audit exist; exception share in actual user work is unknown. |
| 9 | No shadow period | Partial | Silent first checks and non-mutating dry runs provide shadow behavior; the [report](../evals/report.md#open-risks) has no sustained pilot shadow-result series. |
| 10 | One model provider | Partial | Chat, scorer and judge switch provider through one setting ([ADR 0015](adr/0015-model-swap-evaluation.md), [Model swap](../evals/report.md#model-swap)); the default OpenAI path was re-proven (23/23 chat), but a second-provider comparison has not been run yet. |
| 11 | Vanity metrics over business metrics | Partial | Precision, recall, misses, latency and cost are measured; buyer time saved or completed purchases are not. |
| 12 | No month-seven owner or funding | Gap | This remains a portfolio MVP; no approved long-term service owner or commercial funding. |
| 13 | Subject matter experts not engaged | Partial | Buyer ratings and a human judge-label spot-check exist; no documented buyer SME review of pilot rules. |

The next pilot decision needs a lawful source path, a baseline from buyers, and explicit success and stop criteria. The [pitch pack](marketing/MARKTPLAATS-PITCH-PACK.md) carries the access request; it does not turn this evaluation into a pricing or adoption claim.
