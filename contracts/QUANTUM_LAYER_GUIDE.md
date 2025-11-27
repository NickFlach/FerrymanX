# Quantum Integration Layer - Complete Architecture Guide

## Overview

The Quantum Integration Layer (QIL) is a rollup-style system that uses **PFORK** as its central economic token. It enables high-frequency, quantum-optimized transactions while settling to Neo X for finality.

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUANTUM INTEGRATION LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│   │   Users     │───▶│  Q-Layer    │───▶│  Neo X (L1)     │   │
│   │             │    │  (Off-chain) │    │  Settlement     │   │
│   └─────────────┘    └──────────────┘    └─────────────────┘   │
│         │                   │                     │             │
│         │ PFORK             │ PFORK              │ State       │
│         │ Deposits          │ Priority           │ Roots       │
│         ▼                   ▼                     ▼             │
│   ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐   │
│   │QBridgeVault │    │QPriorityFee  │    │QStateVerifier   │   │
│   │             │    │Manager       │    │                 │   │
│   └─────────────┘    └──────────────┘    └─────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## PFORK Token Utility

PFORK serves multiple roles in the Quantum Layer:

| Function | Contract | Mechanism |
|----------|----------|-----------|
| **Sequencer Security** | QSequencerBondVault | Stake PFORK to become a sequencer |
| **Priority Fees** | QPriorityFeeManager | Pay PFORK for faster transaction processing |
| **Governance** | QGovernance | Vote on protocol parameters with PFORK |
| **Identity Bonds** | QIdentityRegistry | Stake PFORK to register PQ public keys |
| **DA/Prover Rewards** | QDAIncentives | Earn PFORK for providing data availability |

---

## Contract Architecture

### Phase 0: Core Infrastructure (MVP)

#### 1. QSequencerBondVault
Manages sequencer staking and slashing.

```solidity
// Stake PFORK to become a sequencer
function stake(uint256 amount) external;

// Request unstaking (initiates delay period)
function requestUnstake(uint256 amount) external;

// Execute unstake after delay
function executeUnstake() external;

// Check if address is active sequencer
function isSequencer(address) external view returns (bool);

// Slash misbehaving sequencer
function slash(address sequencer, uint256 amount, bytes reason) external;
```

**Parameters:**
- `minBondAmount`: Minimum PFORK required (default: 10,000 PFORK)
- `unstakeDelay`: Time before unstaked funds are available (default: 7 days)

#### 2. QPriorityFeeManager
Handles priority fees for quantum batch ordering.

```solidity
// Purchase priority units for a batch
function buyPriority(uint256 batchHint, uint256 amount) external;

// Check priority score for user/batch
function priorityScore(address user, uint256 batchId) external view returns (uint256);

// Sequencer consumes priority (during ordering)
function consumePriority(address user, uint256 batchId, uint256 units) external;
```

**Parameters:**
- `basePricePerUnit`: PFORK cost per priority unit (default: 100 PFORK)
- `burnRateBps`: Percentage of PFORK burned (default: 10%)

#### 3. QStateVerifier
Stores and verifies state transitions.

```solidity
// Commit a new batch (sequencer only)
function commitBatch(
    bytes32 oldRoot,
    bytes32 newRoot,
    bytes32 dataHash,
    bytes proof
) external;

// Verify Merkle inclusion proof
function verifyInclusion(
    bytes32 leaf,
    bytes32[] proof,
    uint256 index
) external view returns (bool);

// Get current state root
function currentStateRoot() external view returns (bytes32);
```

**Parameters:**
- `challengeWindow`: Time for fraud proofs (default: 1 hour)

#### 4. QBridgeVault
Manages deposits and exits to/from the Q-layer.

```solidity
// Deposit assets into Q-layer
function deposit(address asset, uint256 amount) external;

// Request exit from Q-layer
function requestExit(address asset, uint256 amount) external returns (uint256 exitId);

// Complete exit with proof
function completeExit(uint256 exitId, bytes proof, bytes leafData) external;

// Priority exit (faster with PFORK priority)
function priorityExit(uint256 exitId, bytes proof, bytes leafData) external;
```

**Parameters:**
- `exitDelay`: Blocks until normal exit unlocks (default: 1000)
- `priorityExitDelay`: Blocks for priority exit (default: 100)

---

### Phase 1: Governance & Incentives

#### 5. QGovernance
PFORK-based voting for protocol changes.

```solidity
// Create a proposal
function propose(address[] targets, bytes[] calldatas) external returns (uint256);

// Cast vote
function castVote(uint256 proposalId, bool support) external;

// Execute passed proposal
function execute(uint256 proposalId) external;

// Get proposal state
function state(uint256 proposalId) external view returns (ProposalState);
```

**Parameters:**
- `proposalThreshold`: PFORK required to create proposal (default: 100,000)
- `votingPeriod`: Blocks for voting (default: ~3 days)
- `quorum`: Minimum votes required (default: 1M PFORK)

#### 6. QDAIncentives
Rewards for Data Availability providers and provers.

```solidity
// Register as a provider
function registerProvider(uint8 providerType) external;

// Claim earned rewards
function claimRewards() external;

// Deposit rewards into pool
function depositRewards(uint256 amount) external;

// Check pending rewards
function pendingRewards(address provider) external view returns (uint256);
```

**Provider Types:**
- `1` = DA Provider
- `2` = Prover
- `3` = Sequencer

---

### Phase 2: Post-Quantum Identity

#### 7. QIdentityRegistry
Maps Neo X addresses to post-quantum public keys.

```solidity
// Register PQ identity (requires PFORK bond)
function registerIdentity(bytes pqPublicKey) external;

// Update PQ public key
function updateIdentity(bytes newPqPublicKey) external;

// Remove identity and reclaim bond
function removeIdentity() external;

// Get PQ key for address
function getPQKey(address neoXAddress) external view returns (bytes);
```

