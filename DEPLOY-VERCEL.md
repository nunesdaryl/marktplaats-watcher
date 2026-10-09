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
| Health key | `openssl rand -hex 32`, piped straight into both stores (never pasted): `printf %s "$K" \| gh secret set HEALTH_KEY` and `printf %s "$K" \| npx vercel env add HEALTH_KEY production` | `HEALTH_KEY` (Vercel + the GitHub repository secret the uptime check uses) |

## 2. Environment variables
**Vercel** → Project → Settings → Environment Variables (Production):
| Name | Value |
|---|---|
| `OPENAI_API_KEY` | your key |
| `OPENAI_MODEL` | model name |
| `MODEL_PROVIDER` | optional chat and rank provider; defaults to `openai`. Production requirements support OpenAI only; deliberately add `langchain-anthropic` to production requirements before deploying Anthropic. |
| `ANTHROPIC_API_KEY` | only when `MODEL_PROVIDER=anthropic`; OpenAI key is still needed for embeddings |
| `JUDGE_MODEL` | optional eval judge model; defaults to `gpt-5.5` |
| `MODEL_INPUT_PRICE_USD_PER_MILLION`, `MODEL_OUTPUT_PRICE_USD_PER_MILLION` | eval cost prices for a model absent from the built-in table |
| `CLERK_ISSUER` | `https://<your-app>.clerk.accounts.dev` (or your Clerk production domain) |
| `CRON_SECRET` | the random string |
| `API_TO_CONVEX_SECRET` | a separate random string, identical in Vercel and Convex |
| `CONVEX_SITE_URL` | `https://<prod-deployment>.convex.site` for the usage HTTP route |
| `CHAT_PAUSED` | optional: `1` returns 503 for chat while watches continue; redeploy after changing it |
| `HEALTH_KEY` | the health key; without it `/api/health` answers 404 to everyone |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_...` (public, used at build time) |
| `NEXT_PUBLIC_CONVEX_URL` | `https://<prod-deployment>.convex.cloud` (public, used at build time) |
| `RATE_PER_MINUTE`, `MAX_FETCHES_PER_HOUR` | optional, defaults 10 and 30 |

**Convex** production deployment → Settings → Environment Variables (or `npx convex env set --prod ...`):
| Name | Value |
|---|---|
| `CLERK_JWT_ISSUER_DOMAIN` | same as `CLERK_ISSUER` |
| `WATCHER_API_URL` | `https://marktplaats-watcher.vercel.app` |
| `CRON_SECRET` | same as in Vercel |
| `API_TO_CONVEX_SECRET` | same random string as in Vercel |
| `CHAT_DAILY_LIMIT` | optional, defaults to 40 questions per Amsterdam day |
| `USER_AI_BUDGET_EUR` | optional, defaults to €1.00 per admitted user per 30 days |
| `AGENTMAIL_API_KEY` | your key |
| `AGENTMAIL_INBOX_ID` | `marktplaats-watcher@agentmail.to` |
| `APP_URL` | `https://marktplaats-watcher.vercel.app` |
| `OWNER_EMAIL` | where the daily health digest and feedback messages go |
| `RATING_SECRET` | random (generate and pipe in, never paste): signs the "Good match? 👍 / 👎" links in alert e-mails. Without it the e-mails have no rating links; rotating it makes older e-mails' links stop working |
| `OWNER_CLERK_ID` | the owner's Clerk user id (`user_…`). The dashboard at `/admin` only answers the account matching **both** this and `OWNER_EMAIL`; if either is missing, nobody gets in |
| `CHECKS_PAUSED` | optional kill switch: `1` stops all scheduled checks (RUNBOOK.md §1) |
| `VERCEL_TOKEN` | a Vercel access token scoped to this project only (90-day expiry; current one ends 28 Dec 2026) for the dashboard's "Website visitors" section; secret; create and renew per RUNBOOK.md §11 |
| `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` | `prj_xVNQZs3QIQL9sEVKR0UnAt74GAuf`, `team_sNJJlN972tEA3VwmskySHPZ7` (ids, not secrets) |

In Clerk, add `https://marktplaats-watcher.vercel.app` to the allowed origins / production domain.

**Web Analytics.** Vercel → project → Analytics → Enable (once, free on Hobby; enabled on 29 Sep 2026). The app already includes the
`@vercel/analytics` component, which counts page visits without cookies and strips query strings (chat and watch ids);
it loads from the site's own origin, so the security policy needs no change.

**Second address.** `https://marktplaatswatcher.vercel.app` (no hyphen) is added under Vercel → project → Settings →
Domains as a permanent (308) redirect to the main address, keeping the path. People who type it without the hyphen still
arrive, and sign-in, sharing previews and e-mail links stay on one address. Added on 28 Sep 2026 with:
```bash
npx vercel api /v10/projects/marktplaats-watcher/domains -X POST \
  -F name=marktplaatswatcher.vercel.app -F redirect=marktplaats-watcher.vercel.app -F redirectStatusCode=308
```

