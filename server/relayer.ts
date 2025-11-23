import { ethers } from "ethers";
import { log } from "./app";

const NETWORKS = {
  ETH: {
    chainId: 1,
    name: "Ethereum",
    rpc: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
  },
  NEOX: {
    chainId: 47763,
    name: "Neo X",
    rpc: process.env.NEOX_RPC_URL || "https://mainnet-2.rpc.banelabs.org",
  },
};

const CONTRACTS = {
  ETH: {
    PFORK: "0x536d98Ad83F7d0230B9384e606208802ECD728FE",
    FERRY: "0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86",
  },
  NEOX: {
    PFORK: "0x216490C8E6b33b4d8A2390dADcf9f433E30da60F",
    FERRY: "0x81aC8AEDdaC85aA14011ab88944aA147472aC525",
  },
};

const FERRY_ABI = [
  "event BridgeOutRequested(address indexed from, address indexed toOnOtherChain, uint256 amountIn, uint256 amountOut, uint256 pforkFeePaid, uint256 nonce)",
  "function fulfillBridgeIn(address to, uint256 amount, bytes32 messageId) payable",
  "function nativeFeeWei() view returns (uint256)",
  "function feeBps() view returns (uint16)",
];

const processedMessages = new Set<string>();

function computeMessageId(srcChainId: number, dstChainId: number, srcFerry: string, nonce: bigint, from: string, toOnOther: string, amountOut: bigint): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["uint16", "uint16", "address", "uint256", "address", "address", "uint256"],
      [srcChainId, dstChainId, srcFerry, nonce, from, toOnOther, amountOut]
    )
  );
}

async function relayBridgeOut(
  srcNetwork: "ETH" | "NEOX",
  args: {
    from: string;
    toOnOtherChain: string;
    amountIn: bigint;
    amountOut: bigint;
    pforkFeePaid: bigint;
    nonce: bigint;
  },
  dstNetwork: "ETH" | "NEOX",
): Promise<void> {
  try {
    const { from, toOnOtherChain, amountOut, nonce } = args;

    const messageId = computeMessageId(
      NETWORKS[srcNetwork].chainId,
      NETWORKS[dstNetwork].chainId,
      CONTRACTS[srcNetwork].FERRY,
      nonce,
      from,
      toOnOtherChain,
      amountOut
    );

    if (processedMessages.has(messageId)) {
      return;
    }

    log(`🌉 ${srcNetwork} → ${dstNetwork} BridgeOut detected`, "relayer");
    log(` from: ${from}`, "relayer");
    log(` toOnOther: ${toOnOtherChain}`, "relayer");
    log(` amountOut: ${ethers.formatUnits(amountOut, 18)} PFORK`, "relayer");
    log(` messageId: ${messageId.slice(0, 10)}...`, "relayer");

    if (!process.env.RELAYER_PRIVATE_KEY) {
      log(`⚠️  No RELAYER_PRIVATE_KEY configured. Cannot auto-relay.`, "relayer");
      log(`    Set RELAYER_PRIVATE_KEY to enable automatic relaying.`, "relayer");
      processedMessages.add(messageId);
      return;
    }

    const dstProvider = new ethers.JsonRpcProvider(NETWORKS[dstNetwork].rpc);
    const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, dstProvider);

    const balance = await dstProvider.getBalance(relayerWallet.address);

    if (balance === BigInt(0)) {
      log(`⚠️  Relayer wallet has no balance on ${dstNetwork}. Cannot relay.`, "relayer");
      log(`    Relayer: ${relayerWallet.address}`, "relayer");
      log(`    Fund this wallet to enable relaying.`, "relayer");
      processedMessages.add(messageId);
      return;
    }

    const dstFerry = new ethers.Contract(CONTRACTS[dstNetwork].FERRY, FERRY_ABI, relayerWallet);
    
    const nativeFee = await dstFerry.nativeFeeWei();
    log(`  Relayer balance: ${ethers.formatEther(balance)} ${dstNetwork === "ETH" ? "ETH" : "GAS"}`, "relayer");
    log(`  Required native fee: ${ethers.formatEther(nativeFee)} ${dstNetwork === "ETH" ? "ETH" : "GAS"}`, "relayer");

    if (balance < nativeFee) {
      log(`⚠️  Insufficient balance for native fee. Need ${ethers.formatEther(nativeFee)}, have ${ethers.formatEther(balance)}`, "relayer");
      processedMessages.add(messageId);
      return;
    }

    const tx = await dstFerry.fulfillBridgeIn(toOnOtherChain, amountOut, messageId, {
      value: nativeFee
    });

    log(`  ↳ Sent fulfillBridgeIn: ${tx.hash}`, "relayer");

    const receipt = await tx.wait();
    if (receipt?.status === 1) {
      processedMessages.add(messageId);
      log(`  ✓ Confirmed in block ${receipt.blockNumber}`, "relayer");
    } else {
      log(`  ✗ Transaction failed`, "relayer");
    }
  } catch (error: any) {
    console.error(`Error relaying ${srcNetwork} → ${dstNetwork}:`, error?.message || error);
  }
}

