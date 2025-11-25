// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title QuantumSignatureNFT
 * @dev Each bridge transaction can be minted as a unique NFT with generative on-chain art
 * 
 * Security Features:
 * - One NFT per bridge (messageId prevents double-minting)
 * - Only bridge participant can mint (signature verification)
 * - Deterministic art generation (same messageId = same art)
 * - No reentrancy vulnerabilities (follows checks-effects-interactions)
 */
contract QuantumSignatureNFT is ERC721, Ownable {
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

    uint256 private _tokenIdCounter;
    
    mapping(bytes32 => bool) public minted;
    mapping(bytes32 => uint256) public messageIdToTokenId;
    mapping(uint256 => BridgeMetadata) public tokenMetadata;
    
    address public immutable ferryContract;
    uint256 public immutable chainId;
    address public signer;
    
    event QuantumSignatureMinted(
        uint256 indexed tokenId,
        bytes32 indexed messageId,
        address indexed bridger,
        string quantumState
    );
    
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);

    constructor(
        address _ferryContract,
        uint256 _chainId
    ) ERC721("Quantum Signature", "QSIG") Ownable(msg.sender) {
        ferryContract = _ferryContract;
        chainId = _chainId;
        signer = msg.sender;
    }
    
    /**
     * @dev Set the authorized signer address (only owner can call)
     * @param _signer Address authorized to sign mint attestations
     */
    function setSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer address");
        address oldSigner = signer;
        signer = _signer;
        emit SignerUpdated(oldSigner, _signer);
    }

    /**
     * @dev Mint a Quantum Signature NFT for a completed bridge transaction
     * @param messageId Unique bridge message identifier
     * @param bridger Address that initiated the bridge
     * @param amount Amount bridged (in wei)
     * @param timestamp Bridge timestamp
     * @param sourceChain Source chain ID (1 for ETH, 47763 for Neo X)
     * @param destChain Destination chain ID
     * @param signature EIP-712 signature from contract owner attesting to bridge validity
     */
    function mintSignature(
        bytes32 messageId,
        address bridger,
        uint256 amount,
        uint256 timestamp,
        uint256 sourceChain,
        uint256 destChain,
        bytes memory signature
    ) external returns (uint256) {
        require(!minted[messageId], "Already minted");
        require(msg.sender == bridger, "Only bridger can mint");
        require(sourceChain == chainId || destChain == chainId, "Invalid chain");
        
        bytes32 messageHash = keccak256(abi.encodePacked(
            messageId,
            bridger,
            amount,
            timestamp,
            sourceChain,
            destChain,
            address(this)
        ));
        
        bytes32 ethSignedMessageHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
        address recovered = ECDSA.recover(ethSignedMessageHash, signature);
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
        
        emit QuantumSignatureMinted(tokenId, messageId, bridger, quantumState);
        
        return tokenId;
    }

    /**
     * @dev Generate deterministic quantum state from messageId
     */
    function _computeQuantumState(bytes32 messageId) internal pure returns (string memory) {
        uint256 hash = uint256(messageId);
        uint256 mod = hash % 3;
        
        if (mod == 0) return "superposition";
        if (mod == 1) return "entangled";
        return "collapsed";
    }

    /**
     * @dev Generate on-chain SVG art deterministically from messageId
     */
    function generateSVG(uint256 tokenId) public view returns (string memory) {
        require(tokenId < _tokenIdCounter, "Token does not exist");
        
        BridgeMetadata memory meta = tokenMetadata[tokenId];
        uint256 seed = uint256(meta.messageId);
        
        string memory stateColor = keccak256(bytes(meta.quantumState)) == keccak256(bytes("superposition"))
            ? "#a855f7"
            : keccak256(bytes(meta.quantumState)) == keccak256(bytes("entangled"))
                ? "#3b82f6"
                : "#10b981";
        
        string memory shapes = _generateShapes(seed, stateColor);
        
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" fill="#000"/>',
            shapes,
            '<text x="10" y="380" fill="',
            stateColor,
            '" font-size="12" font-family="monospace">',
            meta.quantumState,
            '</text>',
            '<text x="10" y="395" fill="#888" font-size="10" font-family="monospace">',
            _substring(uint256(uint160(meta.bridger)).toHexString(), 0, 10),
            '</text>',
            '</svg>'
        ));
    }

    /**
     * @dev Generate a single shape SVG string
     */
    function _generateSingleShape(uint256 seed, string memory color) internal pure returns (string memory) {
        uint256 x = (seed % 350) + 25;
        uint256 y = ((seed >> 8) % 350) + 25;
        uint256 size = ((seed >> 16) % 60) + 20;
        uint256 opacity = ((seed >> 24) % 60) + 20;
        uint256 shapeType = seed % 3;
        
        if (shapeType == 0) {
            return string(abi.encodePacked(
                '<circle cx="', x.toString(), '" cy="', y.toString(),
                '" r="', size.toString(), '" fill="', color,
                '" opacity="0.', opacity.toString(), '"/>'
            ));
        }
        
        if (shapeType == 1) {
            uint256 half = size / 2;
            return string(abi.encodePacked(
                '<rect x="', (x - half).toString(), '" y="', (y - half).toString(),
                '" width="', size.toString(), '" height="', size.toString(),
                '" fill="', color, '" opacity="0.', opacity.toString(), '"/>'
            ));
        }
        
        uint256 offset = size / 2;
        return string(abi.encodePacked(
            '<polygon points="', x.toString(), ',', (y - offset).toString(), ' ',
            (x + offset).toString(), ',', (y + offset).toString(), ' ',
            (x - offset).toString(), ',', (y + offset).toString(),
            '" fill="', color, '" opacity="0.', opacity.toString(), '"/>'
        ));
    }
    
    /**
     * @dev Generate deterministic geometric shapes from seed
     */
    function _generateShapes(uint256 seed, string memory color) internal pure returns (string memory) {
        string memory output = "";
        uint256 numShapes = (seed % 15) + 10;
        
        for (uint256 i = 0; i < numShapes; i++) {
            seed = uint256(keccak256(abi.encodePacked(seed, i)));
            output = string(abi.encodePacked(output, _generateSingleShape(seed, color)));
        }
        
        return output;
    }

    /**
     * @dev Returns the token URI with on-chain metadata and SVG
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < _tokenIdCounter, "Token does not exist");
        
        BridgeMetadata memory meta = tokenMetadata[tokenId];
        string memory svg = generateSVG(tokenId);
        
        string memory json = Base64.encode(
            bytes(
                string(
                    abi.encodePacked(
                        '{"name": "Quantum Signature #',
                        tokenId.toString(),
                        '", "description": "A unique quantum signature representing a cross-chain bridge transaction on FerryManX", ',
                        '"attributes": [',
                        '{"trait_type": "Quantum State", "value": "',
                        meta.quantumState,
                        '"},',
                        '{"trait_type": "Source Chain", "value": "',
                        meta.sourceChain == 1 ? "Ethereum" : "Neo X",
                        '"},',
                        '{"trait_type": "Dest Chain", "value": "',
                        meta.destChain == 1 ? "Ethereum" : "Neo X",
                        '"},',
                        '{"trait_type": "Amount", "value": "',
                        _formatAmount(meta.amount),
                        '"},',
                        '{"trait_type": "Timestamp", "value": ',
                        meta.timestamp.toString(),
                        '}',
                        '], "image": "data:image/svg+xml;base64,',
                        Base64.encode(bytes(svg)),
                        '"}'
                    )
                )
            )
        );
        
        return string(abi.encodePacked("data:application/json;base64,", json));
    }

    function _formatAmount(uint256 amount) internal pure returns (string memory) {
        return string(abi.encodePacked((amount / 1e18).toString(), " PFORK"));
    }

    function _substring(string memory str, uint256 start, uint256 len) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        bytes memory result = new bytes(len);
        for (uint256 i = 0; i < len; i++) {
            if (start + i < strBytes.length) {
                result[i] = strBytes[start + i];
            }
        }
        return string(result);
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
}
