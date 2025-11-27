// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IQuantumLayer.sol";

/**
 * @title QSequencerBondVault
 * @notice Manages PFORK staking for Quantum Layer sequencers.
 * 
 * Sequencers must stake PFORK to participate in batch ordering.
 * Slashing is available for misbehavior. Unstaking has a delay
 * period for security (prevents stake-and-run attacks).
 */
contract QSequencerBondVault is IQSequencerBondVault, Ownable, ReentrancyGuard {
    IPForkToken public immutable pfork;
    
    uint256 public minBondAmount;
    uint256 public unstakeDelay;
    
    address public slasher;
    address public governance;
    
    struct SequencerInfo {
        uint256 bonded;
        uint256 pendingUnstakeAmount;
        uint256 unstakeUnlockTime;
        bool active;
    }
    
    mapping(address => SequencerInfo) private _sequencers;
    address[] private _activeSequencerList;
    mapping(address => uint256) private _sequencerIndex;
    
    uint256 public totalBonded;
    uint256 public slashedPool;

    modifier onlySlasher() {
        require(msg.sender == slasher || msg.sender == owner(), "Not authorized to slash");
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance || msg.sender == owner(), "Not governance");
        _;
    }

    constructor(
        address _pfork,
        uint256 _minBondAmount,
        uint256 _unstakeDelay
    ) Ownable(msg.sender) {
        require(_pfork != address(0), "Invalid PFORK address");
        pfork = IPForkToken(_pfork);
        minBondAmount = _minBondAmount;
        unstakeDelay = _unstakeDelay;
        slasher = msg.sender;
        governance = msg.sender;
    }

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot stake zero");
        
        SequencerInfo storage info = _sequencers[msg.sender];
        
        require(
            pfork.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        info.bonded += amount;
        totalBonded += amount;
        
        if (!info.active && info.bonded >= minBondAmount) {
            info.active = true;
            _sequencerIndex[msg.sender] = _activeSequencerList.length;
            _activeSequencerList.push(msg.sender);
        }
        
        emit Staked(msg.sender, amount);
    }

    function requestUnstake(uint256 amount) external nonReentrant {
        SequencerInfo storage info = _sequencers[msg.sender];
        require(info.bonded >= amount, "Insufficient bonded balance");
        require(info.pendingUnstakeAmount == 0, "Already have pending unstake");
        require(amount > 0, "Cannot unstake zero");
        
        info.pendingUnstakeAmount = amount;
        info.unstakeUnlockTime = block.timestamp + unstakeDelay;
        
        if (info.bonded - amount < minBondAmount && info.active) {
            _removeFromActiveList(msg.sender);
            info.active = false;
        }
    }

    function executeUnstake() external nonReentrant {
        SequencerInfo storage info = _sequencers[msg.sender];
        require(info.pendingUnstakeAmount > 0, "No pending unstake");
        require(block.timestamp >= info.unstakeUnlockTime, "Unstake not yet unlocked");
        
        uint256 amount = info.pendingUnstakeAmount;
        info.bonded -= amount;
        info.pendingUnstakeAmount = 0;
        info.unstakeUnlockTime = 0;
        totalBonded -= amount;
        
        require(pfork.transfer(msg.sender, amount), "Transfer failed");
        
        emit Unstaked(msg.sender, amount);
    }

    function cancelUnstake() external {
        SequencerInfo storage info = _sequencers[msg.sender];
        require(info.pendingUnstakeAmount > 0, "No pending unstake");
        
        if (!info.active && info.bonded >= minBondAmount) {
            info.active = true;
            _sequencerIndex[msg.sender] = _activeSequencerList.length;
            _activeSequencerList.push(msg.sender);
        }
        
        info.pendingUnstakeAmount = 0;
        info.unstakeUnlockTime = 0;
    }

    function slash(
        address sequencer,
        uint256 amount,
        bytes calldata reason
    ) external onlySlasher nonReentrant {
        SequencerInfo storage info = _sequencers[sequencer];
        require(info.bonded >= amount, "Slash exceeds bond");
        
        info.bonded -= amount;
        totalBonded -= amount;
        slashedPool += amount;
        
        if (info.bonded < minBondAmount && info.active) {
            _removeFromActiveList(sequencer);
            info.active = false;
        }
        
        if (info.pendingUnstakeAmount > info.bonded) {
            info.pendingUnstakeAmount = info.bonded;
        }
        
        emit Slashed(sequencer, amount, reason);
    }

    function bondedBalance(address sequencer) external view returns (uint256) {
        return _sequencers[sequencer].bonded;
    }

    function isSequencer(address sequencer) external view returns (bool) {
        return _sequencers[sequencer].active;
    }

    function pendingUnstake(address sequencer) external view returns (uint256 amount, uint256 unlockTime) {
        SequencerInfo storage info = _sequencers[sequencer];
        return (info.pendingUnstakeAmount, info.unstakeUnlockTime);
    }

    function getSequencerInfo(address sequencer) external view returns (
        uint256 bonded,
        uint256 pendingAmount,
        uint256 unlockTime,
        bool active
    ) {
        SequencerInfo storage info = _sequencers[sequencer];
        return (info.bonded, info.pendingUnstakeAmount, info.unstakeUnlockTime, info.active);
    }

    function activeSequencerCount() external view returns (uint256) {
        return _activeSequencerList.length;
    }

    function activeSequencerAt(uint256 index) external view returns (address) {
        require(index < _activeSequencerList.length, "Index out of bounds");
        return _activeSequencerList[index];
    }

    function setMinBondAmount(uint256 newMinBond) external onlyGovernance {
        emit MinBondUpdated(minBondAmount, newMinBond);
        minBondAmount = newMinBond;
    }

    function setUnstakeDelay(uint256 newDelay) external onlyGovernance {
        emit UnstakeDelayUpdated(unstakeDelay, newDelay);
        unstakeDelay = newDelay;
    }

    function setSlasher(address newSlasher) external onlyOwner {
        require(newSlasher != address(0), "Invalid slasher");
        slasher = newSlasher;
    }

    function setGovernance(address newGovernance) external onlyOwner {
        require(newGovernance != address(0), "Invalid governance");
        governance = newGovernance;
    }

    function withdrawSlashedFunds(address to, uint256 amount) external onlyOwner {
        require(amount <= slashedPool, "Exceeds slashed pool");
        slashedPool -= amount;
        require(pfork.transfer(to, amount), "Transfer failed");
    }

    function _removeFromActiveList(address sequencer) internal {
        uint256 index = _sequencerIndex[sequencer];
        uint256 lastIndex = _activeSequencerList.length - 1;
        
        if (index != lastIndex) {
            address lastSequencer = _activeSequencerList[lastIndex];
            _activeSequencerList[index] = lastSequencer;
            _sequencerIndex[lastSequencer] = index;
        }
        
        _activeSequencerList.pop();
        delete _sequencerIndex[sequencer];
    }
}
