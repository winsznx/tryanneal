"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import SeverityBadge from "../../src/components/severity-badge";
import type { Audit, Agent } from "../api/_lib";

interface Staking {
  totalStaked: string;
  totalStakers: number;
  slashBasisPoints: number;
  apy: string;
}

function formatMNT(wei: string): string {
  const mnt = Number(BigInt(wei)) / 1e18;
  return mnt >= 1000 ? `${(mnt / 1000).toFixed(1)}K MNT` : `${mnt.toFixed(0)} MNT`;
}

function formatTVL(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-severity-safe)";
  if (score >= 60) return "var(--color-severity-medium)";
  return "var(--color-severity-critical)";
}

/* ── KPI metric strip ──────────────────────────────── */
function KpiMetric({
  label,
  value,
  delta,
  dot,
}: {
  label: string;
  value: string;
  delta?: string;
  dot?: string;
}) {
  const positive = delta?.startsWith("+");
  const negative = delta?.startsWith("-");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "var(--color-subtle-ash)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        {dot && (
          <span
            style={{
              width: "5px",
              height: "5px",
              borderRadius: "50%",
              background: dot,
              flexShrink: 0,
            }}
          />
        )}
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "22px",
          fontWeight: 400,
          color: "var(--color-cloud-white)",
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      {delta && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: positive
              ? "var(--color-severity-safe)"
              : negative
              ? "var(--color-severity-critical)"
              : "var(--color-subtle-ash)",
            lineHeight: 1,
          }}
        >
          {delta}
        </span>
      )}
    </div>
  );
}

