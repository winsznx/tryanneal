import { ethers, network, run } from "hardhat";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const IDENTITY_REGISTRY = "0x8004A3718bD35CF767BC0E718bf21Ec4073502f0";
const AGENT_URI = process.env.AGENT_URI ?? "ipfs://tryanneal/agent.json";

interface DeployRecord {
  address?: string;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  verified?: boolean;
  mantlescanUrl?: string;
  status?: "ok" | "failed";
  error?: string;
  extra?: Record<string, unknown>;
}

interface DeploymentManifest {
  network: string;
  chainId: number;
  deployer: string;
  deployedAt: string;
  identityRegistry: { address: string; agentId?: string; status: "ok" | "failed"; error?: string; txHash?: string };
  annealAgent: DeployRecord;
  annealValidation: DeployRecord;
  annealStaking: DeployRecord;
  stakeToken: DeployRecord;
}

const MANTLESCAN_BASE: Record<string, string> = {
  mantleSepolia: "https://sepolia.mantlescan.xyz/address/",
  mantleMainnet: "https://mantlescan.xyz/address/",
};

async function tryVerify(address: string, constructorArguments: unknown[] = []): Promise<boolean> {
  try {
    await run("verify:verify", { address, constructorArguments });
    return true;
  } catch (err: unknown) {
    const msg = (err as Error).message ?? String(err);
    if (/already verified/i.test(msg)) return true;
    console.warn(`  verify skipped: ${msg.split("\n")[0]}`);
    return false;
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) throw new Error("No signer — set DEPLOYER_PRIVATE_KEY in .env");

  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  console.log(`network:  ${network.name} (chainId ${chainId})`);
  console.log(`deployer: ${deployer.address}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`balance:  ${ethers.formatEther(balance)} MNT\n`);

  const manifest: DeploymentManifest = {
    network: network.name,
    chainId,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    identityRegistry: { address: IDENTITY_REGISTRY, status: "failed" },
    annealAgent: { status: "failed" },
    annealValidation: { status: "failed" },
    annealStaking: { status: "failed" },
    stakeToken: { status: "failed" },
  };

  // === 1. AnnealAgent + Identity Registry ===
  console.log("[1/3] AnnealAgent → ERC-8004 Identity Registry");
  try {
    const Agent = await ethers.getContractFactory("AnnealAgent");
    const agent = await Agent.deploy(IDENTITY_REGISTRY, deployer.address);
    const dep = await agent.deploymentTransaction()?.wait();
    const agentAddr = await agent.getAddress();
    console.log(`  AnnealAgent: ${agentAddr} (gas ${dep?.gasUsed.toString()})`);
    manifest.annealAgent = {
      address: agentAddr,
      txHash: dep?.hash,
      blockNumber: dep?.blockNumber,
      gasUsed: dep?.gasUsed.toString(),
      mantlescanUrl: MANTLESCAN_BASE[network.name] ? MANTLESCAN_BASE[network.name] + agentAddr : undefined,
      status: "ok",
      verified: await tryVerify(agentAddr, [IDENTITY_REGISTRY, deployer.address]),
    };

    console.log(`  calling registerAgent(${AGENT_URI})…`);
    try {
      const tx = await agent.registerAgent(AGENT_URI);
      const rcpt = await tx.wait();
      const agentId = (await agent.agentId()).toString();
      manifest.identityRegistry = {
        address: IDENTITY_REGISTRY,
        agentId,
        status: "ok",
        txHash: rcpt?.hash,
      };
      console.log(`  ✓ registered as agentId ${agentId}`);
    } catch (err) {
      const e = err as { shortMessage?: string; message?: string };
      manifest.identityRegistry.error = e.shortMessage ?? e.message ?? String(err);
      console.warn(`  ✗ registerAgent failed: ${manifest.identityRegistry.error}`);
      console.warn(`    continuing with remaining deploys…`);
    }
  } catch (err) {
    manifest.annealAgent.error = (err as Error).message;
    console.warn(`  ✗ AnnealAgent deploy failed: ${manifest.annealAgent.error}`);
  }

  // === 2. AnnealValidation ===
  console.log("\n[2/3] AnnealValidation");
  try {
    const F = await ethers.getContractFactory("AnnealValidation");
    const c = await F.deploy();
    const dep = await c.deploymentTransaction()?.wait();
    const addr = await c.getAddress();
    console.log(`  AnnealValidation: ${addr} (gas ${dep?.gasUsed.toString()})`);
    manifest.annealValidation = {
      address: addr,
      txHash: dep?.hash,
      blockNumber: dep?.blockNumber,
      gasUsed: dep?.gasUsed.toString(),
      mantlescanUrl: MANTLESCAN_BASE[network.name] ? MANTLESCAN_BASE[network.name] + addr : undefined,
      status: "ok",
      verified: await tryVerify(addr, []),
    };
  } catch (err) {
    manifest.annealValidation.error = (err as Error).message;
    console.warn(`  ✗ AnnealValidation deploy failed: ${manifest.annealValidation.error}`);
  }

  // === 3. AnnealStaking ===
  console.log("\n[3/3] AnnealStaking (+ MockERC20 if STAKE_TOKEN unset)");
  try {
    let tokenAddr = process.env.STAKE_TOKEN;
    if (!tokenAddr) {
      const Mock = await ethers.getContractFactory("MockERC20");
      const tok = await Mock.deploy();
      const tokDep = await tok.deploymentTransaction()?.wait();
      tokenAddr = await tok.getAddress();
      manifest.stakeToken = {
        address: tokenAddr,
        txHash: tokDep?.hash,
        blockNumber: tokDep?.blockNumber,
        gasUsed: tokDep?.gasUsed.toString(),
        mantlescanUrl: MANTLESCAN_BASE[network.name] ? MANTLESCAN_BASE[network.name] + tokenAddr : undefined,
        status: "ok",
        verified: await tryVerify(tokenAddr, []),
      };
      console.log(`  MockERC20: ${tokenAddr}`);
    } else {
      manifest.stakeToken = { address: tokenAddr, status: "ok", extra: { source: "STAKE_TOKEN env" } };
    }

    const minStake = process.env.MIN_STAKE ? ethers.parseEther(process.env.MIN_STAKE) : ethers.parseEther("100");
    const treasury = process.env.TREASURY ?? deployer.address;
    const Staking = await ethers.getContractFactory("AnnealStaking");
    const staking = await Staking.deploy(tokenAddr, minStake, treasury);
    const dep = await staking.deploymentTransaction()?.wait();
    const addr = await staking.getAddress();
    console.log(`  AnnealStaking: ${addr} (gas ${dep?.gasUsed.toString()})`);
    manifest.annealStaking = {
      address: addr,
      txHash: dep?.hash,
      blockNumber: dep?.blockNumber,
      gasUsed: dep?.gasUsed.toString(),
      mantlescanUrl: MANTLESCAN_BASE[network.name] ? MANTLESCAN_BASE[network.name] + addr : undefined,
      status: "ok",
      verified: await tryVerify(addr, [tokenAddr, minStake, treasury]),
      extra: { minStake: minStake.toString(), treasury },
    };
  } catch (err) {
    manifest.annealStaking.error = (err as Error).message;
    console.warn(`  ✗ AnnealStaking deploy failed: ${manifest.annealStaking.error}`);
  }

  // === Persist ===
  const outPath = resolve(__dirname, `../deployments/${network.name}.json`);
  await mkdir(dirname(outPath), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(outPath, "utf8"));
  } catch {
    // first deployment on this network
  }
  await writeFile(outPath, JSON.stringify({ ...existing, ...manifest }, null, 2));
  console.log(`\nsaved → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
