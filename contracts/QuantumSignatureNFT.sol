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
 * @notice Cross-chain bridge receipts as fully on-chain generative NFTs.
 *
 * Features:
 * - True EIP-712 typed signatures (secure & replay-protected)
 * - Ferry contract restricted (only bridge pipeline can mint)
 * - Dynamic chain name resolution for metadata
 * - Deterministic generative SVG based on messageId
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

    /// @dev Typed struct hash for EIP-712 signatures
    bytes32 private constant MINT_TYPEHASH =
        keccak256(
            "MintRequest(bytes32 messageId,address bridger,uint256 amount,uint256 timestamp,uint256 sourceChain,uint256 destChain)"
        );

    uint256 private _tokenIdCounter;

    address public immutable ferryContract;
    address public signer;

    mapping(bytes32 => bool) public minted;
    mapping(bytes32 => uint256) public messageIdToTokenId;
    mapping(uint256 => BridgeMetadata) public tokenMetadata;

    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event QuantumSignatureMinted(
        uint256 indexed tokenId,
        bytes32 indexed messageId,
        address indexed bridger,
        string quantumState
    );

    constructor(address _ferryContract)
        ERC721("Quantum Signature", "QSIG")
        EIP712("QuantumSignatureNFT", "1")
        Ownable(msg.sender)
    {
        require(_ferryContract != address(0), "Invalid ferry");
        ferryContract = _ferryContract;
        signer = msg.sender;
    }

    // ------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    // ------------------------------------------------------------
    // Minting
    // ------------------------------------------------------------
    /**
     * @dev Mint an NFT for a verified bridge tx from Ferry contract.
     * @param signature EIP712 signature by authorized backend signer
     */
    function mintSignature(
        bytes32 messageId,
        address bridger,
        uint256 amount,
        uint256 timestamp,
        uint256 sourceChain,
        uint256 destChain,
        bytes calldata signature
    ) external returns (uint256) {
        require(msg.sender == ferryContract, "Only ferry contract");
        require(!minted[messageId], "Already minted");

        // Construct typed mint request
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

        bytes32 digest = _hashTypedDataV4(structHash);

        address recovered = ECDSA.recover(digest, signature);
        require(recovered == signer, "Invalid signature");

        minted[messageId] = true;

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
            quantumState
        );

        return tokenId;
    }

    // ------------------------------------------------------------
    // Deterministic Quantum State
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
    // SVG Art
    // ------------------------------------------------------------
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "Nonexistent token");

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
                '" font-family="monospace" font-size="12">',
                meta.quantumState,
                '</text>',
                "</svg>"
            )
        );
    }

    function _generateShapes(uint256 seed, string memory color)
        internal
        pure
        returns (string memory)
    {
        string memory output = "";
        uint256 numShapes = (seed % 15) + 10;

        for (uint256 i = 0; i < numShapes; i++) {
            seed = uint256(keccak256(abi.encodePacked(seed, i)));
            output = string(
                abi.encodePacked(output, _generateSingleShape(seed, color))
            );
        }

        return output;
    }

    function _generateSingleShape(uint256 seed, string memory color)
        internal
        pure
        returns (string memory)
    {
        uint256 x = (seed % 350) + 25;
        uint256 y = ((seed >> 8) % 350) + 25;
        uint256 size = ((seed >> 16) % 60) + 20;
        uint256 op = ((seed >> 24) % 60) + 20;
        uint256 shape = seed % 3;

        string memory opacity = string(
            abi.encodePacked("0.", op.toString())
        );

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
                x.toString(),
                ",",
                (y - o).toString(),
                " ",
                (x + o).toString(),
                ",",
                (y + o).toString(),
                " ",
                (x - o).toString(),
                ",",
                (y + o).toString(),
                '" fill="',
                color,
                '" opacity="',
                opacity,
                '"/>'
            )
        );
    }

    // ------------------------------------------------------------
    // Token URI
    // ------------------------------------------------------------
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "Nonexistent token");

        BridgeMetadata memory meta = tokenMetadata[tokenId];
        string memory svg = generateSVG(tokenId);

        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name":"Quantum Signature #',
                        tokenId.toString(),
                        '", "description":"Cross-chain quantum receipt NFT",',
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

    // ------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------
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
}
