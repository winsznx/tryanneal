import { expect } from "chai";
import { ethers } from "hardhat";

describe("AnnealAgent", () => {
  it("registers, updates URI, and reads metadata via ERC-8004 Identity Registry", async () => {
    const [owner] = await ethers.getSigners();

    const Registry = await ethers.getContractFactory("MockIdentityRegistry");
    const registry = await Registry.deploy();
    await registry.waitForDeployment();

    const Agent = await ethers.getContractFactory("AnnealAgent");
    const agent = await Agent.deploy(await registry.getAddress(), owner.address);
    await agent.waitForDeployment();

    const initialURI = "ipfs://anneal/agent.json";
    const tx = await agent.registerAgent(initialURI);
    await tx.wait();

    expect(await agent.registered()).to.equal(true);
    const id = await agent.agentId();
    expect(id).to.equal(1n);

    const [uri, wallet] = await agent.readMetadata();
    expect(uri).to.equal(initialURI);
    expect(wallet).to.equal(ethers.ZeroAddress);

    const newURI = "ipfs://anneal/agent-v2.json";
    await (await agent.updateAgentURI(newURI)).wait();
    const [uri2] = await agent.readMetadata();
    expect(uri2).to.equal(newURI);
  });

  it("prevents double registration", async () => {
    const [owner] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("MockIdentityRegistry")).deploy();
    const agent = await (await ethers.getContractFactory("AnnealAgent")).deploy(
      await registry.getAddress(),
      owner.address,
    );
    await agent.registerAgent("ipfs://x");
    await expect(agent.registerAgent("ipfs://y")).to.be.revertedWithCustomError(agent, "AlreadyRegistered");
  });

  it("rejects non-owner callers", async () => {
    const [owner, other] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("MockIdentityRegistry")).deploy();
    const agent = await (await ethers.getContractFactory("AnnealAgent")).deploy(
      await registry.getAddress(),
      owner.address,
    );
    await expect(agent.connect(other).registerAgent("ipfs://x")).to.be.revertedWithCustomError(
      agent,
      "NotOwner",
    );
  });
});
