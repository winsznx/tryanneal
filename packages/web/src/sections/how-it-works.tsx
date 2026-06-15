"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import SectionContainer from "../components/section-container";

const steps = [
  {
    number: "01",
    title: "Submit",
    description:
      "Drop a contract or paste a GitHub URL. We pull the source, detect the chain, and queue it for analysis.",
    icon: <SubmitIcon />,
  },
  {
    number: "02",
    title: "Audit",
    description:
      "ChainGPT triages. Gemini, Groq, and Tencent Cloud Hunyuan argue. Slither and Aderyn hold the ground truth. Only multi-model agreement becomes a finding.",
    icon: <AuditIcon />,
  },
  {
    number: "03",
    title: "Attest",
    description:
      "Verdict signed on Mantle via ERC-8004. Findings sealed to Arweave. Reputation moves on-chain — readable by any agent, forever.",
    icon: <AttestIcon />,
  },
];

export default function HowItWorksSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  return (
    <section
      id="how"
      ref={ref}
      style={{
        background: "var(--color-deep-space)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingTop: "96px",
        paddingBottom: "96px",
        scrollMarginTop: "72px",
      }}
    >
      <SectionContainer style={{ display: "flex", flexDirection: "column" }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: "16px", maxWidth: "640px" }}
        >
          <h2
            style={{
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 400,
              color: "var(--color-cloud-white)",
              letterSpacing: "-0.015em",
              lineHeight: 1.1,
            }}
          >
            Audit in seconds. Attest forever.
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.05 }}
          style={{
            fontSize: "14px",
            lineHeight: 1.65,
            color: "var(--color-ash-gray)",
            maxWidth: "520px",
            marginBottom: "72px",
          }}
        >
          Three frontier models, one ground-truth analyzer, one verdict.
          From contract to on-chain proof in under sixty seconds.
        </motion.p>

        <style>{`
          .hiw-rows { display: flex; flex-direction: column; width: 100%; }
          .hiw-row { display: grid; grid-template-columns: 56px 1fr; gap: 24px; padding: 28px 0; border-top: 1px solid rgba(255,255,255,0.08); }
          .hiw-row:last-child { border-bottom: 1px solid rgba(255,255,255,0.08); }
          .hiw-row-inner { display: grid; grid-template-columns: 1fr 280px; gap: 32px; align-items: start; }
          @media (max-width: 768px) {
            .hiw-row { grid-template-columns: 40px 1fr; gap: 16px; padding: 24px 0; }
            .hiw-row-inner { grid-template-columns: 1fr; gap: 16px; }
          }
        `}</style>
        <div className="hiw-rows">
          {steps.map(({ number, title, description, icon }, i) => (
            <motion.div
              key={number}
              className="hiw-row"
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.32, delay: i * 0.08, ease: "easeOut" }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  color: "var(--color-subtle-ash)",
                  paddingTop: "4px",
                }}
              >
                {number}
              </span>
              <div className="hiw-row-inner">
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h3
                    style={{
                      fontSize: "22px",
                      fontWeight: 400,
                      color: "var(--color-cloud-white)",
                      lineHeight: 1.2,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {title}
                  </h3>
                  <p
                    style={{
                      fontSize: "14px",
                      lineHeight: 1.65,
                      color: "var(--color-subtle-ash)",
                      maxWidth: "520px",
                    }}
                  >
                    {description}
                  </p>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", opacity: 0.7 }}>
                  {icon}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </SectionContainer>
    </section>
  );
}

function SubmitIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="8" y="6" width="32" height="38" rx="3" stroke="white" strokeWidth="1.3" opacity="0.8" />
      <line x1="15" y1="16" x2="33" y2="16" stroke="white" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <line x1="15" y1="22" x2="33" y2="22" stroke="white" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <line x1="15" y1="28" x2="25" y2="28" stroke="white" strokeWidth="1.2" opacity="0.5" strokeLinecap="round" />
      <circle cx="33" cy="35" r="6" stroke="white" strokeWidth="1.3" opacity="0.9" />
      <line x1="33" y1="32" x2="33" y2="38" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
      <line x1="30" y1="35" x2="36" y2="35" stroke="white" strokeWidth="1.3" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

function AuditIcon() {
  const nodes = [
    { x: 24, y: 8  },
    { x: 8,  y: 24 },
    { x: 40, y: 24 },
    { x: 16, y: 40 },
    { x: 32, y: 40 },
  ];
  const edges = [[0,1],[0,2],[1,3],[2,4],[1,4],[2,3]];
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {edges.map(([a, b], i) => (
        <line key={i}
          x1={nodes[a].x} y1={nodes[a].y}
          x2={nodes[b].x} y2={nodes[b].y}
          stroke="white" strokeWidth="1.2" opacity="0.6" strokeLinecap="round"
        />
      ))}
      {nodes.map((n, i) => (
        <circle key={i} cx={n.x} cy={n.y} r="2.5" fill="white" opacity="0.9" />
      ))}
    </svg>
  );
}

function AttestIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <circle cx="24" cy="24" r="16" stroke="white" strokeWidth="1.3" opacity="0.8" />
      <path d="M16 24 L21 29 L32 18" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <circle cx="24" cy="24" r="21" stroke="white" strokeWidth="0.8" opacity="0.2" strokeDasharray="3 3" />
    </svg>
  );
}
