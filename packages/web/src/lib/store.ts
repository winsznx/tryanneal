/**
 * Persistent audit store — the industry-grade read path for the dashboard.
 *
 * Shape: chain → incremental indexer (block cursor) → Postgres → web reads.
 * The web NEVER touches RPC on a page load; a background indexer walks
 * `AuditPosted` logs from a persisted block cursor and upserts verdicts, so a
 * redeploy resumes from the saved cursor instead of rescanning from genesis.
 *
 * Every layer degrades safely: if DATABASE_URL is unset or the DB is
 * unreachable, reads fall back to the committed seed snapshot
 * (public/data/audits.json) — the demo can never be broken by the DB.
 */
import { Pool } from "pg";
import { JsonRpcProvider, Contract, Interface } from "ethers";
import { AuditsFileSchema, readJson, type Audit } from "../../app/api/_lib";

interface NetworkConfig {
  key: "mantle-mainnet" | "mantle-sepolia";
  rpc: string;
  validation: string;
  explorer: string;
  startBlock: number;
}

const NETWORKS: NetworkConfig[] = [
  {
    key: "mantle-mainnet",
    rpc: process.env.MANTLE_RPC_URL ?? "https://rpc.mantle.xyz",
    validation: process.env.ANNEAL_VALIDATION_MAINNET ?? "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
    explorer: "https://mantlescan.xyz",
    startBlock: Number(process.env.ANNEAL_START_BLOCK_MAINNET ?? 96690000),
  },
  {
    key: "mantle-sepolia",
    rpc: process.env.MANTLE_SEPOLIA_RPC_URL ?? "https://rpc.sepolia.mantle.xyz",
    validation: process.env.ANNEAL_VALIDATION_SEPOLIA ?? "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
    explorer: "https://sepolia.mantlescan.xyz",
    startBlock: Number(process.env.ANNEAL_START_BLOCK_SEPOLIA ?? 39738154),
  },
];

const AUDIT_POSTED_ABI =
  "event AuditPosted(uint256 indexed agentId, bytes32 indexed codeHash, uint8 verdictScore, string reportURI, uint256 timestamp)";
const GET_VERDICT_ABI =
  "function getVerdict(bytes32 codeHash) external view returns (tuple(uint256 agentId, bytes32 codeHash, uint8 verdictScore, uint8 criticalCount, uint8 highCount, uint8 mediumCount, uint8 lowCount, string reportURI, uint256 timestamp, bytes32 gasReportHash))";

const CHUNK = 50_000;
const MAX_CHUNKS_PER_RUN = 20;
const SYNC_INTERVAL_MS = 60_000;

function dbEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let _pool: Pool | null = null;
function pool(): Pool {
  if (!_pool) {
    const url = process.env.DATABASE_URL!;
    const needsSsl = /sslmode=require/.test(url) || process.env.PGSSL === "require";
    _pool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      // Bound query execution so a *connected-but-stalled* DB rejects rather
      // than hangs — that's what lets every read degrade to the seed snapshot.
      statement_timeout: 8_000,
      query_timeout: 8_000,
      ...(needsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    });
    _pool.on("error", (err) => console.error("[store] idle client error:", err.message));
  }
  return _pool;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

// --- Seed snapshot (always available, even with no DB) ----------------------

let _seedCache: Audit[] | null = null;
async function seedAudits(): Promise<Audit[]> {
  if (!_seedCache) {
    const { audits } = await readJson("audits.json", AuditsFileSchema);
    _seedCache = audits;
  }
  return _seedCache;
}

// --- Schema + seed ----------------------------------------------------------

let _readyPromise: Promise<void> | null = null;
function ensureReady(): Promise<void> {
  if (!_readyPromise) {
    // Time-box init (DDL + seed) and, on failure, drop the memoized promise so
    // the next read retries the DB instead of latching a permanently-rejected one.
    _readyPromise = withTimeout(initOnce(), 12_000, "db init").catch((e) => {
      _readyPromise = null;
      throw e;
    });
  }
  return _readyPromise;
}

async function initOnce(): Promise<void> {
  await pool().query(`
    CREATE TABLE IF NOT EXISTS audits (
      code_hash      TEXT     NOT NULL,
      network        TEXT     NOT NULL,
      agent_id       INTEGER  NOT NULL DEFAULT 0,
      verdict_score  SMALLINT NOT NULL DEFAULT 0,
      critical_count SMALLINT NOT NULL DEFAULT 0,
      high_count     SMALLINT NOT NULL DEFAULT 0,
      medium_count   SMALLINT NOT NULL DEFAULT 0,
      low_count      SMALLINT NOT NULL DEFAULT 0,
      report_uri     TEXT     NOT NULL DEFAULT '',
      contract_name  TEXT,
      tx_hash        TEXT,
      block_number   BIGINT,
      attested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      source         TEXT     NOT NULL DEFAULT 'chain',
      raw            JSONB,
      PRIMARY KEY (code_hash, network)
    );
    CREATE INDEX IF NOT EXISTS audits_attested_at_idx ON audits (attested_at DESC);
    CREATE TABLE IF NOT EXISTS index_cursor (
      network    TEXT PRIMARY KEY,
      last_block BIGINT NOT NULL
    );
  `);
  await seedFromJson();
}

