# The existing Marktplaats MCP servers: what to learn, what to reuse, and why not cookie login

_Deep dive, 16–17 October 2026. Their code was read on GitHub and none of it was run. Marktplaats' terms (in force 22 July 2026) and robots.txt were read on 16 Oct 2026. Follows the [agent-first audit](2026-10-17-agent-first-mcp.md). This is not legal advice._

## Summary

- **The leader is `jasp-nerd/marktplaats-mcp`.**
  - MIT licence; 4 stars; 241 PyPI downloads a month.
  - Listed in the official MCP Registry since 15 July.
  - Hosted read-only endpoint in Germany (Hetzner).
  - Well engineered: about 167 tests, a daily live canary, structured outputs, setup docs for 40 clients in English, Dutch and French.
  - It is a **search toolkit**: no stored watches, no schedules, no notifications, no AI scoring.
- **Its cookie login is local only.** The hosted server refuses to start when a cookie is configured. On the user's own machine, a CLI pulls the `MpSession` cookie out of the browser and stores it as plain JSON. The agent can then message sellers and place binding bids. The "confirm" step is a parameter the model sets itself.
- **We should not follow it**, for four reasons:
  - Marktplaats' terms forbid giving login details to third parties (art. 5.2).
  - Holding sessions would turn our server into a store of keys to every connected account.
  - It would cost us the "official way" pitch to Marktplaats.
  - For a hosted, scheduled product the cookie would have to live on our servers, which is the worst version.
- **Better routes, in order:**
  1. Prepared actions: a drafted message and bid plus the listing link, which the person (or their own browser agent) sends. Available now.
  2. A Chrome extension that fills the form in the person's own tab while they press Send.
  3. Official OAuth through a Marktplaats partnership. This is MW-14, and Marktplaats would first have to build buyer-side scopes.
- **The same terms reach our own checks.** All of these servers, and our scheduled checks too, read `/lrp/api/search`. robots.txt disallows it, and art. 7.3 of the terms forbids "repeated and systematic" querying of the ad database. ADR 0009 already records this risk for our scheduled checks, and MW-14 is the way out.

## 1. Who is out there

- **jasp-nerd/marktplaats-mcp**
    - What it is: 8 read tools (search, details, seller profile, seller listings, categories, category filters, `check_new_listings`, `analyze_prices`), 2 prompts, category resources. Marktplaats and 2dehands.
    - Login: Optional, **local stdio only**: cookie pulled from the browser (rookiepy), a Playwright login window, or pasted by hand
    - Notes: 12 account tools: 7 reads, 5 writes including `place_bid` and `send_message`
- PonClick/marktplaats-mcp
    - What it is: 5 read tools, stdio
    - Login: None
    - Notes: 19 stars, no rate limiting
- RT-codes/marktplaats-mcp
    - What it is: 5 read tools, Marktplaats and 2dehands
    - Login: None now. Earlier code used a Playwright login with stored cookies for read-only account data (removed 15 Sep; the files are still in the repo).
    - Notes: 1 star
- Apify `marktplaats-netherlands-classifieds`
    - What it is: Paid scraper (up to 5,000 items), reachable through Apify's MCP
    - Login: None ("no login cookies")
    - Notes: 2 users; 20+ similar Marktplaats scrapers on Apify
- jensjeflensje/marktplaats-py
    - What it is: Python library the others learned from
    - Login: None
    - Notes: 74 stars; MIT

None of them mention Marktplaats Watcher. jasp-nerd's comparison page claims it is the only one with a hosted endpoint, a registry listing, account tools and monitoring.

## 2. Similarities

- **The same data source.** All of them, including our scheduled checks, read the internal `/lrp/api/search` with a browser-like User-Agent. Our chat search uses the allowed `/q/` page.
- **The same core filters.** Category, price, postcode distance, newest first, and filtering out paid placements.
- **The same MCP style.** A remote streamable-HTTP endpoint, host and origin allow-lists, and listing text treated as untrusted data.
- **Distribution.** Registry `server.json`, PyPI or hosted URL, per-client setup docs, Dutch-language pages.

## 3. Differences

| | jasp-nerd | Marktplaats Watcher |
|---|---|---|
| Core job | Search toolkit the agent drives | A service that watches on a schedule, scores every listing and keeps the evidence |
| "Monitoring" | `check_new_listings` with a cursor the agent must store and call again; no state, no alerts | Saved watches, 15-minute minimum, e-mail alerts, catch-ups, daily delivery audit |
| Judgement | Price statistics (median, quartiles); any ranking is improvised by the agent | AI score 0–10 with a one-line reason, rated by people, measured in `evals/report.md` |
| Identity | Hosted endpoint has **no auth**; per-IP rate limits | Per-person sign-in, founding places, five watches per person, €1 AI budget |
| Acting for the person | Agent sends messages and binding bids with the person's cookie; "confirm" is a model-set flag | Draft the bid message, copy it, open the listing; the person sends (MW-114) |
| Credentials | `MpSession` cookie in plaintext `~/.config/marktplaats-mcp/session.json` (mode 0600), no keychain, no refresh | We never hold Marktplaats credentials |
| Engineering evidence | ruff, mypy strict, about 167 tests, daily live canary opening a GitHub issue on failure | Full test suites, eval gate, merge gate with production checks, owner dashboard |
| Reach | Registry listing since July, 40 client guides, EN/NL/FR, `llms.txt`, JSON-LD FAQ | Not listed yet (MW-148 to MW-153) |

