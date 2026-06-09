# TryAnneal — Demo Video Script

**Target length:** 2:30 (submission requires ≥ 2:00).
**Format:** screen recording, one take preferred, terminal + browser only.
**Voice:** plain, fast, no marketing fluff. Read the verdicts, don't sell them.

---

## Pre-flight (do before pressing record)

```bash
# 1. Clean terminal, large font (24pt+), dark theme, terminal width ≥ 120 cols
# 2. Browser pre-loaded with two tabs:
#    - https://sepolia.mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E#code  (AnnealValidation, verified)
#    - https://sepolia.mantlescan.xyz/tx/0x6f1f65ae32c5ad3891d56c2b9ffd50ebc2638c30b5881c50d5e174fb38784a3a   (SampleVault verdict tx)
# 3. cd /Users/mac/tryanneal
# 4. unset VIRTUAL_ENV && export PATH="$HOME/.local/bin:$PATH"
# 5. Confirm env: CHAINGPT_API_KEY, GEMINI_API_KEY, GROQ_API_KEY all set (cli reads from packages/contracts/.env via symlink)
# 6. Pre-warm engine: `pnpm --filter @tryanneal/engine build` (so the first demo command is fast)
# 7. DO NOT show .env contents, decryption keys, or any 0x… hex private key on screen
```

If anything in pre-flight fails, abort and fix offline. Don't record troubleshooting.

---

## Section 1 — Hook (0:00 → 0:20)

**On screen:** Empty terminal at repo root.

**Say:**
> "Smart contract audits cost $30,000 and take a month. Agents need
> safety verdicts in seconds. TryAnneal is the is-this-safe primitive
> for the agent economy — multi-LLM audit, gas profiling, and on-chain
> attestation in one CLI call."

**Type:** nothing yet. Pause one beat, then move.

---

## Section 2 — Live audit (0:20 → 1:15)

**On screen:** terminal, CLI command first, then output.

**Type (paste-ready):**

```bash
cd packages/cli && pnpm start audit ../contracts/contracts/audit-targets/SampleVault.sol --network mantle-sepolia
```

**As the output streams, narrate over it:**

- Header bar appears with the corpus banner →
  > "Every audit cross-references a curated library of 113 real exploits
  > totalling $10.1 billion in losses."
- ChainGPT pre-screen kicks off (~3-5 s) →
  > "ChainGPT — Web3-tuned — runs the pre-screen. About four seconds."
- Critic cascade fires (~10 s) →
  > "Gemini 2.5 Pro and Groq Llama 3.3 70B fire in parallel as critics,
  > confirm or reject each pre-screen finding, and surface anything the
  > pre-screener missed."
- Findings block prints. Point at:
  > "Critical: reentrancy in withdraw. Two highs. One medium. Score: 40
  > out of 100. The same withdraw-then-zero pattern that drained the DAO
  > in 2016."
- Gas profile table prints →
  > "And because this is Mantle, the gas profile breaks cost into the
  > three Arsia components — L2 execution, L1 data, operator fee. Read
  > live from the gas price oracle predeploy."
- Verdict line prints →
  > "Verdict: 40 out of 100. Encrypted findings stored locally — AES-256-GCM.
  > Decryption key returned once. TryAnneal never sees it."

**Fallback line if the LLM cascade takes longer than 25 seconds:**
> "The cascade is parallel — Gemini, Groq, and Slither all running.
> Total budget is sixty seconds. We usually land in twenty."

---

## Section 3 — On-chain proof (1:15 → 1:40)

**On screen:** switch to browser, mantlescan tab for the SampleVault verdict tx.

**Click the tx hash field, then the "Logs" tab.**

**Say:**
> "Every audit posts a verdict on chain. This is the SampleVault verdict
> on Mantle Sepolia — AuditPosted event, indexed by agent ID and code
> hash. Verdict score forty, one critical, two highs. The contract is
> verified — anyone can read the verdict logic right next to it."

