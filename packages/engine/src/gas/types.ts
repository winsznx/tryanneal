export interface ArsiaParams {
  baseFeeScalar: bigint;
  blobBaseFeeScalar: bigint;
  operatorFeeScalar: bigint;
  operatorFeeConstant: bigint;
  l1BaseFee: bigint;
  l1BlobFee: bigint;
  /**
   * tokenRatio() was removed by the Mantle Arsia upgrade (April 2026).
   * L2 fees are now denominated directly in MNT via the Arsia operator-fee
   * model — no ETH→MNT conversion scalar is needed. Calling tokenRatio() on
   * the GasPriceOracle predeploy now reverts. We keep the field on the type
   * for cached-payload back-compat and always set it to 1n post-Arsia.
   *
   * @deprecated since Arsia upgrade — always 1n.
   */
  tokenRatio: bigint;
  l2BaseFee: bigint;
  fetchedAt: string;
  source: "live" | "cached" | "fallback";
}

export interface FunctionInput {
  name: string;
  selector: string;          // 0x-prefixed 4-byte selector
  calldata: Uint8Array;      // sample calldata (incl. selector)
  l2GasUsed: bigint;         // estimated L2 execution gas
}

export interface FunctionGasReport {
  name: string;
  selector: string;
  gasUsed: bigint;
  l2ExecutionFee: bigint;
  l1DataFee: bigint;
  operatorFee: bigint;
  totalCostMNT: string;
  calldataSize: number;
}

export interface DeploymentInput {
  bytecode: Uint8Array;
  l2GasUsed: bigint;
}

export interface DeploymentReport {
  totalGas: bigint;
  l2ExecutionFee: bigint;
  l1DataFee: bigint;
  operatorFee: bigint;
  totalCostMNT: string;
  totalCostUSD: string;
}

export type OptimizationType =
  | "calldata_packing"
  | "storage_layout"
  | "batch_operations"
  | "selector_optimization";

export interface GasOptimization {
  type: OptimizationType;
  description: string;
  estimatedSavingPct: number;
  affectedFunctions: string[];
}

export interface MantleGasReport {
  functions: FunctionGasReport[];
  deployment: DeploymentReport;
  optimizations: GasOptimization[];
  params: ArsiaParams;
  consensus: {
    agreed: boolean;
    providersUsed: number;
    note?: string;
  };
}

export class GasError extends Error {
  constructor(message: string, public readonly code: "RPC_ERROR" | "NO_PROVIDERS" | "PARSE_ERROR") {
    super(message);
    this.name = "GasError";
  }
}

/** Mantle RPC endpoints (mainnet). */
export const DEFAULT_RPC_URLS = [
  "https://rpc.mantle.xyz",
  "https://mantle-mainnet.public.blastapi.io",
  "https://rpc.ankr.com/mantle",
];

export const L1_BLOCK_PREDEPLOY = "0x4200000000000000000000000000000000000015";
export const GAS_PRICE_ORACLE = "0x420000000000000000000000000000000000000F";

/** Fallback Arsia params (used when all RPCs fail — order-of-magnitude correct only). */
export const FALLBACK_ARSIA: Omit<ArsiaParams, "fetchedAt" | "source"> = {
  baseFeeScalar: 1368n,
  blobBaseFeeScalar: 810949n,
  operatorFeeScalar: 0n,
  operatorFeeConstant: 0n,
  l1BaseFee: 1_500_000_000n,    // 1.5 gwei
  l1BlobFee: 1n,
  tokenRatio: 1n,               // Arsia upgrade removed the ETH/MNT scalar — fees are MNT-native.
  l2BaseFee: 20_000_000n,       // 0.02 gwei (Mantle baseline)
};
