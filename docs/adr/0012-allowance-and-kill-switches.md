# 0012: Daily chat allowance and separate kill switches

## Context
The public app uses a capped OpenAI project and needs controls when chat or scheduled checks cause cost or operational problems. [Runbook §1 and §3](../../RUNBOOK.md); MW-4.

## Decision
Allow 40 chat questions per user per Europe/Amsterdam day by default, with the owner exempt but counted. If the Convex usage check is unavailable, chat fails open and logs `usage_check_failed`. `CHAT_PAUSED=1` pauses chat; `CHECKS_PAUSED=1` pauses scheduled checks.

## Alternatives
Per-instance limits were looser across instances. Failing closed on a usage outage would deny otherwise available chat.

## Trade-offs
Fail-open chat may spend beyond the allowance during a Convex outage. The two switches need separate operational changes.

## Consequences
`CHAT_DAILY_LIMIT` can change the allowance. Chat pause needs a Vercel redeploy; check pause takes effect at the next 15-minute tick. [Runbook §1](../../RUNBOOK.md).

## Status
Accepted

## Date
2026-09-30
