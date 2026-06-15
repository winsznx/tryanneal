"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";

const features = [
  {
    tag: "Accuracy",
    title: "Four models, one verdict",
    description:
      "Gemini, Groq, and Tencent Cloud Hunyuan argue every finding. Slither and Aderyn hold the line on the static-analysis truth. Nothing ships without multi-model agreement — so single-model hallucinations don't reach you.",
    icon: <EnsembleIcon />,
  },
  {
    tag: "Performance",
    title: "Live Mantle gas, in USD",
    description:
      "Read straight from the L1Block predeploy and GasPriceOracle. We split L2 execution, L1 blob data, and operator fee per function — priced in dollars, refreshed on every audit.",
    icon: <GasIcon />,
  },
  {
    tag: "Trust",
    title: "Verdicts live on-chain",
    description:
      "Every audit is signed onto Mantle through ERC-8004 Identity and Reputation. Any protocol, indexer, or wallet can verify an agent's history without asking us — or anyone else.",
    icon: <AttestIcon />,
  },
  {
    tag: "Privacy",
    title: "Findings only you can open",
    description:
      "Full findings are encrypted AES-256-GCM, sealed to Arweave, and gated by Lit access conditions. The public sees a verdict hash. Your team sees the report. No third party in between.",
    icon: <PrivacyIcon />,
  },
];

export default function FeaturesSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section id="features" ref={ref} className="features-root" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", scrollMarginTop: "72px" }}>
      <style>{`
        .features-root { display: grid; grid-template-columns: 45fr 55fr; min-height: 560px; }
        .features-left-panel { position: relative; overflow: hidden; min-height: 480px; }
        .features-right-panel { padding: 72px 56px; display: flex; flex-direction: column; gap: 48px; }
        @media (max-width: 768px) {
          .features-root { grid-template-columns: 1fr; min-height: auto; }
          .features-left-panel { min-height: 260px; }
          .features-right-panel { padding: 48px 24px; }
        }
      `}</style>

      {/* Left — visual panel with heading */}
      <motion.div
        className="features-left-panel"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.7 }}
      >
        {/* Base image */}
        <img
          src="/camera-agent.jpg"
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
        />
        {/* Blue multiply overlay — matches screenshot aesthetic */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "#0000cc",
            mixBlendMode: "multiply",
            opacity: 0.82,
          }}
        />
        {/* Dark gradient bottom */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,10,0.3) 0%, rgba(0,0,10,0.6) 100%)",
          }}
        />
        {/* Heading overlaid top-left */}
        <div
          style={{
            position: "absolute",
            top: "48px",
            left: "48px",
            right: "48px",
            zIndex: 2,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "rgba(255,255,255,0.5)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              display: "block",
              marginBottom: "12px",
            }}
          >
            Features
          </span>
          <h2
            style={{
              fontSize: "clamp(20px, 2.2vw, 28px)",
              fontWeight: 400,
              color: "#ffffff",
              letterSpacing: "-0.02em",
              lineHeight: 1.25,
              maxWidth: "440px",
            }}
          >
            Your protocol will get audited by an autonomous agent in three years.
            <br />
            <span style={{ color: "rgba(255,255,255,0.7)" }}>Today, our agents audit yours.</span>
          </h2>
        </div>
      </motion.div>

      {/* Right — feature list */}
      <div className="features-right-panel" style={{ background: "var(--color-deep-space)" }}>
        {features.map(({ tag, title, description, icon }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, x: 16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.4, delay: i * 0.08, ease: "easeOut" }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "20px",
            }}
          >
            {/* Icon */}
            <div
              style={{
                flexShrink: 0,
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "2px",
              }}
            >
              {icon}
            </div>

            {/* Text */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "10px",
                  color: "var(--color-subtle-ash)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                {tag}
              </span>
              <h3
                style={{
                  fontSize: "16px",
                  fontWeight: 400,
                  color: "var(--color-cloud-white)",
                  lineHeight: 1.25,
                  letterSpacing: "-0.01em",
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--color-subtle-ash)",
                  lineHeight: 1.65,
                  maxWidth: "420px",
                }}
              >
                {description}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ── Line-art icons ────────────────────────────── */

function EnsembleIcon() {
  // Network nodes — asterisk with connecting nodes
  const cx = 16, cy = 16;
  const nodes = [
    { x: cx, y: cy },
    { x: cx, y: cy - 12 },
    { x: cx + 10, y: cy - 6 },
    { x: cx + 10, y: cy + 6 },
    { x: cx, y: cy + 12 },
    { x: cx - 10, y: cy + 6 },
    { x: cx - 10, y: cy - 6 },
  ];
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {nodes.slice(1).map((n, i) => (
        <line key={i} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r={i === 0 ? 2 : 1.5} fill="white" opacity={i === 0 ? 1 : 0.7} />
      ))}
    </svg>
  );
}

function GasIcon() {
  // Flame — thin line art
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path
        d="M16 28 C10 28 6 23 6 18 C6 14 9 11 11 9 C11 12 13 13 14 12 C14 8 17 5 20 4 C18 8 20 10 21 12 C23 10 23 8 22 6 C25 9 26 13 26 17 C26 23 22 28 16 28Z"
        stroke="white"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
        opacity="0.85"
      />
      <path
        d="M16 24 C13 24 11 21 11 19 C11 17 13 15 14 14 C14 16 15.5 17 16 16.5 C17 14 18 13 18 14 C19 15 20 17 20 19 C20 21 18 24 16 24Z"
        stroke="white"
        strokeWidth="1"
        strokeLinejoin="round"
        fill="none"
        opacity="0.5"
      />
    </svg>
  );
}

function AttestIcon() {
  // Chain link with asterisk
  const r = (n: number) => Math.round(n * 100) / 100;
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="4" y="12" width="10" height="8" rx="4" stroke="white" strokeWidth="1.2" opacity="0.85" />
      <rect x="18" y="12" width="10" height="8" rx="4" stroke="white" strokeWidth="1.2" opacity="0.85" />
      <line x1="14" y1="16" x2="18" y2="16" stroke="white" strokeWidth="1.2" opacity="0.85" />
      {[0, 60, 120].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const arm = 3;
        return (
          <line
            key={deg}
            x1={r(16 - arm * Math.cos(rad))} y1={r(16 - arm * Math.sin(rad))}
            x2={r(16 + arm * Math.cos(rad))} y2={r(16 + arm * Math.sin(rad))}
            stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6"
          />
        );
      })}
    </svg>
  );
}

function PrivacyIcon() {
  // Stacked layers with lock
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="5" y="19" width="22" height="7" rx="1.5" stroke="white" strokeWidth="1.2" opacity="0.4" />
      <rect x="5" y="13" width="22" height="7" rx="1.5" stroke="white" strokeWidth="1.2" opacity="0.65" />
      <rect x="5" y="7" width="22" height="7" rx="1.5" stroke="white" strokeWidth="1.2" opacity="0.9" />
      {[0, 60, 120].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const arm = 2.5;
        const cx = 16, cy = 10.5;
        return (
          <line
            key={deg}
            x1={Math.round((cx - arm * Math.cos(rad)) * 100) / 100}
            y1={Math.round((cy - arm * Math.sin(rad)) * 100) / 100}
            x2={Math.round((cx + arm * Math.cos(rad)) * 100) / 100}
            y2={Math.round((cy + arm * Math.sin(rad)) * 100) / 100}
            stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.9"
          />
        );
      })}
    </svg>
  );
}
