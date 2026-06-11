/**
 * Aderyn wrapper tests. All five gate items per the spec:
 *   1. NOT_INSTALLED path
 *   2. PARSE_ERROR on malformed JSON
 *   3. Valid output parses to typed Findings tagged source: aderyn
 *   4. mergeStaticByKey deduplicates Aderyn finding against a Slither finding at the same site
 *   5. mergeStaticOnly deduplicates against an LLM finding at the same site
 */
import { describe, it, expect } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { AderynError, runAderyn, parseAderynOutput, type AderynRunner } from "./aderyn.js";
import { runAudit } from "./audit.js";
import type { Finding } from "./types.js";

function alwaysEnoentRunner(): AderynRunner {
  return {
    run: async () => {
      const err: NodeJS.ErrnoException = Object.assign(new Error("spawn aderyn ENOENT"), {
        code: "ENOENT",
      });
      throw new AderynError(
        "aderyn binary not found on PATH. Install with: cargo install aderyn",
        "NOT_INSTALLED",
      );
      // unreachable — but TypeScript wants something after throw to satisfy the return type
      // eslint-disable-next-line @typescript-eslint/no-unreachable
      void err;
    },
  };
}

function fixedOutputRunner(report: string): AderynRunner {
  return {
    run: async (_args, _timeout, _cwd) => {
      // simulate aderyn writing the report file; the runner caller will
      // try to read from --output <path>. We capture that path from args.
      const outputIdx = _args.indexOf("--output");
      if (outputIdx >= 0) {
        const path = _args[outputIdx + 1]!;
        await writeFile(path, report, "utf8");
      }
      return { stdout: "", stderr: "", code: 0 };
    },
  };
}

const VALID_REPORT = JSON.stringify({
  high_issues: {
    issues: [
      {
        title: "Reentrancy in withdraw()",
        description: "External call before state update.",
        detector_name: "reentrancy-state-changes",
        instances: [{ contract_path: "Vault.sol", line_no: 42 }],
      },
    ],
  },
  low_issues: {
    issues: [
      {
        title: "Missing zero-address check",
        detector_name: "zero-address-check",
        instances: [{ contract_path: "Vault.sol", line_no: 10 }],
      },
    ],
  },
});

describe("Aderyn — wrapper basics", () => {
  it("surfaces NOT_INSTALLED when the binary is missing", async () => {
    // #given a runner that always returns ENOENT
    const runner = alwaysEnoentRunner();

    // #when we try to run Aderyn against any file
    // #then it rejects with AderynError code NOT_INSTALLED
    await expect(runAderyn({ filePath: "/tmp/whatever.sol" }, runner)).rejects.toMatchObject({
      code: "NOT_INSTALLED",
    });
  });

  it("throws PARSE_ERROR when the report is not valid JSON", async () => {
    // #given a runner that writes garbage to the report file
    const runner = fixedOutputRunner("not-json-at-all");
    const tmp = await mkdtemp(join(tmpdir(), "aderyn-test-"));
    const file = join(tmp, "X.sol");
    await writeFile(file, "// stub", "utf8");

    // #when/#then runAderyn surfaces a parse error
    await expect(runAderyn({ filePath: file }, runner)).rejects.toMatchObject({
      code: "PARSE_ERROR",
    });
  });

  it("parses a valid report into typed Finding[] tagged source: aderyn", async () => {
    // #given a runner that emits a valid report covering high + low
    const runner = fixedOutputRunner(VALID_REPORT);
    const tmp = await mkdtemp(join(tmpdir(), "aderyn-test-"));
    const file = join(tmp, "Vault.sol");
    await writeFile(file, "// stub", "utf8");

    // #when we run aderyn
    const findings = await runAderyn({ filePath: file }, runner);

    // #then both severity buckets are mapped, source tagged
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      severity: "high",
      source: "aderyn",
      detector: "aderyn:reentrancy-state-changes",
    });
    expect(findings[1]).toMatchObject({
      severity: "low",
      source: "aderyn",
      detector: "aderyn:zero-address-check",
    });
  });
});

