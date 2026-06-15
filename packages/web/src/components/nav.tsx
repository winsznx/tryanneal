"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";

const MotionLink = motion.create(Link);

const links = [
  { href: "/dashboard", label: "DASHBOARD", external: false },
  { href: "/docs", label: "DOCS", external: false },
  { href: "https://github.com/winsznx/tryanneal", label: "GITHUB", external: true },
];

function AsteriskIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      {[0, 60, 120].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={Math.round((5 - 4 * Math.cos(rad)) * 1000) / 1000}
            y1={Math.round((5 - 4 * Math.sin(rad)) * 1000) / 1000}
            x2={Math.round((5 + 4 * Math.cos(rad)) * 1000) / 1000}
            y2={Math.round((5 + 4 * Math.sin(rad)) * 1000) / 1000}
            stroke="white"
            strokeWidth="1.4"
            strokeLinecap="round"
            opacity="0.55"
          />
        );
      })}
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
    <style>{`
      .nav-links { display: flex; }
      .nav-burger { display: none; }
      .nav-panel { display: none; }
      @media (max-width: 768px) {
        .nav-links { display: none; }
        .nav-burger { display: flex; }
        .nav-inner { padding-left: 24px !important; padding-right: 24px !important; }
        .nav-panel.open { display: flex; }
      }
    `}</style>
    <header
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        background: "transparent",
        height: "56px",
      }}
    >
      <div
        className="nav-inner relative w-full flex items-center h-full"
        style={{ maxWidth: "1440px", margin: "0 auto", paddingLeft: "48px", paddingRight: "48px" }}
      >
        {/* Logo — Cofo Sans Pixel wordmark */}
        <Link
          href="/"
          className="shrink-0 flex items-center"
          style={{ textDecoration: "none", lineHeight: 1 }}
        >
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "26px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "var(--color-ultraviolet-blue)",
              lineHeight: 1,
            }}
          >
            try
          </span>
          <span
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "26px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "var(--color-cloud-white)",
              lineHeight: 1,
            }}
          >
            anneal
          </span>
        </Link>

        {/* Nav links — absolute center, hidden on mobile */}
        <nav
          className="nav-links items-center"
          aria-label="Main navigation"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            gap: "32px",
          }}
        >
          {links.map(({ href, label, external }, i) => {
            const isActive = !external && pathname === href;
            const targetOpacity =
              hoveredIdx !== null
                ? hoveredIdx === i ? 1 : 0.3
                : isActive ? 1 : 0.75;

            const inner = (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <AsteriskIcon />
                <span
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "13px",
                    letterSpacing: "0.08em",
                  }}
                >
                  {label}
                </span>
              </span>
            );

            const anchorStyle = {
              color: "var(--color-cloud-white)",
              textDecoration: "none",
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 6px",
              margin: "-12px -6px",
            } as const;

            if (external) {
              return (
                <motion.a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={anchorStyle}
                  animate={{ opacity: targetOpacity }}
                  transition={{ duration: 0.15 }}
                  onHoverStart={() => setHoveredIdx(i)}
                  onHoverEnd={() => setHoveredIdx(null)}
                >
                  {inner}
                </motion.a>
              );
            }

            return (
              <MotionLink
                key={href}
                href={href}
                style={anchorStyle}
                animate={{ opacity: targetOpacity }}
                transition={{ duration: 0.15 }}
                onHoverStart={() => setHoveredIdx(i)}
                onHoverEnd={() => setHoveredIdx(null)}
              >
                {inner}
              </MotionLink>
            );
          })}
        </nav>

        {/* Hamburger — mobile only */}
        <button
          type="button"
          className="nav-burger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            padding: "8px",
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {menuOpen ? (
              <>
                <line x1="5" y1="5" x2="17" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="17" y1="5" x2="5" y2="17" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : (
              <>
                <line x1="3" y1="7" x2="19" y2="7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="3" y1="15" x2="19" y2="15" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile dropdown panel */}
      <div
        className={`nav-panel${menuOpen ? " open" : ""}`}
        style={{
          position: "absolute",
          top: "56px",
          left: 0,
          right: 0,
          flexDirection: "column",
          background: "rgba(13,13,13,0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "8px 24px 16px",
        }}
      >
        {links.map(({ href, label, external }) =>
          external ? (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--color-cloud-white)",
                textDecoration: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                letterSpacing: "0.08em",
                padding: "14px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <AsteriskIcon />
              {label}
            </a>
          ) : (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "var(--color-cloud-white)",
                textDecoration: "none",
                fontFamily: "var(--font-sans)",
                fontSize: "14px",
                letterSpacing: "0.08em",
                padding: "14px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <AsteriskIcon />
              {label}
            </Link>
          )
        )}
      </div>
    </header>
    </>
  );
}
