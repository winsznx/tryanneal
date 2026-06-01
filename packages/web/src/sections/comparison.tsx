"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import SectionContainer from "../components/section-container";

type Val = true | "partial" | false;

const rows: { icon: React.ReactNode; feature: string; anneal: Val; auditbase: Val; claudecode: Val; tob: Val }[] = [
  { icon: <IconSearch />,   feature: "Catch reentrancy and parser-level bugs",           anneal: true,      auditbase: true,       claudecode: false,      tob: true      },
  { icon: <IconEnsemble />, feature: "Catch logic bugs only a model can see",            anneal: true,      auditbase: false,      claudecode: "partial",  tob: true      },
  { icon: <IconAttest />,   feature: "Get a permanent, verifiable record on-chain",      anneal: true,      auditbase: false,      claudecode: false,      tob: false     },
  { icon: <IconNFT />,      feature: "Build agent reputation other contracts can read",  anneal: true,      auditbase: false,      claudecode: false,      tob: false     },
  { icon: <IconGas />,      feature: "See per-function gas costs in dollars",            anneal: true,      auditbase: false,      claudecode: false,      tob: false     },
  { icon: <IconLock />,     feature: "Keep your findings private to you",                anneal: true,      auditbase: "partial",  claudecode: false,      tob: true      },
  { icon: <IconClock />,    feature: "Ship in minutes, not weeks",                       anneal: true,      auditbase: true,       claudecode: "partial",  tob: false     },
  { icon: <IconOpen />,     feature: "Run it without procurement or sign-up",            anneal: true,      auditbase: false,      claudecode: true,       tob: false     },
];

const HIGHLIGHT = "var(--color-neon-violet)";
const CHECK_BRIGHT = "var(--color-lavender-glow)";
const CHECK_DIM = "rgba(255,255,255,0.32)";
const PARTIAL_BRIGHT = "#f5b840";
const PARTIAL_DIM = "rgba(232,160,32,0.4)";
const CROSS_COLOR = "rgba(255,255,255,0.12)";

