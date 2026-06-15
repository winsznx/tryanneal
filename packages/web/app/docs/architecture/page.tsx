import { DocTitle, Lead, H2, P, UL, LI, Code, PageNav } from "../../../src/components/doc";
import Mermaid from "../../../src/components/mermaid";

export const metadata = { title: "TryAnneal Docs — Architecture" };

const STACK = `flowchart TB
  subgraph CLIENTS["Agents · developers · CI · judges"]
    A1["anneal CLI"]
    A2["GET /api/safety"]
    A3["MCP is_this_safe()"]
    A4["@tryannealbot"]
  end
  subgraph ENGINE["Engine (TypeScript)"]
    E1["Slither + Aderyn"]
    E2["ChainGPT → Gemini · Groq · Hunyuan"]
    E3["Consensus scoring"]
    E4["Arsia gas profiler"]
    E5["AES-256-GCM encrypt"]
  end
  CORPUS["Exploit corpus<br/>113 patterns · $10.1B"]
  subgraph CHAIN["Mantle (Solidity)"]
    C1["AnnealValidation<br/>verdict registry"]
    C2["AnnealAgent · ERC-8004 #131"]
    C3["AnnealStaking"]
  end
  CLIENTS --> ENGINE
  CORPUS -.-> E3
  ENGINE -->|postVerdict| C1
  A2 -->|getVerdict| C1
  A3 -->|getVerdict| C1`;

const FLOW = `sequenceDiagram
  participant U as Agent / Dev
  participant E as runAudit()
  participant S as Slither + Aderyn
  participant L as LLM cascade
  participant V as AnnealValidation
  U->>E: source code
  par static
    E->>S: analyze
    S-->>E: findings
  and llm
    E->>L: ChainGPT → Gemini·Groq·Hunyuan
    L-->>E: findings + confidence
  end
  E->>E: consensus + corpus + gas
  E->>V: postVerdict (on-chain)
  U->>V: getVerdict(codeHash)
  V-->>U: safe? score, severities`;

export default function Architecture() {
  return (
    <article>
      <DocTitle eyebrow="Getting started">Architecture</DocTitle>
      <Lead>Three layers, one primitive: an engine that audits, an on-chain registry that attests, and a set of surfaces any agent can call.</Lead>

      <H2>The stack</H2>
      <Mermaid chart={STACK} />
      <UL>
        <LI><strong>Engine</strong> (<Code>packages/engine</Code>) — static analysis, the LLM cascade, consensus scoring, the Arsia gas profiler, and AES-256-GCM encryption.</LI>
        <LI><strong>Agent infra</strong> (<Code>packages/contracts</Code>) — <Code>AnnealValidation</Code> (verdict registry), <Code>AnnealAgent</Code> (ERC-8004 facade), <Code>AnnealStaking</Code> (auditor accountability).</LI>
        <LI><strong>Surfaces</strong> — CLI, safety-oracle API (<Code>packages/web</Code>), MCP server (<Code>packages/mcp</Code>), Telegram bot (<Code>packages/telegram</Code>), GitHub Action.</LI>
      </UL>

      <H2>One audit, end to end</H2>
      <Mermaid chart={FLOW} />
      <P>
        Static analysis and the LLM cascade run in parallel. The consensus scorer dedups by line
        overlap, boosts findings cross-validated by Slither, floors single-model findings, and culls
        anything below 20% confidence. The LLM stage is non-fatal — if every model times out, the
        audit still returns a static + corpus verdict.
      </P>

      <H2>Trust model</H2>
      <UL>
        <LI>No single LLM is trusted — Slither/Aderyn cross-validate every flagged line, and ≥2-model agreement raises confidence.</LI>
        <LI>Findings are encrypted; only the verdict score + severity counts are public on-chain. Destroying the key crypto-shreds the report.</LI>
        <LI>Verdicts carry the posting <Code>agentId</Code> — consumers weight by on-chain reputation, never blind trust.</LI>
      </UL>

      <PageNav prev={{ title: "Quickstart", href: "/docs/quickstart" }} next={{ title: "CLI", href: "/docs/cli" }} />
    </article>
  );
}
