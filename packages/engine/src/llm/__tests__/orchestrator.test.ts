import { describe, it, expect, vi } from "vitest";
import { auditWithLLM } from "../orchestrator.js";
import { computeConsensus, computeVerdictScore, linesCompatible } from "../consensus.js";
import type { LLMProvider } from "../providers/types.js";
import type { CriticFinding, PreScreenFinding, SlitherCrossRef } from "../types.js";
import { LLMError } from "../types.js";

const SOURCE = "contract X { function withdraw() public {} }";

/** Build an in-memory LLMProvider whose `chat()` returns the given text or throws. */
function mockProvider(id: string, model: string, output: string | Error | (() => string | Error)): LLMProvider {
  return {
    id,
    model,
    defaultTimeoutMs: 5_000,
    chat: vi.fn(async () => {
      const v = typeof output === "function" ? output() : output;
      if (v instanceof Error) throw v;
      return { text: v, provider: id, model };
    }),
  };
}

const PRESCREEN_HIGH = JSON.stringify([
  {
    vuln_class: "reentrancy",
    severity: "high",
    line_start: 10,
    line_end: 20,
    description: "Reentrancy in withdraw",
    recommendation: "Use checks-effects-interactions",
  },
]);

const PRESCREEN_CLEAN = "[]";

const CRITIC_CONFIRM = JSON.stringify([
  {
    vuln_class: "reentrancy",
    severity: "high",
    line_start: 10,
    line_end: 20,
    description: "Confirmed reentrancy",
    confidence_pct: 90,
    confirmed_by_prescreener: true,
  },
]);

