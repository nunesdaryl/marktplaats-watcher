# 0007: Vercel Hobby for the portfolio phase

## Context
The public portfolio app needs a URL for its static UI and Python API, with no fixed hosting spend in the current phase. [Deployment guide](../../DEPLOY-VERCEL.md); [cost report §4](../../evals/report.md).

## Decision
Run the UI and Python API on Vercel Hobby during the portfolio phase.

## Alternatives
Docker is documented as a way to run the app elsewhere. The sources do not record a paid-host comparison.

## Trade-offs
Hosting currently uses free tiers; this is a portfolio setup, not a measured commercial capacity plan.

## Consequences
The Python function has `maxDuration` 300 seconds. Reassess hosting before commercial use. [Design §10 and §13](../system-design.html).

## Status
Accepted

## Date
2026-09-29
