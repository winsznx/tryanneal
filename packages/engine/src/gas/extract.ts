import { type FunctionInput } from "./types.js";

const FN_RE = /function\s+(\w+)\s*\(([^)]*)\)\s*(?:external|public)\b/g;

/** Approximate Solidity ABI type from a parameter declaration. */
function inferType(decl: string): string {
  const t = decl.trim().split(/\s+/)[0] ?? "";
  if (!t) return "uint256";
  // strip storage modifiers
  if (t === "calldata" || t === "memory" || t === "storage") return "bytes";
  // Solidity shorthand
  if (t === "uint") return "uint256";
  if (t === "int") return "int256";
  return t;
}

export interface ExtractedFunction {
  name: string;
  signature: string;
  paramTypes: string[];
}

/** Lightweight extractor — finds external/public function signatures. */
export function extractFunctions(source: string): ExtractedFunction[] {
  const out: ExtractedFunction[] = [];
  for (const m of source.matchAll(FN_RE)) {
    const name = m[1]!;
    const params = m[2]!.split(",").map((s) => s.trim()).filter(Boolean);
    const types = params.map(inferType);
    out.push({ name, signature: `${name}(${types.join(",")})`, paramTypes: types });
  }
  return out;
}

const STATIC_TYPES = new Set([
  "address",
  "bool",
  "bytes32",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uint128",
  "uint256",
  "int8",
  "int16",
  "int32",
  "int64",
  "int128",
  "int256",
]);

/** Sample 32-byte calldata per static param, 96 bytes per dynamic param. */
function sampleCalldata(paramTypes: string[]): Uint8Array {
  const head: number[] = [];
  for (const t of paramTypes) {
    if (STATIC_TYPES.has(t)) {
      for (let i = 0; i < 32; i++) head.push(0);
    } else {
      // dynamic: 32 bytes offset + 32 length + 32 data
      for (let i = 0; i < 96; i++) head.push(0);
    }
  }
  return new Uint8Array(head);
}

function selectorFromSignature(sig: string): string {
  // Tiny inline keccak via subtle web crypto is async; use ethers-style via Node createHash unavailable.
  // We fall back to a deterministic 4-byte pseudo-selector for offline use; live attest replaces this.
  // Real keccak is performed via `ethers` in the CLI when available.
  let h = 0xdeadbeef;
  for (let i = 0; i < sig.length; i++) {
    h = ((h * 31) ^ sig.charCodeAt(i)) >>> 0;
  }
  return "0x" + h.toString(16).padStart(8, "0").slice(0, 8);
}

export function toFunctionInputs(source: string, l2GasPerFn = 35_000n): FunctionInput[] {
  return extractFunctions(source).map((fn) => {
    const calldataBody = sampleCalldata(fn.paramTypes);
    const selector = selectorFromSignature(fn.signature);
    const selBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) selBytes[i] = parseInt(selector.slice(2 + i * 2, 4 + i * 2), 16);
    const calldata = new Uint8Array(selBytes.length + calldataBody.length);
    calldata.set(selBytes, 0);
    calldata.set(calldataBody, selBytes.length);
    return {
      name: fn.name,
      selector,
      calldata,
      l2GasUsed: l2GasPerFn,
    };
  });
}
