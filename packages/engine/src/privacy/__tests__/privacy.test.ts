import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  generateAuditKey,
  encryptFindings,
  decryptFindings,
  serializeEncryptedReport,
  deserializeEncryptedReport,
} from "../encrypt.js";
import { uploadToArweave, fetchFromArweave } from "../arweave.js";
import type { LLMFinding } from "../../llm/types.js";
import type { MantleGasReport } from "../../gas/types.js";

const findings: LLMFinding[] = [
  {
    vulnClass: "reentrancy",
    severity: "high",
    lineStart: 10,
    lineEnd: 20,
    description: "reentrancy",
    recommendation: "checks-effects-interactions",
    confidencePct: 92,
    sources: ["haiku", "opus"],
  },
];

const gasReport: MantleGasReport = {
  functions: [],
  deployment: {
    totalGas: 1_200_000n,
    l2ExecutionFee: 1_000n,
    l1DataFee: 2_000n,
    operatorFee: 0n,
    totalCostMNT: "0.00000003",
    totalCostUSD: "0.0000",
  },
  optimizations: [],
  params: {
    baseFeeScalar: 1368n,
    blobBaseFeeScalar: 810949n,
    operatorFeeScalar: 0n,
    operatorFeeConstant: 0n,
    l1BaseFee: 1_500_000_000n,
    l1BlobFee: 1n,
    tokenRatio: 4000n,
    l2BaseFee: 20_000_000n,
    fetchedAt: "2026-05-27T00:00:00Z",
    source: "live",
  },
  consensus: { agreed: true, providersUsed: 3 },
};

describe("encryptFindings → decryptFindings", () => {
  it("round-trips findings + gas report (bigints preserved)", () => {
    const key = generateAuditKey();
    const enc = encryptFindings(findings, gasReport, key);
    const dec = decryptFindings(enc, key);
    expect(dec.findings).toEqual(findings);
    expect(dec.gasReport.deployment.totalGas).toBe(1_200_000n);
    expect(dec.gasReport.params.baseFeeScalar).toBe(1368n);
  });

  it("wrong key fails authentication", () => {
    const key1 = generateAuditKey();
    const key2 = generateAuditKey();
    const enc = encryptFindings(findings, gasReport, key1);
    expect(() => decryptFindings(enc, key2)).toThrow();
  });

  it("tamper with ciphertext fails auth tag check", () => {
    const key = generateAuditKey();
    const enc = encryptFindings(findings, gasReport, key);
    enc.ciphertext[0] = (enc.ciphertext[0]! ^ 0xff) & 0xff;
    expect(() => decryptFindings(enc, key)).toThrow();
  });

  it("serialize → deserialize → decrypt preserves payload", () => {
    const key = generateAuditKey();
    const enc = encryptFindings(findings, gasReport, key);
    const buf = serializeEncryptedReport(enc);
    const round = deserializeEncryptedReport(buf);
    expect(round.iv).toEqual(enc.iv);
    expect(round.authTag).toEqual(enc.authTag);
    expect(round.ciphertext).toEqual(enc.ciphertext);
    expect(round.keyHash).toBe(enc.keyHash);
    const dec = decryptFindings(round, key);
    expect(dec.findings).toEqual(findings);
  });

  it("deserialize rejects non-Anneal blob", () => {
    expect(() => deserializeEncryptedReport(Buffer.from("totally not anneal"))).toThrow(/Anneal/);
  });
});

describe("Arweave storage", () => {
  it("uploads through a mocked Arweave client with tags", async () => {
    const tags: { name: string; value: string }[] = [];
    const tx = {
      id: "abc123",
      addTag(name: string, value: string) {
        tags.push({ name, value });
      },
    };
    const client = {
      transactions: {
        getPrice: vi.fn(async () => "1000"),
        sign: vi.fn(async () => undefined),
        post: vi.fn(async () => ({ status: 200 })),
        getData: vi.fn(async () => new Uint8Array()),
      },
      createTransaction: vi.fn(async () => tx),
      ar: { winstonToAr: (w: string) => (Number(w) / 1e12).toString() },
    };
    const res = await uploadToArweave(Buffer.from("payload"), {
      agentId: 42,
      codeHash: "0xabc",
      verdictScore: 80,
      network: "mantle-sepolia",
      timestamp: "2026-05-27T00:00:00Z",
    }, { client, jwk: { fake: true } });
    expect(res.source).toBe("arweave");
    expect(res.uri).toBe("ar://abc123");
    const names = tags.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["App-Name", "Agent-Id", "Code-Hash", "Verdict-Score"]));
    expect(client.transactions.post).toHaveBeenCalledOnce();
  });

  it("falls back to local file when no Arweave client/jwk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "anneal-"));
    try {
      const res = await uploadToArweave(Buffer.from("hidden"), {
        agentId: 1,
        codeHash: "0xdeadbeef",
        verdictScore: 75,
        network: "mantle",
        timestamp: "2026-05-27T00:00:00Z",
      }, { localFallbackDir: dir });
      expect(res.source).toBe("local-fallback");
      expect(res.path).toBeDefined();
      const fetched = readFileSync(res.path!);
      expect(fetched.toString("utf8")).toBe("hidden");
      const reloaded = await fetchFromArweave(res.txId, { localPath: res.path });
      expect(reloaded.toString("utf8")).toBe("hidden");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
