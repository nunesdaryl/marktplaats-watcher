# Agent-first Marktplaats Watcher: can it become the go-to MCP for Marktplaats?

_Audit, 16–17 October 2026. Platform claims were read on primary pages on 16 Oct 2026 unless marked **secondary** (press or blogs only) or **unverified**. Market evidence is in [agent-market-research-2026-10.md](../marketing/references/agent-market-research-2026-10.md). Nothing was submitted, posted or signed up for._

## Verdict

**Yes, but not as "the Marktplaats search MCP".** That spot is crowded and is the part the big directories refuse:

- At least three open-source Marktplaats MCP servers exist. One is already in the official MCP Registry with a hosted endpoint.
- OpenAI's directory rejects scrapers and "unofficial connectors".

The position worth taking is **the agent's Marktplaats watcher**: an agent asks us to watch for something, and we check on a schedule, score every new listing, keep the evidence, and let the person approve anything that acts on their behalf. Nobody else offers scoring, saved watches, alert evidence and human approval together.

That position is also the safer one for Marktplaats. One shared, rate-limited check per watch replaces many agents polling search on their own. That makes it a strong line for the MW-14 conversation.

**Order:**

1. **Make `/api/mcp` connectable.** Add OAuth 2.1 with Protected Resource Metadata, tool annotations and confirm-step watch tools. This needs MW-76 (production Clerk).
2. **List it on the self-serve routes.** These are the official MCP Registry, the Grok Bot/Cursor marketplace, Claude custom connectors and a Claude/Codex plugin in our own repo marketplace, plus Smithery and the Docker catalog.
3. **Wait on the reviewed public directories.** Claude's Connectors Directory and the ChatGPT/Codex directory come after MW-14 gives us official access. Until then, the "unofficial access" limit from ADR 0009 is exactly what their policies screen for.

## What exists today

- **A remote MCP server already runs.** `mcp_server.py` serves `/api/mcp` over streamable HTTP (mounted at `main.py:106`), behind `MCP_ENABLED`.
    - It has five user tools, all read-only: `list_my_watches`, `get_watch_activity`, `get_alert_evidence`, `search_my_alerts` (RAG over past alerts) and `search_marktplaats` (live search on the public `/q/` page). There is also one owner-only diagnostic tool.
    - There are prompts for every watch template, and every result is wrapped as "data, not instructions".
    - `test_mcp.py` covers auth, user scoping, forged ids and the kill switch.
- **Auth is the blocker.** The server accepts only a Clerk session JWT or one shared owner token (`main.py:52-71`). There is no OAuth authorization server and no Protected Resource Metadata, so Claude, ChatGPT, Grok or Cursor cannot sign a user in. This was deliberately deferred on 3 October (`docs/audit/2026-10-03-prompt-templates-mcp-rag.md`). Clerk still runs as a development instance (MW-76).
- **There are no write tools.** ADR 0002 says the model proposes and the person saves. Watch creation, rating and pausing exist only in the app.
- **Guardrails partly carry over.**
    - Five watches per person, a 15-minute minimum, the €1 AI budget per person per 30 days, 40 chats a day and the founding 100 all apply.
    - The rate limit is in memory, per server instance (`main.py:185-194`), so it doesn't hold across instances.
    - MCP tool calls may not be metered against the AI budget (not verified).
- **The real exposure is ADR 0009.** Scheduled checks read `/lrp/api/search`, which robots.txt disallows, and repeated automated searching conflicts with the terms. MW-14 (official access) is the exit. Agent distribution multiplies the number of watches, which is why public listings wait for MW-14.

## Platforms and how to get in

- **Official MCP Registry**: **fit High, effort S**
    - Route in: `server.json` with `remotes`, publisher CLI; feeds aggregators
    - Auth: Namespace proof (GitHub, DNS or HTTP)
    - Listing requirements: Public server; registry still "in preview"
- **Grok Bot + Cursor marketplace** (SpaceXAI): **fit High, and early (marketplace is still small), effort S after OAuth**
    - Route in: Form at x.ai/bot/marketplace/submit-a-plugin: MCP URL or public GitHub repo; targets Grok (coming soon), Grok Bot, Cursor
    - Auth: Not specified
    - Listing requirements: Logo, testing instructions, Cursor Marketplace Publisher Terms (free to publish, may not charge for plugins, no copyleft licence)
- **Claude custom connector**: **fit High, effort S after OAuth**
    - Route in: Any user adds our URL (Free plan: one connector)
    - Auth: OAuth with DCR or CIMD
    - Listing requirements: None
