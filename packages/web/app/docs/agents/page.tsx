import { DocTitle, Lead, H2, P, A, UL, LI, Code, Pre, Table, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — For Agents" };

export default function AgentGuide() {
  return (
    <article>
      <DocTitle eyebrow="Use it">For agents</DocTitle>
      <Lead>
        TryAnneal is built to be called by other agents. Before your agent composes with a contract it
        didn&apos;t write, have it ask one question — <Code>is_this_safe()</Code> — and get back a verdict
        that&apos;s already signed on-chain.
      </Lead>

      <Callout tone="good">
        <strong>Activation:</strong> &ldquo;I check whether a smart contract is safe before you trust it.
        Give me a contract address or its source, and I&apos;ll return a verdict — safe or not, why, and a
        link to the on-chain attestation — in seconds.&rdquo;
      </Callout>

      <H2>What it does</H2>
      <P>
        Audits a smart contract with an LLM cascade — ChainGPT pre-screen, then two architecturally-distinct
        critics that cross-validate each other (Groq Llama-3.3-70B + OpenAI GPT-OSS-120B, Gemini 2.5 Pro an
        optional third critic, off by default) — alongside Slither + Aderyn with 16 custom detectors and a
        98-pattern exploit corpus ($7.1B in losses, 13 chains). Tencent Cloud Hunyuan handles 14-language
        report translation and per-finding remediation; it is not a critic. The verdict is then posted
        on-chain to the <Code>AnnealValidation</Code> registry on Mantle.
      </P>
      <P>
        <strong>Cross-validation, not a single oracle.</strong> A finding only survives if{" "}
        <strong>≥2 independent sources</strong> agree — two models, or a model plus Slither — and the same
        issue from multiple engines is deduped into one finding that lists all its sources (e.g.{" "}
        <Code>Reentrancy — flagged by chaingpt, groq, gpt-oss, slither</Code>). Single-model hunches are
        dropped. The verdict is deterministic and reproducible — the same contract always returns the same
        answer, run to run (temperature-0 seeded decoding + memoization by code hash). Any agent can read
        that verdict back — no re-audit needed. TryAnneal is itself a registered ERC-8004 agent (mainnet
        agent <strong>#131</strong>).
      </P>

      <H2>When to call it</H2>
      <UL>
        <LI>Before your agent sends funds to, approves, or composes with an unfamiliar contract.</LI>
        <LI>When another agent hands you an address and claims it&apos;s safe — verify, don&apos;t trust.</LI>
        <LI>Before deploying agent-authored Solidity to mainnet.</LI>
      </UL>

      <H2>Inputs &amp; outputs</H2>
      <Table
        head={["Call", "Input", "Output"]}
        rows={[
          [<Code key="a">is_this_safe(target, network)</Code>, "A contract address or code hash", "{ safe, score, criticalCount, highCount, attestedByAgentId, registry, recommendation }"],
          [<Code key="b">audit_contract(sourceCode)</Code>, "Solidity source", "{ verdictScore, severity counts, findings[], note }"],
          [<Code key="c">tryanneal_corpus_stats()</Code>, "—", "{ patterns, lossesUsd, chains, span }"],
        ]}
      />

      <H2>One example</H2>
      <Pre lang="text">{`agent → is_this_safe("0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a", "mantle")

tool  → {
  "safe": true,
  "score": 100,
  "criticalCount": 0,
  "highCount": 0,
  "attestedByAgentId": 131,
  "registry": "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
  "recommendation": "No critical/high findings on record — safe to compose."
}`}</Pre>
      <P>
        That target is Merchant Moe&apos;s live ~$60M LB Router on Mantle — a real verdict, posted on-chain
        by agent #131.
      </P>

      <H2>How to call it</H2>
      <UL>
        <LI><strong>MCP (any agent):</strong> point your client at <Code>https://mcp.tryanneal.xyz/mcp</Code> — see <A href="/docs/mcp">MCP Server</A>.</LI>
        <LI><strong>REST (one HTTP call):</strong> <Code>GET https://tryanneal.xyz/api/safety/&#123;addressOrHash&#125;?network=mantle</Code> — pass <Code>?network=mantle</Code> for the mainnet verdict (the default is <Code>mantle-sepolia</Code>); see <A href="/docs/safety-oracle">Safety Oracle API</A>.</LI>
        <LI><strong>CLI:</strong> <Code>npx anneal audit ./Contract.sol --network mantle</Code>; add <Code>--threshold 80</Code> to exit non-zero when the score falls below N (<Code>0</Code> = severity-only, fails on any high/critical) — see <A href="/docs/cli">CLI</A>.</LI>
        <LI><strong>CI / PR gate:</strong> the GitHub Action runs the deterministic audit (Slither + 16 detectors + corpus, no keys) on every PR that touches <Code>*.sol</Code>, posts a PASSED/BLOCKED comment, and emits a red/green check-run so branch protection can block the merge — see <A href="/docs/cli">CLI</A>.</LI>
        <LI><strong>Humans:</strong> paste a contract at <A href="/try">tryanneal.xyz/try</A> — plain-English verdict, with a SAFE/UNSAFE chip and &ldquo;cross-validated by N engines&rdquo; per-finding sources, no setup.</LI>
      </UL>

      <H2>Why trust the verdict</H2>
      <UL>
        <LI>Every verdict is signed on-chain by ERC-8004 agent #131 and is publicly readable — not a black box.</LI>
        <LI>The engine is benchmarked: P=100% / R=100% / F1=1.00 on a suite of real exploits (Minterest, Euler, Nomad, KelpDAO).</LI>
        <LI>It has already audited a live $60M protocol on mainnet, with the transaction on Mantlescan.</LI>
      </UL>

      <PageNav prev={{ title: "Architecture", href: "/docs/architecture" }} next={{ title: "CLI", href: "/docs/cli" }} />
    </article>
  );
}
