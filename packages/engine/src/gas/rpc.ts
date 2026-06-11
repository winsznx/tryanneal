import {
  type ArsiaParams,
  DEFAULT_RPC_URLS,
  FALLBACK_ARSIA,
  GasError,
  GAS_PRICE_ORACLE,
  L1_BLOCK_PREDEPLOY,
} from "./types.js";

/** Minimal JSON-RPC client surface for testability. */
export interface JsonRpcCall {
  (url: string, method: string, params: unknown[]): Promise<string>;
}

/**
 * eth_call helper. Returns hex string result.
 * Selectors are computed once below; we keep them inline so this file has no
 * runtime keccak dependency.
 */

// keccak256("baseFeeScalar()")[0..4] etc. — precomputed via cast/keccak.
//
// NOTE: tokenRatio() was REMOVED in the Arsia upgrade (~April 16, 2026).
// Calling the old 0xfd32aa0f selector on the GasPriceOracle predeploy now
// reverts. We don't fetch it anymore — the L1-fee formula doesn't need it
// since L2 fees are denominated directly in MNT post-Arsia.
const SEL = {
  baseFeeScalar:      "0xc4bc7b70",
  blobBaseFeeScalar:  "0x68d5dca6",
  operatorFeeScalar:  "0x9e8c4966",
  operatorFeeConstant:"0x44a7f31a",
  l1BaseFee:          "0x519b4bd3",
  gasPrice:           null,
};

const SCALAR_TO_PARAM: Record<keyof typeof SEL, (keyof ArsiaParams) | null> = {
  baseFeeScalar: "baseFeeScalar",
  blobBaseFeeScalar: "blobBaseFeeScalar",
  operatorFeeScalar: "operatorFeeScalar",
  operatorFeeConstant: "operatorFeeConstant",
  l1BaseFee: "l1BaseFee",
  gasPrice: null,
};

const L1_BLOCK_SELECTORS = ["baseFeeScalar", "blobBaseFeeScalar", "operatorFeeScalar", "operatorFeeConstant"] as const;
const ORACLE_SELECTORS = ["l1BaseFee"] as const;

export interface RpcConsensusOptions {
  rpcUrls?: string[];
  call?: JsonRpcCall;
  now?: () => number;
}

const cache: { params?: ArsiaParams; expiresAt: number } = { expiresAt: 0 };

export function _resetCache(): void {
  cache.params = undefined;
  cache.expiresAt = 0;
}

export async function fetchArsiaParams(opts: RpcConsensusOptions = {}): Promise<ArsiaParams> {
  const now = (opts.now ?? Date.now)();
  if (cache.params && cache.expiresAt > now) {
    return { ...cache.params, source: "cached" };
  }

  const urls = opts.rpcUrls ?? DEFAULT_RPC_URLS;
  if (urls.length === 0) throw new GasError("no rpc urls", "NO_PROVIDERS");
  const call = opts.call ?? defaultJsonRpc;

  // Fetch each parameter from every provider, then vote.
  // tokenRatio is NOT fetched post-Arsia — the GasPriceOracle reverts on its
  // selector now. It stays pinned to 1n.
  const fields: (keyof Omit<ArsiaParams, "fetchedAt" | "source" | "tokenRatio">)[] = [
    "baseFeeScalar",
    "blobBaseFeeScalar",
    "operatorFeeScalar",
    "operatorFeeConstant",
    "l1BaseFee",
    "l2BaseFee",
  ];

  const collected: Record<string, bigint[]> = {};
  for (const f of fields) collected[f] = [];

  await Promise.all(
    urls.map(async (url) => {
      try {
        for (const name of L1_BLOCK_SELECTORS) {
          const hex = await call(url, "eth_call", [{ to: L1_BLOCK_PREDEPLOY, data: SEL[name] }, "latest"]);
          collected[SCALAR_TO_PARAM[name] as string]!.push(hexToBigInt(hex));
        }
        for (const name of ORACLE_SELECTORS) {
          const hex = await call(url, "eth_call", [{ to: GAS_PRICE_ORACLE, data: SEL[name] }, "latest"]);
          collected[SCALAR_TO_PARAM[name] as string]!.push(hexToBigInt(hex));
        }
        const gp = await call(url, "eth_gasPrice", []);
        collected.l2BaseFee!.push(hexToBigInt(gp));
      } catch {
        // ignore — provider drops out of the vote
      }
    }),
  );

  const totalProviders = urls.length;
  const respondingProviders = Math.max(...fields.map((f) => collected[f]!.length));
  if (respondingProviders === 0) {
    // total failure → use fallback
    const fb: ArsiaParams = {
      ...FALLBACK_ARSIA,
      fetchedAt: new Date(now).toISOString(),
      source: "fallback",
    };
    cache.params = fb;
    cache.expiresAt = now + 60_000;
    return { ...fb };
  }

  let allAgreed = true;
  const result: Record<string, bigint> = {};
  for (const f of fields) {
    const votes = collected[f]!;
    if (votes.length === 0) {
      result[f] = FALLBACK_ARSIA[f];
      allAgreed = false;
      continue;
    }
    const { winner, agreed } = vote(votes, totalProviders);
    result[f] = winner;
    if (!agreed) allAgreed = false;
  }

  const params: ArsiaParams = {
    baseFeeScalar: result.baseFeeScalar!,
    blobBaseFeeScalar: result.blobBaseFeeScalar!,
    operatorFeeScalar: result.operatorFeeScalar!,
    operatorFeeConstant: result.operatorFeeConstant!,
    l1BaseFee: result.l1BaseFee!,
    l1BlobFee: FALLBACK_ARSIA.l1BlobFee, // not exposed by all providers; OK to fix for now
    tokenRatio: 1n, // Arsia: tokenRatio retired; L2 fees MNT-native.
    l2BaseFee: result.l2BaseFee!,
    fetchedAt: new Date(now).toISOString(),
    source: allAgreed ? "live" : "fallback",
  };

  cache.params = params;
  cache.expiresAt = now + 60_000;
  return { ...params };
}

interface VoteResult {
  winner: bigint;
  agreed: boolean;
}

/** Majority vote with 2/3 threshold. Returns winner + whether ≥2 providers agreed. */
export function vote(values: bigint[], totalProviders: number): VoteResult {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v.toString(), (counts.get(v.toString()) ?? 0) + 1);

  let bestKey = values[0]!.toString();
  let bestCount = 0;
  for (const [k, c] of counts) {
    if (c > bestCount) {
      bestKey = k;
      bestCount = c;
    }
  }
  const threshold = Math.ceil((totalProviders * 2) / 3);
  return { winner: BigInt(bestKey), agreed: bestCount >= threshold };
}

function hexToBigInt(hex: string): bigint {
  if (!hex || hex === "0x") return 0n;
  return BigInt(hex);
}

export const defaultJsonRpc: JsonRpcCall = async (url, method, params) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new GasError(`rpc ${url} ${res.status}`, "RPC_ERROR");
  const body = (await res.json()) as { result?: string; error?: { message: string } };
  if (body.error) throw new GasError(`rpc error: ${body.error.message}`, "RPC_ERROR");
  return body.result ?? "0x";
};
