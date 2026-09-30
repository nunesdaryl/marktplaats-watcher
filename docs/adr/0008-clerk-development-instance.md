# 0008: Keep Clerk development through the demo

## Context
The app still shows Clerk's Development mode line. Production Clerk needs a purchased domain, DNS, an OAuth client and a user-account transition. [Deployment guide §5](../../DEPLOY-VERCEL.md).

## Decision
Keep the development instance until after the 3 October demo.

## Alternatives
Switch to production before the demo; that requires the documented domain and identity migration work.

## Trade-offs
The sign-in UI continues to show Development mode during the demo.

## Consequences
When migrating, switch keys and issuer together, re-link existing Convex users by e-mail, and update `OWNER_CLERK_ID`. [Deployment guide §5](../../DEPLOY-VERCEL.md).

## Status
Accepted

## Date
2026-09-29
