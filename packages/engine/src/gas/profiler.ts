import {
  type ArsiaParams,
  type DeploymentInput,
  type DeploymentReport,
  type FunctionGasReport,
  type FunctionInput,
  type GasOptimization,
  type MantleGasReport,
} from "./types.js";
import { estimateFastLZSize, estimatedSizeScaled } from "./fastlz.js";
import { fetchArsiaParams, type RpcConsensusOptions } from "./rpc.js";

const WEI_PER_MNT = 10n ** 18n;
const SCALE = 16n * 1_000_000n * 1_000_000n; // 16 * 1e6 * 1e6 per op-stack formula

/** Computes the 3-component Arsia fee for one calldata blob. */
export function computeFee(
  l2GasUsed: bigint,
  calldata: Uint8Array,
  params: ArsiaParams,
): { l2: bigint; l1: bigint; op: bigint; total: bigint } {
  const l2 = l2GasUsed * params.l2BaseFee;

  const lzSize = estimateFastLZSize(calldata);
  const sized = estimatedSizeScaled(lzSize);
  const weighted = params.baseFeeScalar * params.l1BaseFee * 16n + params.blobBaseFeeScalar * params.l1BlobFee;
  // sized is already scaled by 1e8 (op-stack convention); divide by SCALE to land in wei.
  const l1 = (sized * weighted * params.tokenRatio) / SCALE;

  const op = params.operatorFeeConstant + params.operatorFeeScalar * 100n * l2GasUsed;

  return { l2, l1, op, total: l2 + l1 + op };
}

function weiToMNT(wei: bigint): string {
  const whole = wei / WEI_PER_MNT;
  const frac = wei % WEI_PER_MNT;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 8);
  return `${whole.toString()}.${fracStr}`;
}

function detectOptimizations(functions: FunctionGasReport[], deployment: DeploymentReport): GasOptimization[] {
  const out: GasOptimization[] = [];

  const highL1 = functions.filter((f) => {
    const total = f.l1DataFee + f.l2ExecutionFee + f.operatorFee;
    return total > 0n && (f.l1DataFee * 100n) / total > 60n;
  });
  if (highL1.length > 0) {
    out.push({
      type: "calldata_packing",
      description: "Calldata dominates cost (>60% L1 fee). Pack args, drop unused indexed event topics, or batch calls.",
      estimatedSavingPct: 18,
      affectedFunctions: highL1.map((f) => f.name),
    });
  }

  const oversizedCalldata = functions.filter((f) => f.calldataSize > 1024);
  if (oversizedCalldata.length > 0) {
    out.push({
      type: "batch_operations",
      description: "Functions with >1KB calldata benefit disproportionately from batching across multiple calls.",
      estimatedSavingPct: 12,
      affectedFunctions: oversizedCalldata.map((f) => f.name),
    });
  }

  if (deployment.l1DataFee > deployment.l2ExecutionFee * 2n) {
    out.push({
      type: "storage_layout",
      description: "Deployment bytecode is L1-data heavy. Move large constants to immutables or external libraries.",
      estimatedSavingPct: 9,
      affectedFunctions: ["<deployment>"],
    });
  }

  return out;
}

export interface ProfileInput {
  functions: FunctionInput[];
  deployment: DeploymentInput;
  mntPriceUSD?: number; // for the human-readable USD total
}

export async function profileMantleGas(
  input: ProfileInput,
  rpcOpts: RpcConsensusOptions = {},
): Promise<MantleGasReport> {
  const params = await fetchArsiaParams(rpcOpts);

  const functions: FunctionGasReport[] = input.functions.map((fn) => {
    const { l2, l1, op } = computeFee(fn.l2GasUsed, fn.calldata, params);
    return {
      name: fn.name,
      selector: fn.selector,
      gasUsed: fn.l2GasUsed,
      l2ExecutionFee: l2,
      l1DataFee: l1,
      operatorFee: op,
      totalCostMNT: weiToMNT(l2 + l1 + op),
      calldataSize: fn.calldata.length,
    };
  });

  const dep = computeFee(input.deployment.l2GasUsed, input.deployment.bytecode, params);
  const mntPrice = input.mntPriceUSD ?? 0.6;
  const usd = (Number(dep.total) / 1e18) * mntPrice;

  const deployment: DeploymentReport = {
    totalGas: input.deployment.l2GasUsed,
    l2ExecutionFee: dep.l2,
    l1DataFee: dep.l1,
    operatorFee: dep.op,
    totalCostMNT: weiToMNT(dep.total),
    totalCostUSD: usd.toFixed(4),
  };

  return {
    functions,
    deployment,
    optimizations: detectOptimizations(functions, deployment),
    params,
    consensus: {
      agreed: params.source === "live",
      providersUsed: (rpcOpts.rpcUrls ?? []).length || 3,
      note: params.source === "fallback" ? "providers disagreed or unreachable; using fallback values" : undefined,
    },
  };
}
