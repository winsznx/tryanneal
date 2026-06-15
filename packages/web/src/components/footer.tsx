"use client";

import Link from "next/link";

const COLUMNS: Record<string, { label: string; href: string; external?: boolean }[]> = {
  "GET STARTED": [
    { label: "Docs", href: "/docs", external: false },
    { label: "GitHub", href: "https://github.com/winsznx/tryanneal", external: true },
    { label: "CLI Reference", href: "/docs/cli", external: false },
  ],
  "THE APP": [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Audit Engine", href: "/#features" },
    { label: "How It Works", href: "/#how" },
  ],
  "THE PROTOCOL": [
    { label: "ERC-8004", href: "https://eips.ethereum.org/EIPS/eip-8004", external: true },
    { label: "Mantle", href: "https://www.mantle.xyz", external: true },
    { label: "Contracts", href: "/docs/contracts", external: false },
  ],
};

const LINK = "rgba(255,255,255,0.82)";
const LINK_HOVER = "#ffffff";

export default function Footer() {
  return (
    <footer style={{ background: "var(--color-ultraviolet-blue)" }}>
      <style>{`
        .ft-wrap { padding: 56px 48px 32px; }
        .ft-top { display: flex; justify-content: space-between; gap: 48px; max-width: 1200px; margin: 0 auto; }
        .ft-cols { display: flex; gap: 56px; }
        .ft-bottom { display: flex; align-items: center; justify-content: space-between; max-width: 1200px; margin: 48px auto 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.2); }
        @media (max-width: 768px) {
          .ft-wrap { padding: 48px 24px 28px; }
          .ft-top { flex-direction: column; gap: 40px; }
          .ft-cols { flex-wrap: wrap; gap: 32px 48px; }
          .ft-col { flex: 0 0 35%; }
          .ft-bottom { flex-direction: column-reverse; align-items: flex-start; gap: 20px; }
        }
      `}</style>

      <div className="ft-wrap">
        <div className="ft-top">
          {/* Brand */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "260px" }}>
            <Link href="/" style={{ textDecoration: "none", lineHeight: 1, display: "flex", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-pixel)", fontSize: "22px", fontWeight: 400, letterSpacing: "-0.01em", color: "rgba(255,255,255,0.55)" }}>
                try
              </span>
              <span style={{ fontFamily: "var(--font-pixel)", fontSize: "22px", fontWeight: 400, letterSpacing: "-0.01em", color: "#ffffff" }}>
                anneal
              </span>
            </Link>
            <p style={{ fontSize: "13px", lineHeight: 1.6, color: "rgba(255,255,255,0.92)", maxWidth: "230px" }}>
              Trust infrastructure for autonomous agents.
            </p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "11px", lineHeight: 1.6, color: "rgba(255,255,255,0.7)", maxWidth: "230px" }}>
              Audited by three models. Signed on Mantle. Verifiable by anyone.
            </p>
          </div>

          {/* Link columns */}
          <div className="ft-cols">
            {Object.entries(COLUMNS).map(([heading, items]) => (
              <div key={heading} className="ft-col" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                  {heading}
                </span>
                {items.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "13px", color: LINK, textDecoration: "none", lineHeight: 1.4, transition: "color 0.2s" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = LINK_HOVER)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = LINK)}
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      style={{ fontSize: "13px", color: LINK, textDecoration: "none", lineHeight: 1.4, transition: "color 0.2s" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = LINK_HOVER)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = LINK)}
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="ft-bottom">
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <SocialLink href="https://x.com/tryanneal" label="X / Twitter"><XIcon /></SocialLink>
            <SocialLink href="https://github.com/winsznx/tryanneal" label="GitHub"><GithubIcon /></SocialLink>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "rgba(255,255,255,0.6)", letterSpacing: "0.04em" }}>
            © 2026 TryAnneal
          </span>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      style={{ color: "rgba(255,255,255,0.8)", transition: "color 0.2s", display: "flex", alignItems: "center" }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "#ffffff")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.8)")}
    >
      {children}
    </a>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M12.6 1h2.4L9.7 6.9 16 15h-4.5L8 10.3 3.9 15H1.5l5.6-6.3L1 1h4.6L8.9 5.4 12.6 1zm-.8 12.6h1.3L4.3 2.3H2.9l9 11.3z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 17 17" fill="currentColor" aria-hidden="true">
      <path d="M8.5 0C3.8 0 0 3.9 0 8.6c0 3.8 2.4 7 5.8 8.1.4.1.6-.2.6-.4V14.6c-2.4.5-2.9-1.2-2.9-1.2-.4-1-.9-1.3-.9-1.3-.7-.5.1-.5.1-.5.8.1 1.2.8 1.2.8.7 1.2 1.9.9 2.3.7.1-.5.3-.9.5-1.1-1.8-.2-3.7-.9-3.7-4.1 0-.9.3-1.6.8-2.2-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8.6-.2 1.3-.3 2-.3s1.4.1 2 .3c1.5-1 2.2-.8 2.2-.8.5 1.1.2 1.9.1 2.1.5.6.8 1.3.8 2.2 0 3.2-1.9 3.9-3.7 4.1.3.3.6.8.6 1.6v2.4c0 .2.1.5.6.4C14.6 15.6 17 12.4 17 8.6 17 3.9 13.2 0 8.5 0z" />
    </svg>
  );
}
