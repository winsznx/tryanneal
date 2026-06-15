# @tryanneal/mcp — TryAnneal as an MCP server

The `is_this_safe()` primitive, exposed over the **Model Context Protocol** so
**any** AI agent — Claude Desktop, Cursor, Claude Code, a custom agent — can
check a contract's safety before composing with it, and read the verdict
straight from the on-chain registry on Mantle.

This is the agent-economy thesis made literal: an audit agent other agents
call, not just a website.

## Tools

| tool | what it does | needs |
|---|---|---|
| `is_this_safe(target, network)` | On-chain verdict lookup. `target` = a 32-byte code hash **or** a deployed contract address (its verified source is fetched + hashed). Returns safe/unsafe, score, severity counts, attesting ERC-8004 agent. | nothing (public RPC) |
| `audit_contract(sourceCode, contractName?, network?)` | Full audit — Slither + Aderyn + the multi-LLM cascade + the 113-pattern corpus. Returns score, findings, corpus context. | `slither` on PATH; LLM keys optional |
| `tryanneal_corpus_stats()` | Stats of the exploit corpus every audit cross-references (113 patterns, $10.1B, 2020–2026, 13 chains). | nothing |

## Install & build

```bash
pnpm install
pnpm --filter @tryanneal/engine build
pnpm --filter @tryanneal/mcp build
# optional, for audit_contract: slither + solc 0.8.24 on PATH
```

## Wire it into a client

### Claude Desktop / Claude Code

`claude_desktop_config.json` (or `.mcp.json` in a project for Claude Code):

```json
{
  "mcpServers": {
    "tryanneal": {
      "command": "node",
      "args": ["/absolute/path/to/tryanneal/packages/mcp/dist/index.js"],
      "env": {
        "MANTLESCAN_API_KEY": "optional — bumps the verified-source fetch quota",
        "CHAINGPT_API_KEY": "optional — enables the LLM cascade in audit_contract",
        "GEMINI_API_KEY": "optional",
        "GROQ_API_KEY": "optional",
        "HUNYUAN_API_KEY": "optional — Tencent Cloud critic",
        "HUNYUAN_BASE_URL": "https://tokenhub-intl.tencentcloudmaas.com/v1",
        "HUNYUAN_MODEL": "hy-mt2-plus"
      }
    }
  }
}
```

### Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "tryanneal": { "command": "node", "args": ["/absolute/path/to/packages/mcp/dist/index.js"] }
  }
}
```

## What it looks like

> **agent:** is `0xfe32c438…` safe on mantle?
> **tool `is_this_safe`:**
> ```json
> { "safe": true, "score": 100, "attestedByAgentId": 131,
>   "registry": "0xf02C982D19184c11b86BC34672441C45fBF0f93E",
>   "recommendation": "No critical/high findings on record…" }
> ```

The verdict is read live from `AnnealValidation` on Mantle mainnet — posted by
TryAnneal's ERC-8004 agent (#131). Any agent, any client, one tool call.

## Notes

- `is_this_safe` and `tryanneal_corpus_stats` are pure reads — no keys, no
  Slither. They always work.
- `audit_contract` runs the real engine, so it needs `slither` on PATH; LLM
  keys turn on the cascade (otherwise it degrades to static + corpus).
- stdout is the MCP channel; the server logs only to stderr.
