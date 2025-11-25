import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, Wallet, ShieldCheck, History, X, Ship, Waves, ExternalLink, CheckCircle2, Loader2, LogOut, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWeb3, NetworkType, WalletType } from "@/hooks/useWeb3";
import { NETWORKS, CONTRACTS, ERC20_ABI, FERRY_ABI } from "@/lib/contracts";
import { ethers } from "ethers";
import { 
  computeMessageId, 
  saveBridge, 
  getPendingBridges, 
  markBridgeAsClaimed,
  type PendingBridge 
} from "@/lib/bridgeStorage";
import { WalletModal } from "@/components/WalletModal";
import { Navigation } from "@/components/Navigation";

export default function Bridge() {
  const { toast } = useToast();
  const { account, chainId, connect, disconnect, isConnecting, switchNetwork, signer, provider } = useWeb3();
  
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"eth-neox" | "neox-eth">("eth-neox");
  const [isBridging, setIsBridging] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [balance, setBalance] = useState<string>("0.0");
  const [allowance, setAllowance] = useState<string>("0.0");
  const [nativeFee, setNativeFee] = useState<string>("0");
  const [pendingBridges, setPendingBridges] = useState<PendingBridge[]>([]);
  const [isClaiming, setIsClaiming] = useState<string | null>(null);
  const [showWalletModal, setShowWalletModal] = useState(false);

  // Determine current network context based on direction
  const sourceNetwork: NetworkType = direction === "eth-neox" ? "ETH" : "NEOX";
  const destNetwork: NetworkType = direction === "eth-neox" ? "NEOX" : "ETH";
  
  const sourceChainId = NETWORKS[sourceNetwork].chainId;
  const isWrongNetwork = chainId !== sourceChainId;

  const pforkAddress = CONTRACTS[sourceNetwork].PFORK;
  const ferryAddress = CONTRACTS[sourceNetwork].FERRY;

  // Create cached providers to prevent connection leaks
  const ethProvider = useMemo(() => new ethers.JsonRpcProvider(NETWORKS.ETH.rpc), []);
  const neoxProvider = useMemo(() => new ethers.JsonRpcProvider(NETWORKS.NEOX.rpc), []);

  // Fetch balance, allowance, and native fee
  useEffect(() => {
    const fetchdata = async () => {
      if (!account || !provider || isWrongNetwork) {
        setBalance("0.0");
        setAllowance("0.0");
        setNativeFee("0");
        return;
      }

      try {
        const tokenContract = new ethers.Contract(pforkAddress, ERC20_ABI, provider);
        const ferryContract = new ethers.Contract(ferryAddress, FERRY_ABI, provider);
        
        // Fetch balance
        const bal = await tokenContract.balanceOf(account);
        setBalance(ethers.formatUnits(bal, 18));

        // Fetch allowance
        const allow = await tokenContract.allowance(account, ferryAddress);
        setAllowance(ethers.formatUnits(allow, 18));

        // Fetch native fee
        const fee = await ferryContract.nativeFeeWei();
        setNativeFee(fee.toString());
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchdata();
    const interval = setInterval(fetchdata, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [account, provider, chainId, isWrongNetwork, pforkAddress, ferryAddress]);

  // Load pending bridges on mount and when account changes
  useEffect(() => {
    if (!account) {
      setPendingBridges([]);
      return;
    }
    
    const bridges = getPendingBridges().filter(
      (b) => b.from.toLowerCase() === account.toLowerCase()
    );
    setPendingBridges(bridges);
  }, [account]);

  // Status check: Periodically check if pending bridges have been claimed
  useEffect(() => {
    if (pendingBridges.length === 0) return;

    const checkStatus = async () => {
      for (const bridge of pendingBridges) {
        try {
          const destProvider = bridge.destChain === "ETH" ? ethProvider : neoxProvider;
          const destFerry = new ethers.Contract(
            CONTRACTS[bridge.destChain].FERRY,
            FERRY_ABI,
            destProvider
          );

          const isProcessed = await destFerry.processedMessages(bridge.messageId);
          
          if (isProcessed && bridge.status === "pending") {
            markBridgeAsClaimed(bridge.messageId, "auto-detected");
            // Refresh pending bridges list
            const updatedBridges = getPendingBridges().filter(
              (b) => b.from.toLowerCase() === account?.toLowerCase()
            );
            setPendingBridges(updatedBridges);
          }
        } catch (error) {
          console.error("Error checking bridge status:", error);
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [pendingBridges, account, ethProvider, neoxProvider]);


  const handleApprove = async () => {
    if (!signer) return;
    
    try {
      setIsApproving(true);
      const tokenContract = new ethers.Contract(pforkAddress, ERC20_ABI, signer);
      // Approve max uint256 for simplicity or specific amount
      const tx = await tokenContract.approve(ferryAddress, ethers.MaxUint256);
      await tx.wait();
      
      toast({
        title: "Approved!",
        description: "You can now bridge your tokens.",
      });
      
      // Refresh allowance immediately
      const allow = await tokenContract.allowance(account, ferryAddress);
      setAllowance(ethers.formatUnits(allow, 18));
      
    } catch (error: any) {
      console.error("Approval error:", error);
      toast({
        title: "Approval Failed",
        description: error.message || "Transaction rejected.",
        variant: "destructive",
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({ title: "Invalid Amount", description: "Enter a valid amount.", variant: "destructive" });
      return;
    }

    if (isWrongNetwork) {
      switchNetwork(sourceNetwork);
      return;
    }

    if (!signer || !account) {
      handleConnectClick();
      return;
    }

    try {
      setIsBridging(true);
      
      const ferryContract = new ethers.Contract(ferryAddress, FERRY_ABI, signer);
      const amountWei = ethers.parseUnits(amount, 18);

      // Call bridgeOut(amount, toOnOtherChain) with native fee
      const tx = await ferryContract.bridgeOut(amountWei, account, {
        value: nativeFee
      });
      
      console.log("Bridge tx submitted:", tx.hash);
      setTxHash(tx.hash);
      
      // Wait for receipt
      const receipt = await tx.wait();
      
      // Parse BridgeOutRequested event
      const event = receipt.logs
        .map((log: any) => {
          try {
            return ferryContract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((parsed: any) => parsed?.name === "BridgeOutRequested");

      if (event) {
        const { from, toOnOtherChain, amountIn, amountOut, nonce } = event.args;
        
        // Compute messageId
        const srcChainId = NETWORKS[sourceNetwork].chainId;
        const dstChainId = NETWORKS[destNetwork].chainId;
        const messageId = computeMessageId(
          srcChainId,
          dstChainId,
          ferryAddress,
          nonce.toString(),
          from,
          toOnOtherChain,
          amountIn.toString(),
          amountOut.toString(),
          nativeFee
        );

        // Save to localStorage
        const bridge: PendingBridge = {
          messageId,
          from,
          toOnOtherChain,
          amountOut: amountOut.toString(),
          sourceChain: sourceNetwork,
          destChain: destNetwork,
          sourceTxHash: tx.hash,
          nonce: nonce.toString(),
          timestamp: Date.now(),
          status: "pending",
        };
        
        saveBridge(bridge);
        
        // Refresh pending bridges list
        const updatedBridges = getPendingBridges().filter(
          (b) => b.from.toLowerCase() === account.toLowerCase()
        );
        setPendingBridges(updatedBridges);
      }
      
      setShowSuccess(true);
      setAmount("");
      
      // Refresh balance
      const tokenContract = new ethers.Contract(pforkAddress, ERC20_ABI, provider);
      const bal = await tokenContract.balanceOf(account);
      setBalance(ethers.formatUnits(bal, 18));

    } catch (error: any) {
      console.error("Bridge error:", error);
      toast({
        title: "Bridge Failed",
        description: error.message || "Transaction rejected.",
        variant: "destructive",
      });
    } finally {
      setIsBridging(false);
    }
  };

  const handleWalletSelect = async (type: WalletType) => {
    await connect(type);
    setShowWalletModal(false);
  };

  const handleConnectClick = () => {
    setShowWalletModal(true);
  };

  const handleClaim = async (bridge: PendingBridge) => {
    if (!signer || !account) {
      handleConnectClick();
      return;
    }

    const correctChainId = NETWORKS[bridge.destChain].chainId;
    
    // Check if on correct destination network
    if (chainId !== correctChainId) {
      switchNetwork(bridge.destChain);
      toast({
        title: "Network Switch Required",
        description: `Switching to ${NETWORKS[bridge.destChain].name}. After switching, click the claim button again to complete the claim.`,
        duration: 5000,
      });
      return;
    }

    try {
      setIsClaiming(bridge.messageId);
      
      const destFerryAddress = CONTRACTS[bridge.destChain].FERRY;
      const destFerryContract = new ethers.Contract(destFerryAddress, FERRY_ABI, signer);
      
      // Get nativeFeeWei from destination ferry
      const destNativeFee = await destFerryContract.nativeFeeWei();
      
      // Call fulfillBridgeIn
      const tx = await destFerryContract.fulfillBridgeIn(
        bridge.toOnOtherChain,
        bridge.amountOut,
        bridge.messageId,
        { value: destNativeFee }
      );
      
      console.log("Claim tx submitted:", tx.hash);
      
      // Wait for receipt
      await tx.wait();
      
      // Update bridge status
      markBridgeAsClaimed(bridge.messageId, tx.hash);
      
      // Refresh pending bridges list
      const updatedBridges = getPendingBridges().filter(
        (b) => b.from.toLowerCase() === account.toLowerCase()
      );
      setPendingBridges(updatedBridges);
      
      toast({
        title: "Claim Successful!",
        description: `${ethers.formatUnits(bridge.amountOut, 18)} PFORK claimed on ${NETWORKS[bridge.destChain].name}`,
      });
      
    } catch (error: any) {
      console.error("Claim error:", error);
      toast({
        title: "Claim Failed",
        description: error.message || "Transaction rejected.",
        variant: "destructive",
      });
    } finally {
      setIsClaiming(null);
    }
  };

  const toggleDirection = () => {
    setDirection(prev => prev === "eth-neox" ? "neox-eth" : "eth-neox");
  };

  const needsApproval = parseFloat(allowance) < (parseFloat(amount) || 0);

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col">
      {/* Navigation */}
      <Navigation />
      
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header - Wallet & Ecosystem Links */}
      <header className="relative z-10 w-full px-4 sm:px-6 pt-20 sm:pt-24 pb-4 sm:pb-6 flex justify-end items-center border-b border-white/5 backdrop-blur-sm gap-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-wrap">
          <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-500 uppercase tracking-wider font-space border-r border-white/10 pr-4">
            <span className="text-gray-400">Pitchforks:</span>
            <a 
              href="https://dex.pitchforks.social" 
              target="_blank" 
              rel="noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors"
              data-testid="link-dex"
            >
              DEX
            </a>
            <span className="text-gray-600">|</span>
            <a 
              href="https://protocol.pitchforks.social" 
              target="_blank" 
              rel="noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors"
              data-testid="link-protocol"
            >
              Protocol
            </a>
            <span className="text-gray-600">|</span>
            <a 
              href="https://analyst.pitchforks.social" 
              target="_blank" 
              rel="noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors"
              data-testid="link-analyst"
            >
              Analyst
            </a>
            <span className="text-gray-600">|</span>
            <a 
              href="https://app.pitchforks.social" 
              target="_blank" 
              rel="noreferrer"
              className="text-primary hover:text-primary/80 hover:underline transition-colors"
              data-testid="link-app"
            >
              App
            </a>
          </div>
          
          {account && (
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-destructive hover:bg-destructive/10 transition-colors min-h-[44px] min-w-[44px]"
              onClick={disconnect}
              title="Disconnect Wallet"
              data-testid="button-disconnect"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          )}
          <Button 
            variant={account ? "outline" : "default"}
            className={`font-space tracking-wide text-sm sm:text-base min-h-[44px] px-3 sm:px-4 ${account ? "border-primary/50 text-primary hover:bg-primary/10" : "bg-primary text-background hover:bg-primary/90"}`}
            onClick={() => account ? null : handleConnectClick()}
            disabled={isConnecting}
            data-testid="button-connect-wallet"
          >
            <Wallet className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">
              {isConnecting ? "Connecting..." : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
            </span>
            <span className="inline sm:hidden">
              {isConnecting ? "..." : account ? `${account.slice(0, 4)}...${account.slice(-2)}` : "Connect"}
            </span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center p-4 md:p-8">
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <div className="glass-panel rounded-2xl p-4 sm:p-6 md:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Decorative border glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-lg sm:text-xl font-cinzel text-gray-300">Bridge Assets</h2>
              <div className="flex items-center gap-2 text-[10px] sm:text-xs font-space text-gray-500 uppercase tracking-widest">
                <div className={`w-2 h-2 rounded-full ${isWrongNetwork ? "bg-red-500" : "bg-green-500"} animate-pulse`} />
                <span className="hidden sm:inline">{isWrongNetwork ? "Wrong Network" : "System Online"}</span>
                <span className="inline sm:hidden">{isWrongNetwork ? "Wrong" : "OK"}</span>
              </div>
            </div>

            {/* Route Selector */}
            <div className="relative flex flex-col gap-4 mb-6 sm:mb-8">
              {/* From */}
              <div className={`p-3 sm:p-4 rounded-xl border transition-colors ${direction === "eth-neox" ? "bg-blue-950/30 border-blue-500/30" : "bg-green-950/30 border-green-500/30"}`}>
                <div className="flex justify-between mb-2 flex-wrap gap-1">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-space uppercase">From Network</span>
                  <span className="text-[10px] sm:text-xs text-gray-400 font-space">Balance: {parseFloat(balance).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ${direction === "eth-neox" ? "bg-blue-600" : "bg-green-600"}`}>
                    {direction === "eth-neox" ? "E" : "N"}
                  </div>
                  <span className="text-base sm:text-lg font-bold font-space">
                    {direction === "eth-neox" ? "Ethereum" : "Neo X"}
                  </span>
                </div>
                <div className="mt-2 text-[9px] sm:text-[10px] text-gray-500 font-mono truncate">
                  Contract: {pforkAddress}
                </div>
              </div>

              {/* Switcher */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="rounded-full bg-background border-white/10 hover:bg-white/5 hover:border-primary/50 transition-all h-10 w-10 sm:h-12 sm:w-12 min-h-[44px] min-w-[44px]"
                  onClick={toggleDirection}
                  data-testid="button-toggle-direction"
                >
                  <ArrowRightLeft className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                </Button>
              </div>

              {/* To */}
              <div className={`p-3 sm:p-4 rounded-xl border transition-colors ${direction === "eth-neox" ? "bg-green-950/30 border-green-500/30" : "bg-blue-950/30 border-blue-500/30"}`}>
                <div className="flex justify-between mb-2">
                  <span className="text-[10px] sm:text-xs text-gray-400 font-space uppercase">To Network</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs ${direction === "eth-neox" ? "bg-green-600" : "bg-blue-600"}`}>
                    {direction === "eth-neox" ? "N" : "E"}
                  </div>
                  <span className="text-base sm:text-lg font-bold font-space">
                    {direction === "eth-neox" ? "Neo X" : "Ethereum"}
                  </span>
                </div>
                <div className="mt-2 text-[9px] sm:text-[10px] text-gray-500 font-mono truncate">
                   Contract: {CONTRACTS[destNetwork].PFORK}
                </div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-6 sm:mb-8">
              <div className="flex justify-between mb-2">
                <label className="text-[10px] sm:text-xs text-gray-400 font-space uppercase">Amount to Send</label>
                {account && (
                  <button 
                    className="text-[10px] sm:text-xs text-primary hover:text-primary/80 font-space uppercase min-h-[44px] -my-3 px-2"
                    onClick={() => setAmount(balance)}
                    data-testid="button-max-amount"
                  >
                    Max
                  </button>
                )}
              </div>
              <div className="relative">
                <Input 
                  type="number" 
                  placeholder="0.00" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-14 sm:h-16 pl-4 pr-20 sm:pr-24 text-xl sm:text-2xl font-space bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20" 
                  data-testid="input-amount"
                />
                <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <span className="font-bold text-xs sm:text-sm text-gray-400">PFORK</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            {isWrongNetwork ? (
              <Button 
                size="lg" 
                className="w-full h-14 bg-destructive text-white font-bold font-cinzel text-lg hover:bg-destructive/90"
                onClick={() => switchNetwork(sourceNetwork)}
              >
                Switch to {NETWORKS[sourceNetwork].name}
              </Button>
            ) : needsApproval ? (
                <div className="flex flex-col gap-2">
                   <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                        <span>Step 1 of 2: Approve Tokens</span>
                   </div>
                    <Button 
                        size="lg" 
                        className="w-full h-14 bg-secondary text-white font-bold font-cinzel text-lg hover:bg-secondary/90"
                        onClick={handleApprove}
                        disabled={isApproving || !amount}
                    >
                        {isApproving ? "Approving..." : "Approve PFORK"}
                    </Button>
                </div>
            ) : (
              <div className="flex flex-col gap-2">
                  {/* Only show step info if we had to approve previously, or just show generic action */}
                   <Button 
                    size="lg" 
                    className="w-full h-14 bg-primary text-background font-bold font-cinzel text-lg hover:bg-primary/90 hover:scale-[1.02] transition-all relative overflow-hidden"
                    onClick={handleBridge}
                    disabled={isBridging || !amount}
                >
                    {isBridging ? (
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                        Ferrying...
                    </div>
                    ) : (
                    <div className="flex items-center gap-2">
                        <Waves className="w-5 h-5" />
                        Pay the Ferryman
                    </div>
                    )}
                </Button>
              </div>
            )}

            {/* Fee Info */}
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] sm:text-xs text-gray-500 font-mono">
              <span>Fee: {parseFloat(ethers.formatEther(nativeFee || "0")).toFixed(4)} {NETWORKS[sourceNetwork].currency}</span>
              <span>Time: ~2 mins</span>
            </div>

          </div>

          {/* Helper Links */}
          <div className="mt-6 sm:mt-8 flex justify-center gap-4 sm:gap-6">
             <a 
                href={`${NETWORKS[sourceNetwork].explorer}/address/${ferryAddress}`}
                target="_blank" 
                rel="noreferrer"
                className="text-gray-500 hover:text-primary text-[10px] sm:text-xs font-space uppercase tracking-widest flex items-center gap-2 transition-colors min-h-[44px]"
                data-testid="link-contract"
              >
              <History className="w-4 h-4" /> <span>Contract</span>
            </a>
            <a 
                href="#" 
                className="text-gray-500 hover:text-primary text-[10px] sm:text-xs font-space uppercase tracking-widest flex items-center gap-2 transition-colors min-h-[44px]"
                data-testid="link-audit"
            >
              <ShieldCheck className="w-4 h-4" /> <span>Audit</span>
            </a>
          </div>
        </motion.div>

        {/* Pending Bridges Section */}
        {account && pendingBridges.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-full max-w-lg mt-6 sm:mt-8"
          >
            <div className="glass-panel rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h3 className="text-base sm:text-lg font-cinzel text-gray-300">Pending Claims</h3>
                <span className="ml-auto text-xs font-space text-gray-500 bg-primary/10 px-2 py-1 rounded">
                  {pendingBridges.length}
                </span>
              </div>

              <div className="space-y-3">
                {pendingBridges.map((bridge) => {
                  const isClaimingThis = isClaiming === bridge.messageId;
                  const isOnCorrectNetwork = chainId === NETWORKS[bridge.destChain].chainId;
                  
                  return (
                    <div 
                      key={bridge.messageId}
                      className="bg-black/20 rounded-lg p-3 sm:p-4 border border-white/5 hover:border-primary/20 transition-all"
                      data-testid={`pending-bridge-${bridge.messageId}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg font-bold text-white font-space">
                            {parseFloat(ethers.formatUnits(bridge.amountOut, 18)).toFixed(2)} PFORK
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ${bridge.sourceChain === "ETH" ? "bg-blue-600" : "bg-green-600"}`}>
                            {bridge.sourceChain === "ETH" ? "E" : "N"}
                          </div>
                          <ArrowRightLeft className="w-3 h-3" />
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold ${bridge.destChain === "ETH" ? "bg-blue-600" : "bg-green-600"}`}>
                            {bridge.destChain === "ETH" ? "E" : "N"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-[9px] sm:text-[10px] text-gray-500 mb-3">
                        <span className="font-mono">
                          {new Date(bridge.timestamp).toLocaleDateString()} {new Date(bridge.timestamp).toLocaleTimeString()}
                        </span>
                        <a
                          href={`${NETWORKS[bridge.sourceChain].explorer}/tx/${bridge.sourceTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline flex items-center gap-1 min-h-[44px] sm:min-h-0 -my-2 sm:my-0"
                        >
                          Tx <ExternalLink className="w-2 h-2" />
                        </a>
                      </div>

                      {!isOnCorrectNetwork && (
                        <div className="mb-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] sm:text-[10px] text-amber-400 font-space text-center">
                          Switch to {NETWORKS[bridge.destChain].name} to claim
                        </div>
                      )}

                      <Button
                        size="sm"
                        className="w-full bg-primary text-background font-bold font-space hover:bg-primary/90 min-h-[44px] text-sm sm:text-base"
                        onClick={() => handleClaim(bridge)}
                        disabled={isClaimingThis}
                        data-testid={`button-claim-${bridge.messageId}`}
                      >
                        {isClaimingThis ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Claiming...
                          </div>
                        ) : (
                          <span className="hidden sm:inline">Claim on {NETWORKS[bridge.destChain].name}</span>
                        )}
                        {!isClaimingThis && (
                          <span className="inline sm:hidden">Claim</span>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="glass-panel border-primary/20 text-white sm:max-w-md max-w-[90vw]">
          <DialogHeader>
            <DialogTitle className="text-center font-cinzel text-xl sm:text-2xl text-primary">Bridge Initiated!</DialogTitle>
            <DialogDescription className="sr-only">Bridge transaction has been successfully initiated</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-4 sm:py-6 space-y-3 sm:space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/20 flex items-center justify-center mb-2 sm:mb-4">
              <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
            </div>
            <p className="text-center text-sm sm:text-base text-gray-300 font-space px-2">
              Your tokens have been locked on <span className="text-white font-bold">{NETWORKS[sourceNetwork].name}</span>.
            </p>
            <div className="w-full bg-black/30 p-3 sm:p-4 rounded-lg mt-2 sm:mt-4">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0 text-[10px] sm:text-xs text-gray-500 mb-2 font-mono">
                <span>Bridge Out Tx</span>
                <a 
                  href={`${NETWORKS[sourceNetwork].explorer}/tx/${txHash}`} 
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline flex items-center gap-1 min-h-[44px] sm:min-h-0 -my-2 sm:my-0"
                  data-testid="link-bridge-tx"
                >
                  {txHash.slice(0, 6)}...{txHash.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 font-mono">
                <span>Next Step</span>
                <span className="text-green-400">Claim on {NETWORKS[destNetwork].name}</span>
              </div>
            </div>
            <div className="text-[10px] sm:text-xs text-gray-500 text-center mt-2 px-2 sm:px-4">
              Your bridge request has been saved. Scroll down to the "Pending Claims" section to claim your tokens on {NETWORKS[destNetwork].name}.
            </div>
            <Button 
              className="w-full mt-4 sm:mt-6 bg-primary hover:bg-primary/90 text-background font-space font-bold min-h-[44px]"
              onClick={() => setShowSuccess(false)}
              data-testid="button-close-success"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WalletModal
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
        onSelectWallet={handleWalletSelect}
        isConnecting={isConnecting}
      />
    </div>
  );
}
