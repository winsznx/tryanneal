import { DocTitle, Lead, H2, P, A, UL, LI, Table, Code, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Detectors & Corpus" };

export default function DetectorsDocs() {
  return (
    <article>
      <DocTitle eyebrow="How it works">Detectors &amp; Corpus</DocTitle>
      <Lead>
        15 custom Slither detectors plus a 98-pattern exploit corpus — the layer a generic Slither
        wrapper doesn’t have.
      </Lead>

      <H2>Custom detectors</H2>
      <Table
        head={["Group", "Detectors"]}
        rows={[
          ["Agent-context", <Code key="c">agent-reentrancy · agent-callback-loop</Code>],
          ["Mantle-specific", <Code key="c">arsia-anti-patterns · calldata-bloat · l1block-unchecked-read · operator-fee-outlier</Code>],
          ["Exploit patterns", <Code key="c">single-dvn-verifier · donation-attack · init-unprotected · oracle-no-staleness · proxy-storage-collision · approval-abuse-arbitrary-call · signature-replay-bypass · amm-spot-oracle-dependency · vault-share-rounding</Code>],
          ["Meta", <Code key="c">corpus-match</Code>],
        ]}
      />
      <P>
        Agent-context detectors are net-new IP for ERC-8004 contract patterns. The exploit-pattern
        detectors each encode a real incident — KelpDAO/LayerZero DVN ($292M), Euler donation ($197M),
        Nomad init ($190M), and more.
      </P>

      <H2>The corpus</H2>
      <UL>
        <LI><strong>98 vetted exploits</strong>, $7.1B in documented losses, 13 chains, 2020–2026.</LI>
        <LI>Regenerated from raw research dumps by <Code>build_corpus.py</Code> — the moat stays current cheaply.</LI>
        <LI>Matched by <strong>TF-IDF cosine similarity</strong> (Jaccard fallback) with a vulnerability-class boost and a detection-difficulty downgrade, surfacing the threat actor + linked incident.</LI>
      </UL>
      <Callout tone="good">
        The demo line: <em>“your code is 84% similar to the $292M KelpDAO drain — linked to Radiant
        Capital, DPRK Citrine Sleet cluster.”</em> That’s memory of every major exploit since 2020, not
        generic LLM output.
      </Callout>

      <H2>Reproducible</H2>
      <P>
        The <A href="/docs/benchmarks">benchmark suite</A> runs the detectors + corpus (no LLM) against
        known-vulnerable and clean fixtures: precision 100%, recall 100%, F1 1.00.
      </P>

      <PageNav prev={{ title: "Telegram", href: "/docs/telegram" }} next={{ title: "Contracts & ERC-8004", href: "/docs/contracts" }} />
    </article>
  );
}
