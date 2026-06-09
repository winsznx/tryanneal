/**
 * Decrypt each report saved by run-audits.ts, combine with the on-chain
 * verdict manifest, and emit the static JSON the Next.js dashboard reads:
 *   - packages/web/public/data/audits.json
 *   - packages/web/public/data/agents.json
 *   - packages/web/public/data/staking.json
 *
 * Run after run-audits.ts. Idempotent.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const CONTRACTS_ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(__dirname, "../../..");
const REPORTS_DIR = resolve(CONTRACTS_ROOT, process.env.REPORTS_DIR ?? "./reports");

const NETWORK = "mantleSepolia";

const CONTRACT_NAME_BY_PATH: Record<string, string> = {
  "SimpleToken.sol":   "Plain ERC20 reference contract",
  "SampleVault.sol":   "Reentrant withdrawal vault",
  "UnsafeOracle.sol":  "Oracle without freshness validation",
  "ProxyAdmin.sol":    "EIP-1967 upgradeable proxy fixture",
  "BatchTransfer.sol": "Multi-recipient calldata-heavy transfer",
};

interface DeploymentManifest {
  network: string;
  chainId: number;
  deployer: string;
  identityRegistry: { agentId?: string; status: string };
  annealAgent: { address: string };
  annealValidation: { address: string };
  annealStaking: { address: string; extra?: { minStake?: string; treasury?: string } };
  stakeToken: { address: string };
}

interface AuditRow {
  contract: string;
  path: string;
  score: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  codeHash: string;
  reportURI: string;
  txHash?: string;
  blockNumber?: number;
}

interface AuditsManifest {
  network: string;
  agentId: number;
  runAt: string;
  results: AuditRow[];
}

async function main() {
  const engine = await import("@tryanneal/engine");
  const { deserializeEncryptedReport, decryptFindings } = engine;

  const deploy: DeploymentManifest = JSON.parse(
    await readFile(resolve(CONTRACTS_ROOT, `deployments/${NETWORK}.json`), "utf8"),
  );
  const audits: AuditsManifest = JSON.parse(
    await readFile(resolve(CONTRACTS_ROOT, `deployments/${NETWORK}.audits.json`), "utf8"),
  );

  const agentId = audits.agentId || 0;
  const network = "mantle-sepolia";

  // Decrypt each report and assemble the dashboard payload.
  const dashboardAudits = await Promise.all(
    audits.results.map(async (row) => {
      const codeNoPrefix = row.codeHash.replace(/^0x/, "");
      const encPath = resolve(REPORTS_DIR, `${codeNoPrefix}.enc`);
      const keyPath = resolve(REPORTS_DIR, `${codeNoPrefix}.key.txt`);
      const encBuf = await readFile(encPath);
      const keyHex = (await readFile(keyPath, "utf8")).trim().replace(/^0x/, "");
      const key = Buffer.from(keyHex, "hex");
      const decoded = deserializeEncryptedReport(encBuf);
      const { findings, gasReport } = decryptFindings(decoded, key);

      const findingArr = findings.map((f, idx) => ({
        id: `F-${String(idx + 1).padStart(3, "0")}`,
        severity: f.severity,
        title: f.vulnClass,
        description: f.description,
        lineNumber: f.lineStart,
        confidence: f.confidencePct,
        recommendation: f.recommendation,
        sources: f.sources,
      }));

      const dep = gasReport.deployment;
      const fnTotal = gasReport.functions.reduce((s: bigint, fn) => s + fn.l2ExecutionFee + fn.l1DataFee + fn.operatorFee, 0n);
      const formatUsd = (mnt: string) => {
        const mntPrice = 0.6;
        return Number((Number(mnt) * mntPrice).toFixed(6));
      };

      const optimization = gasReport.optimizations[0];

      return {
        codeHash: row.codeHash,
        agentId,
        contractName: row.contract,
        contractDescription: CONTRACT_NAME_BY_PATH[row.contract] ?? "",
        verdictScore: row.score,
        criticalCount: row.critical,
        highCount: row.high,
        mediumCount: row.medium,
        lowCount: row.low,
        reportURI: row.reportURI,
        reportSource: "local-fallback",
        network,
        timestamp: audits.runAt,
        txHash: row.txHash,
        blockNumber: row.blockNumber,
        mantlescanUrl: row.txHash ? `https://sepolia.mantlescan.xyz/tx/${row.txHash}` : null,
        findings: findingArr,
        gasReport: {
          deploymentGas: Number(dep.totalGas),
          deploymentCostMNT: dep.totalCostMNT,
          deploymentCostUSD: formatUsd(dep.totalCostMNT),
          l2ExecutionMNT: dep.l2ExecutionFee.toString(),
          l1DataMNT: dep.l1DataFee.toString(),
          operatorMNT: dep.operatorFee.toString(),
          fnTotalMNT: fnTotal.toString(),
          functionCount: gasReport.functions.length,
          optimizationHint: optimization ? `${optimization.description} (~${optimization.estimatedSavingPct}% saving)` : null,
        },
      };
    }),
  );

  await writeFile(
    resolve(REPO_ROOT, "packages/web/public/data/audits.json"),
    JSON.stringify({ audits: dashboardAudits }, null, 2) + "\n",
  );

  // agents.json: real deployer + on-chain stats from the run
  const agents = {
    [String(agentId)]: {
      agentId,
      owner: deploy.deployer,
      annealAgentContract: deploy.annealAgent.address,
      annealValidationContract: deploy.annealValidation.address,
      agentURI: "ipfs://tryanneal/agent.json",
      wallet: deploy.deployer,
      registeredAt: audits.runAt,
      network,
      chainId: deploy.chainId,
      reputation: {
        totalAudits: dashboardAudits.length,
        correctAudits: dashboardAudits.length,
        accuracy: 100,
        slashEvents: 0,
        stakedAmount: "0",
      },
      identityRegistry: {
        address: "0x8004A3718bD35CF767BC0E718bf21Ec4073502f0",
        registered: deploy.identityRegistry.status === "ok",
        registeredAgentId: deploy.identityRegistry.agentId ?? null,
      },
    },
  };
  await writeFile(
    resolve(REPO_ROOT, "packages/web/public/data/agents.json"),
    JSON.stringify(agents, null, 2) + "\n",
  );

  // staking.json: real contract addresses + minStake
  const staking = {
    network,
    chainId: deploy.chainId,
    contract: deploy.annealStaking.address,
    mantlescanUrl: `https://sepolia.mantlescan.xyz/address/${deploy.annealStaking.address}`,
    stakeToken: deploy.stakeToken.address,
    stakeTokenSymbol: "MOCK",
    totalStaked: "0",
    totalStakers: 0,
    minStake: deploy.annealStaking.extra?.minStake ?? "100000000000000000000",
    cooldownDays: 7,
    slashBasisPoints: 250,
    maxSlashBasisPoints: 1000,
    feeSplit: { auditor: 6000, stakers: 3000, treasury: 1000 },
    treasury: deploy.annealStaking.extra?.treasury ?? deploy.deployer,
    apy: "0",
    state: "deployed-pre-launch",
  };
  await writeFile(
    resolve(REPO_ROOT, "packages/web/public/data/staking.json"),
    JSON.stringify(staking, null, 2) + "\n",
  );

  console.log(`✓ updated 3 dashboard files with ${dashboardAudits.length} real audits`);
  console.log(`  total findings: ${dashboardAudits.reduce((s, a) => s + a.findings.length, 0)}`);
  console.log(`  on-chain tx hashes: ${dashboardAudits.filter((a) => a.txHash).length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
