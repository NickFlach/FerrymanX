import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRightLeft, Wallet, ShieldCheck, History, X, Ship, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const PFORK_ETH = "0x536d...28FE";
const PFORK_NEOX = "0x2164...60F";

export default function Bridge() {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"eth-neox" | "neox-eth">("eth-neox");
  const [isBridging, setIsBridging] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const handleBridge = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount of PFORK to bridge.",
        variant: "destructive",
      });
      return;
    }

    if (!isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return;
    }

    setIsBridging(true);
    
    // Simulate bridging delay
    setTimeout(() => {
      setIsBridging(false);
      setShowSuccess(true);
      setAmount("");
    }, 3000);
  };

  const toggleDirection = () => {
    setDirection(prev => prev === "eth-neox" ? "neox-eth" : "eth-neox");
  };

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
        
        <Button 
          variant={isConnected ? "outline" : "default"}
          className={`font-space tracking-wide ${isConnected ? "border-primary/50 text-primary hover:bg-primary/10" : "bg-primary text-background hover:bg-primary/90"}`}
          onClick={() => setIsConnected(!isConnected)}
        >
          <Wallet className="w-4 h-4 mr-2" />
          {isConnected ? "0x1234...5678" : "Connect Wallet"}
        </Button>
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
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                System Online
              </div>
            </div>

            {/* Route Selector */}
            <div className="relative flex flex-col gap-4 mb-8">
              {/* From */}
              <div className={`p-4 rounded-xl border transition-colors ${direction === "eth-neox" ? "bg-blue-950/30 border-blue-500/30" : "bg-green-950/30 border-green-500/30"}`}>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-gray-400 font-space uppercase">From Network</span>
                  <span className="text-xs text-gray-400 font-space">Balance: {isConnected ? "1,500.00" : "-"}</span>
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
                  Contract: {direction === "eth-neox" ? PFORK_ETH : PFORK_NEOX}
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
                  Contract: {direction === "eth-neox" ? PFORK_NEOX : PFORK_ETH}
                </div>
              </div>
            </div>

            {/* Amount Input */}
            <div className="mb-8">
              <div className="flex justify-between mb-2">
                <label className="text-xs text-gray-400 font-space uppercase">Amount to Send</label>
                {isConnected && (
                  <button 
                    className="text-xs text-primary hover:text-primary/80 font-space uppercase"
                    onClick={() => setAmount("1500")}
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
            <Button 
              size="lg" 
              className="w-full h-14 bg-primary text-background font-bold font-cinzel text-lg hover:bg-primary/90 hover:scale-[1.02] transition-all relative overflow-hidden"
              onClick={handleBridge}
              disabled={isBridging}
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

            {/* Fee Info */}
            <div className="mt-6 flex justify-between items-center text-xs text-gray-500 font-mono">
              <span>Relayer Fee: ~0.001 ETH</span>
              <span>Est. Time: 2 mins</span>
            </div>

          </div>

          {/* Helper Links */}
          <div className="mt-8 flex justify-center gap-6">
            <a href="#" className="text-gray-500 hover:text-primary text-xs font-space uppercase tracking-widest flex items-center gap-2 transition-colors">
              <History className="w-4 h-4" /> History
            </a>
            <a href="#" className="text-gray-500 hover:text-primary text-xs font-space uppercase tracking-widest flex items-center gap-2 transition-colors">
              <ShieldCheck className="w-4 h-4" /> Audit
            </a>
          </div>
        </motion.div>
      </main>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="glass-panel border-primary/20 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center font-cinzel text-2xl text-primary">Safe Passage!</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4">
              <Ship className="w-10 h-10 text-primary animate-pulse" />
            </div>
            <p className="text-center text-gray-300 font-space">
              Your <span className="text-white font-bold">{amount} PFORK</span> are crossing the river.
            </p>
            <div className="w-full bg-black/30 p-4 rounded-lg mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2 font-mono">
                <span>Status</span>
                <span className="text-green-400">Processing</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 font-mono">
                <span>Message ID</span>
                <span className="truncate w-32 text-right">0x8f...3a1</span>
              </div>
            </div>
            <Button 
              className="w-full mt-6 bg-white/10 hover:bg-white/20 text-white font-space"
              onClick={() => setShowSuccess(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
