"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import GlitchBackground from "../components/glitch-background";

export default function HeroSection() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  // Scroll progress: 0 when hero top hits viewport top, 1 when hero bottom hits viewport top.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Cinematic recede: content fades, lifts, and scales down as you scroll past.
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const contentScale = useTransform(scrollYProgress, [0, 1], [1, 0.94]);
  // Background parallax: canvas drifts down and dims slower than content.
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const bgOpacity = useTransform(scrollYProgress, [0, 0.8], [0.62, 0.12]);
  // Scroll indicator fades the moment you start scrolling.
  const hintOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  return (
    <section ref={ref} className="relative min-h-screen overflow-hidden bg-deep-space">

      {/* Layer 1 — glitch canvas animation (parallax) */}
      <motion.div className="absolute inset-0" style={{ opacity: reduceMotion ? 0.62 : bgOpacity, y: reduceMotion ? 0 : bgY }}>
        <GlitchBackground />
      </motion.div>

      {/* Layer 2 — dark gradient: deepens left edge so text stays readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, rgba(22,22,22,0.82) 0%, rgba(22,22,22,0.55) 45%, rgba(22,22,22,0.18) 100%)",
        }}
      />

      <style>{`
        .hero-content { padding-left: 64px; padding-right: 64px; }
        @media (max-width: 768px) { .hero-content { padding-left: 24px; padding-right: 24px; } }
        @keyframes heroDot { 0% { transform: translateY(0); opacity: 0; } 25% { opacity: 1; } 75% { opacity: 1; } 100% { transform: translateY(20px); opacity: 0; } }
      `}</style>

      {/* Layer 3 — content (cinematic recede on scroll) */}
      <motion.div
        className="hero-content relative z-10 w-full"
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          paddingTop: "22vh",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          opacity: reduceMotion ? 1 : contentOpacity,
          y: reduceMotion ? 0 : contentY,
          scale: reduceMotion ? 1 : contentScale,
        }}
      >

        <motion.div
          className="flex flex-col gap-7 max-w-[580px]"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Headline */}
          <h1
            className="font-normal leading-none text-cloud-white"
            style={{
              fontSize: "clamp(48px, 5.5vw, 72px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.0,
            }}
          >
            Agent-readable
            <br />
            audits, signed
            <br />
            on-chain.
          </h1>

          {/* Subheading */}
          <p
            className="leading-relaxed"
            style={{
              fontSize: "16px",
              color: "var(--color-subtle-ash)",
              maxWidth: "460px",
              lineHeight: 1.6,
            }}
          >
            When an AI agent deploys a contract, another agent needs to verify it. We're the verification layer with three frontier models, on-chain attestation, ERC-8004 native.
          </p>

          {/* CTAs */}
          <div className="flex flex-row items-center gap-4 flex-wrap mt-1">
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-ultraviolet-blue)",
                color: "var(--color-cloud-white)",
                padding: "14px 24px",
                borderRadius: "var(--radius-buttons)",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "none",
                transition: "opacity 150ms ease-out",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              Build with Anneal
            </Link>
            <Link
              href="/audit/0xb8847a37ce8437d01189686090f93af466e4eaa5e5fe3de7ba2579338e85e7b0"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                color: "var(--color-cloud-white)",
                padding: "13px 24px",
                borderRadius: "var(--radius-buttons)",
                fontSize: "13px",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                border: "1px solid rgba(255,255,255,0.45)",
                transition: "border-color 150ms ease-out",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.85)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.45)")}
            >
              See a sample audit →
            </Link>
          </div>

          {/* CLI hint */}
          <div
            className="flex items-center gap-3 mt-3"
            style={{ opacity: 0.85 }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                color: "var(--color-accent-green)",
                lineHeight: 1,
                flexShrink: 0,
              }}
            >
              →
            </span>
            <code
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                color: "var(--color-subtle-ash)",
              }}
            >
              npx anneal audit ./Vault.sol --network mantle
            </code>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator — bottom center, fades on scroll */}
      <motion.div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "28px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
          opacity: reduceMotion ? 0.5 : hintOpacity,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Scroll
        </span>
        <div
          style={{
            position: "relative",
            width: "1px",
            height: "40px",
            background: "rgba(255,255,255,0.18)",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "-1.5px",
              top: 0,
              width: "4px",
              height: "8px",
              borderRadius: "2px",
              background: "var(--color-lavender-glow)",
              animation: reduceMotion ? "none" : "heroDot 1.8s ease-in-out infinite",
            }}
          />
        </div>
      </motion.div>
    </section>
  );
}
