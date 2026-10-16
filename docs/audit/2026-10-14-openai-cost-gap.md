# OpenAI app-key cost reconciliation — 14 October 2026

## Scope and evidence status

The owner dashboard at 11:53 on 14 October showed **$4.22 billed** to the app key for the UTC month and **€0.67 measured** by the app. At the app's fixed 0.92 USD-to-EUR conversion, €0.67 is about **$0.73**, leaving about **$3.49** (5.8× billed versus measured). These are dashboard observations, not a completed attribution. The production read-only `openaiSpend:reconcile` run and its raw output belong in the station's review evidence; paste its numeric results here after deployment. Do not include API key values, key IDs, user IDs, or e-mail addresses.

The action covers the last `days` UTC dates **including the current partial UTC date**. To get exactly 1–14 October, run it on 14 October UTC with `{"days":14}`. If reviewing later, use a wider window (up to 31 days) and select the 1–14 October rows below. The action joins OpenAI daily completions and embeddings usage by API key ID and model, daily Costs API buckets grouped by API key ID, and the `aiSpend` call ledger. It also returns the independent `aiSpendMonthly` daily euro rollup. The 30-day `aiBudgets` rows have no daily tokens or call counts; `aiSpend` is the source that updates both budgets and rollups. Compare `ledger.costEur` with `ledger.rollupEur` before using either as a monthly total.

