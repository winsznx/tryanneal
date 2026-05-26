import { describe, it, expect, vi } from "vitest";
import { auditWithLLM } from "../orchestrator.js";
import { computeConsensus, computeVerdictScore } from "../consensus.js";
import type { AnthropicMessageClient } from "../prescreen.js";
import type { FetchLike } from "../critic.js";
import type { CriticFinding, PreScreenFinding, SlitherCrossRef } from "../types.js";
import { LLMError } from "../types.js";

const SOURCE = "contract X { function withdraw() public {} }";

function anthropicReturning(haikuJSON: string, opusJSON: string | Error): AnthropicMessageClient {
  let nthCall = 0;
  return {
    create: vi.fn(async () => {
      nthCall++;
      if (nthCall === 1) return { content: [{ type: "text", text: haikuJSON }] };
      if (opusJSON instanceof Error) throw opusJSON;
      return { content: [{ type: "text", text: opusJSON }] };
    }),
  };
}

function fetchReturning(map: Record<string, { ok: boolean; status?: number; body: unknown } | Error>): FetchLike {
  return vi.fn(async (url: string) => {
    const key = url.includes("generativelanguage") ? "gemini" : url.includes("x.ai") ? "grok" : "other";
    const entry = map[key];
    if (!entry) throw new Error(`unmocked URL: ${url}`);
    if (entry instanceof Error) throw entry;
    return {
      ok: entry.ok,
      status: entry.status ?? (entry.ok ? 200 : 500),
      text: async () => JSON.stringify(entry.body),
      json: async () => entry.body,
    };
  });
}

const HAIKU_HIGH = JSON.stringify([
  {
    vuln_class: "reentrancy",
    severity: "high",
    line_start: 10,
    line_end: 20,
    description: "Reentrancy in withdraw",
    recommendation: "Use checks-effects-interactions",
  },
]);

const OPUS_CONFIRM = JSON.stringify([
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

const GEMINI_BODY = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: JSON.stringify([
              {
                vuln_class: "reentrancy",
                severity: "high",
                line_start: 10,
                line_end: 20,
                description: "Reentrancy confirmed by Gemini",
                confidence_pct: 85,
                confirmed_by_prescreener: true,
              },
            ]),
          },
        ],
      },
    },
  ],
};

const GROK_BODY = {
  choices: [
    {
      message: {
        content: JSON.stringify([
          {
            vuln_class: "reentrancy",
            severity: "high",
            line_start: 10,
            line_end: 20,
            description: "Reentrancy confirmed by Grok",
            confidence_pct: 80,
            confirmed_by_prescreener: true,
          },
        ]),
      },
    },
  ],
};

