import { Navbar, NavbarId } from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { SolanaProvider } from "@/components/solana-provider";
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const sidebarLinks = [
        { name: "Dashboard", href: "/user/dashboard" },
        { name: "Records", href: "/user/record" },
        { name: "Hospitals", href: "/user/hospital" },
        { name: "Audit Log", href: "/user/audit" },
        { name: "Settings", href: "/user/settings" },
    ];

    return (
        <>
            <SolanaProvider>
                <Navbar>
                    <NavbarId>XXX-XXX-XXX</NavbarId>
                    <WalletConnectButton />
                </Navbar>
                <main className="min-w-7xl max-w-7xl mx-auto">
                    <div className="grid grid-cols-12 gap-10">
                        <div className="col-span-2">
                            <Sidebar links={sidebarLinks}></Sidebar>
                        </div>
                        <div className="col-span-10">{children}</div>
                    </div>
                </main>
            </SolanaProvider>
        </>
    );
}
