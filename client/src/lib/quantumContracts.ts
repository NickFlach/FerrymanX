import { ethers } from "ethers";

export const QUANTUM_CONTRACTS = {
  NEOX: {
    PFORK: "0x216490C8E6b33b4d8A2390dADcf9f433E30da60F",
    SEQUENCER_BOND_VAULT: "", // To be filled after deployment
    PRIORITY_FEE_MANAGER: "", // To be filled after deployment
    STATE_VERIFIER: "", // To be filled after deployment
    BRIDGE_VAULT: "", // To be filled after deployment
    GOVERNANCE: "", // To be filled after deployment
    DA_INCENTIVES: "", // To be filled after deployment
    IDENTITY_REGISTRY: "", // To be filled after deployment
  },
};

export const SEQUENCER_BOND_VAULT_ABI = [
  "function pfork() view returns (address)",
  "function minBondAmount() view returns (uint256)",
  "function unstakeDelay() view returns (uint256)",
  "function slasher() view returns (address)",
  "function governance() view returns (address)",
  "function stake(uint256 amount)",
  "function requestUnstake(uint256 amount)",
  "function executeUnstake()",
  "function cancelUnstake()",
  "function bondedBalance(address sequencer) view returns (uint256)",
  "function isSequencer(address sequencer) view returns (bool)",
  "function pendingUnstake(address sequencer) view returns (uint256 amount, uint256 unlockTime)",
  "function getSequencerInfo(address sequencer) view returns (uint256 bonded, uint256 pendingAmount, uint256 unlockTime, bool active)",
  "function activeSequencerCount() view returns (uint256)",
  "function activeSequencerAt(uint256 index) view returns (address)",
  "function totalBonded() view returns (uint256)",
  "function slashedPool() view returns (uint256)",
  "function slash(address sequencer, uint256 amount, bytes reason)",
  "function setMinBondAmount(uint256 newMinBond)",
  "function setUnstakeDelay(uint256 newDelay)",
  "function setSlasher(address newSlasher)",
  "function setGovernance(address newGovernance)",
  "function withdrawSlashedFunds(address to, uint256 amount)",
  "event Staked(address indexed sequencer, uint256 amount)",
  "event Unstaked(address indexed sequencer, uint256 amount)",
  "event Slashed(address indexed sequencer, uint256 amount, bytes reason)",
  "event MinBondUpdated(uint256 oldMinBond, uint256 newMinBond)",
  "event UnstakeDelayUpdated(uint256 oldDelay, uint256 newDelay)",
];

export const PRIORITY_FEE_MANAGER_ABI = [
  "function pfork() view returns (address)",
  "function basePricePerUnit() view returns (uint256)",
  "function burnRateBps() view returns (uint256)",
  "function sequencerBondVault() view returns (address)",
  "function governance() view returns (address)",
  "function burnAddress() view returns (address)",
  "function protocolPool() view returns (uint256)",
  "function buyPriority(uint256 batchHint, uint256 amount)",
  "function priorityScore(address user, uint256 batchId) view returns (uint256)",
  "function consumePriority(address user, uint256 batchId, uint256 units)",
  "function getUserPriority(address user, uint256 batchId) view returns (uint256 unitsAvailable, uint256 totalPurchased, uint256 lastPurchaseBlock)",
  "function estimatePriorityUnits(uint256 amount) view returns (uint256)",
  "function getStats() view returns (uint256 totalBurned, uint256 totalCollected, uint256 protocolPool, uint256 basePricePerUnit, uint256 burnRateBps)",
  "function totalBurned() view returns (uint256)",
  "function totalCollected() view returns (uint256)",
  "function setBasePricePerUnit(uint256 newPrice)",
  "function setBurnRateBps(uint256 newBurnRate)",
  "function setSequencerBondVault(address vault)",
  "function setGovernance(address newGovernance)",
  "function setBurnAddress(address newBurnAddress)",
  "function withdrawProtocolFunds(address to, uint256 amount)",
  "function fundDAIncentives(uint256 amount)",
  "function setDAIncentives(address _daIncentives)",
  "function daIncentives() view returns (address)",
  "event PriorityPurchased(address indexed user, uint256 batchHint, uint256 amountPFork, uint256 priorityUnits)",
  "event PriorityConsumed(address indexed user, uint256 batchId, uint256 unitsConsumed)",
  "event PriorityParamsUpdated(uint256 basePricePerUnit, uint256 burnRateBps)",
];

