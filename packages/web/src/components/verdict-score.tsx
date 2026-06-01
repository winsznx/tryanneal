"use client";

import { motion } from "motion/react";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--color-severity-safe)";
  if (score >= 60) return "var(--color-severity-medium)";
  return "var(--color-severity-critical)";
}

export default function VerdictScore({ score }: { score: number }) {
  const color = scoreColor(score);
  const cx = 100;
  const cy = 100;
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 200, height: 200 }}>
      <svg
        width={200}
        height={200}
        viewBox="0 0 200 200"
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={5}
        />
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - progress }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <motion.span
          className="font-mono font-bold leading-none text-display"
          style={{ color }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="font-mono text-micro text-subtle-ash mt-1">/100</span>
      </div>
    </div>
  );
}
