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
  annealAgentContract: z.string().nullish(),
  annealValidationContract: z.string().nullish(),
  agentURI: z.string(),
  wallet: z.string(),
  registeredAt: z.string(),
  network: z.string().nullish(),
  chainId: z.number().nullish(),
  tvlProtected: z.number().optional(),
  identityRegistry: z
    .object({
      address: z.string(),
      registered: z.boolean().nullish(),
      registeredAgentId: z.number().nullish(),
      registerTx: z.string().nullish(),
    })
    .nullish(),
  reputation: z.object({
    totalAudits: z.number(),
    correctAudits: z.number(),
    accuracy: z.number(),
    slashEvents: z.number(),
    stakedAmount: z.string(),
  }),
});

export const AgentsFileSchema = z.record(z.string(), AgentSchema);

export const FindingSchema = z.object({
  id: z.string(),
  severity: z.enum(["critical", "high", "medium", "low", "informational"]),
  title: z.string(),
  description: z.string(),
  lineNumber: z.number().nullish(),
  confidence: z.number(),
  recommendation: z.string().nullish(),
});

// Display-only schema. Real audit output may omit the per-component fees
// (only deployment totals are always present), so the breakdown fields are
// tolerant — a missing field renders as "—" in the UI, never a build error.
export const GasReportSchema = z.object({
  deploymentGas: z.number(),
  deploymentCostUSD: z.number(),
  deploymentCostMNT: z.string().nullish(),
  // Real engine output is MNT-denominated (wei strings). Older fee fields kept
  // nullish for back-compat with any pre-existing records.
  l2ExecutionMNT: z.string().nullish(),
  l1DataMNT: z.string().nullish(),
  operatorMNT: z.string().nullish(),
  fnTotalMNT: z.string().nullish(),
  functionCount: z.number().nullish(),
  l2ExecutionFee: z.number().nullish(),
  l1DataFee: z.number().nullish(),
  operatorFee: z.number().nullish(),
  optimizationHint: z.string().nullish(),
});

export const LLMConsensusEntrySchema = z.object({
  findingId: z.string(),
  models: z.array(z.object({ name: z.string(), agreed: z.boolean() })),
  confidence: z.number(),
});

export const AuditSchema = z.object({
  codeHash: z.string(),
  agentId: z.number(),
  contractName: z.string().optional(),
  verdictScore: z.number(),
  criticalCount: z.number(),
  highCount: z.number(),
  mediumCount: z.number(),
  lowCount: z.number(),
  reportURI: z.string(),
  network: z.string(),
  timestamp: z.string(),
  txHash: z.string(),
  mantlescanUrl: z.string().nullish(),
  contractDescription: z.string().nullish(),
  findings: z.array(FindingSchema).optional(),
  gasReport: GasReportSchema.optional(),
  llmConsensus: z.array(LLMConsensusEntrySchema).optional(),
});

export type Audit = z.infer<typeof AuditSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type GasReport = z.infer<typeof GasReportSchema>;
export type Agent = z.infer<typeof AgentSchema>;

export const AuditsFileSchema = z.object({ audits: z.array(AuditSchema) });

export const StakingSchema = z.object({
  network: z.string().nullish(),
  chainId: z.number().nullish(),
  contract: z.string(),
  mantlescanUrl: z.string().nullish(),
  stakeToken: z.string(),
  stakeTokenSymbol: z.string().nullish(),
  totalStaked: z.string(),
  totalStakers: z.number(),
  minStake: z.string(),
  cooldownDays: z.number().nullish(),
  slashBasisPoints: z.number(),
  maxSlashBasisPoints: z.number(),
  feeSplit: z.object({ auditor: z.number(), stakers: z.number(), treasury: z.number() }),
  treasury: z.string().nullish(),
  apy: z.string(),
  state: z.string().nullish(),
});

export type Staking = z.infer<typeof StakingSchema>;
