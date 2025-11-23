import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, Anchor, Volume2, VolumeX } from "lucide-react";
// @ts-ignore
import ferryVideo from "@assets/generated_videos/mystical_ferryman_rowing_ninjas_across_a_moonlit_river.mp4";
// @ts-ignore
import backgroundMusic from "@assets/Escape Moonlight  (2)_1763939442443.mp3";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  useEffect(() => {
    // Auto-play audio on mount
    if (audioRef.current) {
      audioRef.current.play().catch((error) => {
        console.log("Audio autoplay prevented:", error);
      });
    }
  }, []);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white">
      {/* Background Audio */}
      <audio ref={audioRef} loop>
        <source src={backgroundMusic} type="audio/mpeg" />
      </audio>

      {/* Audio Control Toggle */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        onClick={toggleMute}
        className="fixed top-6 right-6 z-30 p-3 rounded-full bg-black/30 backdrop-blur-md border border-white/10 hover:bg-black/50 hover:border-primary/50 transition-all group"
        title={isMuted ? "Unmute Music" : "Mute Music"}
        data-testid="button-audio-toggle"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
        ) : (
          <Volume2 className="w-5 h-5 text-primary group-hover:text-primary/80 transition-colors" />
        )}
      </motion.button>

      {/* Video Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-black/40 z-10" /> {/* Overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover opacity-80"
          onLoadedData={() => setVideoLoaded(true)}
        >
          <source src={ferryVideo} type="video/mp4" />
        </video>
      </div>

      {/* Content */}
      <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="space-y-6"
        >
          <h1 className="text-6xl md:text-8xl font-cinzel font-bold tracking-wider text-glow text-white drop-shadow-lg">
            FERRYMAN<span className="text-primary">X</span>
          </h1>
          
          <p className="text-xl md:text-2xl font-space text-gray-200 max-w-2xl mx-auto font-light tracking-wide">
            The bridge between worlds. <br/>
            <span className="text-primary/80">Ethereum</span> ⇋ <span className="text-green-400">Neo X</span>
          </p>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(6, 182, 212, 0.5)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setLocation("/bridge")}
            className="mt-12 group relative inline-flex items-center gap-3 px-8 py-4 bg-primary/10 backdrop-blur-md border border-primary/50 hover:bg-primary/20 text-primary hover:text-white rounded-none transition-all duration-300 uppercase font-cinzel font-bold tracking-widest"
          >
            <span>Enter the Ferry</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            
            {/* Border Glow Effect */}
            <div className="absolute inset-0 rounded-none border border-primary/0 group-hover:border-primary/50 transition-colors duration-500" />
          </motion.button>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-10 text-gray-500 text-sm font-space uppercase tracking-widest flex items-center gap-2"
        >
          <Anchor className="w-4 h-4" />
          Safe Passage Guaranteed
        </motion.div>
      </div>
    </div>
  );
}
