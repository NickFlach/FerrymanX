import { ethers } from "ethers";

export interface QuantumParticle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  entangled?: boolean;
  chain: "ETH" | "NEOX";
}

export interface QuantumBridge {
  messageId: string;
  timestamp: number;
  amount: string;
  sourceChain: "ETH" | "NEOX";
  destChain: "ETH" | "NEOX";
  signature: string;
  quantumState: "superposition" | "collapsed" | "entangled";
  artSeed: number;
}

export interface BridgeAnalytics {
  totalBridges: number;
  volumeETH: number;
  volumeNEOX: number;
  avgBridgeTime: number;
  peakHours: number[];
  predictedNextBridge: number;
  networkHealth: number;
}

export class QuantumArtGenerator {
  private seed: number;

  constructor(txHash: string) {
    this.seed = parseInt(txHash.slice(2, 10), 16);
  }

  private random(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  generateSignature(width: number, height: number): string {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return '';
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    const shapes = 20 + Math.floor(this.random() * 30);
    const hue = this.random() * 360;

    for (let i = 0; i < shapes; i++) {
      const x = this.random() * width;
      const y = this.random() * height;
      const size = this.random() * 100 + 20;
      const opacity = 0.3 + this.random() * 0.5;
      const rotation = this.random() * Math.PI * 2;
      
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      
      const shapeType = Math.floor(this.random() * 4);
      const color = `hsla(${(hue + i * 15) % 360}, ${60 + this.random() * 40}%, ${40 + this.random() * 40}%, ${opacity})`;
      
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 + this.random() * 3;

      switch(shapeType) {
        case 0:
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 1:
          ctx.fillRect(-size/2, -size/2, size, size);
          break;
        case 2:
          ctx.beginPath();
          for(let j = 0; j < 6; j++) {
            const angle = (Math.PI * 2 * j) / 6;
            const px = Math.cos(angle) * size;
            const py = Math.sin(angle) * size;
            if(j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          break;
        case 3:
          const points = 5 + Math.floor(this.random() * 8);
          for(let j = 0; j < points; j++) {
            const angle1 = (Math.PI * 2 * j) / points + this.random() * 0.5;
            const angle2 = (Math.PI * 2 * (j + 1)) / points + this.random() * 0.5;
            const r1 = size * (0.5 + this.random() * 0.5);
            const r2 = size * (0.5 + this.random() * 0.5);
            
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle1) * r1, Math.sin(angle1) * r1);
            ctx.lineTo(Math.cos(angle2) * r2, Math.sin(angle2) * r2);
            ctx.closePath();
            ctx.fill();
          }
          break;
      }
      
      ctx.restore();
    }

    const gridLines = 5 + Math.floor(this.random() * 10);
    ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.2)`;
    ctx.lineWidth = 1;
    
    for(let i = 0; i < gridLines; i++) {
      ctx.beginPath();
      ctx.moveTo(this.random() * width, this.random() * height);
      ctx.lineTo(this.random() * width, this.random() * height);
      ctx.stroke();
    }

    return canvas.toDataURL();
  }

  getColorPalette(): string[] {
    const baseHue = this.random() * 360;
    return [
      `hsl(${baseHue}, 70%, 60%)`,
      `hsl(${(baseHue + 120) % 360}, 70%, 60%)`,
      `hsl(${(baseHue + 240) % 360}, 70%, 60%)`,
      `hsl(${(baseHue + 60) % 360}, 70%, 60%)`,
      `hsl(${(baseHue + 180) % 360}, 70%, 60%)`,
    ];
  }
}

export class ParticleSystem {
  particles: QuantumParticle[] = [];
  private nextId = 0;

  spawnParticles(x: number, y: number, count: number, chain: "ETH" | "NEOX", entangled = false) {
    const baseColor = chain === "ETH" ? [138, 180, 248] : [142, 251, 142];
    
    for(let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 3;
      const life = 60 + Math.random() * 60;
      
      const colorVariation = entangled ? 50 : 30;
      const r = Math.max(0, Math.min(255, baseColor[0] + (Math.random() - 0.5) * colorVariation));
      const g = Math.max(0, Math.min(255, baseColor[1] + (Math.random() - 0.5) * colorVariation));
      const b = Math.max(0, Math.min(255, baseColor[2] + (Math.random() - 0.5) * colorVariation));
      
      this.particles.push({
        id: `p${this.nextId++}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color: `rgb(${r}, ${g}, ${b})`,
        size: 2 + Math.random() * 3,
        entangled,
        chain
      });
    }
  }

  update(deltaTime: number = 1) {
    this.particles = this.particles.filter(p => {
      p.life -= deltaTime;
      if(p.life <= 0) return false;
      
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      p.vx *= 0.99;
      p.vy *= 0.99;
      
      return true;
    });
  }

  clear() {
    this.particles = [];
  }
}