describe("auditWithLLM — orchestrator", () => {
  it("runs full cascade when pre-screen finds high severity", async () => {
    const prescreen = mockProvider("chaingpt", "general_assistant", PRESCREEN_HIGH);
    const gemini = mockProvider("gemini", "gemini-2.5-pro", CRITIC_CONFIRM);
    const groq = mockProvider("groq", "llama-3.3-70b-versatile", CRITIC_CONFIRM);

    const result = await auditWithLLM(SOURCE, [], { prescreen, critics: [gemini, groq] });

    expect(result.modelsUsed).toEqual(expect.arrayContaining(["chaingpt", "gemini", "groq"]));
    expect(result.prescreenOnly).toBe(false);
    expect(result.findings).toHaveLength(1);
    // 3 models agree out of 3 → 100% confidence (no Slither boost involved here).
    expect(result.findings[0]!.confidencePct).toBe(100);
  });

  it("early-returns when pre-screen finds nothing critical/high (no critic stage)", async () => {
    const prescreen = mockProvider("chaingpt", "general_assistant", PRESCREEN_CLEAN);
    const gemini = mockProvider("gemini", "gemini-2.5-pro", "should-not-be-called");
    const groq = mockProvider("groq", "llama-3.3-70b-versatile", "should-not-be-called");

    const result = await auditWithLLM(SOURCE, [], { prescreen, critics: [gemini, groq] });

    expect(result.prescreenOnly).toBe(true);
    expect(result.modelsUsed).toEqual(["chaingpt"]);
    expect(result.findings).toEqual([]);
    expect(result.verdictScore).toBe(100);
    expect(gemini.chat).not.toHaveBeenCalled();
    expect(groq.chat).not.toHaveBeenCalled();
  });

  it("produces a valid degraded result when one critic times out", async () => {
    const prescreen = mockProvider("chaingpt", "general_assistant", PRESCREEN_HIGH);
    const gemini = mockProvider("gemini", "gemini-2.5-pro", new LLMError("timeout", "TIMEOUT", "gemini"));
    const groq = mockProvider("groq", "llama-3.3-70b-versatile", CRITIC_CONFIRM);

    const result = await auditWithLLM(SOURCE, [], { prescreen, critics: [gemini, groq] });

    expect(result.modelsUsed).toEqual(expect.arrayContaining(["chaingpt", "groq"]));
    expect(result.modelsUsed).not.toContain("gemini");
    expect(result.modelsTimedOut).toContain("gemini");
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("falls back to pre-screen-only result when all critics fail", async () => {
    const prescreen = mockProvider("chaingpt", "general_assistant", PRESCREEN_HIGH);
    const gemini = mockProvider("gemini", "gemini-2.5-pro", new Error("gemini down"));
    const groq = mockProvider("groq", "llama-3.3-70b-versatile", new Error("groq down"));

    const result = await auditWithLLM(SOURCE, [], { prescreen, critics: [gemini, groq] });

    expect(result.modelsUsed).toEqual(["chaingpt"]);
    expect(result.prescreenOnly).toBe(true);
    // Single-model floor of 33% applies when only one LLM agrees and Slither doesn't hit.
    expect(result.findings[0]!.confidencePct).toBeGreaterThanOrEqual(33);
  });

  it("populates corpusContext snapshot on every audit result", async () => {
    const prescreen = mockProvider("chaingpt", "general_assistant", PRESCREEN_CLEAN);
    const result = await auditWithLLM(SOURCE, [], { prescreen, critics: [] });
    expect(result.corpusContext).toBeDefined();
    const ctx = result.corpusContext!;
    expect(ctx.totalPatterns).toBeGreaterThanOrEqual(90);
    expect(ctx.totalLossesUSD).toBeGreaterThan(6_500_000_000);
    expect(ctx.yearMin).toBe(2020);
    expect(ctx.yearMax).toBeGreaterThanOrEqual(2026);
    expect(ctx.chains).toEqual(expect.arrayContaining(["ethereum", "bsc", "solana"]));
    expect(ctx.matchesFound).toBe(0);
    expect(ctx.bestMatchSimilarity).toBe(0);
  });

  it("throws when no pre-screen provider is wired", async () => {
    await expect(auditWithLLM(SOURCE, [], { prescreen: null, critics: [] })).rejects.toMatchObject({
      code: "MISSING_KEY",
    });
  });
});

describe("computeConsensus — scoring", () => {
  const reentrancy: PreScreenFinding = {
    vulnClass: "reentrancy",
    severity: "high",
    lineStart: 10,
    lineEnd: 20,
    description: "x",
    recommendation: "y",
  };

  const reentrancyCritic = (model: string): CriticFinding => ({
    ...reentrancy,
    description: `from ${model}`,
    confidencePct: 80,
    confirmedByPrescreener: true,
  });

  it("3 of 3 models agree → 100% confidence", () => {
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: {
        gemini: [reentrancyCritic("gemini")],
        groq: [reentrancyCritic("groq")],
      },
      slither: [],
      modelsResponded: 3,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidencePct).toBe(100);
  });

  it("requires >=2 sources on a full panel, keeps single-source on a thin one", () => {
    // #given a full panel (2 critics) where ONLY gemini flags reentrancy
    const droppedFull = computeConsensus({
      prescreen: [],
      critics: { gemini: [reentrancyCritic("gemini")], groq: [] },
      slither: [],
      modelsResponded: 3,
    });
    // #then the uncorroborated single-source finding is dropped
    expect(droppedFull).toHaveLength(0);

    // #given a thin panel (no critics responded) with the same finding
    const keptThin = computeConsensus({
      prescreen: [reentrancy],
      critics: {},
      slither: [],
      modelsResponded: 2,
    });
    // #then it is kept (capped at 45) — a thin panel must not false-clean
    expect(keptThin).toHaveLength(1);
    expect(keptThin[0]!.confidencePct).toBe(45);
  });

  it("Slither cross-validation boosts confidence by 15 (capped at 99)", () => {
    const slither: SlitherCrossRef[] = [{ vulnClass: "reentrancy", lineStart: 12, lineEnd: 18 }];
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: { gemini: [reentrancyCritic("gemini")], groq: [] },
      slither,
      modelsResponded: 3,
    });
    // 2/3 = 67, +15 = 82
    expect(findings[0]!.confidencePct).toBe(82);
    expect(findings[0]!.sources).toContain("slither");
  });

  it("caps Slither-boosted confidence at 99", () => {
    const slither: SlitherCrossRef[] = [{ vulnClass: "reentrancy", lineStart: 12, lineEnd: 18 }];
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: {
        gemini: [reentrancyCritic("gemini")],
        groq: [reentrancyCritic("groq")],
      },
      slither,
      modelsResponded: 3,
    });
    expect(findings[0]!.confidencePct).toBe(99);
  });

  it("kills sub-20% findings and caps a lone uncorroborated model", () => {
    // #given a single model out of 100 responders → ~1% → below the 20% floor
    const killed = computeConsensus({
      prescreen: [reentrancy],
      critics: {},
      slither: [],
      modelsResponded: 100,
    });
    // #then it is dropped entirely
    expect(killed).toEqual([]);

    // #given a lone model (1 of 2) with no Slither corroboration
    const lone = computeConsensus({
      prescreen: [reentrancy],
      critics: {},
      slither: [],
      modelsResponded: 2,
    });
    // #then its confidence is CAPPED at 45 — never the raw 50% ratio, never
    // floored up to look more certain than a single uncorroborated voice is
    expect(lone[0]?.confidencePct).toBe(45);

    const empty = computeConsensus({
      prescreen: [],
      critics: {},
      slither: [],
      modelsResponded: 1,
    });
    expect(empty).toEqual([]);
  });
});

