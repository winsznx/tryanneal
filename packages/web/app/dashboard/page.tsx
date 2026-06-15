import Nav from "../../src/components/nav";
import Footer from "../../src/components/footer";
import DashboardClient from "./dashboard-client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AgentsFileSchema, StakingSchema } from "../api/_lib";
import { getAudits } from "../../src/lib/store";

// Read the DB-backed store on a 30s ISR cadence — the indexer keeps the store
// fresh in the background, so page loads never block on RPC.
export const revalidate = 30;

async function getData() {
  const [agentsRaw, stakingRaw, audits] = await Promise.all([
    readFile(resolve(process.cwd(), "public/data/agents.json"), "utf8"),
    readFile(resolve(process.cwd(), "public/data/staking.json"), "utf8"),
    getAudits(),
  ]);
  const agents = AgentsFileSchema.parse(JSON.parse(agentsRaw));
  const staking = StakingSchema.parse(JSON.parse(stakingRaw));
  // TryAnneal is agentId 131 on Mantle mainnet. Fall back to the first
  // available agent so the dashboard never crashes if the key set changes.
  const agent = agents["131"] ?? Object.values(agents)[0]!;
  return { agent, audits, staking };
}

export default async function DashboardPage() {
  const { agent, audits, staking } = await getData();
  return (
    <>
      <Nav />
      <main className="pt-14 min-h-screen bg-deep-space">
        <DashboardClient agent={agent} audits={audits} staking={staking} />
      </main>
      <Footer />
    </>
  );
}
