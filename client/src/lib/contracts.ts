import { ethers } from "ethers";

export const NETWORKS = {
  ETH: {
    chainId: 1,
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com",
    explorer: "https://etherscan.io",
    currency: "ETH",
  },
  NEOX: {
    chainId: 47763,
    name: "Neo X",
    rpc: "https://mainnet-2.rpc.banelabs.org",
    explorer: "https://xexplorer.neo.org",
    currency: "GAS",
  },
};

export const CONTRACTS = {
  ETH: {
    PFORK: "0x536d98Ad83F7d0230B9384e606208802ECD728FE",
    FERRY: "0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86",
  },
  NEOX: {
    PFORK: "0x216490C8E6b33b4d8A2390dADcf9f433E30da60F",
    FERRY: "0x81aC8AEDdaC85aA14011ab88944aA147472aC525",
  },
};

export const FERRY_ABI = [
  "function bridgeOut(uint256 amount, address toOnOther) payable",
  "function fulfillBridgeIn(address to, uint256 amount, bytes32 messageId) payable",
  "function nativeFeeWei() view returns (uint256)",
  "function feeBps() view returns (uint16)",
  "function processedMessages(bytes32) view returns (bool)",
  "event BridgeOutRequested(address indexed from, address indexed toOnOtherChain, uint256 amountIn, uint256 amountOut, uint256 pforkFeePaid, uint256 nonce)",
  "event BridgeInFulfilled(address indexed to, uint256 amount, bytes32 indexed messageId)",
];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
