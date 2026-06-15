import { json, notFound, serverError } from "../../_lib";
import { getAudit } from "../../../../src/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ hash: string }> }) {
  try {
    const { hash } = await params;
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      return notFound("invalid codeHash — expected 0x-prefixed 32-byte hex");
    }
    const audit = await getAudit(hash);
    if (!audit) return notFound("audit not found");
    return json(audit);
  } catch (err) {
    return serverError(err);
  }
}
