import { DocTitle, Lead, H2, P, A, Code, Pre, Table, PageNav } from "../../../src/components/doc";

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
      <Pre lang="bash">{`# Static only — no API keys, fully deterministic
pnpm --filter @tryanneal/cli start audit ./Vault.sol --no-llm

# Full cascade — ChainGPT pre-screen → Groq + GPT-OSS critics (default; --quick opts out)
CHAINGPT_API_KEY=… GROQ_API_KEY=… \\
  pnpm --filter @tryanneal/cli start audit ./Vault.sol

# Audit + post the verdict on-chain (mainnet, agent #131)
DEPLOYER_PRIVATE_KEY=0x… \\
  pnpm --filter @tryanneal/cli start audit ./Vault.sol --network mantle --attest`}</Pre>
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
      <P>Exit code is 1 when a high/critical finding is present — handy in CI.</P>

      <H2>In CI — audit every PR</H2>
      <P>
        <A href="https://github.com/winsznx/tryanneal/blob/main/.github/workflows/anneal-audit.yml">
          <Code>.github/workflows/anneal-audit.yml</Code>
        </A>{" "}
        runs <Code>anneal audit</Code> on every PR that changes a <Code>.sol</Code> file and posts the
        verdict as a PR comment — no keys required for the static path.
      </P>

      <PageNav prev={{ title: "For agents", href: "/docs/agents" }} next={{ title: "Safety Oracle API", href: "/docs/safety-oracle" }} />
    </article>
  );
}