async function seedFromJson(): Promise<void> {
  const audits = await seedAudits();
  for (const a of audits) {
    await pool().query(
      `INSERT INTO audits
         (code_hash, network, agent_id, verdict_score, critical_count, high_count, medium_count, low_count,
          report_uri, contract_name, tx_hash, attested_at, source, raw)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'seed',$13)
       ON CONFLICT (code_hash, network) DO UPDATE SET
         agent_id = EXCLUDED.agent_id,
         verdict_score = EXCLUDED.verdict_score,
         critical_count = EXCLUDED.critical_count,
         high_count = EXCLUDED.high_count,
         medium_count = EXCLUDED.medium_count,
         low_count = EXCLUDED.low_count,
         report_uri = EXCLUDED.report_uri,
         contract_name = EXCLUDED.contract_name,
         tx_hash = EXCLUDED.tx_hash,
         attested_at = EXCLUDED.attested_at,
         source = 'seed',
         raw = EXCLUDED.raw`,
      [
        a.codeHash.toLowerCase(),
        a.network,
        a.agentId,
        a.verdictScore,
        a.criticalCount,
        a.highCount,
        a.mediumCount,
        a.lowCount,
        a.reportURI ?? "",
        a.contractName ?? null,
        a.txHash ?? null,
        a.timestamp,
        JSON.stringify(a),
      ],
    );
  }
}

// --- Incremental indexer ----------------------------------------------------

let _syncing = false;
let _intervalStarted = false;

function kickSync(): void {
  if (!_intervalStarted) {
    _intervalStarted = true;
    const t = setInterval(() => void syncFromChain(), SYNC_INTERVAL_MS);
    // Don't keep the process alive purely for the indexer.
    if (typeof t.unref === "function") t.unref();
  }
  void syncFromChain();
}

async function getCursor(network: string, fallback: number): Promise<number> {
  const { rows } = await pool().query<{ last_block: string }>(
    "SELECT last_block FROM index_cursor WHERE network = $1",
    [network],
  );
  return rows.length ? Number(rows[0]!.last_block) : fallback;
}

async function setCursor(network: string, block: number): Promise<void> {
  await pool().query(
    `INSERT INTO index_cursor (network, last_block) VALUES ($1, $2)
     ON CONFLICT (network) DO UPDATE SET last_block = EXCLUDED.last_block`,
    [network, block],
  );
}

async function syncFromChain(): Promise<void> {
  if (!dbEnabled() || _syncing) return;
  _syncing = true;
  try {
    await ensureReady();
    for (const net of NETWORKS) {
      try {
        await syncNetwork(net);
      } catch (e) {
        console.error(`[store] sync ${net.key} failed:`, (e as Error).message);
      }
    }
  } finally {
    _syncing = false;
  }
}

async function syncNetwork(net: NetworkConfig): Promise<void> {
  const provider = new JsonRpcProvider(net.rpc, undefined, { staticNetwork: true });
  const iface = new Interface([AUDIT_POSTED_ABI]);
  const topic = iface.getEvent("AuditPosted")!.topicHash;
  const verdict = new Contract(net.validation, [GET_VERDICT_ABI], provider);

  const latest = await withTimeout(provider.getBlockNumber(), 5_000, `${net.key} getBlockNumber`);
  const cursor = await getCursor(net.key, net.startBlock - 1);
  let from = cursor + 1;
  if (from > latest) return;

  let chunks = 0;
  while (from <= latest && chunks < MAX_CHUNKS_PER_RUN) {
    const to = Math.min(from + CHUNK - 1, latest);
    const logs = await withTimeout(
      provider.getLogs({ address: net.validation, topics: [topic], fromBlock: from, toBlock: to }),
      8_000,
      `${net.key} getLogs ${from}-${to}`,
    );
    for (const log of logs) {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed) continue;
      const codeHash = String(parsed.args.codeHash).toLowerCase();
      const counts = (await withTimeout(
        verdict.getFunction("getVerdict")(codeHash),
        8_000,
        `${net.key} getVerdict`,
      )) as unknown as Array<bigint | string>;
      await upsertChainAudit(net, {
        codeHash,
        agentId: Number(parsed.args.agentId),
        verdictScore: Number(counts[2]),
        criticalCount: Number(counts[3]),
        highCount: Number(counts[4]),
        mediumCount: Number(counts[5]),
        lowCount: Number(counts[6]),
        reportURI: String(parsed.args.reportURI),
        timestamp: Number(parsed.args.timestamp),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
      });
    }
    await setCursor(net.key, to);
    from = to + 1;
    chunks += 1;
  }
}

