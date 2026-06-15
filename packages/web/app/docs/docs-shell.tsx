"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOC_NAV } from "./_nav";

/**
 * Responsive docs shell — persistent sidebar on desktop, slide-in drawer on
 * mobile. Highlights the active page.
 */
export default function DocsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (slug: string) => {
    const target = slug ? `/docs/${slug}` : "/docs";
    return pathname === target;
  };

  const Sidebar = (
    <nav className="flex flex-col gap-6" aria-label="Docs navigation">
      {DOC_NAV.map((g) => (
        <div key={g.group} className="flex flex-col gap-1.5">
          <span
            className="font-mono uppercase"
            style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--color-subtle-ash)" }}
          >
            {g.group}
          </span>
          {g.items.map((it) => (
            <Link
              key={it.slug}
              href={it.href ?? (it.slug ? `/docs/${it.slug}` : "/docs")}
              target={it.href ? "_blank" : undefined}
              rel={it.href ? "noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className="font-mono rounded-sm px-2 py-1 transition-colors"
              style={{
                fontSize: "13px",
                color: !it.href && isActive(it.slug) ? "var(--color-cloud-white)" : "var(--color-ash-gray)",
                background: !it.href && isActive(it.slug) ? "rgba(61,90,254,0.14)" : "transparent",
                borderLeft: !it.href && isActive(it.slug) ? "2px solid #3D5AFE" : "2px solid transparent",
              }}
            >
              {it.title}
              {it.href ? " ↗" : ""}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--color-deep-space, #0B0B0F)" }}>
      {/* Mobile top bar */}
      <div
        className="lg:hidden sticky top-14 z-30 flex items-center gap-3 px-4 py-3"
        style={{ background: "rgba(11,11,15,0.9)", borderBottom: "1px solid #1E1E2A", backdropFilter: "blur(8px)" }}
      >
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-mono rounded-sm px-3 py-1.5"
          style={{ fontSize: "12px", color: "var(--color-cloud-white)", border: "1px solid #2A2A38" }}
        >
          {open ? "✕ Close" : "☰ Docs"}
        </button>
        <span className="font-mono" style={{ fontSize: "12px", color: "var(--color-subtle-ash)" }}>
          Documentation
        </span>
      </div>

      <div className="mx-auto flex w-full max-w-[1200px] gap-10 px-4 sm:px-6 lg:px-8 py-10">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24">{Sidebar}</div>
        </aside>

        {/* Mobile drawer */}
        {open && (
          <div
            className="lg:hidden fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => setOpen(false)}
          >
            <div
              className="absolute left-0 top-0 h-full w-72 p-6 overflow-y-auto"
              style={{ background: "#0B0B0F", borderRight: "1px solid #1E1E2A" }}
              onClick={(e) => e.stopPropagation()}
            >
              {Sidebar}
            </div>
          </div>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
