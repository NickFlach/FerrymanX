# FerryManX - PFORK Cross-Chain Bridge

## Overview

FerryManX is a cross-chain bridge application enabling secure token transfers of PFORK tokens between Ethereum and Neo X networks. It features an automated relayer service that monitors bridge events and completes cross-chain transfers. Users pay an upfront native fee to fund relayer operations. A key feature is the "Quantum Ferry," an AI-powered visualization and analytics layer offering real-time particle physics simulations, generative transaction art, and predictive analytics for optimal bridge timing, accessible at `/quantum`. The project also includes an NFT minting system for bridge transactions, generating unique on-chain art for each validated transfer.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite.
**UI Components**: shadcn/ui (Radix UI, Tailwind CSS, dark mode support).
**State Management**: TanStack Query for server state, React hooks for local state.
**Routing**: wouter.
**Web3 Integration**: ethers.js v6 with a `useWeb3` hook for blockchain interactions.
**Design Rationale**: Separates blockchain logic from UI via custom hooks; uses lightweight libraries for performance and maintainability.

### Backend Architecture

**Framework**: Express.js.
**Relayer Service**: A background service (`relayer.ts`) polls Ethereum and Neo X every 15 seconds for `BridgeOutRequested` events and calls `fulfillBridgeIn` on the destination chain. It uses deterministic hashing (keccak256) for message IDs to prevent duplicates.
**NFT Attestation Endpoint**: Verifies on-chain transaction data (events, amounts, timestamps, message IDs) against claimed metadata before issuing a signature for NFT minting. It uses a multi-layered security model to prevent replay attacks and ensure authenticity.
**Design Rationale**: Relayer integrated into the backend for simplified Replit deployment; polling for reliability across RPCs.

### Data Storage

**Primary Database**: PostgreSQL via Neon serverless driver, managed by Drizzle ORM.
**Development Fallback**: In-memory storage (`MemStorage`).
**Client-Side Storage**: LocalStorage for persisting bridge transaction history.
**NFT Attestation Storage**: `signedNftTransactions` table in PostgreSQL tracks signed attestations, with unique constraints to prevent replay attacks and ensure data integrity.
**Design Rationale**: Client-side storage for bridge history enhances UX without backend authentication; in-memory fallback for development. Database-level unique constraints for NFT attestation security.

### Smart Contract Integration

**Networks Supported**: Ethereum Mainnet (Chain ID: 1), Neo X Mainnet (Chain ID: 47763).
**Contract ABIs**: Minimal ABIs for Ferry and ERC20 contracts.
**Ferry Contract Methods**: `bridgeOut` (user), `fulfillBridgeIn` (relayer), `nativeFeeWei`, `feeBps`.
**Event Monitoring**: Relayer listens for `BridgeOutRequested` events.
**QuantumSignatureNFT Contract**: ERC-721 compliant, with on-chain SVG generation, signature-based attestation, and replay protection. Users pay a small mint fee (in native currency) when minting NFTs, collected by the contract owner. The Ferry contract restriction has been removed—anyone with a valid backend signature can mint.
**Design Rationale**: Separate Ferry contracts for independent upgrades; upfront fee model simplifies relayer economics. NFT contracts use secure OpenZeppelin libraries for verification. Mint fee provides sustainable revenue for operations.

### UI/UX Decisions

**Quantum Ferry Page**: Features an interactive HTML5 canvas with real-time particle simulations, generative art from transaction hashes, predictive analytics, and network health metrics. Includes a signature gallery and a deep analytics dashboard.
**NFT Minting Integration**: "Mint NFT" buttons on the Bridge Activity page with status badges and clear instructions.

## External Dependencies

### Blockchain Networks
- **Ethereum Mainnet**: RPC: `https://eth.llamarpc.com`
  - Ferry Contract: `0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86`
  - PFORK Token: `0x536d98Ad83F7d0230B9384e606208802ECD728FE`
  - QuantumSignatureNFT Contract: `0x40eA38a86F7a67C03F9EF30e6c96097a373A5FbE`
- **Neo X Mainnet**: RPC: `https://mainnet-2.rpc.banelabs.org`
  - Ferry Contract: `0x81aC8AEDdaC85aA14011ab88944aA147472aC525`
  - PFORK Token: `0x216490C8E6b33b4d8A2390dADcf9f433E30da60F`
  - QuantumSignatureNFT Contract: `0x5bf7926Ed124a25997eDAd4fC3Da443cd14D63D8`

### Database
- **Neon Postgres**: Serverless PostgreSQL via `@neondatabase/serverless`.

### Third-Party Services
- **Block Explorers**: Etherscan (Ethereum), Neo X Explorer (Neo X).

### Web3 Provider
- **User Wallets**: MetaMask or other EIP-1193 compatible wallets.
- **Relayer**: Direct RPC connections using ethers.js providers.