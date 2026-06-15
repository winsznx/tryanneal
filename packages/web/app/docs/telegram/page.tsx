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
          [<Code key="c">/audit &lt;url|0xAddress&gt;</Code>, "Fetch a .sol from a GitHub raw URL, or verified source from a contract address, and audit it"],
          [<Code key="c">/gas &lt;0xAddress&gt;</Code>, "Arsia 3-component gas profile"],
          [<Code key="c">/check &lt;codeHash&gt;</Code>, "Read the on-chain verdict"],
          [<Code key="c">/help</Code>, "Usage"],
        ]}
      />
      <P>Long audits send a “⏳ Auditing…” message first, then edit it with the result. Hard timeout 60s.</P>

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