export class PredictiveAnalytics {
  private bridges: QuantumBridge[] = [];

  addBridge(bridge: QuantumBridge) {
    this.bridges.push(bridge);
    if(this.bridges.length > 100) {
      this.bridges.shift();
    }
  }

  getAnalytics(): BridgeAnalytics {
    if(this.bridges.length === 0) {
      return {
        totalBridges: 0,
        volumeETH: 0,
        volumeNEOX: 0,
        avgBridgeTime: 0,
        peakHours: [],
        predictedNextBridge: Date.now() + 300000,
        networkHealth: 1.0
      };
    }

    const ethBridges = this.bridges.filter(b => b.sourceChain === "ETH");
    const neoxBridges = this.bridges.filter(b => b.sourceChain === "NEOX");
    
    const volumeETH = ethBridges.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);
    const volumeNEOX = neoxBridges.reduce((sum, b) => sum + parseFloat(b.amount || "0"), 0);

    const hourCounts = new Array(24).fill(0);
    this.bridges.forEach(b => {
      const hour = new Date(b.timestamp).getHours();
      hourCounts[hour]++;
    });
    
    const maxCount = Math.max(...hourCounts);
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(({ count }) => count >= maxCount * 0.8)
      .map(({ hour }) => hour);

    const timeDiffs = [];
    for(let i = 1; i < this.bridges.length; i++) {
      timeDiffs.push(this.bridges[i].timestamp - this.bridges[i-1].timestamp);
    }
    const avgBridgeTime = timeDiffs.length > 0 
      ? timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length 
      : 300000;

    const lastBridge = this.bridges[this.bridges.length - 1];
    const predictedNextBridge = lastBridge.timestamp + avgBridgeTime;

    const recentActivity = this.bridges.filter(b => 
      Date.now() - b.timestamp < 3600000
    ).length;
    const networkHealth = Math.min(1.0, recentActivity / 10);

    return {
      totalBridges: this.bridges.length,
      volumeETH,
      volumeNEOX,
      avgBridgeTime,
      peakHours,
      predictedNextBridge,
      networkHealth
    };
  }

  predictOptimalBridgeTime(): string {
    const analytics = this.getAnalytics();
    
    if(analytics.peakHours.length === 0) {
      return "Insufficient data for prediction";
    }

    const currentHour = new Date().getHours();
    const isOffPeak = !analytics.peakHours.includes(currentHour);
    
    if(isOffPeak) {
      return "Now (off-peak)";
    } else {
      const hours = Array.from({ length: 24 }, (_, i) => i);
      const nextOffPeak = hours
        .filter(h => !analytics.peakHours.includes(h))
        .find(h => h > currentHour) || analytics.peakHours[0];
      
      return `${nextOffPeak}:00 UTC (off-peak)`;
    }
  }
}

export function hashToBridgeState(txHash: string): "superposition" | "collapsed" | "entangled" {
  const hash = parseInt(txHash.slice(2, 4), 16);
  if(hash < 85) return "superposition";
  if(hash < 170) return "entangled";
  return "collapsed";
}

export function computeQuantumEntropy(messageId: string): number {
  let entropy = 0;
  for(let i = 0; i < messageId.length; i++) {
    const charCode = messageId.charCodeAt(i);
    entropy += charCode;
  }
  return (entropy % 100) / 100;
}
