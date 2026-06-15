"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import VerdictScore from "./verdict-score";
import SeverityBadge from "./severity-badge";
import { plainFinding, plainVerdict, severityCounts } from "../lib/plain-language";
import { prettyEngine, safetyState, crossValidationLabel } from "../lib/verdict-display";

/**
 * The zero-friction entry point. A judge who has never met us opens /try and,
 * with one click, watches TryAnneal audit a real contract and answer the only
 * question that matters — can I trust this? — in plain English. Buttons, not
 * commands. No wallet, no keys, no terminal.
 */

interface Finding {
  severity?: string;
  vulnClass?: string;
  title?: string;
  lineStart?: number;
  lineEnd?: number;
  lines?: string;
  sources?: string[];
  confidence?: number;
  description?: string;
}
interface AuditResult {
  verdictScore?: number;
  safe?: boolean;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  modelsUsed?: string[];
  mode?: string;
  codeHash?: string;
  findings?: Finding[];
  note?: string;
  error?: string;
  analysisIncomplete?: boolean;
}

const MONO = "var(--font-mono)";
const VERDICT_TONE: Record<"good" | "warn" | "bad", string> = {
  good: "var(--color-accent-green)",
  warn: "var(--color-severity-medium)",
  bad: "var(--color-severity-high)",
};

const LANGS: { code: string; label: string }[] = [
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "fr", label: "Français" },
  { code: "pt", label: "Português" },
];

interface Example {
  id: string;
  label: string;
  sub: string;
  expect: "vulnerable" | "safe";
  source: string;
}

