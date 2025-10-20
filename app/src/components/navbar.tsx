import { Bell } from "lucide-react";

export default function NavBar() {
  return (
    <nav className="sticky top-0 border-b">
      <main className="min-w-[1400px] max-w-[1400px] flex items-center justify-between mx-auto py-5 ">
        <div className="font-bold text-2xl">LOGO</div>
        <div className="">
          <Bell className="w-5 h-5" />
        </div>
      </main>
    </nav>
  );
}
