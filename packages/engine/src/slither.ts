import { spawn } from "node:child_process";
import {
  type Finding,
  type Severity,
  type SlitherDetector,
  type SlitherImpact,
  type SlitherOutput,
  SlitherError,
} from "./types.js";

const DEFAULT_TIMEOUT_MS = 30_000;

export type DetectorMode = "builtin" | "tryanneal" | "all";

export interface RunSlitherOptions {
  filePath: string;
  timeoutMs?: number;
  slitherBin?: string;
  /** Filesystem path to a Slither detector plugin directory, passed via `--detect`. */
  detectorsPath?: string;
  /** Which detector set to run. `all` (default) loads Slither builtins + tryanneal-detectors entry point. */
  detectors?: DetectorMode;
}

export interface SlitherRunner {
  run: (args: string[], timeoutMs: number) => Promise<{ stdout: string; stderr: string; code: number | null }>;
}

export const defaultRunner: SlitherRunner = {
  run: (args, timeoutMs) =>
    new Promise((resolve, reject) => {
      let child;
      try {
        child = spawn("slither", args, { stdio: ["ignore", "pipe", "pipe"] });
      } catch (err) {
        reject(new SlitherError(`Failed to spawn slither: ${(err as Error).message}`, "NOT_INSTALLED"));
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
          reject(new SlitherError("slither binary not found on PATH. Install with: pip install slither-analyzer", "NOT_INSTALLED"));
        } else {
          reject(new SlitherError(`Slither spawn error: ${err.message}`, "EXEC_ERROR"));
        }
      });

      child.stdout?.on("data", (d) => (stdout += d.toString()));
      child.stderr?.on("data", (d) => (stderr += d.toString()));

      child.on("close", (code) => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new SlitherError(`Slither timed out after ${timeoutMs}ms`, "TIMEOUT"));
          return;
        }
        resolve({ stdout, stderr, code });
      });
    }),
};

export function mapSeverity(impact: SlitherImpact): Severity {
  switch (impact) {
    case "High":
      return "high";
    case "Medium":
      return "medium";
    case "Low":
      return "low";
    case "Informational":
    case "Optimization":
      return "informational";
  }
}

export function parseSlitherOutput(raw: string): Finding[] {
  let parsed: SlitherOutput;
  try {
    parsed = JSON.parse(raw) as SlitherOutput;
  } catch (err) {
    throw new SlitherError(`Failed to parse Slither JSON output: ${(err as Error).message}`, "PARSE_ERROR");
  }

  if (!parsed.success && parsed.error) {
    throw new SlitherError(`Slither reported failure: ${parsed.error}`, "INVALID_INPUT");
  }

  const detectors = parsed.results?.detectors ?? [];
  return detectors.map(detectorToFinding);
}

function detectorToFinding(d: SlitherDetector): Finding {
  const isTryanneal = (TRYANNEAL_DETECTOR_ARGUMENTS as readonly string[]).includes(d.check);
  return {
    detector: d.check,
    severity: mapSeverity(d.impact),
    confidence: d.confidence,
    description: d.description,
    source: isTryanneal ? "tryanneal" : "slither_builtin",
    locations: d.elements.map((el) => {
      const sm = el.source_mapping;
      const lines = sm.lines ?? [];
      return {
        file: sm.filename_relative ?? sm.filename_absolute ?? sm.filename ?? "<unknown>",
        startLine: lines[0] ?? 0,
        endLine: lines[lines.length - 1] ?? lines[0] ?? 0,
        startOffset: sm.start,
        length: sm.length,
      };
    }),
  };
}

/** TryAnneal detector argument names — keep in sync with packages/detectors/. */
export const TRYANNEAL_DETECTOR_ARGUMENTS = [
  "agent-reentrancy",
  "agent-callback-loop",
  "calldata-bloat",
  "operator-fee-outlier",
  "l1block-unchecked-read",
  "arsia-anti-patterns",
  "single-dvn-verifier",
  "donation-attack",
  "init-unprotected",
  "oracle-no-staleness",
  "proxy-storage-collision",
  "corpus-match",
] as const;

export function buildSlitherArgs(opts: RunSlitherOptions): string[] {
  const args = [opts.filePath, "--json", "-"];
  if (opts.detectorsPath) args.push("--detect-path", opts.detectorsPath);
  const mode = opts.detectors ?? "all";
  if (mode === "tryanneal") {
    args.push("--detect", TRYANNEAL_DETECTOR_ARGUMENTS.join(","));
  } else if (mode === "builtin") {
    args.push("--exclude", TRYANNEAL_DETECTOR_ARGUMENTS.join(","));
  }
  return args;
}

export async function runSlither(
  opts: RunSlitherOptions,
  runner: SlitherRunner = defaultRunner,
): Promise<Finding[]> {
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { stdout, stderr, code } = await runner.run(buildSlitherArgs(opts), timeout);

  // Slither exits non-zero when findings are present — that's not an error.
  // Treat absence of JSON on stdout as a real failure.
  if (!stdout.trim()) {
    throw new SlitherError(
      `Slither produced no JSON output (exit ${code}). stderr: ${stderr.slice(0, 500)}`,
      "EXEC_ERROR",
    );
  }

  return parseSlitherOutput(stdout);
}
