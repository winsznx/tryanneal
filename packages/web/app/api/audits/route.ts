import { AuditsFileSchema, json, readJson, serverError } from "../_lib";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    const { audits } = await readJson("audits.json", AuditsFileSchema);
    const start = (page - 1) * limit;
    return json({
      page,
      limit,
      total: audits.length,
      audits: audits.slice(start, start + limit),
    });
  } catch (err) {
    return serverError(err);
  }
}