**Our position:** they are the agent's hands on Marktplaats search; we are its eyes on Marktplaats over time, with judgement. The two complement each other more than they compete, and a later partnership or cross-link is plausible.

## 4. What we can learn and reuse

The code is MIT, so copying code means keeping their copyright line and the MIT text in a `THIRD_PARTY_NOTICES.md`. The category data comes from marktplaats-py (also MIT), so both credits go with it. Facts about how the API behaves are not copyrightable; we can use them freely and check them against our own code.

**API behaviour to verify in our checker** (`agent.py` `fetch_search` / `read_since`):
1. `l2CategoryIds[]` must be plural; the singular is silently ignored.
2. `offset` is rounded down to a multiple of `limit`.
3. Date-sorted pages are padded with paid placements (57 of the first 100 for one query). Fetch 100-row pages and stop when rows repeat.
4. `priorityProduct` marks promotions, and ids starting with `a` are business ads (Admarkt). This is useful for our shop signal (MW-136).
5. Condition ids differ per category (used car 14049, used bike 32); resolve them from the category filters rather than hard-coding.
6. The app endpoint `app.marktplaats.nl/app/vip/v4/item/{id}` gives the exact start time, status and minimum bid. This is also internal; we would only use it after MW-14.

**Patterns worth adopting:**
- **Category filters from plain words** (their `facets.py`, about 150 lines): map "under 50,000 km" or "diesel" to filter ids. This could make our watches more precise from plain-English requests. It would be a factory spec, re-implemented or credited.
- **Monthly category refresh workflow** (opens a pull request after tests pass).
- **Daily live canary**: every tool runs against the live site and opens an issue on failure. Our closest thing is the dashboard canary; a CI version would catch breaking changes in the Marktplaats response shape before users notice.
- **MCP surface:** an output schema on every tool, a clear split between read and binding tools, a preview receipt before any write ("Nothing was sent. Show this to the user"), prompts for common jobs, and the category tree as an MCP resource. This feeds MW-149 and MW-150.
- **Hosted hardening:** a global outbound request gate (minimum gap between Marktplaats calls across all users), Retry-After handling, a short page cache, and rate limits keyed on the real client IP.
- **Distribution playbook** for MW-152:
  - `server.json` with icons on our own domain
  - the `mcp-name:` README marker
  - an OIDC release job that publishes to the registry
  - `/llms.txt` and a JSON-LD FAQ answering "is there an MCP server for Marktplaats?"
  - one setup guide per client, in EN and NL
- **Their weak spots, so we don't repeat them:**
  - `get_conversation` is labelled read-only but marks messages as read.
  - The security policy still says "no credentials" after account mode was added.
  - The bid confirmation is up to the model.
  - The full text of every message sent is kept in a local log.

## 5. Why not follow the cookie login

**What it is.** A session cookie (`MpSession`) is a bearer key: whoever holds it *is* the person on Marktplaats, including for messages, bids and personal data. 2FA does not help, because the session is already signed in. jasp-nerd keeps it on the user's own disk. A hosted, scheduled service like ours would have to keep it on our servers.

**Why we don't:**
1. **Terms.** Art. 5.2: "Het is niet toegestaan voor Gebruikers om hun inloggegevens aan derden te verstrekken" (users may not give their login details to third parties). Art. 7.3 forbids repeated, systematic querying of the database. robots.txt disallows `/messages*`, `/asq`, `/bid/` and the login pages. A ban lands on our user, not on us.
2. **Security.** A breach of our server would mean takeover of every connected account at once.
3. **GDPR.** We would become controller for everything the session can reach, including sellers' messages (third parties). That brings security and breach duties and a likely DPIA.
4. **Criminal law.** Dutch computer-intrusion law (art. 138ab Sr) covers using a "false key". Courts have treated legitimately obtained credentials used outside their permitted purpose as one, and the user's consent may not cure it when the platform forbids the sharing. The exposure is uncertain, but not zero.
5. **The pitch.** Our MW-14 ask is official, delegated access. Doing it unofficially first would undercut that conversation. eBay banned "buy-for-me" agents in its user agreement in January 2026, so platforms are moving against this pattern.
6. **The person's safety.** The Meta Muse incidents (an agent shared a seller's address and accepted a lowball offer) are what happens when an agent holds the account and decides on its own.

