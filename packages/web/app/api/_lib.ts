import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

const DATA_ROOT = resolve(process.cwd(), "public/data");

export async function readJson<T>(name: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(resolve(DATA_ROOT, name), "utf8");
  return schema.parse(JSON.parse(raw));
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=30",
    },
  });
}

export function notFound(message: string): Response {
  return json({ error: message }, 404);
}

export function serverError(err: unknown): Response {
  return json({ error: (err as Error).message ?? "internal error" }, 500);
}

// === Schemas ===

export const AgentSchema = z.object({
  agentId: z.number(),
  owner: z.string(),
  agentURI: z.string(),
  wallet: z.string(),
  registeredAt: z.string(),
  reputation: z.object({
    totalAudits: z.number(),
    correctAudits: z.number(),
    accuracy: z.number(),
    slashEvents: z.number(),
    stakedAmount: z.string(),
  }),
});

export const AgentsFileSchema = z.record(z.string(), AgentSchema);

export const AuditSchema = z.object({
  codeHash: z.string(),
  agentId: z.number(),
  verdictScore: z.number(),
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  reportURI: z.string(),
  network: z.string(),
  timestamp: z.string(),
  txHash: z.string(),
});

export const AuditsFileSchema = z.object({ audits: z.array(AuditSchema) });

export const StakingSchema = z.object({
  contract: z.string(),
  stakeToken: z.string(),
  totalStaked: z.string(),
  totalStakers: z.number(),
  minStake: z.string(),
  slashBasisPoints: z.number(),
  maxSlashBasisPoints: z.number(),
  feeSplit: z.object({ auditor: z.number(), stakers: z.number(), treasury: z.number() }),
  apy: z.string(),
});
