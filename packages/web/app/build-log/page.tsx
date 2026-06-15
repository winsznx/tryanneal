import type { Metadata } from "next";
import Nav from "../../src/components/nav";
import Footer from "../../src/components/footer";
import SectionContainer from "../../src/components/section-container";

export const metadata: Metadata = {
  title: "Build log",
  description:
    "What we built, and the on-chain proof. Every claim TryAnneal makes is verifiable — deployments, the agent registration, and the first live-protocol audit, all linked to Mantlescan.",
};

interface Proof {
  label: string;
  href: string;
}
interface Entry {
  tag: string;
  title: string;
  body: string;
  proofs?: Proof[];
}

const SCAN = "https://mantlescan.xyz";

const LOG: Entry[] = [
  {
    tag: "Engine",
    title: "Multi-LLM audit cascade + static analysis",
    body:
      "ChainGPT pre-screens, then Gemini 2.5 Pro, Groq Llama-3.3-70B, and Tencent Cloud Hunyuan form a critic panel — over Slither and Aderyn static analysis. Benchmarked on real exploits (Minterest, Euler, Nomad, KelpDAO): precision 100%, recall 100%, F1 1.00.",
  },
  {
    tag: "Corpus",
    title: "98-pattern exploit corpus — $7.1B in losses",
    body:
      "A vetted corpus of 98 historical exploits across 13 chains (2020–2026), totalling ~$7.1B — one entry per unique incident, no double-counting. A TF-IDF cosine matcher flags when new code is structurally similar to a known drain, and names the incident and threat actor.",
  },
  {
    tag: "Detectors",
    title: "15 custom Slither detectors",
    body:
      "Agent-context (ERC-8004 reentrancy, callback loops), Mantle-specific (Arsia anti-patterns, calldata bloat, L1Block reads, operator-fee outliers), and exploit-pattern detectors for the KelpDAO DVN, Euler donation, Nomad init, oracle staleness, signature replay, approval-abuse, and vault-share-rounding classes.",
  },
  {
    tag: "On-chain · 2026-06-15",
    title: "Contracts deployed to Mantle mainnet — all verified",
    body:
      "AnnealAgent, AnnealValidation, and AnnealStaking deployed to Mantle mainnet (chain 5000) and verified on Mantlescan. Staking is wired to WMNT.",
    proofs: [
      { label: "AnnealValidation", href: `${SCAN}/address/0xf02C982D19184c11b86BC34672441C45fBF0f93E` },
      { label: "AnnealAgent", href: `${SCAN}/address/0x1DBf5d0A9cd0dA72ED2E8509c6E541f3EC8A1924` },
      { label: "AnnealStaking", href: `${SCAN}/address/0xf9f3A9F5F3a2F4138FB680D5cDfa635FD4312372` },
    ],
  },
  {
    tag: "ERC-8004 · 2026-06-15",
    title: "Registered as agent #131 on the mainnet Identity Registry",
    body:
      "TryAnneal registered itself on the official ERC-8004 Identity Registry on Mantle mainnet, minting agent ID 131 to the deployer. Its agent card resolves at tryanneal.xyz/agent.json — it is a first-class participant in the registry it audits for.",
    proofs: [
      { label: "Registration tx", href: `${SCAN}/tx/0x599ff14f168dbe6dd31fe66125138f3fc64a4a50961e88e651aeb221be14a945` },
    ],
  },
  {
    tag: "Proof · 2026-06-15",
    title: "First live-protocol audit — Merchant Moe's $60M router",
    body:
      "TryAnneal audited Merchant Moe's live LB Router (~$60M TVL) on Mantle mainnet and posted the verdict on-chain as agent #131. Verdict: 100/100, clean. Not a testnet toy — a real protocol, a real attestation.",
    proofs: [
      { label: "Audit attestation tx", href: `${SCAN}/tx/0x94f3e516821fd7378c24c0f78179dd9f26cfc49f64eb30f904eb7d23c4d5dd96` },
      { label: "Router on Mantlescan", href: `${SCAN}/address/0x013e138EF6008ae5FDFDE29700e3f2Bc61d21E3a` },
    ],
  },
  {
    tag: "Distribution",
    title: "Five ways to call it — CLI, MCP, REST, Telegram, web",
    body:
      "The CLI ships on npm (npx anneal audit). A hosted MCP server (mcp.tryanneal.xyz) lets any agent call is_this_safe() with no install. A one-call REST oracle, a Telegram bot (@tryannealbot), and a plain-English web flow at /try round it out.",
    proofs: [
      { label: "Hosted MCP", href: "https://mcp.tryanneal.xyz/" },
      { label: "npm — @tryanneal/cli", href: "https://www.npmjs.com/package/@tryanneal/cli" },
    ],
  },
];

export default function BuildLogPage() {
  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen bg-deep-space">
        <SectionContainer style={{ paddingTop: "72px", paddingBottom: "96px" }}>
          <div style={{ maxWidth: "820px", margin: "0 auto" }}>
            <header style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "56px" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Build log
              </span>
              <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 400, color: "var(--color-cloud-white)", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
                What we built, and the proof.
              </h1>
              <p style={{ fontSize: "17px", lineHeight: 1.6, color: "var(--color-subtle-ash)", maxWidth: "620px" }}>
                Every claim on this site is verifiable. The deployments, the agent registration, and the
                first live audit are all on Mantle mainnet — click through and check them yourself.
              </p>
            </header>

            <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
              {LOG.map((e, i) => (
                <li
                  key={i}
                  style={{
                    position: "relative",
                    paddingLeft: "28px",
                    paddingBottom: i === LOG.length - 1 ? 0 : "40px",
                    borderLeft: "1px solid rgba(255,255,255,0.1)",
                    marginLeft: "4px",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      left: "-5px",
                      top: "4px",
                      width: "9px",
                      height: "9px",
                      borderRadius: "50%",
                      background: "var(--color-ultraviolet-blue)",
                      border: "2px solid var(--color-deep-space)",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {e.tag}
                    </span>
                    <h2 style={{ fontSize: "18px", fontWeight: 500, color: "var(--color-cloud-white)", lineHeight: 1.3 }}>{e.title}</h2>
                    <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--color-subtle-ash)" }}>{e.body}</p>
                    {e.proofs && (
                      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "4px" }}>
                        {e.proofs.map((p) => (
                          <a
                            key={p.href}
                            href={p.href}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--color-cloud-white)", borderBottom: "1px solid rgba(255,255,255,0.28)", paddingBottom: "2px" }}
                          >
                            {p.label} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            <div style={{ marginTop: "56px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "28px", display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <a href="/try" style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-cloud-white)", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "2px" }}>Try it →</a>
              <a href="/docs" style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-cloud-white)", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "2px" }}>Read the docs →</a>
              <a href="https://github.com/winsznx/tryanneal" target="_blank" rel="noreferrer" style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-cloud-white)", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "2px" }}>Read the code →</a>
            </div>
          </div>
        </SectionContainer>
      </main>
      <Footer />
    </>
  );
}
