import { timingSafeEqual } from "node:crypto";
import { json } from "../_lib";
import { runSyncNow } from "../../../src/lib/store";

export const dynamic = "force-dynamic";

function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Force an indexer pass. Protected by SYNC_SECRET — pass it as
 * `Authorization: Bearer <secret>` or `?key=<secret>`. Wire a Railway cron to
 * this route for deterministic refresh; the background interval already keeps
 * the store warm between calls.
 */
async function handle(req: Request): Promise<Response> {
  const secret = process.env.SYNC_SECRET;
  if (!secret) return json({ ok: false, error: "sync disabled (SYNC_SECRET unset)" }, 403);

  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("key");
  if (!provided || !secretsMatch(provided, secret)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const result = await runSyncNow();
  return json(result, result.ok ? 200 : 502);
}

export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}
