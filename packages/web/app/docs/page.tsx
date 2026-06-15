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

      <P>
        A contract goes in; a verdict comes back in seconds. The verdict is posted on-chain to the{" "}
        <Code>AnnealValidation</Code> registry on Mantle and is readable by anyone — through the CLI, a
        REST endpoint, an MCP tool, or a Telegram bot. TryAnneal itself is a registered ERC-8004 agent
        on Mantle mainnet (agent <strong>#131</strong>).
      </P>

      <H2>What makes it different</H2>
      <UL>
        <LI>
          <strong>Four LLMs, not one.</strong> ChainGPT pre-screens; Gemini, Groq, and Tencent Cloud
          Hunyuan argue every finding; only multi-model agreement survives — cross-validated against
          Slither + Aderyn.
        </LI>
        <LI>
          <strong>15 custom detectors + a 113-pattern exploit corpus</strong> covering $10.1B in
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
      </UL>

      <H2>Surfaces</H2>
      <Table
        head={["Surface", "What you do", "Page"]}
        rows={[
          [<Code key="c">anneal</Code>, "Audit a file from the terminal", <A key="a" href="/docs/cli">CLI</A>],
          ["REST", "GET a verdict, POST a contract", <A key="a" href="/docs/safety-oracle">Safety Oracle API</A>],
          ["MCP", "Let any AI agent call is_this_safe()", <A key="a" href="/docs/mcp">MCP Server</A>],
          ["Telegram", "Audit from chat / Mini App", <A key="a" href="/docs/telegram">Telegram</A>],
          ["GitHub Action", "Audit every PR that touches Solidity", <A key="a" href="/docs/cli">CI</A>],
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
