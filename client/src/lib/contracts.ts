import { ethers } from "ethers";

export const NETWORKS = {
  ETH: {
    chainId: 1,
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com", // Public RPC
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
    FERRY: "0x6E43963D748861203Df20e5Ff2AC6aeB807855a7",
  },
  NEOX: {
    PFORK: "0x216490C8E6b33b4d8A2390dADcf9f433E30da60F",
    FERRY: "0xe0Acb6B117747A7671dC5ce57391694281beF212",
  },
};

export const FERRY_ABI = [
  "function bridgeOut(uint256 amount, address toOnOtherChain) external",
  "event BridgeOutRequested(address indexed from, address indexed toOnOtherChain, uint256 amountIn, uint256 amountOut, uint256 feePaid, uint256 nonce)",
];

export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];
