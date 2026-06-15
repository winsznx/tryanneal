# X / Twitter Launch Thread

Six-tweet thread. Post when the demo video is up and the live URL is hot.
Include `#MantleAIHackathon`, `@Mantle_Official`, and `@tencentcloud` on the
opener and the closer. Attach screenshots where indicated.

---

**Tweet 1/6 — Hook**

Submitted TryAnneal to @Mantle_Official Turing Test 2026 — AI DevTools track.

The is_this_safe() primitive for the Mantle agent economy. 🧵

#MantleAIHackathon @tencentcloud

> Attach: hero screenshot of the CLI verdict block (40/100 for SampleVault, models row visible).

---

**Tweet 2/6 — The problem**

Minterest lost $1.4M on Mantle (reentrancy, July 2024).
KelpDAO lost $292M via a 1-of-1 LayerZero DVN config (April 2026).

Generic audit tools don't understand Mantle-specific patterns.
TryAnneal does.

---

**Tweet 3/6 — The engine**

The cascade:
→ ChainGPT pre-screen (Web3-tuned, ~4s)
→ Groq Llama-3.3-70B + OpenAI GPT-OSS-120B critics in parallel (Gemini optional)
→ 15 custom Slither detectors (agent-context + Mantle-specific + exploit patterns)
→ 98-pattern corpus: $7.1B in documented losses, 13 chains, 2020–2026
→ Arsia 3-component gas profiler (post-Arsia accurate, no retired tokenRatio call)

Read it in your language: **Tencent Cloud Hunyuan-MT** translates every finished verdict + findings into zh / es / ja / ko / fr and more.

---

**Tweet 4/6 — On-chain**

Every audit verdict is posted on-chain to AnnealValidation on Mantle Sepolia (chain 5003). All 4 contracts verified on mantlescan.

Any agent queries: GET /api/safety/{codeHash}

Permanent. Public. Queryable from any chain.

> Attach: screenshot of the curl response — `{"safe":false,"score":40,"criticalCount":1, ...}`

---

**Tweet 5/6 — Corpus moment**

The corpus match line that lands:

> "Your code is 94% similar to the KelpDAO LayerZero DVN drain — April 2026 — $292M lost. Fix: require N≥3 distinct DVN operators."

Not generic LLM output. Memory of every major exploit since 2020.

---

**Tweet 6/6 — Benchmark + CTA**

Reproducible benchmark in the repo:
- 4/4 known-vulnerable contracts detected (Minterest, Euler, Nomad, KelpDAO)
- 0/2 false positives on clean contracts
- Precision 100% · Recall 100% · F1 = 1.00

Try it:
- tryanneal.xyz — tap a language chip to read any result in one click
- @tryannealbot on Telegram — `/audit 0x… zh` returns a translated report
- github.com/winsznx/tryanneal

Reports translated by Tencent Hunyuan.

#MantleAIHackathon @Mantle_Official @tencentcloud

> Attach: screenshot of the benchmark table from packages/engine/benchmarks/README.md.

---

## Cross-posting notes

- **LinkedIn**: collapse tweets 2+3 and 5+6 into two paragraphs; same screenshots; tag Mantle + Tencent Cloud company pages.
- **Farcaster**: post as a frame-friendly single cast with the verdict screenshot and a direct link to `/api/safety/...`.
- **Discord (Mantle builders channel)**: paste the hook and the benchmark numbers; link to the repo. Don't link the X thread — judges follow the repo.
