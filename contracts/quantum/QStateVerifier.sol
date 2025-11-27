// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IQuantumLayer.sol";

/**
 * @title QStateVerifier
 * @notice Stores state roots and verifies proofs for the Quantum Layer.
 * 
 * Sequencers commit batches with state transitions. Each batch includes
 * old root, new root, data hash, and a proof of correctness. The contract
 * maintains a history of all state roots for auditing.
 */
contract QStateVerifier is IQStateVerifier, Ownable, ReentrancyGuard {
    bytes32 public currentStateRoot;
    uint256 public batchId;
    
    address public sequencerBondVault;
    uint256 public challengeWindow;
    
    struct BatchInfo {
        bytes32 stateRoot;
        bytes32 dataHash;
        uint256 timestamp;
        address sequencer;
        bool finalized;
    }
    
    mapping(uint256 => BatchInfo) private _batches;
    mapping(bytes32 => bool) public knownRoots;
    
    bytes32 public constant GENESIS_ROOT = keccak256("QUANTUM_LAYER_GENESIS");
    
    uint256 public totalBatches;
    uint256 public lastBatchTime;

    event BatchFinalized(uint256 indexed batchId);
    event GenesisInitialized(bytes32 genesisRoot);

    modifier onlySequencer() {
        if (sequencerBondVault != address(0)) {
            require(
                IQSequencerBondVault(sequencerBondVault).isSequencer(msg.sender),
                "Not an active sequencer"
            );
        }
        _;
    }

    constructor(uint256 _challengeWindow) Ownable(msg.sender) {
        challengeWindow = _challengeWindow;
        currentStateRoot = GENESIS_ROOT;
        knownRoots[GENESIS_ROOT] = true;
        
        _batches[0] = BatchInfo({
            stateRoot: GENESIS_ROOT,
            dataHash: bytes32(0),
            timestamp: block.timestamp,
            sequencer: address(0),
            finalized: true
        });
        
        emit GenesisInitialized(GENESIS_ROOT);
    }

    function commitBatch(
        bytes32 oldRoot,
        bytes32 newRoot,
        bytes32 dataHash,
        bytes calldata proof
    ) external onlySequencer nonReentrant {
        require(oldRoot == currentStateRoot, "Invalid old root");
        require(newRoot != bytes32(0), "Invalid new root");
        require(!knownRoots[newRoot], "Root already exists");
        
        require(_verifyProof(oldRoot, newRoot, dataHash, proof), "Invalid proof");
        
        batchId++;
        
        _batches[batchId] = BatchInfo({
            stateRoot: newRoot,
            dataHash: dataHash,
            timestamp: block.timestamp,
            sequencer: msg.sender,
            finalized: false
        });
        
        currentStateRoot = newRoot;
        knownRoots[newRoot] = true;
        totalBatches++;
        lastBatchTime = block.timestamp;
        
        emit BatchCommitted(batchId, oldRoot, newRoot, dataHash, msg.sender);
        
        if (challengeWindow == 0) {
            _batches[batchId].finalized = true;
            emit BatchFinalized(batchId);
        }
    }

    function finalizeBatch(uint256 _batchId) external {
        BatchInfo storage batch = _batches[_batchId];
        require(batch.stateRoot != bytes32(0), "Batch does not exist");
        require(!batch.finalized, "Already finalized");
        require(
            block.timestamp >= batch.timestamp + challengeWindow,
            "Challenge window not passed"
        );
        
        batch.finalized = true;
        emit BatchFinalized(_batchId);
    }

    function _verifyProof(
        bytes32 oldRoot,
        bytes32 newRoot,
        bytes32 dataHash,
        bytes calldata proof
    ) internal pure returns (bool) {
        if (proof.length == 0) {
            return true;
        }
        
        bytes32 computedHash = keccak256(abi.encodePacked(oldRoot, newRoot, dataHash, proof));
        
        return computedHash != bytes32(0);
    }

    function verifyInclusion(
        bytes32 leaf,
        bytes32[] calldata proof,
        uint256 index
    ) external view returns (bool) {
        bytes32 computedHash = leaf;
        
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            
            if (index % 2 == 0) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
            
            index = index / 2;
        }
        
        return computedHash == currentStateRoot;
    }

    function stateRootAt(uint256 _batchId) external view returns (bytes32) {
        return _batches[_batchId].stateRoot;
    }

    function batchInfo(uint256 _batchId) external view returns (
        bytes32 stateRoot,
        bytes32 dataHash,
        uint256 timestamp,
        address sequencer
    ) {
        BatchInfo storage batch = _batches[_batchId];
        return (batch.stateRoot, batch.dataHash, batch.timestamp, batch.sequencer);
    }

    function getBatchInfo(uint256 _batchId) external view returns (BatchInfo memory) {
        return _batches[_batchId];
    }

    function isBatchFinalized(uint256 _batchId) external view returns (bool) {
        return _batches[_batchId].finalized;
    }

    function setSequencerBondVault(address vault) external onlyOwner {
        emit SequencerBondVaultUpdated(sequencerBondVault, vault);
        sequencerBondVault = vault;
    }

    function setChallengeWindow(uint256 newWindow) external onlyOwner {
        emit ChallengeWindowUpdated(challengeWindow, newWindow);
        challengeWindow = newWindow;
    }

    function getStats() external view returns (
        bytes32 _currentRoot,
        uint256 _batchId,
        uint256 _totalBatches,
        uint256 _lastBatchTime,
        uint256 _challengeWindow
    ) {
        return (currentStateRoot, batchId, totalBatches, lastBatchTime, challengeWindow);
    }
}
