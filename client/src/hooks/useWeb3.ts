import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { NETWORKS, CONTRACTS, FERRY_ABI, ERC20_ABI } from "../lib/contracts";
import { useToast } from "@/hooks/use-toast";

export type NetworkType = "ETH" | "NEOX";

declare global {
  interface Window {
    ethereum: any;
  }
}

export function useWeb3() {
  const { toast } = useToast();
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      toast({
        title: "Wallet not found",
        description: "Please install MetaMask or another Web3 wallet.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsConnecting(true);
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await browserProvider.send("eth_requestAccounts", []);
      const network = await browserProvider.getNetwork();
      const signerInstance = await browserProvider.getSigner();

      setProvider(browserProvider);
      setSigner(signerInstance);
      setAccount(accounts[0]);
      setChainId(Number(network.chainId));
    } catch (error: any) {
      console.error("Connection error:", error);
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect to wallet.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const switchNetwork = useCallback(async (targetNetwork: NetworkType) => {
    if (!window.ethereum) return;

    const targetChainId = NETWORKS[targetNetwork].chainId;
    const targetChainIdHex = "0x" + targetChainId.toString(16);

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainIdHex }],
      });
    } catch (error: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: targetChainIdHex,
                chainName: NETWORKS[targetNetwork].name,
                rpcUrls: [NETWORKS[targetNetwork].rpc],
                nativeCurrency: {
                  name: NETWORKS[targetNetwork].currency,
                  symbol: NETWORKS[targetNetwork].currency, 
                  decimals: 18,
                },
                blockExplorerUrls: [NETWORKS[targetNetwork].explorer],
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add network:", addError);
          toast({
            title: "Failed to add network",
            description: "Please add the network manually.",
            variant: "destructive",
          });
        }
      } else {
        console.error("Failed to switch network:", error);
        toast({
          title: "Failed to switch network",
          description: "Please switch manually in your wallet.",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  // Listen for account/chain changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) setAccount(accounts[0]);
        else {
          setAccount(null);
          setSigner(null);
        }
      });

      window.ethereum.on("chainChanged", (chainIdHex: string) => {
        setChainId(parseInt(chainIdHex, 16));
        // Reload provider/signer on chain change
        if (window.ethereum) {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            browserProvider.getSigner().then(setSigner);
            setProvider(browserProvider);
        }
      });
    }
    
    // Attempt to check if already connected
    const checkConnection = async () => {
        if(window.ethereum && window.ethereum.selectedAddress) {
             connect();
        }
    }
    checkConnection();
    
    return () => {
        if(window.ethereum) {
             window.ethereum.removeAllListeners();
        }
    }
  }, [connect]);

  return {
    account,
    chainId,
    provider,
    signer,
    connect,
    isConnecting,
    switchNetwork,
  };
}
