# 0014: Check idempotency and resume at the next dispatcher tick

## Context
The 15-minute dispatcher may lose a worker after claiming a watch or after recording results. A check has no mid-run checkpoint. [ADR 0005](0005-fifteen-minute-dispatcher.md) defines the cadence.

## Decision
Claimed watches have a 30-minute lease. If a worker dies before recording results, a later dispatcher tick claims the watch again and re-reads and re-ranks unsent listings. Recording uses the watch and listing id in `seenListings` to create an alert once. It advances the watch only after recording the result. Failed e-mail sends remain on the alert and are claimed at the next checks, up to four attempts; a sent alert is not claimed again. Scheduled search reads keep exactly one retry (jittered backoff), as before this ADR, so a check never sends more requests to Marktplaats than it used to; anything longer waits for the next tick.

“Resume” means a new check after the lease or retry window, not continuation from a model or page checkpoint. The full check may re-read pages and re-rank listings; persistence and deduplication make recording idempotent.

## Alternatives
Persist a mid-run checkpoint or retry the search immediately. Both add complexity or request volume without changing the alert deduplication requirement.

## Trade-offs
Recovery can take 30 minutes. If AgentMail accepted an e-mail but its response was lost, a later retry can deliver it twice; Convex cannot prove delivery from that ambiguous response.

## Consequences
The kill switch pauses new checks; turning it off lets later ticks claim due watches. The [runbook drill](../../RUNBOOK.md#stop-and-resume-drill-2026-10-09) and checker tests exercise lease expiry and deduplication.

## Status
Accepted

## Date
2026-10-09
