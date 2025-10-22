"use client";

import AppSidebar from "@/components/app-sidebar";
import { Building2, Clock, FileText, Users } from "lucide-react";
import { useSolana } from "@/components/solana-provider";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import Navbar from "@/components/navbar";

const SIDEBAR_ITEMS = [
  {
    label: "Overview",
    href: "/user/overview",
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: "Records",
    href: "/user/records",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "Trustees",
    href: "/user/trustees",
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: "Logs",
    href: "/user/logs",
    icon: <Clock className="w-5 h-5" />,
  },
];

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isConnected } = useSolana();
  const isAdmin = false;

  if (!isConnected) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-lg mb-4">Connect to a wallet first.</div>
        <WalletConnectButton />
      </main>
    );
  }

  return (
    <main>
      <Navbar />
      <div className="grid grid-cols-12 min-w-[1400px] max-w-[1400px] mx-auto gap-x-10 pt-5">
        <div className="col-span-3">
          <AppSidebar dynamicItems={SIDEBAR_ITEMS} isAdmin={isAdmin} />
        </div>
        <div className="col-span-6">{children}</div>
        <div className="col-span-3" />
      </div>
    </main>
  );
}
