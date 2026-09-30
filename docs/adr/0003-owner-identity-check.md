# 0003: Check the owner's Clerk id and e-mail

## Context
The owner dashboard exposes account and operational records. An e-mail or id alone should not grant its access. [Runbook §9](../../RUNBOOK.md).

## Decision
Require the signed-in account to match both `OWNER_CLERK_ID` and `OWNER_EMAIL` in Convex before serving the dashboard.

## Alternatives
Check only one identifier. The recorded design does not document a wider comparison.

## Trade-offs
Both values must be configured and updated when moving Clerk instances.

## Consequences
If either value is absent or different, nobody can open `/admin`; its code is downloaded only after the server confirms ownership. [Deployment guide](../../DEPLOY-VERCEL.md).

## Status
Accepted

## Date
2026-09-29
