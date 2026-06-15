import { DocTitle, Lead, H2, P, A, UL, LI, Code, Pre, Table, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — MCP Server" };

export default function McpDocs() {
  return (
    <article>
      <DocTitle eyebrow="Use it">MCP Server</DocTitle>
      <Lead>
        TryAnneal is a Model Context Protocol server, so any MCP-capable agent — Claude Desktop,
        Claude Code, Cursor — can call <Code>is_this_safe()</Code> before composing with unknown code.
        The agent-economy thesis, made literal.
      </Lead>

      <H2>Tools</H2>
      <Table
        head={["Tool", "What it does", "Needs"]}
        rows={[
          [<Code key="c">is_this_safe(target, network)</Code>, "On-chain SAFE/UNSAFE verdict + 0–100 score. target = code hash OR contract address (verified source fetched + hashed). Default network is mantle-sepolia; pass \"mantle\" for the mainnet verdict.", "nothing"],
          [<Code key="c">audit_contract(sourceCode)</Code>, "Full audit — Slither + Aderyn + 16 custom detectors + the cross-validating LLM cascade + 98-pattern corpus. Memoized by code hash (keccak of source) — identical source returns the identical verdict.", "slither; LLM keys optional"],
          [<Code key="c">tryanneal_corpus_stats()</Code>, "The 98-pattern / $7.1B corpus (2020–2026, 13 chains), as a tool.", "nothing"],
        ]}
      />

      <H2>Hosted — just a URL (no install)</H2>
      <P>
        TryAnneal runs a public MCP server over <strong>Streamable HTTP</strong>. Point any URL-based MCP
        client at it — Claude Desktop / Claude Code custom connectors, Cursor, n8n — no local process, no keys:
      </P>
      <Pre lang="json">{`{
  "mcpServers": {
    "tryanneal": {
      "url": "https://mcp.tryanneal.xyz/mcp"
    }
  }
}`}</Pre>
      <P>
        <Code>is_this_safe</Code> and <Code>tryanneal_corpus_stats</Code> work immediately;{" "}
        <Code>audit_contract</Code> runs Slither server-side. Health check:{" "}
        <A href="https://mcp.tryanneal.xyz/">GET /</A>.
      </P>

      <H2>Or run it yourself (stdio)</H2>
      <Pre lang="bash">{`pnpm install
pnpm --filter @tryanneal/engine build
pnpm --filter @tryanneal/mcp build`}</Pre>
      <P>Claude Desktop / Claude Code (<Code>claude_desktop_config.json</Code> or a project <Code>.mcp.json</Code>):</P>
      <Pre lang="json">{`{
  "mcpServers": {
    "tryanneal": {
      "command": "node",
      "args": ["/abs/path/to/tryanneal/packages/mcp/dist/index.js"],
      "env": {
        "CHAINGPT_API_KEY": "optional — enables the LLM cascade (Groq Llama-3.3-70B + OpenAI GPT-OSS-120B critics; Gemini 2.5 Pro optional)",
        "HUNYUAN_API_KEY": "optional — Tencent Hunyuan, translates reports into the reader's language",
        "HUNYUAN_BASE_URL": "https://tokenhub-intl.tencentcloudmaas.com/v1",
        "HUNYUAN_MODEL": "hy-mt2-plus"
      }
    }
  }
}`}</Pre>

      <H2>What an agent sees</H2>
      <P>
        <Code>safe: true</Code> is a <strong>SAFE</strong> verdict; any critical or high finding flips it{" "}
        <strong>UNSAFE</strong>. The score below (100/100) is the live verdict for the Merchant Moe LB
        Router (~$60M TVL), attested on-chain by agent #131.
      </P>
      <Pre lang="text">{`agent → is_this_safe("0xfe32c438…", "mantle")
tool  → {
  "safe": true, "score": 100, "attestedByAgentId": 131,
  "registry": "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
  "recommendation": "No critical/high findings on record…"
}`}</Pre>

      <Callout tone="good">
        <Code>is_this_safe</Code> and <Code>tryanneal_corpus_stats</Code> are pure reads — no keys, no
        Slither, always available. Full reference:{" "}
        <A href="https://github.com/winsznx/tryanneal/blob/main/packages/mcp/README.md">packages/mcp/README.md</A>.
      </Callout>

      <PageNav prev={{ title: "Safety Oracle API", href: "/docs/safety-oracle" }} next={{ title: "Telegram", href: "/docs/telegram" }} />
    </article>
  );
}
