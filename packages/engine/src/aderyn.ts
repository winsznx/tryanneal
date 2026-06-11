/**
 * Aderyn wrapper — Cyfrin's Rust-based Solidity static analyzer.
 *
 * Mirrors the shape of `slither.ts`: spawn the binary, parse the JSON
 * report, map to `Finding[]` with `source: "aderyn"`. Failures are typed
 * (NOT_INSTALLED / TIMEOUT / PARSE_ERROR / EXEC_ERROR) and the audit
 * orchestrator treats them as non-fatal — Aderyn complements Slither but
 * never blocks the pipeline.
 *
 * Aderyn 0.5+ emits a JSON report file at `--output <path>` (it does not
 * stream to stdout reliably). We write to a temp file, parse it, then
 * clean up. Aderyn expects a project root, not a single file — we point
 * it at the file's parent directory.
 *
 * Install: `cargo install aderyn` (or download a prebuilt binary from
 * https://github.com/cyfrin/aderyn/releases).
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { type Finding, type Severity, type SlitherConfidence } from "./types.js";

const DEFAULT_TIMEOUT_MS = 45_000;

export type AderynErrorCode = "NOT_INSTALLED" | "TIMEOUT" | "PARSE_ERROR" | "EXEC_ERROR";

export class AderynError extends Error {
  constructor(message: string, public readonly code: AderynErrorCode) {
    super(message);
    this.name = "AderynError";
  }
}

export interface RunAderynOptions {
  filePath: string;
  timeoutMs?: number;
  aderynBin?: string;
}

export interface AderynRunner {
  run: (args: string[], timeoutMs: number, cwd?: string) => Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
  }>;
}

export const defaultAderynRunner: AderynRunner = {
  run: (args, timeoutMs, cwd) =>
    new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn("aderyn", args, { stdio: ["ignore", "pipe", "pipe"], cwd });
      } catch (err) {
        reject(new AderynError(`Failed to spawn aderyn: ${(err as Error).message}`, "NOT_INSTALLED"));
        return;
      }

      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      child.on("error", (err: NodeJS.ErrnoException) => {
        clearTimeout(timer);
        if (err.code === "ENOENT") {
          reject(
            new AderynError(
              "aderyn binary not found on PATH. Install with: cargo install aderyn — or grab a prebuilt release at github.com/cyfrin/aderyn/releases",
              "NOT_INSTALLED",
            ),
          );
        } else {
          reject(new AderynError(`Aderyn spawn error: ${err.message}`, "EXEC_ERROR"));
        }
      });

      child.stdout?.on("data", (d) => (stdout += d.toString()));
      child.stderr?.on("data", (d) => (stderr += d.toString()));

      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new AderynError(`Aderyn timed out after ${timeoutMs}ms`, "TIMEOUT"));
          return;
        }
        resolve({ stdout, stderr, code });
      });
    }),
};

// ---------------------------------------------------------------------------
// JSON schema for Aderyn 0.5+ reports
// ---------------------------------------------------------------------------

interface AderynInstance {
  contract_path?: string;
  line_no?: number;
  src?: string;
  src_char?: string;
}

interface AderynIssue {
  title?: string;
  description?: string;
  detector_name?: string;
  instances?: AderynInstance[];
}

interface AderynIssueBucket {
  issues?: AderynIssue[];
}

/** Top-level shape we tolerate. Aderyn versions vary; we accept whatever
 *  matches `*_issues.issues[]`. */
interface AderynReport {
  high_issues?: AderynIssueBucket;
  medium_issues?: AderynIssueBucket;
  low_issues?: AderynIssueBucket;
  nc_issues?: AderynIssueBucket;
  informational_issues?: AderynIssueBucket;
}

const SEVERITY_BUCKETS: { key: keyof AderynReport; severity: Severity; confidence: SlitherConfidence }[] = [
  { key: "high_issues", severity: "high", confidence: "High" },
  { key: "medium_issues", severity: "medium", confidence: "Medium" },
  { key: "low_issues", severity: "low", confidence: "Medium" },
  { key: "informational_issues", severity: "informational", confidence: "Low" },
  { key: "nc_issues", severity: "informational", confidence: "Low" },
];

export function parseAderynOutput(raw: string): Finding[] {
  if (!raw.trim()) return [];
  let parsed: AderynReport;
  try {
    parsed = JSON.parse(raw) as AderynReport;
  } catch (err) {
    throw new AderynError(`Failed to parse Aderyn JSON: ${(err as Error).message}`, "PARSE_ERROR");
  }

  const findings: Finding[] = [];
  for (const bucket of SEVERITY_BUCKETS) {
    const issues = parsed[bucket.key]?.issues ?? [];
    for (const issue of issues) {
      const detector = issue.detector_name ?? slugify(issue.title ?? "aderyn-finding");
      const instances = issue.instances ?? [{ contract_path: "<unknown>", line_no: 0 }];
      findings.push({
        detector: `aderyn:${detector}`,
        severity: bucket.severity,
        confidence: bucket.confidence,
        description: issue.title
          ? `${issue.title}${issue.description ? ` — ${issue.description}` : ""}`
          : issue.description ?? "",
        source: "aderyn",
        locations: instances.map((i) => ({
          file: i.contract_path ?? "<unknown>",
          startLine: i.line_no ?? 0,
          endLine: i.line_no ?? 0,
          startOffset: 0,
          length: 0,
        })),
      });
    }
  }
  return findings;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Run Aderyn against a single Solidity file. Aderyn operates on a project
 * root, so we hand it the file's parent directory and capture the JSON
 * report written to a temp file.
 */
export async function runAderyn(
  opts: RunAderynOptions,
  runner: AderynRunner = defaultAderynRunner,
): Promise<Finding[]> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const tmpDir = await mkdtemp(join(tmpdir(), "tryanneal-aderyn-"));
  const reportPath = join(tmpDir, "report.json");
  const projectRoot = dirname(opts.filePath);

  try {
    const args = [projectRoot, "--output", reportPath, "--output-format", "json"];
    const { stderr, code } = await runner.run(args, timeout, projectRoot);

    // Aderyn returns non-zero when issues are found; that's not an error.
    let raw: string;
    try {
      raw = await readFile(reportPath, "utf8");
    } catch (err) {
      throw new AderynError(
        `Aderyn produced no report at ${reportPath} (exit ${code}). stderr: ${stderr.slice(0, 400)}`,
        "EXEC_ERROR",
      );
    }
    return parseAderynOutput(raw);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
