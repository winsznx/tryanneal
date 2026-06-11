import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchArsiaParams, vote, _resetCache, type JsonRpcCall } from "../rpc.js";
import { computeFee, profileMantleGas } from "../profiler.js";
import { estimateFastLZSize } from "../fastlz.js";

const padHex = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");

/** Build a JsonRpcCall mock that returns per-provider, per-selector values. */
function makeRpc(
  results: Record<string, Record<string, bigint>>,
  callCounter?: { n: number },
): JsonRpcCall {
  return vi.fn(async (url: string, method: string, params: unknown[]) => {
    if (callCounter) callCounter.n++;
    const provider = results[url];
    if (!provider) throw new Error(`unmocked ${url}`);
    if (method === "eth_gasPrice") return padHex(provider.l2BaseFee ?? 20_000_000n);
    const data = (params[0] as { data: string }).data as string;
    const sel = data.slice(0, 10);
    const map: Record<string, string> = {
      "0xc4bc7b70": "baseFeeScalar",
      "0x68d5dca6": "blobBaseFeeScalar",
      "0x9e8c4966": "operatorFeeScalar",
      "0x44a7f31a": "operatorFeeConstant",
      "0x519b4bd3": "l1BaseFee",
      // tokenRatio (0xfd32aa0f) removed post-Arsia — calls revert if attempted.
    };
    const key = map[sel];
    if (!key) throw new Error(`unmocked selector ${sel}`);
    return padHex(provider[key] ?? 0n);
  });
}

const STD = {
  baseFeeScalar: 1368n,
  blobBaseFeeScalar: 810949n,
  operatorFeeScalar: 0n,
  operatorFeeConstant: 0n,
  l1BaseFee: 1_500_000_000n,
  l2BaseFee: 20_000_000n,
  tokenRatio: 1n, // pinned to 1 post-Arsia (kept on the type for back-compat)
};

describe("vote", () => {
  it("agrees when ≥2/3 providers match", () => {
    expect(vote([5n, 5n, 7n], 3)).toEqual({ winner: 5n, agreed: true });
  });
  it("flags disagreement when all differ", () => {
    expect(vote([1n, 2n, 3n], 3)).toEqual({ winner: 1n, agreed: false });
  });
});

describe("estimateFastLZSize", () => {
  it("compresses runs of zero bytes aggressively", () => {
    const zeros = new Uint8Array(1024);
    const entropy = new Uint8Array(1024).map(() => Math.floor(Math.random() * 256));
    expect(estimateFastLZSize(zeros)).toBeLessThan(estimateFastLZSize(entropy));
  });
  it("returns 0 for empty input", () => {
    expect(estimateFastLZSize(new Uint8Array())).toBe(0);
  });
});

describe("fetchArsiaParams — Arsia post-upgrade compatibility", () => {
  beforeEach(() => _resetCache());

  it("never sends the retired tokenRatio() selector to providers", async () => {
    // #given a mock that throws if anyone hits 0xfd32aa0f (mirrors mainnet revert)
    const seenSelectors: string[] = [];
    const call: JsonRpcCall = vi.fn(async (_url, method, params) => {
      if (method === "eth_gasPrice") return padHex(STD.l2BaseFee);
      const data = (params[0] as { data: string }).data;
      const sel = data.slice(0, 10);
      seenSelectors.push(sel);
      if (sel === "0xfd32aa0f") throw new Error("execution reverted — tokenRatio() removed in Arsia");
      const lookup: Record<string, bigint> = {
        "0xc4bc7b70": STD.baseFeeScalar,
        "0x68d5dca6": STD.blobBaseFeeScalar,
        "0x9e8c4966": STD.operatorFeeScalar,
        "0x44a7f31a": STD.operatorFeeConstant,
        "0x519b4bd3": STD.l1BaseFee,
      };
      const v = lookup[sel];
      if (v === undefined) throw new Error(`unmocked selector ${sel}`);
      return padHex(v);
    });

    // #when the gas profiler fetches Arsia params
    const p = await fetchArsiaParams({ rpcUrls: ["http://a"], call, now: () => 1_000_000 });

    // #then the retired selector is never queried and tokenRatio is pinned to 1
    expect(seenSelectors).not.toContain("0xfd32aa0f");
    expect(p.tokenRatio).toBe(1n);
    expect(p.source).toBe("live"); // not poisoned by a revert
  });
});

