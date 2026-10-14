# OpenAI app-key cost reconciliation — 14 October 2026

## Scope and evidence status

The owner dashboard at 11:53 on 14 October showed **$4.22 billed** to the app key for the UTC month and **€0.67 measured** by the app. At the app's fixed 0.92 USD-to-EUR conversion, €0.67 is about **$0.73**, leaving about **$3.49** (5.8× billed versus measured). These are dashboard observations, not a completed attribution. The production read-only `openaiSpend:reconcile` run and its raw output belong in the station's review evidence; paste its numeric results here after deployment. Do not include API key values, key IDs, user IDs, or e-mail addresses.

The action covers the last `days` UTC dates **including the current partial UTC date**. To get exactly 1–14 October, run it on 14 October UTC with `{"days":14}`. If reviewing later, use a wider window (up to 31 days) and select the 1–14 October rows below. The action joins OpenAI daily completions and embeddings usage by API key ID and model, daily Costs API buckets grouped by API key ID, and the `aiSpend` call ledger. It also returns the independent `aiSpendMonthly` daily euro rollup. The 30-day `aiBudgets` rows have no daily tokens or call counts; `aiSpend` is the source that updates both budgets and rollups. Compare `ledger.costEur` with `ledger.rollupEur` before using either as a monthly total.

API fields and daily bucket limits follow the [OpenAI organization Usage and Costs API reference](https://platform.openai.com/docs/api-reference/usage).

### Daily table, 1–14 October UTC

Fill from the production output. `Usage tokens` should show completion input / cached input / output plus embedding input; cached input is a subset of completion input. `Ledger tokens` should show input / output. Convert ledger € to $ by dividing by 0.92. Keep exact values in review evidence and round only this display table.

| UTC date | Billed app key $ | Usage tokens: completion in / cached / out; embedding in | Ledger tokens: in / out | Ledger $ | Ledger calls by kind |
| --- | ---: | --- | --- | ---: | --- |
| 2026-10-01 | pending | pending | pending | pending | pending |
| 2026-10-02 | pending | pending | pending | pending | pending |
| 2026-10-03 | pending | pending | pending | pending | pending |
| 2026-10-04 | pending | pending | pending | pending | pending |
| 2026-10-05 | pending | pending | pending | pending | pending |
| 2026-10-06 | pending | pending | pending | pending | pending |
| 2026-10-07 | pending | pending | pending | pending | pending |
| 2026-10-08 | pending | pending | pending | pending | pending |
| 2026-10-09 | pending | pending | pending | pending | pending |
| 2026-10-10 | pending | pending | pending | pending | pending |
| 2026-10-11 | pending | pending | pending | pending | pending |
| 2026-10-12 | pending | pending | pending | pending | pending |
| 2026-10-13 | pending | pending | pending | pending | pending |
| 2026-10-14 | pending | pending | pending | pending | pending |
| **Total** | **$4.22 observed; verify** | pending | pending | **$0.73 observed; verify** | pending |

### Gap attribution for the review

The current **$3.49** gap is the only quantified difference. Do not assign that residual to a cause from code inspection alone. After production data is pasted, fill the four rows below. OpenAI usage aggregates can establish missing tokens and model mix, but cannot by themselves distinguish an unmetered app call, a billed failed call, and a separate caller reusing the app key. Those need request logs or key rotation/isolation evidence. Avoid double counting: first compare billed dollars with independently repriced usage, then compare usage tokens and requests with the ledger.

| Hypothesis | Current attributable $ | Review calculation / evidence needed |
| --- | ---: | --- |
| 1. Unmetered app paths (audit, RAG search, retries) | pending | Price usage tokens beyond ledger tokens by model and cached tier; corroborate with dated audit and RAG request logs. This is an upper bound until other callers and failed calls are excluded. |
| 2. Price table or model mismatch | pending | Reprice the **ledgered** model tokens using actual OpenAI model and cached/reasoning token rates; compare with ledger USD. Check `OPENAI_MODEL` name and `evals/common.py` rates. |
| 3. Billed failed or timed-out calls | pending | Compare OpenAI request counts with successful ledger calls and inspect dated retry/timeout logs. Usage totals alone do not prove failure. |
| 4. Other use of app key | pending | Compare app deployment request volume with app-key OpenAI usage by day/model; check key ownership and usage outside deployment without exposing key material. |
| **Unattributed residual** | **$3.49 before review** | Billed $4.22 minus measured $0.67 / 0.92; recalculate after the production run and all supported allocations. |

**Recommendation:** run reconciliation in review and prioritize the largest corroborated source. File each confirmed metering, pricing, or key-isolation fix as a separate issue; do not change budgets or prices from this investigation alone. The known audit and RAG paths warrant focused follow-up even if their dollar contribution is small. If the per-day Costs sum does not match the dashboard's same-window app-key total within rounding, stop attribution and resolve the API scope or time-window mismatch first.

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
