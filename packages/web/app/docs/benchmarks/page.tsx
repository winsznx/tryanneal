import { DocTitle, Lead, H2, P, A, Code, Pre, Table, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Benchmarks" };

export default function BenchmarksDocs() {
  return (
    <article>
      <DocTitle eyebrow="How it works">Benchmarks</DocTitle>
      <Lead>
        Black-box claims score lower. TryAnneal ships a reproducible benchmark — anyone can run it and
        get the same precision / recall.
      </Lead>

      <H2>Results</H2>
      <Table
        head={["Contract", "Exploit analog", "Losses", "Detected"]}
        rows={[
          ["MinterestVuln.sol", "Minterest Jul 2024 (Mantle)", "$1.4M", "✅ HIGH"],
          ["EulerDonation.sol", "Euler Mar 2023", "$197M", "✅ HIGH"],
          ["NomadInit.sol", "Nomad Aug 2022", "$190M", "✅ HIGH"],
          ["LayerZeroDVN.sol", "KelpDAO Apr 2026", "$292M", "✅ HIGH"],
          ["Clean1.sol", "—", "—", "✅ CLEAN"],
          ["Clean2.sol", "—", "—", "✅ CLEAN"],
        ]}
      />
      <Callout tone="good">Precision 100% · Recall 100% · F1 1.00 · (TP=4, FN=0, FP=0, TN=2)</Callout>

      <H2>Gas optimization — measured before/after</H2>
      <P>
        The gas profiler’s saving estimates are no longer hand-waved. Each Mantle technique it advertises
        has a real naive/optimized contract pair that we compile with <Code>solc 0.8.24</Code> and run
        through the engine’s own <Code>computeFee</Code> Arsia model. The saving is measured on the{" "}
        <Code>L1-data</Code> fee — the FastLZ-driven, size-dependent component these techniques actually
        move on Mantle. L2 execution and operator fees are held fixed across both sides so the comparison
        isolates the size win.
      </P>
      <Table
        head={["Technique", "L1 before (MNT)", "L1 after (MNT)", "Measured saving"]}
        rows={[
          ["calldata_packing", "0.000000000540", "0.000000000506", "6.3%"],
          ["batch_operations", "0.000000002052", "0.000000000205", "90%"],
          ["storage_layout", "0.000000000971", "0.000000000901", "7.2%"],
        ]}
      />
      <Callout>
        batch_operations collapses ten separately-floored L1 minimums into one — the largest, most honest
        win. calldata_packing strips ABI’s 32-byte word alignment (2,372→580 bytes); storage_layout uses
        compile-time <Code>constant</Code>s to drop the constructor SSTOREs from the deploy init code
        (608→568 bytes). Numbers are the verbatim output of{" "}
        <Code>pnpm --filter @tryanneal/engine benchmark:gas</Code>.
      </Callout>

      <H2>Reproduce it</H2>
      <P>
        Every fixture runs <Code>runAudit(&#123; noLlm: true &#125;)</Code> — Slither + Aderyn + corpus
        only, no API keys, deterministic across runs. That’s the point: the verdict isn’t a black box.
      </P>
      <Pre lang="bash">{`pnpm --filter @tryanneal/engine benchmark
# writes packages/engine/benchmarks/results/latest.json

pnpm --filter @tryanneal/engine benchmark:gas
# writes packages/engine/benchmarks/results/gas-latest.json`}</Pre>
      <P>
        Methodology + the committed results live in{" "}
        <A href="https://github.com/winsznx/tryanneal/tree/main/packages/engine/benchmarks">packages/engine/benchmarks</A>.
      </P>

      <PageNav prev={{ title: "Contracts & ERC-8004", href: "/docs/contracts" }} next={{ title: "Business model", href: "/docs/business" }} />
    </article>
  );
}
