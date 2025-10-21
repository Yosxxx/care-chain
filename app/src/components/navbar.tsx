import { Bell } from "lucide-react";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { WalletConnectButton } from "./wallet-connect-button";

export default function NavBar() {
  return (
    <nav className="sticky top-0 border-b dark:bg-background bg-white">
      <main className="min-w-[1400px] max-w-[1400px] flex items-center justify-between mx-auto py-5 ">
        <div className="font-bold text-2xl">LOGO</div>
        <div className="flex gap-x-5 items-center">
          <WalletConnectButton />
          <Bell size={24} />
          <AnimatedThemeToggler />
        </div>
      </main>
    </nav>
  );
}
