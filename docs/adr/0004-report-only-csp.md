# 0004: Start with report-only CSP

## Context
The static export needs inline scripts, and sign-in and image sources must be checked before a blocking policy can be trusted. [Design §13](../system-design.html).

## Decision
Serve `Content-Security-Policy-Report-Only` and log violations as `csp_violation`.

## Alternatives
Enforce CSP immediately. An untested policy could break sign-in or photos.

## Trade-offs
Report-only mode observes violations but blocks none.

## Consequences
After a private-window sign-in shows no violations, change the header to enforcing CSP; revert if sign-in breaks. [Runbook §7](../../RUNBOOK.md).

## Status
Accepted

## Date
2026-09-29
