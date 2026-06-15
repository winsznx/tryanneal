# TryAnneal — Demo Video Script (touch everything)

**Target:** 3:00 (submission needs ≥ 2:00). Eight beats, each a different live
surface. Everything below is real and on mainnet — nothing is mocked.

**One-time pre-flight (before recording):**
```bash
unset VIRTUAL_ENV && export PATH="$HOME/.local/bin:$PATH"   # slither + solc
set -a && source .env && set +a                            # API keys (don't show this)
pnpm --filter @tryanneal/engine build
slither --version && solc --version                        # 0.11.5 / 0.8.24
```
Terminal: ≥ 18pt, dark, ≥ 120 cols. Browser tabs pre-opened (see each beat).
**Never show `.env`, the bot token, decryption keys, or any private key.**

---

## Beat 1 — Hook (0:00–0:20)

**Screen:** empty terminal.

> "Four projects in this track audit smart contracts. One's a Slither
> wrapper. TryAnneal is the is-this-safe primitive for the Mantle agent
> economy — a multi-LLM audit agent that posts verdicts on-chain and is
> callable by any AI agent. Let me show you all of it."

---

## Beat 2 — Live CLI audit, multi-LLM (0:20–1:05)

**Type:**
```bash
pnpm --filter @tryanneal/cli start audit \
  packages/contracts/contracts/audit-targets/SampleVault.sol \
  --network mantle-sepolia --no-encrypt
```
**Point at, as it streams:**
- The corpus banner: `113 exploit patterns | $10.1B losses | 2020-2026`.
- The CRITICAL reentrancy with `Sources: chaingpt, groq, hunyuan` — four LLMs.
- The 3-column **Arsia gas table** (L2 / L1 / operator).
- The bottom line: **`Models: chaingpt, groq, hunyuan, slither`**.

> "ChainGPT pre-screens; Gemini, Groq, and **Tencent Cloud Hunyuan** argue;
> Slither and Aderyn hold the ground truth. That Hunyuan in the model list is
> the Tencent Cloud integration, on every audit."

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
> a custom agent — can call is-this-safe before composing with unknown code.
> No other audit project does this. That's the agent economy, literally."

*(Fallback if Claude Desktop isn't set up on the day: run the stdio smoke test
showing `tools/list` + an `is_this_safe` call, or just show the tool output in
`packages/mcp/README.md`.)*

---

## Beat 6 — Telegram bot + Mini App (2:20–2:40)

**Screen:** Telegram → `@tryannealbot`.
- Tap the **menu button** → the **Mini App** opens; tap an example → live verdict.
- Or send `/check 0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab`.

> "Non-technical users get the same on-chain verdict from chat — a Mini App,
> no terminal, no wallet pop-up."

---

## Beat 7 — Docs + verifiability (2:40–2:55)

**Screen:** `https://tryanneal.xyz/docs`.
- Scroll the sidebar; open **Architecture** (show the Mermaid diagrams), then
  **Benchmarks**.

> "Full docs, and a reproducible benchmark — four real exploits caught,
> zero false positives, precision and recall a hundred percent. Run it
> yourself."

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
  hunyuan + slither — fine.
- Burn-in captions for the commands and the verdict numbers (reads on mute).
- Keep it tight: 3:00 with everything beats 5:00 of dead air.
