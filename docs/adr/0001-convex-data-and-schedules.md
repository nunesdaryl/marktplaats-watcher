# 0001: Convex for data and schedules

## Context
Saved watches need persistent data, realtime UI updates and scheduled checks. The Python agent already owns search and model prompts. [Design §12](../system-design.html).

## Decision
Convex stores app data and runs schedules; Python keeps scraping and model work.

## Alternatives
Keep the data and scheduler with the Python server, or move search and prompts into Convex. The design records no separate evaluation of these options.

## Trade-offs
Convex provides realtime updates and crons without a persistent app server, at the cost of deploying two runtimes.

## Consequences
Deploy Convex functions before UI changes that depend on them. [Deployment guide](../../DEPLOY-VERCEL.md).

## Status
Accepted

## Date
2026-09-27
