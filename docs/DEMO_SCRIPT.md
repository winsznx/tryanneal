# TryAnneal — Demo Video Script (touch everything)

> **For the editor:** this pairs with `internal/video-flow.md` — its **clip legend (C1–C15)** tells you what each clip below means, its on-screen caption, and the motion to add. Tim records in **beat order** here; the editor re-cuts into the C-order there. Beat ↔ clip: 2→C1/C2 · 3→C3/C5 · 4→C6/C7 · 5→C8/C14 · 6→C10 · 7→C9 · 8→C11 · 9→C15.

**Target:** ~3:00 (submission needs ≥ 2:00; long is fine). Each beat is a different live surface — everything is real and on Mantle mainnet, nothing mocked. Tone: calm, fast, confident — "good tools don't show off, they show up." Numbers are the only correct ones: 98 patterns · $7.1B · 16 detectors · Groq critics · Hunyuan = translation.

**One-time pre-flight (from the repo root `~/tryanneal`):**
```bash
unset VIRTUAL_ENV && export PATH="$HOME/.local/bin:$PATH"   # slither + solc on PATH
set -a && source .env && set +a                            # LLM keys (NEVER show) — REQUIRED for the 4-model cascade
npm i -g @tryanneal/cli@latest                             # force latest — an old global install won't auto-update
pip install tryanneal-detectors                            # the 16 custom detectors + corpus matcher
slither --version && anneal --version                      # 0.11.5 / 0.1.6  (must be ≥0.1.6 for the banner + 98/$7.1B)
```
Terminal ≥18pt, dark, ≥120 cols. Pre-open browser tabs (mantlescan, /try, /docs/benchmarks, the GitHub PR). **Never show `.env`, the bot token, or any private key.** Burn-in captions for commands + verdict numbers (reads on mute).

---

## Beat 1 — Hook (0:00–0:15)
**Screen:** empty terminal.
> "Agents are starting to move real money on Mantle — and they compose with code they didn't write. TryAnneal is the `is_this_safe()` primitive for that world: a deterministic, multi-model audit agent that posts every verdict on-chain. Registered ERC-8004 agent 131 on Mantle mainnet; it's already audited a live sixty-million-dollar protocol. Here's all of it."

