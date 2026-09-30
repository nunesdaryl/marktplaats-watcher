# 0005: One 15-minute dispatcher with leeway

## Context
Users choose different watch schedules. Checks ending just after a cron tick caused some 15-minute watches to run only every other tick. [Design §12](../system-design.html).

## Decision
Run one Convex dispatcher every 15 minutes, taking watches due now or within the next two minutes according to each watch's `nextRunAt`.

## Alternatives
Use per-watch cron jobs or take only watches already due. The latter produced empty alternating runs.

## Trade-offs
Daily or weekly checks may run up to two minutes early.

## Consequences
The shortest watch interval is 15 minutes. The production 12:34 run checked four watches where the earlier logic would have checked zero. [Runbook §5](../../RUNBOOK.md).

## Status
Accepted

## Date
2026-09-29
