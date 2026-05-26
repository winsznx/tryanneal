import { AuditsFileSchema, json, notFound, readJson, serverError } from "../../_lib";

export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await params;
    const { audits } = await readJson("audits.json", AuditsFileSchema);
    const audit = audits.find((a) => a.codeHash.toLowerCase() === hash.toLowerCase());
    if (!audit) return notFound(`audit ${hash} not found`);
    return json(audit);
  } catch (err) {
    return serverError(err);
  }
}