async function pollBridges(): Promise<void> {
  const ethProvider = new ethers.JsonRpcProvider(NETWORKS.ETH.rpc);
  const neoxProvider = new ethers.JsonRpcProvider(NETWORKS.NEOX.rpc);

  const ethFerry = new ethers.Contract(CONTRACTS.ETH.FERRY, FERRY_ABI, ethProvider);
  const neoxFerry = new ethers.Contract(CONTRACTS.NEOX.FERRY, FERRY_ABI, neoxProvider);

  let lastEthBlock = 0;
  let lastNeoxBlock = 0;

  setInterval(async () => {
    try {
      const ethBlock = await ethProvider.getBlockNumber();
      if (ethBlock > lastEthBlock) {
        const fromBlock = Math.max(lastEthBlock, ethBlock - 100);
        const ethEvents = await ethFerry.queryFilter("BridgeOutRequested", fromBlock, ethBlock);
        
        for (const event of ethEvents) {
          if (event.args) {
            await relayBridgeOut("ETH", {
              from: event.args[0],
              toOnOtherChain: event.args[1],
              amountIn: event.args[2],
              amountOut: event.args[3],
              pforkFeePaid: event.args[4],
              nonce: event.args[5],
            }, "NEOX");
          }
        }
        lastEthBlock = ethBlock;
      }

      const neoxBlock = await neoxProvider.getBlockNumber();
      if (neoxBlock > lastNeoxBlock) {
        const fromBlock = Math.max(lastNeoxBlock, neoxBlock - 100);
        const neoxEvents = await neoxFerry.queryFilter("BridgeOutRequested", fromBlock, neoxBlock);
        
        for (const event of neoxEvents) {
          if (event.args) {
            await relayBridgeOut("NEOX", {
              from: event.args[0],
              toOnOtherChain: event.args[1],
              amountIn: event.args[2],
              amountOut: event.args[3],
              pforkFeePaid: event.args[4],
              nonce: event.args[5],
            }, "ETH");
          }
        }
        lastNeoxBlock = neoxBlock;
      }
    } catch (error: any) {
      console.error("Error polling bridges:", error?.message || error);
    }
  }, 15000);
}

export async function startRelayer(): Promise<void> {
  try {
    log("Starting relayer service...", "relayer");
    log(`ETH Ferry: ${CONTRACTS.ETH.FERRY}`, "relayer");
    log(`Neo X Ferry: ${CONTRACTS.NEOX.FERRY}`, "relayer");
    
    await pollBridges();
    
    log("✓ Relayer polling every 15 seconds", "relayer");
  } catch (error) {
    console.error("Fatal relayer error:", error);
  }
}
