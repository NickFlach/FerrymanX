# Quantum Signature NFT - Deployment Guide

## Contract Overview

`QuantumSignatureNFT.sol` is an ERC-721 NFT contract that mints unique, generative art NFTs for each FerryManX bridge transaction. Each NFT contains:
- **On-chain SVG art** - Deterministically generated from the bridge messageId
- **Bridge metadata** - Amount, timestamp, chains, quantum state
- **Ownership proof** - Only the bridge initiator can mint their NFT

## Security Features

✅ **One NFT per bridge** - messageId prevents double-minting  
✅ **Ownership verification** - Signature-based attestation from contract owner  
✅ **Deterministic art** - Same messageId always produces same artwork  
✅ **Solidity 0.8.20+** - Built-in overflow protection  
✅ **Immutable deployment** - No upgrade vulnerabilities

## Prerequisites

1. Install dependencies:
```bash
npm install --save-dev @openzeppelin/contracts hardhat @nomicfoundation/hardhat-toolbox
```

2. Create `hardhat.config.js`:
```javascript
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    ethereum: {
      url: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : []
    },
    neox: {
      url: process.env.NEOX_RPC_URL || "https://mainnet-2.rpc.banelabs.org",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 47763
    }
  }
};
```

## Deployment Steps

### 1. Compile Contract

```bash
npx hardhat compile
```

### 2. Deploy to Ethereum

```bash
npx hardhat run scripts/deploy.js --network ethereum
```

Constructor arguments:
- `ferryContract`: `0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86`
- `chainId`: `1` (Ethereum)

### 3. Deploy to Neo X

```bash
npx hardhat run scripts/deploy.js --network neox
```

Constructor arguments:
- `ferryContract`: `0x81aC8AEDdaC85aA14011ab88944aA147472aC525`
- `chainId`: `47763` (Neo X)

## Deployment Script

Create `scripts/deploy.js`:

```javascript
const hre = require("hardhat");

async function main() {
  const network = hre.network.name;
  
  const ferryContracts = {
    ethereum: "0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86",
    neox: "0x81aC8AEDdaC85aA14011ab88944aA147472aC525"
  };
  
  const chainIds = {
    ethereum: 1,
    neox: 47763
  };
  
  const ferryContract = ferryContracts[network];
  const chainId = chainIds[network];
  
  console.log(`Deploying to ${network}...`);
  console.log(`Ferry Contract: ${ferryContract}`);
  console.log(`Chain ID: ${chainId}`);
  
  const QuantumSignatureNFT = await hre.ethers.getContractFactory("QuantumSignatureNFT");
  const nft = await QuantumSignatureNFT.deploy(ferryContract, chainId);
  
  await nft.waitForDeployment();
  
  const address = await nft.getAddress();
  console.log(`QuantumSignatureNFT deployed to: ${address}`);
  console.log(`\nAdd to client/src/lib/contracts.ts:`);
  console.log(`QUANTUM_NFT: "${address}",`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

## Minting Flow

### Backend: Signature Generation

The contract owner needs to sign attestations for valid bridges. Create a backend endpoint:

```typescript
// server/routes.ts
import { ethers } from "ethers";

