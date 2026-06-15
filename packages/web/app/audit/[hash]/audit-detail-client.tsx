"use client";

import { motion } from "motion/react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import SeverityBadge from "../../../src/components/severity-badge";
import VerdictScore from "../../../src/components/verdict-score";
import type { Audit } from "../../api/_lib";
import { ExternalLink, Lock, Shield } from "lucide-react";

/**
 * Built on the site's inline-token design system — inline styles on the CSS
 * variables, with a scoped <style> block for responsive rules — the same system
 * the landing and /try use. Tailwind layout utilities (px-*, p-*, gap-*) are
 * unreliable in this project's cascade, so spacing is set inline and is
 * deterministic.
 */

const MONO = "var(--font-mono)";
const ASH = "var(--color-subtle-ash)";
const WHITE = "var(--color-cloud-white)";
const GRAY = "var(--color-ash-gray)";
const HAIRLINE = "1px solid rgba(255,255,255,0.08)";
const CARD: React.CSSProperties = {
  background: "var(--color-slate-gray)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "4px",
  padding: "20px",
};
const EYEBROW: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: "10px",
  color: ASH,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};
const H2: React.CSSProperties = { fontSize: "20px", fontWeight: 600, color: WHITE, letterSpacing: "-0.01em" };

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function fmtMNT(mnt: number): string {
  if (mnt === 0) return "0 MNT";
  if (mnt >= 0.0001) return `${mnt.toFixed(6)} MNT`;
  return `${mnt.toFixed(8)} MNT`;
}

