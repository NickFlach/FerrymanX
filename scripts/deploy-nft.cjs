const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const network = hre.network.name;
  
  const ferryContracts = {
    ethereum: "0xDE7cF1Dd14b613db5A4727A59ad1Cc1ba6f47a86",
    neox: "0x81aC8AEDdaC85aA14011ab88944aA147472aC525"
  };
  
  const ferryContract = ferryContracts[network];
  
  if (!ferryContract) {
    console.error(`Unknown network: ${network}. Use --network ethereum or --network neox`);
    process.exit(1);
  }
  
  console.log(`\n🚀 Deploying QuantumSignatureNFT to ${network}...`);
  console.log(`Ferry Contract: ${ferryContract}\n`);
  
  const QuantumSignatureNFT = await hre.ethers.getContractFactory("QuantumSignatureNFT");
  const nft = await QuantumSignatureNFT.deploy(ferryContract);
  
  await nft.waitForDeployment();
  
  const address = await nft.getAddress();
  
  console.log(`✅ QuantumSignatureNFT deployed to: ${address}\n`);
  
  // Update client config
  const contractsFile = path.join(__dirname, "../client/src/lib/nftContract.ts");
  let content = fs.readFileSync(contractsFile, "utf8");
  
  if (network === "ethereum") {
    content = content.replace(
      /ETH:\s*"0x[a-fA-F0-9]{40}"/,
      `ETH: "${address}"`
    );
  } else if (network === "neox") {
    content = content.replace(
      /NEOX:\s*"0x[a-fA-F0-9]{40}"/,
      `NEOX: "${address}"`
    );
  }
  
  fs.writeFileSync(contractsFile, content);
  console.log(`✅ Updated ${contractsFile}\n`);
  
  // Update replit.md
  const replitMdFile = path.join(__dirname, "../replit.md");
  if (fs.existsSync(replitMdFile)) {
    let mdContent = fs.readFileSync(replitMdFile, "utf8");
    
    if (network === "ethereum") {
      mdContent = mdContent.replace(
        /- QuantumSignatureNFT Contract: `0x[a-fA-F0-9]{40}`/g,
        `- QuantumSignatureNFT Contract: \`${address}\``
      );
    } else if (network === "neox") {
      const lines = mdContent.split('\n');
      let inNeoXSection = false;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('**Neo X Mainnet**')) {
          inNeoXSection = true;
        } else if (lines[i].includes('**') && inNeoXSection) {
          inNeoXSection = false;
        }
        
        if (inNeoXSection && lines[i].includes('QuantumSignatureNFT Contract:')) {
          lines[i] = lines[i].replace(/0x[a-fA-F0-9]{40}/, address);
        }
      }
      mdContent = lines.join('\n');
    }
    
    fs.writeFileSync(replitMdFile, mdContent);
    console.log(`✅ Updated ${replitMdFile}\n`);
  }
  
  console.log(`📝 Next steps:`);
  console.log(`1. Set the signer address in the contract:`);
  console.log(`   → Visit the contract on block explorer`);
  console.log(`   → Call setSigner() with your NFT_SIGNER_PRIVATE_KEY wallet address\n`);
  
  if (network === "ethereum") {
    console.log(`🔗 View on Etherscan: https://etherscan.io/address/${address}\n`);
  } else {
    console.log(`🔗 View on Neo X Explorer: https://xexplorer.neo.org/address/${address}\n`);
  }
  
  console.log(`💡 Now deploy to the other network!`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
