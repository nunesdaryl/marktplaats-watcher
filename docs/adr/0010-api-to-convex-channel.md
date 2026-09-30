# 0010: Shared-secret Python to Convex channel

## Context
The verified Python API must send usage decisions, assistant turns and errors to Convex without treating the browser as a trusted writer. [Deployment guide §2](../../DEPLOY-VERCEL.md); MW-4, MW-11 and MW-6.

## Decision
Use Convex HTTP routes authenticated with `X-Api-Secret`, matching `API_TO_CONVEX_SECRET` in Vercel and Convex, for usage, assistant turns and error records.

## Alternatives
Browser-originated writes would put server facts under client control. The merged issues do not record a comparison with another server transport.

## Trade-offs
The two deployments must share and rotate the secret; the API also needs `CONVEX_SITE_URL`.

## Consequences
The Convex routes reject missing or wrong secrets. The secret is separate from `CRON_SECRET`. [Runbook §1](../../RUNBOOK.md).

## Status
Accepted

## Date
2026-09-30
