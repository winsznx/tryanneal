/**
 * GET /api/safety?codeHash=0x...&network=mantle-sepolia
 *
 * Read the on-chain verdict from AnnealValidation. The other GET form
 * (path-param) lives at /api/safety/[hash]/route.ts.
 */
import {
  buildNoVerdict,
  buildSafetyVerdict,
  corsHeaders,
  normalizeCodeHash,
  readVerdict,
  resolveNetwork,
} from "./_safety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 30;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=30, s-maxage=30",
      ...corsHeaders(),
    },
  });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const rawHash = url.searchParams.get("codeHash") ?? url.searchParams.get("hash");
  const codeHash = normalizeCodeHash(rawHash);
  if (!codeHash) {
    return json(
      {
        error: "codeHash missing or malformed — expected 0x-prefixed 32-byte hex",
        example: "/api/safety?codeHash=0xb8847a37ce8437d01189686090f93af466e4eaa5e5fe3de7ba2579338e85e7b0",
      },
      400,
    );
  }
  const network = resolveNetwork(url.searchParams.get("network"));
  try {
    const record = await readVerdict(codeHash, network);
    if (!record) return json(buildNoVerdict(codeHash, network), 404);
    const verdict = buildSafetyVerdict(record, network);
    return json({
      ...verdict,
      txHash: undefined, // path-param route emits the tx; querystring form keeps the payload minimal
    });
  } catch (err) {
    return json({ error: (err as Error).message ?? "rpc failure" }, 502);
  }
}
