// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IQuantumLayer.sol";

/**
 * @title QGovernance
 * @notice PFORK-based governance for Quantum Layer parameters.
 * 
 * Token holders can create proposals, vote on them, and execute
 * approved changes to system parameters. Uses snapshot-style
 * voting where PFORK balance at proposal creation determines
 * voting power.
 */
contract QGovernance is IQGovernance, Ownable, ReentrancyGuard {
    IPForkToken public immutable pfork;
    
    uint256 public proposalThreshold;
    uint256 public votingPeriod;
    uint256 public quorum;
    uint256 public executionDelay;
    
    uint256 private _proposalIdCounter;
    
    struct ProposalCore {
        uint256 id;
        address proposer;
        address[] targets;
        bytes[] calldatas;
        uint256 startBlock;
        uint256 endBlock;
        uint256 executionTime;
        uint256 forVotes;
        uint256 againstVotes;
        bool executed;
        bool cancelled;
        mapping(address => bool) hasVoted;
        mapping(address => uint256) votingPower;
    }
    
    mapping(uint256 => ProposalCore) private _proposals;
    mapping(uint256 => address[]) private _proposalVoters;
    
    uint256 public constant MIN_VOTING_PERIOD = 100;
    uint256 public constant MAX_VOTING_PERIOD = 100000;
    
    uint256 public totalProposals;
    uint256 public executedProposals;

    event ExecutionDelayUpdated(uint256 oldDelay, uint256 newDelay);

    constructor(
        address _pfork,
        uint256 _proposalThreshold,
        uint256 _votingPeriod,
        uint256 _quorum,
        uint256 _executionDelay
    ) Ownable(msg.sender) {
        require(_pfork != address(0), "Invalid PFORK address");
        require(_votingPeriod >= MIN_VOTING_PERIOD, "Voting period too short");
        require(_votingPeriod <= MAX_VOTING_PERIOD, "Voting period too long");
        
        pfork = IPForkToken(_pfork);
        proposalThreshold = _proposalThreshold;
        votingPeriod = _votingPeriod;
        quorum = _quorum;
        executionDelay = _executionDelay;
    }

    function propose(
        address[] calldata targets,
        bytes[] calldata calldatas
    ) external returns (uint256) {
        require(targets.length > 0, "Empty proposal");
        require(targets.length == calldatas.length, "Length mismatch");
        require(
            pfork.balanceOf(msg.sender) >= proposalThreshold,
            "Below proposal threshold"
        );
        
        uint256 proposalId = _proposalIdCounter++;
        
        ProposalCore storage proposal = _proposals[proposalId];
        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.targets = targets;
        proposal.calldatas = calldatas;
        proposal.startBlock = block.number;
        proposal.endBlock = block.number + votingPeriod;
        proposal.forVotes = 0;
        proposal.againstVotes = 0;
        proposal.executed = false;
        proposal.cancelled = false;
        
        totalProposals++;
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            targets,
            calldatas,
            proposal.startBlock,
            proposal.endBlock
        );
        
        return proposalId;
    }

    function castVote(uint256 proposalId, bool support) external nonReentrant {
        ProposalCore storage proposal = _proposals[proposalId];
        require(proposal.proposer != address(0), "Proposal does not exist");
        require(block.number >= proposal.startBlock, "Voting not started");
        require(block.number <= proposal.endBlock, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(!proposal.cancelled, "Proposal cancelled");
        
        uint256 weight = pfork.balanceOf(msg.sender);
        require(weight > 0, "No voting power");
        
        proposal.hasVoted[msg.sender] = true;
        proposal.votingPower[msg.sender] = weight;
        
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }
        
        _proposalVoters[proposalId].push(msg.sender);
        
        emit VoteCast(msg.sender, proposalId, support, weight);
    }

    function execute(uint256 proposalId) external nonReentrant {
        require(state(proposalId) == ProposalState.Succeeded, "Not ready for execution");
        
        ProposalCore storage proposal = _proposals[proposalId];
        
        if (executionDelay > 0) {
            if (proposal.executionTime == 0) {
                proposal.executionTime = block.timestamp + executionDelay;
                return;
            }
            require(
                block.timestamp >= proposal.executionTime,
                "Execution delay not passed"
            );
        }
        
        proposal.executed = true;
        executedProposals++;
        
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = proposal.targets[i].call(proposal.calldatas[i]);
            require(success, "Execution failed");
        }
        
        emit ProposalExecuted(proposalId);
    }

    function cancel(uint256 proposalId) external {
        ProposalCore storage proposal = _proposals[proposalId];
        require(proposal.proposer != address(0), "Proposal does not exist");
        require(!proposal.executed, "Already executed");
        require(!proposal.cancelled, "Already cancelled");
        require(
            msg.sender == proposal.proposer || msg.sender == owner(),
            "Not authorized"
        );
        
        proposal.cancelled = true;
        
        emit ProposalCancelled(proposalId);
    }

    function state(uint256 proposalId) public view returns (ProposalState) {
        ProposalCore storage proposal = _proposals[proposalId];
        
        if (proposal.proposer == address(0)) {
            revert("Invalid proposal");
        }
        
        if (proposal.cancelled) {
            return ProposalState.Cancelled;
        }
        
        if (proposal.executed) {
            return ProposalState.Executed;
        }
        
        if (block.number <= proposal.endBlock) {
            if (block.number < proposal.startBlock) {
                return ProposalState.Pending;
            }
            return ProposalState.Active;
        }
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        
        if (totalVotes < quorum) {
            return ProposalState.Defeated;
        }
        
        if (proposal.forVotes <= proposal.againstVotes) {
            return ProposalState.Defeated;
        }
        
        if (proposal.executionTime > 0) {
            return ProposalState.Queued;
        }
        
        return ProposalState.Succeeded;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        ProposalCore storage p = _proposals[proposalId];
        
        return Proposal({
            id: p.id,
            proposer: p.proposer,
            targets: p.targets,
            calldatas: p.calldatas,
            startBlock: p.startBlock,
            endBlock: p.endBlock,
            forVotes: p.forVotes,
            againstVotes: p.againstVotes,
            executed: p.executed,
            cancelled: p.cancelled
        });
    }

    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return _proposals[proposalId].hasVoted[voter];
    }

    function getVotingPower(uint256 proposalId, address voter) external view returns (uint256) {
        return _proposals[proposalId].votingPower[voter];
    }

    function getProposalVoters(uint256 proposalId) external view returns (address[] memory) {
        return _proposalVoters[proposalId];
    }

    function setProposalThreshold(uint256 newThreshold) external onlyOwner {
        emit ProposalThresholdUpdated(proposalThreshold, newThreshold);
        proposalThreshold = newThreshold;
    }

    function setVotingPeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod >= MIN_VOTING_PERIOD, "Period too short");
        require(newPeriod <= MAX_VOTING_PERIOD, "Period too long");
        emit VotingPeriodUpdated(votingPeriod, newPeriod);
        votingPeriod = newPeriod;
    }

    function setQuorum(uint256 newQuorum) external onlyOwner {
        emit QuorumUpdated(quorum, newQuorum);
        quorum = newQuorum;
    }

    function setExecutionDelay(uint256 newDelay) external onlyOwner {
        emit ExecutionDelayUpdated(executionDelay, newDelay);
        executionDelay = newDelay;
    }

    function getStats() external view returns (
        uint256 _proposalThreshold,
        uint256 _votingPeriod,
        uint256 _quorum,
        uint256 _executionDelay,
        uint256 _totalProposals,
        uint256 _executedProposals
    ) {
        return (
            proposalThreshold,
            votingPeriod,
            quorum,
            executionDelay,
            totalProposals,
            executedProposals
        );
    }
}
