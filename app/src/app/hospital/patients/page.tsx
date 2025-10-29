import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Page() {
  // Dummy dataset
  const wallets = [
    "0x742d...8a9f",
    "0x3a17...51f2",
    "0x9b4c...7d21",
    "0x5c8a...e123",
    "0x1f3b...aa22",
    "0x7ed0...f9c4",
    "0x742d...8a9f",
    "0x3a17...51f2",
    "0x9b4c...7d21",
    "0x5c8a...e123",
    "0x1f3b...aa22",
    "0x7ed0...f9c4",
    "0x742d...8a9f",
    "0x3a17...51f2",
    "0x9b4c...7d21",
    "0x5c8a...e123",
    "0x1f3b...aa22",
    "0x7ed0...f9c4",
  ];

  return (
    <main className="mt-5">
      <header className="font-architekt p-2 border rounded-xs">
        <div className="flex font-bold gap-x-2 items-center">
          <Search size={20} /> Search Users
        </div>
      </header>

      <div className="mt-2 flex gap-x-5">
        <Input placeholder="Search by wallet" />
        <Button variant="outline">
          <SlidersHorizontal />
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-5 mt-5">
        {wallets.map((wallet, index) => (
          <div key={index} className="flex gap-x-5 border items-center p-2 ">
            <div className="w-12 h-12 bg-muted-foreground/50" />
            <div>{wallet}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