export const STATE_VERIFIER_ABI = [
  "function currentStateRoot() view returns (bytes32)",
  "function batchId() view returns (uint256)",
  "function challengeWindow() view returns (uint256)",
  "function sequencerBondVault() view returns (address)",
  "function totalBatches() view returns (uint256)",
  "function lastBatchTime() view returns (uint256)",
  "function knownRoots(bytes32 root) view returns (bool)",
  "function commitBatch(bytes32 oldRoot, bytes32 newRoot, bytes32 dataHash, bytes proof)",
  "function finalizeBatch(uint256 _batchId)",
  "function verifyInclusion(bytes32 leaf, bytes32[] proof, uint256 index) view returns (bool)",
  "function stateRootAt(uint256 _batchId) view returns (bytes32)",
  "function batchInfo(uint256 _batchId) view returns (bytes32 stateRoot, bytes32 dataHash, uint256 timestamp, address sequencer)",
  "function getBatchInfo(uint256 _batchId) view returns (tuple(bytes32 stateRoot, bytes32 dataHash, uint256 timestamp, address sequencer, bool finalized))",
  "function isBatchFinalized(uint256 _batchId) view returns (bool)",
  "function getStats() view returns (bytes32 currentRoot, uint256 batchId, uint256 totalBatches, uint256 lastBatchTime, uint256 challengeWindow)",
  "function setSequencerBondVault(address vault)",
  "function setChallengeWindow(uint256 newWindow)",
  "event BatchCommitted(uint256 indexed batchId, bytes32 indexed oldRoot, bytes32 indexed newRoot, bytes32 dataHash, address sequencer)",
  "event BatchFinalized(uint256 indexed batchId)",
  "event SequencerBondVaultUpdated(address indexed oldVault, address indexed newVault)",
  "event ChallengeWindowUpdated(uint256 oldWindow, uint256 newWindow)",
];

export const BRIDGE_VAULT_ABI = [
  "function pfork() view returns (address)",
  "function stateVerifier() view returns (address)",
  "function priorityFeeManager() view returns (address)",
  "function exitDelay() view returns (uint256)",
  "function priorityExitDelay() view returns (uint256)",
  "function deposit(address asset, uint256 amount)",
  "function requestExit(address asset, uint256 amount, uint256 depositIndex) returns (uint256)",
  "function completeExit(uint256 exitId, bytes proof, bytes leafData)",
  "function priorityExit(uint256 exitId, bytes proof, bytes leafData)",
  "function userDeposits(address user, address asset) view returns (uint256)",
  "function exitRequest(uint256 exitId) view returns (address user, address asset, uint256 amount, uint256 requestBlock, bool completed)",
  "function getExitRequest(uint256 exitId) view returns (tuple(address user, address asset, uint256 amount, uint256 requestBlock, uint256 unlockBlock, bytes32 depositCommitment, bool completed, bool isPriority))",
  "function getDepositRecords(address user, address asset) view returns (tuple(uint256 amount, uint256 depositBlock, bytes32 commitment, bool active)[])",
  "function getActiveDepositCount(address user, address asset) view returns (uint256)",
  "function getUserExits(address user) view returns (uint256[])",
  "function canCompleteExit(uint256 exitId) view returns (bool, string)",
  "function supportedAssets(address asset) view returns (bool)",
  "function totalDeposits() view returns (uint256)",
  "function totalExits() view returns (uint256)",
  "function setStateVerifier(address verifier)",
  "function setPriorityFeeManager(address manager)",
  "function setExitDelay(uint256 newDelay)",
  "function setPriorityExitDelay(uint256 newDelay)",
  "function setSupportedAsset(address asset, bool supported)",
  "event Deposited(address indexed user, address indexed asset, uint256 amount, uint256 depositId)",
  "event ExitRequested(address indexed user, address indexed asset, uint256 amount, uint256 exitId)",
  "event ExitCompleted(address indexed user, address indexed asset, uint256 amount, uint256 exitId)",
];