**Click through to:** the AnnealValidation contract tab → **"Contract" → "Read Contract"**.

**Say:**
> "And anyone can call getVerdict on the registry with a code hash and
> get the same answer back. No SDK. No API key."

---

## Section 4 — Safety oracle (1:40 → 2:05)

**On screen:** back to terminal, open a fresh pane.

**Type (paste-ready):**

```bash
curl -s https://tryanneal.xyz/api/safety/0xb8847a37ce8437d01189686090f93af466e4eaa5e5fe3de7ba2579338e85e7b0 | jq
```

**As the JSON prints, point at the `safe: false`, `score: 40`, `criticalCount: 1` fields and say:**
> "This is the is-this-safe primitive. One HTTP call. Any agent on any
> chain. The endpoint reads directly from the AnnealValidation contract
> — same answer the explorer just showed us. Cached thirty seconds.
> CORS open. No middleware."

**Fallback line if `tryanneal.xyz` is not yet live and you have to use local:**
```bash
curl -s http://localhost:3000/api/safety/0xb884... | jq
```
> "Running locally for the demo. Same logic, same on-chain reads."

---

## Section 5 — Corpus moment (2:05 → 2:20)

**On screen:** terminal again. Run the matcher one-liner.

**Type (paste-ready):**

```bash
PYTHONPATH=packages/detectors python3 -c "
from tryanneal_detectors.corpus.matcher import find_matches
src = open('packages/detectors/tests/fixtures/DonationAttack.sol').read()
m = find_matches(src, threshold=0.15)[0]
print(f'{int(m.similarity*100)}% similar to: {m.name}')
print(f'  losses: \${m.losses_usd/1e6:.0f}M')
print(f'  fix:    {m.recommended_fix[:80]}...')
"
```

**Output is one block:** `36% similar to: Euler Finance Donation Attack`, `losses: $197M`, `fix: ...`.

**Say:**
> "And the corpus matcher cross-references the contract structure against
> 113 vetted exploits. This DonationAttack fixture overlaps thirty-six
> percent with the Euler Finance pattern that lost a hundred and ninety-
> seven million dollars in March 2023. That's the kind of signal you
> want before you compose."

---

## Section 6 — Close (2:20 → 2:30)

**On screen:** mantlescan, browser tab with all four verified contracts list.

**Say:**
> "Four verified contracts on Mantle Sepolia, five audits posted, twenty
> findings, one safety endpoint. TryAnneal is the is-this-safe primitive
> the agent economy needs. Repo and live API in the description."

---

## Notes / risk

- **Don't show .env, decryption keys, or private keys.** If you scroll past
  them by accident, cut. Recommend: hide `.env`, `*.key.txt`, and `reports/`
  in the terminal's directory listing via shell alias before recording.
- **The corpus match doesn't trigger at the default 0.6 threshold during
  the live audit.** The matcher one-liner in Section 5 lowers the threshold
  to surface the closest match honestly. Don't fake the percentage.
- **One-take preferred but not required.** Re-record per section if a
  shot fumbles — they're independent. Stitch in the editor.
- **Music:** none. Voice only.
- **Captions:** burn-in subtitles for the commands you type and the verdict
  numbers, so the video reads on mute (LinkedIn / X autoplay).

## Quick-link reference (copy into the YouTube description)

- Repo: https://github.com/winsznx/tryanneal
- AnnealValidation: https://sepolia.mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E#code
- AnnealAgent: https://sepolia.mantlescan.xyz/address/0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924#code
- AnnealStaking: https://sepolia.mantlescan.xyz/address/0x370Fe4E74027ED0924F51361d61757D866c08eb0#code
- SampleVault verdict tx: https://sepolia.mantlescan.xyz/tx/0x6f1f65ae32c5ad3891d56c2b9ffd50ebc2638c30b5881c50d5e174fb38784a3a
- Safety oracle docs: https://github.com/winsznx/tryanneal/blob/main/packages/web/app/api/safety/README.md
