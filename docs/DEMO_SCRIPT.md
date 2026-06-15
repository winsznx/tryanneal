# TryAnneal — Demo Video Script (touch everything)

**Target:** 3:00 (submission needs ≥ 2:00). Eight beats, each a different live
surface. Everything below is real and on mainnet — nothing is mocked.

**One-time pre-flight (before recording, run from the repo root `~/tryanneal`):**
```bash
unset VIRTUAL_ENV && export PATH="$HOME/.local/bin:$PATH"   # slither + solc on PATH
set -a && source .env && set +a                            # LLM API keys (don't show this)
npm i -g @tryanneal/cli                                    # the published CLI → `anneal`
slither --version && anneal --version                      # 0.11.5 / 0.1.2
```
Terminal: ≥ 18pt, dark, ≥ 120 cols. Browser tabs pre-opened (see each beat).
**Run every CLI command from the repo root so the relative file path resolves.**
**Never show `.env`, the bot token, decryption keys, or any private key.**

---

## Beat 1 — Hook (0:00–0:20)

**Screen:** empty terminal.

> "Agents are starting to move real money on Mantle — and they compose with
> code they didn't write. TryAnneal is the `is_this_safe()` primitive for that
> world: a multi-LLM audit agent that posts every verdict on-chain and is
> callable by any AI agent before it trusts a contract. It's a registered
> ERC-8004 agent on Mantle mainnet — agent 131 — and it's already audited a
> live sixty-million-dollar protocol. Let me show you all of it."

---

## Beat 2 — Live CLI audit, multi-LLM (0:20–1:05)

> "The CLI is published — `npm i -g @tryanneal/cli`. Here it is on a vulnerable
> vault, on Mantle mainnet, full cascade."

**Type** (from the repo root; with keys sourced, the global `anneal` runs the
published engine + the full LLM cascade — anyone without keys still gets the
Slither + corpus audit):
```bash
anneal audit packages/contracts/contracts/audit-targets/SampleVault.sol \
  --network mantle --no-encrypt
```
**Point at, as it streams:**
- The corpus banner: `113 exploit patterns | $10.1B losses | 2020-2026`.
- The CRITICAL reentrancy with `Sources: chaingpt, groq` — the critic models.
- The 3-column **Arsia gas table** (L2 / L1 / operator).
- The bottom line: **`Models: chaingpt, groq, slither`**.

> "ChainGPT pre-screens; then two architecturally-distinct critics —
> **Groq Llama-3.3-70B** and **OpenAI GPT-OSS-120B**, both served on Groq —
> cross-validate each other (Gemini 2.5 Pro is an optional third critic, off by
> default). Slither and Aderyn hold the ground truth. Then **Tencent Cloud
> Hunyuan** translates the finished verdict into any language — more on that in
> a second."

---

## Beat 3 — On-chain, on mainnet (1:05–1:30)

**Screen:** browser → mantlescan.

> "Every verdict is posted on-chain. And we don't just audit test fixtures —"

Open the **Merchant Moe** verdict tx:
`https://mantlescan.xyz/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96`

> "TryAnneal audited Merchant Moe's live router — sixty million dollars of
> TVL — and posted the verdict on Mantle **mainnet**, as ERC-8004 agent 131."

Then open the agent registration:
`https://mantlescan.xyz/tx/0x599ff14f168dbe6dd31fe66125138f3fc64a4a50961e88e651aeb221be14a945`

---

## Beat 4 — The safety oracle, live (1:30–1:50)

**Type:**
```bash
curl -s "https://tryanneal.xyz/api/safety/0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab?network=mantle" | jq
```
**Response:** `{"safe": true, "score": 100, "agentId": 131, ...}`

> "Any agent, any chain, one HTTP call — read straight from the on-chain
> registry. This is the primitive."

Then show the **live site**: open `https://tryanneal.xyz`, scroll to **Try it
live**, click the **Merchant Moe** example chip → the verdict card animates in.

---

## Beat 5 — MCP: callable by any AI agent (1:50–2:20) ★ the differentiator

