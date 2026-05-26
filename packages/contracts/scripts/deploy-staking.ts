import { ethers, network } from "hardhat";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const DEFAULT_MIN_STAKE = ethers.parseEther("100");

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — set DEPLOYER_PRIVATE_KEY in .env");
  const treasury = process.env.TREASURY ?? deployer.address;

  let tokenAddr = process.env.STAKE_TOKEN;
  if (!tokenAddr) {
    console.log("STAKE_TOKEN not set; deploying MockERC20…");
    const Mock = await ethers.getContractFactory("MockERC20");
    const tok = await Mock.deploy();
    await tok.waitForDeployment();
    tokenAddr = await tok.getAddress();
    console.log(`MockERC20: ${tokenAddr}`);
  }

  const Staking = await ethers.getContractFactory("AnnealStaking");
  const minStake = process.env.MIN_STAKE ? ethers.parseEther(process.env.MIN_STAKE) : DEFAULT_MIN_STAKE;
  console.log(`\ndeploying AnnealStaking (minStake=${ethers.formatEther(minStake)}, treasury=${treasury})…`);
  const staking = await Staking.deploy(tokenAddr, minStake, treasury);
  await staking.waitForDeployment();
  const addr = await staking.getAddress();
  console.log(`✓ AnnealStaking at ${addr}`);

  const outPath = resolve(__dirname, `../deployments/${network.name}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(outPath, "utf8"));
  } catch {}
  await writeFile(
    outPath,
    JSON.stringify(
      {
        ...existing,
        network: network.name,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        annealStaking: addr,
        stakeToken: tokenAddr,
        minStake: minStake.toString(),
        treasury,
        annealStakingDeployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(`saved → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
