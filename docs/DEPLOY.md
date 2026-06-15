# Deployment

## Live services

| service | status | URL |
|---|---|---|
| **web** (safety oracle + dashboard) | ✅ live on Railway | https://tryanneal-web-production.up.railway.app |
| **telegram** (`@tryannealbot`) | ⏳ ready — needs a bot token | — |

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
# … CHAINGPT_API_KEY (pre-screen), GEMINI_API_KEY + GROQ_API_KEY (critics),
#   HUNYUAN_API_KEY + HUNYUAN_MODEL + HUNYUAN_BASE_URL (translation — powers /api/translate)

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
- The web service needs `HUNYUAN_*` for `POST /api/translate` — the multilingual
  report layer (Tencent Hunyuan translates a finished English verdict + findings
  into the reader's language). The `/try` page's per-result language chips call it.
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
# plus the same keys as the web service:
#   CHAINGPT (pre-screen) + GROQ (Llama-3.3-70B + GPT-OSS-120B critics) + GEMINI (optional) + HUNYUAN (translation)
railway up --ci --service tryanneal-bot
```

The bot has no public HTTP surface (it long-polls Telegram), so it needs no
domain.

`HUNYUAN_*` powers the bot's multilingual reports: `/audit <url|address> <lang>`
returns a verdict translated by Tencent Hunyuan (e.g. `/audit 0x… zh`; langs
include zh, es, ja, ko, fr, pt, de, ru, it, ar, hi, vi, th, tr). The bot also
posts verdicts on-chain to AnnealValidation as ERC-8004 agent #131 (idempotently,
for both verified-address and GitHub-source audits — codeHash = `keccak(source)`),
so it needs `DEPLOYER_PRIVATE_KEY`.

## Custom domain (optional)

To serve from `tryanneal.xyz`, add it in the Railway dashboard
(service → Settings → Networking → Custom Domain) and point a CNAME at the
generated Railway domain. The docs reference the Railway URL until then.

## Redeploying after code changes

```bash
git push                                   # source of truth
railway up --ci --service tryanneal-web    # rebuild + redeploy from cwd
```
