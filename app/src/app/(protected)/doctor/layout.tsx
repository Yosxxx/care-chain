import { Navbar, NavbarId } from "@/components/navbar";
import Sidebar from "@/components/sidebar";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const sidebarLinks = [
        { name: "Dashboard", href: "/doctor/dashboard" },
        { name: "Patient", href: "/doctor/patient" },
        { name: "My Activity", href: "/doctor/activity" },
        { name: "Settings", href: "/doctor/settings" },
    ];

    return (
        <>
            <Navbar>
                <NavbarId>XXX-XXX-XXX</NavbarId>
            </Navbar>
            <main className="min-w-7xl max-w-7xl mx-auto">
                <div className="grid grid-cols-12 gap-10">
                    <div className="col-span-2">
                        <Sidebar links={sidebarLinks}></Sidebar>
                    </div>
                    <div className="col-span-10">{children}</div>
                </div>
            </main>
        </>
    );
}