app.post("/api/nft/attestation", async (req, res) => {
  const { messageId, bridger, amount, timestamp, sourceChain, destChain } = req.body;
  
  // Verify bridge exists in our records
  const bridgeExists = await verifyBridgeExists(messageId);
  if (!bridgeExists) {
    return res.status(404).json({ error: "Bridge not found" });
  }
  
  // Sign attestation
  const wallet = new ethers.Wallet(process.env.NFT_SIGNER_PRIVATE_KEY!);
  
  const nftContractAddress = sourceChain === 1 
    ? process.env.ETH_NFT_CONTRACT 
    : process.env.NEOX_NFT_CONTRACT;
  
  const digest = ethers.keccak256(
    ethers.solidityPacked(
      ["bytes32", "address", "uint256", "uint256", "uint8", "uint8", "address"],
      [messageId, bridger, amount, timestamp, sourceChain, destChain, nftContractAddress]
    )
  );
  
  const messageHash = ethers.hashMessage(ethers.getBytes(digest));
  const signature = await wallet.signMessage(ethers.getBytes(digest));
  
  res.json({ signature });
});
```

### Frontend: Minting NFT

```typescript
// Mint button on Quantum Ferry page
const mintNFT = async (bridge: QuantumBridge) => {
  // Get attestation from backend
  const response = await fetch("/api/nft/attestation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messageId: bridge.messageId,
      bridger: account,
      amount: parseEther(bridge.amount),
      timestamp: bridge.timestamp,
      sourceChain: bridge.sourceChain === "ETH" ? 1 : 47763,
      destChain: bridge.destChain === "ETH" ? 1 : 47763
    })
  });
  
  const { signature } = await response.json();
  
  // Call contract
  const nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
  const tx = await nftContract.mintSignature(
    bridge.messageId,
    account,
    parseEther(bridge.amount),
    bridge.timestamp,
    bridge.sourceChain === "ETH" ? 1 : 47763,
    bridge.destChain === "ETH" ? 1 : 47763,
    signature
  );
  
  await tx.wait();
};
```

## Gas Estimates

- **Deploy**: ~2-3M gas (~$50-100 on Ethereum mainnet)
- **Mint**: ~200-300K gas per NFT (~$10-20 on Ethereum mainnet)

## Verification

After deployment, verify the contract on block explorers:

### Ethereum (Etherscan)
```bash
npx hardhat verify --network ethereum <CONTRACT_ADDRESS> <FERRY_ADDRESS> 1
```

### Neo X
```bash
npx hardhat verify --network neox <CONTRACT_ADDRESS> <FERRY_ADDRESS> 47763
```

## Post-Deployment

1. Update `client/src/lib/contracts.ts` with deployed addresses
2. Set `NFT_SIGNER_PRIVATE_KEY` environment variable (same as contract owner)
3. Fund contract owner wallet if needed for operational costs
4. Test minting flow on testnet first!

## Security Considerations

⚠️ **Contract Owner Private Key**: Secure this key - it signs mint attestations  
⚠️ **Ownership Enforcement**: The smart contract enforces `msg.sender == bridger`, so only the bridge initiator can mint even if they obtain a signature  
⚠️ **Backend Attestation**: The backend signs attestations for properly formatted data. The contract's ownership check is the primary security mechanism  
⚠️ **Rate Limiting**: Add rate limits to attestation endpoint to prevent signature spam  
⚠️ **Signature Replay**: Signatures include contract address to prevent cross-chain replay attacks

**Security Model**: The system uses defense in depth:
1. **Blockchain Verification**: Backend verifies bridge transaction exists on-chain by checking Ferry contract's BridgeOutRequested event
2. **Event Data Validation**: Confirms the amount in the attestation request matches the exact amountOut from the on-chain event
3. **Timestamp Validation**: Validates claimed timestamp matches block.timestamp from blockchain (60s tolerance)
4. **Transaction Receipt Validation**: Confirms the txHash exists and the sender matches the claimed bridger
5. **Replay Protection**: PostgreSQL database with unique constraint on txHash ensures each bridge can only get ONE signature ever
6. **Contract Level**: Enforces that only `msg.sender == bridger` can mint
7. **Signature Level**: Requires owner signature after blockchain verification
8. **MessageId Level**: Prevents double-minting of the same bridge

This means NFTs can ONLY be minted for real bridges that actually happened on-chain, with critical event data (amount, timestamp) validated against blockchain state. Each bridge transaction can only receive ONE signature (enforced by database unique constraint), preventing NFT farming even across server restarts.

## OpenSea & Marketplace Support

The contract is ERC-721 compliant and will automatically appear on:
- OpenSea (no action needed)
- LooksRare
- X2Y2
- Any ERC-721 compatible marketplace

Metadata is fully on-chain, so NFTs will display immediately with their quantum art!
