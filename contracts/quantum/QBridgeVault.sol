// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IQuantumLayer.sol";

/**
 * @title QBridgeVault
 * @notice Manages asset deposits and exits for the Quantum Layer.
 * 
 * Users deposit assets (PFORK, GAS, etc.) to get Q-balances in the
 * off-chain quantum layer. Exits require inclusion proofs verified
 * against the current state root. Priority exits available for
 * users who have purchased priority with PFORK.
 */
contract QBridgeVault is IQBridgeVault, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    IPForkToken public immutable pfork;
    address public stateVerifier;
    address public priorityFeeManager;
    
    uint256 public exitDelay;
    uint256 public priorityExitDelay;
    uint256 private _exitIdCounter;
    uint256 private _depositIdCounter;
    
    struct ExitRequest {
        address user;
        address asset;
        uint256 amount;
        uint256 requestBlock;
        uint256 unlockBlock;
        bytes32 depositCommitment;
        bool completed;
        bool isPriority;
    }
    
    struct DepositRecord {
        uint256 amount;
        uint256 depositBlock;
        bytes32 commitment;
        bool active;
    }
    
    mapping(address => mapping(address => uint256)) private _deposits;
    mapping(address => mapping(address => DepositRecord[])) private _depositRecords;
    mapping(uint256 => ExitRequest) private _exitRequests;
    mapping(address => uint256[]) private _userExits;
    mapping(bytes32 => bool) private _usedCommitments;
    
    mapping(address => bool) public supportedAssets;
    
    uint256 public totalDeposits;
    uint256 public totalExits;

    event AssetSupported(address indexed asset, bool supported);
    event ExitDelayUpdated(uint256 oldDelay, uint256 newDelay);
    event PriorityExitDelayUpdated(uint256 oldDelay, uint256 newDelay);

    modifier onlyVerifiedRoot() {
        require(stateVerifier != address(0), "State verifier not set");
        _;
    }

    constructor(
        address _pfork,
        uint256 _exitDelay,
        uint256 _priorityExitDelay
    ) Ownable(msg.sender) {
        require(_pfork != address(0), "Invalid PFORK address");
        pfork = IPForkToken(_pfork);
        exitDelay = _exitDelay;
        priorityExitDelay = _priorityExitDelay;
        
        supportedAssets[_pfork] = true;
        emit AssetSupported(_pfork, true);
    }

    function deposit(address asset, uint256 amount) external nonReentrant {
        require(supportedAssets[asset], "Asset not supported");
        require(amount > 0, "Cannot deposit zero");
        
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        
        _deposits[msg.sender][asset] += amount;
        totalDeposits += amount;
        
        uint256 depositId = _depositIdCounter++;
        
        bytes32 commitment = keccak256(abi.encodePacked(
            msg.sender,
            asset,
            amount,
            depositId,
            block.number,
            block.timestamp
        ));
        
        _depositRecords[msg.sender][asset].push(DepositRecord({
            amount: amount,
            depositBlock: block.number,
            commitment: commitment,
            active: true
        }));
        
        emit Deposited(msg.sender, asset, amount, depositId);
    }

    receive() external payable {
        _deposits[msg.sender][address(0)] += msg.value;
        totalDeposits += msg.value;
        
        uint256 depositId = _depositIdCounter++;
        emit Deposited(msg.sender, address(0), msg.value, depositId);
    }

    function requestExit(
        address asset,
        uint256 amount
    ) external nonReentrant returns (uint256 exitId) {
        require(amount > 0, "Cannot exit zero");
        require(_deposits[msg.sender][asset] >= amount, "Insufficient deposit balance");
        
        exitId = _exitIdCounter++;
        
        bytes32 depositCommitment = keccak256(abi.encodePacked(
            msg.sender,
            asset,
            amount,
            exitId,
            block.number
        ));
        
        _exitRequests[exitId] = ExitRequest({
            user: msg.sender,
            asset: asset,
            amount: amount,
            requestBlock: block.number,
            unlockBlock: block.number + exitDelay,
            depositCommitment: depositCommitment,
            completed: false,
            isPriority: false
        });
        
        _deposits[msg.sender][asset] -= amount;
        _userExits[msg.sender].push(exitId);
        
        emit ExitRequested(msg.sender, asset, amount, exitId);
    }

    function completeExit(
        uint256 exitId,
        bytes calldata proof,
        bytes calldata leafData
    ) external nonReentrant onlyVerifiedRoot {
        ExitRequest storage request = _exitRequests[exitId];
        require(request.user == msg.sender, "Not exit owner");
        require(!request.completed, "Already completed");
        require(block.number >= request.unlockBlock, "Exit not yet unlocked");
        
        require(_verifyExitProof(exitId, proof, leafData), "Invalid proof");
        
        request.completed = true;
        totalExits += request.amount;
        
        _transferAsset(request.asset, request.user, request.amount);
        
        emit ExitCompleted(request.user, request.asset, request.amount, exitId);
    }

    function priorityExit(
        uint256 exitId,
        bytes calldata proof,
        bytes calldata leafData
    ) external nonReentrant onlyVerifiedRoot {
        ExitRequest storage request = _exitRequests[exitId];
        require(request.user == msg.sender, "Not exit owner");
        require(!request.completed, "Already completed");
        
        require(priorityFeeManager != address(0), "Priority manager not set");
        
        uint256 score = IQPriorityFeeManager(priorityFeeManager)
            .priorityScore(msg.sender, request.requestBlock);
        require(score > 0, "No priority purchased");
        
        IQPriorityFeeManager(priorityFeeManager).consumePriority(
            msg.sender,
            request.requestBlock,
            1
        );
        
        uint256 priorityUnlock = request.requestBlock + priorityExitDelay;
        require(block.number >= priorityUnlock, "Priority exit not yet unlocked");
        
        require(_verifyExitProof(exitId, proof, leafData), "Invalid proof");
        
        request.completed = true;
        request.isPriority = true;
        totalExits += request.amount;
        
        _transferAsset(request.asset, request.user, request.amount);
        
        emit ExitCompleted(request.user, request.asset, request.amount, exitId);
    }

    function _verifyExitProof(
        uint256 exitId,
        bytes calldata proof,
        bytes calldata leafData
    ) internal returns (bool) {
        ExitRequest storage request = _exitRequests[exitId];
        
        bytes32 leaf = keccak256(abi.encodePacked(
            request.user,
            request.asset,
            request.amount,
            exitId,
            request.depositCommitment,
            leafData
        ));
        
        require(!_usedCommitments[request.depositCommitment], "Commitment already used");
        require(proof.length > 0, "Proof required");
        
        (bytes32[] memory proofHashes, uint256 index) = abi.decode(proof, (bytes32[], uint256));
        
        require(proofHashes.length > 0, "Invalid proof length");
        
        bool valid = IQStateVerifier(stateVerifier).verifyInclusion(leaf, proofHashes, index);
        
        if (valid) {
            _usedCommitments[request.depositCommitment] = true;
        }
        
        return valid;
    }

    function _transferAsset(address asset, address to, uint256 amount) internal {
        if (asset == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            IERC20(asset).safeTransfer(to, amount);
        }
    }

    function userDeposits(address user, address asset) external view returns (uint256) {
        return _deposits[user][asset];
    }

    function exitRequest(uint256 exitId) external view returns (
        address user,
        address asset,
        uint256 amount,
        uint256 requestBlock,
        bool completed
    ) {
        ExitRequest storage req = _exitRequests[exitId];
        return (req.user, req.asset, req.amount, req.requestBlock, req.completed);
    }

    function getExitRequest(uint256 exitId) external view returns (ExitRequest memory) {
        return _exitRequests[exitId];
    }

    function getUserExits(address user) external view returns (uint256[] memory) {
        return _userExits[user];
    }

    function canCompleteExit(uint256 exitId) external view returns (bool, string memory) {
        ExitRequest storage req = _exitRequests[exitId];
        
        if (req.user == address(0)) return (false, "Exit does not exist");
        if (req.completed) return (false, "Already completed");
        if (block.number < req.unlockBlock) return (false, "Not yet unlocked");
        
        return (true, "Ready to complete");
    }

    function setStateVerifier(address _stateVerifier) external onlyOwner {
        emit StateVerifierUpdated(stateVerifier, _stateVerifier);
        stateVerifier = _stateVerifier;
    }

    function setPriorityFeeManager(address _priorityFeeManager) external onlyOwner {
        priorityFeeManager = _priorityFeeManager;
    }

    function setExitDelay(uint256 newDelay) external onlyOwner {
        emit ExitDelayUpdated(exitDelay, newDelay);
        exitDelay = newDelay;
    }

    function setPriorityExitDelay(uint256 newDelay) external onlyOwner {
        emit PriorityExitDelayUpdated(priorityExitDelay, newDelay);
        priorityExitDelay = newDelay;
    }

    function setSupportedAsset(address asset, bool supported) external onlyOwner {
        supportedAssets[asset] = supported;
        emit AssetSupported(asset, supported);
    }

    function emergencyWithdraw(
        address asset,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        _transferAsset(asset, to, amount);
    }
}
