"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/sign-out-btn";

function Navbar({
    children,
    logo,
    right,
}: {
    children?: ReactNode;
    logo?: ReactNode;
    right?: ReactNode;
}) {
    const pathname = usePathname();

    const hideSignOut = pathname.startsWith("/user");

    return (
        <nav className="flex items-center justify-between py-5 border-b mb-5">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
                <div className="font-bold text-4xl">{logo ?? "LOGO"}</div>

                <div className="flex items-center gap-x-5">
                    {children}
                    {!hideSignOut && (right ?? <SignOutButton />)}
                </div>
            </div>
        </nav>
    );
}

function NavbarId({ children }: { children: ReactNode }) {
    return <div className="p-2 border rounded-sm">ID: {children}</div>;
}

export { Navbar, NavbarId };
