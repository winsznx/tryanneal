/**
 * TryAnneal gas benchmark runner.
 *
 * The auditable, MEASURED before/after for the three Mantle gas techniques the
 * profiler advertises (calldata_packing, batch_operations, storage_layout).
 * Nothing here is an estimate: we compile both the naive and optimized
 * contract with solc 0.8.24, encode the REAL calldata for the representative
 * call with ethers, then run that calldata (and, for the deploy case, the real
 * init-code blob) through the engine's own `computeFee` Arsia model.
 *
 * What we measure: the L1-DATA component of the Arsia fee. On Mantle that
 * component is driven by the FastLZ-compressed calldata/bytecode size, so it is
 * exactly what these size-targeting techniques move. We hold the L2-execution
 * and operator components fixed (a documented l2GasUsed) across both sides so
 * the comparison isolates the size-driven win and is not muddied by solc's
 * "infinite" gas estimates for calldata-array and immutable functions. The
 * headline `savedPct` is therefore the saving on the variable (L1-data) fee;
 * we also record the full L2/L1/op/total breakdown for both sides so the total
 * is auditable too.
 *
 * Run: `pnpm --filter @tryanneal/engine benchmark:gas`
 *      writes packages/engine/benchmarks/results/gas-latest.json
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Interface, type InterfaceAbi } from "ethers";
import { computeFee, fetchArsiaParams, FALLBACK_ARSIA, type ArsiaParams } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const GAS_CONTRACTS_DIR = resolve(__dirname, "contracts", "gas");
const RESULTS_DIR = resolve(__dirname, "results");

const SOLC_VERSION = "0.8.24";
const OPTIMIZE_RUNS = 200;

/**
 * Held constant across both sides of every pair so the comparison isolates the
 * size-driven L1-data component. A representative storage-write call costs on
 * the order of this much L2 gas; the exact figure cancels out of the L1 saving.
 */
const FIXED_L2_GAS = 50_000n;
const DEPLOY_L2_GAS = 250_000n;

const N_ORDERS = 12;
const N_PAYMENTS = 10;

interface CompiledContract {
  bin: string; // deploy bytecode (init code), hex without 0x
  binRuntime: string; // runtime bytecode, hex without 0x
}

