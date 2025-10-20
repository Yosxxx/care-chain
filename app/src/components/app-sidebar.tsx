import Link from "next/link";

interface AppSidebarProps {
  dynamicItems: { label: string; href: string }[];
  isAdmin?: boolean;
}

export default function AppSidebar({
  dynamicItems,
  isAdmin = false,
}: AppSidebarProps) {
  // --- Prefix link based on url ---
  const prefix = isAdmin ? "/hospital" : "";

  return (
    <aside className="sticky top-[5rem] flex h-[calc(100vh-5rem)] flex-col justify-between py-10">
      {/* Dynamic section */}
      <div className="flex flex-col">
        {dynamicItems.map((item, index) => (
          <Link key={index} href={`${prefix}${item.href}`}>
            {item.label}
          </Link>
        ))}
      </div>

      {/* Fixed section */}
      <div className="flex flex-col gap-y-5">
        <div className="flex flex-col">
          <Link href={`${prefix}/settings`}>Settings</Link>
          <Link href={`${prefix}/support`}>Support</Link>
          <Link href={`${prefix}/analytics`}>Analytics</Link>
          <Link href={`${prefix}/website`}>Website</Link>
          <Link href={`${prefix}/logout`}>Logout</Link>
        </div>
        <Link href={`${prefix}/bug-report`}>Bug Report</Link>
      </div>

      {/* Footer */}
      <div>2025 CareChain © All Rights Reserved</div>
    </aside>
  );
}