export default function AuditDetailClient({ audit }: { audit: Audit }) {
  const isMainnet = audit.network === "mantle-mainnet" || audit.network === "mantle";
  const explorerBase = isMainnet ? "https://mantlescan.xyz" : "https://sepolia.mantlescan.xyz";
  const explorerTx = audit.mantlescanUrl ?? `${explorerBase}/tx/${audit.txHash}`;

  const toGwei = (weiStr: string | null | undefined, legacy: number | null | undefined): number =>
    weiStr != null ? Number(weiStr) / 1e9 : (legacy ?? 0);

  const gr = audit.gasReport;
  const gasData = gr
    ? [
        { name: "L2 Execution", value: toGwei(gr.l2ExecutionMNT, gr.l2ExecutionFee), color: "var(--color-ultraviolet-blue)" },
        { name: "L1 Data Fee", value: toGwei(gr.l1DataMNT, gr.l1DataFee), color: "var(--color-neon-violet)" },
        { name: "Operator Fee", value: toGwei(gr.operatorMNT, gr.operatorFee), color: "var(--color-lavender-glow)" },
      ]
    : [];

  const gweiTotal = gasData.reduce((sum, g) => sum + g.value, 0);
  const deploymentMNT = gr?.deploymentCostMNT != null ? Number(gr.deploymentCostMNT) : gweiTotal / 1e9;
  const deploymentUSD = gr?.deploymentCostUSD ?? 0;

  const rawReport = audit.reportURI ?? "";
  const reportHref = rawReport.startsWith("ar://")
    ? rawReport.replace("ar://", "https://arweave.net/")
    : rawReport.startsWith("https://")
    ? rawReport
    : null;

  const clean =
    audit.criticalCount === 0 && audit.highCount === 0 && audit.mediumCount === 0 && audit.lowCount === 0;

  return (
    <div className="ad-shell" style={{ maxWidth: "1040px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "48px" }}>
      <style>{`
        .ad-shell { padding: 56px 48px 96px; }
        .ad-row { display: flex; flex-direction: row; align-items: center; gap: 32px; }
        .ad-gas { display: flex; flex-direction: row; gap: 32px; align-items: stretch; }
        @media (max-width: 768px) {
          .ad-shell { padding: 36px 20px 72px; }
          .ad-row { flex-direction: column; align-items: flex-start; gap: 20px; }
          .ad-gas { flex-direction: column; }
        }
      `}</style>

      {/* Verdict header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="ad-row"
      >
        <VerdictScore score={audit.verdictScore} />

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={EYEBROW}>Audit Report</span>
            <span style={{ ...EYEBROW, letterSpacing: 0 }}>·</span>
            <span style={{ ...EYEBROW, letterSpacing: 0, textTransform: "none" }}>{audit.network}</span>
          </div>

          <h1 style={{ color: WHITE, fontWeight: 700, lineHeight: 1.1, fontSize: "28px", letterSpacing: "-0.02em" }}>
            {audit.contractName ?? shortHash(audit.codeHash)}
          </h1>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {audit.criticalCount > 0 && <SeverityBadge severity="critical" />}
            {audit.highCount > 0 && <SeverityBadge severity="high" />}
            {audit.mediumCount > 0 && <SeverityBadge severity="medium" />}
            {audit.lowCount > 0 && <SeverityBadge severity="low" />}
            {clean && <SeverityBadge severity="safe" />}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px" }}>
            <span style={{ fontFamily: MONO, fontSize: "13px", color: ASH }}>{formatDate(audit.timestamp)}</span>
            <a
              href={explorerTx}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontFamily: MONO, fontSize: "13px", color: "var(--color-lavender-glow)" }}
            >
              {shortHash(audit.txHash)}
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </motion.div>

      {/* Findings */}
      {audit.findings && audit.findings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <h2 style={H2}>
            Findings
            <span style={{ marginLeft: "8px", fontFamily: MONO, fontSize: "14px", color: ASH, fontWeight: 400 }}>
              ({audit.findings.length})
            </span>
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {audit.findings.map((f, i) => {
              const consensus = audit.llmConsensus?.find((c) => c.findingId === f.id);
              const agreedCount = consensus?.models.filter((m) => m.agreed).length ?? 0;
              const totalModels = consensus?.models.length ?? 0;

              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.04 * i }}
                  style={{ ...CARD, display: "flex", flexDirection: "column", gap: "16px" }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <SeverityBadge severity={f.severity} />
                      <span style={{ fontFamily: MONO, fontSize: "10px", color: ASH }}>{f.id}</span>
                      {f.lineNumber && (
                        <span style={{ fontFamily: MONO, fontSize: "10px", color: ASH }}>Line {f.lineNumber}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: MONO, fontSize: "10px", color: ASH }}>Confidence</span>
                      <span
                        style={{
                          fontFamily: MONO,
                          fontSize: "13px",
                          fontWeight: 700,
                          color:
                            f.confidence >= 90
                              ? "var(--color-severity-safe)"
                              : f.confidence >= 70
                              ? "var(--color-severity-medium)"
                              : "var(--color-severity-high)",
                        }}
                      >
                        {f.confidence}%
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <h3 style={{ color: WHITE, fontWeight: 500, fontSize: "14px" }}>{f.title}</h3>
                    <p style={{ color: ASH, fontSize: "14px", lineHeight: 1.6 }}>{f.description}</p>
                  </div>

                  <div style={{ borderTop: HAIRLINE, paddingTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={EYEBROW}>Recommendation</span>
                    <p style={{ color: GRAY, fontSize: "14px", lineHeight: 1.5 }}>{f.recommendation}</p>
                  </div>

                  {consensus && (
                    <div style={{ borderTop: HAIRLINE, paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={EYEBROW}>LLM Consensus</span>
                        <span style={{ fontFamily: MONO, fontSize: "10px", color: ASH }}>
                          {agreedCount}/{totalModels} models
                        </span>
                        <span
                          style={{
                            fontFamily: MONO,
                            fontSize: "10px",
                            fontWeight: 700,
                            color: consensus.confidence >= 90 ? "var(--color-severity-safe)" : "var(--color-severity-medium)",
                          }}
                        >
                          {consensus.confidence}%
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        {consensus.models.map((m) => (
                          <div key={m.name} style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: MONO, fontSize: "10px" }}>
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                flexShrink: 0,
                                background: m.agreed ? "var(--color-severity-safe)" : ASH,
                              }}
                            />
                            <span style={{ color: m.agreed ? GRAY : ASH, textDecoration: m.agreed ? "none" : "line-through" }}>
                              {m.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Gas report */}
      {audit.gasReport && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.14 }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <h2 style={H2}>
            Gas Breakdown — {audit.contractName ?? "Contract"} on{" "}
            <span style={{ textTransform: "capitalize" }}>{audit.network}</span>
          </h2>

          <div className="ad-gas" style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", padding: "24px", background: "rgba(255,255,255,0.02)" }}>
            <div style={{ flex: 1, minHeight: 220, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={gasData} layout="vertical" barSize={14}>
                  <XAxis
                    type="number"
                    tick={{ fill: ASH, fontSize: 11, fontFamily: "monospace" }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: ASH, fontSize: 11, fontFamily: "monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={88}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-slate-gray)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      fontSize: 12,
                      fontFamily: "monospace",
                      color: WHITE,
                    }}
                    formatter={(v) => [`${Number(v).toLocaleString()} gwei`, "Gas"]}
                  />
                  <Bar dataKey="value" radius={[0, 2, 2, 0]}>
                    {gasData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: "200px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={EYEBROW}>Total Deployment Cost</span>
                <span style={{ fontFamily: MONO, color: WHITE, fontWeight: 700, fontSize: "28px" }}>{fmtMNT(deploymentMNT)}</span>
                <span style={{ fontFamily: MONO, fontSize: "10px", color: ASH }}>≈ ${deploymentUSD.toFixed(6)}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={EYEBROW}>Deployment Gas</span>
                <span style={{ fontFamily: MONO, color: WHITE, fontSize: "16px" }}>
                  {audit.gasReport.deploymentGas.toLocaleString()}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
                {gasData.map((g) => {
                  const pct = gweiTotal > 0 ? ((g.value / gweiTotal) * 100).toFixed(0) : "0";
                  return (
                    <div key={g.name} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: MONO, fontSize: "10px", color: ASH }}>{g.name}</span>
                        <span style={{ fontFamily: MONO, fontSize: "10px", color: GRAY }}>{pct}%</span>
                      </div>
                      <div style={{ height: "2px", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: "9999px", width: `${pct}%`, background: g.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {audit.gasReport.optimizationHint && (
                <div style={{ borderTop: HAIRLINE, paddingTop: "12px" }}>
                  <span style={{ ...EYEBROW, color: "var(--color-severity-safe)" }}>Optimization</span>
                  <p style={{ marginTop: "4px", color: GRAY, fontSize: "13px", lineHeight: 1.5 }}>
                    {audit.gasReport.optimizationHint}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* On-chain proof */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <h2 style={H2}>On-Chain Proof</h2>
        <div className="ad-row" style={{ ...CARD, alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid color-mix(in srgb, var(--color-severity-safe) 30%, transparent)",
                background: "color-mix(in srgb, var(--color-severity-safe) 10%, transparent)",
              }}
            >
              <Shield size={18} strokeWidth={1.5} color="var(--color-severity-safe)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: WHITE, fontWeight: 500, fontSize: "14px" }}>ERC-8004 Attestation</span>
              <span style={{ fontFamily: MONO, fontSize: "10px", color: ASH }}>Mantle · Identity Registry</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ ...EYEBROW, width: "88px", flexShrink: 0, paddingTop: "2px" }}>Tx Hash</span>
              <a
                href={explorerTx}
                target="_blank"
                rel="noreferrer"
                style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-lavender-glow)", display: "inline-flex", alignItems: "center", gap: "4px", wordBreak: "break-all" }}
              >
                {audit.txHash}
                <ExternalLink size={11} style={{ flexShrink: 0 }} />
              </a>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <span style={{ ...EYEBROW, width: "88px", flexShrink: 0, paddingTop: "2px" }}>Code Hash</span>
              <span style={{ fontFamily: MONO, fontSize: "13px", color: GRAY, wordBreak: "break-all" }}>{audit.codeHash}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Encrypted report */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        style={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <h2 style={H2}>Encrypted Report</h2>
        <div className="ad-row" style={{ ...CARD, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                border: "1px solid color-mix(in srgb, var(--color-status-orchid) 30%, transparent)",
                background: "color-mix(in srgb, var(--color-status-orchid) 10%, transparent)",
              }}
            >
              <Lock size={18} strokeWidth={1.5} color="var(--color-status-orchid)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ color: WHITE, fontWeight: 500, fontSize: "14px" }}>Full findings encrypted</span>
              <span style={{ color: ASH, fontSize: "13px" }}>AES-256-GCM · Lit Protocol access control · Arweave stored</span>
            </div>
          </div>
          {reportHref ? (
            <a
              href={reportHref}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", border: "1px solid rgba(255,255,255,0.15)", color: WHITE, padding: "8px 16px", borderRadius: "4px", fontSize: "13px", fontFamily: MONO, flexShrink: 0 }}
            >
              Arweave Report ↗
            </a>
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", border: "1px solid rgba(255,255,255,0.1)", color: ASH, padding: "8px 16px", borderRadius: "4px", fontSize: "13px", fontFamily: MONO, flexShrink: 0 }}>
              Report unavailable
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
