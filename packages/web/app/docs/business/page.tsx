import { DocTitle, Lead, H2, H3, P, A, UL, LI, Table, Callout, PageNav, Code } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Business model" };

export default function BusinessDocs() {
  return (
    <article>
      <DocTitle eyebrow="Project">Business model</DocTitle>
      <Lead>
        Security is a recurring spend, not a one-off. TryAnneal turns the $30k / one-month audit into a
        continuous, machine-priced service — with a credible path from hackathon to revenue. Cost-to-serve
        is ~$0.04 and ~30s per audit; everything below is built on that unit.
      </Lead>

      <H2>The problem &amp; the buyer</H2>
      <P>
        Manual audits cost $15k–$80k and take weeks; the agent economy ships code continuously and
        composes with contracts it didn’t write. DeFi lost over $7.1B to exploits we catalogue — and
        most of it was a known pattern. The buyer is anyone deploying or composing on Mantle: protocols,
        agent builders, launchpads, and the agents themselves. But you can’t sell to everyone at once —
        so we lead with one.
      </P>

      <H2>ICP: the wedge customer</H2>
      <P>
        <strong>Primary ICP: AI agents and agent frameworks composing with Mantle contracts they didn’t
        write.</strong> When an autonomous agent is about to route user funds through a contract another
        agent (or human) deployed, it has no native way to ask “is this safe?” before it acts. That gap is
        new, unserved by the $30k human-audit market, and it’s exactly the surface the Mantle agent economy
        is being built on right now.
      </P>
      <P>
        <strong>The wedge:</strong> a single primitive — <Code>is_this_safe(target)</Code> — callable as
        one HTTP request, one MCP tool, or one CLI command, returning a verdict signed on-chain by ERC-8004
        agent #131. An agent framework integrates it once and every agent it spawns gets a safety check for
        free. We land there because it’s the one place no incumbent can serve: human audit firms don’t
        ship machine-callable, sub-30-second, deterministic verdicts, and general code tools don’t
        understand Mantle. From that beachhead we expand to the humans behind the agents — Mantle protocol
        teams shipping fast, launchpads, and CI pipelines — who want the same verdict in their PR flow.
      </P>
      <Callout tone="info">
        Why an agent and not a protocol team as the wedge: the agent is the only buyer whose alternative is
        <em> nothing</em> (today an agent simply trusts blindly), so the value of a verdict is highest and
        the switching cost is lowest. Protocol teams already have habits (a once-a-year human audit) to
        displace; agents have a vacuum to fill.
      </Callout>

      <H2>Market sizing (TAM / SAM / SOM)</H2>
      <P>
        Bottoms-up, two markets stacked: the established smart-contract audit spend, plus the emerging
        agent-to-agent trust market that didn’t exist a year ago. We show the reasoning, not just the
        numbers — judges should be able to check the multiplication.
      </P>
      <Table
        head={["Layer", "Sizing", "How we get there"]}
        rows={[
          [
            <strong key="tam">TAM ≈ $2.5–3B / yr</strong>,
            "Total security spend that could be machine-priced",
            "Smart-contract audit & monitoring is a multi-hundred-million market today and compounding ~30%/yr; layer on the nascent agent-to-agent verification + on-chain trust/compute spend the agent economy is creating. Order-of-magnitude: low-single-digit $B as audits become continuous rather than annual.",
          ],
          [
            <strong key="sam">SAM ≈ $120–180M / yr</strong>,
            "Audits & safety-checks reachable by an automated, agent-callable tool",
            "The slice that doesn’t require a human signature: pre-deploy checks, continuous re-audits on upgrade, and agent-time is_this_safe() calls — across Mantle + the EVM chains the bot already resolves (Ethereum, Base, Arbitrum, Optimism, BNB, Polygon, Avalanche). Roughly the share of audit demand that is high-frequency and price-sensitive enough to pick automation over a $30k engagement.",
          ],
          [
            <strong key="som">SOM ≈ $1–3M / yr (24-mo target)</strong>,
            "What TryAnneal can realistically capture",
            "Bottoms-up: ~200 Mantle/EVM protocol teams on continuous monitoring at $200–500/mo (~$0.7M) + a handful of agent-framework / launchpad integrations metering safety-oracle calls + a few enterprise corpus licenses. At ~$0.04 cost-to-serve, the call-metering line is almost pure margin.",
          ],
        ]}
      />
      <P>
        These are estimates, not booked revenue — TryAnneal has live infrastructure (agent #131, a $60M
        on-chain audit) but no claimed traction. The point is the shape: a real, growing audit market
        underneath a brand-new agent-trust market that needs a machine-priced primitive, which is precisely
        what we ship.
      </P>

      <H2>Pricing &amp; unit economics</H2>
      <P>
        One engine, four price points — each reconciled against the ~$0.04 / ~30s cost-to-serve so the
        margin is visible. Static, no-LLM audits are even cheaper to run (no API spend at all).
      </P>
      <Table
        head={["Tier", "Who it’s for", "Price", "Gross margin"]}
        rows={[
          [
            "Free / static",
            "First touch — CLI, web /try, GitHub Action",
            "$0 (Slither + Aderyn + corpus, no LLM)",
            "Loss-leader; cost ≈ compute only. The top of the funnel.",
          ],
          [
            "Pay-per-audit",
            "Builders before deploy",
            "~$2–5 per full LLM audit (gasless on Mantle)",
            "~$0.04 cost ⇒ >98% gross margin per audit",
          ],
          [
            "API + MCP subscription",
            "Agents, frameworks, CI integrators",
            "$200–500 / mo for metered is_this_safe() + continuous re-audit",
            "Memoized by code hash → repeat reads ≈ $0 to serve; near-software margin",
          ],
          [
            "Staking-secured enterprise",
            "Audit firms, L2s, DAOs needing accountable verdicts",
            "Annual license + protocol fee on staked verdicts",
            "Fee revenue on top of near-zero marginal cost",
          ],
        ]}
      />
      <H3>Staking &amp; slashing — the trust and revenue mechanism in one</H3>
      <P>
        The enterprise tier isn’t just a price — it’s an accountability primitive. Auditors stake
        <Code>MNT/USDC</Code> behind their verdicts via <Code>AnnealStaking</Code>. A verdict later proven
        wrong is <strong>slashed</strong> (2.5% default, 10% cap, 3/5-multisig arbitrator), so a published
        “safe” has real money behind it — the opposite of a free LLM opinion. Protocol fees on staked
        verdicts split <strong>60 / 30 / 10</strong> (auditor / protocol treasury / arbitration). This is
        what lets a consumer weight a TryAnneal verdict by on-chain reputation instead of blind trust, and
        it’s a revenue line that grows with stake, not headcount.
      </P>
      <Callout tone="good">
        The economics invert the incumbent model. A human audit is high-cost, one-time, and un-priceable
        per-call. TryAnneal is ~$0.04 per audit, memoized so identical source is free to re-serve, and
        deterministic so the verdict is the same every time — which is exactly what makes per-call pricing
        and an on-chain SLA (stake/slash) possible.
      </Callout>

      <H2>Competitive positioning</H2>
      <P>
        TryAnneal isn’t trying to out-audit a top-tier human firm on a once-a-year engagement. It wins on
        the axes the agent economy actually needs: price, latency, an on-chain-verifiable verdict, being
        callable by an agent, Mantle-native gas awareness, and determinism. This is industry positioning
        against established firms — the rows below name incumbents, not specific products’ private roadmaps.
      </P>
      <Table
        head={["", "Price / audit", "Latency", "On-chain verdict", "Agent / MCP-callable", "Mantle-native gas", "Deterministic"]}
        rows={[
          [
            <strong key="ta">TryAnneal</strong>,
            "~$0.04",
            "~30s",
            "Yes — ERC-8004 #131",
            "Yes (MCP + REST + CLI)",
            "Yes — Arsia 3-component",
            "Yes — temp-0, memoized",
          ],
          ["CertiK", "$ tens of thousands", "Weeks", "No (report PDF)", "No", "No", "Human-judgement"],
          ["OpenZeppelin", "$ tens of thousands", "Weeks", "No (report PDF)", "No", "No", "Human-judgement"],
          ["Cyfrin / Solodit", "Free–$$ (DB + contests)", "Hours–days", "No", "Partial (search, not a callable verdict)", "No", "N/A (knowledge base)"],
        ]}
      />
      <P>
        The honest read: incumbents produce a deeper human review and carry brand trust a hackathon project
        can’t claim — and for a one-shot pre-launch audit of a $500M protocol, you still hire them.
        TryAnneal owns the orthogonal lane they structurally can’t serve: the continuous, machine-callable,
        on-chain-verifiable, Mantle-aware safety check an agent needs <em>at runtime</em>, priced per call.
      </P>

      <H2>Revenue streams</H2>
      <Table
        head={["Stream", "Who pays", "Pricing"]}
        rows={[
          ["Per-audit", "Builders before deploy", "Pay-per-audit (gasless on Mantle); free static tier"],
          ["Continuous monitoring", "Live protocols", "Subscription — re-audit on every upgrade, alert on new corpus matches"],
          ["Safety-oracle calls", "Agents / integrators", "Metered API + MCP access above a free quota"],
          ["Staked attestation", "Auditors / DAOs", "Protocol fee on staked verdicts (60/30/10 split)"],
          ["Enterprise corpus", "Audit firms, L2s", "License the 98-pattern corpus + custom detectors"],
        ]}
      />

      <H2>Why it compounds (the moat)</H2>
      <UL>
        <LI><strong>The corpus is a flywheel.</strong> Every new exploit grows the corpus; every audit gets better — and the corpus is regenerated from raw research via <Code>build_corpus.py</Code>, so it’s cheap to keep current.</LI>
        <LI><strong>On-chain reputation.</strong> Verdicts accrue to agent #131; a track record other contracts can read is hard to fork.</LI>
        <LI><strong>Distribution is already built.</strong> CLI, REST, MCP, Telegram, GitHub Action — TryAnneal meets developers and agents where they already are.</LI>
      </UL>

      <H2>Post-hackathon go-to-market</H2>
      <P>
        A concrete 12-month plan, sequenced so each phase feeds the next. The distribution motion is
        deliberately product-led — npm, MCP, and Mantle ecosystem partnerships, not an outbound sales team.
      </P>
      <Table
        head={["Window", "Objective", "Distribution motion"]}
        rows={[
          [
            "0–3 months",
            "Land Mantle protocol teams. Get a TryAnneal verdict into deploy-time and PR flow for a cohort of live Mantle protocols + launchpads.",
            "Free static tier + GitHub Action (zero-friction, in the PR), CLI via npm (@tryanneal/cli already published), and direct Mantle-ecosystem outreach. Convert the free static users to pay-per-audit + monitoring.",
          ],
          [
            "3–6 months",
            "Agent-framework integrations. Become the default safety check inside agent frameworks and AI coding tools operating on Mantle.",
            "Ship the MCP server to marketplaces (Claude Desktop/Code, Cursor) so is_this_safe() is one config block away; partner with 2–3 agent frameworks to call it by default. Launch the API+MCP subscription.",
          ],
          [
            "6–12 months",
            "Become the default is_this_safe() primitive. Make an on-chain TryAnneal verdict the thing agents read before they compose, and stand up the staking-secured enterprise tier.",
            "MCP marketplace presence + Mantle ecosystem partnerships + on-chain reputation (agent #131) as the reference. Open auditor staking so third parties can post accountable, slashable verdicts under the protocol fee split.",
          ],
        ]}
      />
      <Callout tone="good">
        It already works on a real asset: TryAnneal audited Merchant Moe’s ~$60M live router and posted
        the verdict on Mantle mainnet. The product loop — audit → on-chain verdict → readable by anyone —
        is closed today, which is what makes every line above sell-able rather than speculative.
      </Callout>

      <PageNav prev={{ title: "Benchmarks", href: "/docs/benchmarks" }} />
    </article>
  );
}
