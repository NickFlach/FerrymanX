import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Ship, Home, ArrowRightLeft, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Navigation() {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/", label: "Home", icon: Home, testId: "nav-home" },
    { path: "/bridge", label: "Bridge", icon: ArrowRightLeft, testId: "nav-bridge" },
    { path: "/quantum", label: "Quantum", icon: Sparkles, testId: "nav-quantum" },
  ];

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-4"
    >
      <div className="max-w-7xl mx-auto">
        <div className="relative bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl px-4 sm:px-6 py-3 shadow-2xl">
          {/* Gradient border glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-purple-500/20 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity blur-xl -z-10" />
          
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <motion.button
              onClick={() => setLocation("/")}
              className="flex items-center gap-2 sm:gap-3 group cursor-pointer"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              data-testid="nav-logo"
            >
              <div className="relative">
                <Ship className="w-6 h-6 sm:w-7 sm:h-7 text-primary group-hover:text-primary/80 transition-colors" />
                <motion.div
                  className="absolute inset-0 bg-primary/20 rounded-full blur-lg"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <h1 className="text-lg sm:text-xl font-cinzel font-bold text-white tracking-wider hidden sm:block">
                FERRYMAN<span className="text-primary">X</span>
              </h1>
            </motion.button>

            {/* Navigation Links */}
            <div className="flex items-center gap-1 sm:gap-2">
              {navItems.map((item) => {
                const isActive = location === item.path;
                const Icon = item.icon;
                
                return (
                  <motion.button
                    key={item.path}
                    onClick={() => setLocation(item.path)}
                    className={cn(
                      "relative px-3 sm:px-4 py-2 rounded-lg font-space text-sm sm:text-base font-medium tracking-wide transition-all duration-300",
                      "flex items-center gap-2",
                      isActive
                        ? item.path === "/quantum"
                          ? "text-purple-400 bg-purple-500/10"
                          : "text-primary bg-primary/10"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    data-testid={item.testId}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className={cn(
                          "absolute inset-0 rounded-lg border-2",
                          item.path === "/quantum"
                            ? "border-purple-500/50 bg-purple-500/5"
                            : "border-primary/50 bg-primary/5"
                        )}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10 hidden sm:inline">{item.label}</span>
                    
                    {/* Glow effect on hover */}
                    <motion.div
                      className={cn(
                        "absolute inset-0 rounded-lg opacity-0 blur-md -z-10",
                        item.path === "/quantum"
                          ? "bg-purple-500/30"
                          : "bg-primary/30"
                      )}
                      whileHover={{ opacity: isActive ? 0.3 : 0.2 }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
