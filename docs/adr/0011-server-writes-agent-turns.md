# 0011: Server writes agent turns

## Context
Saved chats need the actual agent answer. A browser could forge an answer if it wrote both sides of a conversation. [Design §12](../system-design.html); MW-11.

## Decision
The browser writes only the user's turns. After verifying the Clerk session token, the chat API writes agent turns through the shared-secret Convex route.

## Alternatives
Let the browser write both user and agent turns. This would let the client claim arbitrary agent output.

## Trade-offs
Chat persistence depends on the Python-to-Convex channel.

## Consequences
The assistant-turn route checks `X-Api-Secret` and appends the server's turn to the chat. [ADR 0010](0010-api-to-convex-channel.md).

## Status
Accepted

## Date
2026-09-30