describe("fetchArsiaParams — consensus", () => {
  beforeEach(() => _resetCache());

  const urls = ["http://a", "http://b", "http://c"];

  it("2/3 consensus → live source", async () => {
    const call = makeRpc({
      "http://a": STD,
      "http://b": STD,
      "http://c": { ...STD, baseFeeScalar: 9999n },
    });
    const p = await fetchArsiaParams({ rpcUrls: urls, call });
    expect(p.baseFeeScalar).toBe(1368n);
    expect(p.source).toBe("live");
  });

  it("all disagree → fallback flag, primary winner", async () => {
    const call = makeRpc({
      "http://a": { ...STD, baseFeeScalar: 1n },
      "http://b": { ...STD, baseFeeScalar: 2n },
      "http://c": { ...STD, baseFeeScalar: 3n },
    });
    const p = await fetchArsiaParams({ rpcUrls: urls, call });
    expect(p.source).toBe("fallback");
    expect([1n, 2n, 3n]).toContain(p.baseFeeScalar);
  });

  it("caches params for 60s — no second RPC call", async () => {
    const counter = { n: 0 };
    const call = makeRpc({ "http://a": STD, "http://b": STD, "http://c": STD }, counter);
    const t0 = 1_000_000;
    await fetchArsiaParams({ rpcUrls: urls, call, now: () => t0 });
    const beforeSecond = counter.n;
    const second = await fetchArsiaParams({ rpcUrls: urls, call, now: () => t0 + 30_000 });
    expect(counter.n).toBe(beforeSecond);
    expect(second.source).toBe("cached");
    // After expiry, refetches.
    await fetchArsiaParams({ rpcUrls: urls, call, now: () => t0 + 61_000 });
    expect(counter.n).toBeGreaterThan(beforeSecond);
  });
});

describe("computeFee — Arsia 3-component", () => {
  beforeEach(() => _resetCache());

  it("sums L2 + L1 + operator components", () => {
    const params = { ...STD, l1BlobFee: 1n, fetchedAt: "", source: "live" as const };
    const calldata = new Uint8Array([0x12, 0x34, 0x56, 0x78, ...new Array(36).fill(0)]);
    const { l2, l1, op, total } = computeFee(50_000n, calldata, params);
    expect(l2).toBe(50_000n * 20_000_000n);
    expect(op).toBe(0n);
    expect(l1).toBeGreaterThan(0n);
    expect(total).toBe(l2 + l1 + op);
  });

  it("operator fee applies constant + scalar*100*gas", () => {
    const params = {
      ...STD,
      operatorFeeConstant: 1000n,
      operatorFeeScalar: 5n,
      l1BlobFee: 1n,
      fetchedAt: "",
      source: "live" as const,
    };
    const { op } = computeFee(200n, new Uint8Array([0x00]), params);
    expect(op).toBe(1000n + 5n * 100n * 200n);
  });
});

describe("profileMantleGas — optimizations", () => {
  beforeEach(() => _resetCache());

  it("flags calldata_packing when L1 data fee >60% of total", async () => {
    // #given a calldata-heavy function with near-zero L2 work.
    //   Post-Arsia, MNT-native fees make the L1 component much smaller in
    //   absolute terms than pre-Arsia (no 4000× ETH→MNT scalar), so the
    //   imbalance needs to be pushed harder for L1 to dominate.
    const call = makeRpc({ "http://a": STD, "http://b": STD, "http://c": STD });
    const heavyCalldata = new Uint8Array(4096);
    for (let i = 0; i < heavyCalldata.length; i++) heavyCalldata[i] = (i * 31) & 0xff;

    // #when we profile a function that ships 4KB of calldata but does almost
    //   no execution.
    const report = await profileMantleGas(
      {
        functions: [
          {
            name: "bigBlob",
            selector: "0xdeadbeef",
            calldata: heavyCalldata,
            l2GasUsed: 100n,
          },
        ],
        deployment: { bytecode: new Uint8Array(100), l2GasUsed: 200_000n },
      },
      { rpcUrls: ["http://a", "http://b", "http://c"], call, now: () => 2_000_000 },
    );

    // #then the optimizer flags it as calldata-dominant.
    const calldataOpt = report.optimizations.find((o) => o.type === "calldata_packing");
    expect(calldataOpt).toBeDefined();
    expect(calldataOpt!.affectedFunctions).toContain("bigBlob");
    expect(report.functions[0]!.totalCostMNT).toMatch(/^\d+\.\d+$/);
    expect(report.consensus.agreed).toBe(true);
  });
});