- **Claude plugin** (chat, Cowork, Claude Code): **fit High, effort S–M**
    - Route in: Our own `marketplace.json` repo, or submitted through the portal
    - Auth: Inherits connector auth
    - Listing requirements: `claude plugin validate`, security scan, public repo
- **Claude Connectors Directory**: **fit High, **after MW-14**, effort M**
    - Route in: Portal; listed as "Community" after an automated scan, Verified is a separate step
    - Auth: OAuth (DCR or CIMD) + PRM + 401 with `WWW-Authenticate`; PKCE S256; lazy auth allowed
    - Listing requirements: `title` + read-only/destructive hints on every tool, privacy policy, docs, support, test account, data-handling questions (own API, partner API or third party)
- **Codex plugin**: **fit High, effort S–M**
    - Route in: `.agents/plugins/marketplace.json` in our repo; same package also feeds the shared ChatGPT/Codex directory
    - Auth: `mcp.json`: none, OAuth, mixed or API key
    - Listing requirements: None for the repo route
- **ChatGPT/Codex public directory**: **fit Medium, **after MW-14**, effort M–L**
    - Route in: Plugin ZIP through the portal after Developer Mode tests
    - Auth: None, OAuth or mixed; no static headers
    - Listing requirements: Verified identity, domain token, 4 URLs, test account, 5 positive + 3 negative test cases, video; **"no scraping without authorization", no "unofficial connectors to third-party services"**; no digital sales inside ChatGPT
- **Grok connectors / xAI API**: **fit Medium, effort S**
    - Route in: grok.com/connectors, Custom → MCP URL; API `type: mcp` tool
    - Auth: Not specified / headers
    - Listing requirements: None
- **Meta Muse**: **fit Low until it reaches the EU, effort S**
    - Route in: Custom connector by MCP URL (**secondary**)
    - Auth: Unverified
    - Listing requirements: No partner programme verified; reported **US and Canada only** (**secondary**)
- **Smithery, Docker MCP Catalog**: **fit Medium, effort S**
    - Route in: URL at smithery.ai/new; PR to docker/mcp-registry
    - Auth: OAuth via CIMD / OAuth yes or no
    - Listing requirements: Server card if scan is blocked; permissive licence
- **Glama, PulseMCP, mcp.so, mcpservers.org**: **fit Medium, effort S**
    - Route in: Submit pages; likely ingest the official registry (inference)
    - Auth: —
    - Listing requirements: Unverified
- Gemini CLI, Copilot Studio, Windows agent registry, Perplexity: **fit Low, effort S–M**
    - Route in: GitHub topic / tenant connector / `odr.exe` / custom connector (**secondary**)
    - Auth: —
    - Listing requirements: Unverified

Primary sources (all accessed 16 Oct 2026): claude.com/docs/connectors/building/submission; claude.com/docs/plugins/submit; developers.openai.com/apps-sdk/deploy/submission and /app-submission-guidelines; developers.openai.com/codex/plugins/build; docs.x.ai/grok/connectors; docs.x.ai/developers/tools/remote-mcp; x.ai/news/grok-bot-more-plans; x.ai/bot/marketplace/submit-a-plugin; cursor.com/marketplace-publisher-terms; about.fb.com/news/2026/10/introducing-muse-wonder-models; modelcontextprotocol.io/registry/about; modelcontextprotocol.io/specification/2026-07-28/changelog; smithery.ai/docs/build/publish; github.com/docker/mcp-registry (CONTRIBUTING.md).

**Still unverified:**
- ChatGPT Apps availability in the EEA.
- Grok Bot availability in the EU.
- Meta Muse connector programme details.
- The VS Code gallery and Windsurf.
- Whether Marktplaats or Adevinta have announced their own AI assistant or API (none found).

## The MCP spec moved on 28 July 2026

The current version is **2026-07-28**. Before listing, the server needs these changes:

- **Stateless protocol.** The `initialize` handshake and session id are gone, version travels in `_meta`, and `tools/list` needs `ttlMs`/`cacheScope`. Our server is already stateless, but the SDK version must be checked.
- **Client registration.** Dynamic Client Registration is deprecated in favour of **Client ID Metadata Documents (CIMD)**. Claude and Smithery already use CIMD.
- **OAuth basics.** PRM (RFC 9728), PKCE S256 and `iss` validation (RFC 9207) are the baseline.
- **Tool annotations.** `readOnlyHint`/`destructiveHint`, plus `openWorldHint` for OpenAI, are effectively required by both big directories.
- **Elicitation changed.** It now runs through multi-round-trip requests, and support differs per client. A confirm link that opens our app keeps working everywhere and keeps the person's approval inside our own UI, as ADR 0002 requires.

## Competitors

