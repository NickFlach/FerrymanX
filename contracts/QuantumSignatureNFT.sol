// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title QuantumSignatureNFT
 * @notice On-chain generative NFT receipts for cross-chain bridge events.
 *
 * Features:
 * - True EIP-712 typed message signatures
 * - User pays a mint fee in ETH to mint their own receipt
 * - One NFT per messageId (no double-minting)
 * - Deterministic on-chain SVG art based on messageId
 */
contract QuantumSignatureNFT is ERC721, EIP712, Ownable {
    using Strings for uint256;
    using Strings for address;

    struct BridgeMetadata {
        bytes32 messageId;
        address bridger;
        uint256 amount;
        uint256 timestamp;
        uint256 sourceChain;
        uint256 destChain;
        string quantumState;
    }

    /// @dev Typed struct hash for EIP-712 mint requests.
    bytes32 private constant MINT_TYPEHASH =
        keccak256(
            "MintRequest(bytes32 messageId,address bridger,uint256 amount,uint256 timestamp,uint256 sourceChain,uint256 destChain)"
        );

    uint256 private _tokenIdCounter;

    /// @notice Address whose signatures are accepted for minting.
    address public signer;

    /// @notice Flat mint fee in wei (paid by user).
    uint256 public mintFee;

    /// @notice Tracks which messageIds have already been minted.
    mapping(bytes32 => bool) public minted;

    /// @notice Mapping from messageId to tokenId.
    mapping(bytes32 => uint256) public messageIdToTokenId;

    /// @notice Metadata for each minted token.
    mapping(uint256 => BridgeMetadata) public tokenMetadata;

    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);
    event QuantumSignatureMinted(
        uint256 indexed tokenId,
        bytes32 indexed messageId,
        address indexed bridger,
        uint256 feePaid,
        string quantumState
    );

    // ------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------

    constructor(address _signer, uint256 _mintFee)
        ERC721("Quantum Signature", "QSIG")
        EIP712("QuantumSignatureNFT", "1")
        Ownable(msg.sender) // OZ 5.x requires initialOwner
    {
        require(_signer != address(0), "Invalid signer");
        signer = _signer;
        mintFee = _mintFee;
    }

    // ------------------------------------------------------------
    // Internal existence helper (OZ 5.x, no _exists)
    // ------------------------------------------------------------

    function _requireExists(uint256 tokenId) internal view {
        // OZ 5.x: use ownerOf in a try/catch for existence check
        try this.ownerOf(tokenId) {
            // ok
        } catch {
            revert("ERC721: invalid token ID");
        }
    }

    // ------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------

    /// @notice Update the EIP-712 signer (backend authority).
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    /// @notice Update the ETH mint fee.
    function setMintFee(uint256 _mintFee) external onlyOwner {
        emit MintFeeUpdated(mintFee, _mintFee);
        mintFee = _mintFee;
    }

    /// @notice Withdraw accumulated ETH fees.
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid to");
        require(amount <= address(this).balance, "Insufficient balance");
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "Withdraw failed");
    }

    // ------------------------------------------------------------
    // Minting (user pays + signature-verified)
    // ------------------------------------------------------------

    /**
     * @notice Mint a Quantum Signature NFT for a bridge event.
     * @dev User must:
     *  - Provide a valid EIP-712 signature from `signer`.
     *  - Pay at least `mintFee` in ETH.
     *  - Be the `bridger` address encoded in the signed payload.
     */
    function mintSignature(
        bytes32 messageId,
        address bridger,
        uint256 amount,
        uint256 timestamp,
        uint256 sourceChain,
        uint256 destChain,
        bytes calldata signature
    ) external payable returns (uint256) {
        require(!minted[messageId], "Already minted");
        require(bridger == msg.sender, "Only bridger can mint");
        require(msg.value >= mintFee, "Insufficient mint fee");

        // Build typed struct hash
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_TYPEHASH,
                messageId,
                bridger,
                amount,
                timestamp,
                sourceChain,
                destChain
            )
        );

        // Compute EIP-712 digest
        bytes32 digest = _hashTypedDataV4(structHash);

        // Recover signer and verify
        require(ECDSA.recover(digest, signature) == signer, "Invalid signature");

        // Mark messageId as minted
        minted[messageId] = true;

        // Mint token
        uint256 tokenId = _tokenIdCounter++;
        messageIdToTokenId[messageId] = tokenId;

        string memory quantumState = _computeQuantumState(messageId);

        tokenMetadata[tokenId] = BridgeMetadata({
            messageId: messageId,
            bridger: bridger,
            amount: amount,
            timestamp: timestamp,
            sourceChain: sourceChain,
            destChain: destChain,
            quantumState: quantumState
        });

        _safeMint(bridger, tokenId);

        emit QuantumSignatureMinted(
            tokenId,
            messageId,
            bridger,
            mintFee,
            quantumState
        );

        // Any excess ETH stays in the contract as additional protocol revenue.
        // If you prefer to refund excess, we can add that.

        return tokenId;
    }

    // ------------------------------------------------------------
    // Quantum State
    // ------------------------------------------------------------

    function _computeQuantumState(bytes32 messageId)
        internal
        pure
        returns (string memory)
    {
        uint256 mod = uint256(messageId) % 3;
        if (mod == 0) return "superposition";
        if (mod == 1) return "entangled";
        return "collapsed";
    }

    // ------------------------------------------------------------
    // SVG Generation
    // ------------------------------------------------------------

    function generateSVG(uint256 tokenId) public view returns (string memory) {
        _requireExists(tokenId);

        BridgeMetadata memory meta = tokenMetadata[tokenId];

        string memory color = keccak256(bytes(meta.quantumState)) ==
            keccak256("superposition")
            ? "#a855f7"
            : keccak256(bytes(meta.quantumState)) ==
                keccak256("entangled")
            ? "#3b82f6"
            : "#10b981";

        uint256 seed = uint256(meta.messageId);
        string memory shapes = _generateShapes(seed, color);

        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
                '<rect width="400" height="400" fill="#000"/>',
                shapes,
                '<text x="10" y="380" fill="',
                color,
                '" font-size="12" font-family="monospace">',
                meta.quantumState,
                "</text>",
                "</svg>"
            )
        );
    }

    function _generateShapes(uint256 seed, string memory color)
        internal
        pure
        returns (string memory)
    {
        string memory out = "";
        uint256 n = (seed % 15) + 10;

        for (uint256 i = 0; i < n; i++) {
            seed = uint256(keccak256(abi.encodePacked(seed, i)));
            out = string(abi.encodePacked(out, _generateSingle(seed, color)));
        }

        return out;
    }

    function _generateSingle(uint256 seed, string memory color)
        internal
        pure
        returns (string memory)
    {
        uint256 x = (seed % 350) + 25;
        uint256 y = ((seed >> 8) % 350) + 25;
        uint256 size = ((seed >> 16) % 60) + 20;
        uint256 op = ((seed >> 24) % 60) + 20;
        string memory opacity = string(abi.encodePacked("0.", op.toString()));

        uint256 shape = seed % 3;

        if (shape == 0) {
            return string(
                abi.encodePacked(
                    '<circle cx="',
                    x.toString(),
                    '" cy="',
                    y.toString(),
                    '" r="',
                    size.toString(),
                    '" fill="',
                    color,
                    '" opacity="',
                    opacity,
                    '"/>'
                )
            );
        }

        if (shape == 1) {
            uint256 h = size / 2;
            return string(
                abi.encodePacked(
                    '<rect x="',
                    (x - h).toString(),
                    '" y="',
                    (y - h).toString(),
                    '" width="',
                    size.toString(),
                    '" height="',
                    size.toString(),
                    '" fill="',
                    color,
                    '" opacity="',
                    opacity,
                    '"/>'
                )
            );
        }

        uint256 o = size / 2;
        return string(
            abi.encodePacked(
                '<polygon points="',
                x.toString(), ",", (y - o).toString(), " ",
                (x + o).toString(), ",", (y + o).toString(), " ",
                (x - o).toString(), ",", (y + o).toString(),
                '" fill="', color,
                '" opacity="', opacity, '"/>'
            )
        );
    }

    // ------------------------------------------------------------
    // Metadata
    // ------------------------------------------------------------

    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        _requireExists(tokenId);

        BridgeMetadata memory meta = tokenMetadata[tokenId];
        string memory svg = generateSVG(tokenId);

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"Quantum Signature #',
                        tokenId.toString(),
                        '","description":"Cross-chain quantum receipt NFT",',
                        '"attributes":[',
                        '{"trait_type":"Quantum State","value":"',
                        meta.quantumState,
                        '"},',
                        '{"trait_type":"Source Chain","value":"',
                        _chainName(meta.sourceChain),
                        '"},',
                        '{"trait_type":"Destination Chain","value":"',
                        _chainName(meta.destChain),
                        '"},',
                        '{"trait_type":"Amount","value":"',
                        _formatAmount(meta.amount),
                        '"}',
                        '], "image":"data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '"}'
                    )
                )
            )
        );

        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _chainName(uint256 id) internal pure returns (string memory) {
        if (id == 1) return "Ethereum";
        if (id == 8453) return "Base";
        if (id == 42161) return "Arbitrum One";
        if (id == 10) return "Optimism";
        if (id == 47763) return "Neo X";
        return string(abi.encodePacked("Chain ", id.toString()));
    }

    function _formatAmount(uint256 amount)
        internal
        pure
        returns (string memory)
    {
        return string(
            abi.encodePacked((amount / 1e18).toString(), " PFORK")
        );
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    // Accept ETH directly (if someone sends by accident)
    receive() external payable {}
}