import Navbar from "@/components/navbar";
import AppSidebar from "@/components/app-sidebar";

const SIDEBAR_ITEMS = [
  { label: "Overview", href: "/overview" },
  { label: "Record intake", href: "/record-intake" },
  { label: "Patients", href: "/patients" },
  { label: "Logs", href: "/logs" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // --- For admin navigation ---
  const isAdmin = true;

  return (
    <main>
      <Navbar />
      <div className="grid grid-cols-12 min-w-[1400px] max-w-[1400px] mx-auto gap-x-10">
        <div className="col-span-3">
          <AppSidebar dynamicItems={SIDEBAR_ITEMS} isAdmin={isAdmin} />
        </div>

        <div className="col-span-6">{children}</div>
        <div className="col-span-3"></div>
      </div>
    </main>
  );
}
