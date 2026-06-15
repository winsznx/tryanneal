# @tryanneal/engine

**The audit engine behind [TryAnneal](https://tryanneal.xyz)** — a Mantle-native, multi-model smart-contract auditor. Used by the [`@tryanneal/cli`](https://www.npmjs.com/package/@tryanneal/cli), the hosted MCP server, the Telegram bot, and the web app.

```ts
import { runAudit } from "@tryanneal/engine";

const result = await runAudit("./Vault.sol", {
  network: "mantle",
  chaingptKey: process.env.CHAINGPT_API_KEY, // optional — omit for static-only
  groqKey: process.env.GROQ_API_KEY,         // the two cross-validating critics
  hunyuanKey: process.env.HUNYUAN_API_KEY,   // 14-language remediation/translation
});

console.log(result.verdictScore);  // 0–100
console.log(result.findings);      // deduped, each tagged with its sources
```

## The pipeline

```
ChainGPT pre-screen
        │
        ▼
Groq critics ─ Llama-3.3-70B + OpenAI GPT-OSS-120B  (cross-validate each other)
        │                                            (+ optional Gemini, off by default)
        ▼
Slither + Aderyn + 16 custom detectors  ─►  98-pattern / $7.1B exploit corpus
        │
        ▼
Consensus ─ corroborate (≥2 sources) · dedup · confidence-weighted score
```

- **Cross-validation is the moat.** A finding needs **≥2 independent sources** (≥2 models, or a model + Slither) to survive; single-model hunches are dropped. The same issue from multiple engines is merged into **one** finding listing every source (e.g. `Reentrancy — chaingpt, groq, gpt-oss, slither`).
- **Deterministic.** Temperature-0 seeded decoding + memoization by code hash → the **same contract always returns the same verdict**.
- **Mantle-native gas.** 3-component Arsia fee profiling (L2 exec + L1 data + operator) with measured before/after optimization benchmarks (`benchmark:gas`).
- **Resilient + honest.** A contract nothing could analyze is flagged `analysisIncomplete` — never falsely reported "safe".

## Key exports

| Export | Purpose |
|---|---|
| `runAudit(filePath, options)` | Full audit → `FullAuditResult` (verdict, findings, gas, corpus). |
| `profileMantleGas(input)` | Arsia 3-component gas profile. |
| `postAuditOnChain(...)` | Attest a verdict to AnnealValidation (ERC-8004) on Mantle. |
| `computeConsensus`, `computeVerdictScore` | The corroboration + scoring primitives. |
| `CORPUS_SNAPSHOT` | `{ totalPatterns: 98, totalLossesHuman: "$7.1B", … }`. |
| `createGroqProvider` / `createChainGPTProvider` / `createHunyuanProvider` / `createGeminiProvider` | Pluggable `LLMProvider` adapters. |

Slither (`pip install slither-analyzer`) must be on `PATH` for static analysis; the LLM stage is optional (omit keys → deterministic Slither + detectors + corpus).

## Links

[tryanneal.xyz](https://tryanneal.xyz) · [docs](https://tryanneal.xyz/docs) · [CLI](https://www.npmjs.com/package/@tryanneal/cli) · MCP: `mcp.tryanneal.xyz`

MIT © TryAnneal
