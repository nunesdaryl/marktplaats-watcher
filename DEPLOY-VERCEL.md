# Deploying to Vercel (prepared, NOT deployed)

Everything in the repo is ready. What's missing is marked **TODO**; none of it is a secret in this file.

## TODO before the first deploy
- [ ] **Azure key: your own, not the course key.** Create your own Azure OpenAI deployment, and set a
      **spending limit / budget alert** in the Azure portal first. A public URL lets anyone spend on this key.
- [ ] **Decide on access.** Default: fully public with rate limits (below). Optional: add a passcode.
- [ ] **A Vercel account** and the CLI: `npm i -g vercel`, then `vercel login`.
- [ ] **Accept the Marktplaats risk.** A public service querying Marktplaats is no longer personal use
      (ToS Art. 7.3). The cache and hourly cap below keep the query volume low, but the risk is yours.

## Environment variables (set in Vercel → Project → Settings → Environment Variables)
| Name | Value |
|---|---|
| `AZURE_AI_ENDPOINT` | `https://<your-resource>.cognitiveservices.azure.com/openai/v1` (**TODO**) |
| `AZURE_AI_API_KEY` | `<your key>` (**TODO**, type it into Vercel yourself, never into chat or the repo) |
| `AZURE_AI_MODEL` | `<your deployment name>` (**TODO**) |
| `RATE_PER_MINUTE` | `10` (optional; per-IP chat limit) |
| `MAX_FETCHES_PER_HOUR` | `30` (optional; Marktplaats pages per server instance per hour) |

## Deploy
```bash
cd marktplaats-watcher
vercel link          # create or link the Vercel project
vercel               # preview deploy: test it first
vercel --prod        # production URL
```

## Verify after deploying (the Vercel routing can only be checked on Vercel itself)
- [ ] `https://<your-app>.vercel.app/api/health` returns `{"ok":true}`
- [ ] The chat page loads and the happy flow works ("Find me a Mac mini with 16GB under 500 euro")
- [ ] 11 fast questions from one browser → the 11th gets "Too many questions in a minute"
- [ ] "Who is the president of India?" → refusal

## Honest limits of this setup
- The rate limit, cache and hourly cap live **in memory per serverless instance**. Vercel can run several
  instances, so the real limits are looser. For real abuse protection use a shared store (e.g. Upstash
  Redis) or Vercel's firewall rate limiting.
- There's no login. Anyone with the URL can use it and spend on the Azure key.
