import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { ethers } from "ethers";
import { log } from "./app";
import { eq, and } from "drizzle-orm";

const NFT_CONTRACTS = {
  ETH: process.env.ETH_NFT_CONTRACT || "0x0000000000000000000000000000000000000000",
  NEOX: process.env.NEOX_NFT_CONTRACT || "0x0000000000000000000000000000000000000000"
};

const FERRY_CONTRACTS = {
  ETH: "0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86",
  NEOX: "0x81aC8AEDdaC85aA14011ab88944aA147472aC525"
};

const FERRY_ABI = [
  "event BridgeOutRequested(address indexed from, address indexed toOnOtherChain, uint256 amountIn, uint256 amountOut, uint256 pforkFeePaid, uint256 nonce)"
];

function computeMessageId(
  srcChainId: number,
  dstChainId: number,
  srcFerry: string,
  nonce: bigint,
  from: string,
  toOnOther: string,
  amountIn: bigint,
  amountOut: bigint,
  nativeFee: bigint
): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["uint16", "uint16", "address", "uint256", "address", "address", "uint256", "uint256", "uint256"],
      [srcChainId, dstChainId, srcFerry, nonce, from, toOnOther, amountIn, amountOut, nativeFee]
    )
  );
}

const ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL || "https://eth.llamarpc.com");
const neoxProvider = new ethers.JsonRpcProvider(process.env.NEOX_RPC_URL || "https://mainnet-2.rpc.banelabs.org");

