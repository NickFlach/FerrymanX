import { ethers } from "ethers";

export const NFT_CONTRACTS = {
  ETH: "0x21A95E8b28C56cC97b22f3C85121B81F2a8074D1",
  NEOX: "0x34446F7a2Ac26B1d789279d1bE5D2Cd66C28D27E",
};

export const QUANTUM_SIGNATURE_NFT_ABI = [
  "function mintSignature(bytes32 messageId, address bridger, uint256 amount, uint256 timestamp, uint256 sourceChain, uint256 destChain, bytes signature) external returns (uint256)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)",
  "function generateSVG(uint256 tokenId) public view returns (string memory)",
  "function totalSupply() public view returns (uint256)",
  "function minted(bytes32 messageId) public view returns (bool)",
  "function messageIdToTokenId(bytes32 messageId) public view returns (uint256)",
  "function tokenMetadata(uint256 tokenId) public view returns (tuple(bytes32 messageId, address bridger, uint256 amount, uint256 timestamp, uint256 sourceChain, uint256 destChain, string quantumState))",
  "event QuantumSignatureMinted(uint256 indexed tokenId, bytes32 indexed messageId, address indexed bridger, string quantumState)",
];

export function getOpenSeaUrl(chainId: number, contractAddress: string, tokenId: string): string {
  if (chainId === 1) {
    return `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  } else if (chainId === 47763) {
    return `https://opensea.io/assets/neox/${contractAddress}/${tokenId}`;
  }
  return `https://opensea.io/assets/${contractAddress}/${tokenId}`;
}

export function getExplorerUrl(chainId: number, txHash: string): string {
  if (chainId === 1) {
    return `https://etherscan.io/tx/${txHash}`;
  } else if (chainId === 47763) {
    return `https://xexplorer.neo.org/transaction/${txHash}`;
  }
  return `https://etherscan.io/tx/${txHash}`;
}
