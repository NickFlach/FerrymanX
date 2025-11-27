// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IQuantumLayer.sol";

/**
 * @title QPriorityFeeManager
 * @notice Manages PFORK-based priority fees for Quantum Layer transactions.
 * 
 * Users can purchase "priority units" with PFORK to get faster processing
 * in quantum batches. A portion of PFORK can be burned (deflationary).
 * Sequencers read priority scores to order transactions accordingly.
 */
contract QPriorityFeeManager is IQPriorityFeeManager, Ownable, ReentrancyGuard {
    IPForkToken public immutable pfork;
    
    uint256 public basePricePerUnit;
    uint256 public burnRateBps;
    
    address public sequencerBondVault;
    address public governance;
    address public burnAddress;
    address public daIncentives;
    
    struct UserPriority {
        uint256 unitsAvailable;
        uint256 totalPurchased;
        uint256 lastPurchaseBlock;
    }
    
    mapping(address => mapping(uint256 => UserPriority)) private _userPriority;
    mapping(uint256 => uint256) public batchTotalPriority;
    
    uint256 public totalBurned;
    uint256 public totalCollected;
    uint256 public protocolPool;
    
    uint256 public constant MAX_BURN_RATE = 5000;
    uint256 public constant BPS_DENOMINATOR = 10000;

    modifier onlySequencer() {
        if (sequencerBondVault != address(0)) {
            require(
                IQSequencerBondVault(sequencerBondVault).isSequencer(msg.sender),
                "Not an active sequencer"
            );
        }
        _;
    }

    modifier onlyGovernance() {
        require(msg.sender == governance || msg.sender == owner(), "Not governance");
        _;
    }

    constructor(
        address _pfork,
        uint256 _basePricePerUnit,
        uint256 _burnRateBps
    ) Ownable(msg.sender) {
        require(_pfork != address(0), "Invalid PFORK address");
        require(_burnRateBps <= MAX_BURN_RATE, "Burn rate too high");
        
        pfork = IPForkToken(_pfork);
        basePricePerUnit = _basePricePerUnit;
        burnRateBps = _burnRateBps;
        governance = msg.sender;
        burnAddress = address(0xdead);
    }

    function buyPriority(uint256 batchHint, uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot buy with zero amount");
        require(amount >= basePricePerUnit, "Amount below minimum");
        
        require(
            pfork.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        uint256 burnAmount = (amount * burnRateBps) / BPS_DENOMINATOR;
        uint256 protocolAmount = amount - burnAmount;
        
        if (burnAmount > 0) {
            require(pfork.transfer(burnAddress, burnAmount), "Burn transfer failed");
            totalBurned += burnAmount;
        }
        
        protocolPool += protocolAmount;
        totalCollected += amount;
        
        uint256 priorityUnits = amount / basePricePerUnit;
        
        UserPriority storage userPrio = _userPriority[msg.sender][batchHint];
        userPrio.unitsAvailable += priorityUnits;
        userPrio.totalPurchased += priorityUnits;
        userPrio.lastPurchaseBlock = block.number;
        
        batchTotalPriority[batchHint] += priorityUnits;
        
        emit PriorityPurchased(msg.sender, batchHint, amount, priorityUnits);
    }

    function priorityScore(address user, uint256 batchId) external view returns (uint256) {
        return _userPriority[user][batchId].unitsAvailable;
    }

    function consumePriority(
        address user,
        uint256 batchId,
        uint256 units
    ) external onlySequencer {
        UserPriority storage userPrio = _userPriority[user][batchId];
        require(userPrio.unitsAvailable >= units, "Insufficient priority units");
        
        userPrio.unitsAvailable -= units;
        batchTotalPriority[batchId] -= units;
        
        emit PriorityConsumed(user, batchId, units);
    }

    function getUserPriority(
        address user,
        uint256 batchId
    ) external view returns (
        uint256 unitsAvailable,
        uint256 totalPurchased,
        uint256 lastPurchaseBlock
    ) {
        UserPriority storage prio = _userPriority[user][batchId];
        return (prio.unitsAvailable, prio.totalPurchased, prio.lastPurchaseBlock);
    }

    function estimatePriorityUnits(uint256 amount) external view returns (uint256) {
        if (amount < basePricePerUnit) return 0;
        return amount / basePricePerUnit;
    }

    function setBasePricePerUnit(uint256 newPrice) external onlyGovernance {
        require(newPrice > 0, "Price must be positive");
        emit PriorityParamsUpdated(newPrice, burnRateBps);
        basePricePerUnit = newPrice;
    }

    function setBurnRateBps(uint256 newBurnRate) external onlyGovernance {
        require(newBurnRate <= MAX_BURN_RATE, "Burn rate too high");
        emit PriorityParamsUpdated(basePricePerUnit, newBurnRate);
        burnRateBps = newBurnRate;
    }

    function setSequencerBondVault(address vault) external onlyOwner {
        sequencerBondVault = vault;
    }

    function setGovernance(address newGovernance) external onlyOwner {
        require(newGovernance != address(0), "Invalid governance");
        governance = newGovernance;
    }

    function setBurnAddress(address newBurnAddress) external onlyOwner {
        require(newBurnAddress != address(0), "Invalid burn address");
        burnAddress = newBurnAddress;
    }

    function withdrawProtocolFunds(address to, uint256 amount) external onlyOwner {
        require(amount <= protocolPool, "Exceeds protocol pool");
        protocolPool -= amount;
        require(pfork.transfer(to, amount), "Transfer failed");
    }

    function fundDAIncentives(uint256 amount) external onlyGovernance {
        require(daIncentives != address(0), "DA incentives not set");
        require(amount <= protocolPool, "Exceeds protocol pool");
        
        protocolPool -= amount;
        
        require(pfork.approve(daIncentives, amount), "Approve failed");
        IQDAIncentives(daIncentives).depositRewards(amount);
    }

    function setDAIncentives(address _daIncentives) external onlyOwner {
        require(_daIncentives != address(0), "Invalid address");
        daIncentives = _daIncentives;
    }

    function getStats() external view returns (
        uint256 _totalBurned,
        uint256 _totalCollected,
        uint256 _protocolPool,
        uint256 _basePricePerUnit,
        uint256 _burnRateBps
    ) {
        return (totalBurned, totalCollected, protocolPool, basePricePerUnit, burnRateBps);
    }
}
