# NFT Contract Deployment Guide

## Fixes Applied

### 1. Stack Too Deep Error - FIXED ✅
The contract has been refactored to split shape generation into helper functions, eliminating the "stack too deep" compiler error. The contract should now compile successfully.

### 2. Private Key Security - FIXED ✅
Added a separate `signer` role to prevent exposing your deployer private key:
- The contract owner (deployer) sets a designated signer address
- The backend uses a separate key (not the deployer key)
- The contract verifies signatures from the designated signer

## Deployment Steps

### Step 1: Deploy the Contract

Deploy `QuantumSignatureNFT.sol` to both chains:

**Constructor Parameters:**
- `_ferryContract`: Ferry contract address
  - Ethereum: `0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86`
  - Neo X: `0x81aC8AEDdaC85aA14011ab88944aA147472aC525`
- `_chainId`: Chain identifier
  - Ethereum: `1`
  - Neo X: `47763`

**Using Remix:**
1. Go to https://remix.ethereum.org
2. Create a new file with the contract code
3. Compile with Solidity 0.8.20+
4. Deploy to each network with the correct parameters

### Step 2: Generate Backend Signer Key

Create a NEW wallet specifically for the backend (don't reuse your deployer key):

```bash
# Option 1: Use ethers.js
npx ethers@6 -g wallet new

# Option 2: Use any wallet tool
# Just save the private key securely
```

### Step 3: Set the Signer Address

After deploying, call `setSigner()` from your deployer wallet:

```solidity
// On Ethereum Mainnet
quantumNFT.setSigner(0xYourBackendWalletAddress);

// On Neo X Mainnet
quantumNFT.setSigner(0xYourBackendWalletAddress);
```

**Important:** Use the SAME backend address on both chains!

### Step 4: Configure Environment Variables

Set these in your Replit secrets or `.env`:

```bash
# Deployed NFT contract addresses
ETH_NFT_CONTRACT=0x...     # Your Ethereum deployment
NEOX_NFT_CONTRACT=0x...    # Your Neo X deployment

# Backend signer private key (NOT your deployer key)
NFT_SIGNER_PRIVATE_KEY=0x...
```

### Step 5: Verify Everything Works

1. Check the backend logs show "Using PostgreSQL storage"
2. Try minting an NFT from a real bridge transaction
3. Verify the NFT appears on OpenSea/marketplace

## Security Model

### Roles

1. **Contract Owner (Deployer)** - You
   - Deploys the contract
   - Sets the signer address
   - Can update signer if needed
   - Keeps private key offline/secure

2. **Backend Signer** - Replit backend
   - Separate key from deployer
   - Used only for signing mint attestations
   - Validates bridges against blockchain
   - Can be rotated if compromised

### Why This Is Secure

✅ Your deployer key never touches the backend
✅ Backend uses a separate, dedicated key
✅ If backend key is compromised, you can rotate it with `setSigner()`
✅ Contract still enforces: only bridger can mint, no double-minting
✅ All bridge data is blockchain-validated before signing

## Troubleshooting

**Q: Contract won't compile**
- Make sure you're using Solidity 0.8.20 or higher
- Enable optimization in compiler settings

**Q: "Invalid signature" error when minting**
- Verify `NFT_SIGNER_PRIVATE_KEY` matches the address set via `setSigner()`
- Check you called `setSigner()` on the deployed contract
- Confirm the backend is using the correct contract addresses

**Q: Need to change signer key**
- Call `setSigner(newAddress)` from your deployer wallet
- Update `NFT_SIGNER_PRIVATE_KEY` environment variable
- Restart the backend

## Next Steps

After deployment:
1. Share the contract addresses with users
2. Update frontend to show correct OpenSea/marketplace links
3. Monitor the backend logs for any signing errors
4. Consider verifying the contracts on Etherscan/Explorer
