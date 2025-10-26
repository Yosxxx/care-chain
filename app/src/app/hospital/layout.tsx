import Navbar from "@/components/navbar";
import AppSidebar from "@/components/app-sidebar";
import { Building2, FileText, Users, ClipboardList } from "lucide-react";

const SIDEBAR_ITEMS = [
  {
    label: "Overview",
    href: "/overview",
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: "Record intake",
    href: "/record-intake",
    icon: <FileText className="w-5 h-5" />,
  },
  { label: "Patients", href: "/patients", icon: <Users className="w-5 h-5" /> },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = true;

  return (
    <main>
      <Navbar />
      <div className="grid grid-cols-12 min-w-[1400px] max-w-[1400px] mx-auto gap-x-10 pt-5">
        <div className="col-span-3">
          <AppSidebar dynamicItems={SIDEBAR_ITEMS} isAdmin={isAdmin} />
        </div>

        <div className="col-span-6">{children}</div>
        <div className="col-span-3"></div>
      </div>
    </main>
  );
}