## Beat 2 — One command, the whole engine (0:15–0:55)
**Type** (the animated TRYANNEAL banner draws in, then the engine streams):
```bash
anneal audit packages/contracts/contracts/audit-targets/SampleVault.sol --no-encrypt
```
**Point at, as it streams:**
- the banner + corpus line `98 exploit patterns | $7.1B losses | 2020-2026`;
- **Slither + Aderyn run in parallel**, then ChainGPT, then the two Groq critics;
- the CRITICAL/HIGH **Reentrancy** — `Sources: chaingpt, groq, gpt-oss, slither` (**one finding, four engines** — that's the dedup);
- the **`is_this_safe()  ✗ UNSAFE`** line + `VERDICT: 70/100`.
> "ChainGPT pre-screens; two architecturally-distinct critics on Groq — Llama-3.3-70B and GPT-OSS-120B — cross-validate each other; Slither and Aderyn hold the ground truth; the 98-pattern corpus matches known exploits. A finding needs at least two independent sources to survive — so this reentrancy is one finding cross-validated by four engines, not generic LLM noise."

## Beat 3 — Deterministic, and it gates (0:55–1:20)
> "AI audits are supposed to be non-deterministic. Ours isn't."
**Run it again, diff everything but the timestamp:**
```bash
anneal audit .../SampleVault.sol --no-encrypt | grep -vE "Audited at|Time:" > /tmp/a
anneal audit .../SampleVault.sol --no-encrypt | grep -vE "Audited at|Time:" > /tmp/b
diff /tmp/a /tmp/b && echo "IDENTICAL"
```
> "Same contract, same verdict, byte-for-byte — temperature-0 seeded decoding plus memoization by code hash."
**Then the gate:**
```bash
anneal audit .../SampleVault.sol --no-llm --threshold 80 ; echo "exit: $?"   # → exit: 1
```
> "It exits non-zero on risk — a real gate you can drop into CI."

## Beat 4 — Mantle-native gas, measured (1:20–1:40)
**Scroll the report's Arsia gas table** (L2 exec / L1 data / operator), then open **`https://tryanneal.xyz/docs/benchmarks`** → the *measured before/after* table.
> "Mantle's three-component Arsia gas — and we don't just suggest optimizations, we measured them: batching cuts L1 data fees ninety percent. Reproducible with `pnpm benchmark:gas`. No black-box claims."

## Beat 5 — On-chain, on mainnet (1:40–2:00)
**Browser → mantlescan**, the Merchant Moe verdict tx:
`https://mantlescan.xyz/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96`
> "Every verdict is posted on-chain. And we don't just audit fixtures — TryAnneal audited Merchant Moe's live router, sixty million in TVL, scored it 100, and posted that verdict on Mantle mainnet as agent 131."
**Then the oracle, one call:**
```bash
curl -s "https://tryanneal.xyz/api/safety/0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab?network=mantle" | jq
# → {"safe": true, "score": 100, "attestedByAgentId": 131, ...}
```
> "Any agent, any app — one HTTP call, read straight from the on-chain registry. No SDK, no key."

## Beat 6 — Callable by any AI agent: MCP (2:00–2:20) ★ differentiator
**Screen:** Claude Desktop / Cursor with the TryAnneal MCP configured.
> **you type:** "Use is_this_safe to check 0xfe32c438… on mantle."

Claude calls the tool → `{ "safe": true, "score": 100, "attestedByAgentId": 131 }`.
> "TryAnneal is an MCP server — any agent calls `is_this_safe` and gets an on-chain-backed verdict before it composes with unknown code. Agent-to-agent trust, literally."

## Beat 7 — It blocks bad code in CI (2:20–2:45) ★ developer productivity
**Screen:** a GitHub PR that adds a reentrant contract.
- The **TryAnneal check-run goes red ❌**, comment reads **"❌ BLOCKED — high/critical"**, merge greyed out.
- Push a fix → check turns **green ✅ "PASSED"**, merge unlocks.
> "Drop the GitHub Action into any repo — no keys, no secrets — and it audits every PR with Slither, sixteen custom detectors, and the corpus. Bad code can't merge. Audit-before-you-merge in one line."
*(Needs the repo pushed + a demo PR open. Fallback: show the workflow file + a prior run's red/green check.)*

## Beat 8 — No terminal: Telegram + 14 languages (2:45–3:00)
**Screen:** `@tryannealbot`.
- `/audit 0x<any-chain-address>` → auto-detects the chain via `eth_getCode`, pulls verified source, returns the `is_this_safe → SAFE/UNSAFE` card.
- `/audit 0x<same> ja` → the same report **in Japanese**, translated by **Tencent Hunyuan**.
> "From chat: paste a contract on almost any chain, get the verdict on-chain to Mantle, and read it in any of fourteen languages — Tencent Cloud Hunyuan. Same engine, no terminal."

## Beat 9 — Composability: the gate inside an agent's loop (3:00–3:15)
**Type:**
```bash
cd integrations/byreal && npm run agent
```
> "And because it's the primitive agents need, other agents chain it. Here a Byreal trading agent audits a pool **before** it deploys capital: Merchant Moe is safe — proceed; an unknown pool trips a HIGH reentrancy — abort, capital preserved. Perceive, audit, decide — autonomously."

## Beat 10 — Close (3:15–3:25)
**Screen:** home page / GitHub repo.
> "Deterministic multi-model audits, an on-chain verdict registry, a no-keys CI gate, an MCP server agents call natively, fourteen-language reports, and a real sixty-million-dollar audit — all live on Mantle. TryAnneal: the security layer agents call before they trust. tryanneal.xyz"

---

## YouTube description (copy-paste)
- Live: https://tryanneal.xyz · `/try`: https://tryanneal.xyz/try · Docs: https://tryanneal.xyz/docs
- npm: `npx @tryanneal/cli audit <file>` · PyPI: `pip install tryanneal-detectors`
- Oracle: `curl https://tryanneal.xyz/api/safety/<codeHash>?network=mantle`
- MCP: `mcp.tryanneal.xyz` · Telegram: https://t.me/tryannealbot
- Merchant Moe verdict (mainnet): https://mantlescan.xyz/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96
- ERC-8004 agent #131: https://mantlescan.xyz/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- Repo: https://github.com/winsznx/tryanneal

## Recording tips
- Do one dry CLI run first — full-cascade latency is ~12–20s; don't be surprised on camera. For a snappier take, `--no-llm` (Slither + 16 detectors + corpus) runs in ~2–4s and still shows real findings.
- If Gemini is rate-limited that day it's fine — the cascade shows chaingpt + groq + gpt-oss + slither; Gemini is an optional critic.
- Beats 7 (CI) and 9 (Byreal) both need the repo pushed; record those after the push.
- Keep it tight — 3:00 with everything beats 5:00 of dead air.
