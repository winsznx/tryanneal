import { DocTitle, Lead, H2, P, A, UL, LI, Code, Table, Callout, PageNav } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Telegram" };

export default function TelegramDocs() {
  return (
    <article>
      <DocTitle eyebrow="Use it">Telegram</DocTitle>
      <Lead>
        Audit from chat — no terminal, no install. <A href="https://t.me/tryannealbot">@tryannealbot</A>{" "}
        gives you a command bot and a Mini App, both backed by the same engine and on-chain registry.
      </Lead>

      <H2>Mini App</H2>
      <P>
        Tap the bot’s menu button (“Open TryAnneal”) to launch the <A href="/miniapp">Mini App</A> — a
        mobile-native safety oracle. Pick an example or paste a code hash; read a live verdict straight
        from Mantle, inside Telegram.
      </P>

      <H2>Commands</H2>
      <Table
        head={["Command", "What it does"]}
        rows={[
          [<Code key="c">/audit &lt;url|0xAddress&gt; [lang]</Code>, "Fetch a .sol from a GitHub raw URL, or verified source from a contract address, run the full cascade, and audit it — append a language code (e.g. zh) for a translated report"],
          [<Code key="c">/gas &lt;0xAddress&gt;</Code>, "Arsia 3-component gas profile"],
          [<Code key="c">/check &lt;codeHash&gt;</Code>, "Read the on-chain is_this_safe verdict — SAFE/UNSAFE + 0–100 score"],
          [<Code key="c">/help</Code>, "Usage"],
        ]}
      />
      <P>Long audits send a “⏳ Auditing…” message first, then edit it with the result. Hard timeout 60s.</P>

      <H2>Multilingual reports</H2>
      <P>
        Append a language code to <Code>/audit</Code> — e.g. <Code>/audit 0x… zh</Code> — to get the verdict and
        findings translated. The audit always runs in English; the finished report is then translated by Tencent
        Hunyuan (its Hunyuan-MT model on Tencent Cloud TokenHub). Supported languages include{" "}
        <Code>zh</Code>, <Code>es</Code>, <Code>ja</Code>, <Code>ko</Code>, <Code>fr</Code>, <Code>pt</Code>,{" "}
        <Code>de</Code>, <Code>ru</Code>, <Code>it</Code>, <Code>ar</Code>, <Code>hi</Code>, <Code>vi</Code>,{" "}
        <Code>th</Code>, and <Code>tr</Code>. On the <A href="/try">web /try page</A>, language chips under each
        result translate it in one click.
      </P>

      <H2>The cascade behind it</H2>
      <P>
        Every <Code>/audit</Code> runs the full critic cascade by default (thorough, not a quick pre-screen-only
        pass): ChainGPT pre-screens, then two architecturally-distinct critics — Groq Llama-3.3-70B and OpenAI
        GPT-OSS-120B — run as independent Stage-2 critics that cross-validate each other (Gemini 2.5 Pro is an
        optional third critic, off by default), alongside Slither + Aderyn + 16 custom detectors and a 98-pattern /
        $7.1B corpus for static cross-validation. The cascade is
        resilient — a ChainGPT pre-screen failure is non-fatal and the critics still run. If nothing could analyze
        a contract (for example a single <Code>.sol</Code> file with unresolved imports that won’t compile and no
        model response), the verdict is flagged <Code>analysisIncomplete</Code> and is never reported as “safe” or
        “100/100” — it says it could not complete the audit.
      </P>
      <P>
        AI audits are usually non-deterministic — TryAnneal’s verdict is reproducible. The same contract always
        returns the same verdict: every model decodes at temperature 0 (greedy, seeded), a corroboration rule
        requires any reported finding to have ≥2 independent sources (≥2 models, or a model + Slither, when the
        full panel runs) so single-model hunches don’t drive the verdict, scoring is confidence-weighted, and
        results are memoized by code hash (<Code>keccak/sha3</Code> of the source) on the bot — identical source
        returns the identical audit.
      </P>

      <H2>On-chain attestation</H2>
      <P>
        Verdicts are posted on-chain to <Code>AnnealValidation</Code> as ERC-8004 agent #131 — idempotently, and
        for both verified-address and GitHub-source audits (for GitHub sources the{" "}
        <Code>codeHash = keccak(source)</Code>). The bot resolves an address across Mantle, Ethereum, Base,
        Arbitrum, Optimism, BNB, Polygon, and Avalanche using <Code>eth_getCode</Code> as the ground truth for
        where a contract is actually deployed (not the explorer’s response); verified source is then fetched via
        the Etherscan V2 multichain API.
      </P>

      <H2>Channel-native UX</H2>
      <UL>
        <LI>No terminal, no wallet pop-ups to read a verdict — Web2 users get a real security answer in a chat.</LI>
        <LI>The Mini App is the same web safety-oracle, themed for Telegram and launched in one tap.</LI>
      </UL>
      <Callout>Bot username: <Code>@tryannealbot</Code>. The Mini App is served at <Code>tryanneal.xyz/miniapp</Code>.</Callout>

      <PageNav prev={{ title: "MCP Server", href: "/docs/mcp" }} next={{ title: "Detectors & Corpus", href: "/docs/detectors" }} />
    </article>
  );
}
