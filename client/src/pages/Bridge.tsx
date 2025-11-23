import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, Wallet, ShieldCheck, History, X, Ship, Waves, ExternalLink, CheckCircle2, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWeb3, NetworkType } from "@/hooks/useWeb3";
import { NETWORKS, CONTRACTS, ERC20_ABI, FERRY_ABI } from "@/lib/contracts";
import { ethers } from "ethers";

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
  
  // Live Tracking State
  const [trackerState, setTrackerState] = useState<"idle" | "processing" | "bridged" | "relaying" | "complete">("idle");
  const [destinationTxHash, setDestinationTxHash] = useState("");

  // Determine current network context based on direction
  const sourceNetwork: NetworkType = direction === "eth-neox" ? "ETH" : "NEOX";
  const destNetwork: NetworkType = direction === "eth-neox" ? "NEOX" : "ETH";
  
  const sourceChainId = NETWORKS[sourceNetwork].chainId;
  const isWrongNetwork = chainId !== sourceChainId;

  const pforkAddress = CONTRACTS[sourceNetwork].PFORK;
  const ferryAddress = CONTRACTS[sourceNetwork].FERRY;

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

  // Tracker Logic: Listen for Destination Events
  useEffect(() => {
    if (trackerState !== "bridged" && trackerState !== "relaying") return;

    const pollDestination = async () => {
      try {
        const destProvider = new ethers.JsonRpcProvider(NETWORKS[destNetwork].rpc);
        const destFerryAddress = CONTRACTS[destNetwork].FERRY;
        const destFerry = new ethers.Contract(destFerryAddress, [
          "event BridgeInFulfilled(address indexed to, uint256 amount, bytes32 indexed messageId)"
        ], destProvider);

        const currentBlock = await destProvider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 1000);
        
        const logs = await destFerry.queryFilter("BridgeInFulfilled", fromBlock, currentBlock);
        
        const myLogs = logs.filter((log) => {
          if ("args" in log && log.args) {
            return log.args[0].toLowerCase() === account?.toLowerCase();
          }
          return false;
        });
        
        if (myLogs.length > 0) {
          const lastLog = myLogs[myLogs.length - 1];
          console.log("Bridge In Detected!", lastLog.transactionHash);
          setDestinationTxHash(lastLog.transactionHash);
          setTrackerState("complete");
        }
      } catch (error) {
        console.error("Error polling destination:", error);
      }
    };

    const interval = setInterval(pollDestination, 10000);
    pollDestination();
    return () => clearInterval(interval);
  }, [trackerState, destNetwork, account]);


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

    if (!signer) {
      connect();
      return;
    }

    try {
      setIsBridging(true);
      setTrackerState("processing");
      
      const ferryContract = new ethers.Contract(ferryAddress, FERRY_ABI, signer);
      const amountWei = ethers.parseUnits(amount, 18);

      // Call bridgeOut(amount, toOnOtherChain) with native fee
      const tx = await ferryContract.bridgeOut(amountWei, account, {
        value: nativeFee
      });
      
      console.log("Bridge tx submitted:", tx.hash);
      setTxHash(tx.hash);
      
      await tx.wait();
      
      setTrackerState("bridged"); // Source tx confirmed
      setShowSuccess(true); // Show modal
      setAmount("");
      
      // Refresh balance
      const tokenContract = new ethers.Contract(pforkAddress, ERC20_ABI, provider);
      const bal = await tokenContract.balanceOf(account);
      setBalance(ethers.formatUnits(bal, 18));

      // Simulate "Relaying" state after a few seconds if real event doesn't fire immediately
      setTimeout(() => {
          if (trackerState === "bridged") setTrackerState("relaying");
      }, 5000);

    } catch (error: any) {
      console.error("Bridge error:", error);
      setTrackerState("idle");
      toast({
        title: "Bridge Failed",
        description: error.message || "Transaction rejected.",
        variant: "destructive",
      });
    } finally {
      setIsBridging(false);
    }
  };

  const toggleDirection = () => {
    setDirection(prev => prev === "eth-neox" ? "neox-eth" : "eth-neox");
  };

  const needsApproval = parseFloat(allowance) < (parseFloat(amount) || 0);

  // Render Tracker Step
  const Step = ({ status, label, stepNum }: { status: "pending" | "active" | "complete", label: string, stepNum: number }) => (
    <div className={`flex flex-col items-center gap-2 ${status === "pending" ? "opacity-50" : "opacity-100"}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500 
        ${status === "complete" ? "bg-primary border-primary text-background" : 
          status === "active" ? "bg-primary/20 border-primary text-primary animate-pulse" : 
          "bg-transparent border-gray-600 text-gray-600"}`}>
        {status === "complete" ? <CheckCircle2 className="w-5 h-5" /> : status === "active" ? <Loader2 className="w-4 h-4 animate-spin" /> : stepNum}
      </div>
      <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-background relative overflow-hidden flex flex-col">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-green-500/10 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full px-6 py-6 flex justify-between items-center border-b border-white/5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Ship className="w-8 h-8 text-primary" />
          <h1 className="text-2xl font-cinzel font-bold text-white tracking-wider">
            FERRYMAN<span className="text-primary">X</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
            {account && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400 hover:text-destructive hover:bg-destructive/10 transition-colors"
                    onClick={disconnect}
                    title="Disconnect Wallet"
                >
                    <LogOut className="w-5 h-5" />
                </Button>
            )}
            <Button 
            variant={account ? "outline" : "default"}
            className={`font-space tracking-wide ${account ? "border-primary/50 text-primary hover:bg-primary/10" : "bg-primary text-background hover:bg-primary/90"}`}
            onClick={() => account ? null : connect()}
            disabled={isConnecting}
            >
            <Wallet className="w-4 h-4 mr-2" />
            {isConnecting ? "Connecting..." : account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Connect Wallet"}
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
          <div className="glass-panel rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Decorative border glow */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-cinzel text-gray-300">Bridge Assets</h2>
              <div className="flex items-center gap-2 text-xs font-space text-gray-500 uppercase tracking-widest">
                <div className={`w-2 h-2 rounded-full ${isWrongNetwork ? "bg-red-500" : "bg-green-500"} animate-pulse`} />
                {isWrongNetwork ? "Wrong Network" : "System Online"}
              </div>
            </div>

            {/* Live Tracker (Visible when active) */}
            <AnimatePresence>
                {trackerState !== "idle" && (
                    <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-8 bg-black/20 rounded-lg p-4 border border-white/5"
                    >
                        <div className="flex justify-between items-center px-4">
                            <Step 
                                stepNum={1} 
                                label="Bridge Out" 
                                status={trackerState === "processing" ? "active" : "complete"} 
                            />
                            <div className={`flex-1 h-[1px] mx-2 ${trackerState === "processing" ? "bg-gray-700" : "bg-primary"}`} />
                            <Step 
                                stepNum={2} 
                                label="Relayer" 
                                status={trackerState === "processing" ? "pending" : trackerState === "bridged" || trackerState === "relaying" ? "active" : "complete"} 
                            />
                             <div className={`flex-1 h-[1px] mx-2 ${trackerState === "complete" ? "bg-primary" : "bg-gray-700"}`} />
                            <Step 
                                stepNum={3} 
                                label="Bridge In" 
                                status={trackerState === "complete" ? "complete" : "pending"} 
                            />
                        </div>
                        <div className="text-center mt-4 text-[10px] text-gray-400 font-mono">
                            {trackerState === "processing" && "Signing transaction on Source Chain..."}
                            {(trackerState === "bridged" || trackerState === "relaying") && "Waiting for Relayer to pickup (requires external node)..."}
                            {trackerState === "complete" && "Bridge Complete! Tokens arrived."}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* Route Selector */}
            <div className="relative flex flex-col gap-4 mb-8">
              {/* From */}
              <div className={`p-4 rounded-xl border transition-colors ${direction === "eth-neox" ? "bg-blue-950/30 border-blue-500/30" : "bg-green-950/30 border-green-500/30"}`}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-gray-400 font-space uppercase">From Network</span>
                  <span className="text-xs text-gray-400 font-space">Balance: {balance}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${direction === "eth-neox" ? "bg-blue-600" : "bg-green-600"}`}>
                    {direction === "eth-neox" ? "E" : "N"}
                  </div>
                  <span className="text-lg font-bold font-space">
                    {direction === "eth-neox" ? "Ethereum" : "Neo X"}
                  </span>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 font-mono truncate">
                  Contract: {pforkAddress}
                </div>
              </div>

              {/* Switcher */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="rounded-full bg-background border-white/10 hover:bg-white/5 hover:border-primary/50 transition-all h-10 w-10"
                  onClick={toggleDirection}
                >
                  <ArrowRightLeft className="w-4 h-4 text-primary" />
                </Button>
              </div>

              {/* To */}
              <div className={`p-4 rounded-xl border transition-colors ${direction === "eth-neox" ? "bg-green-950/30 border-green-500/30" : "bg-blue-950/30 border-blue-500/30"}`}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-gray-400 font-space uppercase">To Network</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${direction === "eth-neox" ? "bg-green-600" : "bg-blue-600"}`}>
                    {direction === "eth-neox" ? "N" : "E"}
                  </div>
                  <span className="text-lg font-bold font-space">
                    {direction === "eth-neox" ? "Neo X" : "Ethereum"}
                  </span>
                </div>
                <div className="mt-2 text-[10px] text-gray-500 font-mono truncate">
                   Contract: {CONTRACTS[destNetwork].PFORK}
                </div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                <label className="text-xs text-gray-400 font-space uppercase">Amount to Send</label>
                {account && (
                  <button 
                    className="text-xs text-primary hover:text-primary/80 font-space uppercase"
                    onClick={() => setAmount(balance)}
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
                  className="h-16 pl-4 pr-24 text-2xl font-space bg-white/5 border-white/10 focus:border-primary/50 focus:ring-primary/20" 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none">
                  <span className="font-bold text-sm text-gray-400">PFORK</span>
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
            <div className="mt-6 flex justify-between items-center text-xs text-gray-500 font-mono">
              <span>Native Fee: {ethers.formatEther(nativeFee || "0")} {NETWORKS[sourceNetwork].currency}</span>
              <span>Est. Time: ~2 mins</span>
            </div>

          </div>

          {/* Helper Links */}
          <div className="mt-8 flex justify-center gap-6">
             <a 
                href={`${NETWORKS[sourceNetwork].explorer}/address/${ferryAddress}`}
                target="_blank" 
                rel="noreferrer"
                className="text-gray-500 hover:text-primary text-xs font-space uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
              <History className="w-4 h-4" /> Contract
            </a>
            <a 
                href="#" 
                className="text-gray-500 hover:text-primary text-xs font-space uppercase tracking-widest flex items-center gap-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" /> Audit
            </a>
          </div>
        </motion.div>
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="glass-panel border-primary/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-cinzel text-2xl text-primary">Passage Booked!</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Ship className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <p className="text-center text-gray-300 font-space">
              Your <span className="text-white font-bold">{amount} PFORK</span> have boarded the ferry.
            </p>
            <div className="w-full bg-black/30 p-4 rounded-lg mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2 font-mono">
                <span>Status</span>
                <span className="text-green-400">Waiting for Relayer...</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 font-mono mb-2">
                <span>Bridge Out Tx</span>
                <a 
                  href={`${NETWORKS[sourceNetwork].explorer}/tx/${txHash}`} 
                  target="_blank"
                  rel="noreferrer"
                  className="truncate w-32 text-right text-primary hover:underline flex items-center gap-1 ml-auto"
                >
                  {txHash.slice(0, 6)}...{txHash.slice(-4)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
               {destinationTxHash && (
                   <div className="flex justify-between text-xs text-gray-500 font-mono">
                    <span>Bridge In Tx</span>
                    <a 
                    href={`${NETWORKS[destNetwork].explorer}/tx/${destinationTxHash}`} 
                    target="_blank"
                    rel="noreferrer"
                    className="truncate w-32 text-right text-green-400 hover:underline flex items-center gap-1 ml-auto"
                    >
                    {destinationTxHash.slice(0, 6)}...{destinationTxHash.slice(-4)}
                    <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
               )}
            </div>
            <div className="text-xs text-gray-500 text-center mt-2">
                Please keep this window open to track progress, or check your wallet on the destination chain.
            </div>
            <Button 
              className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white font-space"
              onClick={() => setShowSuccess(false)}
            >
              Keep Tracking
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
