# ADR 0015: Provider selection and model-swap evaluation

## Context

Chat, ranking, and the eval judge were constructed as OpenAI clients. A provider change needs comparable evidence on the frozen golden sets and an explicit cost and latency record.

## Decision

Construct chat, rank, and judge clients through `model_config.chat_model`. The default path constructs `ChatOpenAI` with the original options. The `anthropic` path imports `ChatAnthropic` only when selected. `MODEL_PROVIDER` defaults to `openai`; `OPENAI_MODEL` remains the chat and rank model name, and `JUDGE_MODEL` defaults to `gpt-5.5`. Keep OpenAI embeddings and existing token, timeout, retry, and user-budget limits. A second-provider eval requires that provider's SDK and environment key plus input and output USD-per-million-token prices when the model is absent from `evals/common.py`.

Production `requirements.txt` keeps the original pins and supports OpenAI only. Install `requirements-evals.txt` for an Anthropic eval; it adds `langchain-anthropic==1.7.4`, whose package metadata accepts `langchain-core==1.6.5`. The newer 1.7.5 requires core 1.6.6 or later. An Anthropic production deployment requires the operator to deliberately add its package to production requirements.

To assess a swap, freeze the same labelled scorer and chat golden sets, run the default scorer three times and chat once, then run the second provider with `--provider` and `--model` on both scripts. The second provider writes suffixed result files so the default evidence stays intact. Generate `evals/report.md` and compare corrected scorer precision and recall, chat pass rates by stratum, cost per query, and latency. Run `python -m evals.gate` against the default files. Do not promote a second provider from an unreviewed comparison.

| Call | Reasoning level | Rationale |
|---|---|---|
| Production chat | Provider default | Existing latency and budget caps stay in force. |
| Production ranking | Provider default | Existing short timeout and one retry stay in force. |
| Label judge | Provider default | Judge is used only for frozen eval labelling. |
| RAG judge | Provider default | Keep the existing deterministic temperature setting. |

The per-call reasoning level is recorded here as provider default because these paths do not currently set an explicit reasoning effort. A future swap can vary it deliberately, then rerun the same evaluation.

## Alternatives

Keep separate provider-specific constructors in each call site; this would make the comparison drift between chat, rank, and judge.

## Trade-offs

The optional provider SDK increases eval dependencies only. Unknown model prices must be supplied before a cost-bearing eval can run. A fake-model test proves routing and result metadata, not the second provider's quality.

## Consequences

Normal CI evaluates OpenAI only. A manually dispatched run can name Anthropic and a model after the operator supplies its key and prices. The report marks the comparison not yet run until both second-provider result files exist.

## Status

Accepted

## Date

2026-10-09