describe("computeVerdictScore", () => {
  it("clamps to 0-100 and applies confidence-weighted severity penalties", () => {
    expect(computeVerdictScore([])).toBe(100);
    // #given a MEDIUM (penalty 10) and a LOW (penalty 3), both at 80% confidence
    // #then the penalty is weighted: 10*0.8 + 3*0.8 = 10.4 → 100 - 10.4 ≈ 90
    expect(
      computeVerdictScore([
        {
          vulnClass: "x",
          severity: "medium",
          lineStart: 1,
          lineEnd: 1,
          description: "",
          recommendation: "",
          confidencePct: 80,
          sources: ["chaingpt"],
        },
        {
          vulnClass: "y",
          severity: "low",
          lineStart: 1,
          lineEnd: 1,
          description: "",
          recommendation: "",
          confidencePct: 80,
          sources: ["chaingpt"],
        },
      ]),
    ).toBe(90);
    const fives = Array.from({ length: 5 }, () => ({
      vulnClass: "c",
      severity: "critical" as const,
      lineStart: 1,
      lineEnd: 1,
      description: "",
      recommendation: "",
      confidencePct: 90,
      sources: ["gemini"] as ("gemini")[],
    }));
    expect(computeVerdictScore(fives)).toBe(0);
  });
});

describe("linesCompatible — same-class merge rule (general, not reentrancy-specific)", () => {
  it("treats unknown lines (0) as a wildcard — LLMs often omit precise lines", () => {
    // #given an LLM finding with no line info and a Slither finding deep in the file
    // #then they are line-compatible (class match decides)
    expect(linesCompatible(0, 0, 734, 739)).toBe(true);
    expect(linesCompatible(734, 739, 0, 0)).toBe(true);
  });

  it("matches overlapping and near-adjacent ranges (drift tolerance)", () => {
    expect(linesCompatible(10, 20, 15, 25)).toBe(true);
    expect(linesCompatible(10, 12, 14, 18)).toBe(true); // 2-line gap, within tolerance
  });

  it("does NOT merge distant precise ranges of the same class (two real, separate bugs)", () => {
    expect(linesCompatible(10, 12, 500, 520)).toBe(false);
  });
});

describe("computeConsensus — Slither cross-validation works for every bug class", () => {
  const critic = (vulnClass: string, severity: CriticFinding["severity"]): CriticFinding => ({
    vulnClass,
    severity,
    lineStart: 0,
    lineEnd: 0,
    description: `${vulnClass} finding`,
    recommendation: "",
    confidencePct: 80,
    confirmedByPrescreener: false,
  });
  const prescreen = (vulnClass: string, severity: PreScreenFinding["severity"]): PreScreenFinding => ({
    vulnClass,
    severity,
    lineStart: 0,
    lineEnd: 0,
    description: `${vulnClass} finding`,
    recommendation: "",
  });

  it("merges Slither into a same-class LLM finding even with no LLM line numbers — REENTRANCY", () => {
    // #given the LLMs flag reentrancy with line 0 and Slither flags reentrancy-eth at 734-739
    const out = computeConsensus({
      prescreen: [prescreen("Reentrancy", "high")],
      critics: { groq: [critic("Reentrancy", "high")] },
      slither: [{ vulnClass: "reentrancy-eth", lineStart: 734, lineEnd: 739 }],
      modelsResponded: 2,
    });
    // #then one finding, cross-validated by Slither (not two redundant findings)
    expect(out).toHaveLength(1);
    expect(out[0]!.sources).toContain("slither");
  });

  it("merges Slither into a same-class LLM finding — ACCESS CONTROL (a different bug class)", () => {
    // #given an 'unprotected function' from the LLMs and Slither's 'suicidal' — both normalize to access-control
    const out = computeConsensus({
      prescreen: [prescreen("Unprotected function", "medium")],
      critics: { groq: [critic("Missing access control", "medium")] },
      slither: [{ vulnClass: "suicidal", lineStart: 761, lineEnd: 778 }],
      modelsResponded: 2,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.sources).toContain("slither");
  });

  it("does NOT cross-validate across different classes (reentrancy LLM vs tx-origin Slither)", () => {
    const out = computeConsensus({
      prescreen: [prescreen("Reentrancy", "high")],
      critics: { groq: [critic("Reentrancy", "high")] },
      slither: [{ vulnClass: "tx-origin", lineStart: 10, lineEnd: 12 }],
      modelsResponded: 2,
    });
    expect(out).toHaveLength(1);
    expect(out[0]!.sources).not.toContain("slither");
  });
});
