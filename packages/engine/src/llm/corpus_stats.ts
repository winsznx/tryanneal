/** Snapshot of the TryAnneal exploit-corpus stats.
 *
 * Regenerated whenever `python build_corpus.py` runs. The engine surfaces
 * these in `AuditResult.corpusContext` so the CLI can print the banner line:
 *
 *   Audited against TryAnneal corpus: 113 exploit patterns | $10.1B losses | 2020-2026
 */
export interface CorpusContext {
  totalPatterns: number;
  totalLossesUSD: number;
  totalLossesHuman: string;
  yearMin: number;
  yearMax: number;
  chains: string[];
  matchesFound: number;
  bestMatchSimilarity: number;
}

export const CORPUS_SNAPSHOT: Omit<CorpusContext, "matchesFound" | "bestMatchSimilarity"> = {
  totalPatterns: 113,
  totalLossesUSD: 10_054_690_205,
  totalLossesHuman: "$10.1B",
  yearMin: 2020,
  yearMax: 2026,
  chains: [
    "arbitrum",
    "avalanche",
    "base",
    "bitcoin",
    "blast",
    "bsc",
    "ethereum",
    "fantom",
    "multi",
    "near",
    "optimism",
    "polygon",
    "solana",
  ],
};

/** Build the per-audit context block. `findings` are the post-merge LLMFindings. */
export function buildCorpusContext(findings: { vulnClass: string; confidencePct: number; description?: string }[]): CorpusContext {
  const corpusHits = findings.filter(
    (f) => f.vulnClass === "corpus-match" || /corpus match/i.test(f.description ?? ""),
  );
  const best = corpusHits.reduce((m, f) => Math.max(m, f.confidencePct), 0);
  return {
    ...CORPUS_SNAPSHOT,
    matchesFound: corpusHits.length,
    bestMatchSimilarity: best,
  };
}
