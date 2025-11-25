import { ethers } from "ethers";

export type BridgeStatus = "pending" | "claimed";

export interface PendingBridge {
  messageId: string;
  from: string;
  toOnOtherChain: string;
  amountOut: string;
  sourceChain: "ETH" | "NEOX";
  destChain: "ETH" | "NEOX";
  sourceTxHash: string;
  nonce: string;
  timestamp: number;
  status: BridgeStatus;
  claimTxHash?: string;
  mintedTokenId?: string; // NFT token ID if minted
}

const STORAGE_KEY = "ferryman_bridge_history";

export function computeMessageId(
  srcChainId: number,
  dstChainId: number,
  srcFerry: string,
  nonce: string,
  from: string,
  toOnOther: string,
  amountIn: string,
  amountOut: string,
  nativeFee: string
): string {
  return ethers.keccak256(
    ethers.solidityPacked(
      ["uint16", "uint16", "address", "uint256", "address", "address", "uint256", "uint256", "uint256"],
      [srcChainId, dstChainId, srcFerry, nonce, from, toOnOther, amountIn, amountOut, nativeFee]
    )
  );
}

export function saveBridge(bridge: PendingBridge): void {
  const bridges = getBridges();
  const existing = bridges.findIndex((b) => b.messageId === bridge.messageId);
  
  if (existing >= 0) {
    bridges[existing] = bridge;
  } else {
    bridges.push(bridge);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bridges));
}

export function getBridges(): PendingBridge[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function getPendingBridges(): PendingBridge[] {
  return getBridges().filter((b) => b.status === "pending");
}

export function markBridgeAsClaimed(messageId: string, claimTxHash: string): void {
  const bridges = getBridges();
  const bridge = bridges.find((b) => b.messageId === messageId);
  
  if (bridge) {
    bridge.status = "claimed";
    bridge.claimTxHash = claimTxHash;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bridges));
  }
}

export function markBridgeAsNFTMinted(messageId: string, tokenId: string): void {
  const bridges = getBridges();
  const bridge = bridges.find((b) => b.messageId === messageId);
  
  if (bridge) {
    bridge.mintedTokenId = tokenId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bridges));
  }
}

export function clearBridgeHistory(): void {
  localStorage.removeItem(STORAGE_KEY);
}
