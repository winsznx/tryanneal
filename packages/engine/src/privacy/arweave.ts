import { mkdir, writeFile, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface ArweaveUploadResult {
  txId: string;
  uri: string;
  size: number;
  cost: string;
  costUSD: string;
  source: "arweave" | "local-fallback";
  path?: string;
}

export interface ArweaveMetadata {
  agentId: number;
  codeHash: string;
  verdictScore: number;
  network: string;
  timestamp: string;
}

export interface ArweaveLike {
  // Subset of arweave-js surface area used here.
  transactions: {
    getPrice(size: number): Promise<string>;
    sign(tx: unknown, jwk: unknown): Promise<void>;
    post(tx: unknown): Promise<{ status: number; statusText?: string }>;
  };
  createTransaction(
    args: { data: Uint8Array | Buffer },
    jwk: unknown,
  ): Promise<{ id: string; addTag(name: string, value: string): void }>;
  ar: { winstonToAr(winston: string): string };
}

export interface UploadOptions {
  client?: ArweaveLike;
  jwk?: unknown;
  localFallbackDir?: string;
  arPriceUSD?: number;
}

const DEFAULT_FALLBACK_DIR = "./reports";

function tagMap(meta: ArweaveMetadata): Record<string, string> {
  return {
    "App-Name": "TryAnneal",
    "Content-Type": "application/octet-stream",
    "Agent-Id": String(meta.agentId),
    "Code-Hash": meta.codeHash,
    "Verdict-Score": String(meta.verdictScore),
    "Network": meta.network,
    "Timestamp": meta.timestamp,
  };
}

export async function uploadToArweave(
  encryptedData: Buffer,
  metadata: ArweaveMetadata,
  opts: UploadOptions = {},
): Promise<ArweaveUploadResult> {
  if (!opts.client || !opts.jwk) {
    return localFallback(encryptedData, metadata, opts.localFallbackDir);
  }
  const tx = await opts.client.createTransaction({ data: encryptedData }, opts.jwk);
  for (const [k, v] of Object.entries(tagMap(metadata))) tx.addTag(k, v);
  let cost = "0";
  let costUSD = "0";
  try {
    const winston = await opts.client.transactions.getPrice(encryptedData.length);
    cost = opts.client.ar.winstonToAr(winston);
    costUSD = ((opts.arPriceUSD ?? 8) * Number(cost)).toFixed(6);
  } catch {
    // price endpoint optional
  }
  await opts.client.transactions.sign(tx, opts.jwk);
  const res = await opts.client.transactions.post(tx);
  if (res.status !== 200 && res.status !== 202) {
    throw new Error(`Arweave post failed: ${res.status} ${res.statusText ?? ""}`);
  }
  return {
    txId: tx.id,
    uri: `ar://${tx.id}`,
    size: encryptedData.length,
    cost,
    costUSD,
    source: "arweave",
  };
}

async function localFallback(
  data: Buffer,
  meta: ArweaveMetadata,
  dir?: string,
): Promise<ArweaveUploadResult> {
  const root = resolve(process.cwd(), dir ?? DEFAULT_FALLBACK_DIR);
  const path = resolve(root, `${meta.codeHash.replace(/^0x/, "")}.enc`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
  return {
    txId: `local:${meta.codeHash}`,
    uri: `file://${path}`,
    size: data.length,
    cost: "0",
    costUSD: "0",
    source: "local-fallback",
    path,
  };
}

export interface FetchOptions {
  client?: { transactions: { getData(id: string, opts: { decode: boolean }): Promise<Uint8Array> } };
  localPath?: string;
}

export async function fetchFromArweave(txId: string, opts: FetchOptions = {}): Promise<Buffer> {
  if (txId.startsWith("local:") || opts.localPath) {
    const p = opts.localPath ?? resolve(process.cwd(), DEFAULT_FALLBACK_DIR, `${txId.slice(6).replace(/^0x/, "")}.enc`);
    return readFile(p);
  }
  if (!opts.client) {
    // Default: GET https://arweave.net/<id>
    const res = await fetch(`https://arweave.net/${txId}`);
    if (!res.ok) throw new Error(`arweave fetch ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const data = await opts.client.transactions.getData(txId, { decode: true });
  return Buffer.from(data);
}
