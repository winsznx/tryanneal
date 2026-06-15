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
  // Mantlescan, per the audit's own network. Mainnet audits stay on mainnet,
  // Sepolia audits stay on Sepolia — and we prefer the exact tx URL recorded
  // at audit time when present.
  const isMainnet = audit.network === "mantle-mainnet" || audit.network === "mantle";
  const explorerBase = isMainnet ? "https://mantlescan.xyz" : "https://sepolia.mantlescan.xyz";
  const explorerTx = audit.mantlescanUrl ?? `${explorerBase}/tx/${audit.txHash}`;

  // Gas components are MNT wei-strings from the engine; show them in gwei (the
  // natural gas unit), preferring the MNT field and falling back to any legacy
  // numeric fee. Operator at exactly 0 must stay 0, not fall through.
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

  // Only ever link to ar:// (rewritten) or https:// reportURIs — reportURI is
  // attacker-controllable on-chain data, so block javascript:/data: schemes.
  const rawReport = audit.reportURI ?? "";
  const reportHref = rawReport.startsWith("ar://")
    ? rawReport.replace("ar://", "https://arweave.net/")
    : rawReport.startsWith("https://")
    ? rawReport
    : null;

  return (
    <div className="px-12 py-12 flex flex-col gap-12" style={{ maxWidth: "1440px", marginLeft: "auto", marginRight: "auto" }}>
      {/* Verdict header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row items-start md:items-center gap-8"
      >
        <VerdictScore score={audit.verdictScore} />

        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-micro text-subtle-ash uppercase tracking-widest">
              Audit Report
            </span>
            <span className="font-mono text-micro text-subtle-ash">·</span>
            <span className="font-mono text-micro text-subtle-ash">{audit.network}</span>
          </div>

          <h1 className="text-cloud-white font-bold leading-tight text-card-value">
            {audit.contractName ?? shortHash(audit.codeHash)}
          </h1>

          <div className="flex flex-wrap gap-2">
            {audit.criticalCount > 0 && <SeverityBadge severity="critical" />}
            {audit.highCount > 0 && <SeverityBadge severity="high" />}
            {audit.mediumCount > 0 && <SeverityBadge severity="medium" />}
            {audit.lowCount > 0 && <SeverityBadge severity="low" />}
            {audit.criticalCount === 0 && audit.highCount === 0 &&
              audit.mediumCount === 0 && audit.lowCount === 0 && (
              <SeverityBadge severity="safe" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="font-mono text-caption text-subtle-ash">{formatDate(audit.timestamp)}</span>
            <a
              href={explorerTx}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-mono text-caption text-lavender-glow hover:text-cloud-white transition-colors"
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
          className="flex flex-col gap-4"
        >
          <h2 className="text-cloud-white font-bold text-body">
            Findings
            <span className="ml-2 font-mono text-small text-subtle-ash font-normal">
              ({audit.findings.length})
            </span>
          </h2>
          <div className="flex flex-col gap-3">
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
                  className="bg-slate-gray border border-white/5 rounded-sm p-5 flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 flex-wrap">
                      <SeverityBadge severity={f.severity} />
                      <span className="font-mono text-micro text-subtle-ash">{f.id}</span>
                      {f.lineNumber && (
                        <span className="font-mono text-micro text-subtle-ash">Line {f.lineNumber}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-micro text-subtle-ash">Confidence</span>
                      <span
                        className="font-mono text-caption font-bold"
                        style={{
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

                  <div className="flex flex-col gap-2">
                    <h3 className="text-cloud-white font-medium text-small">{f.title}</h3>
                    <p className="text-subtle-ash text-small leading-[1.6]">{f.description}</p>
                  </div>

                  <div className="border-t border-white/8 pt-3 flex flex-col gap-1">
                    <span className="font-mono text-micro text-subtle-ash uppercase tracking-widest">
                      Recommendation
                    </span>
                    <p className="text-ash-gray text-small leading-[1.5]">{f.recommendation}</p>
                  </div>

                  {consensus && (
                    <div className="border-t border-white/8 pt-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-micro text-subtle-ash uppercase tracking-widest">
                          LLM Consensus
                        </span>
                        <span className="font-mono text-micro text-subtle-ash">
                          {agreedCount}/{totalModels} models
                        </span>
                        <span
                          className="font-mono text-micro font-bold"
                          style={{
                            color:
                              consensus.confidence >= 90
                                ? "var(--color-severity-safe)"
                                : "var(--color-severity-medium)",
                          }}
                        >
                          {consensus.confidence}%
                        </span>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        {consensus.models.map((m) => (
                          <div
                            key={m.name}
                            className="flex items-center gap-1.5 font-mono text-micro"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                background: m.agreed
                                  ? "var(--color-severity-safe)"
                                  : "var(--color-subtle-ash)",
                              }}
                            />
                            <span
                              className={m.agreed ? "text-ash-gray" : "text-subtle-ash line-through"}
                            >
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
          className="flex flex-col gap-4"
        >
          <h2 className="text-cloud-white font-bold text-body">
            Gas Breakdown — {audit.contractName ?? "Contract"} on{" "}
            <span className="capitalize">{audit.network}</span>
          </h2>

          <div
            className="border border-white/8 rounded-sm p-6 flex flex-col md:flex-row gap-8"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex-1" style={{ minHeight: 220 }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={gasData} layout="vertical" barSize={14}>
                  <XAxis
                    type="number"
                    tick={{ fill: "var(--color-subtle-ash)", fontSize: 11, fontFamily: "monospace" }}
                    tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: "var(--color-subtle-ash)", fontSize: 11, fontFamily: "monospace" }}
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
                      color: "var(--color-cloud-white)",
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

            <div className="flex flex-col gap-4 min-w-[200px]">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-micro text-subtle-ash uppercase tracking-widest">
                  Total Deployment Cost
                </span>
                <span className="font-mono text-cloud-white font-bold text-card-value">
                  {fmtMNT(deploymentMNT)}
                </span>
                <span className="font-mono text-micro text-subtle-ash">≈ ${deploymentUSD.toFixed(6)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-mono text-micro text-subtle-ash uppercase tracking-widest">
                  Deployment Gas
                </span>
                <span className="font-mono text-cloud-white text-body">
                  {audit.gasReport.deploymentGas.toLocaleString()}
                </span>
              </div>

              <div className="flex flex-col gap-3 mt-1">
                {gasData.map((g) => {
                  const pct = gweiTotal > 0 ? ((g.value / gweiTotal) * 100).toFixed(0) : "0";
                  return (
                    <div key={g.name} className="flex flex-col gap-1">
                      <div className="flex justify-between">
                        <span className="font-mono text-micro text-subtle-ash">{g.name}</span>
                        <span className="font-mono text-micro text-ash-gray">{pct}%</span>
                      </div>
                      <div className="h-0.5 bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: g.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {audit.gasReport.optimizationHint && (
                <div className="border-t border-white/8 pt-3">
                  <span className="font-mono text-micro text-severity-safe uppercase tracking-widest">
                    Optimization
                  </span>
                  <p className="mt-1 text-ash-gray text-caption leading-[1.5]">
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
        className="flex flex-col gap-4"
      >
        <h2 className="text-cloud-white font-bold text-body">On-Chain Proof</h2>
        <div className="bg-slate-gray border border-white/5 rounded-sm p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="flex items-center gap-3 shrink-0">
            <div
              className="w-10 h-10 rounded-sm flex items-center justify-center border"
              style={{
                background: "color-mix(in srgb, var(--color-severity-safe) 10%, transparent)",
                borderColor: "color-mix(in srgb, var(--color-severity-safe) 30%, transparent)",
              }}
            >
              <Shield size={18} strokeWidth={1.5} className="text-severity-safe" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-cloud-white font-medium text-small">ERC-8004 Attestation</span>
              <span className="font-mono text-micro text-subtle-ash">Mantle · Identity Registry</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="flex items-start gap-3">
              <span className="font-mono text-micro text-subtle-ash uppercase tracking-widest w-24 shrink-0 pt-0.5">
                Tx Hash
              </span>
              <a
                href={explorerTx}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-caption text-lavender-glow hover:text-cloud-white transition-colors inline-flex items-center gap-1 break-all"
              >
                {audit.txHash}
                <ExternalLink size={11} className="shrink-0" />
              </a>
            </div>
            <div className="flex items-start gap-3">
              <span className="font-mono text-micro text-subtle-ash uppercase tracking-widest w-24 shrink-0 pt-0.5">
                Code Hash
              </span>
              <span className="font-mono text-caption text-ash-gray break-all">{audit.codeHash}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Encrypted report */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.24 }}
        className="flex flex-col gap-4"
      >
        <h2 className="text-cloud-white font-bold text-body">Encrypted Report</h2>
        <div className="bg-slate-gray border border-white/5 rounded-sm p-5 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-sm flex items-center justify-center border shrink-0"
              style={{
                background: "color-mix(in srgb, var(--color-status-orchid) 10%, transparent)",
                borderColor: "color-mix(in srgb, var(--color-status-orchid) 30%, transparent)",
              }}
            >
              <Lock size={18} strokeWidth={1.5} className="text-status-orchid" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-cloud-white font-medium text-small">Full findings encrypted</span>
              <span className="text-subtle-ash text-caption">
                AES-256-GCM · Lit Protocol access control · Arweave stored
              </span>
            </div>
          </div>
          {reportHref ? (
            <a
              href={reportHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-white/15 hover:border-lavender-glow text-cloud-white px-4 py-2 rounded-sm text-caption font-mono transition-colors shrink-0"
            >
              Arweave Report ↗
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 border border-white/10 text-subtle-ash px-4 py-2 rounded-sm text-caption font-mono shrink-0">
              Report unavailable
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
