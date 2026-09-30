# 0013: Prompt versions and evaluation gate

## Context
Model behavior changes can silently alter watch proposals and alert precision. Judge labels were human spot-checked and corrected, and a chat case had intermittent failures. [Evaluation report](../../evals/report.md); MW-5 and MW-16.

## Decision
Record chat and ranker prompt versions. Gate relevant changes on at least 19 of 20 chat cases and at least 90% precision for great matches, using human-corrected labels. Run evaluations weekly in CI and skip when no model key is available.

## Alternatives
Rely only on a model judge or one manual demo. The report records three judge-label overrides and a flaky chat case.

## Trade-offs
The gate uses a small labelled set and a live model key; a skipped run supplies no new model evidence.

## Consequences
Rerun after prompt, model or tool changes; keep prompt versions and UAT sign-off in the report. [README evaluation](../../README.md).

## Status
Accepted

## Date
2026-09-30
