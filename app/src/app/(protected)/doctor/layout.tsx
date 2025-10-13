import SignOutButton from "@/components/sign-out-btn";
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>
                <SignOutButton />
                {children}
            </body>
        </html>
    );
}
