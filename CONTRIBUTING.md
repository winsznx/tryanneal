# Contributing to TryAnneal

Thanks for your interest. TryAnneal is a pnpm + Python monorepo; here's how to
get a working dev environment and the conventions we follow.

## Prerequisites

- **Node.js 20+** and **pnpm 9+**
- **Python 3.12+** (for the Slither detector plugin)
- **Slither** (`pip install slither-analyzer`) + **solc 0.8.24** (`solc-select install 0.8.24`)
- **Aderyn** (optional, `cargo install aderyn`) — second static-analysis layer
- A funded Mantle account only if you intend to deploy or post on-chain

See [`packages/contracts/SLITHER_SETUP.md`](packages/contracts/SLITHER_SETUP.md)
for the macOS Slither/solc setup that the test suite and benchmarks rely on.

## Setup

```bash
pnpm install
pnpm --filter @tryanneal/engine build
pip install -e packages/detectors   # registers the Slither plugin
cp .env.example .env                 # fill in keys you need (all optional for tests)
```

## Running the test suites

```bash
pnpm --filter @tryanneal/engine test            # Vitest — 62 tests
pnpm --filter @tryanneal/contracts exec hardhat test   # Hardhat/Mocha — 19 tests
cd packages/detectors && PYTHONPATH=. pytest    # pytest — 32 tests
pnpm --filter @tryanneal/engine benchmark       # reproducible benchmark
```

All three suites must pass before a PR is merged. The GitHub Actions workflow
([`.github/workflows/anneal-audit.yml`](.github/workflows/anneal-audit.yml))
additionally runs `anneal audit` on any changed `.sol` file and comments the
results on the PR.

## Conventions

- **TypeScript** — strict mode, no `any`/`@ts-ignore` without a justification
  comment, named exports, explicit return types on exported functions.
- **Tests as spec** — write the test first where practical. New detectors ship
  with a fixture in `packages/detectors/tests/fixtures/` and a test.
- **Commits** — imperative, scoped subject (`engine/gas: …`, `contracts: …`,
  `detectors/corpus: …`). Explain the *why* in the body. No AI-slop messages.
- **No secrets** — never commit `.env`, private keys, or API keys.
- **Corpus** — don't edit `patterns.json` by hand. Edit the source dumps in
  `packages/detectors/tryanneal_detectors/corpus/research/` and rerun
  `build_corpus.py`.

## Adding an LLM provider

The engine uses a clean adapter pattern. Add a file under
`packages/engine/src/llm/providers/`, implement the `LLMProvider` interface
(`chat(req, signal)`), export it from `providers/index.ts`, and wire an opt-in
key in `runAudit`. The orchestrator is provider-agnostic — no orchestrator
changes are needed.

## Adding a detector

1. Add the detector class under `packages/detectors/tryanneal_detectors/`.
2. Register it in `all_detectors.py`.
3. Add a triggering fixture + test under `tests/`.
4. If it encodes a historical exploit, add the incident to the corpus research
   dumps and rerun `build_corpus.py`.

## Reporting security issues

See [SECURITY.md](SECURITY.md). Do not open public issues for vulnerabilities.
