import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Documentation prose primitives — readable type scale + generous spacing,
 * styled directly on the design tokens (inline styles) so they render
 * consistently and match the landing's system.
 */
const MONO = "var(--font-mono)";

export function DocTitle({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: "28px" }}>
      {eyebrow && (
        <span
          style={{ display: "block", marginBottom: "10px", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-ultraviolet-blue)" }}
        >
          {eyebrow}
        </span>
      )}
      <h1 style={{ fontSize: "clamp(32px, 3.6vw, 46px)", fontWeight: 500, color: "var(--color-cloud-white)", letterSpacing: "-0.02em", lineHeight: 1.12 }}>
        {children}
      </h1>
    </div>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p style={{ marginBottom: "32px", fontSize: "19px", lineHeight: 1.65, color: "var(--color-ash-gray)" }}>
      {children}
    </p>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ marginTop: "56px", marginBottom: "18px", fontSize: "27px", fontWeight: 500, color: "var(--color-cloud-white)", letterSpacing: "-0.01em", lineHeight: 1.2, scrollMarginTop: "96px" }}>
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 style={{ marginTop: "38px", marginBottom: "12px", fontSize: "19px", fontWeight: 600, color: "var(--color-cloud-white)", lineHeight: 1.3 }}>
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p style={{ marginBottom: "20px", fontSize: "17px", lineHeight: 1.75, color: "var(--color-ash-gray)" }}>
      {children}
    </p>
  );
}

export function A({ href, children }: { href: string; children: ReactNode }) {
  const ext = href.startsWith("http");
  return (
    <Link
      href={href}
      target={ext ? "_blank" : undefined}
      rel={ext ? "noreferrer" : undefined}
      style={{ color: "var(--color-ultraviolet-blue)", textDecoration: "underline", textUnderlineOffset: "2px" }}
    >
      {children}
    </Link>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      style={{ fontFamily: MONO, fontSize: "14px", padding: "3px 8px", borderRadius: "3px", background: "var(--color-slate-gray)", border: "1px solid rgba(255,255,255,0.12)", color: "var(--color-lavender-glow)", whiteSpace: "nowrap" }}
    >
      {children}
    </code>
  );
}

export function Pre({ children, lang }: { children: ReactNode; lang?: string }) {
  return (
    <div style={{ margin: "24px 0", borderRadius: "2px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
      {lang && (
        <div style={{ fontFamily: MONO, fontSize: "11px", padding: "8px 18px", color: "var(--color-subtle-ash)", background: "var(--color-abyss)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {lang}
        </div>
      )}
      <pre style={{ overflowX: "auto", padding: "18px", fontFamily: MONO, fontSize: "14px", lineHeight: 1.7, background: "var(--color-abyss)", color: "var(--color-ash-gray)", margin: 0 }}>
        {children}
      </pre>
    </div>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul style={{ marginBottom: "22px", display: "flex", flexDirection: "column", gap: "12px", listStyle: "none", paddingLeft: 0 }}>
      {children}
    </ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li style={{ display: "flex", gap: "12px", fontSize: "17px", lineHeight: 1.65, color: "var(--color-ash-gray)" }}>
      <span style={{ color: "var(--color-ultraviolet-blue)", flexShrink: 0 }}>→</span>
      <span>{children}</span>
    </li>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div style={{ margin: "24px 0", overflowX: "auto", borderRadius: "2px", border: "1px solid rgba(255,255,255,0.08)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ background: "var(--color-abyss)" }}>
            {head.map((h) => (
              <th key={h} style={{ textAlign: "left", fontFamily: MONO, padding: "12px 18px", color: "var(--color-subtle-ash)", borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 500, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} style={{ padding: "14px 18px", verticalAlign: "top", color: "var(--color-ash-gray)", borderBottom: "1px solid var(--color-slate-gray)", lineHeight: 2 }}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Callout({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "good" | "warn" }) {
  const accent = tone === "good" ? "var(--color-status-mint)" : tone === "warn" ? "var(--color-severity-medium)" : "var(--color-neon-violet)";
  return (
    <div
      style={{ margin: "24px 0", borderRadius: "2px", padding: "18px 20px", background: "rgba(65,65,252,0.06)", borderLeft: `3px solid ${accent}`, fontSize: "16px", lineHeight: 1.7, color: "var(--color-ash-gray)" }}
    >
      {children}
    </div>
  );
}

export function PageNav({ prev, next }: { prev?: { title: string; href: string }; next?: { title: string; href: string } }) {
  return (
    <div style={{ marginTop: "64px", paddingTop: "28px", display: "flex", justifyContent: "space-between", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
      <div>
        {prev && (
          <Link href={prev.href} style={{ fontFamily: MONO, fontSize: "14px", color: "var(--color-ash-gray)" }}>
            ← {prev.title}
          </Link>
        )}
      </div>
      <div>
        {next && (
          <Link href={next.href} style={{ fontFamily: MONO, fontSize: "14px", color: "var(--color-cloud-white)" }}>
            {next.title} →
          </Link>
        )}
      </div>
    </div>
  );
}