function Indicator({ val, bright = false }: { val: Val; bright?: boolean }) {
  if (val === true) {
    const color = bright ? CHECK_BRIGHT : CHECK_DIM;
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ display: "block", margin: "0 auto" }}>
        <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth={bright ? 1.4 : 1.1} />
        <path d="M6.5 10 L9 12.5 L13.5 7.5" stroke={color} strokeWidth={bright ? 1.8 : 1.4} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (val === "partial") {
    const color = bright ? PARTIAL_BRIGHT : PARTIAL_DIM;
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ display: "block", margin: "0 auto" }}>
        <circle cx="10" cy="10" r="8.5" stroke={color} strokeWidth="1.2" />
        <line x1="6.5" y1="10" x2="13.5" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: "block", margin: "0 auto" }}>
      <line x1="3" y1="3" x2="11" y2="11" stroke={CROSS_COLOR} strokeWidth="1.3" strokeLinecap="round" />
      <line x1="11" y1="3" x2="3" y2="11" stroke={CROSS_COLOR} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export default function ComparisonSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section
      ref={ref}
      style={{
        background: "var(--color-deep-space)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingTop: "96px",
        paddingBottom: "96px",
      }}
    >
      <style>{`
        .cmp-wrap { padding-left: 48px; padding-right: 48px; }

        /* Column card border — wraps TryAnneal column */
        .hl-top    { border-left: 1px solid ${HIGHLIGHT}; border-right: 1px solid ${HIGHLIGHT}; border-top: 1px solid ${HIGHLIGHT}; border-radius: 8px 8px 0 0; }
        .hl-mid    { border-left: 1px solid ${HIGHLIGHT}; border-right: 1px solid ${HIGHLIGHT}; }
        .hl-bot    { border-left: 1px solid ${HIGHLIGHT}; border-right: 1px solid ${HIGHLIGHT}; border-bottom: 1px solid ${HIGHLIGHT}; border-radius: 0 0 8px 8px; }

        @media (max-width: 768px) {
          .cmp-wrap { padding-left: 16px; padding-right: 16px; }
          /* Fit all columns without horizontal scroll */
          .cmp-wrap table { min-width: 0 !important; }
          .cmp-wrap th, .cmp-wrap td { padding-left: 3px !important; padding-right: 3px !important; }
          .cmp-wrap thead th:first-child { padding-left: 0 !important; }
          .cmp-feature { font-size: 11px !important; line-height: 1.3 !important; }
          .cmp-colhead { font-size: 10px !important; }
          .cmp-anneal-head { font-size: 10px !important; }
        }
      `}</style>

      <div className="cmp-wrap" style={{ maxWidth: "1440px", margin: "0 auto" }}>

        {/* Heading — centered */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", marginBottom: "64px", textAlign: "center" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-subtle-ash)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "100px",
              padding: "4px 12px",
            }}
          >
            Comparison
          </span>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 400,
              color: "var(--color-cloud-white)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            What no one else ships.
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-subtle-ash)",
              lineHeight: 1.65,
              maxWidth: "520px",
            }}
          >
            Slither catches what a parser can catch. Frontier models catch what a parser misses.
            We run both, reach 2-of-3 consensus, and put the verdict on-chain. No one else ships all three.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ overflowX: "auto" }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "560px" }}>
            <thead>
              <tr>
                {/* Feature col */}
                <th style={{ width: "42%", padding: "0 0 20px 0", textAlign: "left" }} />

                {/* TryAnneal — highlighted header */}
                <th className="hl-top" style={{ textAlign: "center", padding: "16px 24px 20px", width: "14.5%" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                    <AnnealLogo />
                    <span className="cmp-anneal-head" style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-cloud-white)", letterSpacing: "0.04em", fontWeight: 600 }}>
                      TryAnneal
                    </span>
                  </div>
                </th>

                {/* Others */}
                {[
                  { key: "auditbase", label: "AuditBase" },
                  { key: "claudecode", label: "Claude Code" },
                  { key: "tob", label: "Trail of Bits" },
                ].map(({ key, label }) => (
                  <th key={key} style={{ textAlign: "center", padding: "0 16px 20px", width: "14.5%" }}>
                    <span className="cmp-colhead" style={{ fontFamily: "var(--font-sans)", fontSize: "12px", color: "var(--color-subtle-ash)", fontWeight: 400 }}>
                      {label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ icon, feature, anneal, auditbase, claudecode, tob }, i) => {
                const isLast = i === rows.length - 1;
                const hlClass = isLast ? "hl-bot" : "hl-mid";
                return (
                  <tr
                    key={feature}
                    style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {/* Feature label */}
                    <td style={{ padding: "16px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ flexShrink: 0, opacity: 0.5 }}>{icon}</span>
                        <span className="cmp-feature" style={{ fontSize: "13px", color: "var(--color-ash-gray)", lineHeight: 1.4 }}>
                          {feature}
                        </span>
                      </div>
                    </td>

                    {/* TryAnneal — highlighted */}
                    <td
                      className={hlClass}
                      style={{
                        textAlign: "center",
                        padding: "16px",
                        background: "rgba(65,65,252,0.06)",
                      }}
                    >
                      <Indicator val={anneal} bright />
                    </td>

                    {/* Others */}
                    {[auditbase, claudecode, tob].map((val, j) => (
                      <td key={j} style={{ textAlign: "center", padding: "16px" }}>
                        <Indicator val={val} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}

/* ── Feature row icons ─────────────────────────── */
function IconEnsemble() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      {[[8,2],[14,8],[8,14],[2,8]].map(([x,y],i) => (
        <line key={i} x1="8" y1="8" x2={x} y2={y} stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      ))}
      {[[8,2],[14,8],[8,14],[2,8]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1.5" fill="currentColor" />
      ))}
      <circle cx="8" cy="8" r="2" fill="currentColor" />
    </svg>
  );
}
function IconAttest() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 2 L13 5 L13 9 C13 12 8 14 8 14 C8 14 3 12 3 9 L3 5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
      <path d="M5.5 8 L7.5 10 L10.5 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconGas() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 14 C5 14 3 11.5 3 9 C3 7 4.5 5.5 5.5 4.5 C5.5 6 6.5 6.5 7 6 C7 4 8.5 2.5 10 2 C9 4 10 5 10.5 6 C11.5 5 11.5 4 11 3 C12.5 4.5 13 6.5 13 8.5 C13 11.5 11 14 8 14Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function IconLock() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="8" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M5 8 L5 5.5 C5 3.5 11 3.5 11 5.5 L11 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <path d="M8 5 L8 8 L10.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconNFT() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polygon points="8,2 10,6 14,6.5 11,9.5 11.8,13.5 8,11.5 4.2,13.5 5,9.5 2,6.5 6,6" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.2" fill="none" />
      <line x1="10" y1="10" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function IconOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3 L3 3 C2.4 3 2 3.4 2 4 L2 12 C2 12.6 2.4 13 3 13 L13 13 C13.6 13 14 12.6 14 12 L14 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 2 L14 2 L14 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="14" y1="2" x2="8" y2="8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
function AnnealLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="13" stroke="var(--color-neon-violet)" strokeWidth="1.5" />
      {[0,60,120,180,240,300].map((deg,i) => {
        const rad = (deg * Math.PI) / 180;
        const r = (n: number) => Math.round(n * 100) / 100;
        return (
          <line key={i}
            x1={r(14 - 6 * Math.cos(rad))} y1={r(14 - 6 * Math.sin(rad))}
            x2={r(14 + 6 * Math.cos(rad))} y2={r(14 + 6 * Math.sin(rad))}
            stroke="var(--color-lavender-glow)" strokeWidth="1.2" strokeLinecap="round"
          />
        );
      })}
      <circle cx="14" cy="14" r="2" fill="var(--color-ultraviolet-blue)" />
    </svg>
  );
}