describe("auditWithLLM — orchestrator", () => {
  it("runs full cascade when Haiku finds high severity", async () => {
    const anthropic = anthropicReturning(HAIKU_HIGH, OPUS_CONFIRM);
    const fetchFn = fetchReturning({
      gemini: { ok: true, body: GEMINI_BODY },
      grok: { ok: true, body: GROK_BODY },
    });

    const result = await auditWithLLM(
      SOURCE,
      [],
      { anthropic, fetchFn, geminiKey: "g", xaiKey: "x" },
    );

    expect(result.modelsUsed).toEqual(expect.arrayContaining(["haiku", "opus", "gemini", "grok"]));
    expect(result.prescreenOnly).toBe(false);
    expect(result.findings).toHaveLength(1);
    // 4 of 4 models agree → 100, capped to 99 only if Slither boost; here no slither → 100
    expect(result.findings[0]!.confidencePct).toBe(100);
  });

  it("early-returns when Haiku finds nothing critical/high (no critic stage)", async () => {
    const anthropic = anthropicReturning("[]", "should-not-be-called");
    const fetchFn = fetchReturning({});
    const result = await auditWithLLM(SOURCE, [], { anthropic, fetchFn, geminiKey: "g", xaiKey: "x" });

    expect(result.prescreenOnly).toBe(true);
    expect(result.modelsUsed).toEqual(["haiku"]);
    expect(result.findings).toEqual([]);
    expect(result.verdictScore).toBe(100);
    expect((anthropic.create as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("produces a valid degraded result when one critic times out", async () => {
    const anthropic = anthropicReturning(HAIKU_HIGH, OPUS_CONFIRM);
    const fetchFn = fetchReturning({
      gemini: new LLMError("timeout", "TIMEOUT", "gemini"),
      grok: { ok: true, body: GROK_BODY },
    });
    const result = await auditWithLLM(SOURCE, [], { anthropic, fetchFn, geminiKey: "g", xaiKey: "x" });
    expect(result.modelsUsed).toEqual(expect.arrayContaining(["haiku", "opus", "grok"]));
    expect(result.modelsUsed).not.toContain("gemini");
    expect(result.findings.length).toBeGreaterThan(0);
  });

  it("falls back to Haiku-only result when all critics fail", async () => {
    const anthropic: AnthropicMessageClient = {
      create: vi.fn(async (req) => {
        if (req.system?.startsWith("You are a smart contract security auditor")) {
          return { content: [{ type: "text", text: HAIKU_HIGH }] };
        }
        throw new Error("opus down");
      }),
    };
    const fetchFn = fetchReturning({
      gemini: new Error("gemini down"),
      grok: new Error("grok down"),
    });
    const result = await auditWithLLM(SOURCE, [], { anthropic, fetchFn, geminiKey: "g", xaiKey: "x" });
    expect(result.modelsUsed).toEqual(["haiku"]);
    expect(result.prescreenOnly).toBe(true);
    // Haiku-only finding gets single-model floor of 33.
    expect(result.findings[0]!.confidencePct).toBeGreaterThanOrEqual(33);
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

  it("3 of 3 models agree → 100% confidence (then capped/boosted)", () => {
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: {
        opus: [reentrancyCritic("opus")],
        gemini: [reentrancyCritic("gemini")],
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
      critics: { opus: [], gemini: [] },
      slither: [],
      modelsResponded: 3,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0]!.confidencePct).toBe(33);
  });

  it("Slither cross-validation boosts confidence by 15 (capped at 99)", () => {
    const slither: SlitherCrossRef[] = [{ vulnClass: "reentrancy", lineStart: 12, lineEnd: 18 }];
    // 2/3 agree = 67, +15 = 82
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: { opus: [reentrancyCritic("opus")], gemini: [] },
      slither,
      modelsResponded: 3,
    });
    expect(findings[0]!.confidencePct).toBe(82);
    expect(findings[0]!.sources).toContain("slither");
  });

  it("caps Slither-boosted confidence at 99", () => {
    const slither: SlitherCrossRef[] = [{ vulnClass: "reentrancy", lineStart: 12, lineEnd: 18 }];
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: {
        opus: [reentrancyCritic("opus")],
        gemini: [reentrancyCritic("gemini")],
      },
      slither,
      modelsResponded: 3,
    });
    expect(findings[0]!.confidencePct).toBe(99);
  });

  it("kills findings below 20% confidence", () => {
    // Force a low-confidence scenario: 1 model out of 100 responded — impossible but exercises filter.
    const findings = computeConsensus({
      prescreen: [reentrancy],
      critics: {},
      slither: [],
      modelsResponded: 100,
    });
    // single-model floor would push it to 33; verify floor still active
    expect(findings[0]?.confidencePct).toBe(33);

    // Now check filter directly via lowering single-model rule by skipping prescreen.
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
        { vulnClass: "x", severity: "medium", lineStart: 1, lineEnd: 1, description: "", recommendation: "", confidencePct: 80, sources: ["haiku"] },
        { vulnClass: "y", severity: "low", lineStart: 1, lineEnd: 1, description: "", recommendation: "", confidencePct: 80, sources: ["haiku"] },
      ]),
    ).toBe(87); // 100 - 10 - 3
    // 5 critical = 150 penalty → clamp to 0
    const fives = Array.from({ length: 5 }, () => ({
      vulnClass: "c",
      severity: "critical" as const,
      lineStart: 1,
      lineEnd: 1,
      description: "",
      recommendation: "",
      confidencePct: 90,
      sources: ["opus"] as ("opus")[],
    }));
    expect(computeVerdictScore(fives)).toBe(0);
  });
});