const EXAMPLES: Example[] = [
  {
    id: "reentrancy",
    label: "Vulnerable vault",
    sub: "reentrancy — the classic drain",
    expect: "vulnerable",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract EtherVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint256 amount) external {
        require(balances[msg.sender] >= amount, "insufficient");
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        balances[msg.sender] -= amount;
    }
}
`,
  },
  {
    id: "init",
    label: "Open initializer",
    sub: "the Nomad-class $190M mistake",
    expect: "vulnerable",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Bridge {
    address public owner;
    bool public initialized;

    function initialize(address _owner) external {
        owner = _owner;
        initialized = true;
    }

    function sweep(address payable to) external {
        require(msg.sender == owner, "not owner");
        to.transfer(address(this).balance);
    }

    receive() external payable {}
}
`,
  },
  {
    id: "safe",
    label: "Clean ERC-20",
    sub: "checks-effects-interactions, no surprises",
    expect: "safe",
    source: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract SafeToken {
    string public name = "Safe";
    string public symbol = "SAFE";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(uint256 supply) {
        totalSupply = supply;
        balanceOf[msg.sender] = supply;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "insufficient");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(balanceOf[from] >= value, "insufficient");
        require(allowance[from][msg.sender] >= value, "not allowed");
        allowance[from][msg.sender] -= value;
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
        return true;
    }
}
`,
  },
];

export default function JudgeFlow() {
  const [source, setSource] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [translated, setTranslated] = useState<{ text: string; lang: string } | null>(null);
  const [translating, setTranslating] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setSource(await f.text());
      setActiveId(null);
    }
  }

  async function run(src: string) {
    if (!src.trim()) {
      setError("Paste a contract, upload a .sol file, or pick an example.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setTranslated(null);
    resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceCode: src }),
      });
      const data = (await res.json()) as AuditResult;
      if (!res.ok || data.error) setError(data.error ?? `Audit failed (${res.status}).`);
      else setResult(data);
    } catch {
      setError("Network error reaching the audit service.");
    } finally {
      setLoading(false);
    }
  }

  function pickExample(ex: Example) {
    setSource(ex.source);
    setActiveId(ex.id);
    void run(ex.source);
  }

  const findings = result?.findings ?? [];
  const derived = severityCounts(findings);
  const counts = findings.length
    ? derived
    : {
        critical: result?.criticalCount ?? 0,
        high: result?.highCount ?? 0,
        medium: result?.mediumCount ?? 0,
        low: result?.lowCount ?? 0,
      };

  function buildReportText(): string {
    if (!result) return "";
    const v = plainVerdict(result.verdictScore ?? 0, counts.critical, counts.high, result.analysisIncomplete);
    const lines = [
      `Verdict: ${v.headline}`,
      v.detail,
      `Score: ${result.verdictScore ?? 0}/100 — critical ${counts.critical}, high ${counts.high}, medium ${counts.medium}, low ${counts.low}`,
    ];
    if (findings.length) {
      lines.push("", "Findings:");
      for (const f of findings) lines.push(`- ${(f.severity ?? "info").toUpperCase()} ${f.vulnClass ?? "finding"}: ${plainFinding(f.vulnClass, f.title)}`);
    }
    return lines.join("\n");
  }

  async function translate(code: string) {
    if (!result) return;
    setTranslating(code);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: buildReportText(), lang: code }),
      });
      const data = (await res.json()) as { translated?: string };
      if (res.ok && data.translated) setTranslated({ text: data.translated, lang: code });
    } catch {
      /* best-effort — leave the English report in place */
    } finally {
      setTranslating(null);
    }
  }

  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "40px" }}>
      <header style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Try it — no wallet, no keys
        </span>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", fontWeight: 400, color: "var(--color-cloud-white)", letterSpacing: "-0.02em", lineHeight: 1.05 }}>
          Is this contract safe?
        </h1>
        <p style={{ fontSize: "17px", lineHeight: 1.6, color: "var(--color-subtle-ash)", maxWidth: "620px" }}>
          The question any agent asks before it trusts code it didn&apos;t write. Pick an example below
          and watch TryAnneal answer it — Slither, a 98-pattern exploit corpus, and a multi-LLM panel,
          in seconds.
        </p>
      </header>

      <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <span style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)" }}>One click — audit a real example:</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
          {EXAMPLES.map((ex) => {
            const active = activeId === ex.id;
            const dot = ex.expect === "safe" ? "var(--color-accent-green)" : "var(--color-severity-high)";
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => pickExample(ex)}
                disabled={loading}
                style={{
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  padding: "16px 18px",
                  borderRadius: "8px",
                  cursor: loading ? "default" : "pointer",
                  background: active ? "rgba(0,0,255,0.08)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${active ? "var(--color-ultraviolet-blue)" : "rgba(255,255,255,0.08)"}`,
                  transition: "border-color 150ms ease-out, background 150ms ease-out",
                }}
                onMouseEnter={(e) => { if (!loading && !active) e.currentTarget.style.borderColor = "rgba(255,255,255,0.22)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span aria-hidden="true" style={{ width: "7px", height: "7px", borderRadius: "50%", background: dot, flexShrink: 0 }} />
                  <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--color-cloud-white)" }}>{ex.label}</span>
                </span>
                <span style={{ fontFamily: MONO, fontSize: "11.5px", color: "var(--color-subtle-ash)", lineHeight: 1.4 }}>{ex.sub}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <span style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)" }}>…or paste your own:</span>
        <textarea
          value={source}
          onChange={(e) => { setSource(e.target.value); setActiveId(null); }}
          placeholder={"// Paste Solidity here, or upload a .sol file\npragma solidity ^0.8.19;\ncontract MyVault { ... }"}
          spellCheck={false}
          style={{
            width: "100%",
            minHeight: "200px",
            resize: "vertical",
            background: "var(--color-deep-space)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "6px",
            padding: "16px",
            fontFamily: MONO,
            fontSize: "13px",
            lineHeight: 1.6,
            color: "var(--color-cloud-white)",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => run(source)}
            disabled={loading}
            style={{ fontFamily: MONO, fontSize: "13px", fontWeight: 500, padding: "12px 24px", borderRadius: "4px", border: "none", cursor: loading ? "default" : "pointer", opacity: loading ? 0.55 : 1, background: "var(--color-ultraviolet-blue)", color: "white", letterSpacing: "0.04em" }}
          >
            {loading ? "Auditing… (Slither + corpus + LLMs)" : "Run audit"}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ fontFamily: MONO, fontSize: "13px", padding: "12px 20px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "var(--color-cloud-white)", cursor: "pointer" }}
          >
            Upload .sol
          </button>
          <input ref={fileRef} type="file" accept=".sol,text/plain" onChange={onFile} style={{ display: "none" }} />
          <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>1 audit / 5 min</span>
        </div>
      </section>

      <div ref={resultRef}>
        <AnimatePresence mode="wait">
          {loading && (
            <motion.p key="load" initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} exit={{ opacity: 0 }} style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-subtle-ash)" }}>
              Running the real engine — Slither static analysis, then the corpus and LLM panel. ~10–25s.
            </motion.p>
          )}
          {error && !loading && (
            <motion.p key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-severity-high)" }}>
              {error}
            </motion.p>
          )}
          {result && !loading && (
            <motion.div
              key="res"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              style={{ display: "flex", flexDirection: "column", gap: "22px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "28px", background: "rgba(255,255,255,0.02)" }}
            >
              {(() => {
                const v = plainVerdict(result.verdictScore ?? 0, counts.critical, counts.high, result.analysisIncomplete);
                const s = safetyState({ analysisIncomplete: result.analysisIncomplete, safe: result.safe, critical: counts.critical, high: counts.high });
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "20px", flexWrap: "wrap", padding: "18px 20px", borderRadius: "8px", border: `1px solid ${s.border}`, background: s.bg }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <span style={{ fontFamily: MONO, fontSize: "12px", letterSpacing: "0.06em", color: "var(--color-subtle-ash)" }}>is_this_safe()</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: s.fg, boxShadow: `0 0 12px ${s.fg}` }} />
                          <motion.span
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.15, duration: 0.35, ease: "easeOut" }}
                            style={{ fontSize: "26px", fontWeight: 600, letterSpacing: "-0.01em", color: s.fg }}
                          >
                            {s.label}
                          </motion.span>
                        </span>
                      </div>
                      <VerdictScore score={result.analysisIncomplete ? 0 : result.verdictScore ?? 0} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 500, color: VERDICT_TONE[v.tone] }}>{v.headline}</span>
                      <span style={{ fontSize: "14px", color: "var(--color-subtle-ash)", lineHeight: 1.5 }}>{v.detail}</span>
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
                {[["critical", counts.critical], ["high", counts.high], ["medium", counts.medium], ["low", counts.low]].map(([k, val]) => (
                  <span key={k as string} style={{ fontFamily: MONO, fontSize: "12px", color: "var(--color-subtle-ash)" }}>
                    {k}: <span style={{ color: "var(--color-cloud-white)" }}>{(val as number) ?? 0}</span>
                  </span>
                ))}
              </div>

              {result.modelsUsed && result.modelsUsed.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                  <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>{crossValidationLabel(result.modelsUsed, result.mode)}</span>
                  <div style={{ display: "flex", gap: "7px", flexWrap: "wrap" }}>
                    {result.modelsUsed.map((m) => (
                      <span key={m} style={{ fontFamily: MONO, fontSize: "11px", padding: "3px 9px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", color: "var(--color-cloud-white)" }}>
                        {prettyEngine(m)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {findings.slice(0, 8).map((f, i) => {
                const loc = f.lines ?? (f.lineStart != null ? `${f.lineStart}${f.lineEnd && f.lineEnd !== f.lineStart ? `–${f.lineEnd}` : ""}` : null);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                      <SeverityBadge severity={(f.severity as "critical" | "high" | "medium" | "low" | "informational") ?? "informational"} />
                      <span style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-cloud-white)" }}>{f.vulnClass ?? f.title ?? "finding"}</span>
                      {loc && <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>L{loc}</span>}
                      {f.confidence != null && <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>· {f.confidence}% conf</span>}
                    </div>
                    <span style={{ fontSize: "14px", color: "var(--color-subtle-ash)", lineHeight: 1.55 }}>{f.description ?? plainFinding(f.vulnClass, f.title)}</span>
                    {f.sources && f.sources.length > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontFamily: MONO, fontSize: "10px", color: "var(--color-subtle-ash)" }}>
                          flagged by {f.sources.length} source{f.sources.length > 1 ? "s" : ""}:
                        </span>
                        {f.sources.map((src) => (
                          <span key={src} style={{ fontFamily: MONO, fontSize: "10px", padding: "2px 7px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.10)", color: "var(--color-subtle-ash)" }}>
                            {prettyEngine(src)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {!findings.length && !result.analysisIncomplete && (
                <span style={{ fontSize: "14px", color: "var(--color-subtle-ash)", lineHeight: 1.55 }}>
                  No critical or high-severity issues found. An agent could compose with this.
                </span>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
                <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Read in</span>
                {LANGS.map((l) => {
                  const active = translated?.lang === l.code;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => translate(l.code)}
                      disabled={translating != null}
                      style={{
                        fontFamily: MONO, fontSize: "12px", padding: "5px 11px", borderRadius: "4px", cursor: translating != null ? "default" : "pointer",
                        background: active ? "rgba(0,0,255,0.10)" : "transparent",
                        border: `1px solid ${active ? "var(--color-ultraviolet-blue)" : "rgba(255,255,255,0.14)"}`,
                        color: "var(--color-cloud-white)", opacity: translating === l.code ? 0.55 : 1,
                      }}
                    >
                      {translating === l.code ? "…" : l.label}
                    </button>
                  );
                })}
                {translated && (
                  <button type="button" onClick={() => setTranslated(null)} style={{ fontFamily: MONO, fontSize: "12px", padding: "5px 11px", borderRadius: "4px", cursor: "pointer", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "var(--color-subtle-ash)" }}>EN</button>
                )}
              </div>

              {translated && (
                <div style={{ borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)", padding: "18px", whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.7, color: "var(--color-cloud-white)" }}>
                  {translated.text}
                  <div style={{ marginTop: "12px", fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)" }}>🌐 translated by Tencent Hunyuan</div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: "16px", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "36px" }}>
        <span style={{ fontFamily: MONO, fontSize: "11px", color: "var(--color-subtle-ash)", textTransform: "uppercase", letterSpacing: "0.08em" }}>What is TryAnneal?</span>
        <p style={{ fontSize: "16px", lineHeight: 1.65, color: "var(--color-cloud-white)", maxWidth: "640px" }}>
          The trust layer for autonomous software. When one agent is about to use a smart contract another
          agent deployed, it needs to know the code is safe first. TryAnneal answers that — and writes the
          answer on-chain, so the next agent doesn&apos;t have to ask again.
        </p>
        <ul style={{ display: "flex", flexDirection: "column", gap: "10px", listStyle: "none", padding: 0, margin: 0 }}>
          {[
            "Paste a contract → a verdict in seconds, in plain English.",
            "Every verdict is signed on-chain by ERC-8004 agent #131 on Mantle mainnet — anyone can read it back.",
            "Already audited Merchant Moe's live $60M router on-chain. Verdict: clean.",
          ].map((line, i) => (
            <li key={i} style={{ display: "flex", gap: "12px", fontSize: "15px", lineHeight: 1.55, color: "var(--color-subtle-ash)" }}>
              <span aria-hidden="true" style={{ color: "var(--color-accent-green)", flexShrink: 0 }}>→</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginTop: "6px" }}>
          <a href="/docs" style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-cloud-white)", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "2px" }}>Read the docs →</a>
          <a href="/dashboard" style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-cloud-white)", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "2px" }}>See the live agent →</a>
          <a href="https://x.com/tryanneal/status/2066582313517924820" target="_blank" rel="noreferrer" style={{ fontFamily: MONO, fontSize: "13px", color: "var(--color-cloud-white)", borderBottom: "1px solid rgba(255,255,255,0.3)", paddingBottom: "2px" }}>Watch the film →</a>
        </div>
      </section>
    </div>
  );
}