**Supported PQ Algorithms:**
- Dilithium (NIST standard)
- Falcon
- SPHINCS+

---

## Transaction Lifecycle

### 1. Deposit into Q-Layer

```
User → QBridgeVault.deposit(PFORK, 1000)
         │
         ▼
   Event: Deposited(user, PFORK, 1000, depositId)
         │
         ▼
   Q-Layer credits user's internal balance
```

### 2. Quantum Transactions (Off-chain)

```
User signs Q-transaction with PQ key
         │
         ▼
   Sequencer receives and orders transactions
   (Priority users ordered first based on QPriorityFeeManager score)
         │
         ▼
   Quantum algorithms optimize:
   - Portfolio rebalancing
   - AMM routing
   - Risk analysis
         │
         ▼
   Sequencer produces newStateRoot + witness
```

### 3. Batch Commitment

```
Prover generates zk-proof
         │
         ▼
Sequencer → QStateVerifier.commitBatch(oldRoot, newRoot, dataHash, proof)
         │
         ▼
   Event: BatchCommitted(batchId, oldRoot, newRoot, dataHash, sequencer)
         │
         ▼
   currentStateRoot = newRoot
```

### 4. Exit from Q-Layer

```
User → QBridgeVault.requestExit(PFORK, 500)
         │
         ▼
   Wait for exitDelay blocks (or use priority exit)
         │
         ▼
User → QBridgeVault.completeExit(exitId, inclusionProof, leafData)
         │
         ▼
   QStateVerifier.verifyInclusion() validates proof
         │
         ▼
   Assets transferred back to user on Neo X
```

---

## Sequencer Flow

### Becoming a Sequencer

```solidity
// 1. Approve PFORK spending
pfork.approve(sequencerBondVault, 10000e18);

// 2. Stake PFORK
sequencerBondVault.stake(10000e18);

// 3. Now isSequencer(yourAddress) returns true
```

### Operating as Sequencer

```javascript
// Off-chain sequencer loop
while (true) {
    // 1. Collect pending Q-transactions
    const txs = await collectTransactions();
    
    // 2. Sort by priority score
    const sorted = await sortByPriority(txs, priorityFeeManager);
    
    // 3. Apply state transitions
    const { newRoot, witness } = applyTransitions(sorted);
    
    // 4. Generate proof
    const proof = await generateProof(witness);
    
    // 5. Commit batch on-chain
    await stateVerifier.commitBatch(oldRoot, newRoot, dataHash, proof);
}
```

### Priority Ordering Logic

```javascript
async function sortByPriority(txs, manager) {
    const scored = await Promise.all(txs.map(async tx => ({
        tx,
        priority: await manager.priorityScore(tx.sender, currentBatchId)
    })));
    
    return scored.sort((a, b) => b.priority - a.priority);
}
```

---

## Security Model

### Double-Spend Prevention

1. **Nonces**: Each Q-account has monotonic nonce
2. **Nullifiers**: UTXO-style for privacy transactions
3. **ZK Proofs**: Circuit enforces valid state transitions

### Sequencer Misbehavior

| Violation | Consequence |
|-----------|-------------|
| Invalid state transition | Proof fails, batch rejected |
| Censoring transactions | Governance can slash via `slash()` |
| Equivocation | Automatic slashing if detected |

### Challenge System

```
Batch committed → Challenge window starts
         │
         ▼
   Anyone can submit fraud proof during window
         │
         ▼
   If valid fraud proof: sequencer slashed, batch reverted
   If no challenge: batch finalized
```

---

## Deployment

### Prerequisites

```bash
npm install --save-dev @openzeppelin/contracts hardhat @nomicfoundation/hardhat-toolbox
```

### Deploy to Neo X

```bash
export DEPLOYER_PRIVATE_KEY="your_private_key"
npx hardhat run scripts/deploy-quantum-layer.cjs --network neox
```

### Verify Contracts

```bash
npx hardhat verify --network neox <contract_address> <constructor_args>
```

---

## Configuration Reference

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minBondAmount` | 10,000 PFORK | Minimum to become sequencer |
| `unstakeDelay` | 7 days | Time before unstake available |
| `basePricePerUnit` | 100 PFORK | Cost per priority unit |
| `burnRateBps` | 1000 (10%) | PFORK burned on priority purchase |
| `challengeWindow` | 1 hour | Time for fraud proofs |
| `exitDelay` | 1000 blocks | Normal exit delay |
| `priorityExitDelay` | 100 blocks | Fast exit with priority |
| `proposalThreshold` | 100,000 PFORK | Required to create proposal |
| `votingPeriod` | 17,280 blocks (~3 days) | Voting duration |
| `quorum` | 1,000,000 PFORK | Minimum votes for proposal |
| `identityBondAmount` | 1,000 PFORK | PQ identity registration |
| `rewardPerBlock` | 10 PFORK | DA/prover reward rate |

---

## Future Phases

### Phase 3: DeFi Primitives

- **QCollateralVault**: Use PFORK as collateral for leverage
- **QSynthManager**: Mint synthetic assets backed by PFORK
- **QLiquidityPools**: Native quantum-optimized AMM

### Phase 4: Verifiable Quantum

- Mahadev-style verification protocols
- Classical proofs of quantum computation
- True quantum advantage for specific algorithms

---

## Appendix: Contract ABIs

See `contracts/interfaces/IQuantumLayer.sol` for complete interface definitions.

---

## Support

For questions or issues:
- GitHub Issues: [your-repo]/issues
- Discord: [your-discord]
- Documentation: [your-docs]
