# Safety Oracle API

`is_this_safe()` as an HTTP endpoint. Any agent (or judge) can query a
verdict from the on-chain `AnnealValidation` registry without an SDK,
without an API key, and without trusting any middleware between the
question and the on-chain truth.

**Live contract** (Mantle Sepolia): [`0xf02C982D19184c11b86BC34672441C45fBF0f93E`](https://sepolia.mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E).

## Endpoints

### `GET /api/safety/{codeHash}`
### `GET /api/safety?codeHash=0x...&network=mantle-sepolia`

Reads the on-chain verdict for a code hash. Both shapes work — path-param is
demo-friendly, query-string composes well with `cast keccak | xargs`.

Query param:

| name | type | default | notes |
|---|---|---|---|
| `codeHash` / `hash` | `0x`-prefixed 32-byte hex | — | required for the query-string form |
| `network` | `mantle-sepolia` \| `mantle` | `mantle-sepolia` | mainnet returns 404 until contract is deployed |

**200 OK — verdict found:**

```json
{
  "safe": false,
  "score": 40,
  "codeHash": "0xb8847a37ce8437d01189686090f93af466e4eaa5e5fe3de7ba2579338e85e7b0",
  "agentId": 0,
  "network": "mantle-sepolia",
  "criticalCount": 1,
  "highCount": 2,
  "mediumCount": 1,
  "lowCount": 0,
  "reportURI": "file:///.../<hash>.enc",
  "gasReportHash": "0x238027b05847…",
  "attestedAt": "2026-06-09T16:05:09.000Z",
  "attestedAtUnix": 1781021109,
  "attestedBy": "TryAnneal/Anneal",
  "validationContract": "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
  "mantlescanContractUrl": "https://sepolia.mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E"
}
```

`safe` is opinionated: **any critical or high finding** flips it `false`. A
single critical at 90/100 still kills composability — score alone is not a
safety signal.

**404 Not Found — no verdict:**

```json
{
  "safe": null,
  "score": null,
  "codeHash": "0xffffffff…",
  "network": "mantle-sepolia",
  "message": "No on-chain verdict for this code hash on mantle-sepolia. Submit for audit via POST /api/safety/audit or run the CLI: `anneal audit <file> --attest`."
}
```

**Other status codes:** `400` for malformed hash; `502` for RPC failure.

**Caching:** `cache-control: public, max-age=30`. On-chain verdicts are
immutable — 30 s strikes a balance between freshness and origin load.

**CORS:** wide open (`access-control-allow-origin: *`). Any agent on any
chain can call this.

---

### `POST /api/safety/audit`

Submit a fresh contract for live audit. Runs the full ChainGPT → Gemini +
Groq cascade when keys are configured; falls back to Slither-only and
reports `"mode": "static-only"` otherwise.

**Rate limit:** 1 request / 5 minutes / IP. In-memory map — no Redis. The
spec calls for this; it's a demo-grade backstop, not a real abuse defense.

**Request:**

```json
{
  "sourceCode": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\ncontract Vault { ... }",
  "contractName": "Vault.sol",
  "network": "mantle-sepolia"
}
```

| field | type | required | notes |
|---|---|---|---|
| `sourceCode` | string | yes | full Solidity source, max 200 KB |
| `contractName` | string | no | defaults to `Submitted.sol` |
| `network` | `mantle-sepolia` \| `mantle` | no | defaults to `mantle-sepolia` |

**200 OK:**

```json
{
  "safe": false,
  "score": 40,
  "codeHash": "0x...",
  "network": "mantle-sepolia",
  "contractName": "Vault.sol",
  "mode": "llm-cascade",
  "modelsUsed": ["chaingpt", "gemini", "groq", "slither"],
  "modelsTimedOut": [],
  "timeTakenMs": 17430,
  "estimatedCostUSD": 0.04,
  "criticalCount": 1,
  "highCount": 2,
  "mediumCount": 1,
  "lowCount": 0,
  "findings": [
    {
      "id": "F-001",
      "severity": "critical",
      "vulnClass": "reentrancy",
      "title": "reentrancy",
      "description": "withdraw() makes external call before zeroing balance",
      "recommendation": "Apply checks-effects-interactions",
      "lineStart": 8,
      "lineEnd": 12,
      "confidence": 95,
      "sources": ["chaingpt", "gemini", "groq", "slither"]
    }
  ],
  "gasReport": {
    "deploymentGas": 1200000,
    "deploymentCostMNT": "0.00002482",
    "deploymentCostUSD": "0.0000",
    "l2ExecutionMNT": "24000000000000",
    "l1DataMNT": "820800020273",
    "operatorMNT": "0",
    "functionCount": 2,
    "optimizations": [],
    "arsiaParamsSource": "live"
  },
  "corpusContext": {
    "totalPatterns": 98,
    "totalLossesUSD": 7104506000,
    "totalLossesHuman": "$7.1B",
    "yearMin": 2020,
    "yearMax": 2026,
    "chains": ["arbitrum", "avalanche", "base", "bitcoin", "blast", "bsc", "ethereum", "fantom", "multi", "near", "optimism", "polygon", "solana"],
    "matchesFound": 0,
    "bestMatchSimilarity": 0
  },
  "privacy": {
    "encryptedReportBytes": 4123,
    "decryptionKey": "0x7f3a...",
    "decryptionNote": "AES-256-GCM key. Returned ONCE here. TryAnneal does not store it. Lose this and the encrypted report is irrecoverable (crypto-shred)."
  },
  "attestation": {
    "posted": false,
    "note": "POST /api/safety/audit performs analysis only. To attest on-chain, run `anneal audit <file> --attest` from the CLI with DEPLOYER_PRIVATE_KEY set."
  }
}
```

**`mode`** is either `"llm-cascade"` (full multi-LLM run) or `"static-only"`
(Slither-only fallback when `CHAINGPT_API_KEY` is not configured).

**Other status codes:** `400` for missing/invalid body; `413` for source >
200 KB; `429` for rate-limit; `500` for engine failure.

This endpoint does **not** post a verdict on-chain. Attestation requires a
funded deployer key — that path goes through the CLI (`anneal audit … --attest`).

---

## Curl examples

```bash
# Check the verdict for SampleVault.sol (already audited and on-chain)
curl https://tryanneal.xyz/api/safety/0xb8847a37ce8437d01189686090f93af466e4eaa5e5fe3de7ba2579338e85e7b0

# Same query, path you'd actually run when composing — keccak the source first
curl https://tryanneal.xyz/api/safety/$(cast keccak "$(cat SampleVault.sol)")

# Live audit (no API keys → Slither-only; cascade requires server-side env)
curl -X POST https://tryanneal.xyz/api/safety/audit \
  -H "Content-Type: application/json" \
  -d '{
    "sourceCode": "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\ncontract X { function withdraw() external { msg.sender.call{value: address(this).balance}(\"\"); } }",
    "contractName": "X.sol"
  }'
```

The four code hashes that are already on-chain from the deploy-day batch:

| contract | code hash |
|---|---|
| SimpleToken.sol | `0x54747681599ea57e90d68cc4d1f753c7e2bfb2bb9dda1529bd784e9260d5c39b` |
| SampleVault.sol | `0xb8847a37ce8437d01189686090f93af466e4eaa5e5fe3de7ba2579338e85e7b0` |
| UnsafeOracle.sol | `0xcbc2c7b205c7f39b34b2c05db716dceedc1627ee7d8b6ef9f83524aad34f5b6e` |
| ProxyAdmin.sol | `0xa96cf70c96c4b540c1f60b701ec6dee2b7d5f93770185f7acb3b30ad6ceb678e` |
| BatchTransfer.sol | `0xee27af7ee509500c417243c36e642c6527a6fe53b0b9605c20970e559366b91b` |

## Implementation notes

- **Read path** ([`_safety.ts`](_safety.ts)) hits `AnnealValidation.getVerdict(bytes32)`
  on the public Mantle Sepolia RPC. No private key, no signer — pure read.
  Cached static-network provider per-network for warm-start reuse.
- **Write path** (`audit/route.ts`) writes the body to a tmp file, runs
  [`runAudit()`](../../../../engine/src/audit.ts), encrypts the findings with
  AES-256-GCM, and returns the key once. The encrypted blob is held in
  memory and not persisted — that's an on-chain attestation concern (CLI).
- **Routes are `runtime: "nodejs"`** because the engine pulls in `ethers`
  and Node `crypto` primitives that aren't on the Edge runtime.
- **`safe` is computed in code**, not on-chain. The contract stores raw
  counts and the score; this endpoint interprets them. Change the threshold
  in [`buildSafetyVerdict()`](_safety.ts) without re-deploying.

## When this is useful

The exact moment any agent goes to compose with code it didn't write itself:

```ts
const codeHash = keccak256(toUtf8Bytes(contractSource));
const res = await fetch(`https://tryanneal.xyz/api/safety/${codeHash}`);
if (res.status === 404) {
  // never audited — your call whether to refuse, ask the user, or audit first.
}
const { safe, score, criticalCount, reportURI } = await res.json();
if (!safe) throw new Error(`refusing to compose: score=${score}`);
```

This is the primitive. Everything else in TryAnneal exists to make this
endpoint trustworthy.
