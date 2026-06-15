# Security Policy

TryAnneal is a smart-contract security tool, so we hold our own code to the
standard we apply to others'.

## Scope

This policy covers the TryAnneal monorepo:

- **Smart contracts** — `AnnealAgent`, `AnnealValidation`, `AnnealStaking`
  (`packages/contracts/`), deployed on Mantle mainnet (chain 5000) and Sepolia
  (chain 5003).
- **Audit engine** — `packages/engine/` (Slither/Aderyn wrappers, LLM cascade,
  Arsia gas profiler, AES-256-GCM privacy layer, on-chain attestation).
- **Detector plugin** — `packages/detectors/` (Python Slither plugin + corpus).
- **Safety oracle API** — `packages/web/app/api/safety/`.
- **CLI and Telegram bot** — `packages/cli/`, `packages/telegram/`.

## Reporting a vulnerability

Email **xidoncapitals@gmail.com** with:

1. A description of the issue and its impact.
2. Steps to reproduce (a PoC contract or script is ideal).
3. The affected package, file, and commit hash.

Please **do not** open a public GitHub issue for security-sensitive reports.
We aim to acknowledge within 72 hours.

## Deployed-contract notes

The on-chain contracts are deployed for the Mantle Turing Test 2026 hackathon
and are **not audited by a third party**. Treat them as reference
implementations:

- `AnnealValidation` is a public append-only verdict registry. `postVerdict`
  is permissionless by design in v1 — any address can post a verdict for any
  `codeHash`. Consumers should weight verdicts by the posting `agentId` and the
  agent's on-chain reputation, not trust them blindly. Production deployments
  should gate `postVerdict` behind the registered agent's wallet and/or
  staked-auditor checks.
- `AnnealStaking` implements slashing controlled by `ARBITRATOR_ROLE`. In the
  hackathon deployment that role is a single EOA; production should use a
  multisig.
- Private keys, AES decryption keys, and API keys are **never** committed.
  `.env` files are gitignored. Audit decryption keys are returned to the
  caller once and never stored server-side (crypto-shredding by design).

## Disclosure of findings produced by TryAnneal

TryAnneal posts a public *verdict score* and severity counts on-chain, but
encrypts the detailed findings (AES-256-GCM). This is intentional: a public,
machine-readable "is this safe?" signal without broadcasting an exploit recipe
for unpatched code. The decryption key is held only by the report owner.
