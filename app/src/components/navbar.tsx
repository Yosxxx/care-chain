"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"; // ✅ static import (fixes flicker)
import { QRCodeCanvas } from "qrcode.react";
import { GeneralModal } from "@/components/general-modal";
import { QrCode } from "lucide-react";
import { toast } from "sonner";

export default function NavBar() {
  const { publicKey } = useWallet();
  const [showQR, setShowQR] = useState(false);

  const qrData = publicKey ? publicKey.toBase58() : "";

  return (
    <>
      <nav className="sticky top-0 border-b dark:bg-background bg-white">
        <main className="min-w-[1400px] max-w-[1400px] flex items-center justify-between mx-auto py-5">
          <div className="font-bold text-2xl font-sans">CARECHAIN</div>
          <div className="flex gap-x-5 items-center">
            <Button
              onClick={() => {
                if (!publicKey) {
                  return toast.error("Connect to wallet first.");
                }
                setShowQR(true);
              }}
              variant={"secondary"}
            >
              <QrCode></QrCode>
            </Button>
            <WalletMultiButton className="min-w-[160px]" />
          </div>
        </main>
      </nav>

      <GeneralModal
        open={showQR}
        onOpenChange={setShowQR}
        title="Wallet Address"
        desc={qrData}
        copyable
      >
        {qrData && (
          <div className="border rounded-lg p-3 bg-white dark:bg-card">
            <QRCodeCanvas value={qrData} size={200} includeMargin />
          </div>
        )}
      </GeneralModal>
    </>
  );
}
