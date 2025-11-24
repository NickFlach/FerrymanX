import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { NETWORKS, CONTRACTS, FERRY_ABI, ERC20_ABI } from "../lib/contracts";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { EthereumProvider } from "@walletconnect/ethereum-provider";

export type NetworkType = "ETH" | "NEOX";
export type WalletType = "metamask" | "walletconnect";

declare global {
  interface Window {
    ethereum: any;
  }
}

export function useWeb3() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [wcProvider, setWcProvider] = useState<any>(null);

  const connectMetaMask = useCallback(async () => {
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
      setWalletType("metamask");
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

  const connectWalletConnect = useCallback(async () => {
    try {
      setIsConnecting(true);

      const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
      
      if (!projectId) {
        toast({
          title: "Configuration Error",
          description: "WalletConnect Project ID is not configured. Please contact support.",
          variant: "destructive",
        });
        setIsConnecting(false);
        return;
      }

      const provider = await EthereumProvider.init({
        projectId,
        chains: [1, 47763],
        optionalChains: [1, 47763],
        showQrModal: true,
        metadata: {
          name: "FerryManX",
          description: "Cross-chain PFORK bridge",
          url: window.location.origin,
          icons: [window.location.origin + "/pfork-logo.webp"],
        },
      });

      await provider.connect();

      const ethersProvider = new ethers.BrowserProvider(provider);
      const signerInstance = await ethersProvider.getSigner();
      const address = await signerInstance.getAddress();
      const network = await ethersProvider.getNetwork();

      setWcProvider(provider);
      setProvider(ethersProvider);
      setSigner(signerInstance);
      setAccount(address);
      setChainId(Number(network.chainId));
      setWalletType("walletconnect");

      provider.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          ethersProvider.getSigner().then(setSigner);
        } else {
          disconnect();
        }
      });

      provider.on("chainChanged", (chainIdHex: string) => {
        const newChainId = parseInt(chainIdHex, 16);
        setChainId(newChainId);
        ethersProvider.getSigner().then(setSigner);
      });

      provider.on("disconnect", () => {
        disconnect();
      });

    } catch (error: any) {
      console.error("WalletConnect error:", error);
      toast({
        title: "Connection failed",
        description: error.message || "Could not connect via WalletConnect.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  }, [toast]);

  const connect = useCallback(async (type?: WalletType) => {
    if (type === "walletconnect") {
      return connectWalletConnect();
    }
    return connectMetaMask();
  }, [connectMetaMask, connectWalletConnect]);

  const disconnect = useCallback(async () => {
    if (wcProvider) {
      try {
        await wcProvider.disconnect();
      } catch (error) {
        console.error("Error disconnecting WalletConnect:", error);
      }
      setWcProvider(null);
    }
    
    setAccount(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setWalletType(null);
    setLocation("/");
    toast({
      title: "Disconnected",
      description: "Wallet disconnected successfully.",
    });
  }, [setLocation, toast, wcProvider]);

  const switchNetwork = useCallback(async (targetNetwork: NetworkType) => {
    const targetChainId = NETWORKS[targetNetwork].chainId;
    const targetChainIdHex = "0x" + targetChainId.toString(16);

    try {
      if (walletType === "walletconnect" && wcProvider) {
        await wcProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetChainIdHex }],
        });
      } else if (window.ethereum) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetChainIdHex }],
        });
      }
    } catch (error: any) {
      if (error.code === 4902) {
        try {
          const provider = walletType === "walletconnect" ? wcProvider : window.ethereum;
          if (provider) {
            await provider.request({
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
          }
        } catch (addError) {
          console.error("Failed to add network:", addError);
        }
      }
    }
  }, [walletType, wcProvider]);

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
        if (window.ethereum) {
            const browserProvider = new ethers.BrowserProvider(window.ethereum);
            browserProvider.getSigner().then(setSigner);
            setProvider(browserProvider);
        }
      });
    }
    
    return () => {
        if(window.ethereum) {
             window.ethereum.removeAllListeners();
        }
    }
  }, []);

  return {
    account,
    chainId,
    provider,
    signer,
    connect,
    disconnect,
    isConnecting,
    switchNetwork,
    walletType,
  };
}
