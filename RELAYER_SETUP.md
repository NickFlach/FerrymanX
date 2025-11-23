# FerryManX Relayer Setup

## How It Works

The relayer is a backend service that automatically completes cross-chain bridges:

1. **User initiates bridge** → Calls `bridgeOut()` on source chain, pays native fee (ETH/GAS)
2. **Relayer detects event** → Backend polls both chains every 15 seconds
3. **Relayer completes bridge** → Calls `fulfillBridgeIn()` on destination chain

## Fee Model

- **User pays upfront**: Native fee (ETH/GAS) is paid when calling `bridgeOut()`
- **Fees go to contract**: The ferry contract collects these fees
- **Owner withdraws fees**: Contract owner can withdraw accumulated fees to fund relayer

## Setting Up the Relayer

### 1. Create a Relayer Wallet

Generate a new Ethereum wallet for the relayer:

```bash
# Using any wallet generation tool or create in MetaMask
# Export the private key
```

### 2. Fund the Relayer Wallet

The relayer needs gas on **both chains**:

- **Ethereum**: ~0.01 ETH (for gas to call `fulfillBridgeIn`)
- **Neo X**: ~0.1 GAS (for gas to call `fulfillBridgeIn`)

### 3. Set Environment Variable

Add the relayer private key to your Replit secrets:

1. Go to Replit Secrets (lock icon in sidebar)
2. Add new secret:
   - Key: `RELAYER_PRIVATE_KEY`
   - Value: `0x...your private key`

### 4. Restart Application

After setting the secret, restart the application. You should see:

```
[relayer] Starting relayer service...
[relayer] ✓ Relayer polling every 15 seconds
```

### 5. Test a Bridge

Initiate a bridge transaction. The relayer should detect it and log:

```
[relayer] 🌉 ETH → NEOX BridgeOut detected
[relayer]  from: 0x...
[relayer]  amountOut: X.XX PFORK
[relayer]  Relayer balance: 0.01 ETH
[relayer]  Required native fee: 0.001 ETH
[relayer]  ↳ Sent fulfillBridgeIn: 0x...
[relayer]  ✓ Confirmed in block XXXXX
```

## Maintaining the Relayer

### Withdraw Accumulated Fees

As users bridge, the contracts accumulate native fees. The contract owner can withdraw these:

```solidity
// On ETH Ferry contract
withdrawNative(relayerAddress, amount)

// On Neo X Ferry contract  
withdrawNative(relayerAddress, amount)
```

Transfer withdrawn fees to the relayer wallet to keep it funded.

### Monitor Relayer Balance

Check relayer balance periodically:
- The logs show balance before each relay
- Ensure balance stays above the native fee requirement
- Top up when needed or withdraw contract fees

## Contract Addresses

- **ETH Ferry**: `0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86`
- **Neo X Ferry**: `0x81aC8AEDdaC85aA14011ab88944aA147472aC525`

## Troubleshooting

### "No RELAYER_PRIVATE_KEY configured"
→ Set the `RELAYER_PRIVATE_KEY` secret in Replit

### "Relayer wallet has no balance"
→ Fund the relayer wallet on the destination chain

### "Insufficient balance for native fee"
→ The relayer wallet needs more gas to cover the native fee

### Bridge stuck on "Waiting for Relayer"
→ Check relayer logs for errors
→ Ensure relayer is running and funded
