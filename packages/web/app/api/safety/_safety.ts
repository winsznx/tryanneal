/**
 * Shared helpers for the safety oracle endpoint.
 *
 * The "is_this_safe()" primitive — any agent (or judge) can hit GET
 * /api/safety/<codeHash> and get a structured verdict read directly from
 * AnnealValidation on Mantle Sepolia. No middleware between the questioner
 * and the on-chain truth.
 */
import { JsonRpcProvider, Contract } from "ethers";

const RPC_BY_NETWORK: Record<string, string> = {
  "mantle-sepolia": "https://rpc.sepolia.mantle.xyz",
  "mantle": "https://rpc.mantle.xyz",
};

const VALIDATION_BY_NETWORK: Record<string, string> = {
  "mantle-sepolia": "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
  // Mainnet TBD — falls through to 404 until deployed.
  "mantle": "",
};

const MANTLESCAN_BY_NETWORK: Record<string, string> = {
  "mantle-sepolia": "https://sepolia.mantlescan.xyz",
  "mantle": "https://mantlescan.xyz",
};

const VALIDATION_ABI = [
  "function getVerdict(bytes32 codeHash) external view returns (tuple(uint256 agentId, bytes32 codeHash, uint8 verdictScore, uint8 criticalCount, uint8 highCount, uint8 mediumCount, uint8 lowCount, string reportURI, uint256 timestamp, bytes32 gasReportHash))",
];

export type SafetyNetwork = "mantle-sepolia" | "mantle";

export interface VerdictRecord {
  agentId: number;
  codeHash: string;
  verdictScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  reportURI: string;
  timestamp: number;
  gasReportHash: string;
}

export interface SafetyVerdict {
  safe: boolean;
  score: number;
  codeHash: string;
  agentId: number;
  network: SafetyNetwork;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  reportURI: string;
  gasReportHash: string;
  attestedAt: string;
  attestedAtUnix: number;
  attestedBy: string;
  validationContract: string;
  mantlescanContractUrl: string;
}

export interface NoVerdict {
  safe: null;
  score: null;
  codeHash: string;
  network: SafetyNetwork;
  message: string;
}

/** Normalize 0x-prefixed 32-byte hash. Returns null for invalid input. */
export function normalizeCodeHash(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(v)) return null;
  return v;
}

export function resolveNetwork(raw: string | null | undefined): SafetyNetwork {
  if (raw === "mantle" || raw === "mantle-mainnet") return "mantle";
  return "mantle-sepolia";
}

let _providerCache: Record<string, JsonRpcProvider> = {};
function providerFor(network: SafetyNetwork): JsonRpcProvider {
  const url = RPC_BY_NETWORK[network];
  if (!url) throw new Error(`no RPC configured for ${network}`);
  if (!_providerCache[network]) {
    _providerCache[network] = new JsonRpcProvider(url, undefined, { staticNetwork: true });
  }
  return _providerCache[network]!;
}

export async function readVerdict(
  codeHash: string,
  network: SafetyNetwork,
): Promise<VerdictRecord | null> {
  const addr = VALIDATION_BY_NETWORK[network];
  if (!addr) return null;
  const provider = providerFor(network);
  const contract = new Contract(addr, VALIDATION_ABI, provider);
  const getVerdict = contract.getFunction("getVerdict");
  const raw = (await getVerdict(codeHash)) as unknown as Array<bigint | string>;
  // ethers returns tuples as proxy arrays; pull positionally for portability.
  const v = {
    agentId: Number(raw[0]),
    codeHash: String(raw[1]),
    verdictScore: Number(raw[2]),
    criticalCount: Number(raw[3]),
    highCount: Number(raw[4]),
    mediumCount: Number(raw[5]),
    lowCount: Number(raw[6]),
    reportURI: String(raw[7]),
    timestamp: Number(raw[8]),
    gasReportHash: String(raw[9]),
  } as VerdictRecord;
  if (v.timestamp === 0) return null;
  return v;
}

export function buildSafetyVerdict(v: VerdictRecord, network: SafetyNetwork): SafetyVerdict {
  const addr = VALIDATION_BY_NETWORK[network];
  const explorer = MANTLESCAN_BY_NETWORK[network] ?? "";
  // "safe" is opinionated: any critical OR high finding flips it false.
  // Score on its own isn't enough — a single critical at 90/100 still kills composability.
  const safe = v.criticalCount === 0 && v.highCount === 0;
  return {
    safe,
    score: v.verdictScore,
    codeHash: v.codeHash,
    agentId: v.agentId,
    network,
    criticalCount: v.criticalCount,
    highCount: v.highCount,
    mediumCount: v.mediumCount,
    lowCount: v.lowCount,
    reportURI: v.reportURI,
    gasReportHash: v.gasReportHash,
    attestedAt: new Date(v.timestamp * 1000).toISOString(),
    attestedAtUnix: v.timestamp,
    attestedBy: "TryAnneal/Anneal",
    validationContract: addr,
    mantlescanContractUrl: `${explorer}/address/${addr}`,
  };
}

export function buildNoVerdict(codeHash: string, network: SafetyNetwork): NoVerdict {
  return {
    safe: null,
    score: null,
    codeHash,
    network,
    message:
      "No on-chain verdict for this code hash on " +
      network +
      ". Submit for audit via POST /api/safety/audit or run the CLI: `anneal audit <file> --attest`.",
  };
}

// ---------------------------------------------------------------------------
// In-memory IP rate limiter for POST /api/safety/audit.
// ---------------------------------------------------------------------------
//
// Deliberately not Redis. Demo-grade. Limit: 1 audit request / 5 min / IP.
// Survives only as long as the route handler module stays warm — that's fine
// for the spec ("no Redis needed for demo").
const RATE_WINDOW_MS = 5 * 60 * 1000;
const _lastSeen = new Map<string, number>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds?: number;
}

export function rateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const prev = _lastSeen.get(ip);
  if (prev && now - prev < RATE_WINDOW_MS) {
    return { ok: false, retryAfterSeconds: Math.ceil((RATE_WINDOW_MS - (now - prev)) / 1000) };
  }
  _lastSeen.set(ip, now);
  // Drop ancient entries occasionally to keep the map bounded.
  if (_lastSeen.size > 10_000) {
    for (const [k, t] of _lastSeen) {
      if (now - t > RATE_WINDOW_MS * 4) _lastSeen.delete(k);
    }
  }
  return { ok: true };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip");
  if (fwd) return fwd.split(",")[0]!.trim();
  return "unknown";
}

export function corsHeaders(extra: Record<string, string> = {}): HeadersInit {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
    "access-control-max-age": "86400",
    ...extra,
  };
}