export const GOVERNANCE_ABI = [
  "function pfork() view returns (address)",
  "function proposalThreshold() view returns (uint256)",
  "function votingPeriod() view returns (uint256)",
  "function quorum() view returns (uint256)",
  "function executionDelay() view returns (uint256)",
  "function propose(address[] targets, bytes[] calldatas) returns (uint256)",
  "function castVote(uint256 proposalId, bool support)",
  "function execute(uint256 proposalId)",
  "function cancel(uint256 proposalId)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function getProposal(uint256 proposalId) view returns (tuple(uint256 id, address proposer, address[] targets, bytes[] calldatas, uint256 startBlock, uint256 endBlock, uint256 forVotes, uint256 againstVotes, bool executed, bool cancelled))",
  "function hasVoted(uint256 proposalId, address voter) view returns (bool)",
  "function getVotingPower(uint256 proposalId, address voter) view returns (uint256)",
  "function getStats() view returns (uint256 proposalThreshold, uint256 votingPeriod, uint256 quorum, uint256 executionDelay, uint256 totalProposals, uint256 executedProposals)",
  "event ProposalCreated(uint256 indexed id, address indexed proposer, address[] targets, bytes[] calldatas, uint256 startBlock, uint256 endBlock)",
  "event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 weight)",
  "event ProposalExecuted(uint256 indexed id)",
  "event ProposalCancelled(uint256 indexed id)",
];

export const DA_INCENTIVES_ABI = [
  "function pfork() view returns (address)",
  "function rewardPerBlock() view returns (uint256)",
  "function totalActiveProviders() view returns (uint256)",
  "function rewardPool() view returns (uint256)",
  "function sequencerBondVault() view returns (address)",
  "function minStakeForDA() view returns (uint256)",
  "function minStakeForProver() view returns (uint256)",
  "function totalRewardsDistributed() view returns (uint256)",
  "function registerProvider(uint8 providerType)",
  "function removeProvider(address provider)",
  "function claimRewards()",
  "function depositRewards(uint256 amount)",
  "function pendingRewards(address provider) view returns (uint256)",
  "function isActiveProvider(address provider) view returns (bool)",
  "function providerInfo(address provider) view returns (uint8 providerType, uint256 registeredAt, uint256 lastClaimBlock, uint256 totalClaimed)",
  "function getProvider(address provider) view returns (uint8 providerType, uint256 registeredAt, uint256 lastClaimBlock, uint256 totalClaimed, uint256 pendingAmount, bool active)",
  "function getActiveProviders(uint256 offset, uint256 limit) view returns (address[])",
  "function getStats() view returns (uint256 rewardPerBlock, uint256 rewardPool, uint256 totalActiveProviders, uint256 totalRewardsDistributed, uint256 accRewardPerShare)",
  "function setRewardPerBlock(uint256 newRewardPerBlock)",
  "function setSequencerBondVault(address vault)",
  "function setMinStakes(uint256 minStakeForDA, uint256 minStakeForProver)",
  "function emergencyWithdraw(address to, uint256 amount)",
  "event RewardDeposited(uint256 amount, address indexed depositor)",
  "event RewardClaimed(address indexed provider, uint256 amount)",
  "event ProviderRegistered(address indexed provider, uint8 providerType)",
  "event ProviderRemoved(address indexed provider)",
  "event RewardRateUpdated(uint256 oldRate, uint256 newRate)",
  "event MinStakeUpdated(uint8 providerType, uint256 oldMin, uint256 newMin)",
];

export const IDENTITY_REGISTRY_ABI = [
  "function pfork() view returns (address)",
  "function bondAmount() view returns (uint256)",
  "function cooldownPeriod() view returns (uint256)",
  "function registerIdentity(bytes pqPublicKey)",
  "function updateIdentity(bytes newPqPublicKey)",
  "function removeIdentity()",
  "function getPQKey(address neoXAddress) view returns (bytes)",
  "function isRegistered(address neoXAddress) view returns (bool)",
  "function registrationTime(address neoXAddress) view returns (uint256)",
  "function getIdentity(address neoXAddress) view returns (bytes pqPublicKey, uint256 bondedAmount, uint256 registeredAt, uint256 lastUpdated, bool active)",
  "function getAddressByKeyHash(bytes32 keyHash) view returns (address)",
  "function verifyKeyOwnership(address neoXAddress, bytes pqPublicKey) view returns (bool)",
  "function getRegisteredAddresses(uint256 offset, uint256 limit) view returns (address[])",
  "function getStats() view returns (uint256 bondAmount, uint256 cooldownPeriod, uint256 totalRegistered, uint256 totalBonded)",
  "event IdentityRegistered(address indexed neoXAddress, bytes pqPublicKey, uint256 bondAmount)",
  "event IdentityUpdated(address indexed neoXAddress, bytes newPqPublicKey)",
  "event IdentityRemoved(address indexed neoXAddress, uint256 bondReturned)",
];

export const PROVIDER_TYPES = {
  NONE: 0,
  DA_PROVIDER: 1,
  PROVER: 2,
  SEQUENCER: 3,
} as const;

