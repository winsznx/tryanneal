import Link from "next/link";
import type { ReactNode } from "react";

/** Consistent documentation prose primitives — clean, readable, on-brand. */

export function DocTitle({ eyebrow, children }: { eyebrow?: string; children: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && (
        <span
          className="font-mono uppercase block mb-2"
          style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--color-ultraviolet-blue)" }}
        >
          {eyebrow}
        </span>
      )}
      <h1
        style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 500, color: "var(--color-cloud-white)", letterSpacing: "-0.02em", lineHeight: 1.1 }}
      >
        {children}
      </h1>
    </div>
  );
}

export function Lead({ children }: { children: ReactNode }) {
  return (
    <p className="mb-8" style={{ fontSize: "17px", lineHeight: 1.6, color: "var(--color-ash-gray)" }}>
      {children}
    </p>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mt-12 mb-4"
      style={{ fontSize: "22px", fontWeight: 500, color: "var(--color-cloud-white)", letterSpacing: "-0.01em", scrollMarginTop: "96px" }}
    >
      {children}
    </h2>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-8 mb-3" style={{ fontSize: "16px", fontWeight: 600, color: "var(--color-cloud-white)" }}>
      {children}
    </h3>
  );
}

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4" style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--color-ash-gray)" }}>
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
      className="underline"
      style={{ color: "var(--color-ultraviolet-blue)" }}
    >
      {children}
    </Link>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      className="font-mono rounded"
      style={{ fontSize: "13px", padding: "1px 5px", background: "#15151C", border: "1px solid #2A2A38", color: "var(--color-lavender-glow, #bdbdff)" }}
    >
      {children}
    </code>
  );
}

export function Pre({ children, lang }: { children: ReactNode; lang?: string }) {
  return (
    <div className="my-5 rounded-sm overflow-hidden" style={{ border: "1px solid #1E1E2A" }}>
      {lang && (
        <div
          className="font-mono px-4 py-1.5"
          style={{ fontSize: "11px", color: "var(--color-subtle-ash)", background: "#101017", borderBottom: "1px solid #1E1E2A" }}
        >
          {lang}
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono" style={{ fontSize: "13px", lineHeight: 1.6, background: "#0D0D13", color: "#D4D4E0" }}>
        {children}
      </pre>
    </div>
  );
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mb-4 flex flex-col gap-2" style={{ listStyle: "none", paddingLeft: 0 }}>
      {children}
    </ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2" style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--color-ash-gray)" }}>
      <span style={{ color: "var(--color-ultraviolet-blue)", flexShrink: 0 }}>→</span>
      <span>{children}</span>
    </li>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-5 overflow-x-auto rounded-sm" style={{ border: "1px solid #1E1E2A" }}>
      <table className="w-full" style={{ borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "#101017" }}>
            {head.map((h) => (
              <th key={h} className="text-left font-mono px-3 py-2" style={{ color: "var(--color-subtle-ash)", borderBottom: "1px solid #1E1E2A", fontWeight: 500 }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top" style={{ color: "var(--color-ash-gray)", borderBottom: "1px solid #15151C", lineHeight: 1.5 }}>
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
  const accent = tone === "good" ? "#3ECf8e" : tone === "warn" ? "#FFB020" : "#3D5AFE";
  return (
    <div
      className="my-5 rounded-sm p-4"
      style={{ background: "rgba(61,90,254,0.06)", borderLeft: `3px solid ${accent}`, fontSize: "14px", lineHeight: 1.6, color: "var(--color-ash-gray)" }}
    >
      {children}
    </div>
  );
}

export function PageNav({ prev, next }: { prev?: { title: string; href: string }; next?: { title: string; href: string } }) {
  return (
    <div className="mt-16 pt-6 flex justify-between gap-4" style={{ borderTop: "1px solid #1E1E2A" }}>
      <div>
        {prev && (
          <Link href={prev.href} className="font-mono" style={{ fontSize: "13px", color: "var(--color-ash-gray)" }}>
            ← {prev.title}
          </Link>
        )}
      </div>
      <div>
        {next && (
          <Link href={next.href} className="font-mono" style={{ fontSize: "13px", color: "var(--color-cloud-white)" }}>
            {next.title} →
          </Link>
        )}
      </div>
    </div>
  );
}