- `jasp-nerd/marktplaats-mcp`: Python MCP for Marktplaats and 2dehands. Hosted read-only endpoint plus stdio, setup docs for about 40 clients. **In the official MCP Registry since 15 Jul.**
    - Reach (16 Oct): 4 stars; 241 PyPI downloads a month; updated 14 Oct
    - How it differs from us: Search only, no scoring or watches. Its account tools send messages and binding bids with the person's **browser session cookie**, kept on their own machine (local stdio only; the hosted endpoint refuses cookies) and confirmed by a flag the model sets. We hold no Marktplaats credentials at all. Details in the [deep dive](2026-10-17-marktplaats-mcp-deep-dive.md).
- `PonClick/marktplaats-mcp`: stdio search, filters, details, seller info
    - Reach (16 Oct): 19 stars; updated 7 Oct
    - How it differs from us: Local, search only
- `marktplaats-py`: Python wrapper for the unofficial API, probably what the above build on (inference)
    - Reach (16 Oct): 74 stars; 1,788 PyPI downloads a month
    - How it differs from us: A library, not a product
- Alert bots (e.g. `marktplaats-alert-bot`, `mrktpltsbot`): Poll, then push to Telegram or Discord
    - Reach (16 Oct): Up to 21 stars
    - How it differs from us: Keyword alerts, no scoring
- Apify Marktplaats scrapers (one exposes an MCP endpoint): Pay per result (around $1 per 1,000)
    - Reach (16 Oct): Usage not verified
    - How it differs from us: Raw data for developers
- **Meta Muse on Facebook Marketplace**: A consumer agent that already buys and sells on a classifieds site
    - Reach (16 Oct): Mass market in the US (secondary)
    - How it differs from us: Acts on its own. Viral September/October posts show it shared a seller's address and accepted a lowball offer without asking.

Our difference holds up: **scored, explained, watched, human-approved**. The Muse incidents are the clearest public argument for our approval model, and they belong in the pitch to Marktplaats.

## Risks

1. **Terms and robots (ADR 0009).** More agent users means more watches on a disallowed route. Mitigations:
   - Keep the five-watch and 15-minute limits per person, whatever client they come from.
   - Make the rate limit hold across instances and enforce it in Convex.
   - Keep live search on the allowed `/q/` route.
   - List publicly only after MW-14.
   - Keep the kill switch (`MCP_ENABLED`).
2. **Directory policy.** OpenAI's no-scraping and no-unofficial-connector rules, and Anthropic's "verify that you own or control any API endpoint" rule. Lead every listing with the person's own watches and alerts (our data); live search is secondary.
3. **Cost.** Agents call tools in loops. Every MCP call must count against the person's €1 budget and the 40-a-day limit, attributed per client, so a runaway loop costs at most one person's budget.
4. **Prompt injection.** Listing text is written by strangers. Keep wrapping results as data and keep tools free of side effects. Any write goes through a confirm link the person opens in our app, never straight from the agent.
5. **Safety of the person.** Never expose addresses, never send messages or bids from our servers, and keep bid hand-off in the person's own browser. This is our deliberate contrast with the Muse incidents.
6. **Capacity.** Agent sign-ups count toward the founding 100 and the same AI budget; there is no separate free tier for agents.
7. **Publisher terms.** Cursor's terms forbid charging for plugins and copyleft licences. ChatGPT forbids selling digital subscriptions inside ChatGPT. Monetisation stays on our own site.

## Recommended next steps

Draft factory specs, filed 16 Oct 2026 as `draft` on MW and waiting for Daryl's Agent Ready:

1. **MW-148** OAuth 2.1 for `/api/mcp`: PRM, 401 challenge, CIMD with DCR fallback, lazy auth for public tools. Depends on MW-76.
2. **MW-149** Spec 2026-07-28 compatibility: tool titles and annotations, output schemas, `ttlMs`, and a server card.
3. **MW-150** Agent watch tools behind a confirm step: propose, pause, resume and rate, with a confirm link that opens our app.
4. **MW-151** A rate limit shared across server instances, MCP metering against the AI budget, and per-client attribution on the dashboard.
5. **MW-152** Distribution package: `server.json` for the official registry, Claude and Codex plugin manifests with a Marktplaats skill, and an `/agents` page with setup steps per client.
6. **MW-153** Directory submissions, which are Daryl's to do (human-ready):
   - **Now:** the registry, Grok Bot/Cursor, Smithery and Docker.
   - **After MW-14:** the Claude Connectors Directory and the ChatGPT/Codex directory.

**Not now:** paid agent tiers, a Meta Muse listing (no EU availability), or any send, bid or message tool on our servers.