**Screen:** Claude Desktop (or Cursor) with the TryAnneal MCP server configured
(`packages/mcp/README.md` has the config). In the chat:

> **you type:** "Use is_this_safe to check 0xfe32c438… on mantle."

Claude calls the `is_this_safe` tool; the result appears:
`{ "safe": true, "score": 100, "attestedByAgentId": 131 }`

> "TryAnneal is a Model Context Protocol server. Any AI agent — Claude, Cursor,
> a custom agent — can call is-this-safe and get an on-chain-backed verdict
> before composing with unknown code. That's agent-to-agent trust, literally."

*(Fallback if Claude Desktop isn't set up on the day: run the stdio smoke test
showing `tools/list` + an `is_this_safe` call, or just show the tool output in
`packages/mcp/README.md`.)*

---

## Beat 6 — Telegram bot + Mini App (2:20–2:40)

**Screen:** Telegram → `@tryannealbot`.
- Tap the **menu button** → the **Mini App** opens; tap an example → live verdict.
- Send `/audit 0x<any-chain-address>` — show it auto-detect the chain (Mantle /
  Ethereum / Base / Arbitrum / …) via `eth_getCode` as ground truth, pull
  verified source over the Etherscan V2 multichain API, and return a verdict.
- Then **`/audit 0x<same-address> zh`** — the same verdict + findings come back
  in Chinese, translated by **Tencent Hunyuan** (zh, es, ja, ko, fr, and more).
- Or `/check 0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab`.

> "From chat: paste a contract on almost any chain — it finds where it's
> actually deployed, pulls the verified source, audits it, and posts the verdict
> on-chain to Mantle as ERC-8004 agent 131. Add a language code and **Tencent
> Hunyuan** hands back the whole report in Chinese. Same engine, no terminal."

---

## Beat 7 — Docs + verifiability (2:40–2:55)

**Screen:** `https://tryanneal.xyz/docs`.
- Scroll the sidebar; open **Architecture** (show the Mermaid diagrams), then
  **Benchmarks**.

> "Full docs, and a reproducible benchmark — four real exploits caught,
> zero false positives, precision and recall a hundred percent. Run it
> yourself."

**Then — the deterministic beat.** Re-run the Beat 2 audit on the same contract:
```bash
anneal audit packages/contracts/contracts/audit-targets/SampleVault.sol \
  --network mantle --no-encrypt
```

> "And run it twice — you get the identical verdict. AI audits are supposed to
> be non-deterministic; ours isn't. Every model decodes at temperature 0 —
> greedy and seeded; a finding only counts with **two independent sources** —
> two models, or a model plus Slither — so no single-model hunch drives the
> score; it's confidence-weighted; and the bot and the hosted MCP **memoize by
> code hash** — the keccak of the source — so identical code returns the
> identical audit. Reproducible by construction."

---

## Beat 8 — Close (2:55–3:00)

**Screen:** the home page or the GitHub repo.

> "Multi-LLM audits, an on-chain verdict registry, an ERC-8004 mainnet agent,
> an MCP server, a Telegram Mini App, and a real sixty-million-dollar audit —
> all live. TryAnneal: the security layer Mantle agents call before they trust."

---

## Copy-paste reference (YouTube description)

- Live: https://tryanneal.xyz · Docs: https://tryanneal.xyz/docs
- Safety oracle: `curl https://tryanneal.xyz/api/safety/<codeHash>?network=mantle`
- Telegram: https://t.me/tryannealbot
- MCP server: https://github.com/winsznx/tryanneal/tree/main/packages/mcp
- Merchant Moe verdict (mainnet): https://mantlescan.xyz/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96
- ERC-8004 agent #131: https://mantlescan.xyz/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- Repo: https://github.com/winsznx/tryanneal

## Recording tips

- Do one dry run of the CLI audit first — cascade latency is ~12–20s; don't be
  surprised on camera.
- If Gemini is rate-limited that day, the cascade still shows chaingpt + groq +
  slither — fine; Gemini is an optional critic.
- Burn-in captions for the commands and the verdict numbers (reads on mute).
- Keep it tight: 3:00 with everything beats 5:00 of dead air.