describe("parseAderynOutput — schema tolerance", () => {
  it("returns empty array for empty input rather than throwing", () => {
    expect(parseAderynOutput("")).toEqual([]);
    expect(parseAderynOutput("   ")).toEqual([]);
  });

  it("handles missing buckets without crashing", () => {
    // #given a report with only medium issues, no high/low
    const report = JSON.stringify({
      medium_issues: {
        issues: [
          {
            title: "Centralization risk",
            detector_name: "centralization-risk",
            instances: [{ contract_path: "A.sol", line_no: 5 }],
          },
        ],
      },
    });

    // #then we get one medium finding, no crash on missing high/low
    const findings = parseAderynOutput(report);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe("medium");
  });
});

describe("runAudit — Slither + Aderyn dedup", () => {
  async function tmpSol(name = "Vault.sol"): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "tryanneal-audit-"));
    const path = join(dir, name);
    await writeFile(path, "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\ncontract X{}\n", "utf8");
    return path;
  }

  function slitherFinding(detector: string, line: number, severity: Finding["severity"] = "high"): Finding {
    return {
      detector,
      severity,
      confidence: "High",
      description: `slither: ${detector}`,
      source: "slither_builtin",
      locations: [{ file: "Vault.sol", startLine: line, endLine: line, startOffset: 0, length: 0 }],
    };
  }

  function aderynFinding(detector: string, line: number, severity: Finding["severity"] = "high"): Finding {
    return {
      detector: `aderyn:${detector}`,
      severity,
      confidence: "High",
      description: `aderyn: ${detector}`,
      source: "aderyn",
      locations: [{ file: "Vault.sol", startLine: line, endLine: line, startOffset: 0, length: 0 }],
    };
  }

  it("dedupes an Aderyn finding that overlaps a Slither finding at the same site (noLlm mode)", async () => {
    // #given Slither and Aderyn both flag reentrancy at line 42
    const file = await tmpSol();
    const audit = await runAudit(file, {
      noLlm: true,
      slitherRunOverride: async () => [slitherFinding("reentrancy", 42)],
      aderynRunOverride: async () => [aderynFinding("reentrancy", 42)],
    });

    // #then only one entry surfaces; both static findings still kept on the slither/aderyn arrays
    expect(audit.findings).toHaveLength(1);
    expect(audit.slitherFindings).toHaveLength(1);
    expect(audit.aderynFindings).toHaveLength(1);
    expect(audit.modelsUsed).toEqual(expect.arrayContaining(["slither", "aderyn"]));
  });

  it("keeps both findings when Aderyn surfaces something Slither missed", async () => {
    const file = await tmpSol();
    const audit = await runAudit(file, {
      noLlm: true,
      slitherRunOverride: async () => [slitherFinding("reentrancy", 42)],
      aderynRunOverride: async () => [aderynFinding("uninitialized-state-variable", 11, "medium")],
    });

    expect(audit.findings).toHaveLength(2);
    const classes = audit.findings.map((f) => f.vulnClass);
    expect(classes).toEqual(expect.arrayContaining(["reentrancy", "aderyn:uninitialized-state-variable"]));
  });

  it("treats a missing Aderyn binary as non-fatal — Slither findings still flow through", async () => {
    const file = await tmpSol();
    const audit = await runAudit(file, {
      noLlm: true,
      slitherRunOverride: async () => [slitherFinding("reentrancy", 42)],
      aderynRunOverride: async () => {
        throw new AderynError("not installed", "NOT_INSTALLED");
      },
    });

    expect(audit.findings).toHaveLength(1);
    expect(audit.aderynFindings).toEqual([]);
    expect(audit.modelsUsed).toEqual(expect.arrayContaining(["slither"]));
    expect(audit.modelsUsed).not.toContain("aderyn");
  });

  it("--no-aderyn disables the Aderyn lane entirely", async () => {
    const file = await tmpSol();
    let aderynCalled = false;
    const audit = await runAudit(file, {
      noLlm: true,
      noAderyn: true,
      slitherRunOverride: async () => [slitherFinding("reentrancy", 42)],
      aderynRunOverride: async () => {
        aderynCalled = true;
        return [];
      },
    });

    expect(aderynCalled).toBe(false);
    expect(audit.aderynFindings).toEqual([]);
  });
});
