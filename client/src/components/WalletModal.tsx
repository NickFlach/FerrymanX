import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Smartphone } from "lucide-react";
import { WalletType } from "@/hooks/useWeb3";

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWallet: (type: WalletType) => void;
  isConnecting: boolean;
}

export function WalletModal({ open, onOpenChange, onSelectWallet, isConnecting }: WalletModalProps) {
  const handleMetaMaskClick = () => {
    onSelectWallet("metamask");
  };

  const handleWalletConnectClick = () => {
    onSelectWallet("walletconnect");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-panel border-primary/20 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center font-cinzel text-2xl text-white">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-gray-400 font-space mt-2">
            Choose how you want to connect
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 py-6">
          <Button
            onClick={handleMetaMaskClick}
            disabled={isConnecting}
            className="w-full h-16 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold font-space text-lg border-0 shadow-lg hover:shadow-orange-500/20 transition-all"
            data-testid="button-connect-metamask"
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-6 h-6" />
              <div className="flex flex-col items-start">
                <span>MetaMask</span>
                <span className="text-xs font-normal opacity-80">Browser Extension</span>
              </div>
            </div>
          </Button>

          <Button
            onClick={handleWalletConnectClick}
            disabled={isConnecting}
            className="w-full h-16 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold font-space text-lg border-0 shadow-lg hover:shadow-blue-500/20 transition-all"
            data-testid="button-connect-walletconnect"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-6 h-6" />
              <div className="flex flex-col items-start">
                <span>WalletConnect</span>
                <span className="text-xs font-normal opacity-80">Mobile & Desktop Wallets</span>
              </div>
            </div>
          </Button>
        </div>

        <div className="text-xs text-gray-500 text-center pb-2">
          By connecting, you agree to the Terms of Service
        </div>
      </DialogContent>
    </Dialog>
  );
}
