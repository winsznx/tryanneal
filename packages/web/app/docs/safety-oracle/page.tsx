import { DocTitle, Lead, H2, P, A, Code, Pre, Table, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Safety Oracle API" };

export default function SafetyOracleDocs() {
  return (
    <article>
      <DocTitle eyebrow="Use it">Safety Oracle API</DocTitle>
      <Lead>
        A public REST endpoint that reads the verdict straight from the on-chain registry. No SDK, no
        API key, open CORS — the same call any agent makes. Base: <Code>https://tryanneal.xyz</Code>.
      </Lead>

      <H2>GET /api/safety/&#123;codeHash&#125;</H2>
      <P>Returns the on-chain verdict for a code hash. <Code>?network=mantle</Code> (default) or <Code>mantle-sepolia</Code>.</P>
      <Pre lang="bash">{`curl "https://tryanneal.xyz/api/safety/0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab?network=mantle"`}</Pre>
      <Pre lang="json">{`{
  "safe": true,
  "score": 100,
  "agentId": 131,
  "criticalCount": 0,
  "highCount": 0,
  "attestedBy": "TryAnneal/Anneal",
  "attestedAt": "2026-06-15T09:33:10.000Z",
  "validationContract": "0xf02C982D19184c11b86BC34672441C45fBF0f93E"
}`}</Pre>
      <Table
        head={["Status", "Meaning"]}
        rows={[
          ["200", "Verdict found"],
          ["404", "No verdict on-chain for this hash"],
          ["400", "Malformed code hash"],
          ["502", "RPC failure"],
        ]}
      />
      <Callout>
        <Code>safe</Code> is opinionated: any critical OR high finding flips it false — a single
        critical at 90/100 still kills composability.
      </Callout>

      <H2>POST /api/safety/audit</H2>
      <P>
        Submit source for a live audit. Runs the full cascade when keys are configured, else falls back
        to Slither-only (<Code>mode: &quot;static-only&quot;</Code>). Rate-limited to 1 request / 5 min / IP.
      </P>
      <Pre lang="bash">{`curl -X POST https://tryanneal.xyz/api/safety/audit \\
  -H "content-type: application/json" \\
  -d '{"sourceCode": "pragma solidity ^0.8.19; contract V { ... }"}'`}</Pre>
      <P>
        Returns the verdict, findings, gas profile, corpus context, and the AES-GCM decryption key —
        once. TryAnneal never stores it.
      </P>

      <Callout tone="good">
        Full spec, including the on-chain code hashes you can query today:{" "}
        <A href="https://github.com/winsznx/tryanneal/blob/main/packages/web/app/api/safety/README.md">safety API README</A>.
      </Callout>

      <PageNav prev={{ title: "CLI", href: "/docs/cli" }} next={{ title: "MCP Server", href: "/docs/mcp" }} />
    </article>
  );
}
