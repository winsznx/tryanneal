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
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    fontFamily: "var(--font-mono), ui-monospace, monospace",
    themeVariables: {
      darkMode: true,
      background: "#0B0B0F",
      primaryColor: "#15151C",
      primaryBorderColor: "#3D5AFE",
      primaryTextColor: "#E7E7EF",
      secondaryColor: "#15151C",
      secondaryBorderColor: "#7C8CFF",
      tertiaryColor: "#101017",
      tertiaryBorderColor: "#2A2A38",
      lineColor: "#5A5A78",
      textColor: "#C9C9D6",
      nodeBorder: "#3D5AFE",
      mainBkg: "#15151C",
      clusterBkg: "#101017",
      clusterBorder: "#2A2A38",
      edgeLabelBackground: "#0B0B0F",
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
        style={{ background: "#101017", border: "1px solid #2A2A38", color: "#9a9aff", fontSize: "12px" }}
      >
        {chart.trim()}
      </pre>
    );
  }

  return (
    <div
      ref={ref}
      className="my-6 w-full overflow-x-auto rounded-sm p-4 flex justify-center"
      style={{ background: "#0B0B0F", border: "1px solid #1E1E2A" }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
