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

      <H2>Reproduce it</H2>
      <P>
        Every fixture runs <Code>runAudit(&#123; noLlm: true &#125;)</Code> — Slither + Aderyn + corpus
        only, no API keys, deterministic across runs. That’s the point: the verdict isn’t a black box.
      </P>
      <Pre lang="bash">{`pnpm --filter @tryanneal/engine benchmark
# writes packages/engine/benchmarks/results/latest.json`}</Pre>
      <P>
        Methodology + the committed results live in{" "}
        <A href="https://github.com/winsznx/tryanneal/tree/main/packages/engine/benchmarks">packages/engine/benchmarks</A>.
      </P>

      <PageNav prev={{ title: "Contracts & ERC-8004", href: "/docs/contracts" }} next={{ title: "Business model", href: "/docs/business" }} />
    </article>
  );
}
