import { Navbar, NavbarId } from "@/components/navbar";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <Navbar>
                    <NavbarId>XXX-XXX-XXX</NavbarId>
                </Navbar>
                <main className="min-w-7xl max-w-7xl mx-auto">{children}</main>
            </body>
        </html>
    );
}
