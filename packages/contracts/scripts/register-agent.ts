import { ethers, network } from "hardhat";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const IDENTITY_REGISTRY_MANTLE = "0x8004A3718bD35CF767BC0E718bf21Ec4073502f0";
const DEFAULT_AGENT_URI = "ipfs://tryanneal/agent.json";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — set DEPLOYER_PRIVATE_KEY in .env");

  const registryAddr = process.env.IDENTITY_REGISTRY ?? IDENTITY_REGISTRY_MANTLE;
  const agentURI = process.env.AGENT_URI ?? DEFAULT_AGENT_URI;

  console.log(`network:   ${network.name}`);
  console.log(`deployer:  ${deployer.address}`);
  console.log(`registry:  ${registryAddr}`);
  console.log(`agentURI:  ${agentURI}`);

  // 1. Deploy AnnealAgent
  const Factory = await ethers.getContractFactory("AnnealAgent");
  console.log("\ndeploying AnnealAgent…");
  const agent = await Factory.deploy(registryAddr, deployer.address);
  await agent.waitForDeployment();
  const agentAddr = await agent.getAddress();
  console.log(`AnnealAgent deployed at ${agentAddr}`);

  // 2. Call registerAgent — this is the first real on-chain interaction with
  //    the ERC-8004 Identity Registry. If the interface or registry differs
  //    from spec, this is where we discover it.
  console.log("\ncalling registerAgent()…");
  let agentId: bigint;
  let txHash: string;
  let blockNumber: number;
  try {
    const tx = await agent.registerAgent(agentURI);
    const receipt = await tx.wait();
    if (!receipt) throw new Error("no receipt");
    txHash = receipt.hash;
    blockNumber = receipt.blockNumber;
    agentId = await agent.agentId();
    console.log(`✓ registered`);
    console.log(`  agentId:     ${agentId.toString()}`);
    console.log(`  txHash:      ${txHash}`);
    console.log(`  blockNumber: ${blockNumber}`);
  } catch (err: unknown) {
    const e = err as { message?: string; data?: string; shortMessage?: string; code?: string };
    console.error("\n✗ registerAgent failed");
    console.error(`  code:    ${e.code ?? "n/a"}`);
    console.error(`  short:   ${e.shortMessage ?? "n/a"}`);
    console.error(`  message: ${e.message ?? String(err)}`);
    if (e.data) console.error(`  data:    ${e.data}`);
    console.error("\nlikely causes: registry interface mismatch, registry not deployed on this chain, insufficient gas, or owner mismatch.");
    process.exitCode = 1;
    return;
  }

  // 3. Persist deployment info
  const outPath = resolve(__dirname, `../deployments/${network.name}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  const payload = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    identityRegistry: registryAddr,
    annealAgent: agentAddr,
    agentId: agentId.toString(),
    agentURI,
    txHash,
    blockNumber,
    timestamp: new Date().toISOString(),
  };
  await writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`\ndeployment saved → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