API fields and daily bucket limits follow the [OpenAI organization Usage and Costs API reference](https://platform.openai.com/docs/api-reference/usage).

### Daily table, 1–14 October UTC

Fill from the production output. `Usage tokens` should show completion input / cached input / output plus embedding input; cached input is a subset of completion input. `Ledger tokens` should show input / output. Convert ledger € to $ by dividing by 0.92. Keep exact values in review evidence and round only this display table.

| UTC date | Billed app key $ | Usage tokens: completion in / cached / out; embedding in | Ledger tokens: in / out | Ledger $ | Ledger calls by kind |
| --- | ---: | --- | --- | ---: | --- |
| 2026-10-01 | 0.0956 | 59,599 / 0 / 11,302; 0 | 0 / 0 | 0.0000 | none (meter not live) |
| 2026-10-02 | 0.1701 | 104,549 / 1,280 / 20,562; 0 | 0 / 0 | 0.0000 | none (meter not live) |
| 2026-10-03 | 0.3004 | 201,591 / 11,648 / 34,671; 51,900 | 0 / 0 | 0.0000 | none (meter not live) |
| 2026-10-04 | 0.2891 | 185,743 / 9,216 / 34,661; 1,295 | 0 / 0 | 0.0000 | none (meter not live) |
| 2026-10-05 | 0.2994 | 192,309 / 1,792 / 34,734; 3,209 | 21,696 / 3,203 | 0.0292 | watch 22, embedding 51 |
| 2026-10-06 | 0.3602 | 247,233 / 1,792 / 39,078; 5,371 | 65,570 / 8,887 | 0.0858 | watch 60, embedding 121 |
| 2026-10-07 | 0.3555 | 261,880 / 0 / 35,346; 2,879 | 49,905 / 5,246 | 0.0592 | watch 47, embedding 60 |
| 2026-10-08 | 0.3770 | 283,525 / 0 / 36,498; 3,387 | 58,613 / 5,682 | 0.0674 | watch 52, embedding 75 |
| 2026-10-09 | 0.3665 | 287,328 / 0 / 33,552; 1,789 | 46,909 / 3,754 | 0.0509 | watch 45, embedding 37 |
| 2026-10-10 | 0.4028 | 322,902 / 2,816 / 36,118; 1,695 | 89,243 / 7,990 | 0.1017 | watch 71, embedding 36, offer help 2 |
| 2026-10-11 | 0.4045 | 318,497 / 0 / 36,805; 2,201 | 88,031 / 7,711 | 0.0993 | watch 75, embedding 46, offer help 1 |
| 2026-10-12 | 0.4135 | 332,100 / 0 / 36,531; 2,068 | 93,592 / 7,009 | 0.1004 | watch 91, embedding 44 |
| 2026-10-13 | 0.3849 | 313,831 / 11,264 / 34,900; 2,093 | 87,776 / 6,554 | 0.0940 | watch 74, embedding 44 |
| 2026-10-14 | 0.0000 (not yet billed) | 217,418 / 0 / 21,975; 770 (partial day) | 58,140 / 4,054 | 0.0614 | watch 51, embedding 17, offer help 1 |
| **Total** | **$4.2194** (matches the dashboard's $4.22) | 3,328,505 / 39,808 / 446,733; 78,657 | 659,475 / 60,090 | **$0.7495** (€0.6896, equal to the daily rollup) | 1,123 ledger calls; 1,821 OpenAI completion requests |

### Gap attribution for the review

Production run: `npx convex run --prod openaiSpend:reconcile '{"days":14}'` on 14 Oct 2026 (read-only; output carries the key name only). The original **$3.49** gap is split below. Do not assign that residual to a cause from code inspection alone. After production data is pasted, fill the four rows below. OpenAI usage aggregates can establish missing tokens and model mix, but cannot by themselves distinguish an unmetered app call, a billed failed call, and a separate caller reusing the app key. Those need request logs or key rotation/isolation evidence. Avoid double counting: first compare billed dollars with independently repriced usage, then compare usage tokens and requests with the ledger.

| Hypothesis | Attributable $ (1–13 Oct) | Evidence |
| --- | ---: | --- |
| 0. Before the per-person meter existed (1–4 Oct; MW-86 started recording on 5 Oct) | **0.855** | Ledger has no rows before 5 Oct by design; not a defect. |
| 2. Price table or model mismatch | **0.00** | Repricing OpenAI's own token counts at the app's table (gpt-5.4-mini $0.75 / $4.50 per 1M, cached input at 10%, embeddings $0.02) gives $4.219 against $4.220 billed. Ledgered tokens repriced give $0.703 against the ledger's $0.688. The price table is correct. |
| 1. Unmetered app paths: daily delivery audit | about **0.15** (estimate) | The `audits` table shows 31–93 listings audited per day (5–13 Oct); at about $0.033 per 100 listings scored that is about $0.02 a day. Real but small. RAG search embeddings: embedding tokens beyond the ledger are tiny (cents). |
| 3. Billed but failed or never-recorded calls | **not separable yet** | Production Convex logs (last 3,000 lines) show no "AI usage record failed"; the check path captures usage for every ranking call, retries included (`agent.py:642-652`, `agent.py:979-995`). |
| 4. Other use of the app key | **not separable yet** | OpenAI saw 1,315 completion requests on the app key over 5–13 Oct; the app recorded 540 model calls (watch + offer help). About 775 requests (≈ 1.96M input and 0.28M output tokens, ≈ $2.5) have no matching record. Aggregate usage cannot say which process made them. |
| **Unattributed residual (5–13 Oct)** | **≈ 2.52** | Billed $3.364 minus ledger $0.688 minus audit ≈ $0.15. |

**Recommendation:** the meter is priced correctly, and it under-counts because about 59% of the app key's completion requests since 5 Oct never reach it. The per-person €1 budget is therefore not wrong for the calls it sees, but it does not see most of the spend. Next, attribute those ~775 requests: record per-route OpenAI call counts and tokens in a daily Convex rollup, compare a full UTC day with OpenAI usage, and only then decide what to meter (record audit and RAG usage under an owner/internal kind; rotate the app key if any caller is outside the deployed app). File that as one follow-up issue. Do not change budgets or prices from this investigation.

**Next measurement:** After one full UTC day in production, run `npx convex run --prod openaiCalls:summary '{"days":2}'` and read the completed day's counts and tokens by `route` and `env` (production only). Compare them with that day's OpenAI completion and embedding usage from `openaiSpend:reconcile`; the remaining difference identifies calls outside the logged production service or calls that could not be observed here. Vercel Hobby logs do not retain a full day reliably.

## OpenAI call-path inventory

The Python service uses `OPENAI_API_KEY` for `ChatOpenAI` through `model_config.py:14` and `agent.py:380-384`, the separate offer model at `offer.py:23`, and `OpenAIEmbeddings` at `agent.py:1128`. These paths use the app key **when the deployed service's `OPENAI_API_KEY` is that key**. The Convex admin key only reads OpenAI organization APIs; it does not make model calls.

| Caller and model operation | Metering status | Evidence in code |
| --- | --- | --- |
| Scheduled watch check and model ranking (including omitted-ID retry) | Metered for responses whose usage reaches Convex; failed attempts may escape | `frontend/convex/checker.ts:500,538`; `main.py:528-535`; `agent.py:642,979-1003`; `frontend/convex/aiBudget.ts:45` |
| Chat and watch-mode chat model turns | Metered on completed response; streaming errors/timeouts before final `done` can escape | `agent.py:440-485`; `main.py:367-370,413-422`; `main.py:268-274`; `frontend/convex/http.ts:59` |
| Owner Admin Ask intent model | Metered when usage metadata exists | `agent.py:411-422`; `main.py:300-313` |
| Offer help draft model | Metered when usage metadata exists | `offer.py:23,42`; `main.py:322-350` |
| Alert embeddings, including alerts from normal checks and catch-up sends | Metered with **estimated** tokens, after successful embedding response; retry or save/record failure can escape | `frontend/convex/checker.ts:256`; `frontend/convex/catchup.ts:152`; `frontend/convex/embeddings.ts:86-116`; `main.py:520-525`; `agent.py:1125-1133` |
| Daily delivery audit ranking for each watch with candidates; catch-up audit uses the same route | **Not metered** | `frontend/convex/catchup.ts:206`; `main.py:543-548`; `agent.py:1024-1071,642` |
| RAG alert search query embeddings, including MCP `search_my_alerts` | **Not metered** | `agent.py:1138-1142`; `mcp_server.py:165`; `agent.py:1125-1133` |
| Canary check | No model call observed on its read-only path; no meter expected | `frontend/convex/checker.ts:558-572`; `agent.py:803,918` |
| Watch volume estimate | No model call; no meter expected | `main.py:389-398`; `agent.py:estimate_volume_note` |

`evals/run_scorer.py` invokes production ranking code during evaluations, but the eval workflow is configured for its own restricted key. Confirm key separation before excluding local/manual calls from hypothesis 4. The code inventory does not prove which key a live process used; the production OpenAI usage grouped by key and model is the next evidence.
