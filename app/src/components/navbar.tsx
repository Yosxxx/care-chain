"use client";

import { ReactNode } from "react";
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
    return (
        <nav className="flex items-center justify-between py-5 border border-b mb-5">
            <div className="min-w-7xl max-w-7xl mx-auto flex items-center justify-between">
                <div className="font-bold text-4xl">{logo ?? "LOGO"}</div>

                <div className="flex items-center gap-x-5">
                    {children}
                    {right ?? <SignOutButton />}
                </div>
            </div>
        </nav>
    );
}

function NavbarId({ children }: { children: ReactNode }) {
    return <div className="p-2 border rounded-sm">ID: {children}</div>;
}

export { Navbar, NavbarId };
