import Link from "next/link";
import { Settings, Globe, Mail, LineChart, LogOut, Bug } from "lucide-react";

interface SidebarItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
}

interface AppSidebarProps {
  dynamicItems: SidebarItem[];
  isAdmin?: boolean;
}

export default function AppSidebar({
  dynamicItems,
  isAdmin = false,
}: AppSidebarProps) {
  // Prefix for admin routes
  const prefix = isAdmin ? "/hospital" : "";

  return (
    <aside className="sticky top-[6rem] flex h-[calc(100vh-6rem)] flex-col justify-between py-5">
      {/* Dynamic section */}
      <div className="flex flex-col gap-y-2">
        {dynamicItems.map((item, index) => (
          <Link
            key={index}
            href={`${prefix}${item.href}`}
            className="flex items-center gap-x-2"
          >
            {item.icon && <span className="w-5 h-5">{item.icon}</span>}
            <span>{item.label}</span>
          </Link>
        ))}
      </div>

      {/* Fixed section */}
      <div className="flex flex-col gap-y-20">
        <div className="flex flex-col gap-y-5">
          <div className="flex flex-col gap-y-2">
            <Link
              className="flex items-center gap-x-2"
              href={`${prefix}/settings`}
            >
              <Settings className="w-5 h-5" /> Settings
            </Link>
            <Link
              className="flex items-center gap-x-2"
              href={`${prefix}/support`}
            >
              <Mail className="w-5 h-5" /> Support
            </Link>
            <Link
              className="flex items-center gap-x-2"
              href={`${prefix}/analytics`}
            >
              <LineChart className="w-5 h-5" /> Analytics
            </Link>
            <Link
              className="flex items-center gap-x-2"
              href={`${prefix}/website`}
            >
              <Globe className="w-5 h-5" /> Website
            </Link>
            <Link
              className="flex items-center gap-x-2"
              href={`${prefix}/logout`}
            >
              <LogOut className="w-5 h-5" /> Logout
            </Link>
          </div>

          <div>
            <Link
              href={`${prefix}/bug-report`}
              className="flex items-center gap-x-2"
            >
              <Bug className="w-5 h-5" /> Bug Report
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div>2025 CareChain © All Rights Reserved</div>
      </div>
    </aside>
  );
}
