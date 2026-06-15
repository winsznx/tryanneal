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
      <Pre lang="bash">{`pnpm install
pnpm --filter @tryanneal/engine build

# Static analysis needs slither + solc on PATH (see SLITHER_SETUP.md)
pnpm --filter @tryanneal/cli start audit \\
  packages/contracts/contracts/audit-targets/SampleVault.sol --no-llm`}</Pre>
      <Callout>
        For the full critic cascade, set <Code>CHAINGPT_API_KEY</Code> (pre-screen),{" "}
        <Code>GEMINI_API_KEY</Code> and <Code>GROQ_API_KEY</Code> (critics). Set{" "}
        <Code>HUNYUAN_API_KEY</Code> for multilingual reports — Tencent Hunyuan translates the finished
        verdict into the reader&apos;s language. All optional — without them the engine runs static +
        corpus only.
      </Callout>

      <PageNav prev={{ title: "Overview", href: "/docs" }} next={{ title: "Architecture", href: "/docs/architecture" }} />
    </article>
  );
}
