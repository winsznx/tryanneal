# @tryanneal/telegram — `@tryannealbot`

Telegram wrapper around the TryAnneal audit engine. Non-technical users
get real audit verdicts from chat, no CLI required.

## Commands

| command | what it does |
|---|---|
| `/audit <github_raw_url>` | fetch the .sol file, run the full pipeline (Slither + Aderyn + LLM cascade + corpus), reply with formatted findings |
| `/audit <0xAddress>` | pull verified source from mantlescan (mainnet → sepolia fallback) and audit it |
| `/gas <0xAddress>` | Arsia 3-component gas profile only — no security pass |
| `/check <codeHash>` | read the on-chain verdict from `AnnealValidation` (mainnet, then sepolia) |
| `/help` | show usage |

Long operations send `⏳ Auditing…` first, then edit the message with the
result. Hard timeout is 60 s — if the engine takes longer, the bot replies
with a partial result rather than hanging.

## Local dev

```bash
export TELEGRAM_BOT_TOKEN=...
export CHAINGPT_API_KEY=...        # optional — pre-screen
export GEMINI_API_KEY=...          # optional — critic
export GROQ_API_KEY=...            # optional — critic
export HUNYUAN_API_KEY=...         # optional — Tencent Cloud critic
export MANTLESCAN_API_KEY=...      # optional — quota-bumped source fetch

# Install slither + solc on the host first; see packages/contracts/SLITHER_SETUP.md
pnpm --filter @tryanneal/engine build
pnpm --filter @tryanneal/telegram dev
```

## Railway

The `Dockerfile` is Railway-ready. Deploy as a separate service alongside
`packages/web/`:

1. New service → "Deploy from GitHub repo" → pick this repo.
2. Set the root to `packages/telegram` so Railway uses the bundled Dockerfile.
3. Add env vars: `TELEGRAM_BOT_TOKEN` (required), the LLM keys, and
   `MANTLESCAN_API_KEY` if you have one. Optional:
   `VALIDATION_MAINNET=0x…` once `audit-live-protocols.ts` lands.
4. Deploy. The container installs Slither + solc + the TryAnneal detector
   plugin during build, then runs the bot.

## Implementation notes

- **Source resolution** is permissive: GitHub raw URL OR Ethereum-format
  address (mainnet first, then sepolia). Mantlescan returns Standard-JSON
  bundles for multi-file contracts; we unpack them into a single source
  string that the engine can write to a tmp file.
- **`/check`** reads `getVerdict(codeHash)` directly via `JsonRpcProvider`,
  no API key needed.
- **Markdown escaping** is rudimentary — Telegram's classic Markdown wants
  backticks / asterisks / underscores escaped. The bot uses a one-liner
  regex; long contract bodies stay inside code blocks where they're safe.
- **No persistence.** The bot is stateless — every request fetches fresh.
  In-memory rate limiting was deliberately omitted; if abuse becomes a
  problem, drop in a Map keyed by chat ID, same shape as `app/api/safety`.
