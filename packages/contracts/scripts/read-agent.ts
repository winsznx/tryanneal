import { ethers, network } from "hardhat";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function main() {
  const depPath = resolve(__dirname, `../deployments/${network.name}.json`);
  const dep = JSON.parse(await readFile(depPath, "utf8")) as {
    annealAgent: string;
    identityRegistry: string;
    agentId: string;
  };

  console.log(`network:        ${network.name}`);
  console.log(`AnnealAgent:    ${dep.annealAgent}`);
  console.log(`registry:       ${dep.identityRegistry}`);
  console.log(`agentId:        ${dep.agentId}`);

  const agent = await ethers.getContractAt("AnnealAgent", dep.annealAgent);

  const registered = await agent.registered();
  const onChainId = await agent.agentId();
  console.log(`\non-chain registered: ${registered}`);
  console.log(`on-chain agentId:    ${onChainId.toString()}`);

  try {
    const [agentURI, wallet] = await agent.readMetadata();
    console.log(`agentURI:            ${agentURI}`);
    console.log(`wallet:              ${wallet}`);
  } catch (err) {
    console.error(`\n✗ readMetadata failed: ${(err as Error).message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
