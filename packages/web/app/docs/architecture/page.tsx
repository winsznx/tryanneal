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
    E2["ChainGPT → Groq · GPT-OSS"]
    E3["Consensus scoring"]
    E4["Arsia gas profiler"]
    E5["AES-256-GCM encrypt"]
    E6["Hunyuan translation"]
  end
  CORPUS["Exploit corpus<br/>98 patterns · $7.1B"]
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
  participant S as Slither + Aderyn + 16 detectors
  participant L as LLM cascade
  participant V as AnnealValidation
  U->>E: source code
  par static
    E->>S: analyze + corpus match
    S-->>E: findings
  and llm
    E->>L: ChainGPT → Groq·GPT-OSS
    L-->>E: findings + confidence
  end
  E->>E: corroborate (≥2 sources) · dedup · score
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
        <LI><strong>Engine</strong> (<Code>packages/engine</Code>) — Slither + Aderyn with 16 custom detectors, a 98-pattern exploit corpus, the cross-validating LLM cascade, consensus scoring, the Arsia gas profiler, and AES-256-GCM encryption.</LI>
        <LI><strong>Agent infra</strong> (<Code>packages/contracts</Code>) — <Code>AnnealValidation</Code> (verdict registry), <Code>AnnealAgent</Code> (ERC-8004 facade), <Code>AnnealStaking</Code> (auditor accountability).</LI>
        <LI><strong>Surfaces</strong> — CLI (with a <Code>--threshold</Code> exit-code gate), safety-oracle API (<Code>packages/web</Code>), MCP server (<Code>packages/mcp</Code>), Telegram bot (<Code>packages/telegram</Code>), and a GitHub Action that blocks merges in CI.</LI>
      </UL>

      <H2>One audit, end to end</H2>
      <Mermaid chart={FLOW} />
      <P>
        Static analysis and the critic cascade run in parallel. A ChainGPT pre-screen feeds two
        architecturally-distinct critics — Groq Llama-3.3-70B and OpenAI GPT-OSS-120B (both served on
        Groq&apos;s LPU) — that cross-validate each other; Gemini 2.5 Pro is an optional third critic,
        off by default. Alongside them run Slither + Aderyn with our 16 custom detectors, and a
        98-pattern exploit corpus. A ChainGPT pre-screen failure is non-fatal — the critics still run.
        The cascade never false-cleans: if nothing could analyze a contract — say a single{" "}
        <Code>.sol</Code> file with unresolved imports that won&apos;t compile and no model response —
        the verdict is flagged <Code>analysisIncomplete</Code> and reported as &ldquo;could not complete
        the audit,&rdquo; never as <Code>safe</Code> or 100/100. Single-contract audits run the full
        critic cascade by default (thorough), not a quick pre-screen-only pass.
      </P>
      <P>
        <strong>Cross-validation is the moat.</strong> A reported finding has to survive corroboration:
        it needs <strong>≥2 independent sources</strong> — two models, or a model plus Slither — or it
        is dropped. A single-model hunch never reaches the verdict. When the same issue is flagged by
        several engines, the consensus scorer dedups it (by line overlap) into <strong>one finding that
        lists every source</strong> — e.g. <Code>Reentrancy — flagged by chaingpt, groq, gpt-oss,
        slither</Code> — boosts confidence on the corroborated finding, floors single-model findings, and
        culls anything below 20% confidence.
      </P>
      <P>
        <strong>Multilingual reports.</strong> The audit runs in English, then Tencent Hunyuan
        (its Hunyuan-MT model on Tencent Cloud TokenHub) translates the finished verdict and findings
        into the reader&apos;s language — zh, es, ja, ko, fr, pt, de, ru, it, ar, hi, vi, th, tr.
        On <Code>@tryannealbot</Code>: <Code>/audit &lt;url|address&gt; &lt;lang&gt;</Code>
        (e.g. <Code>/audit 0x… zh</Code>); on the web <Code>/try</Code> page, language chips under
        each result translate it in one click. Translation is credited to Tencent Hunyuan.
      </P>
      <P>
        <strong>Deterministic, reproducible audits.</strong> AI audits have a reputation for being
        non-deterministic — ask twice, get two answers. TryAnneal&apos;s verdict is reproducible: the
        same contract always returns the same result, run to run. Every model decodes at temperature 0
        (greedy, seeded), so each pass is identical; the corroboration rule above keeps a single-model
        hunch from ever drifting the verdict; scoring is confidence-weighted; and both the Telegram bot
        and the hosted MCP memoize by code hash (keccak/sha3 of the source), so identical source returns
        the identical audit.
      </P>

      <H2>Trust model</H2>
      <UL>
        <LI>No single LLM is trusted — Slither/Aderyn cross-validate every flagged line, and ≥2-model agreement raises confidence.</LI>
        <LI>Findings are encrypted; only the verdict score + severity counts are public on-chain. Destroying the key crypto-shreds the report.</LI>
        <LI>Verdicts carry the posting <Code>agentId</Code> — consumers weight by on-chain reputation, never blind trust.</LI>
      </UL>

      <PageNav prev={{ title: "Quickstart", href: "/docs/quickstart" }} next={{ title: "For agents", href: "/docs/agents" }} />
    </article>
  );
}
