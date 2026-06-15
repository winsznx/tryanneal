# Deployment

## Live services

| service | status | URL |
|---|---|---|
| **web** (safety oracle + dashboard) | ✅ live on Railway | https://tryanneal-web-production.up.railway.app |
| **telegram** (`@tryanneal_bot`) | ⏳ ready — needs a bot token | — |

Railway project: `tryanneal` (`d2e3ea31-04e9-474b-bec2-93636b7b7a93`).

## Web service (deployed)

The web package builds via [`packages/web/Dockerfile`](../packages/web/Dockerfile)
with the **repo root** as build context (it needs the workspace `@tryanneal/engine`).

```bash
# one-time
railway init --name tryanneal --json
railway add --service tryanneal-web --variables "RAILWAY_DOCKERFILE_PATH=packages/web/Dockerfile"

# set secrets (no echo) — repeat per key
printf '%s' "$HUNYUAN_API_KEY" | railway variable set HUNYUAN_API_KEY --stdin --skip-deploys --service tryanneal-web
# … CHAINGPT_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, HUNYUAN_MODEL, HUNYUAN_BASE_URL

# deploy + domain
railway up --ci --service tryanneal-web
railway domain --service tryanneal-web
```

Notes:
- `RAILWAY_DOCKERFILE_PATH` selects our Dockerfile (the repo is a monorepo, so
  the default nixpacks builder won't work).
- The web image intentionally **omits Slither** — the GET safety-oracle route
  only does on-chain reads, and `POST /api/safety/audit` degrades to LLM-only
  without it. This keeps the image lean and the build fast.
- **Never** set `DEPLOYER_PRIVATE_KEY` on the web service — it doesn't attest.
- Redeploy after a push: `railway up --ci --service tryanneal-web`.

## Telegram bot (ready, needs a token)

Everything is built — [`packages/telegram/Dockerfile`](../packages/telegram/Dockerfile)
includes Slither + solc so the bot can run full static analysis. The only
blocker is a bot token:

```bash
# 1. Create the bot with @BotFather on Telegram → copy the token
# 2. Deploy:
railway add --service tryanneal-bot --variables "RAILWAY_DOCKERFILE_PATH=packages/telegram/Dockerfile"
printf '%s' "<BOTFATHER_TOKEN>" | railway variable set TELEGRAM_BOT_TOKEN --stdin --skip-deploys --service tryanneal-bot
# plus the same LLM keys as the web service (CHAINGPT/GEMINI/GROQ/HUNYUAN)
railway up --ci --service tryanneal-bot
```

The bot has no public HTTP surface (it long-polls Telegram), so it needs no
domain.

## Custom domain (optional)

To serve from `tryanneal.xyz`, add it in the Railway dashboard
(service → Settings → Networking → Custom Domain) and point a CNAME at the
generated Railway domain. The docs reference the Railway URL until then.

## Redeploying after code changes

```bash
git push                                   # source of truth
railway up --ci --service tryanneal-web    # rebuild + redeploy from cwd
```
