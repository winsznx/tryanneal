/**
 * POST /api/audit  — run a full audit on pasted/uploaded Solidity.
 *
 * The web image is intentionally Slither-free, so this proxies to the hosted
 * TryAnneal MCP server (which runs Slither + the corpus) via its Streamable
 * HTTP transport, and returns the parsed verdict. Rate-limited per IP.
 */
import { clientIp, corsHeaders, rateLimit } from "../safety/_safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MCP_URL = process.env.MCP_URL ?? "https://mcp.tryanneal.xyz/mcp";
const MAX_SOURCE_BYTES = 200_000;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...corsHeaders() },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/** Parse a Streamable-HTTP (SSE) MCP response → the tool's JSON result. */
function parseMcp(text: string): unknown {
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  const payload = JSON.parse((line ? line.slice(5) : text).trim());
  if (payload.error) throw new Error(payload.error.message ?? "MCP error");
  const content = payload.result?.content?.[0]?.text;
  return content ? JSON.parse(content) : payload.result;
}

export async function POST(req: Request): Promise<Response> {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) return json({ error: "Rate limited — 1 audit / 5 min.", retryAfterSeconds: rl.retryAfterSeconds }, 429);

  let body: { sourceCode?: string };
  try {
    body = (await req.json()) as { sourceCode?: string };
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  const sourceCode = (body.sourceCode ?? "").trim();
  if (!sourceCode) return json({ error: "sourceCode required." }, 400);
  if (Buffer.byteLength(sourceCode, "utf8") > MAX_SOURCE_BYTES) return json({ error: "Source too large (200KB max)." }, 413);
  if (!/\bcontract\b|\binterface\b|\blibrary\b/.test(sourceCode)) return json({ error: "That doesn't look like Solidity." }, 400);

  try {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "audit_contract", arguments: { sourceCode } },
      }),
      signal: AbortSignal.timeout(110_000),
    });
    if (!res.ok) return json({ error: `audit service ${res.status}` }, 502);
    const result = parseMcp(await res.text());
    return json(result);
  } catch (err) {
    return json({ error: (err as Error).message ?? "audit failed" }, 502);
  }
}
