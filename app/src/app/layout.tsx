import SignOutButton from "@/components/sign-out-btn";
import "./globals.css";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <div className="min-w-7xl max-w-7xl mx-auto">{children}</div>
            </body>
        </html>
    );
}
