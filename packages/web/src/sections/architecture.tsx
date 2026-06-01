"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, useInView, useReducedMotion } from "motion/react";
import SectionContainer from "../components/section-container";
import SectionHeader from "../components/section-header";
import type { ComponentType } from "react";
import type { EngineSceneProps } from "../components/engine-scene";

const EngineScene = dynamic(() => import("../components/engine-scene"), {
  ssr: false,
  loading: () => <SceneSkeleton />,
}) as ComponentType<EngineSceneProps>;

const stages = [
  { n: "01", title: "Input", detail: "Contract or GitHub URL, chain auto-detected." },
  { n: "02", title: "Analyze", detail: "Haiku pre-screen → Opus + Gemini + Grok cascade + Slither." },
  { n: "03", title: "Validate", detail: "2/3 consensus → confidence → verdict." },
  { n: "04", title: "Attest", detail: "ERC-8004 identity, encrypted findings, reputation ±." },
  { n: "05", title: "On-chain", detail: "Settled on Mantle." },
];

function SceneSkeleton() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Loading engine…
      </span>
    </div>
  );
}

function EngineFallback() {
  const floors = [
    { w: 96, label: "01" },
    { w: 122, label: "02" },
    { w: 148, label: "03" },
    { w: 172, label: "04" },
    { w: 198, label: "05" },
  ];
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        padding: "24px 0",
      }}
    >
      {floors.map(({ w, label }) => (
        <div
          key={label}
          style={{
            position: "relative",
            width: `${w}px`,
            height: "28px",
            border: "1px solid rgba(255,255,255,0.22)",
            background: "rgba(0,0,255,0.05)",
            borderRadius: "1px",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "-32px",
              transform: "translateY(-50%)",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.08em",
            }}
          >
            {label}
          </span>
        </div>
      ))}
      <span
        style={{
          marginTop: "8px",
          fontFamily: "var(--font-mono)",
          fontSize: "10px",
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Engine — static view
      </span>
    </div>
  );
}

function detectAcceleratedWebGL(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return false;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (!ext) return true;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "");
    return !/swiftshader|software|llvmpipe|microsoft basic render|angle\s*\(.*microsoft basic/i.test(renderer);
  } catch {
    return true;
  }
}

export default function ArchitectureSection() {
  const ref = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const inViewport = useInView(canvasRef, { margin: "200px 0px" });
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const [acceleratedGL] = useState(detectAcceleratedWebGL);
  const showEngine = acceleratedGL && !reduceMotion;

  return (
    <section
      ref={ref}
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        paddingTop: "96px",
        paddingBottom: "96px",
        background: "var(--color-abyss, #0d0d0d)",
      }}
    >
      <style>{`
        .arch-grid { display: grid; grid-template-columns: 1.15fr 1fr; gap: 48px; align-items: center; }
        .arch-canvas { height: 480px; }
        @media (max-width: 860px) {
          .arch-grid { grid-template-columns: 1fr; gap: 32px; }
          .arch-canvas { height: 340px; }
        }
      `}</style>

      <SectionContainer>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: "56px" }}
        >
          <SectionHeader label="Architecture" title="How the engine works." />
        </motion.div>

        <div className="arch-grid">
          {/* 3D engine */}
          <motion.div
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.8 }}
            className="arch-canvas"
          >
            {inView ? (
              showEngine ? (
                <EngineScene
                  animate
                  paused={!inViewport}
                  onActive={setActive}
                />
              ) : (
                <EngineFallback />
              )
            ) : (
              <SceneSkeleton />
            )}
          </motion.div>

          {/* Stage captions */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            {stages.map(({ n, title, detail }, i) => {
              const isActive = i === active;
              return (
                <motion.div
                  key={n}
                  initial={{ opacity: 0, x: 16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.08, ease: "easeOut" }}
                  style={{
                    display: "flex",
                    gap: "16px",
                    padding: "16px 0",
                    borderTop: i === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* number + leader line (fills blue when active) */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0, width: "72px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "11px",
                        color: isActive ? "var(--color-lavender-glow)" : "var(--color-subtle-ash)",
                        letterSpacing: "0.04em",
                        transition: "color 300ms ease",
                      }}
                    >
                      {n}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        height: "1px",
                        background: isActive ? "var(--color-ultraviolet-blue)" : "rgba(255,255,255,0.25)",
                        transition: "background 300ms ease",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      opacity: isActive ? 1 : 0.62,
                      transition: "opacity 300ms ease",
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "15px",
                        fontWeight: 400,
                        color: "var(--color-cloud-white)",
                        lineHeight: 1.2,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {title}
                    </h3>
                    <p style={{ fontSize: "12.5px", color: "var(--color-subtle-ash)", lineHeight: 1.55 }}>
                      {detail}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </SectionContainer>
    </section>
  );
}
