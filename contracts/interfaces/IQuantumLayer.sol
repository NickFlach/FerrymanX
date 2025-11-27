// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPForkToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
}

interface IQSequencerBondVault {
    event Staked(address indexed sequencer, uint256 amount);
    event Unstaked(address indexed sequencer, uint256 amount);
    event Slashed(address indexed sequencer, uint256 amount, bytes reason);
    event MinBondUpdated(uint256 oldMinBond, uint256 newMinBond);
    event UnstakeDelayUpdated(uint256 oldDelay, uint256 newDelay);

    function pfork() external view returns (IPForkToken);
    function minBondAmount() external view returns (uint256);
    function unstakeDelay() external view returns (uint256);

    function stake(uint256 amount) external;
    function requestUnstake(uint256 amount) external;
    function executeUnstake() external;
    function cancelUnstake() external;

    function bondedBalance(address sequencer) external view returns (uint256);
    function isSequencer(address sequencer) external view returns (bool);
    function pendingUnstake(address sequencer) external view returns (uint256 amount, uint256 unlockTime);

    function slash(address sequencer, uint256 amount, bytes calldata reason) external;
}

interface IQPriorityFeeManager {
    event PriorityPurchased(address indexed user, uint256 batchHint, uint256 amountPFork, uint256 priorityUnits);
    event PriorityParamsUpdated(uint256 basePricePerUnit, uint256 burnRateBps);
    event PriorityConsumed(address indexed user, uint256 batchId, uint256 unitsConsumed);

    function pfork() external view returns (IPForkToken);
    function basePricePerUnit() external view returns (uint256);
    function burnRateBps() external view returns (uint256);

    function buyPriority(uint256 batchHint, uint256 amount) external;
    function priorityScore(address user, uint256 batchId) external view returns (uint256);
    function consumePriority(address user, uint256 batchId, uint256 units) external;
}

interface IQBridgeVault {
    event Deposited(address indexed user, address indexed asset, uint256 amount, uint256 depositId);
    event ExitRequested(address indexed user, address indexed asset, uint256 amount, uint256 exitId);
    event ExitCompleted(address indexed user, address indexed asset, uint256 amount, uint256 exitId);
    event ExitCancelled(address indexed user, uint256 exitId);
    event StateVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    function pfork() external view returns (IPForkToken);
    function stateVerifier() external view returns (address);
    function priorityFeeManager() external view returns (address);

    function deposit(address asset, uint256 amount) external;
    function requestExit(address asset, uint256 amount) external returns (uint256 exitId);
    function completeExit(uint256 exitId, bytes calldata proof, bytes calldata leafData) external;
    function priorityExit(uint256 exitId, bytes calldata proof, bytes calldata leafData) external;

    function userDeposits(address user, address asset) external view returns (uint256);
    function exitRequest(uint256 exitId) external view returns (
        address user,
        address asset,
        uint256 amount,
        uint256 requestBlock,
        bool completed
    );
}

interface IQStateVerifier {
    event BatchCommitted(
        uint256 indexed batchId,
        bytes32 indexed oldRoot,
        bytes32 indexed newRoot,
        bytes32 dataHash,
        address sequencer
    );
    event ProofVerified(uint256 indexed batchId, bool valid);
    event SequencerBondVaultUpdated(address indexed oldVault, address indexed newVault);
    event ChallengeWindowUpdated(uint256 oldWindow, uint256 newWindow);

    function currentStateRoot() external view returns (bytes32);
    function batchId() external view returns (uint256);
    function sequencerBondVault() external view returns (address);
    function challengeWindow() external view returns (uint256);

    function commitBatch(
        bytes32 oldRoot,
        bytes32 newRoot,
        bytes32 dataHash,
        bytes calldata proof
    ) external;

    function verifyInclusion(
        bytes32 leaf,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool);

    function stateRootAt(uint256 _batchId) external view returns (bytes32);
    function batchInfo(uint256 _batchId) external view returns (
        bytes32 stateRoot,
        bytes32 dataHash,
        uint256 timestamp,
        address sequencer
    );
}

interface IQGovernance {
    enum ProposalState { Pending, Active, Succeeded, Defeated, Queued, Executed, Cancelled }

    struct Proposal {
        uint256 id;
        address proposer;
        address[] targets;
        bytes[] calldatas;
        uint256 startBlock;
        uint256 endBlock;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool cancelled;
    }

    event ProposalCreated(
        uint256 indexed id,
        address indexed proposer,
        address[] targets,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock
    );
    event VoteCast(address indexed voter, uint256 indexed proposalId, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);
    event ProposalThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);
    event VotingPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum);

    function pfork() external view returns (IPForkToken);
    function proposalThreshold() external view returns (uint256);
    function votingPeriod() external view returns (uint256);
    function quorum() external view returns (uint256);

    function propose(address[] calldata targets, bytes[] calldata calldatas) external returns (uint256);
    function castVote(uint256 proposalId, bool support) external;
    function execute(uint256 proposalId) external;
    function cancel(uint256 proposalId) external;

    function state(uint256 proposalId) external view returns (ProposalState);
    function getProposal(uint256 proposalId) external view returns (Proposal memory);
    function hasVoted(uint256 proposalId, address voter) external view returns (bool);
}

interface IQIdentityRegistry {
    event IdentityRegistered(address indexed neoXAddress, bytes pqPublicKey, uint256 bondAmount);
    event IdentityUpdated(address indexed neoXAddress, bytes newPqPublicKey);
    event IdentityRemoved(address indexed neoXAddress, uint256 bondReturned);
    event BondAmountUpdated(uint256 oldAmount, uint256 newAmount);

    function pfork() external view returns (IPForkToken);
    function bondAmount() external view returns (uint256);

    function registerIdentity(bytes calldata pqPublicKey) external;
    function updateIdentity(bytes calldata newPqPublicKey) external;
    function removeIdentity() external;

    function getPQKey(address neoXAddress) external view returns (bytes memory);
    function isRegistered(address neoXAddress) external view returns (bool);
    function registrationTime(address neoXAddress) external view returns (uint256);
}

interface IQDAIncentives {
    event RewardDeposited(uint256 amount, address indexed depositor);
    event RewardClaimed(address indexed provider, uint256 amount);
    event ProviderRegistered(address indexed provider, uint8 providerType);
    event ProviderRemoved(address indexed provider);
    event RewardRateUpdated(uint256 oldRate, uint256 newRate);

    function pfork() external view returns (IPForkToken);
    function rewardPerBlock() external view returns (uint256);
    function totalActiveProviders() external view returns (uint256);

    function registerProvider(uint8 providerType) external;
    function removeProvider(address provider) external;
    function claimRewards() external;
    function depositRewards(uint256 amount) external;

    function pendingRewards(address provider) external view returns (uint256);
    function isActiveProvider(address provider) external view returns (bool);
    function providerInfo(address provider) external view returns (
        uint8 providerType,
        uint256 registeredAt,
        uint256 lastClaimBlock,
        uint256 totalClaimed
    );
}
