// src/components/QRCodeModal.tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, RefreshCw } from "lucide-react";

interface QRCodeModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
  sessionCode: string;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function QRCodeModal({
  open,
  onClose,
  token,
  sessionCode,
  refreshing,
  onRefresh,
}: QRCodeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Session QR Code
          </DialogTitle>
          <DialogDescription>
            Scan this QR code to mark attendance
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4 py-4">
          <h3 className="text-lg font-semibold">Session: {sessionCode}</h3>
          
          <div className="rounded-lg bg-accent p-6 text-center min-w-[280px]">
            <p className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">
              {token}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Refreshes every 3 seconds
            </p>
          </div>

          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={refreshing}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Token
          </Button>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}