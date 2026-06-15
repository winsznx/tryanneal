"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";

export default function CtaSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section
      ref={ref}
      className="cta-section"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <style>{`
        .cta-section { display: grid; grid-template-columns: 45fr 55fr; min-height: 480px; }
        @media (max-width: 768px) {
          .cta-section { grid-template-columns: 1fr; min-height: auto; }
          .cta-left { padding: 56px 24px !important; }
          .cta-right { padding: 40px 24px !important; }
        }
      `}</style>
      {/* Left panel — solid blue */}
      <motion.div
        initial={{ opacity: 0, x: -24 }}
        className="cta-left"
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: "var(--color-ultraviolet-blue)",
          padding: "80px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "48px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "rgba(255,255,255,0.6)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Get Started
          </span>
          <h2
            style={{
              fontSize: "clamp(28px, 3.8vw, 52px)",
              fontWeight: 400,
              color: "#ffffff",
              letterSpacing: "-0.025em",
              lineHeight: 1.0,
            }}
          >
            Start auditing
            <br />
            in 10 seconds.
          </h2>
          <p
            style={{
              fontSize: "15px",
              color: "rgba(255,255,255,0.92)",
              lineHeight: 1.6,
              maxWidth: "380px",
            }}
          >
            One command. Three models. A signed verdict on Mantle. No login, no waiting list.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#ffffff",
              color: "var(--color-ultraviolet-blue)",
              padding: "14px 28px",
              borderRadius: "2px",
              fontSize: "13px",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              textDecoration: "none",
              alignSelf: "flex-start",
              transition: "opacity 150ms ease-out",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.88")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")}
          >
            Open Dashboard
          </Link>
          <a
            href="https://github.com/winsznx/tryanneal"
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              color: "rgba(255,255,255,0.72)",
              textDecoration: "none",
              alignSelf: "flex-start",
              transition: "color 150ms ease-out",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#ffffff")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.72)")}
          >
            <span style={{ fontFamily: "var(--font-mono)" }}>→</span> View Source on GitHub
          </a>
        </div>
      </motion.div>

      {/* Right panel — dark with terminal, hidden on mobile */}
      <motion.div
        className="cta-right"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.15 }}
        style={{
          background: "var(--color-ultraviolet-blue)",
          padding: "80px 56px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "32px",
        }}
      >
        {/* Terminal window — dark card on the blue panel */}
        <div
          style={{
            background: "#0b0b14",
            border: "1px solid rgba(0,0,0,0.35)",
            borderRadius: "4px",
            overflow: "hidden",
            boxShadow: "0 12px 40px rgba(0,0,20,0.4)",
          }}
        >
          {/* Terminal titlebar */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "10px 16px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {["rgba(255,96,96,0.7)", "rgba(255,189,46,0.7)", "rgba(39,201,63,0.7)"].map((c, i) => (
              <span
                key={i}
                style={{ width: "10px", height: "10px", borderRadius: "50%", background: c }}
              />
            ))}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "11px",
                color: "rgba(255,255,255,0.3)",
                marginLeft: "auto",
                marginRight: "auto",
                letterSpacing: "0.04em",
              }}
            >
              anneal — terminal
            </span>
          </div>

          {/* Terminal body */}
          <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-status-mint)", flexShrink: 0 }}>$</span>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-ash-gray)", lineHeight: 1.5 }}>
                npx anneal audit ./contracts/Vault.sol --network mantle
              </code>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingLeft: "22px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                ✳ Pulling source from GitHub…
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                ✳ ChainGPT pre-screen: 2 potential issues
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                ✳ Gemini + Groq + Hunyuan cascade running…
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                ✳ Slither static analysis complete
              </span>
            </div>
            <div
              style={{
                paddingLeft: "22px",
                paddingTop: "8px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-status-mint)" }}>
                ✓ Verdict: SAFE (confidence 0.91)
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-subtle-ash)" }}>
                ✓ Attested on Mantle · tx 0x4a2f…c91e
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-subtle-ash)" }}>
                ✓ Findings encrypted → Arweave
              </span>
            </div>
            <div style={{ paddingLeft: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-status-mint)" }}>$</span>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "14px",
                  background: "var(--color-status-mint)",
                  opacity: 0.8,
                  animation: "blink 1.1s step-end infinite",
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <style>{`@keyframes blink { 0%, 100% { opacity: 0.8; } 50% { opacity: 0; } }`}</style>
    </section>
  );
}
