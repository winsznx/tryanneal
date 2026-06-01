"use client";

import { useEffect, useRef } from "react";

// darkest → brightest (matches spec order, reversed for sphere: bright lit surface = dense char)
const CHARS = [" ", ".", ",", ":", ";", "+", "*", "?", "%", "S", "#", "@"];
const CHAR_W = 6;   // approx px per monospace char at 9px
const CHAR_H = 9;   // line-height

function sphereBrightness(
  col: number,
  row: number,
  cols: number,
  rows: number,
  t: number,
  pulse: number
): number {
  const cx = cols / 2;
  const cy = rows / 2;

  // Sphere radius in cell units — account for char aspect ratio
  const R = Math.min(cols * CHAR_W, rows * CHAR_H) * 0.4;
  const dx = (col - cx) * CHAR_W;
  const dy = (row - cy) * CHAR_H;
  const d2 = (dx * dx + dy * dy) / (R * R);

  if (d2 > 1) return -1; // outside sphere

  const dz = Math.sqrt(1 - d2);

  // Rotating key light
  const angle = t * 0.25;
  const lx = Math.sin(angle) * 0.85;
  const ly = -0.30;
  const lz = Math.cos(angle) * 0.65 + 0.45;
  const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz);

  const nx = dx / R;
  const ny = dy / R;

  const diffuse = Math.max(0, (nx * lx + ny * ly + dz * lz) / lLen);
  const specular = Math.pow(diffuse, 14) * 0.35;

  return Math.min(1, diffuse * 0.88 + specular + 0.04 + pulse);
}

export default function HeroCanvas() {
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const pre = preRef.current;
    const container = containerRef.current;
    if (!pre || !container) return;

    let cols = 0;
    let rows = 0;
    let rafId: number;
    let glitchTimer: ReturnType<typeof setTimeout>;
    let restoreTimer: ReturnType<typeof setTimeout>;
    let glitchCells = new Set<number>();
    let glitchActive = false;
    const startTime = performance.now();

    const resize = () => {
      const W = container.offsetWidth;
      const H = container.offsetHeight;
      cols = Math.floor(W / CHAR_W);
      rows = Math.floor(H / CHAR_H);
    };
    resize();
    window.addEventListener("resize", () => { resize(); });

    // Glitch: every 3s, corrupt 5% of chars for 200ms
    const scheduleGlitch = () => {
      glitchTimer = setTimeout(() => {
        const total = cols * rows;
        glitchCells = new Set<number>();
        const count = Math.floor(total * 0.05);
        for (let i = 0; i < count; i++) {
          glitchCells.add(Math.floor(Math.random() * total));
        }
        glitchActive = true;
        restoreTimer = setTimeout(() => {
          glitchActive = false;
          glitchCells.clear();
          scheduleGlitch();
        }, 200);
      }, 3000);
    };
    scheduleGlitch();

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const t = (performance.now() - startTime) / 1000;

      // Reveal: lines appear top→bottom over 1.5s
      const revealRows = Math.min(rows, Math.floor((t / 1.5) * rows));

      // Pulse: gentle brightness wave over 8s
      const pulse = Math.sin((t / 8) * Math.PI * 2) * 0.06;

      const lines: string[] = [];

      for (let row = 0; row < rows; row++) {
        if (row > revealRows) {
          lines.push(" ".repeat(cols));
          continue;
        }

        let line = "";
        for (let col = 0; col < cols; col++) {
          const cellIdx = row * cols + col;

          if (glitchActive && glitchCells.has(cellIdx)) {
            line += CHARS[Math.floor(Math.random() * CHARS.length)];
            continue;
          }

          const b = sphereBrightness(col, row, cols, rows, t, pulse);
          if (b < 0) {
            line += " ";
          } else {
            const ci = Math.min(CHARS.length - 1, Math.floor(b * CHARS.length));
            line += CHARS[ci];
          }
        }
        lines.push(line);
      }

      pre.textContent = lines.join("\n");
    };
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(glitchTimer);
      clearTimeout(restoreTimer);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <pre
        ref={preRef}
        style={{
          position: "absolute",
          inset: 0,
          margin: 0,
          padding: 0,
          fontFamily: '"Geist Mono", "Courier New", monospace',
          fontSize: "9px",
          lineHeight: "9px",
          color: "#4141fc",
          backgroundColor: "#161616",
          whiteSpace: "pre",
          overflow: "hidden",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />
      {/* Centre vignette keeps text readable */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse 55% 52% at 50% 50%, rgba(22,22,22,0.62) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
