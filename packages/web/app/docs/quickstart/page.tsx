import { DocTitle, Lead, H2, P, A, Pre, Callout, PageNav, Code } from "../../../src/components/doc";

export const metadata = { title: "TryAnneal Docs — Quickstart" };

export default function Quickstart() {
  return (
    <article>
      <DocTitle eyebrow="Getting started">Quickstart</DocTitle>
      <Lead>Three ways to get a verdict in under a minute — no install for the first two.</Lead>

      <H2>1. Query a live verdict (curl)</H2>
      <Pre lang="bash">{`curl "https://tryanneal.xyz/api/safety/0xfe32c438388a437a8a4e7e16fa377d1402e03de58133baba6c196477066818ab?network=mantle"
# → {"safe": true, "score": 100, "agentId": 131, ...}`}</Pre>

      <H2>2. Use the live oracle</H2>
      <P>Pick an example or paste a code hash on <A href="/#try">the home page</A>, or open the Mini App in Telegram via <A href="/docs/telegram">@tryannealbot</A>.</P>

      <H2>3. Run an audit locally</H2>
      <Pre lang="bash">{`# No install — run the published CLI from npm (static path needs slither + solc on PATH)
npx @tryanneal/cli audit ./Vault.sol --no-llm

# Or from a clone, against a bundled target (see SLITHER_SETUP.md)
pnpm install
pnpm --filter @tryanneal/engine build
pnpm --filter @tryanneal/cli start audit \\
  packages/contracts/contracts/audit-targets/SampleVault.sol --no-llm`}</Pre>
      <P>
        The static path is fully deterministic — Slither + the 16 TryAnneal detectors + the 98-pattern
        corpus, no API keys, the same contract always returns the same verdict.
      </P>
      <Callout>
        For the full critic cascade, set <Code>CHAINGPT_API_KEY</Code> (pre-screen) and{" "}
        <Code>GROQ_API_KEY</Code> — that one key serves both Stage-2 critics, Groq Llama-3.3-70B and
        OpenAI GPT-OSS-120B, which cross-validate each other. <Code>GEMINI_API_KEY</Code> enables an
        optional third critic (off by default). Set <Code>HUNYUAN_API_KEY</Code> for multilingual
        reports — Tencent Cloud Hunyuan translates the finished verdict and per-finding remediation into
        the reader&apos;s language (not a critic). All optional — without them the engine runs static +
        corpus only.
      </Callout>

      <H2>4. Gate your CI on it</H2>
      <P>
        Add <Code>--threshold &lt;score&gt;</Code> to make the CLI exit non-zero below a score, and drop
        the ready-made <A href="/docs/cli">GitHub Action</A> into your repo to block any PR whose changed
        contracts are high/critical or below threshold.
      </P>

      <PageNav prev={{ title: "Overview", href: "/docs" }} next={{ title: "Architecture", href: "/docs/architecture" }} />
    </article>
  );
}
