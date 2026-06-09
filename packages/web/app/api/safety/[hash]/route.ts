/**
 * GET /api/safety/{codeHash}
 *
 * Path-param shape of the safety oracle — matches the curl examples in the
 * docs ("cast keccak <code> | xargs -I{} curl /api/safety/{}").
 */
import {
  buildNoVerdict,
  buildSafetyVerdict,
  corsHeaders,
  normalizeCodeHash,
  readVerdict,
  resolveNetwork,
} from "../_safety";

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;
  const codeHash = normalizeCodeHash(hash);
  if (!codeHash) {
    return json(
      {
        error: "Invalid codeHash. Expected 0x-prefixed 32-byte hex.",
        received: hash,
      },
      400,
    );
  }
  const network = resolveNetwork(new URL(req.url).searchParams.get("network"));
  try {
    const record = await readVerdict(codeHash, network);
    if (!record) return json(buildNoVerdict(codeHash, network), 404);
    return json(buildSafetyVerdict(record, network));
  } catch (err) {
    return json({ error: (err as Error).message ?? "rpc failure" }, 502);
  }
}
