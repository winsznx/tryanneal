import { expect } from "chai";
import { ethers } from "hardhat";

const CODE_HASH = ethers.keccak256(ethers.toUtf8Bytes("contract Vault {}"));
const GAS_HASH = ethers.keccak256(ethers.toUtf8Bytes("{gas:report}"));
const URI = "ar://abc123";

describe("AnnealValidation", () => {
  async function deploy() {
    const F = await ethers.getContractFactory("AnnealValidation");
    const c = await F.deploy();
    await c.waitForDeployment();
    return c;
  }

  it("posts a verdict and reads it back", async () => {
    const c = await deploy();
    await (await c.postVerdict(42, CODE_HASH, 80, 0, 1, 2, 3, URI, GAS_HASH)).wait();
    const v = await c.getVerdict(CODE_HASH);
    expect(v.agentId).to.equal(42n);
    expect(v.verdictScore).to.equal(80);
    expect(v.criticalCount).to.equal(0);
    expect(v.highCount).to.equal(1);
    expect(v.reportURI).to.equal(URI);
    expect(v.gasReportHash).to.equal(GAS_HASH);
    expect(v.timestamp).to.be.greaterThan(0n);
    expect(await c.totalAudits()).to.equal(1n);
  });

  it("tracks multiple audits per agent", async () => {
    const c = await deploy();
    const h1 = ethers.keccak256(ethers.toUtf8Bytes("a"));
    const h2 = ethers.keccak256(ethers.toUtf8Bytes("b"));
    await (await c.postVerdict(7, h1, 90, 0, 0, 0, 0, URI, GAS_HASH)).wait();
    await (await c.postVerdict(7, h2, 70, 0, 1, 0, 0, URI, GAS_HASH)).wait();
    expect(await c.getAgentAuditCount(7)).to.equal(2n);
    const list = await c.getAgentAudits(7);
    expect(list).to.deep.equal([h1, h2]);
  });

  it("hasAuditedCodeHash reflects post state", async () => {
    const c = await deploy();
    expect(await c.hasAuditedCodeHash(CODE_HASH)).to.equal(false);
    await (await c.postVerdict(1, CODE_HASH, 50, 0, 0, 0, 0, URI, GAS_HASH)).wait();
    expect(await c.hasAuditedCodeHash(CODE_HASH)).to.equal(true);
  });

  it("emits AuditPosted with indexed agentId and codeHash", async () => {
    const c = await deploy();
    await expect(c.postVerdict(99, CODE_HASH, 65, 0, 0, 1, 1, URI, GAS_HASH))
      .to.emit(c, "AuditPosted")
      .withArgs(99n, CODE_HASH, 65, URI, (ts: bigint) => ts > 0n);
  });

  it("rejects verdictScore > 100 and empty codeHash", async () => {
    const c = await deploy();
    await expect(c.postVerdict(1, CODE_HASH, 101, 0, 0, 0, 0, URI, GAS_HASH))
      .to.be.revertedWithCustomError(c, "InvalidScore")
      .withArgs(101);
    await expect(c.postVerdict(1, ethers.ZeroHash, 50, 0, 0, 0, 0, URI, GAS_HASH))
      .to.be.revertedWithCustomError(c, "EmptyCodeHash");
  });
});
