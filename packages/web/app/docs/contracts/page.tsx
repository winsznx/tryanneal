import { DocTitle, Lead, H2, P, A, UL, LI, Code, Table, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Contracts & ERC-8004" };

export default function ContractsDocs() {
  return (
    <article>
      <DocTitle eyebrow="How it works">Contracts &amp; ERC-8004</DocTitle>
      <Lead>
        TryAnneal is a registered ERC-8004 agent on Mantle mainnet (agent <strong>#131</strong>) and
        posts every verdict on-chain. All contracts are verified on mantlescan.
      </Lead>

      <H2>Deployed on Mantle mainnet (chain 5000)</H2>
      <Table
        head={["Contract", "Address", "Explorer"]}
        rows={[
          ["AnnealValidation", <Code key="c">0xf02C982D…0f93E</Code>, <A key="a" href="https://mantlescan.xyz/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E#code">source ✓</A>],
          ["AnnealAgent", <Code key="c">0x1DBf5d0A…1924</Code>, <A key="a" href="https://mantlescan.xyz/address/0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924#code">source ✓</A>],
          ["AnnealStaking (WMNT)", <Code key="c">0xf9f3A9F5…2372</Code>, <A key="a" href="https://mantlescan.xyz/address/0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372#code">source ✓</A>],
        ]}
      />

      <H2>ERC-8004 compliance</H2>
      <P>
        ERC-8004 (“Trustless Agents”) defines three registries: Identity (ERC-721), Reputation, and
        Validation. TryAnneal registered on the official mainnet Identity Registry{" "}
        <Code>0x8004A169…a432</Code> via <Code>register(string agentURI)</Code> — minting agentId 131,
        with the agent wallet set to the owner.
      </P>
      <UL>
        <LI>The agent card resolves at <A href="/agent.json">tryanneal.xyz/agent.json</A> and <A href="/.well-known/agent-registration.json"><Code>/.well-known/agent-registration.json</Code></A>, following the spec <Code>registration-v1</Code> schema (type, name, services, registrations, supportedTrust).</LI>
        <LI><strong>Validation Registry</strong> — <Code>AnnealValidation.postVerdict()</Code> records a per-codeHash verdict (score, severity counts, report URI, gas-report hash). <Code>getVerdict()</Code> is the read any agent uses.</LI>
        <LI><strong>Reputation</strong> — verdicts are indexed per <Code>agentId</Code>, so consumers can weight by the posting agent’s track record.</LI>
      </UL>
      <Callout tone="good">
        Verify it yourself:{" "}
        <A href="https://mantlescan.xyz/tx/0x599ff14f168dbe6dd31fe66125138f3fc64a4a50961e88e651aeb221be14a945">the agent-registration tx</A>,
        and the <A href="https://mantlescan.xyz/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96">Merchant Moe verdict</A> posted by agent #131.
      </Callout>

      <H2>AnnealStaking</H2>
      <P>
        Auditor accountability: stake MNT/WMNT, slashable on bad verdicts (2.5% default, 10% cap),
        7-day cooldown, 60/30/10 fee split (auditor / stakers / treasury). The economic backbone for a
        permissionless audit market.
      </P>

      <PageNav prev={{ title: "Detectors & Corpus", href: "/docs/detectors" }} next={{ title: "Benchmarks", href: "/docs/benchmarks" }} />
    </article>
  );
}
