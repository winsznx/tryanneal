/**
 * Hosted TryAnneal MCP server — Streamable HTTP transport.
 *
 * Lets remote agents (Claude Desktop/Code custom connectors, Cursor, n8n, …)
 * configure TryAnneal by URL instead of spawning a local stdio process.
 * Stateless: a fresh MCP server + transport per request (the tools are
 * read-only / idempotent), so there's no session state to leak across callers.
 *
 *   POST /mcp   → JSON-RPC (the MCP channel)
 *   GET  /      → health + tool listing
 *
 * Endpoint config for clients:
 *   { "mcpServers": { "tryanneal": { "url": "https://<host>/mcp" } } }
 */
import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./index.js";

const PORT = Number(process.env.PORT ?? 8080);
const TOOLS = ["is_this_safe", "audit_contract", "tryanneal_corpus_stats"];

const httpServer = createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, mcp-protocol-version, Authorization, Accept");
  res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  const path = (req.url ?? "/").split("?")[0];

  if (req.method === "GET" && path === "/") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        name: "tryanneal-mcp",
        status: "ok",
        transport: "streamable-http",
        endpoint: "/mcp",
        tools: TOOLS,
        docs: "https://tryanneal.xyz/docs/mcp",
      }),
    );
    return;
  }

  if (path !== "/mcp") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found", endpoint: "/mcp" }));
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        res.on("close", () => void transport.close());
        const server = createMcpServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
      } catch (err) {
        if (!res.headersSent) {
          res.writeHead(500, { "content-type": "application/json" });
          res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: (err as Error).message }, id: null }));
        }
      }
    });
    return;
  }

  // Stateless mode has no server→client stream / session to GET or DELETE.
  res.writeHead(405, { "content-type": "application/json", Allow: "POST, OPTIONS" });
  res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Stateless server — use POST /mcp." }, id: null }));
});

httpServer.listen(PORT, () => {
  console.error(`TryAnneal MCP (Streamable HTTP) listening on :${PORT}  ·  POST /mcp  ·  tools: ${TOOLS.join(", ")}`);
});
