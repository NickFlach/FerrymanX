# Deploy Updated NFT Contracts

The NFT contracts need to be redeployed with the Ferry restriction removed. Here's how:

## Prerequisites

1. **You need a wallet with funds on both chains:**
   - Ethereum: ~0.01 ETH for gas
   - Neo X: ~10 GAS for gas

2. **Get your deployer wallet's private key** (the wallet that will own the contracts)

## Step 1: Set Your Private Key

In the Replit Secrets tab (🔒 icon in left sidebar), add:

```
DEPLOYER_PRIVATE_KEY = your_private_key_here
```

⚠️ **Use the same wallet address that you use for NFT_SIGNER_PRIVATE_KEY** - this makes the setup simpler.

## Step 2: Deploy to Ethereum

Run this command in the Shell:

```bash
npx hardhat run scripts/deploy-nft.cjs --network ethereum
```

This will:
- Deploy the updated NFT contract to Ethereum
- Automatically update `client/src/lib/nftContract.ts` with the new address
- Automatically update `replit.md` with the new address

## Step 3: Deploy to Neo X

Run this command in the Shell:

```bash
npx hardhat run scripts/deploy-nft.cjs --network neox
```

This will:
- Deploy the updated NFT contract to Neo X
- Automatically update `client/src/lib/nftContract.ts` with the new address
- Automatically update `replit.md` with the new address

## Step 4: Set Signer (Important!)

After deploying to **both networks**, you need to call `setSigner()` on each contract:

### Option A: Using Etherscan/Explorer (Easiest)

1. **Ethereum:**
   - Go to contract on Etherscan (address will be shown in deploy output)
   - Click "Contract" → "Write Contract" → "Connect to Web3"
   - Find `setSigner` function
   - Enter your backend wallet address (the one from NFT_SIGNER_PRIVATE_KEY)
   - Click "Write"

2. **Neo X:**
   - Go to contract on Neo X Explorer (address will be shown in deploy output)
   - Same process as Ethereum

### Option B: Using Script (if explorers don't work)

I can create a script if you need it - just ask!

## Step 5: Restart Your App

Once both contracts are deployed and signer is set:

```bash
# Restart the workflow to pick up new addresses
```

## That's It!

Your app will now use the updated contracts and NFT minting will work directly from the frontend.

---

## What Changed?

The old contracts had this line:
```solidity
require(msg.sender == ferryContract, "Only ferry contract");
```

The new contracts removed it, so anyone with a valid backend signature can mint. The backend signature provides all the security needed.
