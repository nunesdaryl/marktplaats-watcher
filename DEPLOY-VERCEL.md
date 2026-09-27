# Deploying to Vercel + Convex

The Python API and the built UI run on Vercel; the database, schedules and e-mail run on Convex.
Nothing in this file is a secret. **Type every key into the dashboards or CLI yourself**, never into a
chat or the repo.

## 1. Accounts and keys (one time)
| Service | What to do | Value(s) you get |
|---|---|---|
| OpenAI | platform.openai.com → API keys. Set a **monthly budget limit** first. | `OPENAI_API_KEY`, pick `OPENAI_MODEL` |
| Clerk | Create an application (e-mail sign-in on). Integrations → **Convex** → activate. Then Sessions → **Customize session token** → add `"email": "{{user.primary_email_address}}"` next to the managed `aud` claim (without it Convex gets no e-mail address and the app says "Your account has no e-mail address"). | Publishable key, Frontend API URL (issuer) |
| Convex | `cd frontend && npx convex login`, then `npx convex dev --configure new --team <team> --project marktplaats-watcher --dev-deployment cloud --once` | Production URL, printed by `npx convex deploy` |
| AgentMail | console.agentmail.to → API Keys → create. The inbox is `marktplaats-watcher@agentmail.to`. | `AGENTMAIL_API_KEY` |
| Cron secret | `openssl rand -hex 32` | `CRON_SECRET` (same value in Vercel and Convex) |

## 2. Environment variables
**Vercel** → Project → Settings → Environment Variables (Production):
| Name | Value |
|---|---|
| `OPENAI_API_KEY` | your key |
| `OPENAI_MODEL` | model name |
| `CLERK_ISSUER` | `https://<your-app>.clerk.accounts.dev` (or your Clerk production domain) |
| `CRON_SECRET` | the random string |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_...` (public, used at build time) |
| `VITE_CONVEX_URL` | `https://<prod-deployment>.convex.cloud` (public, used at build time) |
| `RATE_PER_MINUTE`, `MAX_FETCHES_PER_HOUR` | optional, defaults 10 and 30 |

**Convex** production deployment → Settings → Environment Variables (or `npx convex env set --prod ...`):
| Name | Value |
|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | same as `CLERK_ISSUER` |
| `WATCHER_API_URL` | `https://marktplaats-watcher.vercel.app` |
| `CRON_SECRET` | same as in Vercel |
| `AGENTMAIL_API_KEY` | your key |
| `AGENTMAIL_INBOX_ID` | `marktplaats-watcher@agentmail.to` |
| `APP_URL` | `https://marktplaats-watcher.vercel.app` |

In Clerk, add `https://marktplaats-watcher.vercel.app` to the allowed origins / production domain.

## 3. Deploy
```bash
cd frontend && npx convex deploy -y   # 1. Convex functions, schema and crons to production
git push origin main                  # 2. Vercel builds the UI + Python API from GitHub
```
Convex is deployed from a logged-in CLI on purpose: Vercel then never holds a Convex deploy key (which can
replace every backend function). Deploy Convex **before** pushing a UI that depends on new functions.

## 4. Verify after deploying
- [ ] `/api/health` returns `{"ok":true}`
- [ ] `curl -X POST .../api/chat -H 'content-type: application/json' -d '{"message":"hi"}'` → **401**
- [ ] `curl -X POST .../api/internal/check -H 'content-type: application/json' -d '{"query":"x","watches":[{"id":"w"}]}'` → **401**
- [ ] Sign in, search "Mac mini 16GB under €500", press **Watch this search**, save with "every hour"
- [ ] The watch shows "Next check …"; Convex dashboard → Logs shows `checker:checkDue` running every 15 minutes
- [ ] Ask the chat "change my Mac mini watch to every day at 08:00" → confirmation card → **Save change**
- [ ] A new matching listing arrives by e-mail from `marktplaats-watcher@agentmail.to`
- [ ] A second account can't see the first account's watches
- [ ] "Delete my data" empties the watches panel

## Routing note
Vercel's **FastAPI preset** serves the `app` in `main.py` directly, with the original request paths.
Don't add a rewrite to a separate `api/index.py`: it hands FastAPI the path `/api/index` and every route 404s.

## Honest limits of this setup
- The chat rate limit and the Marktplaats page cache live **in memory per serverless instance**, so with
  several instances the real limits are looser. Chat now requires a login, which is the main protection
  for the OpenAI budget; set the budget limit anyway.
- Scheduled checks are limited in Convex: at most 5 watches per user, 25 distinct items per 15-minute run
  (the rest wait for the next run), and one Marktplaats request per distinct item.
- AgentMail's shared `agentmail.to` domain is fine for a demo. For better deliverability, buy a domain
  and switch the sender (AgentMail custom domain, or Resend).
