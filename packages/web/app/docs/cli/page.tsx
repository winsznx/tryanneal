import { DocTitle, Lead, H2, P, A, Code, Pre, Table, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — CLI" };

export default function CliDocs() {
  return (
    <article>
      <DocTitle eyebrow="Use it">CLI</DocTitle>
      <Lead>
        <Code>anneal audit &lt;file&gt;</Code> runs the whole pipeline from the terminal: static
        analysis, the multi-LLM cascade, the Arsia gas profile, the corpus match, and (optionally) an
        on-chain attestation.
      </Lead>

      <H2>Run an audit</H2>
      <Pre lang="bash">{`# No install — run the published CLI straight from npm
npx @tryanneal/cli audit ./Vault.sol --no-llm

# Static only — no API keys, fully deterministic
pnpm --filter @tryanneal/cli start audit ./Vault.sol --no-llm

# Full cascade — ChainGPT pre-screen → Groq + GPT-OSS critics (default; --quick opts out)
CHAINGPT_API_KEY=… GROQ_API_KEY=… \\
  pnpm --filter @tryanneal/cli start audit ./Vault.sol

# CI gate — exit non-zero if the verdict scores below 80
npx @tryanneal/cli audit ./Vault.sol --no-llm --threshold 80

# Audit + post the verdict on-chain (mainnet, agent #131)
DEPLOYER_PRIVATE_KEY=0x… \\
  pnpm --filter @tryanneal/cli start audit ./Vault.sol --network mantle --attest`}</Pre>
      <P>
        Each run opens with an animated <Code>TRYANNEAL</Code> banner, then prints an{" "}
        <Code>is_this_safe() → SAFE / UNSAFE</Code> verdict line with the 0–100 score, the list of
        deduplicated findings (each tagged with the engines that flagged it), and the Arsia gas profile.
      </P>
      <P>
        A single-contract audit runs the <strong>full critic cascade by default</strong> — ChainGPT
        pre-screen, then two architecturally-distinct Stage-2 critics fan out in parallel: Groq
        Llama-3.3-70B and OpenAI GPT-OSS-120B (both served on Groq), cross-validating each other. Gemini
        2.5 Pro is an optional third critic, off by default (its key is rate-limited). Pass{" "}
        <Code>--quick</Code> for a pre-screen-only pass. The cascade is resilient: a ChainGPT pre-screen
        failure is non-fatal and the critics still run, and if nothing could analyze the contract the
        verdict is flagged <Code>analysisIncomplete</Code> — it is never reported as safe.
      </P>
      <P>
        <strong>Deterministic, reproducible audits.</strong> The same contract always returns the same
        verdict — TryAnneal's answer to &ldquo;AI audits are non-deterministic.&rdquo; Every model
        decodes at temperature 0 (greedy, seeded); a corroboration rule requires every reported finding
        to have ≥2 independent sources (≥2 models, or a model plus Slither) when the full panel runs, so
        no single-model hunch drives the verdict; scoring is confidence-weighted; and the Telegram bot
        and hosted MCP memoize by code hash (keccak/sha3 of the source), so identical source returns the
        identical audit.
      </P>
      <P>
        Set <Code>HUNYUAN_API_KEY</Code> to translate the finished verdict and findings into the
        reader's language (zh, es, ja, ko, fr, and more) — the audit runs in English, then Tencent
        Hunyuan renders the multilingual report.
      </P>

      <H2>Flags</H2>
      <Table
        head={["Flag", "Effect"]}
        rows={[
          [<Code key="c">--threshold &lt;score&gt;</Code>, "Fail (exit 1) if the verdict scores below N; 0 = severity-only, fails on any high/critical"],
          [<Code key="c">--quick</Code>, "ChainGPT pre-screen only; skip the critic cascade"],
          [<Code key="c">--no-llm</Code>, "Static only (Slither + Aderyn + corpus), no API calls"],
          [<Code key="c">--no-aderyn</Code>, "Skip the Aderyn (Rust) static-analysis layer"],
          [<Code key="c">--gas-only</Code>, "Skip the security audit; only profile gas"],
          [<Code key="c">--attest</Code>, "Post the verdict on-chain via AnnealValidation"],
          [<Code key="c">--no-encrypt</Code>, "Skip AES-GCM encryption / report storage"],
          [<Code key="c">--detectors &lt;mode&gt;</Code>, "all · builtin · tryanneal"],
          [<Code key="c">-n, --network</Code>, "mantle (mainnet) or mantle-sepolia"],
        ]}
      />
      <P>
        Exit code is non-zero when a high/critical finding is present, or — with{" "}
        <Code>--threshold &lt;score&gt;</Code> — when the verdict scores below <Code>N</Code> (use{" "}
        <Code>--threshold 0</Code> for severity-only gating). That single exit code is the whole CI
        story.
      </P>

      <H2>Use it in CI — a GitHub Action PR gate</H2>
      <P>
        <A href="https://github.com/winsznx/tryanneal/blob/main/.github/workflows/anneal-audit.yml">
          <Code>.github/workflows/anneal-audit.yml</Code>
        </A>{" "}
        runs the deterministic audit (Slither + 16 TryAnneal detectors + the 98-pattern corpus — no LLM
        keys, no chain calls) on every PR that changes a <Code>.sol</Code> file. It does three things:
      </P>
      <P>
        <strong>1.</strong> Audits each changed contract with{" "}
        <Code>--threshold $ANNEAL_THRESHOLD</Code>. <strong>2.</strong> Posts a{" "}
        <Code>✅ TryAnneal — PASSED</Code> / <Code>❌ TryAnneal — BLOCKED</Code> comment on the PR with
        the full per-contract verdict. <strong>3.</strong> Emits a red/green check-run that fails when a
        contract has a high/critical finding or scores below the threshold — so{" "}
        <strong>branch protection can block the merge</strong>. The threshold defaults to 80 and is set
        per-repo via the <Code>ANNEAL_THRESHOLD</Code> repository variable.
      </P>
      <Pre lang="yaml">{`# .github/workflows/anneal-audit.yml
name: TryAnneal Security Audit
on:
  pull_request:
    paths: ["**/*.sol"]

permissions:
  contents: read
  pull-requests: write

jobs:
  audit:
    runs-on: ubuntu-latest
    env:
      # Merge gate: block the PR if a contract scores below this (default 80).
      ANNEAL_THRESHOLD: \${{ vars.ANNEAL_THRESHOLD || '80' }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: pnpm }
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }

      - run: pnpm install --frozen-lockfile
      - name: Install Slither + detectors
        run: |
          pip install tryanneal-detectors solc-select
          solc-select install 0.8.24 && solc-select use 0.8.24

      # Deterministic gate — exits non-zero on high/critical or score < threshold.
      - name: anneal audit
        run: |
          for f in $(git diff --name-only "origin/\${{ github.base_ref }}...HEAD" -- '**/*.sol'); do
            npx @tryanneal/cli audit "$f" --no-llm --no-encrypt --threshold "$ANNEAL_THRESHOLD"
          done`}</Pre>
      <Callout>
        The check-run is what branch protection watches. Mark{" "}
        <Code>anneal audit (Slither + corpus)</Code> a required status check and a PR can&apos;t merge
        while a changed contract is high/critical or below threshold — code review and CI gate in one.
      </Callout>

      <PageNav prev={{ title: "For agents", href: "/docs/agents" }} next={{ title: "Safety Oracle API", href: "/docs/safety-oracle" }} />
    </article>
  );
}
