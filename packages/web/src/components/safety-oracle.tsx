"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import VerdictScore from "./verdict-score";
import SeverityBadge from "./severity-badge";

/**
 * Interactive safety oracle — paste a code hash (or pick an example) and read
 * the verdict straight from the on-chain AnnealValidation registry via
 * /api/safety/[hash]. This is the is_this_safe() primitive, usable in the
 * browser. No keys, no SDK — the same call any agent makes.
 */

type Network = "mantle" | "mantle-sepolia";

interface SafetyResponse {
  safe: boolean | null;
  score: number | null;
  codeHash: string;
  agentId?: number;
  network?: string;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  attestedAt?: string;
  attestedBy?: string;
  mantlescanContractUrl?: string;
  message?: string;
}

const EXAMPLES: { label: string; sub: string; hash: string; network: Network }[] = [
  {
    label: "Merchant Moe LB Router",
    sub: "live · ~$60M TVL · mainnet",
    hash: "0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab",
    network: "mantle",
  },
  {
    label: "SampleVault",
    sub: "reentrancy · sepolia",
    hash: "0xb8847a37ce8437d01189686090f93af466e4eaa5e5fe3de7ba2579338e85e7b0",
    network: "mantle-sepolia",
  },
  {
    label: "ProxyAdmin",
    sub: "delegatecall · sepolia",
    hash: "0xa96cf70c96c4b540c1f60b701ec6dee2b7d5f93770185f7acb3b30ad6ceb678e",
    network: "mantle-sepolia",
  },
];

export default function SafetyOracle() {
  const [hash, setHash] = useState("");
  const [network, setNetwork] = useState<Network>("mantle");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SafetyResponse | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function query(codeHash: string, net: Network) {
    const trimmed = codeHash.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
      setError("Enter a 0x-prefixed 32-byte code hash.");
      setResult(null);
      setStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus(null);
    try {
      const res = await fetch(`/api/safety/${trimmed}?network=${net}`);
      setStatus(res.status);
      setResult((await res.json()) as SafetyResponse);
    } catch {
      setError("Network error reaching the oracle. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const found = status === 200 && result?.score != null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Query bar */}
      <div className="bg-slate-gray rounded-sm border border-white/5 p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-micro text-subtle-ash">GET</span>
          <code className="font-mono text-micro text-ash-gray truncate">/api/safety/&lt;codeHash&gt;</code>
          <div className="ml-auto flex items-center gap-1">
            {(["mantle", "mantle-sepolia"] as Network[]).map((n) => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className="font-mono text-micro px-2 py-1 rounded-sm transition-colors"
                style={{
                  color: network === n ? "var(--color-cloud-white)" : "var(--color-subtle-ash)",
                  background: network === n ? "var(--color-ultraviolet-blue)" : "transparent",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {n === "mantle" ? "mainnet" : "sepolia"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <input
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query(hash, network)}
            placeholder="0x… 32-byte code hash"
            spellCheck={false}
            className="flex-1 bg-deep-space rounded-sm px-3 py-2 font-mono text-small text-cloud-white outline-none"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          />
          <button
            onClick={() => query(hash, network)}
            disabled={loading}
            className="font-mono text-small px-4 py-2 rounded-sm transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-ultraviolet-blue)", color: "var(--color-cloud-white)" }}
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </div>
        {/* Examples */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.hash}
              onClick={() => {
                setHash(ex.hash);
                setNetwork(ex.network);
                query(ex.hash, ex.network);
              }}
              className="text-left rounded-sm px-3 py-1.5 transition-colors hover:bg-white/5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="font-mono text-micro text-cloud-white block">{ex.label}</span>
              <span className="font-mono text-micro text-subtle-ash">{ex.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.p
            key="err"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="font-mono text-micro mt-3"
            style={{ color: "var(--color-severity-high)" }}
          >
            {error}
          </motion.p>
        )}

        {status === 404 && !error && (
          <motion.div
            key="404"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-slate-gray rounded-sm border border-white/5 p-5 mt-3 text-center"
          >
            <p className="font-mono text-small text-cloud-white">No on-chain verdict for this hash.</p>
            <p className="font-mono text-micro text-subtle-ash mt-1">
              Nothing has audited it yet. Run <code>anneal audit &lt;file&gt; --attest</code> to post one.
            </p>
          </motion.div>
        )}

        {found && result && (
          <motion.div
            key={result.codeHash + result.network}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-slate-gray rounded-sm border border-white/5 p-6 mt-3 flex flex-col sm:flex-row items-center gap-6"
          >
            <VerdictScore score={result.score ?? 0} />
            <div className="flex-1 flex flex-col gap-3 w-full">
              <div className="flex items-center gap-3">
                <SeverityBadge severity={result.safe ? "safe" : "critical"} />
                <span className="font-mono text-small text-cloud-white">
                  {result.safe ? "Safe to compose" : "Do not compose"}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                {[
                  ["critical", result.criticalCount],
                  ["high", result.highCount],
                  ["medium", result.mediumCount],
                  ["low", result.lowCount],
                ].map(([k, v]) => (
                  <span key={k as string} className="font-mono text-micro text-subtle-ash">
                    {k}: <span className="text-cloud-white">{v ?? 0}</span>
                  </span>
                ))}
              </div>
              <div className="font-mono text-micro text-subtle-ash flex flex-col gap-1">
                {result.agentId != null && (
                  <span>
                    attested by agent <span className="text-cloud-white">#{result.agentId}</span> ({result.network})
                  </span>
                )}
                {result.attestedAt && <span>at {new Date(result.attestedAt).toISOString().slice(0, 19)}Z</span>}
                {result.mantlescanContractUrl && (
                  <a
                    href={result.mantlescanContractUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                    style={{ color: "var(--color-ultraviolet-blue)" }}
                  >
                    view registry on mantlescan ↗
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