function compile(file: string): Record<string, CompiledContract> {
  const out = execFileSync(
    "solc",
    [
      "--combined-json",
      "bin,bin-runtime",
      "--optimize",
      "--optimize-runs",
      String(OPTIMIZE_RUNS),
      file,
    ],
    { cwd: GAS_CONTRACTS_DIR, env: { ...process.env, SOLC_VERSION }, encoding: "utf8" },
  );
  const parsed = JSON.parse(out) as {
    contracts: Record<string, { bin: string; "bin-runtime": string }>;
  };
  const result: Record<string, CompiledContract> = {};
  for (const [key, v] of Object.entries(parsed.contracts)) {
    const name = key.split(":")[1]!;
    result[name] = { bin: v.bin, binRuntime: v["bin-runtime"] };
  }
  return result;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function encode(abi: InterfaceAbi, fn: string, args: unknown[]): Uint8Array {
  const iface = new Interface(abi);
  return hexToBytes(iface.encodeFunctionData(fn, args));
}

type Fee = { l2: bigint; l1: bigint; op: bigint; total: bigint };

interface FeeBreakdown {
  l2: string;
  l1: string;
  op: string;
  total: string;
}

function toMNT(wei: bigint): string {
  const WEI = 10n ** 18n;
  const whole = wei / WEI;
  const frac = (wei % WEI).toString().padStart(18, "0").slice(0, 12);
  return `${whole}.${frac}`;
}

function breakdown(fee: Fee): FeeBreakdown {
  return { l2: toMNT(fee.l2), l1: toMNT(fee.l1), op: toMNT(fee.op), total: toMNT(fee.total) };
}

function addFee(a: Fee, b: Fee): Fee {
  return { l2: a.l2 + b.l2, l1: a.l1 + b.l1, op: a.op + b.op, total: a.total + b.total };
}

interface TechniqueResult {
  technique: string;
  representativeCall: string;
  naive: FeeBreakdown;
  optimized: FeeBreakdown;
  /** Saving on the measured (L1-data) component — the variable these techniques move. */
  savedPct: number;
  /** Saving on the full total (L2 held fixed, so this is the diluted figure). */
  savedTotalPct: number;
  calldataBytesNaive: number;
  calldataBytesOpt: number;
  bytecodeBytesNaive: number;
  bytecodeBytesOpt: number;
  note: string;
}

function pct(naive: bigint, opt: bigint): number {
  if (naive === 0n) return 0;
  const value = (Number(naive - opt) / Number(naive)) * 100;
  return Math.round(value * 10) / 10;
}

const NAIVE_ORDERS_ABI = ["function recordMany(uint256[])"];
const PACKED_ORDERS_ABI = ["function recordManyPacked(bytes)"];
const PAY_ABI = ["function pay(address,uint256)"];
const PAY_BATCH_ABI = ["function payBatch(address[],uint256[])"];

function packOrder(i: number): string {
  const marketId = (i + 1).toString(16).padStart(8, "0"); // uint32
  const bidPrice = (2_500_000_000 + i).toString(16).padStart(24, "0"); // uint96
  const askPrice = (2_510_000_000 + i).toString(16).padStart(24, "0"); // uint96
  const amount = (1_000_000_000).toString(16).padStart(16, "0"); // uint64
  const expiry = (1_800_000_000 + i * 100).toString(16).padStart(10, "0"); // uint40
  const flag = "01"; // bool
  return marketId + bidPrice + askPrice + amount + expiry + flag;
}

function calldataPacking(params: ArsiaParams): TechniqueResult {
  const compiled = compile("CalldataPacking.sol");

  const words: bigint[] = [];
  for (let i = 0; i < N_ORDERS; i++) {
    words.push(
      BigInt(i + 1),
      BigInt(2_500_000_000 + i),
      BigInt(2_510_000_000 + i),
      1_000_000_000n,
      BigInt(1_800_000_000 + i * 100),
      1n,
    );
  }
  const naiveCd = encode(NAIVE_ORDERS_ABI, "recordMany", [words]);

  let packed = "0x";
  for (let i = 0; i < N_ORDERS; i++) packed += packOrder(i);
  const optCd = encode(PACKED_ORDERS_ABI, "recordManyPacked", [packed]);

  const naive = computeFee(FIXED_L2_GAS, naiveCd, params);
  const opt = computeFee(FIXED_L2_GAS, optCd, params);
  return {
    technique: "calldata_packing",
    representativeCall: `recordMany(uint256[${N_ORDERS * 6}]) vs recordManyPacked(bytes)`,
    naive: breakdown(naive),
    optimized: breakdown(opt),
    savedPct: pct(naive.l1, opt.l1),
    savedTotalPct: pct(naive.total, opt.total),
    calldataBytesNaive: naiveCd.length,
    calldataBytesOpt: optCd.length,
    bytecodeBytesNaive: compiled.NaiveOrders!.binRuntime.length / 2,
    bytecodeBytesOpt: compiled.PackedOrders!.binRuntime.length / 2,
    note: `${N_ORDERS} orders as a flat uint256[] (6 zero-padded words each) vs a tight 42-byte/order \`bytes\` blob. ABI's 32-byte word alignment is what packing removes; L1 data is the measured win, L2 held fixed.`,
  };
}

const RECIPIENTS = [
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222",
  "0x3333333333333333333333333333333333333333",
  "0x4444444444444444444444444444444444444444",
  "0x5555555555555555555555555555555555555555",
  "0x6666666666666666666666666666666666666666",
  "0x7777777777777777777777777777777777777777",
  "0x8888888888888888888888888888888888888888",
  "0x9999999999999999999999999999999999999999",
  "0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa",
];
const AMOUNTS = RECIPIENTS.map((_, i) => BigInt((i + 1) * 1_000) * 10n ** 15n);

function batchOperations(params: ArsiaParams): TechniqueResult {
  const compiled = compile("BatchTransfer.sol");
  let naive: Fee = { l2: 0n, l1: 0n, op: 0n, total: 0n };
  let naiveBytes = 0;
  for (let i = 0; i < N_PAYMENTS; i++) {
    const cd = encode(PAY_ABI, "pay", [RECIPIENTS[i], AMOUNTS[i]]);
    naiveBytes += cd.length;
    naive = addFee(naive, computeFee(FIXED_L2_GAS, cd, params));
  }
  const batchCd = encode(PAY_BATCH_ABI, "payBatch", [RECIPIENTS, AMOUNTS]);
  // One batched tx still costs the L2 path of all N writes — keep it comparable.
  const opt = computeFee(FIXED_L2_GAS * BigInt(N_PAYMENTS), batchCd, params);
  return {
    technique: "batch_operations",
    representativeCall: `pay() ×${N_PAYMENTS} vs one payBatch([], [])`,
    naive: breakdown(naive),
    optimized: breakdown(opt),
    savedPct: pct(naive.l1, opt.l1),
    savedTotalPct: pct(naive.total, opt.total),
    calldataBytesNaive: naiveBytes,
    calldataBytesOpt: batchCd.length,
    bytecodeBytesNaive: compiled.NaivePayments!.binRuntime.length / 2,
    bytecodeBytesOpt: compiled.BatchPayments!.binRuntime.length / 2,
    note: `${N_PAYMENTS} separate txs each pay the floored L1 minimum; one batched call pays it once. L2 gas held equal across both sides.`,
  };
}

function storageLayout(params: ArsiaParams): TechniqueResult {
  const compiled = compile("StorageLayout.sol");
  const naiveInit = hexToBytes(compiled.StorageConfig!.bin);
  const optInit = hexToBytes(compiled.ConstantConfig!.bin);
  const naive = computeFee(DEPLOY_L2_GAS, naiveInit, params);
  const opt = computeFee(DEPLOY_L2_GAS, optInit, params);
  return {
    technique: "storage_layout",
    representativeCall: "constructor deploy — storage slots vs compile-time constants",
    naive: breakdown(naive),
    optimized: breakdown(opt),
    savedPct: pct(naive.l1, opt.l1),
    savedTotalPct: pct(naive.total, opt.total),
    calldataBytesNaive: naiveInit.length,
    calldataBytesOpt: optInit.length,
    bytecodeBytesNaive: naiveInit.length,
    bytecodeBytesOpt: optInit.length,
    note: "`constant` drops the constructor SSTOREs from the init code posted to L1 on deploy. Deploy L2 gas held fixed; L1 data is the measured win.",
  };
}

async function main(): Promise<void> {
  console.log("");
  console.log("TryAnneal gas benchmark — MEASURED before/after on the Arsia fee model.");
  console.log("=".repeat(88));
  console.log(`solc ${SOLC_VERSION} (optimize, runs=${OPTIMIZE_RUNS}) · engine computeFee · L1 data is the measured component.`);
  console.log("");

  let params: ArsiaParams;
  try {
    params = await fetchArsiaParams();
    console.log(
      `Arsia params source: ${params.source}` +
        (params.source === "live"
          ? " (fetched from Mantle RPC)"
          : " (RPC unavailable — using deterministic fallback)"),
    );
  } catch {
    params = { ...FALLBACK_ARSIA, fetchedAt: "1970-01-01T00:00:00Z", source: "fallback" };
    console.log("Arsia params source: fallback (RPC threw — using deterministic fallback)");
  }
  console.log("");

  const results: TechniqueResult[] = [
    calldataPacking(params),
    batchOperations(params),
    storageLayout(params),
  ];

  console.log("Results — saving is on the L1-data fee (the size-driven component these techniques move).");
  console.log("-".repeat(88));
  console.log(
    [
      "Technique".padEnd(18),
      "L1 before (MNT)".padStart(20),
      "L1 after (MNT)".padStart(20),
      "Saved".padStart(7),
      "bytes B→A".padStart(13),
    ].join(" │ "),
  );
  console.log("-".repeat(88));
  for (const r of results) {
    console.log(
      [
        r.technique.padEnd(18),
        r.naive.l1.padStart(20),
        r.optimized.l1.padStart(20),
        `${r.savedPct}%`.padStart(7),
        `${r.calldataBytesNaive}→${r.calldataBytesOpt}`.padStart(13),
      ].join(" │ "),
    );
  }
  console.log("-".repeat(88));
  console.log("");

  for (const r of results) {
    console.log(`• ${r.technique} — L1 saving ${r.savedPct}% (total ${r.savedTotalPct}%, L2 held fixed)`);
    console.log(`    ${r.note}`);
    console.log(`    total ${r.naive.total} MNT → ${r.optimized.total} MNT`);
  }
  console.log("");

  const payload = {
    schemaVersion: 1,
    generatedAt: "2026-06-26T00:00:00Z",
    model: "Mantle Arsia 3-component fee (L2 exec + L1 data + operator) via engine computeFee",
    solcVersion: SOLC_VERSION,
    optimizeRuns: OPTIMIZE_RUNS,
    arsiaParamsSource: params.source,
    note: "savedPct is the saving on the L1-data (FastLZ-driven) fee — the size-driven component these techniques move. L2 and operator fees are held fixed across both sides so the comparison isolates the size win; savedTotalPct shows the diluted total. All numbers are the real output of computeFee over solc-compiled bytecode and ethers-encoded calldata.",
    results,
  };
  await mkdir(RESULTS_DIR, { recursive: true });
  const outPath = resolve(RESULTS_DIR, "gas-latest.json");
  await writeFile(outPath, JSON.stringify(payload, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error("gas benchmark failed:", err);
  process.exit(1);
});
