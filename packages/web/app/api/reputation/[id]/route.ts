import { AgentsFileSchema, AuditsFileSchema, json, notFound, readJson, serverError } from "../../_lib";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agents = await readJson("agents.json", AgentsFileSchema);
    const agent = agents[id];
    if (!agent) return notFound(`agent ${id} not found`);

    const { audits } = await readJson("audits.json", AuditsFileSchema);
    const own = audits.filter((a) => a.agentId === Number(id));
    const series = own
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((a) => ({ timestamp: a.timestamp, verdictScore: a.verdictScore, codeHash: a.codeHash }));

    return json({
      agentId: Number(id),
      summary: agent.reputation,
      series,
    });
  } catch (err) {
    return serverError(err);
  }
}