**What the local-only version shows.** jasp-nerd's design is the least-bad cookie design: the cookie stays local, the hosted endpoint is credential-free, and binding bids get a preview first. It still replays the cookie outside the browser (a bot fingerprint, arguably against art. 5.2), stores it in plain text, leaves confirmation to the model, and only works for technical desktop users. It cannot power a hosted, scheduled product.

## 6. Login and action options

| Option | Who holds credentials | Terms risk | Security risk | UX | Effort | Available |
|---|---|---|---|---|---|---|
| Server-held session cookie | Our server | High | High (mass takeover, GDPR) | Best | Medium | **Rejected** |
| Local stdio MCP with cookie (jasp-nerd model) | User's disk | Medium | Medium (local malware, plaintext) | Poor for non-technical users | Low–medium | Yes; not for our hosted product |
| **(c) Prepared action: draft + clipboard + listing link** | The person | None | None | Paste and send (two or three steps) | Very low (MW-114 already does this in the app) | **Now** |
| **(b) Prepared action for the person's own browser agent** (Claude in Chrome, ChatGPT Atlas, Comet, Grok Bot browser) | The person's browser | Low–medium | Medium (that vendor's confirmation step) | Good, varies by agent | Low | **Now**, through MCP |
| **(a) Chrome extension filling the form in the person's tab; the person presses Send** | The person's browser | Low | Low | One click | Medium (1–2 weeks plus store review); breaks when Marktplaats changes its page | Agreed on 9 Oct, not built |
| E-mail relay of Marktplaats notifications | The person's mailbox | Low | Medium (mailbox data) | Read-only | Medium | Alerts only; cannot bid |
| **(d) Official OAuth via partnership (MW-14)** | Marktplaats, scoped and revocable | None | Low | Best | High | No. The 2019 API is for sellers: OAuth 2.0 with partner credentials, but **no place-bid endpoint and no buyer messaging**. Marktplaats would have to add both. |
| Passkeys | The authenticator | — | — | — | — | Not a delegation method: tied to marktplaats.nl, and they still produce an ordinary session |

The 2019 official API and the 2026 terms fit together. Marktplaats only lets third parties act for sellers (ad placement, art. 7.4/7.5, "API partners"). There is no buyer-side delegation yet. Our MW-14 ask should therefore be specific: **read search access, plus buyer-side scoped OAuth for bids and messages that the person approves on Marktplaats' own consent screen.**

## 7. Recommendations

1. **Keep the rule:** never hold Marktplaats credentials. Say so publicly on the `/agents` page and in the directory listings; it is our sharpest difference.
2. **Add "prepared actions" to MW-150.** For any listing, the MCP returns a drafted message, a suggested bid (never above the watch maximum), the listing link and a preview receipt. The person or their own browser agent performs it, and nothing is sent from our side.
3. **Spec the API checks** (§4, points 1–5) and a daily live canary in CI, as a factory draft.
4. **Spec "filters from plain words"** using category filters, re-implemented or credited, as a factory draft. Filed as MW-156.
5. **Build the Chrome extension later**, after users ask for faster bidding. Measure "Bid hand-offs" on the dashboard first (3 in 30 days so far).
6. **Sharpen the MW-14 ask** to the two scopes in §6, and cite the official API's missing buyer endpoints.
7. **Don't attack the competitor.** Link to their search tools as complementary if useful; never compare in public without dated facts.

_Filed 16 Oct 2026 after Daryl's go: item 2 as MW-154 (prepared offer over MCP), item 3 as MW-155 (search behaviour tests and a daily live canary), item 4 as MW-156 (category filters from plain words), all drafts. Item 6 is recorded on MW-14 and in pitch pack §4. **Shipped 17 Oct 2026:** MW-155 (with the MW-158 fix) and MW-156 are live; MW-154 waits for MW-148 and MW-149._

Sources (accessed 16 Oct 2026): github.com/jasp-nerd/marktplaats-mcp (server.py, account.py, cli.py, client.py, facets.py, server.json, docs/comparison.md, web/privacy.html, workflows); github.com/PonClick/marktplaats-mcp; github.com/RT-codes/marktplaats-mcp; apify.com/automation-lab/marktplaats-netherlands-classifieds; github.com/jensjeflensje/marktplaats-py; api.marktplaats.nl/docs/v1 (authentication, endpoints); help.marktplaats.nl/s/article/gebruiksvoorwaarden (in force 22 Jul 2026); marktplaats.nl/robots.txt; dutchitchannel.nl/news/723147 (eBay agent ban); bijzonderstrafrecht.nl (art. 138ab case notes).
