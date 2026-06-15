"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import VerdictScore from "./verdict-score";
import SeverityBadge from "./severity-badge";

/**
 * Interactive safety oracle — paste a code hash (or pick an example) and read
 * the verdict straight from the on-chain AnnealValidation registry via
 * /api/safety/[hash]. The is_this_safe() primitive, in the browser.
 *
 * Styled on the site's design tokens directly (inline styles + a scoped
 * <style> block for responsive rules) — the same system the landing sections
 * use — so it renders identically everywhere and matches the design spec.
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

const MONO = "var(--font-mono)";
const CARD: React.CSSProperties = {
  background: "var(--color-slate-gray)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "2px",
};

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
    <div style={{ width: "100%", maxWidth: "720px", marginLeft: "auto", marginRight: "auto" }}>
      <style>{`
        .so-getrow { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .so-inputrow { display: flex; gap: 10px; }
        .so-examples { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .so-result { display: flex; flex-direction: row; align-items: center; gap: 28px; text-align: left; }
        @media (max-width: 640px) {
          .so-inputrow { flex-direction: column; }
          .so-check { width: 100%; }
          .so-examples { grid-template-columns: 1fr; }
          .so-result { flex-direction: column; align-items: center; text-align: center; }
        }
      `}</style>

      {/* Query card */}
      <div style={{ ...CARD, padding: "22px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* endpoint + network */}
        <div className="so-getrow">
          <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)", letterSpacing: "0.04em" }}>
            GET
          </span>
          <code
            style={{
              fontFamily: MONO,
              fontSize: "13px",
              color: "var(--color-ash-gray)",
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            /api/safety/&lt;codeHash&gt;
          </code>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            {(["mantle", "mantle-sepolia"] as Network[]).map((n) => {
              const active = network === n;
              return (
                <button
                  key={n}
                  onClick={() => setNetwork(n)}
                  style={{
                    fontFamily: MONO,
                    fontSize: "11px",
                    padding: "5px 11px",
                    borderRadius: "2px",
                    cursor: "pointer",
                    transition: "background 150ms ease, color 150ms ease",
                    color: active ? "var(--color-cloud-white)" : "var(--color-subtle-ash)",
                    background: active ? "var(--color-ultraviolet-blue)" : "transparent",
                    border: `1px solid ${active ? "var(--color-ultraviolet-blue)" : "rgba(255,255,255,0.1)"}`,
                  }}
                >
                  {n === "mantle" ? "mainnet" : "sepolia"}
                </button>
              );
            })}
          </div>
        </div>

        {/* input + check */}
        <div className="so-inputrow">
          <input
            value={hash}
            onChange={(e) => setHash(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && query(hash, network)}
            placeholder="0x… 32-byte code hash"
            spellCheck={false}
            style={{
              flex: 1,
              minWidth: 0,
              background: "var(--color-deep-space)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "2px",
              padding: "13px 14px",
              fontFamily: MONO,
              fontSize: "14px",
              color: "var(--color-cloud-white)",
              outline: "none",
            }}
          />
          <button
            className="so-check"
            onClick={() => query(hash, network)}
            disabled={loading}
            style={{
              flexShrink: 0,
              fontFamily: MONO,
              fontSize: "14px",
              fontWeight: 500,
              padding: "13px 26px",
              borderRadius: "2px",
              border: "none",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1,
              background: "var(--color-ultraviolet-blue)",
              color: "var(--color-cloud-white)",
              transition: "opacity 150ms ease",
            }}
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </div>

        {/* examples */}
        <div className="so-examples">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.hash}
              onClick={() => {
                setHash(ex.hash);
                setNetwork(ex.network);
                query(ex.hash, ex.network);
              }}
              style={{
                textAlign: "left",
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "2px",
                padding: "11px 13px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "3px",
                transition: "border-color 150ms ease, background 150ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-cloud-white)" }}>{ex.label}</span>
              <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>{ex.sub}</span>
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
            style={{ fontFamily: MONO, fontSize: "12px", marginTop: "14px", color: "var(--color-severity-high)" }}
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
            style={{ ...CARD, padding: "22px", marginTop: "14px", textAlign: "center" }}
          >
            <p style={{ fontFamily: MONO, fontSize: "14px", color: "var(--color-cloud-white)" }}>
              No on-chain verdict for this hash.
            </p>
            <p style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)", marginTop: "6px" }}>
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
            className="so-result"
            style={{ ...CARD, padding: "26px", marginTop: "14px" }}
          >
            <VerdictScore score={result.score ?? 0} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <SeverityBadge severity={result.safe ? "safe" : "critical"} />
                <span style={{ fontFamily: MONO, fontSize: "14px", color: "var(--color-cloud-white)" }}>
                  {result.safe ? "Safe to compose" : "Do not compose"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", columnGap: "20px", rowGap: "4px" }}>
                {[
                  ["critical", result.criticalCount],
                  ["high", result.highCount],
                  ["medium", result.mediumCount],
                  ["low", result.lowCount],
                ].map(([k, v]) => (
                  <span key={k as string} style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)" }}>
                    {k}: <span style={{ color: "var(--color-cloud-white)" }}>{(v as number) ?? 0}</span>
                  </span>
                ))}
              </div>
              <div style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)", display: "flex", flexDirection: "column", gap: "3px" }}>
                {result.agentId != null && (
                  <span>
                    attested by agent <span style={{ color: "var(--color-cloud-white)" }}>#{result.agentId}</span> ({result.network})
                  </span>
                )}
                {result.attestedAt && <span>at {new Date(result.attestedAt).toISOString().slice(0, 19)}Z</span>}
                {result.mantlescanContractUrl && (
                  <a
                    href={result.mantlescanContractUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--color-lavender-glow)", textDecoration: "underline" }}
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
