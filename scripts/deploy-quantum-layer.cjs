/**
 * Quantum Integration Layer - Deployment Script
 * 
 * Deploys the full suite of Quantum Layer contracts to Neo X.
 * PFORK is the central token for all operations.
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-quantum-layer.cjs --network neox
 */

const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  console.log(`\n🌐 Deploying Quantum Layer to ${network}...\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", hre.ethers.formatEther(balance), "GAS\n");

  // PFORK token addresses
  const PFORK_ADDRESSES = {
    neox: "0x216490C8E6b33b4d8A2390dADcf9f433E30da60F",
    ethereum: "0x536d98Ad83F7d0230B9384e606208802ECD728FE",
  };

  const pforkAddress = PFORK_ADDRESSES[network];
  if (!pforkAddress) {
    throw new Error(`No PFORK address configured for network: ${network}`);
  }
  console.log("PFORK Token:", pforkAddress);

  // ============================================
  // PHASE 0: Core Infrastructure
  // ============================================
  console.log("\n📦 PHASE 0: Deploying Core Infrastructure...\n");

  // 1. QSequencerBondVault
  console.log("1️⃣  Deploying QSequencerBondVault...");
  const QSequencerBondVault = await hre.ethers.getContractFactory("QSequencerBondVault");
  const minBondAmount = hre.ethers.parseEther("10000"); // 10,000 PFORK minimum
  const unstakeDelay = 7 * 24 * 60 * 60; // 7 days
  const sequencerBondVault = await QSequencerBondVault.deploy(
    pforkAddress,
    minBondAmount,
    unstakeDelay
  );
  await sequencerBondVault.waitForDeployment();
  const sequencerBondVaultAddress = await sequencerBondVault.getAddress();
  console.log("   ✅ QSequencerBondVault:", sequencerBondVaultAddress);

  // 2. QPriorityFeeManager
  console.log("2️⃣  Deploying QPriorityFeeManager...");
  const QPriorityFeeManager = await hre.ethers.getContractFactory("QPriorityFeeManager");
  const basePricePerUnit = hre.ethers.parseEther("100"); // 100 PFORK per priority unit
  const burnRateBps = 1000; // 10% burn rate
  const priorityFeeManager = await QPriorityFeeManager.deploy(
    pforkAddress,
    basePricePerUnit,
    burnRateBps
  );
  await priorityFeeManager.waitForDeployment();
  const priorityFeeManagerAddress = await priorityFeeManager.getAddress();
  console.log("   ✅ QPriorityFeeManager:", priorityFeeManagerAddress);

  // 3. QStateVerifier
  console.log("3️⃣  Deploying QStateVerifier...");
  const QStateVerifier = await hre.ethers.getContractFactory("QStateVerifier");
  const challengeWindow = 60 * 60; // 1 hour challenge window
  const stateVerifier = await QStateVerifier.deploy(challengeWindow);
  await stateVerifier.waitForDeployment();
  const stateVerifierAddress = await stateVerifier.getAddress();
  console.log("   ✅ QStateVerifier:", stateVerifierAddress);

  // 4. QBridgeVault
  console.log("4️⃣  Deploying QBridgeVault...");
  const QBridgeVault = await hre.ethers.getContractFactory("QBridgeVault");
  const exitDelay = 1000; // ~1000 blocks for normal exit
  const priorityExitDelay = 100; // ~100 blocks for priority exit
  const bridgeVault = await QBridgeVault.deploy(
    pforkAddress,
    exitDelay,
    priorityExitDelay
  );
  await bridgeVault.waitForDeployment();
  const bridgeVaultAddress = await bridgeVault.getAddress();
  console.log("   ✅ QBridgeVault:", bridgeVaultAddress);

  // ============================================
  // PHASE 1: Governance & Incentives
  // ============================================
  console.log("\n📦 PHASE 1: Deploying Governance & Incentives...\n");

  // 5. QGovernance
  console.log("5️⃣  Deploying QGovernance...");
  const QGovernance = await hre.ethers.getContractFactory("QGovernance");
  const proposalThreshold = hre.ethers.parseEther("100000"); // 100,000 PFORK to propose
  const votingPeriod = 17280; // ~3 days at 15s blocks
  const quorum = hre.ethers.parseEther("1000000"); // 1M PFORK quorum
  const executionDelay = 24 * 60 * 60; // 24 hour execution delay
  const governance = await QGovernance.deploy(
    pforkAddress,
    proposalThreshold,
    votingPeriod,
    quorum,
    executionDelay
  );
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  console.log("   ✅ QGovernance:", governanceAddress);

  // 6. QDAIncentives
  console.log("6️⃣  Deploying QDAIncentives...");
  const QDAIncentives = await hre.ethers.getContractFactory("QDAIncentives");
  const rewardPerBlock = hre.ethers.parseEther("10"); // 10 PFORK per block
  const daIncentives = await QDAIncentives.deploy(
    pforkAddress,
    rewardPerBlock
  );
  await daIncentives.waitForDeployment();
  const daIncentivesAddress = await daIncentives.getAddress();
  console.log("   ✅ QDAIncentives:", daIncentivesAddress);

  // ============================================
  // PHASE 2: Identity Registry
  // ============================================
  console.log("\n📦 PHASE 2: Deploying Identity Registry...\n");

  // 7. QIdentityRegistry
  console.log("7️⃣  Deploying QIdentityRegistry...");
  const QIdentityRegistry = await hre.ethers.getContractFactory("QIdentityRegistry");
  const identityBondAmount = hre.ethers.parseEther("1000"); // 1,000 PFORK bond
  const cooldownPeriod = 24 * 60 * 60; // 24 hours between key updates
  const identityRegistry = await QIdentityRegistry.deploy(
    pforkAddress,
    identityBondAmount,
    cooldownPeriod
  );
  await identityRegistry.waitForDeployment();
  const identityRegistryAddress = await identityRegistry.getAddress();
  console.log("   ✅ QIdentityRegistry:", identityRegistryAddress);

  // ============================================
  // Wire Up Contracts
  // ============================================
  console.log("\n🔗 Wiring up contract connections...\n");

  // Connect StateVerifier to SequencerBondVault
  console.log("   Setting SequencerBondVault on StateVerifier...");
  const tx1 = await stateVerifier.setSequencerBondVault(sequencerBondVaultAddress);
  await tx1.wait();

  // Connect BridgeVault to StateVerifier and PriorityFeeManager
  console.log("   Setting StateVerifier on BridgeVault...");
  const tx2 = await bridgeVault.setStateVerifier(stateVerifierAddress);
  await tx2.wait();
  
  console.log("   Setting PriorityFeeManager on BridgeVault...");
  const tx3 = await bridgeVault.setPriorityFeeManager(priorityFeeManagerAddress);
  await tx3.wait();

  // Connect PriorityFeeManager to SequencerBondVault
  console.log("   Setting SequencerBondVault on PriorityFeeManager...");
  const tx4 = await priorityFeeManager.setSequencerBondVault(sequencerBondVaultAddress);
  await tx4.wait();

  // Connect DAIncentives to SequencerBondVault
  console.log("   Setting SequencerBondVault on DAIncentives...");
  const tx5 = await daIncentives.setSequencerBondVault(sequencerBondVaultAddress);
  await tx5.wait();

  // Set governance addresses on all relevant contracts
  console.log("   Setting governance on SequencerBondVault...");
  const tx6 = await sequencerBondVault.setGovernance(governanceAddress);
  await tx6.wait();
  
  console.log("   Setting governance on PriorityFeeManager...");
  const tx7 = await priorityFeeManager.setGovernance(governanceAddress);
  await tx7.wait();

  // Set slasher to governance contract for decentralized slashing
  console.log("   Setting governance as slasher on SequencerBondVault...");
  const tx8 = await sequencerBondVault.setSlasher(governanceAddress);
  await tx8.wait();

  // Set minimum stakes for DA providers and provers
  console.log("   Setting minimum stakes on DAIncentives...");
  const minDAStake = hre.ethers.parseEther("5000"); // 5,000 PFORK
  const minProverStake = hre.ethers.parseEther("10000"); // 10,000 PFORK
  const tx9 = await daIncentives.setMinStakes(minDAStake, minProverStake);
  await tx9.wait();

  // Connect PriorityFeeManager to DAIncentives for reward funding
  console.log("   Setting DAIncentives on PriorityFeeManager...");
  const tx10 = await priorityFeeManager.setDAIncentives(daIncentivesAddress);
  await tx10.wait();

  console.log("   ✅ All contracts wired up!\n");

  // ============================================
  // Summary
  // ============================================
  console.log("═".repeat(60));
  console.log("🎉 QUANTUM LAYER DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log("\n📋 Contract Addresses:\n");
  console.log(`   PFORK Token:           ${pforkAddress}`);
  console.log(`   QSequencerBondVault:   ${sequencerBondVaultAddress}`);
  console.log(`   QPriorityFeeManager:   ${priorityFeeManagerAddress}`);
  console.log(`   QStateVerifier:        ${stateVerifierAddress}`);
  console.log(`   QBridgeVault:          ${bridgeVaultAddress}`);
  console.log(`   QGovernance:           ${governanceAddress}`);
  console.log(`   QDAIncentives:         ${daIncentivesAddress}`);
  console.log(`   QIdentityRegistry:     ${identityRegistryAddress}`);
  
  console.log("\n📝 Configuration:\n");
  console.log(`   Min Sequencer Bond:    ${hre.ethers.formatEther(minBondAmount)} PFORK`);
  console.log(`   Unstake Delay:         ${unstakeDelay / 86400} days`);
  console.log(`   Priority Price/Unit:   ${hre.ethers.formatEther(basePricePerUnit)} PFORK`);
  console.log(`   Burn Rate:             ${burnRateBps / 100}%`);
  console.log(`   Challenge Window:      ${challengeWindow / 3600} hours`);
  console.log(`   Exit Delay:            ${exitDelay} blocks`);
  console.log(`   Priority Exit Delay:   ${priorityExitDelay} blocks`);
  console.log(`   Proposal Threshold:    ${hre.ethers.formatEther(proposalThreshold)} PFORK`);
  console.log(`   Voting Period:         ${votingPeriod} blocks (~${Math.round(votingPeriod * 15 / 86400)} days)`);
  console.log(`   Quorum:                ${hre.ethers.formatEther(quorum)} PFORK`);
  console.log(`   Reward Per Block:      ${hre.ethers.formatEther(rewardPerBlock)} PFORK`);
  console.log(`   Identity Bond:         ${hre.ethers.formatEther(identityBondAmount)} PFORK`);

  console.log("\n" + "═".repeat(60));
  console.log("🚀 Next Steps:");
  console.log("═".repeat(60));
  console.log("\n1. Verify contracts on block explorer");
  console.log("2. Transfer ownership to multisig or governance");
  console.log("3. Fund DAIncentives reward pool");
  console.log("4. Register initial sequencers");
  console.log("5. Start off-chain sequencer and prover nodes\n");

  // Return addresses for verification
  return {
    pfork: pforkAddress,
    sequencerBondVault: sequencerBondVaultAddress,
    priorityFeeManager: priorityFeeManagerAddress,
    stateVerifier: stateVerifierAddress,
    bridgeVault: bridgeVaultAddress,
    governance: governanceAddress,
    daIncentives: daIncentivesAddress,
    identityRegistry: identityRegistryAddress,
  };
}

main()
  .then((addresses) => {
    console.log("\n✅ Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });
