"use client";
import dynamic from "next/dynamic";

export default function NavBar() {
  const WalletMultiButton = dynamic(
    async () =>
      (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
    { ssr: false }
  );

  return (
    <nav className="sticky top-0 border-b dark:bg-background bg-white">
      <main className="min-w-[1400px] max-w-[1400px] flex items-center justify-between mx-auto py-5 ">
        <div className="font-bold text-2xl">LOGO</div>
        <div className="flex gap-x-5 items-center">
          <WalletMultiButton />
        </div>
      </main>
    </nav>
  );
}
