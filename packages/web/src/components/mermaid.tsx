"use client";

import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

/**
 * Industry-grade dark Mermaid renderer. Tuned to the TryAnneal palette —
 * deep-space background, ultraviolet-blue accents, high-contrast readable
 * text. Diagrams scale to the container width (responsive, no zoom needed).
 */
let initialized = false;
function init() {
  if (initialized) return;
  initialized = true;
  // Brand palette (literal hex — Mermaid can't read CSS vars):
  // deep-space #161616 · abyss #0d0d0d · slate #3b3b3b · neon-violet #4141fc
  // lavender #8b8bfe · ash #eaeaea · subtle-ash #b8ad97.
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    themeVariables: {
      darkMode: true,
      background: "#161616",
      primaryColor: "#1e1e1e",
      primaryBorderColor: "#4141fc",
      primaryTextColor: "#eaeaea",
      secondaryColor: "#1e1e1e",
      secondaryBorderColor: "#8b8bfe",
      tertiaryColor: "#0d0d0d",
      tertiaryBorderColor: "#3b3b3b",
      lineColor: "#8b8bfe",
      textColor: "#eaeaea",
      nodeBorder: "#4141fc",
      mainBkg: "#1e1e1e",
      clusterBkg: "#0d0d0d",
      clusterBorder: "#3b3b3b",
      edgeLabelBackground: "#161616",
      fontSize: "14px",
    },
  });
}

let counter = 0;

export default function Mermaid({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    init();
    const id = `mmd-${counter++}`;
    mermaid
      .render(id, chart.trim())
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg);
      })
      .catch((e: unknown) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (err) {
    return (
      <pre
        className="rounded-sm p-4 overflow-x-auto font-mono"
        style={{ background: "var(--color-abyss)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-lavender-glow)", fontSize: "12px" }}
      >
        {chart.trim()}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="my-6 w-full overflow-x-auto rounded-sm p-4 flex justify-center"
      style={{ background: "var(--color-deep-space)", border: "1px solid rgba(255,255,255,0.08)" }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
