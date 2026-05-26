import { ethers, network } from "hardhat";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — set DEPLOYER_PRIVATE_KEY in .env");

  console.log(`network:  ${network.name}`);
  console.log(`deployer: ${deployer.address}`);

  const F = await ethers.getContractFactory("AnnealValidation");
  console.log("\ndeploying AnnealValidation…");
  const c = await F.deploy();
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`✓ AnnealValidation at ${addr}`);

  const outPath = resolve(__dirname, `../deployments/${network.name}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(outPath, "utf8"));
  } catch {
    // first deployment on this network
  }
  const payload = {
    ...existing,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    annealValidation: addr,
    annealValidationDeployer: deployer.address,
    annealValidationDeployedAt: new Date().toISOString(),
  };
  await writeFile(outPath, JSON.stringify(payload, null, 2));
  console.log(`deployment saved → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
