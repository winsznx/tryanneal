import { AgentsFileSchema, json, notFound, readJson, serverError } from "../../_lib";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const agents = await readJson("agents.json", AgentsFileSchema);
    const agent = agents[id];
    if (!agent) return notFound(`agent ${id} not found`);
    return json(agent);
  } catch (err) {
    return serverError(err);
  }
}