/* ── Circular rep score ring ───────────────────────── */
function ScoreRing({ score, audits }: { score: number; audits: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const progress = (score / 100) * circ;
  const label = score >= 90 ? "Perfect" : score >= 75 ? "Strong" : score >= 60 ? "Good" : "At Risk";
  const color = scoreColor(score);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
      <div style={{ position: "relative", width: "100px", height: "100px", flexShrink: 0 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circ}`}
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "20px",
              fontWeight: 400,
              color: "var(--color-cloud-white)",
              lineHeight: 1,
            }}
          >
            {score}
          </span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span
          style={{
            fontSize: "17px",
            fontWeight: 400,
            color: "var(--color-cloud-white)",
            lineHeight: 1.2,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "13px",
            color: "var(--color-subtle-ash)",
            lineHeight: 1.4,
            maxWidth: "160px",
          }}
        >
          Reputation score based on {audits} on-chain attestations.
        </span>
      </div>
    </div>
  );
}

/* ── Severity mix across all audits ─────────────────── */
function SeverityMix({ audits }: { audits: Audit[] }) {
  const totals = audits.reduce(
    (acc, a) => {
      acc.critical += a.criticalCount;
      acc.high += a.highCount;
      acc.medium += a.mediumCount;
      acc.low += a.lowCount;
      acc.safe += a.criticalCount + a.highCount + a.mediumCount + a.lowCount === 0 ? 1 : 0;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0, safe: 0 }
  );
  const totalFindings = totals.critical + totals.high + totals.medium + totals.low;
  const slices = [
    { key: "critical", count: totals.critical, color: "var(--color-severity-critical)" },
    { key: "high", count: totals.high, color: "var(--color-severity-high)" },
    { key: "medium", count: totals.medium, color: "var(--color-severity-medium)" },
    { key: "low", count: totals.low, color: "var(--color-severity-low)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div
        style={{
          display: "flex",
          height: "10px",
          borderRadius: "2px",
          overflow: "hidden",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {totalFindings === 0 ? (
          <div style={{ width: "100%", background: "var(--color-severity-safe)", opacity: 0.6 }} />
        ) : (
          slices.map(({ key, count, color }) =>
            count > 0 ? (
              <div
                key={key}
                title={`${count} ${key}`}
                style={{
                  flex: count,
                  background: color,
                  opacity: 0.92,
                }}
              />
            ) : null
          )
        )}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "16px 20px" }}>
        {slices.map(({ key, count, color }) => (
          <span
            key={key}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-subtle-ash)",
              textTransform: "capitalize",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: color }} />
            {key} <span style={{ color: "var(--color-cloud-white)" }}>{count}</span>
          </span>
        ))}
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            color: "var(--color-subtle-ash)",
          }}
        >
          <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: "var(--color-severity-safe)" }} />
          Clean <span style={{ color: "var(--color-cloud-white)" }}>{totals.safe}</span>
        </span>
      </div>
    </div>
  );
}

/* ── Custom tooltip ────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "var(--color-slate-gray)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "4px",
        padding: "8px 12px",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: "var(--color-cloud-white)",
      }}
    >
      <div style={{ color: "var(--color-subtle-ash)", marginBottom: "4px" }}>{label}</div>
      <div style={{ color: "var(--color-ultraviolet-blue)" }}>{payload[0].value}/100</div>
    </div>
  );
}

/* ── Main dashboard ────────────────────────────────── */
export default function DashboardClient({
  agent,
  audits,
  staking,
}: {
  agent: Agent;
  audits: Audit[];
  staking: Staking;
}) {
  const router = useRouter();
  const sorted = audits
    .slice()
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const repScore = Math.round(
    sorted.reduce((sum, a) => sum + a.verdictScore, 0) / sorted.length
  );

  const avgVerdictStr = `${repScore}/100`;
  const totalAudits = agent.reputation.totalAudits;

  const chartData = sorted.map((a) => ({
    date: formatDateShort(a.timestamp),
    score: a.verdictScore,
    baseline: 70,
  }));

  return (
    <>
      <style>{`
        .dash-wrap { padding-left: 48px; padding-right: 48px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(6, 1fr); }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; }
        @media (max-width: 900px) {
          .kpi-grid { grid-template-columns: repeat(3, 1fr); }
          .summary-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 600px) {
          .dash-wrap { padding-left: 24px; padding-right: 24px; }
          .kpi-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>

      <div
        className="dash-wrap"
        style={{ maxWidth: "1440px", margin: "0 auto", paddingTop: "40px", paddingBottom: "64px", display: "flex", flexDirection: "column", gap: "40px" }}
      >

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "10px",
                color: "var(--color-subtle-ash)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Agent Identity · ERC-8004 · Mantle
            </span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
              <h1
                style={{
                  fontSize: "clamp(24px, 3vw, 36px)",
                  fontWeight: 400,
                  color: "var(--color-cloud-white)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                Agent{" "}
                <span style={{ color: "var(--color-ultraviolet-blue)", fontFamily: "var(--font-mono)" }}>
                  #{agent.agentId}
                </span>
              </h1>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-subtle-ash)" }}>
                {shortAddr(agent.wallet)}
              </span>
            </div>
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-subtle-ash)",
              paddingBottom: "4px",
            }}
          >
            Registered {new Date(agent.registeredAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </motion.div>

        {/* ── KPI strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="kpi-grid"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "24px",
            paddingBottom: "24px",
            gap: "24px",
          }}
        >
          <KpiMetric label="Contracts Audited" value={String(totalAudits)} delta="+12%" dot="var(--color-ultraviolet-blue)" />
          <KpiMetric label="TVL Protected" value={formatTVL(agent.tvlProtected ?? 0)} delta="+8%" dot="var(--color-status-mint)" />
          <KpiMetric label="Rep Score" value={avgVerdictStr} dot={repScore >= 80 ? "var(--color-status-mint)" : "var(--color-severity-medium)"} />
          <KpiMetric label="Accuracy" value={`${agent.reputation.accuracy}%`} delta="+2%" dot="var(--color-lavender-glow)" />
          <KpiMetric label="Stakers" value={String(staking.totalStakers)} delta="+5" dot="rgba(255,255,255,0.3)" />
          <KpiMetric label="Staked" value={formatMNT(staking.totalStaked)} dot="rgba(255,255,255,0.3)" />
        </motion.div>

        {/* ── Main chart ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 400,
                color: "var(--color-cloud-white)",
                letterSpacing: "-0.01em",
              }}
            >
              Verdict Score · All Time
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {audits.length} audits
            </span>
          </div>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "24px 16px 8px",
              background: "rgba(255,255,255,0.02)",
              height: "320px",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-ultraviolet-blue)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-ultraviolet-blue)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgba(255,255,255,0.06)" stopOpacity={1} />
                    <stop offset="95%" stopColor="rgba(255,255,255,0)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--color-subtle-ash)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  domain={[50, 100]}
                  tick={{ fill: "var(--color-subtle-ash)", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip content={<ChartTooltip />} />
                {/* Baseline: industry average */}
                <Area
                  type="monotone"
                  dataKey="baseline"
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                  fill="url(#baseGrad)"
                  dot={false}
                  activeDot={false}
                />
                {/* Our score */}
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--color-ultraviolet-blue)"
                  strokeWidth={2}
                  fill="url(#scoreGrad)"
                  dot={(props) => {
                    const { cx, cy, payload } = props as { cx: number; cy: number; payload: { score: number } };
                    if (payload.score >= 90) {
                      return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={5} fill="var(--color-status-mint)" stroke="none" />;
                    }
                    return <circle key={`dot-${cx}`} cx={cx} cy={cy} r={3} fill="var(--color-ultraviolet-blue)" stroke="none" />;
                  }}
                  activeDot={{ fill: "var(--color-lavender-glow)", r: 5, strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* ── Summary cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="summary-grid"
          style={{ gap: "16px" }}
        >
          {/* Left: severity mix */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "24px",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--color-cloud-white)" }}>
                Findings by severity
                <span style={{ color: "var(--color-subtle-ash)", fontWeight: 400 }}> · all time</span>
              </span>
              <Link
                href="#audit-history"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--color-lavender-glow)",
                  textDecoration: "none",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                History →
              </Link>
            </div>
            <SeverityMix audits={audits} />
          </div>

          {/* Right: rep score ring */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "24px",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--color-cloud-white)" }}>
                Reputation Score
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Performance
              </span>
            </div>
            <ScoreRing score={repScore} audits={audits.length} />
            <div
              style={{
                height: "4px",
                background: "rgba(255,255,255,0.06)",
                borderRadius: "2px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${repScore}%`,
                  background: scoreColor(repScore),
                  borderRadius: "2px",
                  transition: "width 1s ease",
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Audit History ── */}
        <motion.div
          id="audit-history"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--color-cloud-white)" }}>
              Audit History
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {audits.length} total
            </span>
          </div>
          <div
            style={{
              overflowX: "auto",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Date", "Contract", "Network", "Verdict", "Severity", "Tx"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        color: "var(--color-subtle-ash)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        fontWeight: 400,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits
                  .slice()
                  .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
                  .map((audit, i) => {
                    const explorerBase =
                      audit.network === "mantle"
                        ? "https://explorer.mantle.xyz"
                        : "https://explorer.sepolia.mantle.xyz";
                    return (
                      <tr
                        key={audit.codeHash}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: i % 2 !== 0 ? "rgba(255,255,255,0.015)" : "transparent",
                          cursor: "pointer",
                          transition: "background 120ms ease",
                        }}
                        onClick={() => router.push(`/audit/${audit.codeHash}`)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 !== 0 ? "rgba(255,255,255,0.015)" : "transparent")}
                      >
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-subtle-ash)" }}>
                          {formatDate(audit.timestamp)}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <Link
                            href={`/audit/${audit.codeHash}`}
                            style={{ color: "var(--color-cloud-white)", textDecoration: "none", fontSize: "13px" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {audit.contractName ?? shortHash(audit.codeHash)}
                          </Link>
                        </td>
                        <td style={{ padding: "12px 16px", fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-subtle-ash)", textTransform: "capitalize" }}>
                          {audit.network}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "14px", fontWeight: 400, color: scoreColor(audit.verdictScore) }}>
                            {audit.verdictScore}/100
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {audit.criticalCount > 0 && <SeverityBadge severity="critical" />}
                            {audit.highCount > 0 && <SeverityBadge severity="high" />}
                            {audit.mediumCount > 0 && <SeverityBadge severity="medium" />}
                            {audit.lowCount > 0 && <SeverityBadge severity="low" />}
                            {audit.criticalCount === 0 && audit.highCount === 0 && audit.mediumCount === 0 && audit.lowCount === 0 && (
                              <SeverityBadge severity="safe" />
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <a
                            href={`${explorerBase}/tx/${audit.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-lavender-glow)", textDecoration: "none" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortHash(audit.txHash)}
                          </a>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Staking ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          style={{ display: "flex", flexDirection: "column", gap: "16px" }}
        >
          <span style={{ fontSize: "14px", fontWeight: 400, color: "var(--color-cloud-white)" }}>
            Staking Pool
          </span>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "8px",
              padding: "24px",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "24px",
            }}
          >
            <div style={{ display: "flex", gap: "40px", flexWrap: "wrap" }}>
              {[
                { label: "Total Staked", value: formatMNT(staking.totalStaked) },
                { label: "Agent Stake", value: formatMNT(agent.reputation.stakedAmount) },
                { label: "APY", value: `${staking.apy}%`, green: true },
                { label: "Slashing", value: `${staking.slashBasisPoints / 100}%` },
                { label: "Stakers", value: String(staking.totalStakers) },
              ].map(({ label, value, green }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    {label}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "20px", fontWeight: 400, color: green ? "var(--color-status-mint)" : "var(--color-cloud-white)", letterSpacing: "-0.02em" }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                disabled
                style={{
                  background: "var(--color-ultraviolet-blue)",
                  color: "white",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "not-allowed",
                  opacity: 0.5,
                }}
              >
                Stake MNT
              </button>
              <button
                type="button"
                disabled
                style={{
                  background: "transparent",
                  color: "var(--color-cloud-white)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "not-allowed",
                  opacity: 0.5,
                }}
              >
                Unstake
              </button>
            </div>
          </div>
        </motion.div>

      </div>
    </>
  );
}