interface ChainAudit {
  codeHash: string;
  agentId: number;
  verdictScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  reportURI: string;
  timestamp: number;
  txHash: string;
  blockNumber: number;
}

async function upsertChainAudit(net: NetworkConfig, a: ChainAudit): Promise<void> {
  // Preserve seed richness (contract_name / raw / source) on conflict; only
  // refresh the on-chain-derived facts.
  await pool().query(
    `INSERT INTO audits
       (code_hash, network, agent_id, verdict_score, critical_count, high_count, medium_count, low_count,
        report_uri, tx_hash, block_number, attested_at, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,to_timestamp($12),'chain')
     ON CONFLICT (code_hash, network) DO UPDATE SET
       agent_id = EXCLUDED.agent_id,
       verdict_score = EXCLUDED.verdict_score,
       critical_count = EXCLUDED.critical_count,
       high_count = EXCLUDED.high_count,
       medium_count = EXCLUDED.medium_count,
       low_count = EXCLUDED.low_count,
       report_uri = EXCLUDED.report_uri,
       attested_at = EXCLUDED.attested_at,
       tx_hash = COALESCE(audits.tx_hash, EXCLUDED.tx_hash),
       block_number = EXCLUDED.block_number`,
    [
      a.codeHash,
      net.key,
      a.agentId,
      a.verdictScore,
      a.criticalCount,
      a.highCount,
      a.mediumCount,
      a.lowCount,
      a.reportURI,
      a.txHash,
      a.blockNumber,
      a.timestamp,
    ],
  );
}

// --- Read path --------------------------------------------------------------

type AuditRow = {
  code_hash: string;
  network: string;
  agent_id: number;
  verdict_score: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  report_uri: string;
  contract_name: string | null;
  tx_hash: string | null;
  attested_at: Date;
  raw: Audit | null;
};

function rowToAudit(r: AuditRow): Audit {
  const raw = r.raw ?? undefined;
  const explorer = r.network === "mantle-mainnet" ? "https://mantlescan.xyz" : "https://sepolia.mantlescan.xyz";
  const txHash = r.tx_hash ?? raw?.txHash ?? "";
  return {
    codeHash: r.code_hash,
    agentId: Number(r.agent_id),
    contractName: raw?.contractName ?? r.contract_name ?? undefined,
    verdictScore: Number(r.verdict_score),
    criticalCount: Number(r.critical_count),
    highCount: Number(r.high_count),
    mediumCount: Number(r.medium_count),
    lowCount: Number(r.low_count),
    reportURI: r.report_uri ?? raw?.reportURI ?? "",
    network: r.network,
    timestamp: r.attested_at.toISOString(),
    txHash,
    mantlescanUrl: raw?.mantlescanUrl ?? (txHash ? `${explorer}/tx/${txHash}` : null),
    findings: raw?.findings,
    gasReport: raw?.gasReport,
    llmConsensus: raw?.llmConsensus,
  };
}

export async function getAudits(): Promise<Audit[]> {
  if (!dbEnabled()) return seedAudits();
  try {
    await ensureReady();
    kickSync();
    const { rows } = await pool().query<AuditRow>("SELECT * FROM audits ORDER BY attested_at DESC LIMIT 500");
    if (!rows.length) return seedAudits();
    return rows.map(rowToAudit);
  } catch (e) {
    console.error("[store] getAudits failed, serving seed snapshot:", (e as Error).message);
    return seedAudits();
  }
}

export async function getAudit(codeHash: string): Promise<Audit | null> {
  const wanted = codeHash.toLowerCase();
  // Reject anything that isn't a 32-byte hex hash before it touches the DB or
  // the seed scan — bounds the input and matches the safety endpoint's contract.
  if (!/^0x[0-9a-f]{64}$/.test(wanted)) return null;
  if (!dbEnabled()) {
    return (await seedAudits()).find((a) => a.codeHash.toLowerCase() === wanted) ?? null;
  }
  try {
    await ensureReady();
    kickSync();
    const { rows } = await pool().query<AuditRow>(
      "SELECT * FROM audits WHERE lower(code_hash) = $1 LIMIT 1",
      [wanted],
    );
    if (rows.length) return rowToAudit(rows[0]!);
    return (await seedAudits()).find((a) => a.codeHash.toLowerCase() === wanted) ?? null;
  } catch (e) {
    console.error("[store] getAudit failed, serving seed snapshot:", (e as Error).message);
    return (await seedAudits()).find((a) => a.codeHash.toLowerCase() === wanted) ?? null;
  }
}

/** Force a synchronous indexer pass (used by the manual /api/sync route). */
export async function runSyncNow(): Promise<{ ok: boolean; error?: string }> {
  if (!dbEnabled()) return { ok: false, error: "DATABASE_URL not configured" };
  try {
    await ensureReady();
    await syncFromChain();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