## 3. Deploy
```bash
cd frontend && npx convex deploy -y   # 1. Convex functions, schema and crons to production
git push origin main                  # 2. Vercel builds the Next.js static export + the Python API from GitHub
```
Convex is deployed from a logged-in CLI on purpose: Vercel then never holds a Convex deploy key (which can
replace every backend function). Deploy Convex **before** pushing a UI that depends on new functions.

**Check that a Production deployment exists for the commit.** On 29 Sep, pushing `main` right after the same commit
on `wave1-demo-ready` gave only a Preview build, so production kept the old version. Check with
`gh api "repos/{owner}/{repo}/deployments?sha=$(git rev-parse HEAD)&environment=Production"` (filter on Production: the
Preview has the same commit). If it's missing, rebuild that commit for production with the production settings:
```bash
npx vercel redeploy <preview-deployment-url> --target production
```

## 4. Verify after deploying
- [ ] `/api/health` returns **404** without the key, and `{"ok":true}` with `-H "X-Health-Key: …"` (or just check the
      GitHub "uptime" workflow, which tests both)
- [ ] `/admin` signed out shows the landing page; signed in as anyone but the owner it goes to the start page
- [ ] `curl -X POST .../api/chat -H 'content-type: application/json' -d '{"message":"hi"}'` → **401**
- [ ] `curl -X POST .../api/internal/check -H 'content-type: application/json' -d '{"query":"x","watches":[{"id":"w"}]}'` → **401**
- [ ] Sign in, search "Mac mini 16GB under €500", press **Watch this search**, save with "every hour"
- [ ] The watch shows "Next check …"; Convex dashboard → Logs shows `checker:checkDue` running every 15 minutes
- [ ] Ask the chat "change my Mac mini watch to every day at 08:00" → confirmation card → **Save change**
- [ ] A new matching listing arrives by e-mail from `marktplaats-watcher@agentmail.to`
- [ ] A second account can't see the first account's watches
- [ ] "Delete my data" empties the watches panel
- [ ] The "Free beta · Give feedback & suggestions" strip opens feedback with a screenshot preview; after sending, it
      shows on `/admin` (signed in as the owner) with the screenshot
- [ ] The sun/moon button switches the theme and a reload keeps it

## Routing note
Vercel's **FastAPI preset** serves the `app` in `main.py` directly, with the original request paths.
Don't add a rewrite to a separate `api/index.py`: it hands FastAPI the path `/api/index` and every route 404s.

## Moving Clerk from Development to Production (planned for after the demo, 3 Oct 2026)
The sign-in boxes say "Development mode" because the app uses a Clerk development instance. A production instance
needs, in this order:
1. **A domain the owner buys** (about €10/year). Clerk production can't run on `*.vercel.app`. Keep "Marktplaats" out
   of the name (trademark). Add it to the Vercel project as the main address; the vercel.app addresses redirect to it.
2. **Clerk DNS records** (about five CNAMEs for the sign-in frontend, accounts pages and e-mail), shown in the Clerk
   dashboard when the production instance is created, added at the domain registrar.
3. **An own Google OAuth client** (Google Cloud → APIs & Services → Credentials, consent screen with name, logo and
   privacy link). The owner pastes its client id and secret into Clerk; development mode borrows Clerk's.
4. **New keys, switched together:** `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_…`) and `CLERK_ISSUER` in Vercel,
   `CLERK_JWT_ISSUER_DOMAIN` in Convex, the `convex` JWT template with the `email` claim, and the CSP (the new
   `clerk.<domain>` instead of `*.clerk.accounts.dev`). Rehearse once on a preview first.
5. **Users:** a production instance has its own user list, so everyone signs in again. Convex rows are keyed by the
   Clerk id; re-link each existing account by its e-mail on first sign-in so nobody loses watches, chats or alerts.
6. `OWNER_CLERK_ID` becomes the owner's new production id.
Production removes the "Development mode" line only; the "Secured by Clerk" badge stays on the free plan (hiding it
needs Clerk Pro, about $25/month).

## Honest limits of this setup
- The per-minute chat rate limit and the Marktplaats page cache live **in memory per serverless instance**, so with
  several instances those limits are looser. The daily chat allowance is atomic in Convex, but fails open if the
  usage service is unavailable. Set the OpenAI project budget limit anyway.
- Scheduled checks are limited in Convex: at most 5 watches per user, 25 distinct items per 15-minute run
  (the rest wait for the next run), and one Marktplaats request per distinct item.
- AgentMail's shared `agentmail.to` domain is fine for a demo. For better deliverability, buy a domain
  and switch the sender (AgentMail custom domain, or Resend).
