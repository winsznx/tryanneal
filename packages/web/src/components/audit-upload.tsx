"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import VerdictScore from "./verdict-score";
import SeverityBadge from "./severity-badge";
import { plainFinding, plainVerdict, severityCounts } from "../lib/plain-language";

const VERDICT_TONE: Record<"good" | "warn" | "bad", string> = {
  good: "var(--color-accent-green)",
  warn: "var(--color-severity-medium)",
  bad: "var(--color-severity-high)",
};

/**
 * Audit a contract straight from the dashboard — paste or upload Solidity, it
 * runs the full Slither + corpus audit on the hosted MCP server (/api/audit
 * proxies to it) and renders the verdict. No keys, no terminal.
 */
interface Finding {
  severity?: string;
  vulnClass?: string;
  title?: string;
  lineStart?: number;
  lineEnd?: number;
}
interface AuditResult {
  verdictScore?: number;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  findings?: Finding[];
  note?: string;
  error?: string;
  analysisIncomplete?: boolean;
}

const MONO = "var(--font-mono)";

export default function AuditUpload() {
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setSource(await f.text());
  }

  async function run() {
    if (!source.trim()) {
      setError("Paste or upload a Solidity contract first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceCode: source }),
      });
      const data = (await res.json()) as AuditResult;
      if (!res.ok || data.error) setError(data.error ?? `Audit failed (${res.status}).`);
      else setResult(data);
    } catch {
      setError("Network error reaching the audit service.");
    } finally {
      setLoading(false);
    }
  }

  const findings = result?.findings ?? [];
  const derived = severityCounts(findings);
  const counts = findings.length
    ? derived
    : {
        critical: result?.criticalCount ?? 0,
        high: result?.highCount ?? 0,
        medium: result?.mediumCount ?? 0,
        low: result?.lowCount ?? 0,
      };

  return (
    <div style={{ width: "100%", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "24px", background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--color-cloud-white)" }}>Audit a contract</span>
        <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>Slither + 113-pattern corpus · via MCP</span>
      </div>

      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder={"// Paste Solidity here, or upload a .sol file\npragma solidity ^0.8.19;\ncontract MyVault { ... }"}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: "180px",
          resize: "vertical",
          background: "var(--color-deep-space)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "4px",
          padding: "14px",
          fontFamily: MONO,
          fontSize: "13px",
          lineHeight: 1.6,
          color: "var(--color-cloud-white)",
          outline: "none",
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          style={{ fontFamily: MONO, fontSize: "13px", fontWeight: 500, padding: "11px 22px", borderRadius: "4px", border: "none", cursor: loading ? "default" : "pointer", opacity: loading ? 0.55 : 1, background: "var(--color-ultraviolet-blue)", color: "white" }}
        >
          {loading ? "Auditing… (Slither + corpus)" : "Run audit"}
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{ fontFamily: MONO, fontSize: "13px", padding: "11px 18px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "var(--color-cloud-white)", cursor: "pointer" }}
        >
          Upload .sol
        </button>
        <input ref={fileRef} type="file" accept=".sol,text/plain" onChange={onFile} style={{ display: "none" }} />
        <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>1 audit / 5 min</span>
      </div>

      <AnimatePresence mode="wait">
        {error && (
          <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-severity-high)" }}>
            {error}
          </motion.p>
        )}
        {result && (
          <motion.div key="res" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "18px" }}>
            {(() => {
              const v = plainVerdict(result.verdictScore ?? 0, counts.critical, counts.high, result.analysisIncomplete);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "15px", fontWeight: 500, color: VERDICT_TONE[v.tone] }}>{v.headline}</span>
                  <span style={{ fontSize: "13px", color: "var(--color-subtle-ash)", lineHeight: 1.5 }}>{v.detail}</span>
                </div>
              );
            })()}
            <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
              <VerdictScore score={result.verdictScore ?? 0} />
              <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
                {[["critical", counts.critical], ["high", counts.high], ["medium", counts.medium], ["low", counts.low]].map(([k, v]) => (
                  <span key={k as string} style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)" }}>
                    {k}: <span style={{ color: "var(--color-cloud-white)" }}>{(v as number) ?? 0}</span>
                  </span>
                ))}
              </div>
            </div>
            {findings.slice(0, 6).map((f, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <SeverityBadge severity={(f.severity as "critical" | "high" | "medium" | "low" | "informational") ?? "informational"} />
                  <span style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-cloud-white)" }}>{f.vulnClass ?? f.title ?? "finding"}</span>
                  {f.lineStart != null && <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>L{f.lineStart}{f.lineEnd && f.lineEnd !== f.lineStart ? `–${f.lineEnd}` : ""}</span>}
                </div>
                <span style={{ fontSize: "13px", color: "var(--color-subtle-ash)", lineHeight: 1.5, paddingLeft: "2px" }}>{plainFinding(f.vulnClass, f.title)}</span>
              </div>
            ))}
            {result.note && <p style={{ fontSize: "12px", color: "var(--color-subtle-ash)", lineHeight: 1.5 }}>{result.note}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
