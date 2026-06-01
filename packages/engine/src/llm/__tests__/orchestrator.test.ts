import { describe, it, expect, vi } from "vitest";
import { auditWithLLM } from "../orchestrator.js";
import { computeConsensus, computeVerdictScore } from "../consensus.js";
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

  it("1 of 3 models flagged with no slither hit gets floored to 33%", () => {
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: { gemini: [], groq: [] },
      slither: [],
      modelsResponded: 3,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidencePct).toBe(33);
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

  it("kills findings below 20% confidence", () => {
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: {},
      slither: [],
      modelsResponded: 100,
    });
    expect(findings[0]?.confidencePct).toBe(33);

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
  it("clamps to 0-100 and applies severity penalties", () => {
    expect(computeVerdictScore([])).toBe(100);
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
    ).toBe(87);
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
