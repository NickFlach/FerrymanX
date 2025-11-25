import { useState, useEffect, useRef, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Atom, 
  TrendingUp, 
  Activity, 
  Zap, 
  Clock, 
  Network,
  BarChart3,
  Sparkles,
  Brain,
  Target,
  Loader2,
  CheckCircle,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ParticleSystem, 
  QuantumArtGenerator, 
  PredictiveAnalytics,
  hashToBridgeState,
  computeQuantumEntropy,
  type QuantumBridge 
} from "@/lib/quantumEngine";
import { getPendingBridges, getBridges } from "@/lib/bridgeStorage";
import { useWeb3 } from "@/hooks/useWeb3";
import { useToast } from "@/hooks/use-toast";
import { ethers } from "ethers";
import { NFT_CONTRACTS, QUANTUM_SIGNATURE_NFT_ABI, getOpenSeaUrl, getExplorerUrl } from "@/lib/nftContract";
import { Navigation } from "@/components/Navigation";

interface QuantumArtCardProps {
  bridge: QuantumBridge;
  index: number;
  onMint?: (bridge: QuantumBridge) => void;
  isMinting?: boolean;
  isMinted?: boolean;
  mintedTokenId?: string;
  chainId?: number;
  account?: string | null;
}

const QuantumArtCard = memo(({ 
  bridge, 
  index, 
  onMint, 
  isMinting = false, 
  isMinted = false,
  mintedTokenId,
  chainId,
  account
}: QuantumArtCardProps) => {
  const [artUrl, setArtUrl] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (!isClient || typeof window === 'undefined') return;
    
    const artGen = new QuantumArtGenerator(bridge.signature);
    const url = artGen.generateSignature(300, 300);
    setArtUrl(url);
  }, [bridge.signature, isClient]);
  
  const entropy = useMemo(() => computeQuantumEntropy(bridge.messageId), [bridge.messageId]);
  
  if (!isClient) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: index * 0.05 }}
      >
        <Card className="bg-black/60 border-white/10 backdrop-blur overflow-hidden">
          <div className="relative aspect-square overflow-hidden bg-gray-900 flex items-center justify-center">
            <Sparkles className="w-12 h-12 text-gray-700 animate-pulse" />
          </div>
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card 
        className="bg-black/60 border-white/10 backdrop-blur overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer group"
        data-testid={`card-art-${index}`}
      >
        <div className="relative aspect-square overflow-hidden">
          {artUrl ? (
            <img
              src={artUrl}
              alt={`Quantum signature ${bridge.messageId.slice(0, 8)}`}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
              <Sparkles className="w-12 h-12 text-gray-700 animate-pulse" />
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Badge 
              className={
                bridge.quantumState === "superposition" ? "bg-purple-500" :
                bridge.quantumState === "entangled" ? "bg-blue-500" :
                "bg-green-500"
              }
            >
              {bridge.quantumState}
            </Badge>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-gray-400">
              {bridge.sourceChain} → {bridge.destChain}
            </span>
            <span className="text-xs font-mono text-blue-400">
              {bridge.messageId.slice(0, 8)}...
            </span>
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold">
              {parseFloat(bridge.amount).toFixed(2)} PFORK
            </span>
            <span className="text-xs text-gray-500">
              Entropy: {entropy.toFixed(3)}
            </span>
          </div>
          
          {account && onMint && (
            <div className="mt-3 pt-3 border-t border-white/10">
              {isMinted && mintedTokenId && chainId ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    <span data-testid={`text-minted-${index}`}>Minted</span>
                  </div>
                  <a
                    href={getOpenSeaUrl(chainId, chainId === 1 ? NFT_CONTRACTS.ETH : NFT_CONTRACTS.NEOX, mintedTokenId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    data-testid={`link-opensea-${index}`}
                  >
                    View on OpenSea <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <Button
                  onClick={() => onMint(bridge)}
                  disabled={isMinting}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  data-testid={`button-mint-${index}`}
                >
                  {isMinting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Minting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Mint NFT
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

QuantumArtCard.displayName = 'QuantumArtCard';

const QuantumArtModal = memo(({ txHash, onClose }: { txHash: string; onClose: () => void }) => {
  const [artUrl, setArtUrl] = useState<string>('');
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const artGen = new QuantumArtGenerator(txHash);
    const url = artGen.generateSignature(800, 800);
    setArtUrl(url);
  }, [txHash]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-y-auto p-8"
      onClick={onClose}
      data-testid="modal-art-detail"
    >
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.8 }}
          className="max-w-4xl w-full my-8"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="bg-black border-purple-500/50">
            <CardContent className="p-8">
              {artUrl ? (
                <img
                  src={artUrl}
                  alt="Quantum signature detail"
                  className="w-full rounded-lg mb-4"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-900 rounded-lg mb-4 flex items-center justify-center">
                  <Sparkles className="w-16 h-16 text-gray-700 animate-pulse" />
                </div>
              )}
              <div className="text-center">
                <p className="text-sm text-gray-400 font-mono">
                  Transaction: {txHash}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
});

QuantumArtModal.displayName = 'QuantumArtModal';

export default function QuantumFerry() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particleSystemRef = useRef(new ParticleSystem());
  const analyticsRef = useRef(new PredictiveAnalytics());
  
  const { account, chainId, signer } = useWeb3();
  const { toast } = useToast();
  
  const [quantumBridges, setQuantumBridges] = useState<QuantumBridge[]>([]);
  const [selectedArt, setSelectedArt] = useState<string | null>(null);
  const [selectedArtUrl, setSelectedArtUrl] = useState<string>('');
  const [autoSpawn, setAutoSpawn] = useState(true);
  const [showNeural, setShowNeural] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const lastSpawnRef = useRef(0);
  
  const [mintingStatus, setMintingStatus] = useState<Record<string, boolean>>({});
  const [mintedBridges, setMintedBridges] = useState<Record<string, string>>({});
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const storedBridges = getBridges();
    const quantum: QuantumBridge[] = storedBridges.map(b => ({
      messageId: b.messageId,
      timestamp: b.timestamp,
      amount: b.amountOut,
      sourceChain: b.sourceChain,
      destChain: b.destChain,
      signature: b.sourceTxHash,
      quantumState: hashToBridgeState(b.sourceTxHash),
      artSeed: parseInt(b.sourceTxHash.slice(2, 10), 16)
    }));
    
    setQuantumBridges(quantum);
    quantum.forEach(qb => analyticsRef.current.addBridge(qb));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const storedBridges = getBridges();
      const quantum: QuantumBridge[] = storedBridges.map(b => ({
        messageId: b.messageId,
        timestamp: b.timestamp,
        amount: b.amountOut,
        sourceChain: b.sourceChain,
        destChain: b.destChain,
        signature: b.sourceTxHash,
        quantumState: hashToBridgeState(b.sourceTxHash),
        artSeed: parseInt(b.sourceTxHash.slice(2, 10), 16)
      }));
      
      if(quantum.length > quantumBridges.length) {
        const newBridges = quantum.slice(quantumBridges.length);
        newBridges.forEach(qb => analyticsRef.current.addBridge(qb));
      }
      
      setQuantumBridges(quantum);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [quantumBridges.length]);

  useEffect(() => {
    if (!signer || !chainId || quantumBridges.length === 0) return;

    const checkMintedStatus = async () => {
      try {
        const nftAddress = chainId === 1 ? NFT_CONTRACTS.ETH : NFT_CONTRACTS.NEOX;
        if (nftAddress === "0x0000000000000000000000000000000000000000") return;

        const contract = new ethers.Contract(nftAddress, QUANTUM_SIGNATURE_NFT_ABI, signer);
        
        const mintedStatus: Record<string, string> = {};
        
        for (const bridge of quantumBridges) {
          try {
            const isMinted = await contract.minted(bridge.messageId);
            if (isMinted) {
              const tokenId = await contract.messageIdToTokenId(bridge.messageId);
              mintedStatus[bridge.messageId] = tokenId.toString();
            }
          } catch (error) {
            console.error(`Error checking minted status for ${bridge.messageId}:`, error);
          }
        }
        
        setMintedBridges(mintedStatus);
      } catch (error) {
        console.error("Error checking minted status:", error);
      }
    };

    checkMintedStatus();
  }, [signer, chainId, quantumBridges]);

  const handleMint = async (bridge: QuantumBridge) => {
    if (!signer || !account || !chainId) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to mint NFTs.",
        variant: "destructive",
      });
      return;
    }

    const nftAddress = chainId === 1 ? NFT_CONTRACTS.ETH : NFT_CONTRACTS.NEOX;
    if (nftAddress === "0x0000000000000000000000000000000000000000") {
      toast({
        title: "NFT Contract not deployed",
        description: "The NFT contract has not been deployed on this chain yet.",
        variant: "destructive",
      });
      return;
    }

    setMintingStatus(prev => ({ ...prev, [bridge.messageId]: true }));

    try {
      const sourceChainId = bridge.sourceChain === "ETH" ? 1 : 47763;
      const destChainId = bridge.destChain === "ETH" ? 1 : 47763;

      const attestationResponse = await fetch("/api/nft/attestation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: bridge.messageId,
          bridger: account,
          amount: ethers.parseEther(bridge.amount).toString(),
          timestamp: bridge.timestamp,
          sourceChain: sourceChainId,
          destChain: destChainId,
          txHash: bridge.signature,
          contractAddress: nftAddress,
        }),
      });

      if (!attestationResponse.ok) {
        throw new Error("Failed to get attestation signature");
      }

      const { signature } = await attestationResponse.json();

      const contract = new ethers.Contract(nftAddress, QUANTUM_SIGNATURE_NFT_ABI, signer);

      const tx = await contract.mintSignature(
        bridge.messageId,
        account,
        ethers.parseEther(bridge.amount),
        bridge.timestamp,
        sourceChainId,
        destChainId,
        signature
      );

      toast({
        title: "Minting in progress",
        description: (
          <div className="flex flex-col gap-2">
            <span>Transaction submitted</span>
            <a
              href={getExplorerUrl(chainId, tx.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View on Explorer <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ),
      });

      const receipt = await tx.wait();

      const mintEvent = receipt.logs
        .map((log: any) => {
          try {
            return contract.interface.parseLog(log);
          } catch {
            return null;
          }
        })
        .find((event: any) => event?.name === "QuantumSignatureMinted");

      const tokenId = mintEvent?.args?.tokenId?.toString() || "0";

      setMintedBridges(prev => ({ ...prev, [bridge.messageId]: tokenId }));

      toast({
        title: "NFT Minted Successfully!",
        description: (
          <div className="flex flex-col gap-2">
            <span>Your Quantum Signature NFT has been minted</span>
            <a
              href={getOpenSeaUrl(chainId, nftAddress, tokenId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              View on OpenSea <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ),
      });
    } catch (error: any) {
      console.error("Minting error:", error);
      toast({
        title: "Minting failed",
        description: error.message || "Failed to mint NFT. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMintingStatus(prev => ({ ...prev, [bridge.messageId]: false }));
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const animate = (timestamp: number) => {
      if (!ctx || !canvas) return;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if(showNeural) {
        drawNeuralNetwork(ctx, canvas.width, canvas.height, timestamp);
      }

      if(autoSpawn && timestamp - lastSpawnRef.current > 2000) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const chain = Math.random() > 0.5 ? "ETH" : "NEOX";
        const entangled = Math.random() > 0.7;
        particleSystemRef.current.spawnParticles(x, y, 30, chain, entangled);
        lastSpawnRef.current = timestamp;
      }

      particleSystemRef.current.update(0.5);

      particleSystemRef.current.particles.forEach(p => {
        const alpha = p.life / p.maxLife;
        ctx.fillStyle = p.color.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if(p.entangled) {
          ctx.strokeStyle = p.color.replace('rgb', 'rgba').replace(')', `, ${alpha * 0.3})`);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      const pending = getPendingBridges();
      pending.forEach((bridge, idx) => {
        const progress = ((timestamp / 100) % 360);
        const x = canvas.width * 0.2 + (idx * 100 % (canvas.width * 0.6));
        const y = canvas.height * 0.5 + Math.sin(progress / 60) * 20;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(progress / 180 * Math.PI);
        
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
        gradient.addColorStop(0, bridge.sourceChain === "ETH" ? 'rgba(138, 180, 248, 0.8)' : 'rgba(142, 251, 142, 0.8)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [autoSpawn, showNeural]);

  const drawNeuralNetwork = (ctx: CanvasRenderingContext2D, width: number, height: number, timestamp: number) => {
    const nodes = 20;
    const positions: Array<{x: number, y: number}> = [];
    
    for(let i = 0; i < nodes; i++) {
      const angle = (Math.PI * 2 * i) / nodes;
      const radius = Math.min(width, height) * 0.3;
      const x = width / 2 + Math.cos(angle + timestamp / 2000) * radius;
      const y = height / 2 + Math.sin(angle + timestamp / 2000) * radius;
      positions.push({ x, y });
    }

    ctx.strokeStyle = 'rgba(100, 100, 255, 0.1)';
    ctx.lineWidth = 0.5;
    
    for(let i = 0; i < positions.length; i++) {
      for(let j = i + 1; j < positions.length; j++) {
        const dist = Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y);
        if(dist < 200) {
          const alpha = 1 - dist / 200;
          ctx.strokeStyle = `rgba(100, 100, 255, ${alpha * 0.2})`;
          ctx.beginPath();
          ctx.moveTo(positions[i].x, positions[i].y);
          ctx.lineTo(positions[j].x, positions[j].y);
          ctx.stroke();
        }
      }
    }

    positions.forEach((pos, i) => {
      const pulse = Math.sin(timestamp / 500 + i) * 0.5 + 0.5;
      ctx.fillStyle = `rgba(100, 150, 255, ${0.3 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  const analytics = useMemo(() => analyticsRef.current.getAnalytics(), [quantumBridges]);
  const optimalTime = useMemo(() => analyticsRef.current.predictOptimalBridgeTime(), [quantumBridges]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const chain = e.shiftKey ? "NEOX" : "ETH";
    particleSystemRef.current.spawnParticles(x, y, 50, chain, e.ctrlKey || e.metaKey);
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Navigation */}
      <Navigation />
      
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
      
      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto px-4 py-8 pt-24"
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center gap-3">
                <Atom className="w-12 h-12 text-blue-400" />
                Quantum Ferry
              </h1>
              <p className="text-gray-400 mt-2">AI-Powered Cross-Chain Intelligence</p>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={() => setAutoSpawn(!autoSpawn)}
                variant={autoSpawn ? "default" : "outline"}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-toggle-autospawn"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {autoSpawn ? "Auto-Spawn On" : "Auto-Spawn Off"}
              </Button>
              <Button
                onClick={() => setShowNeural(!showNeural)}
                variant={showNeural ? "default" : "outline"}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-toggle-neural"
              >
                <Brain className="w-4 h-4 mr-2" />
                {showNeural ? "Neural On" : "Neural Off"}
              </Button>
              <Button
                onClick={() => particleSystemRef.current.clear()}
                variant="outline"
                data-testid="button-clear-particles"
              >
                Clear
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <Card className="bg-black/40 border-blue-500/30 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Activity className="w-5 h-5" />
                  Network Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-2">
                  {(analytics.networkHealth * 100).toFixed(0)}%
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${analytics.networkHealth * 100}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  Based on recent bridge activity
                </p>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-purple-500/30 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-400">
                  <TrendingUp className="w-5 h-5" />
                  Total Bridges
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold mb-2">
                  {analytics.totalBridges}
                </div>
                <div className="text-sm text-gray-400">
                  <div className="flex justify-between mt-2">
                    <span>ETH → NEOX</span>
                    <span className="text-blue-400 font-semibold">
                      {analytics.volumeETH.toFixed(2)} PFORK
                    </span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>NEOX → ETH</span>
                    <span className="text-green-400 font-semibold">
                      {analytics.volumeNEOX.toFixed(2)} PFORK
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-black/40 border-pink-500/30 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-pink-400">
                  <Clock className="w-5 h-5" />
                  Optimal Bridge Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-2">
                  {optimalTime}
                </div>
                <p className="text-sm text-gray-400">
                  AI-predicted lowest network congestion
                </p>
                {analytics.peakHours.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    Peak hours: {analytics.peakHours.join(', ')}:00 UTC
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="visualizer" className="w-full">
            <TabsList className="bg-black/60 border border-white/10">
              <TabsTrigger value="visualizer" data-testid="tab-visualizer">
                <Network className="w-4 h-4 mr-2" />
                Quantum Visualizer
              </TabsTrigger>
              <TabsTrigger value="gallery" data-testid="tab-gallery">
                <Sparkles className="w-4 h-4 mr-2" />
                Signature Gallery
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Deep Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visualizer" className="mt-6">
              <Card className="bg-black/40 border-white/10 backdrop-blur overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Atom className="w-5 h-5 text-blue-400" />
                      Quantum Entanglement Field
                    </span>
                    <div className="flex gap-2 text-sm font-normal">
                      <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                        {particleSystemRef.current.particles.length} particles
                      </Badge>
                      <Badge variant="outline" className="border-purple-500/50 text-purple-400">
                        {getPendingBridges().length} pending
                      </Badge>
                    </div>
                  </CardTitle>
                  <CardDescription>
                    Click to spawn particles • Shift+Click for NEOX • Ctrl/Cmd+Click for entangled
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="w-full h-[600px] cursor-crosshair"
                    style={{ background: 'linear-gradient(135deg, #000000 0%, #0a0a1a 100%)' }}
                    data-testid="canvas-quantum"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="gallery" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {quantumBridges.slice(0, 12).map((bridge, idx) => (
                    <div key={bridge.messageId} onClick={() => setSelectedArt(bridge.signature)}>
                      <QuantumArtCard 
                        bridge={bridge} 
                        index={idx}
                        onMint={handleMint}
                        isMinting={mintingStatus[bridge.messageId]}
                        isMinted={!!mintedBridges[bridge.messageId]}
                        mintedTokenId={mintedBridges[bridge.messageId]}
                        chainId={chainId || undefined}
                        account={account}
                      />
                    </div>
                  ))}
                </AnimatePresence>
                
                {quantumBridges.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No quantum signatures yet</p>
                    <p className="text-sm mt-2">Bridge transactions will appear here as unique generative art</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-black/40 border-white/10 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-green-400" />
                      Bridge Frequency Analysis
                    </CardTitle>
                    <CardDescription>
                      Average time between bridges: {(analytics.avgBridgeTime / 1000 / 60).toFixed(1)} minutes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">ETH Volume</span>
                          <span className="font-semibold text-blue-400">
                            {analytics.volumeETH.toFixed(2)} PFORK
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ 
                              width: `${Math.min(100, (analytics.volumeETH / (analytics.volumeETH + analytics.volumeNEOX)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-400">NEOX Volume</span>
                          <span className="font-semibold text-green-400">
                            {analytics.volumeNEOX.toFixed(2)} PFORK
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full"
                            style={{ 
                              width: `${Math.min(100, (analytics.volumeNEOX / (analytics.volumeETH + analytics.volumeNEOX)) * 100)}%` 
                            }}
                          />
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/10">
                        <div className="text-sm text-gray-400 mb-2">Next Bridge Prediction</div>
                        <div className="text-lg font-semibold">
                          {analytics.predictedNextBridge > Date.now() 
                            ? `~${Math.floor((analytics.predictedNextBridge - Date.now()) / 1000 / 60)} min`
                            : "Overdue"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-black/40 border-white/10 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-400" />
                      Quantum State Distribution
                    </CardTitle>
                    <CardDescription>
                      Analysis of bridge transaction states
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {["superposition", "entangled", "collapsed"].map(state => {
                        const count = quantumBridges.filter(b => b.quantumState === state).length;
                        const percentage = quantumBridges.length > 0 
                          ? (count / quantumBridges.length) * 100 
                          : 0;
                        
                        return (
                          <div key={state}>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-gray-400 capitalize">{state}</span>
                              <span className="font-semibold">
                                {count} ({percentage.toFixed(1)}%)
                              </span>
                            </div>
                            <div className="w-full bg-gray-800 rounded-full h-2">
                              <motion.div
                                className={`h-2 rounded-full ${
                                  state === "superposition" ? "bg-purple-500" :
                                  state === "entangled" ? "bg-blue-500" :
                                  "bg-green-500"
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                          </div>
                        );
                      })}

                      <div className="pt-4 border-t border-white/10 text-xs text-gray-500">
                        <p>States are deterministically computed from transaction hashes</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedArt && isClient && (
          <QuantumArtModal 
            txHash={selectedArt} 
            onClose={() => setSelectedArt(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
