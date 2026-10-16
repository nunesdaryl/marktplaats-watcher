# ADR 0016: External agents may write watches directly, with an Undo e-mail

## Context
ADR 0002 makes the person save every watch the chat proposes. For external agents connected over MCP (Claude, ChatGPT/Codex, Grok, Cursor and others; see `docs/audit/2026-10-17-agent-first-mcp.md`), a confirm link that opens our app breaks the agent's flow. It is the main thing between us and an "agent-first" experience.

A watch write is low risk:
- It spends at most the person's own AI budget.
- It sends e-mail only to the person.
- It stays inside the existing limits (five watches per person, 15-minute minimum).
- It can be reversed.

Actions that spend money or contact someone else are different. The Meta Muse Facebook Marketplace incidents (Sept–Oct 2026: an agent shared a seller's address and accepted a lowball price) show what happens when an agent acts on those without asking.

## Decision
For external agents signed in over MCP, and only for the person's own watches and alerts:

- **Allowed directly, without a confirm step:**
  - create a watch
  - change its query, filters, schedule or alert level
  - pause or resume it
  - archive it
  - rate an alert
- **Every agent write:**
  - goes through the same Convex mutations and limits as the app;
  - is recorded with the agent client's name;
  - sends the person an e-mail saying what changed, with a one-tap **Undo** that restores the previous state (valid 7 days).
- **Per-person cap:** at most 20 agent writes a day.
- **Still never allowed for agents:**
  - permanent deletion
  - anything that sends a message, places a bid or buys
  - anything that shares personal data
  - anything that acts on a Marktplaats account

  Bid and message help stays a prepared action the person performs.
- **The in-app chat is unchanged:** ADR 0002 still applies there, because the person is already on the page to press Save.

This supersedes ADR 0002 for external MCP clients only. It takes effect when the factory issue implementing it (MW-150) merges.

## Alternatives
- **Keep ADR 0002 for agents (a confirm link per write).** Safest, but every agent write needs a context switch to our app.
- **MCP elicitation (the client asks the person in-line).** Support differs per client under spec 2026-07-28, and the approval would happen in someone else's interface.
- **Allow all writes, including deletion.** Saves little and makes mistakes permanent.

## Trade-offs
A wrong or injected agent request can create or change a watch before the person sees it. The damage is bounded:
- at most the person's AI budget and some unwanted alert e-mails;
- the five-watch limit and the daily write cap;
- one-tap Undo.

The extra e-mails could feel noisy, so they are short and only sent for agent writes.

## Consequences
- MCP gains write tools annotated `destructiveHint: false`; archive is reversible.
- The dashboard can show agent writes and undo rates per client.
- If the undo rate for a client is high, its write access can be switched off without affecting reads.

## Status
Accepted by the operator (Daryl, in chat, 2026-10-16), effective when MW-150 merges. Supersedes [ADR 0002](0002-user-confirms-chat-proposals.md) for external MCP clients only.

## Date
2026-10-16
