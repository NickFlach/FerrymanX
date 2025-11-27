// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IQuantumLayer.sol";

/**
 * @title QIdentityRegistry
 * @notice Maps Neo X addresses to post-quantum public keys with PFORK bonds.
 * 
 * Users register their post-quantum cryptographic keys (Dilithium, Falcon, etc.)
 * by staking a PFORK bond. This provides anti-sybil protection and ensures
 * commitment to the identity. The Q-layer circuits verify PQ signatures
 * for transactions using these registered keys.
 */
contract QIdentityRegistry is IQIdentityRegistry, Ownable, ReentrancyGuard {
    IPForkToken public immutable pfork;
    
    uint256 public bondAmount;
    uint256 public cooldownPeriod;
    
    struct Identity {
        bytes pqPublicKey;
        uint256 bondedAmount;
        uint256 registeredAt;
        uint256 lastUpdated;
        bool active;
    }
    
    mapping(address => Identity) private _identities;
    mapping(bytes32 => address) private _keyToAddress;
    
    address[] private _registeredAddresses;
    mapping(address => uint256) private _addressIndex;
    
    uint256 public totalRegistered;
    uint256 public totalBonded;
    
    uint256 public constant MIN_KEY_LENGTH = 32;
    uint256 public constant MAX_KEY_LENGTH = 4096;

    event CooldownPeriodUpdated(uint256 oldPeriod, uint256 newPeriod);
    event KeyHashCollision(address indexed existingOwner, address indexed newOwner);

    constructor(
        address _pfork,
        uint256 _bondAmount,
        uint256 _cooldownPeriod
    ) Ownable(msg.sender) {
        require(_pfork != address(0), "Invalid PFORK address");
        pfork = IPForkToken(_pfork);
        bondAmount = _bondAmount;
        cooldownPeriod = _cooldownPeriod;
    }

    function registerIdentity(bytes calldata pqPublicKey) external nonReentrant {
        require(pqPublicKey.length >= MIN_KEY_LENGTH, "Key too short");
        require(pqPublicKey.length <= MAX_KEY_LENGTH, "Key too long");
        require(!_identities[msg.sender].active, "Already registered");
        
        bytes32 keyHash = keccak256(pqPublicKey);
        require(
            _keyToAddress[keyHash] == address(0),
            "Key already registered by another address"
        );
        
        require(
            pfork.transferFrom(msg.sender, address(this), bondAmount),
            "Bond transfer failed"
        );
        
        _identities[msg.sender] = Identity({
            pqPublicKey: pqPublicKey,
            bondedAmount: bondAmount,
            registeredAt: block.timestamp,
            lastUpdated: block.timestamp,
            active: true
        });
        
        _keyToAddress[keyHash] = msg.sender;
        
        _addressIndex[msg.sender] = _registeredAddresses.length;
        _registeredAddresses.push(msg.sender);
        
        totalRegistered++;
        totalBonded += bondAmount;
        
        emit IdentityRegistered(msg.sender, pqPublicKey, bondAmount);
    }

    function updateIdentity(bytes calldata newPqPublicKey) external nonReentrant {
        require(_identities[msg.sender].active, "Not registered");
        require(newPqPublicKey.length >= MIN_KEY_LENGTH, "Key too short");
        require(newPqPublicKey.length <= MAX_KEY_LENGTH, "Key too long");
        
        Identity storage identity = _identities[msg.sender];
        require(
            block.timestamp >= identity.lastUpdated + cooldownPeriod,
            "Cooldown period not passed"
        );
        
        bytes32 newKeyHash = keccak256(newPqPublicKey);
        require(
            _keyToAddress[newKeyHash] == address(0) || _keyToAddress[newKeyHash] == msg.sender,
            "Key already registered by another address"
        );
        
        bytes32 oldKeyHash = keccak256(identity.pqPublicKey);
        delete _keyToAddress[oldKeyHash];
        
        identity.pqPublicKey = newPqPublicKey;
        identity.lastUpdated = block.timestamp;
        
        _keyToAddress[newKeyHash] = msg.sender;
        
        emit IdentityUpdated(msg.sender, newPqPublicKey);
    }

    function removeIdentity() external nonReentrant {
        Identity storage identity = _identities[msg.sender];
        require(identity.active, "Not registered");
        require(
            block.timestamp >= identity.lastUpdated + cooldownPeriod,
            "Cooldown period not passed"
        );
        
        uint256 bondToReturn = identity.bondedAmount;
        
        bytes32 keyHash = keccak256(identity.pqPublicKey);
        delete _keyToAddress[keyHash];
        
        _removeFromAddressList(msg.sender);
        
        identity.active = false;
        identity.bondedAmount = 0;
        
        totalRegistered--;
        totalBonded -= bondToReturn;
        
        require(pfork.transfer(msg.sender, bondToReturn), "Bond return failed");
        
        emit IdentityRemoved(msg.sender, bondToReturn);
    }

    function getPQKey(address neoXAddress) external view returns (bytes memory) {
        require(_identities[neoXAddress].active, "Not registered");
        return _identities[neoXAddress].pqPublicKey;
    }

    function isRegistered(address neoXAddress) external view returns (bool) {
        return _identities[neoXAddress].active;
    }

    function registrationTime(address neoXAddress) external view returns (uint256) {
        return _identities[neoXAddress].registeredAt;
    }

    function getIdentity(address neoXAddress) external view returns (
        bytes memory pqPublicKey,
        uint256 bondedAmount,
        uint256 registeredAt,
        uint256 lastUpdated,
        bool active
    ) {
        Identity storage id = _identities[neoXAddress];
        return (id.pqPublicKey, id.bondedAmount, id.registeredAt, id.lastUpdated, id.active);
    }

    function getAddressByKeyHash(bytes32 keyHash) external view returns (address) {
        return _keyToAddress[keyHash];
    }

    function verifyKeyOwnership(
        address neoXAddress,
        bytes calldata pqPublicKey
    ) external view returns (bool) {
        if (!_identities[neoXAddress].active) return false;
        
        bytes32 claimedHash = keccak256(pqPublicKey);
        bytes32 registeredHash = keccak256(_identities[neoXAddress].pqPublicKey);
        
        return claimedHash == registeredHash;
    }

    function getRegisteredAddresses(
        uint256 offset,
        uint256 limit
    ) external view returns (address[] memory) {
        if (offset >= _registeredAddresses.length) {
            return new address[](0);
        }
        
        uint256 end = offset + limit;
        if (end > _registeredAddresses.length) {
            end = _registeredAddresses.length;
        }
        
        address[] memory result = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _registeredAddresses[i];
        }
        
        return result;
    }

    function _removeFromAddressList(address addr) internal {
        uint256 index = _addressIndex[addr];
        uint256 lastIndex = _registeredAddresses.length - 1;
        
        if (index != lastIndex) {
            address lastAddr = _registeredAddresses[lastIndex];
            _registeredAddresses[index] = lastAddr;
            _addressIndex[lastAddr] = index;
        }
        
        _registeredAddresses.pop();
        delete _addressIndex[addr];
    }

    function setBondAmount(uint256 newAmount) external onlyOwner {
        emit BondAmountUpdated(bondAmount, newAmount);
        bondAmount = newAmount;
    }

    function setCooldownPeriod(uint256 newPeriod) external onlyOwner {
        emit CooldownPeriodUpdated(cooldownPeriod, newPeriod);
        cooldownPeriod = newPeriod;
    }

    function slashIdentity(
        address neoXAddress,
        uint256 amount,
        bytes calldata reason
    ) external onlyOwner nonReentrant {
        Identity storage identity = _identities[neoXAddress];
        require(identity.active, "Not registered");
        require(amount <= identity.bondedAmount, "Amount exceeds bond");
        
        identity.bondedAmount -= amount;
        totalBonded -= amount;
        
        if (identity.bondedAmount == 0) {
            bytes32 keyHash = keccak256(identity.pqPublicKey);
            delete _keyToAddress[keyHash];
            _removeFromAddressList(neoXAddress);
            identity.active = false;
            totalRegistered--;
            
            emit IdentityRemoved(neoXAddress, 0);
        }
    }

    function getStats() external view returns (
        uint256 _bondAmount,
        uint256 _cooldownPeriod,
        uint256 _totalRegistered,
        uint256 _totalBonded
    ) {
        return (bondAmount, cooldownPeriod, totalRegistered, totalBonded);
    }
}
