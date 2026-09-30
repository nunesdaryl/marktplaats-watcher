# Architecture decision records

The quality attributes guiding these decisions are **security** (keep writes and owner data behind verified identity), **cost** (bound model work and operate within the portfolio budget), and **observability** (make failed checks and chat turns traceable).

| ADR | Decision |
|---|---|
| [0001](0001-convex-data-and-schedules.md) | Convex holds data and runs schedules; Python keeps search and model work. |
| [0002](0002-user-confirms-chat-proposals.md) | Chat proposes watch writes; the user saves them. |
| [0003](0003-owner-identity-check.md) | Owner access requires both Clerk id and e-mail. |
| [0004](0004-report-only-csp.md) | Keep CSP report-only until sign-in is checked cleanly. |
| [0005](0005-fifteen-minute-dispatcher.md) | One dispatcher runs every 15 minutes with two minutes of leeway. |
| [0006](0006-email-alerts.md) | E-mail is the only alert channel for this version. |
| [0007](0007-vercel-hobby.md) | Use Vercel Hobby during the portfolio phase. |
| [0008](0008-clerk-development-instance.md) | Keep Clerk's development instance through the demo. |
| [0009](0009-filtered-date-sorted-search.md) | Checks use filtered, date-sorted search with a by-day watermark. |
| [0010](0010-api-to-convex-channel.md) | Python uses shared-secret Convex HTTP routes for server writes. |
| [0011](0011-server-writes-agent-turns.md) | The server writes agent turns; the browser writes user turns. |
| [0012](0012-allowance-and-kill-switches.md) | Bound daily chat use and provide separate chat and check switches. |
| [0013](0013-prompt-versions-and-eval-gate.md) | Version prompts and gate changes with corrected evaluations. |

## Add a decision

Add the next numbered Markdown file with Context, Decision, Alternatives, Trade-offs, Consequences, Status, and Date. Link it here. Once accepted, **supersede, never edit** an ADR: write a new record and point to the older decision.
