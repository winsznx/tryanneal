import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Nav from "../../../src/components/nav";
import Footer from "../../../src/components/footer";
import AuditDetailClient from "./audit-detail-client";
import { AuditsFileSchema } from "../../api/_lib";
import { getAudit } from "../../../src/lib/store";

// Seed hashes are prebuilt; anything the indexer discovers later renders on demand.
export const revalidate = 30;

export async function generateStaticParams() {
  const raw = await readFile(resolve(process.cwd(), "public/data/audits.json"), "utf8");
  const { audits } = AuditsFileSchema.parse(JSON.parse(raw));
  return audits.map((a) => ({ hash: a.codeHash }));
}

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const audit = await getAudit(hash);
  if (!audit) notFound();

  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen bg-deep-space">
        <AuditDetailClient audit={audit} />
      </main>
      <Footer />
    </>
  );
}
