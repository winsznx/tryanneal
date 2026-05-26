import { describe, it, expect } from "vitest";
import { parseSlitherOutput, mapSeverity, runSlither, type SlitherRunner } from "./slither.js";
import { SlitherError } from "./types.js";

const SAMPLE_OUTPUT = {
  success: true,
  error: null,
  results: {
    detectors: [
      {
        check: "reentrancy-eth",
        impact: "High",
        confidence: "Medium",
        description: "Reentrancy in Vault.withdraw()",
        elements: [
          {
            type: "function",
            name: "withdraw",
            source_mapping: {
              start: 1234,
              length: 500,
              filename_relative: "contracts/Vault.sol",
              lines: [42, 43, 44, 45, 46],
            },
          },
        ],
      },
      {
        check: "solc-version",
        impact: "Informational",
        confidence: "High",
        description: "Pragma version",
        elements: [],
      },
    ],
  },
};

describe("mapSeverity", () => {
  it("maps Slither impact to TryAnneal severity", () => {
    expect(mapSeverity("High")).toBe("high");
    expect(mapSeverity("Medium")).toBe("medium");
    expect(mapSeverity("Low")).toBe("low");
    expect(mapSeverity("Informational")).toBe("informational");
    expect(mapSeverity("Optimization")).toBe("informational");
  });
});

describe("parseSlitherOutput", () => {
  it("parses detectors into findings with locations", () => {
    const findings = parseSlitherOutput(JSON.stringify(SAMPLE_OUTPUT));
    expect(findings).toHaveLength(2);
    const reentrancy = findings[0]!;
    expect(reentrancy.detector).toBe("reentrancy-eth");
    expect(reentrancy.severity).toBe("high");
    expect(reentrancy.confidence).toBe("Medium");
    expect(reentrancy.source).toBe("slither");
    expect(reentrancy.locations[0]).toEqual({
      file: "contracts/Vault.sol",
      startLine: 42,
      endLine: 46,
      startOffset: 1234,
      length: 500,
    });
  });

  it("returns empty array when no detectors", () => {
    const findings = parseSlitherOutput(JSON.stringify({ success: true, error: null, results: {} }));
    expect(findings).toEqual([]);
  });

  it("throws PARSE_ERROR on invalid JSON", () => {
    expect(() => parseSlitherOutput("not json")).toThrow(SlitherError);
    try {
      parseSlitherOutput("not json");
    } catch (e) {
      expect((e as SlitherError).code).toBe("PARSE_ERROR");
    }
  });

  it("throws INVALID_INPUT when Slither reports failure", () => {
    const failed = JSON.stringify({ success: false, error: "compilation failed", results: {} });
    try {
      parseSlitherOutput(failed);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SlitherError);
      expect((e as SlitherError).code).toBe("INVALID_INPUT");
    }
  });
});

describe("runSlither", () => {
  it("returns findings when runner yields valid JSON", async () => {
    const runner: SlitherRunner = {
      run: async () => ({ stdout: JSON.stringify(SAMPLE_OUTPUT), stderr: "", code: 1 }),
    };
    const findings = await runSlither({ filePath: "Vault.sol" }, runner);
    expect(findings).toHaveLength(2);
  });

  it("throws NOT_INSTALLED when runner reports missing binary", async () => {
    const runner: SlitherRunner = {
      run: async () => {
        throw new SlitherError("slither binary not found", "NOT_INSTALLED");
      },
    };
    await expect(runSlither({ filePath: "x.sol" }, runner)).rejects.toMatchObject({ code: "NOT_INSTALLED" });
  });

  it("throws TIMEOUT when runner times out", async () => {
    const runner: SlitherRunner = {
      run: async () => {
        throw new SlitherError("Slither timed out", "TIMEOUT");
      },
    };
    await expect(runSlither({ filePath: "x.sol" }, runner)).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("throws EXEC_ERROR when stdout is empty", async () => {
    const runner: SlitherRunner = {
      run: async () => ({ stdout: "", stderr: "broken", code: 2 }),
    };
    await expect(runSlither({ filePath: "x.sol" }, runner)).rejects.toMatchObject({ code: "EXEC_ERROR" });
  });

  it("propagates INVALID_INPUT from parser", async () => {
    const runner: SlitherRunner = {
      run: async () => ({
        stdout: JSON.stringify({ success: false, error: "bad pragma", results: {} }),
        stderr: "",
        code: 255,
      }),
    };
    await expect(runSlither({ filePath: "x.sol" }, runner)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