export const PROPOSAL_STATES = {
  PENDING: 0,
  ACTIVE: 1,
  SUCCEEDED: 2,
  DEFEATED: 3,
  QUEUED: 4,
  EXECUTED: 5,
  CANCELLED: 6,
} as const;

export function getQuantumContract(
  contractName: keyof typeof QUANTUM_CONTRACTS.NEOX,
  provider: ethers.Provider | ethers.Signer
) {
  const address = QUANTUM_CONTRACTS.NEOX[contractName];
  if (!address) {
    throw new Error(`Contract ${contractName} address not configured`);
  }

  const abiMap: Record<string, string[]> = {
    SEQUENCER_BOND_VAULT: SEQUENCER_BOND_VAULT_ABI,
    PRIORITY_FEE_MANAGER: PRIORITY_FEE_MANAGER_ABI,
    STATE_VERIFIER: STATE_VERIFIER_ABI,
    BRIDGE_VAULT: BRIDGE_VAULT_ABI,
    GOVERNANCE: GOVERNANCE_ABI,
    DA_INCENTIVES: DA_INCENTIVES_ABI,
    IDENTITY_REGISTRY: IDENTITY_REGISTRY_ABI,
  };

  const abi = abiMap[contractName];
  if (!abi) {
    throw new Error(`ABI not found for contract ${contractName}`);
  }

  return new ethers.Contract(address, abi, provider);
}

export async function getSequencerStatus(
  address: string,
  provider: ethers.Provider
) {
  const contract = getQuantumContract("SEQUENCER_BOND_VAULT", provider);
  const [bonded, pendingAmount, unlockTime, active] = await contract.getSequencerInfo(address);
  return {
    bonded: ethers.formatEther(bonded),
    pendingUnstake: ethers.formatEther(pendingAmount),
    unlockTime: unlockTime.toString(),
    isActive: active,
  };
}

export async function getPriorityStatus(
  address: string,
  batchId: number,
  provider: ethers.Provider
) {
  const contract = getQuantumContract("PRIORITY_FEE_MANAGER", provider);
  const [unitsAvailable, totalPurchased, lastPurchaseBlock] = await contract.getUserPriority(address, batchId);
  return {
    unitsAvailable: unitsAvailable.toString(),
    totalPurchased: totalPurchased.toString(),
    lastPurchaseBlock: lastPurchaseBlock.toString(),
  };
}

export async function getStateVerifierStats(provider: ethers.Provider) {
  const contract = getQuantumContract("STATE_VERIFIER", provider);
  const [currentRoot, batchId, totalBatches, lastBatchTime, challengeWindow] = await contract.getStats();
  return {
    currentRoot,
    batchId: batchId.toString(),
    totalBatches: totalBatches.toString(),
    lastBatchTime: new Date(Number(lastBatchTime) * 1000).toISOString(),
    challengeWindow: challengeWindow.toString(),
  };
}

export async function getGovernanceStats(provider: ethers.Provider) {
  const contract = getQuantumContract("GOVERNANCE", provider);
  const [
    proposalThreshold,
    votingPeriod,
    quorum,
    executionDelay,
    totalProposals,
    executedProposals
  ] = await contract.getStats();
  return {
    proposalThreshold: ethers.formatEther(proposalThreshold),
    votingPeriod: votingPeriod.toString(),
    quorum: ethers.formatEther(quorum),
    executionDelay: executionDelay.toString(),
    totalProposals: totalProposals.toString(),
    executedProposals: executedProposals.toString(),
  };
}

export async function getDAIncentivesStats(provider: ethers.Provider) {
  const contract = getQuantumContract("DA_INCENTIVES", provider);
  const [
    rewardPerBlock,
    rewardPool,
    totalActiveProviders,
    totalRewardsDistributed,
    accRewardPerShare
  ] = await contract.getStats();
  return {
    rewardPerBlock: ethers.formatEther(rewardPerBlock),
    rewardPool: ethers.formatEther(rewardPool),
    totalActiveProviders: totalActiveProviders.toString(),
    totalRewardsDistributed: ethers.formatEther(totalRewardsDistributed),
  };
}

export async function getIdentityStats(provider: ethers.Provider) {
  const contract = getQuantumContract("IDENTITY_REGISTRY", provider);
  const [bondAmount, cooldownPeriod, totalRegistered, totalBonded] = await contract.getStats();
  return {
    bondAmount: ethers.formatEther(bondAmount),
    cooldownPeriod: cooldownPeriod.toString(),
    totalRegistered: totalRegistered.toString(),
    totalBonded: ethers.formatEther(totalBonded),
  };
}
