# 0006: E-mail alerts only

## Context
The demo needs to notify users of scored new listings. AgentMail already supplies the sender and the product groups matches into one e-mail per check. [Design §12 and §17](../system-design.html).

## Decision
Use e-mail as the only alert channel in this version.

## Alternatives
Telegram, Discord and WhatsApp are recorded as later channels in design §12.

## Trade-offs
No push or messaging-app delivery. AgentMail's shared domain avoids DNS work for the demo but a custom domain may improve deliverability later.

## Consequences
The runbook covers e-mail retries and failed delivery; users need an e-mail address in their Clerk session. [Runbook §5](../../RUNBOOK.md).

## Status
Accepted

## Date
2026-09-27
