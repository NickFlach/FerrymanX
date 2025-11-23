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
    FERRY: "0x6E43963D748861203Df20e5Ff2AC6aeB807855a7",
  },
  NEOX: {
    PFORK: "0x216490C8E6b33b4d8A2390dADcf9f433E30da60F",
    FERRY: "0xe0Acb6B117747A7671dC5ce57391694281beF212",
  },
};

const FERRY_ABI = [
  "event BridgeOutRequested(address indexed from, address indexed toOnOtherChain, uint256 amountIn, uint256 amountOut, uint256 feePaid, uint256 nonce)",
  "function fulfillBridgeIn(address to, uint256 amount, bytes32 messageId) external",
  "function feeBps() view returns (uint16)",
];

// Message tracking to prevent double-processing
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
    feePaid: bigint;
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

    // Skip if already processed
    if (processedMessages.has(messageId)) {
      return;
    }

    log(`🌉 ${srcNetwork} → ${dstNetwork} BridgeOut detected`, "relayer");
    log(` from: ${from}`, "relayer");
    log(` toOnOther: ${toOnOtherChain}`, "relayer");
    log(` amountOut: ${ethers.formatUnits(amountOut, 18)}`, "relayer");
    log(` messageId: ${messageId.slice(0, 8)}...`, "relayer");

    // Check if we have a relayer wallet configured
    if (!process.env.RELAYER_PRIVATE_KEY) {
      log(`⚠️  No RELAYER_PRIVATE_KEY configured. Cannot execute fulfillBridgeIn.`, "relayer");
      log(`    To enable auto-relay, set RELAYER_PRIVATE_KEY environment variable.`, "relayer");
      processedMessages.add(messageId); // Mark as seen but not relayed
      return;
    }

    // Create relayer wallet on destination chain
    const dstProvider = new ethers.JsonRpcProvider(NETWORKS[dstNetwork].rpc);
    const relayerWallet = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY, dstProvider);

    // Check relayer balance
    const balance = await dstProvider.getBalance(relayerWallet.address);

    if (balance === BigInt(0)) {
      log(`⚠️  Relayer wallet has no balance on ${dstNetwork}. Cannot relay.`, "relayer");
      log(`    Relayer address: ${relayerWallet.address}`, "relayer");
      log(`    Fund this wallet to enable relaying.`, "relayer");
      processedMessages.add(messageId);
      return;
    }

    const balanceEth = ethers.formatEther(balance);
    log(`  Relayer balance on ${dstNetwork}: ${balanceEth} GAS`, "relayer");

    // Call fulfillBridgeIn on destination
    const dstFerry = new ethers.Contract(CONTRACTS[dstNetwork].FERRY, FERRY_ABI, relayerWallet);
    const tx = await dstFerry.fulfillBridgeIn(toOnOtherChain, amountOut, messageId);

    log(`  ↳ Sent fulfillBridgeIn on ${dstNetwork}: ${tx.hash}`, "relayer");

    const receipt = await tx.wait();
    if (receipt?.status === 1) {
      processedMessages.add(messageId);
      log(`  ✓ ${dstNetwork} fulfillBridgeIn confirmed in block ${receipt.blockNumber}`, "relayer");
    } else {
      log(`  ✗ ${dstNetwork} fulfillBridgeIn failed`, "relayer");
    }
  } catch (error) {
    console.error(`Error relaying ${srcNetwork} → ${dstNetwork}:`, error);
  }
}

async function pollBridges(): Promise<void> {
  // Create read-only providers for both networks
  const ethProvider = new ethers.JsonRpcProvider(NETWORKS.ETH.rpc);
  const neoxProvider = new ethers.JsonRpcProvider(NETWORKS.NEOX.rpc);

  const ethFerry = new ethers.Contract(CONTRACTS.ETH.FERRY, FERRY_ABI, ethProvider);
  const neoxFerry = new ethers.Contract(CONTRACTS.NEOX.FERRY, FERRY_ABI, neoxProvider);

  let lastEthBlock = 0;
  let lastNeoxBlock = 0;

  // Poll every 15 seconds
  setInterval(async () => {
    try {
      // Poll Ethereum for new BridgeOut events
      const ethBlock = await ethProvider.getBlockNumber();
      if (ethBlock > lastEthBlock) {
        const fromBlock = Math.max(lastEthBlock, ethBlock - 100); // Check last 100 blocks
        const ethEvents = await ethFerry.queryFilter("BridgeOutRequested", fromBlock, ethBlock);
        
        for (const event of ethEvents) {
          if (event.args) {
            await relayBridgeOut("ETH", {
              from: event.args[0],
              toOnOtherChain: event.args[1],
              amountIn: event.args[2],
              amountOut: event.args[3],
              feePaid: event.args[4],
              nonce: event.args[5],
            }, "NEOX");
          }
        }
        lastEthBlock = ethBlock;
      }

      // Poll Neo X for new BridgeOut events
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
              feePaid: event.args[4],
              nonce: event.args[5],
            }, "ETH");
          }
        }
        lastNeoxBlock = neoxBlock;
      }
    } catch (error) {
      console.error("Error polling bridges:", error);
    }
  }, 15000); // Poll every 15 seconds
}

export async function startRelayer(): Promise<void> {
  try {
    log("Starting relayer service...", "relayer");
    log(`Listening on Ethereum Ferry: ${CONTRACTS.ETH.FERRY}`, "relayer");
    log(`Listening on Neo X Ferry: ${CONTRACTS.NEOX.FERRY}`, "relayer");
    
    await pollBridges();
    
    log("✓ Relayer polling for bridge events (every 15 seconds)", "relayer");
  } catch (error) {
    console.error("Fatal relayer error:", error);
  }
}
