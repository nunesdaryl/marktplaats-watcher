# Prompt templates, MCP and RAG for Marktplaats Watcher

**Audit date:** 3 October 2026, morning · **Scope:** documentation of the proposed demo-day work, not a claim that it has shipped. The implementation issues are MW-60 to MW-63; the optional user template catalog is MW-65. [Approved build plan](../plans/2026-10-03-chatgpt-day5-plan.md); [project architecture](../system-design.html).

## 1. Plain-English summary

- **Prompt templates** are reusable instructions with named inputs. The app already has fixed instructions for chat, watch mode, ranking and owner search, but they live as Python strings. MW-60 plans to make those instructions reusable without changing their words. MW-65 plans editable examples in the chat composer. [Current prompts](../../agent.py#L339-L421); [build plan](#6-build-plan-and-dependencies).
- **MCP** is a common way for an AI assistant to call tools. Today this agent calls Python tools directly. MW-62 plans a read-only, account-scoped MCP server so the app's chat and the owner's desktop assistant can use the same search and history tools. A tool call still needs authentication and a permission check. [Current tools](../../agent.py#L245-L303); [current design](../system-design.html); [Day 1 full deck, p. 115](#7-sources).
- **RAG** finds a small set of relevant records, then gives them to the model as evidence for an answer. MW-61 plans embeddings and a Convex vector index for past alerts, with exact database queries for dates and totals. Answers should cite alerts and say when the evidence is missing. [Day 1 full deck, pp. 105, 109](#7-sources); [integration plan](../plans/2026-10-03-chatgpt-day5-plan.md#4-implementation-sequence-and-interfaces).
- **Why build it:** Daryl can ask why an alert was sent, find similar past alerts, and review watch changes before saving. The app currently has no alert-history reading tool in chat. The proposal keeps writes behind the existing Save action. [Current tool list](../../agent.py#L245-L303); [approved plan](../plans/2026-10-03-chatgpt-day5-plan.md#4-implementation-sequence-and-interfaces).
- **Cost and risk:** embedding, retrieval and extra model context add usage to an OpenAI project already capped at $10/month; Atlas would add a second store with unmeasured cost. There is no verified post-build cost figure yet. The main failure risks are cross-account retrieval, unsafe MCP access, prompt injection in listing text and syncing a second store. Atlas also requires a credential rotation and a deliberate network-access choice before use. [Current cost report](../../evals/report.md#4-running-cost-per-watch-measured); [ADR 0012](../adr/0012-allowance-and-kill-switches.md); [approved build plan](#6-build-plan-and-dependencies).

**Status:** This is an audit and build plan. The scorecard's “after” column is the intended state if the listed issues pass review and merge. [MW-60 to MW-63 build plan](#6-build-plan-and-dependencies).

## 2. What the course says

`1 Course Material/Day 5/` has no teaching files. The approved course plan treats Day 5 as demo day, so the source for these topics is the available Day 1, Day 3 and Day 4 material; this is not an audit of missing Day 5 slides. [Approved build plan, Context](#7-sources); [Day 5 directory](#7-sources).

| Topic | Course teaching | Application here |
|---|---|---|
| RAG | Split documents into chunks, embed, store vectors, retrieve the relevant few, then answer from them (Day 1 full deck, p. 105). The live demo shows citations, refusal when documents cannot answer, and rerunning the same five questions (p. 109). The component/discipline slides put data access and evaluation around the model (pp. 107–108, 110). | Index bounded alert evidence, return a few owned records with source references, and test grounded answers including missing evidence. Alerts and ratings can be one compact evidence record each; arbitrary document chunking is unnecessary here. [Integration plan §4C](../plans/2026-10-03-chatgpt-day5-plan.md#4-implementation-sequence-and-interfaces). |
| MCP | A standard plug or “USB for AI tools,” with scoped permissions; write access is as consequential as giving an employee write access (Day 1 full deck, p. 115). Day 4 Cohort Agents, p. 23, shows tool use and stateless `POST /mcp` without a session id. | Expose read-only tools, derive identity from a validated Clerk JWT or owner token, and keep each request self-contained. [Approved build plan, architecture](#4-target-architecture). |
| Retrieval quality | Day 3 Second Brain and Software Factory, p. 7, says “grep first, embeddings second”: use direct filters and keyword search before adding vectors. Day 4 Cohort Agents, p. 24, shows query rewrite, hybrid search, rerank and cite; the agent chooses when to retrieve. | Exact queries decide dates and totals. Hybrid keyword and vector candidates help semantic questions without losing model names or specs; reranking is a later quality option, not a claim about v1. [ChatGPT integration plan §3–4](../plans/2026-10-03-chatgpt-day5-plan.md#3-target-architecture). |
| Prompts and evaluation | Day 4 Cohort Agents, p. 27, says fix prompts from failed eval cases, rerun and compare; p. 30 homework asks for clear tool docstrings, a system prompt and a bounded loop. | Move current prompt text into templates, preserve versions, and keep a separate RAG eval set beside the existing gate. [ADR 0013](../adr/0013-prompt-versions-and-eval-gate.md); [current eval workflow](../../.github/workflows/evals.yml#L1-L12). |
| Trust boundary | The FDE agent-engineering reference says retrieved text is data rather than instructions and an unexamined MCP with internet egress fails review (lines 73–83). | Treat listing titles, ratings and tool results as untrusted data; limit tool egress and never let retrieved text grant permissions. [Agent-engineering reference](#7-sources). |

The available course material does **not** specify a chunk size for this alert corpus, a required embedding model, a recall@k target, or a prompt-versioning scheme. Those are project decisions to justify and measure, not course requirements. [Day 1 full deck, pp. 105–110](#7-sources); [Day 4 Cohort Agents, pp. 23–30](#7-sources); [ADR 0013](../adr/0013-prompt-versions-and-eval-gate.md).

## 3. Project position on 3 October morning

| Area | Evidence-based starting point |
|---|---|
| Prompts | `ADMIN_INTENT_PROMPT`, `SYSTEM_PROMPT`, `WATCH_MODE` and `RANK_PROMPT` are Python string constants. `PROMPT_VERSION` has hand-bumped chat and rank values. The checked-in evaluation report still names an older run, so it is a dated record rather than proof of the latest code's behavior. [agent.py:339–421](../../agent.py#L339-L421); [agent.py:520–538](../../agent.py#L520-L538); [evals/report.md:1–3](../../evals/report.md#L1-L3). |
| Evaluation | ADR 0013 gates relevant changes at 19/20 chat cases and at least 90% precision for great matches. The workflow watches `agent.py` and `evals/**`; new prompt files would need to be added to its path filter. [ADR 0013](../adr/0013-prompt-versions-and-eval-gate.md); [evals.yml:1–12](../../.github/workflows/evals.yml#L1-L12). |
| Tool access | `make_tools` supplies direct Python search and proposal tools. System design §4 marks MCP “NOT IN MVP.” No `vectorIndex`, `vectorSearch` or embedding code is present in `frontend/convex/` or `agent.py` at this audit revision. [agent.py:245–303](../../agent.py#L245-L303); [system-design.html:219–221](../system-design.html#L219-L221); [approved plan, Context](#7-sources). |
| Model and budget | The deployed model is documented as `gpt-5.4-mini`; the OpenAI project has a $10/month cap and an allow-list limited to that model. The embedding model must be allowed before embeddings can run. [system-design.html:94–95](../system-design.html#L94-L95); [evals/report.md:151–153](../../evals/report.md#L151-L153); [approved plan, Context](#7-sources). |

## 4. Target architecture

```text
Chat UI ──► chat agent (versioned prompt templates)
               │ in-process MCP client; user's Clerk JWT
Owner desktop ─┼──► stateless MCP HTTP endpoint; owner token
               ▼
          read-only tools: search_marktplaats, my_watches,
          my_recent_alerts, search_my_alerts
               │ exact alert/watch queries for dates, totals and IDs
               │ embed semantic queries in Python
               ▼
          Convex vectorSearch on alertEmbeddings (filter userId)
               │ hybrid keyword + vector candidates; recheck ownership
               ▼
          at most five cited evidence records ──► agent answer

          MongoDB Atlas mirror ◄── embedding writes
               │ failover on Convex error/timeout; compare top results
               └── never random per-request load balancing
```

The MCP boundary validates identity; the model cannot choose an authoritative `userId`. Python holds the OpenAI key and computes embeddings; Convex holds the primary vector index and filters by `userId`. The chat agent uses the same MCP implementation in process, avoiding a callback to its own deployment. Atlas is the owner-requested second store in MW-63, used as a mirror, explicit failover and comparison. Random load balancing could give different answers for the same question while the stores are out of sync. These are design decisions, not implemented behavior in this audit. [Approved build plan, Architecture and MW-61–63](#7-sources); [ChatGPT plan §3–4](../plans/2026-10-03-chatgpt-day5-plan.md#3-target-architecture).

## 5. Scorecard, plan comparison and risks

| Topic | Before | Intended after review and merge | Issue |
|---|---|---|---|
| Prompt templates | 🟡 Versioned strings, no reusable template structure or picker. [agent.py:339–421](../../agent.py#L339-L421) | ✅ Same system words in templates; editable catalog follows separately. | MW-60; MW-65 planned |
| MCP | ❌ Direct Python calls only. [system-design.html:219–221](../system-design.html#L219-L221) | ✅ Stateless read-only tools for authenticated chat and owner client. | MW-62 planned |
| RAG | ❌ No vector index or retrieval tool. [approved plan, Context](#7-sources) | ✅ Owned, cited alert retrieval with exact and hybrid paths and separate evals. | MW-61–62 planned |
| Second vector store | ❌ No Atlas mirror. [approved plan, MW-63](#7-sources) | 🟡 Mirror, explicit failover and comparison, subject to credential and deletion checks. | MW-63 planned |

The two plans agree on Convex vectors, stateless MCP, read-only tools and a user identity derived from auth. The approved build plan adopts ChatGPT's in-process MCP client, separate exact and semantic tools, hybrid retrieval, separate RAG evaluations, an editable template catalog as MW-65, and feature flags for rollback. For today's scope it defers Clerk OAuth for external clients, review mode and expanded watch-change fields; it keeps Atlas as MW-63 because the owner requested a second store, while describing its sync and privacy cost. [Approved build plan, 3 Oct update](#7-sources); [ChatGPT plan §3–4](../plans/2026-10-03-chatgpt-day5-plan.md#3-target-architecture).

| Risk | Required control or decision |
|---|---|
| Demo-day release | Merge only before the 60-minute pre-presentation cut-off; otherwise demonstrate the audited architecture. Keep flags off until verification and preserve the existing chat fallback. [Approved build plan, Order](#7-sources). |
| Cost | Embeddings and retrieval add usage under the existing $10 OpenAI cap. Measure actual tokens, latency and spend in review; do not rely on the plan's estimate as a bill. [evals/report.md:151–153](../../evals/report.md#L151-L153); [ChatGPT plan §4E](../plans/2026-10-03-chatgpt-day5-plan.md#4-implementation-sequence-and-interfaces). |
| Privacy and correctness | Filter vector search by authenticated `userId`, revalidate every returned source, apply retention/deletion to derived vectors, use exact queries for dates and totals, and cite the evidence. Test two-user forged IDs and prompt injection. [Approved build plan, Verification](#7-sources); [ChatGPT plan §4C and §5](../plans/2026-10-03-chatgpt-day5-plan.md#4-implementation-sequence-and-interfaces). |
| MCP security | Read-only surface, scoped identity, no write action from retrieved text, controlled egress and request logging without raw personal notes. [Day 1 full deck, p. 115](#7-sources); [agent-engineering reference:73–83](#7-sources). |
| Atlas | A second copy of IDs and vectors needs deletion parity and drift checks. Broad Atlas network access (`0.0.0.0/0`) raises exposure risk even with a scoped user; use it only after the owner accepts that choice. A credentials file was placed in the repo root on 3 October. The station never opened it; commit `73c840b` added an ignore rule. The owner moves the file out and rotates its exposed password before Atlas use. No credential or connection string belongs in this document. [Approved build plan, 3 Oct update, MW-63 and Risks](#7-sources); [.gitignore](../../.gitignore). |

## 6. Build plan and dependencies

All statuses below are **planned** at this audit snapshot. The factory station updates the issue status as each piece ships. [Approved build plan, Deliverables and Order](#7-sources).

| Issue | Planned deliverable | Status |
|---|---|---|
| MW-60 | Move the four system/ranking/admin prompt strings into versioned templates without changing their text; extend the eval trigger and reconcile report drift. | Planned |
| MW-61 | Create the Convex alert embedding index and owner-filtered search route; compute embeddings in Python; handle backfill, retention and deletion. | Planned |
| MW-62 | Add stateless read-only MCP tools, account/owner authentication and in-process chat use; cite RAG results and run isolated RAG/security evals. Depends on MW-61. | Planned |
| MW-63 | Mirror to Atlas, fail over on primary error, compare results and verify deletion parity. Last and optional before the demo cut-off; depends on MW-61/62 and owner credential actions. | Planned |
| MW-65 | Add a user-facing, editable template catalog that fills but never auto-sends a chat message. Separate follow-up from MW-60. | Planned |

## 7. Sources

- FDE **Day 1 full deck (197 pages)**, `1 Course Material/Day 1/Day 1 full deck (197 pages).pdf`, PDF pp. 105, 107–110 and 115. The nearby 82-page slides are a different edition; page numbers here refer to the 197-page file.
- FDE **Day 3 second brain and software factory**, `1 Course Material/Day 3/Day 3 second brain and software factory.pdf`, PDF p. 7 (“grep first, embeddings second”).
- FDE **Day 4 Cohort Agents Presentation**, `1 Course Material/Day 4/FDE -day 4 Cohort Agents Presentation.pdf`, PDF pp. 23–24, 27 and 30.
- FDE **Day 5 directory**, `1 Course Material/Day 5/`, empty on 3 October 2026. The demo-day interpretation and all issue descriptions are in the approved plan `~/.claude/plans/dig-deep-dive-analysis-humble-shamir.md` (Context, Update, Deliverables and Risks), approved by Daryl on 3 October.
- FDE skill reference, `3 Skills/fde-skill/references/agent-engineering.md`, lines 73–83 (MCP egress and retrieved text). These course files and the approved plan are outside this repository; paths are relative to the `FDE Course` folder unless shown as an absolute home path.
- [ChatGPT Day 5 integration plan](../plans/2026-10-03-chatgpt-day5-plan.md), checked into this repository at `73c840b`; [current code and project records](#3-project-position-on-3-october-morning) are cited where used above.
