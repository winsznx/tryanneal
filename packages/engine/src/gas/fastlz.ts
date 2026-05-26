/**
 * FastLZ-friendly size estimator for L1 data fee calculation.
 *
 * The OP-Stack Arsia formula:
 *   estimatedSize = max(MIN_TX_SIZE_SCALED, COST_INTERCEPT + COST_FASTLZ_COEF * fastLzSize)
 *
 * Where `fastLzSize` is the FastLZ-compressed length of the RLP-encoded tx
 * payload. We approximate fastLz size from raw calldata bytes using an
 * entropy heuristic:
 *   - runs of repeating bytes compress to ~2 bytes per run
 *   - non-repeating bytes pass through ~1:1
 *   - zero bytes compress aggressively (most calldata padding)
 *
 * This is intentionally cheap and deterministic. For exact pricing, call the
 * on-chain GasPriceOracle.getL1Fee(bytes) — see `oracleL1Fee` in profiler.ts.
 */

export const COST_INTERCEPT = -42_585_600n;
export const COST_FASTLZ_COEF = 836_500n;
export const MIN_SIZE_SCALED = 100_000_000n; // floor used by op-stack

export function estimateFastLZSize(data: Uint8Array): number {
  if (data.length === 0) return 0;
  let compressed = 0;
  let i = 0;
  while (i < data.length) {
    const b = data[i]!;
    // Run-length: how many consecutive identical bytes?
    let runLen = 1;
    while (i + runLen < data.length && data[i + runLen] === b && runLen < 255) runLen++;
    if (runLen >= 3) {
      // FastLZ encodes runs as a 2-3 byte token.
      compressed += b === 0 ? 2 : 3;
      i += runLen;
    } else {
      // Zero bytes still gain a small benefit from LZ matching across the stream.
      compressed += b === 0 ? 1 : 1;
      i += 1;
    }
  }
  // FastLZ has ~10 byte header overhead.
  return compressed + 10;
}

export function estimatedSizeScaled(fastLzSize: number): bigint {
  const raw = COST_INTERCEPT + COST_FASTLZ_COEF * BigInt(fastLzSize);
  return raw < MIN_SIZE_SCALED ? MIN_SIZE_SCALED : raw;
}
