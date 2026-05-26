import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { LLMFinding } from "../llm/types.js";
import type { MantleGasReport } from "../gas/types.js";

const ALGO = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAGIC = Buffer.from("ANEAL\x01", "utf8"); // 6 bytes

export interface EncryptedReport {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  keyHash: string; // keccak256(key) — verification only, NOT the key
}

export interface EncryptablePayload {
  findings: LLMFinding[];
  gasReport: MantleGasReport;
}

export function generateAuditKey(): Buffer {
  return randomBytes(KEY_BYTES);
}

/** keccak256 via Node's built-in (sha3-256). Returns 0x-prefixed hex. */
function keccakHex(buf: Buffer): string {
  // Node ships sha3-256 in OpenSSL; for keccak we use ethers-style via createHash("sha3-256").
  // Note: standardized SHA3-256 differs from Ethereum keccak256, but for an *integrity hash* of a
  // local key (never compared against on-chain hashes) the algorithm just needs to be stable.
  return "0x" + createHash("sha3-256").update(buf).digest("hex");
}

function jsonReplacer(_k: string, v: unknown): unknown {
  return typeof v === "bigint" ? v.toString() + "n" : v;
}

function jsonReviver(_k: string, v: unknown): unknown {
  if (typeof v === "string" && /^-?\d+n$/.test(v)) return BigInt(v.slice(0, -1));
  return v;
}

export function encryptFindings(
  findings: LLMFinding[],
  gasReport: MantleGasReport,
  key: Buffer,
): EncryptedReport {
  if (key.length !== KEY_BYTES) throw new Error(`key must be ${KEY_BYTES} bytes`);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const payload: EncryptablePayload = { findings, gasReport };
  const plain = Buffer.from(JSON.stringify(payload, jsonReplacer), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag, keyHash: keccakHex(key) };
}

export function decryptFindings(report: EncryptedReport, key: Buffer): EncryptablePayload {
  if (key.length !== KEY_BYTES) throw new Error(`key must be ${KEY_BYTES} bytes`);
  if (report.iv.length !== IV_BYTES) throw new Error(`iv must be ${IV_BYTES} bytes`);
  if (report.authTag.length !== TAG_BYTES) throw new Error(`authTag must be ${TAG_BYTES} bytes`);
  const decipher = createDecipheriv(ALGO, key, report.iv);
  decipher.setAuthTag(report.authTag);
  const plain = Buffer.concat([decipher.update(report.ciphertext), decipher.final()]);
  return JSON.parse(plain.toString("utf8"), jsonReviver) as EncryptablePayload;
}

/**
 * Serialized format (versioned, single buffer):
 *   [MAGIC 6][IV 12][AUTH_TAG 16][CIPHERTEXT_LEN u32 BE][CIPHERTEXT][KEYHASH_LEN u8][KEYHASH utf8]
 */
export function serializeEncryptedReport(r: EncryptedReport): Buffer {
  const keyHash = Buffer.from(r.keyHash, "utf8");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(r.ciphertext.length, 0);
  const khLen = Buffer.from([keyHash.length]);
  return Buffer.concat([MAGIC, r.iv, r.authTag, lenBuf, r.ciphertext, khLen, keyHash]);
}

export function deserializeEncryptedReport(data: Buffer): EncryptedReport {
  if (data.subarray(0, MAGIC.length).compare(MAGIC) !== 0) {
    throw new Error("not an Anneal encrypted report");
  }
  let off = MAGIC.length;
  const iv = data.subarray(off, off + IV_BYTES);
  off += IV_BYTES;
  const authTag = data.subarray(off, off + TAG_BYTES);
  off += TAG_BYTES;
  const ctLen = data.readUInt32BE(off);
  off += 4;
  const ciphertext = data.subarray(off, off + ctLen);
  off += ctLen;
  const khLen = data.readUInt8(off);
  off += 1;
  const keyHash = data.subarray(off, off + khLen).toString("utf8");
  return { ciphertext: Buffer.from(ciphertext), iv: Buffer.from(iv), authTag: Buffer.from(authTag), keyHash };
}
