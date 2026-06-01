"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import SectionContainer from "../components/section-container";

const stats = [
  { value: "94%", label: "of agent-generated code has zero attestation" },
  { value: "10×", label: "faster than any human auditor can review" },
  { value: "$2.1B", label: "lost to unaudited smart contract exploits in 2025" },
];

export default function ProblemSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

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
      <SectionContainer>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ maxWidth: "760px", marginBottom: "48px" }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-subtle-ash)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            The Problem
          </span>
          <h2
            style={{
              marginTop: "16px",
              fontSize: "clamp(28px, 4vw, 52px)",
              fontWeight: 400,
              color: "var(--color-cloud-white)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            Agents code faster than
            <br />
            auditors can review.
          </h2>
          <p
            style={{
              marginTop: "24px",
              fontSize: "16px",
              color: "var(--color-subtle-ash)",
              lineHeight: 1.6,
              maxWidth: "480px",
            }}
          >
            As AI agents generate smart contracts at machine speed, traditional audit
            processes collapse. The trust gap is growing — and it&rsquo;s exploitable.
          </p>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {stats.map(({ value, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.22, delay: i * 0.04, ease: "easeOut" }}
              style={{
                background: "var(--color-slate-gray)",
                padding: "32px",
                borderRadius: "2px",
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.06)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "clamp(36px, 4vw, 52px)",
                  fontWeight: 400,
                  color: "var(--color-ultraviolet-blue)",
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {value}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--color-subtle-ash)",
                  lineHeight: 1.5,
                }}
              >
                {label}
              </span>
            </motion.div>
          ))}
        </div>
      </SectionContainer>
    </section>
  );
}
