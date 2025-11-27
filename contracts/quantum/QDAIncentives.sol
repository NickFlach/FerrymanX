// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IQuantumLayer.sol";

/**
 * @title QDAIncentives
 * @notice Rewards DA and prover nodes with PFORK for their services.
 * 
 * Data Availability providers and ZK provers register and earn rewards
 * proportional to their participation. Rewards come from protocol fees
 * (priority fees, bridge fees) deposited into this contract.
 */
contract QDAIncentives is IQDAIncentives, Ownable, ReentrancyGuard {
    IPForkToken public immutable pfork;
    
    uint256 public rewardPerBlock;
    uint256 public lastRewardBlock;
    uint256 public accRewardPerShare;
    
    uint256 public constant PRECISION = 1e18;
    
    enum ProviderType { None, DAProvider, Prover, Sequencer }
    
    struct Provider {
        ProviderType providerType;
        uint256 registeredAt;
        uint256 lastClaimBlock;
        uint256 totalClaimed;
        uint256 rewardDebt;
        bool active;
    }
    
    mapping(address => Provider) private _providers;
    address[] private _activeProviders;
    mapping(address => uint256) private _providerIndex;
    
    uint256 public totalActiveProviders;
    uint256 public totalRewardsDistributed;
    uint256 public rewardPool;
    
    address public sequencerBondVault;
    
    uint256 public minStakeForDA;
    uint256 public minStakeForProver;

    event MinStakeUpdated(uint8 providerType, uint256 oldMin, uint256 newMin);
    event RewardPoolUpdated(uint256 newPool);

    modifier updateRewards() {
        _updateAccumulatedRewards();
        _;
    }

    constructor(
        address _pfork,
        uint256 _rewardPerBlock
    ) Ownable(msg.sender) {
        require(_pfork != address(0), "Invalid PFORK address");
        pfork = IPForkToken(_pfork);
        rewardPerBlock = _rewardPerBlock;
        lastRewardBlock = block.number;
    }

    function registerProvider(uint8 providerType) external nonReentrant updateRewards {
        require(providerType >= 1 && providerType <= 3, "Invalid provider type");
        require(!_providers[msg.sender].active, "Already registered");
        
        if (sequencerBondVault != address(0)) {
            uint256 stake = IQSequencerBondVault(sequencerBondVault).bondedBalance(msg.sender);
            
            if (ProviderType(providerType) == ProviderType.DAProvider) {
                require(stake >= minStakeForDA, "Insufficient stake for DA provider");
            } else if (ProviderType(providerType) == ProviderType.Prover) {
                require(stake >= minStakeForProver, "Insufficient stake for prover");
            } else if (ProviderType(providerType) == ProviderType.Sequencer) {
                require(
                    IQSequencerBondVault(sequencerBondVault).isSequencer(msg.sender),
                    "Not an active sequencer"
                );
            }
        }
        
        _providers[msg.sender] = Provider({
            providerType: ProviderType(providerType),
            registeredAt: block.timestamp,
            lastClaimBlock: block.number,
            totalClaimed: 0,
            rewardDebt: accRewardPerShare,
            active: true
        });
        
        _providerIndex[msg.sender] = _activeProviders.length;
        _activeProviders.push(msg.sender);
        totalActiveProviders++;
        
        emit ProviderRegistered(msg.sender, providerType);
    }

    function removeProvider(address provider) external nonReentrant updateRewards {
        require(
            msg.sender == provider || msg.sender == owner(),
            "Not authorized"
        );
        require(_providers[provider].active, "Not registered");
        
        _claimRewardsInternal(provider);
        
        _removeFromActiveList(provider);
        _providers[provider].active = false;
        totalActiveProviders--;
        
        emit ProviderRemoved(provider);
    }

    function claimRewards() external nonReentrant updateRewards {
        _claimRewardsInternal(msg.sender);
    }

    function _claimRewardsInternal(address provider) internal {
        Provider storage p = _providers[provider];
        require(p.active, "Not registered");
        
        uint256 pending = _pendingRewardsInternal(provider);
        
        if (pending > 0 && pending <= rewardPool) {
            p.lastClaimBlock = block.number;
            p.totalClaimed += pending;
            p.rewardDebt = accRewardPerShare;
            
            rewardPool -= pending;
            totalRewardsDistributed += pending;
            
            require(pfork.transfer(provider, pending), "Reward transfer failed");
            
            emit RewardClaimed(provider, pending);
        }
    }

    function depositRewards(uint256 amount) external nonReentrant {
        require(amount > 0, "Cannot deposit zero");
        
        require(
            pfork.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );
        
        rewardPool += amount;
        
        emit RewardDeposited(amount, msg.sender);
        emit RewardPoolUpdated(rewardPool);
    }

    function _updateAccumulatedRewards() internal {
        if (block.number <= lastRewardBlock) {
            return;
        }
        
        if (totalActiveProviders == 0) {
            lastRewardBlock = block.number;
            return;
        }
        
        uint256 blocks = block.number - lastRewardBlock;
        uint256 reward = blocks * rewardPerBlock;
        
        if (reward > rewardPool) {
            reward = rewardPool;
        }
        
        if (reward > 0) {
            accRewardPerShare += (reward * PRECISION) / totalActiveProviders;
        }
        
        lastRewardBlock = block.number;
    }

    function pendingRewards(address provider) external view returns (uint256) {
        return _pendingRewardsInternal(provider);
    }

    function _pendingRewardsInternal(address provider) internal view returns (uint256) {
        Provider storage p = _providers[provider];
        if (!p.active) return 0;
        
        uint256 _accRewardPerShare = accRewardPerShare;
        
        if (block.number > lastRewardBlock && totalActiveProviders > 0) {
            uint256 blocks = block.number - lastRewardBlock;
            uint256 reward = blocks * rewardPerBlock;
            if (reward > rewardPool) {
                reward = rewardPool;
            }
            _accRewardPerShare += (reward * PRECISION) / totalActiveProviders;
        }
        
        return (_accRewardPerShare - p.rewardDebt) / PRECISION;
    }

    function isActiveProvider(address provider) external view returns (bool) {
        return _providers[provider].active;
    }

    function providerInfo(address provider) external view returns (
        uint8 providerType,
        uint256 registeredAt,
        uint256 lastClaimBlock,
        uint256 totalClaimed
    ) {
        Provider storage p = _providers[provider];
        return (
            uint8(p.providerType),
            p.registeredAt,
            p.lastClaimBlock,
            p.totalClaimed
        );
    }

    function getProvider(address provider) external view returns (
        ProviderType providerType,
        uint256 registeredAt,
        uint256 lastClaimBlock,
        uint256 totalClaimed,
        uint256 pendingAmount,
        bool active
    ) {
        Provider storage p = _providers[provider];
        return (
            p.providerType,
            p.registeredAt,
            p.lastClaimBlock,
            p.totalClaimed,
            _pendingRewardsInternal(provider),
            p.active
        );
    }

    function getActiveProviders(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        if (offset >= _activeProviders.length) {
            return new address[](0);
        }
        
        uint256 end = offset + limit;
        if (end > _activeProviders.length) {
            end = _activeProviders.length;
        }
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _activeProviders[i];
        }
        
        return result;
    }

    function _removeFromActiveList(address provider) internal {
        uint256 index = _providerIndex[provider];
        uint256 lastIndex = _activeProviders.length - 1;
        
        if (index != lastIndex) {
            address lastProvider = _activeProviders[lastIndex];
            _activeProviders[index] = lastProvider;
            _providerIndex[lastProvider] = index;
        }
        
        _activeProviders.pop();
        delete _providerIndex[provider];
    }

    function setRewardPerBlock(uint256 newRewardPerBlock) external onlyOwner updateRewards {
        emit RewardRateUpdated(rewardPerBlock, newRewardPerBlock);
        rewardPerBlock = newRewardPerBlock;
    }

    function setSequencerBondVault(address vault) external onlyOwner {
        sequencerBondVault = vault;
    }

    function setMinStakes(
        uint256 _minStakeForDA,
        uint256 _minStakeForProver
    ) external onlyOwner {
        emit MinStakeUpdated(1, minStakeForDA, _minStakeForDA);
        emit MinStakeUpdated(2, minStakeForProver, _minStakeForProver);
        minStakeForDA = _minStakeForDA;
        minStakeForProver = _minStakeForProver;
    }

    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(amount <= rewardPool, "Exceeds reward pool");
        rewardPool -= amount;
        require(pfork.transfer(to, amount), "Transfer failed");
    }

    function getStats() external view returns (
        uint256 _rewardPerBlock,
        uint256 _rewardPool,
        uint256 _totalActiveProviders,
        uint256 _totalRewardsDistributed,
        uint256 _accRewardPerShare
    ) {
        return (
            rewardPerBlock,
            rewardPool,
            totalActiveProviders,
            totalRewardsDistributed,
            accRewardPerShare
        );
    }
}
