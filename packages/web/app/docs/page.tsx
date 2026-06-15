import { DocTitle, Lead, H2, P, A, UL, LI, Table, Callout, PageNav, Code } from "../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Overview" };

export default function DocsOverview() {
  return (
    <article>
      <DocTitle eyebrow="Documentation">Overview</DocTitle>
      <Lead>
        TryAnneal is the <Code>is_this_safe()</Code> primitive for the Mantle agent economy — a
        multi-LLM smart-contract audit agent that posts verdicts on-chain, so any agent can check a
        contract before composing with it.
      </Lead>

      <Callout>
        <strong>Watch the launch film</strong> — TryAnneal in 70 seconds:{" "}
        <A href="https://x.com/tryanneal/status/2066582313517924820">the trust layer for autonomous software, in motion</A>.
      </Callout>

      <P>
        A contract goes in; a verdict comes back in seconds. The verdict is posted on-chain to the{" "}
        <Code>AnnealValidation</Code> registry on Mantle and is readable by anyone — through the CLI, a
        REST endpoint, an MCP tool, or a Telegram bot. TryAnneal itself is a registered ERC-8004 agent
        on Mantle mainnet (agent <strong>#131</strong>).
      </P>

      <H2>What makes it different</H2>
      <UL>
        <LI>
          <strong>A model cascade, not one.</strong> ChainGPT pre-screens; two architecturally-distinct
          critics — Groq Llama-3.3-70B and OpenAI GPT-OSS-120B — argue every finding and cross-validate
          each other (Gemini 2.5 Pro is an optional third critic, off by default); only multi-model
          agreement survives — cross-validated against Slither + Aderyn. A pre-screen failure never
          blocks the critics, and a contract that nothing could analyze is flagged{" "}
          <Code>analysisIncomplete</Code> — never reported as safe.
        </LI>
        <LI>
          <strong>Deterministic, reproducible verdicts.</strong> AI audits are usually non-deterministic;
          TryAnneal&rsquo;s are not. Temperature-0 (greedy, seeded) decoding on every model, a
          corroboration rule that a reported finding needs ≥2 independent sources (≥2 models, or a model
          + Slither, when the full panel runs), confidence-weighted scoring, and memoization by code hash
          (keccak/sha3 of the source) on the Telegram bot and hosted MCP mean the same contract always
          returns the same verdict.
        </LI>
        <LI>
          <strong>16 custom detectors + a 98-pattern exploit corpus</strong> covering $7.1B in
          documented losses (2020–2026, 13 chains), matched by TF-IDF cosine similarity.
        </LI>
        <LI>
          <strong>On-chain, end-to-end on Mantle.</strong> ERC-8004 identity + an on-chain verdict
          registry + a live audit of Merchant Moe’s ~$60M router, posted on mainnet.
        </LI>
        <LI>
          <strong>Reachable by any agent.</strong> Safety-oracle REST API, an MCP server, a Telegram
          bot + Mini App, and a GitHub Action — one verdict, many surfaces.
        </LI>
        <LI>
          <strong>Fits into CI/CD.</strong> A <A href="/docs/cli">GitHub Action</A> runs the
          deterministic audit (Slither + 16 detectors + corpus, no keys) on every PR that touches{" "}
          <Code>.sol</Code>, posts a <Code>✅ PASSED</Code> / <Code>❌ BLOCKED</Code> comment, and emits
          a red/green check-run that fails on high/critical or a sub-threshold score — so branch
          protection can block the merge.
        </LI>
        <LI>
          <strong>Multilingual reports.</strong> The audit runs in English, then Tencent Cloud Hunyuan
          translates the finished verdict + findings into the reader’s language (zh, es, ja, ko, fr,
          and more) — one click on <A href="/#try">the web /try page</A> or{" "}
          <Code>/audit 0x… zh</Code> in the Telegram bot.
        </LI>
      </UL>

      <H2>Surfaces</H2>
      <Table
        head={["Surface", "What you do", "Page"]}
        rows={[
          [<Code key="c">anneal</Code>, "Audit a file from the terminal", <A key="a" href="/docs/cli">CLI</A>],
          ["REST", "GET a verdict, POST a contract", <A key="a" href="/docs/safety-oracle">Safety Oracle API</A>],
          ["MCP", "Let any AI agent call is_this_safe()", <A key="a" href="/docs/mcp">MCP Server</A>],
          ["Telegram", "Audit from chat / Mini App", <A key="a" href="/docs/telegram">Telegram</A>],
          ["GitHub Action", "Gate every PR that touches Solidity — block the merge on a bad verdict", <A key="a" href="/docs/cli">CI</A>],
        ]}
      />

      <Callout tone="good">
        Try it now without installing anything:{" "}
        <A href="/#try">the live oracle on the home page</A>, or{" "}
        <A href="https://tryanneal.xyz/api/safety/0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab?network=mantle">
          curl the Merchant Moe verdict
        </A>
        .
      </Callout>

      <PageNav next={{ title: "Quickstart", href: "/docs/quickstart" }} />
    </article>
  );
}
