import { DocTitle, Lead, H2, P, UL, LI, Table, Callout, PageNav, Code } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Business model" };

export default function BusinessDocs() {
  return (
    <article>
      <DocTitle eyebrow="Project">Business model</DocTitle>
      <Lead>
        Security is a recurring spend, not a one-off. TryAnneal turns the $30k / one-month audit into a
        continuous, machine-priced service — with a credible path from hackathon to revenue.
      </Lead>

      <H2>The problem &amp; the market</H2>
      <P>
        Manual audits cost $15k–$80k and take weeks; the agent economy ships code continuously and
        composes with contracts it didn’t write. DeFi lost over $10.1B to exploits we catalogue — and
        most of it was a known pattern. The buyer is anyone deploying or composing on Mantle: protocols,
        agent builders, launchpads, and the agents themselves.
      </P>

      <H2>Revenue streams</H2>
      <Table
        head={["Stream", "Who pays", "Pricing"]}
        rows={[
          ["Per-audit", "Builders before deploy", "Pay-per-audit (gasless on Mantle); free static tier"],
          ["Continuous monitoring", "Live protocols", "Subscription — re-audit on every upgrade, alert on new corpus matches"],
          ["Safety-oracle calls", "Agents / integrators", "Metered API + MCP access above a free quota"],
          ["Staked attestation", "Auditors / DAOs", "Protocol fee on staked verdicts (60/30/10 split)"],
          ["Enterprise corpus", "Audit firms, L2s", "License the 113-pattern corpus + custom detectors"],
        ]}
      />

      <H2>Why it compounds (the moat)</H2>
      <UL>
        <LI><strong>The corpus is a flywheel.</strong> Every new exploit grows the corpus; every audit gets better — and the corpus is regenerated from raw research via <Code>build_corpus.py</Code>, so it’s cheap to keep current.</LI>
        <LI><strong>On-chain reputation.</strong> Verdicts accrue to agent #131; a track record other contracts can read is hard to fork.</LI>
        <LI><strong>Distribution is already built.</strong> CLI, REST, MCP, Telegram, GitHub Action — TryAnneal meets developers and agents where they already are.</LI>
      </UL>

      <H2>Go-to-market</H2>
      <UL>
        <LI>Land via the free static tier + GitHub Action (zero-friction, in the PR flow), expand to monitoring subscriptions.</LI>
        <LI>Distribute the MCP server so every AI coding agent can call <Code>is_this_safe()</Code> by default.</LI>
        <LI>Partner with Mantle protocols + launchpads to make a TryAnneal verdict a deploy-time checkbox.</LI>
      </UL>

      <Callout tone="good">
        It already works on a real asset: TryAnneal audited Merchant Moe’s ~$60M live router and posted
        the verdict on Mantle mainnet. The product loop — audit → on-chain verdict → readable by anyone —
        is closed today.
      </Callout>

      <PageNav prev={{ title: "Benchmarks", href: "/docs/benchmarks" }} />
    </article>
  );
}
