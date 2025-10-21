"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Globe, Mail, LineChart, LogOut, Bug } from "lucide-react";
import { AdminLogout } from "@/action/AdminLogout";

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
  const pathname = usePathname();
  const prefix = isAdmin ? "/hospital" : "";

  // --- Fixed upper section links ---
  const fixedMain: SidebarItem[] = [
    ...(isAdmin
      ? [
          {
            label: "Settings",
            href: "/settings",
            icon: <Settings className="w-5 h-5" />,
          },
        ]
      : []),
    {
      label: "Support",
      href: "/support",
      icon: <Mail className="w-5 h-5" />,
    },
    {
      label: "Analytics",
      href: "/analytics",
      icon: <LineChart className="w-5 h-5" />,
    },
    {
      label: "Website",
      href: "/website",
      icon: <Globe className="w-5 h-5" />,
    },
  ];

  // --- Bottom section links ---
  const fixedBottom: SidebarItem[] = [
    {
      label: "Bug Report",
      href: "/bug-report",
      icon: <Bug className="w-5 h-5" />,
    },
  ];

  const isActive = (href: string) => pathname === `${prefix}${href}`;

  return (
    <aside className="sticky top-[6rem] flex h-[calc(100vh-6rem)] flex-col justify-between py-5">
      {/* ==================== Dynamic Section ==================== */}
      <div className="flex flex-col gap-y-2">
        {dynamicItems.map((item, index) => {
          const active = isActive(item.href);
          return (
            <Link
              key={`dynamic-${index}`}
              href={`${prefix}${item.href}`}
              className={`flex items-center gap-x-2 transition duration-200 ${
                active
                  ? "text-primary font-medium"
                  : "hover:text-foreground dark:hover:text-white"
              }`}
            >
              {item.icon && <span className="w-5 h-5">{item.icon}</span>}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* ==================== Fixed Section ==================== */}
      <div className="flex flex-col gap-y-20">
        {/* --- Main fixed items --- */}
        <div className="flex flex-col gap-y-5">
          <div className="flex flex-col gap-y-2">
            {fixedMain.map((item, index) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={`fixed-main-${index}`}
                  href={`${prefix}${item.href}`}
                  className={`flex items-center gap-x-2 transition duration-200 ${
                    active
                      ? "text-primary font-medium"
                      : "hover:text-foreground dark:hover:text-white"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}

            {/* Logout (admin only) */}
            {isAdmin && (
              <form action={AdminLogout}>
                <button
                  type="submit"
                  className="flex items-center gap-x-2 w-full text-left hover:cursor-pointer hover:text-foreground dark:hover:text-white transition duration-200"
                >
                  <LogOut className="w-5 h-5" /> Logout
                </button>
              </form>
            )}
          </div>

          {/* --- Bottom section (Bug report, etc.) --- */}
          <div className="flex flex-col gap-y-2">
            {fixedBottom.map((item, index) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={`fixed-bottom-${index}`}
                  href={`${prefix}${item.href}`}
                  className={`flex items-center gap-x-2 transition duration-200 ${
                    active
                      ? "text-primary font-medium"
                      : "hover:text-foreground dark:hover:text-white"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="text-sm text-muted-foreground">
          2025 CareChain © All Rights Reserved
        </div>
      </div>
    </aside>
  );
}
