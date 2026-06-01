"use client";

import { useRef, useEffect, useState } from "react";
import { useInView } from "motion/react";

const metrics = [
  {
    value: 128,
    suffix: "",
    label: "Contracts Audited",
    dot: "var(--color-ultraviolet-blue)",
  },
  {
    value: 2.1,
    prefix: "$",
    suffix: "M",
    label: "TVL Protected",
    decimals: 1,
    dot: "var(--color-status-mint)",
  },
  {
    value: 94,
    suffix: "%",
    label: "Audit Accuracy",
    dot: "var(--color-status-mint)",
  },
  {
    value: 42,
    suffix: "",
    label: "Active Stakers",
    dot: "var(--color-lavender-glow)",
  },
];

function useCounter(target: number, inView: boolean, decimals = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const duration = 1000;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCount(parseFloat((eased * target).toFixed(decimals)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, target, decimals]);
  return count;
}

function MetricCell({
  value,
  prefix = "",
  suffix,
  label,
  decimals = 0,
  dot,
  inView,
}: {
  value: number;
  prefix?: string;
  suffix: string;
  label: string;
  decimals?: number;
  dot: string;
  inView: boolean;
}) {
  const count = useCounter(value, inView, decimals);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          color: "var(--color-subtle-ash)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          textDecoration: "underline",
          textDecorationColor: "rgba(255,255,255,0.12)",
          textUnderlineOffset: "3px",
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(36px, 4vw, 52px)",
            fontWeight: 400,
            color: "var(--color-cloud-white)",
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {prefix}
          {decimals > 0 ? count.toFixed(decimals) : Math.round(count)}
          {suffix}
        </span>
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: dot,
            flexShrink: 0,
            boxShadow: `0 0 6px ${dot}`,
          }}
        />
      </div>
    </div>
  );
}

export default function MetricsSection() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  return (
    <section
      ref={ref}
      style={{
        borderTop: "1px solid rgba(255,255,255,0.08)",
        background: "var(--color-abyss, #0d0d0d)",
      }}
    >
      <style>{`
        .metrics-wrap { padding-left: 48px; padding-right: 48px; }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0;
        }
        .metric-cell-border {
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 48px 40px;
        }
        .metric-cell-border:last-child {
          border-right: none;
        }
        @media (max-width: 768px) {
          .metrics-wrap { padding-left: 24px; padding-right: 24px; }
          .metrics-grid { grid-template-columns: repeat(2, 1fr); }
          .metric-cell-border:nth-child(2) { border-right: none; }
          .metric-cell-border { padding: 36px 24px; border-bottom: 1px solid rgba(255,255,255,0.06); }
          .metric-cell-border:nth-child(3),
          .metric-cell-border:nth-child(4) { border-bottom: none; }
        }
      `}</style>
      <div className="metrics-wrap" style={{ maxWidth: "1440px", margin: "0 auto" }}>
        <div className="metrics-grid">
          {metrics.map((m) => (
            <div key={m.label} className="metric-cell-border">
              <MetricCell {...m} inView={!!inView} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
