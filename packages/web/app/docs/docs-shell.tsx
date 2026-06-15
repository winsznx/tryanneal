"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOC_NAV } from "./_nav";

/**
 * Responsive docs shell — persistent sidebar on desktop, slide-in drawer on
 * mobile. Built on the site's design tokens: inline styles + a scoped <style>
 * block for responsive rules (the same system the landing uses), so centering
 * and breakpoints are deterministic. Clears the fixed 56px nav.
 */
const MONO = "var(--font-mono)";

export default function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (slug: string) => {
    const target = slug ? `/docs/${slug}` : "/docs";
    return pathname === target;
  };

  const Sidebar = (
    <nav style={{ display: "flex", flexDirection: "column", gap: "24px" }} aria-label="Docs navigation">
      {DOC_NAV.map((g) => (
        <div key={g.group} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span
            style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--color-subtle-ash)" }}
          >
            {g.group}
          </span>
          {g.items.map((it) => {
            const active = !it.href && isActive(it.slug);
            return (
              <Link
                key={it.slug}
                href={it.href ?? (it.slug ? `/docs/${it.slug}` : "/docs")}
                target={it.href ? "_blank" : undefined}
                rel={it.href ? "noreferrer" : undefined}
                onClick={() => setOpen(false)}
                style={{
                  fontFamily: MONO,
                  fontSize: "13px",
                  padding: "5px 10px",
                  borderRadius: "2px",
                  textDecoration: "none",
                  color: active ? "var(--color-cloud-white)" : "var(--color-ash-gray)",
                  background: active ? "rgba(65,65,252,0.14)" : "transparent",
                  borderLeft: active ? "2px solid var(--color-neon-violet)" : "2px solid transparent",
                }}
              >
                {it.title}
                {it.href ? " ↗" : ""}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-deep-space)", paddingTop: "56px" }}>
      <style>{`
        .dsh-topbar { display: none; }
        .dsh-grid {
          max-width: 1280px; margin: 0 auto; display: flex; gap: 56px;
          padding: 48px 48px 80px;
        }
        .dsh-aside { display: block; width: 220px; flex-shrink: 0; }
        @media (max-width: 1023px) {
          .dsh-topbar { display: flex; }
          .dsh-aside { display: none; }
          .dsh-grid { gap: 0; padding: 24px 24px 64px; }
        }
      `}</style>

      {/* Mobile top bar */}
      <div
        className="dsh-topbar"
        style={{
          position: "sticky", top: "56px", zIndex: 30, alignItems: "center", gap: "12px",
          padding: "12px 24px", background: "rgba(22,22,22,0.92)",
          borderBottom: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)",
        }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ fontFamily: MONO, fontSize: "12px", padding: "6px 12px", borderRadius: "2px", color: "var(--color-cloud-white)", background: "transparent", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}
        >
          {open ? "✕ Close" : "☰ Docs"}
        </button>
        <span style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)" }}>Documentation</span>
      </div>

      <div className="dsh-grid">
        {/* Desktop sidebar */}
        <aside className="dsh-aside">
          <div style={{ position: "sticky", top: "84px" }}>{Sidebar}</div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.6)" }}
            onClick={() => setOpen(false)}
          >
            <div
              style={{ position: "absolute", left: 0, top: 0, height: "100%", width: "280px", padding: "24px", overflowY: "auto", background: "var(--color-deep-space)", borderRight: "1px solid rgba(255,255,255,0.08)" }}
              onClick={(e) => e.stopPropagation()}
            >
              {Sidebar}
            </div>
          </div>
        )}

        {/* Content */}
        <main style={{ minWidth: 0, flex: 1 }}>{children}</main>
      </div>
    </div>
  );
}
