import type { AuditResult } from "./llm/types.js";
import type { MantleGasReport } from "./gas/types.js";

const VALIDATION_ABI = [
  "function postVerdict(uint256 agentId, bytes32 codeHash, uint8 verdictScore, uint8 criticalCount, uint8 highCount, uint8 mediumCount, uint8 lowCount, string reportURI, bytes32 gasReportHash) external",
];

export interface AttestationConfig {
  agentId: number;
  privateKey: string;
  validationContractAddress: string;
  rpcUrl: string;
  reportURI: string;
  sourceBytecode?: string; // 0x-prefixed; if omitted we hash sourceCode instead
  sourceCode?: string;
}

export interface AttestationResult {
  txHash: string;
  blockNumber: number;
  codeHash: string;
  gasReportHash: string;
}

function keccak256Hex(input: string | Uint8Array, ethers: typeof import("ethers")): string {
  const bytes = typeof input === "string" ? ethers.toUtf8Bytes(input) : input;
  return ethers.keccak256(bytes);
}

export async function postAuditOnChain(
  audit: AuditResult,
  gasReport: MantleGasReport,
  config: AttestationConfig,
): Promise<AttestationResult> {
  // Lazy import so engine package stays runtime-agnostic for non-attestation consumers.
  const ethers = await import("ethers");

  if (!config.sourceBytecode && !config.sourceCode) {
    throw new Error("postAuditOnChain: provide sourceBytecode or sourceCode to hash");
  }

  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const signer = new ethers.Wallet(config.privateKey, provider);
  const contract = new ethers.Contract(config.validationContractAddress, VALIDATION_ABI, signer);

  const codeBytes = config.sourceBytecode
    ? ethers.getBytes(config.sourceBytecode)
    : ethers.toUtf8Bytes(config.sourceCode!);
  const codeHash = keccak256Hex(codeBytes, ethers);
  const gasReportHash = keccak256Hex(
    JSON.stringify(gasReport, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
    ethers,
  );

  const counts = countBySeverity(audit);
  const score = clampU8(Math.round(audit.verdictScore));

  const postVerdict = contract.getFunction("postVerdict");
  const tx = await postVerdict(
    config.agentId,
    codeHash,
    score,
    counts.critical,
    counts.high,
    counts.medium,
    counts.low,
    config.reportURI,
    gasReportHash,
  );
  const receipt = await tx.wait();
  if (!receipt) throw new Error("no receipt");

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    codeHash,
    gasReportHash,
  };
}

export function countBySeverity(audit: AuditResult): { critical: number; high: number; medium: number; low: number } {
  const c = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of audit.findings) {
    if (f.severity === "critical") c.critical++;
    else if (f.severity === "high") c.high++;
    else if (f.severity === "medium") c.medium++;
    else if (f.severity === "low") c.low++;
  }
  return c;
}

function clampU8(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(255, Math.max(0, Math.floor(n)));
}
