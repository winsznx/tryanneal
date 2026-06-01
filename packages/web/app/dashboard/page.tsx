import Nav from "../../src/components/nav";
import Footer from "../../src/components/footer";
import DashboardClient from "./dashboard-client";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AgentsFileSchema, AuditsFileSchema, StakingSchema } from "../api/_lib";

async function getData() {
  const [agentsRaw, auditsRaw, stakingRaw] = await Promise.all([
    readFile(resolve(process.cwd(), "public/data/agents.json"), "utf8"),
    readFile(resolve(process.cwd(), "public/data/audits.json"), "utf8"),
    readFile(resolve(process.cwd(), "public/data/staking.json"), "utf8"),
  ]);
  const agents = AgentsFileSchema.parse(JSON.parse(agentsRaw));
  const { audits } = AuditsFileSchema.parse(JSON.parse(auditsRaw));
  const staking = StakingSchema.parse(JSON.parse(stakingRaw));
  return { agent: agents["42"]!, audits, staking };
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