export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/nft/attestation", async (req, res) => {
    try {
      const { messageId, bridger, amount, timestamp, sourceChain, destChain, txHash } = req.body;
      
      if (!messageId || !bridger || !amount || !timestamp || !sourceChain || !destChain || !txHash) {
        return res.status(400).json({ error: "Missing required fields (need txHash)" });
      }
      
      if (!process.env.NFT_SIGNER_PRIVATE_KEY) {
        log("NFT_SIGNER_PRIVATE_KEY not configured", "nft");
        return res.status(503).json({ 
          error: "NFT minting not configured. Please set NFT_SIGNER_PRIVATE_KEY environment variable." 
        });
      }
      
      const nftContractAddress = sourceChain === 1 ? NFT_CONTRACTS.ETH : NFT_CONTRACTS.NEOX;
      
      if (nftContractAddress === "0x0000000000000000000000000000000000000000") {
        return res.status(503).json({ 
          error: "NFT contract not deployed yet. Please deploy contract and set addresses." 
        });
      }
      
      const provider = sourceChain === 1 ? ethProvider : neoxProvider;
      const ferryAddress = sourceChain === 1 ? FERRY_CONTRACTS.ETH : FERRY_CONTRACTS.NEOX;
      
      let validatedLogIndex = -1;
      
      try {
        const receipt = await provider.getTransactionReceipt(txHash);
        
        if (!receipt) {
          return res.status(404).json({ 
            error: "Transaction not found on blockchain. Please provide a valid bridge transaction hash." 
          });
        }
        
        if (receipt.from?.toLowerCase() !== bridger.toLowerCase()) {
          return res.status(403).json({ 
            error: "Transaction sender does not match claimed bridger address." 
          });
        }
        
        const block = await provider.getBlock(receipt.blockNumber);
        if (!block) {
          return res.status(404).json({ error: "Block not found on blockchain." });
        }
        
        const blockTimestamp = Number(block.timestamp);
        const timeDiff = Math.abs(blockTimestamp - timestamp);
        if (timeDiff > 60) {
          return res.status(400).json({
            error: `Timestamp mismatch: blockchain shows ${blockTimestamp}, provided ${timestamp} (diff: ${timeDiff}s)`
          });
        }
        
        const ferryContract = new ethers.Contract(ferryAddress, FERRY_ABI, provider);
        const logs = receipt.logs.filter(l => l.address.toLowerCase() === ferryAddress.toLowerCase());
        
        const derivedDestChain = sourceChain === 1 ? 47763 : 1;
        if (derivedDestChain !== destChain) {
          return res.status(400).json({
            error: `DestChain mismatch: derived ${derivedDestChain}, provided ${destChain}`
          });
        }
        
        let validatedEvent = null;
        for (const logEntry of logs) {
          try {
            const parsed = ferryContract.interface.parseLog({
              topics: [...logEntry.topics],
              data: logEntry.data
            });
            
            if (parsed && parsed.name === "BridgeOutRequested") {
              if (parsed.args.from.toLowerCase() === bridger.toLowerCase()) {
                const eventAmountOut = parsed.args.amountOut;
                const providedAmount = BigInt(amount);
                
                if (eventAmountOut.toString() !== providedAmount.toString()) {
                  log(`Amount mismatch: event=${eventAmountOut}, provided=${providedAmount}`, "nft");
                  continue;
                }
                
                const canonicalMessageId = computeMessageId(
                  sourceChain,
                  destChain,
                  ferryAddress,
                  parsed.args.nonce,
                  parsed.args.from,
                  parsed.args.toOnOtherChain,
                  parsed.args.amountIn,
                  parsed.args.amountOut,
                  parsed.args.pforkFeePaid
                );
                
                if (canonicalMessageId.toLowerCase() !== messageId.toLowerCase()) {
                  log(`MessageId mismatch: computed=${canonicalMessageId}, provided=${messageId}`, "nft");
                  continue;
                }
                
                validatedEvent = parsed.args;
                validatedLogIndex = logEntry.index;
                break;
              }
            }
          } catch (e) {
            continue;
          }
        }
        
        if (!validatedEvent || validatedLogIndex === -1) {
          return res.status(404).json({ 
            error: "No matching BridgeOutRequested event found. Bridge data does not match on-chain event." 
          });
        }
        
        const existingSigned = await storage.checkNftTransactionSigned(txHash.toLowerCase(), validatedLogIndex, sourceChain);
        if (existingSigned) {
          return res.status(409).json({ 
            error: "This bridge event has already been used to mint an NFT. Each bridge can only mint one NFT." 
          });
        }
        
        log(`Verified bridge transaction ${txHash.slice(0, 10)}... (log ${validatedLogIndex}) for ${bridger.slice(0, 10)}... at timestamp ${blockTimestamp} with amount ${validatedEvent.amountOut.toString()} and messageId ${messageId.slice(0, 10)}...`, "nft");
        
      } catch (verifyError: any) {
        log(`Bridge verification failed: ${verifyError.message}`, "nft");
        return res.status(400).json({ 
          error: `Failed to verify bridge transaction: ${verifyError.message}` 
        });
      }
      
      const wallet = new ethers.Wallet(process.env.NFT_SIGNER_PRIVATE_KEY);
      
      // EIP-712 domain matching the NFT contract
      const domain = {
        name: "QuantumSignatureNFT",
        version: "1",
        chainId: sourceChain,
        verifyingContract: nftContractAddress
      };
      
      // EIP-712 types matching the NFT contract
      const types = {
        MintRequest: [
          { name: "messageId", type: "bytes32" },
          { name: "bridger", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "sourceChain", type: "uint256" },
          { name: "destChain", type: "uint256" }
        ]
      };
      
      // The message to sign
      const message = {
        messageId,
        bridger,
        amount,
        timestamp,
        sourceChain,
        destChain
      };
      
      // Sign using EIP-712 typed data
      const signature = await wallet.signTypedData(domain, types, message);
      
      await storage.recordNftTransactionSigned({
        txHash: txHash.toLowerCase(),
        logIndex: validatedLogIndex,
        sourceChain,
        bridger: bridger.toLowerCase(),
        messageId,
        amount: amount.toString(),
      });
      
      log(`Signed NFT attestation for verified bridge ${messageId.slice(0, 10)}... by ${bridger.slice(0, 10)}... (txHash: ${txHash.slice(0, 10)}...)`, "nft");
      
      res.json({ signature });
    } catch (error: any) {
      log(`NFT attestation error: ${error.message}`, "nft");
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
